import { describe, expect, it } from 'vitest'
import { Ledger } from '../../src/ai/normal/suspicion'
import { OVERRUN_COST, boardCost, simulateArrivals } from '../../src/ai/normal/info'
import { createDecider, type AiDecider } from '../../src/ai/index'
import { createGame, legalActions, redactEvent, step, view, type Action, type GameEvent, type GameState } from '../../src/engine/index'
import { DEFAULT_OPTIONS, runGame } from '../../tools/sim-core'
import { loadDefaultBundle } from '../../tools/default-bundle'

const bundle = loadDefaultBundle()
const opts = { ...DEFAULT_OPTIONS, seats: 4, objective: 'obj.main.we-need-more-samples' }
const SEATS = ['s1', 's2', 's3', 's4']

/** Play one all-Normal game by hand through the public API; `onStep` sees every action and the events it produced. */
async function play(seed: string, onStep: (a: Action, events: GameEvent[], before: GameState) => void): Promise<GameState> {
  let st = createGame({ seats: SEATS.map((id) => ({ id, kind: 'bot' as const })), mainObjective: opts.objective }, seed, bundle).state
  const ds: Record<string, AiDecider> = {}
  for (const s of st.seatOrder) ds[s] = createDecider('normal', undefined, seed)
  for (let k = 0; k < 2000 && st.phase !== 'ended'; k++) {
    const legal = legalActions(st)
    let a: Action
    if (st.pending.kind === 'votes') {
      const eligible = ((st.pending.context.data as { eligible?: string[] }).eligible ?? st.seatOrder) as string[]
      const votes: Record<string, boolean> = {}
      for (const s of eligible) { const p = await ds[s]!.decide(view(st, s), st.pending, legal); votes[s] = p.type === 'castVotes' && p.votes[s] === true }
      a = { type: 'castVotes', decisionId: st.pending.id, seat: 'all', votes }
    } else {
      const seat = st.pending.seat as string
      a = await ds[seat]!.decide(view(st, seat), st.pending, legal)
    }
    const r = step(st, a)
    expect(r.rejection, `${a.type} rejected`).toBeUndefined()
    onStep(a, r.events, st)
    for (const s of r.state.seatOrder) ds[s]!.observe(r.events.map((e) => redactEvent(e, s)).filter((e): e is GameEvent => e !== null), view(r.state, s))
    st = r.state
  }
  return st
}

describe('AI-001 Normal bots play whole games through the public API', () => {
  it('every answer is accepted by the engine, the leak test and invariants stay clean, no stalls', async () => {
    for (let i = 0; i < 4; i++) {
      const g = await runGame(bundle, `ai1-${i}`, i, { ...opts, tier: 'normal' })
      expect(g.ended, `game ${i} ended`).toBe(true)
      expect(g.violations.map((v) => `${v.kind}: ${v.message}`)).toEqual([])
      expect(g.leaks).toEqual([])
    }
  })

  it('AI-002 is deterministic: the same seed gives the same game', async () => {
    const a = await runGame(bundle, 'ai2', 0, { ...opts, tier: 'normal' })
    const b = await runGame(bundle, 'ai2', 0, { ...opts, tier: 'normal' })
    expect([a.rounds, a.decisions, a.endReason, a.finalMorale]).toEqual([b.rounds, b.decisions, b.endReason, b.finalMorale])
  })

  it('AI-003 Normal outlasts Random over the same seeds', async () => {
    let normal = 0
    let random = 0
    const n = 10
    for (let i = 0; i < n; i++) {
      normal += (await runGame(bundle, `ai3-${i}`, i, { ...opts, tier: 'normal' })).rounds
      random += (await runGame(bundle, `ai3-${i}`, i, { ...opts, tier: 'random' })).rounds
    }
    expect(normal / n).toBeGreaterThan(random / n + 0.8)
  })

  it('AI-004 never attacks a survivor, and every decision stays inside the time budget', async () => {
    const g = await runGame(bundle, 'ai4-time', 0, { ...opts, tier: 'normal' })
    expect(Math.max(...g.decisionMs)).toBeLessThan(100)
    let attacksOnSurvivors = 0
    await play('ai4-log', (a) => { if (a.type === 'attack' && a.target.kind === 'survivor') attacksOnSurvivors++ })
    expect(attacksOnSurvivors).toBe(0)
  })

  it('AI-005 a table without a betrayer never puts a wrong card into the crisis', async () => {
    let wrong = 0
    let checked = 0
    for (let i = 0; i < 12; i++) {
      const seed = `ai5-${i}`
      const first = createGame({ seats: SEATS.map((id) => ({ id, kind: 'bot' as const })), mainObjective: opts.objective }, seed, bundle).state
      if (first.seatOrder.some((s) => (first.seats[s]!.secretObjectiveId ?? '').startsWith('obj.betrayal.'))) continue
      await play(seed, (_a, events) => {
        for (const ev of events) if (ev.type === 'CrisisResolved' && ev.cards > 0) { checked++; wrong += Math.round((ev.cards - ev.total) / 2) }
      })
    }
    expect(checked).toBeGreaterThan(5)
    expect(wrong).toBe(0)
  })
})

describe('AI-006 colony board model', () => {
  it('arrivals fill spaces, then break barricades, then overrun', () => {
    const ent = [{ z: 2, b: 0 }, { z: 1, b: 2 }]
    const r = simulateArrivals(ent, 3, 4)
    expect(r.overruns).toBe(1)
    expect(r.broken).toBe(1)
    expect(boardCost(ent, 3, 4, 1)).toBeGreaterThan(OVERRUN_COST - 0.01)
  })
  it('killing the zombie at a full entrance is worth about one overrun', () => {
    const full = [{ z: 3, b: 0 }, { z: 0, b: 0 }]
    const less = [{ z: 2, b: 0 }, { z: 0, b: 0 }]
    expect(boardCost(full, 3, 1, 1) - boardCost(less, 3, 1, 1)).toBeCloseTo(OVERRUN_COST, 5)
  })
})

describe('AI-007 suspicion ledger', () => {
  const seatsView = (me: string, survivors: Record<string, unknown> = {}) => ({
    seat: me, seatOrder: SEATS, survivors,
    seats: Object.fromEntries(SEATS.map((s) => [s, { seat: { exiled: false, eliminated: false } }])),
  }) as never
  const contributed = (seat: string): GameEvent => ({ type: 'CardContributed', seat, cardId: '', from: 'hand' })
  const resolved = (cards: number, total: number): GameEvent => ({ type: 'CrisisResolved', cardId: 'cr.x', total, needed: 3, prevented: total >= 3, bonus: false, cards })

  it('shortfalls point at the seats that are in the pile whenever a card is wrong', () => {
    const l = new Ledger({ me: 's1', paranoia: 1, selfCandidate: false })
    const v = seatsView('s1')
    l.observe([contributed('s2'), contributed('s4'), resolved(2, 0)], v)
    l.observe([contributed('s2'), contributed('s4'), resolved(2, 0)], v)
    l.observe([contributed('s2'), contributed('s3'), contributed('s4'), resolved(3, 1)], v)
    expect(l.score('s3')).toBeLessThan(0.1) // s3 sat out two of the three bad rounds
    expect(l.score('s2')).toBeGreaterThan(0.4)
    expect(['s2', 's4']).toContain(l.top()?.seat)
  })

  it('clean crises keep everyone below any vote threshold, and an own wrong card is not blamed on others', () => {
    const l = new Ledger({ me: 's1', paranoia: 1, selfCandidate: false })
    const v = seatsView('s1')
    for (let i = 0; i < 4; i++) l.observe([contributed('s2'), contributed('s3'), contributed('s4'), resolved(3, 3)], v)
    for (const s of ['s2', 's3', 's4']) expect(l.score(s)).toBeLessThan(0.2)
    const m = new Ledger({ me: 's1', paranoia: 1, selfCandidate: false })
    m.noteOwnWrong(1)
    m.observe([contributed('s1'), contributed('s2'), resolved(2, 0)], v)
    expect(m.score('s2')).toBeLessThan(0.2)
  })

  it('an attack on another seat survivor is strong evidence against the attacker', () => {
    const l = new Ledger({ me: 's1', paranoia: 1, selfCandidate: false })
    const v = seatsView('s1', { a: { owner: 's2' }, b: { owner: 's3' } })
    l.observe([{ type: 'SurvivorAttacked', attackerId: 'a', targetId: 'b', rollId: 'r:1', roll: 2, targetAttack: 3, hit: true }], v)
    expect(l.top()?.seat).toBe('s2')
    expect(l.score('s2')).toBeGreaterThan(0.6)
  })
})

describe('AI-008 adding cards under the main objective', () => {
  async function turnWithMedicine(betrayer: boolean): Promise<{ pick: Action; legal: Action[] }> {
    let st = createGame({ seats: SEATS.slice(0, 3).map((id) => ({ id, kind: 'bot' as const })), mainObjective: 'obj.main.find-a-cure' }, 'ai8', bundle).state
    const setupDecider = createDecider('normal', undefined, 'ai8')
    for (let k = 0; k < 200 && st.pending.kind !== 'turnAction'; k++) {
      const seat = st.pending.seat as string
      st = step(st, await setupDecider.decide(view(st, seat), st.pending, legalActions(st))).state
    }
    const seat = st.pending.seat as string
    const id = 'c:test-med'
    st = {
      ...st,
      cards: { ...st.cards, [id]: { id, defId: 'it.medicine' } },
      seats: { ...st.seats, [seat]: { ...st.seats[seat]!, hand: [...st.seats[seat]!.hand, id], ...(betrayer ? { secretObjectiveId: 'obj.betrayal.serial-killers' } : {}) } },
    }
    const legal = legalActions(st)
    const d = createDecider('normal', undefined, 'ai8')
    return { pick: await d.decide(view(st, seat), st.pending, legal), legal }
  }
  it('a loyal seat adds a counting card to Find a Cure; a betrayer hoards it', async () => {
    const loyal = await turnWithMedicine(false)
    expect(loyal.legal.some((a) => a.type === 'contributeObjective')).toBe(true)
    expect(loyal.pick.type).toBe('contributeObjective')
    const traitor = await turnWithMedicine(true)
    expect(traitor.legal.some((a) => a.type === 'contributeObjective')).toBe(true)
    expect(traitor.pick.type).not.toBe('contributeObjective')
  })
})
