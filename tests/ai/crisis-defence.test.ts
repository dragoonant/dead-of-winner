// AI-010..AI-014: the Normal planner keeps crisis-matching cards for the pile while it is short, searches where the deck holds the crisis
// symbol, prices a failing crisis' colony zombies into its defence, and hands in its fair share at the end of its turn.
import { describe, expect, it } from 'vitest'
import { createDecider, type AiDecider } from '../../src/ai/index'
import { PlanCache, scoreTurnAction, useTune, type PlanEnv } from '../../src/ai/normal/plan'
import { Ledger } from '../../src/ai/normal/suspicion'
import { DEFAULT_SCALARS } from '../../src/ai/personas'
import { TIERS } from '../../src/ai/tiers'
import { createGame, legalActions, step, view, type Action, type GameState } from '../../src/engine/index'
import type { SeatView } from '../../src/engine/view'
import { loadDefaultBundle } from '../../tools/default-bundle'

const bundle = loadDefaultBundle()
const SEATS = ['s1', 's2', 's3', 's4']

/** Play the bots through setup to the first seat's turn action and hand back that seat's view. */
async function firstTurn(seed: string, objective: string): Promise<{ st: GameState; seat: string }> {
  let st = createGame({ seats: SEATS.map((id) => ({ id, kind: 'bot' as const })), mainObjective: objective }, seed, bundle).state
  const ds: Record<string, AiDecider> = {}
  for (const s of st.seatOrder) ds[s] = createDecider('normal', undefined, seed)
  for (let k = 0; k < 400; k++) {
    if (st.pending.kind === 'turnAction' && st.pending.seat !== 'all') return { st, seat: st.pending.seat as string }
    const seat = st.pending.seat as string
    const a = await ds[seat]!.decide(view(st, seat), st.pending, legalActions(st))
    const r = step(st, a)
    if (r.rejection) throw new Error(`rejected ${a.type}`)
    for (const s of r.state.seatOrder) ds[s]!.observe([], view(r.state, s))
    st = r.state
  }
  throw new Error('no turn action reached')
}

/** The view with the crisis, the hand and the supply set by hand: `hand` lists item defIds, added to the viewer's hand as fresh card instances. */
function staged(v: SeatView, o: { crisis?: string | null; cardsIn?: number; hand?: string[]; food?: number }): { v: SeatView; ids: string[] } {
  const out = structuredClone(v) as SeatView
  out.crisis = { ...out.crisis, cardId: o.crisis === undefined ? out.crisis.cardId : o.crisis, result: null, contributionCount: o.cardsIn ?? 0, contributionsBySeat: {} }
  out.me = { ...out.me, hand: [], contributions: [] }
  const ids: string[] = []
  ;(o.hand ?? []).forEach((defId, i) => { const id = `test-card-${i}`; out.cards[id] = { id, defId }; out.me.hand.push(id); ids.push(id) })
  if (o.food !== undefined) out.food = o.food
  return { v: out, ids }
}

function envOf(v: SeatView): PlanEnv {
  useTune(TIERS.normal.tune)
  return {
    v, me: v.seat, scalars: DEFAULT_SCALARS, ledger: new Ledger({ me: v.seat, paranoia: 1, trust: 0.6, selfCandidate: false }, `t-${v.seat}`), betrayer: false,
    selfScore: () => 0, mem: { requestTurn: -1, voteRound: -1, calledAt: -1, objRound: -1, fuelWho: null }, rand: () => 0.5, expired: () => false,
    tier: TIERS.normal, cover: () => Infinity,
  }
}

describe('AI-010 the pile keeps its matching cards', () => {
  it('a food card is not played into the supply while a food crisis is short, but is once the crisis wants something else', async () => {
    const { st, seat } = await firstTurn('ai10', 'obj.main.we-need-more-samples')
    const base = view(st, seat)
    const need = Math.ceil((Object.values(base.survivors).filter((s) => s.status === 'alive' && s.location === 'colony').length + base.locations['colony']!.helpless) / 2)
    const held = staged(base, { crisis: 'cr.horror-in-the-night', hand: ['it.food-1'], food: need })
    const free = staged(base, { crisis: 'cr.fuel-shortage', hand: ['it.food-1'], food: need })
    const act = (ids: string[], v: SeatView): Action => ({ type: 'playCard', cardId: ids[0]!, decisionId: v.pending.id, seat: v.seat })
    const cHeld = new PlanCache(envOf(held.v))
    expect(cHeld.holdsForCrisis(held.ids[0]!)).toBe(true)
    expect(scoreTurnAction(cHeld, act(held.ids, held.v))).toBeLessThanOrEqual(-1)
    const cFree = new PlanCache(envOf(free.v))
    expect(cFree.holdsForCrisis(free.ids[0]!)).toBe(false)
    expect(scoreTurnAction(cFree, act(free.ids, free.v))).toBeGreaterThan(0)
  })

  it('a seat that already holds its fair share does not hold back the spare card', async () => {
    const { st, seat } = await firstTurn('ai10b', 'obj.main.we-need-more-samples')
    // a one-card need split four ways: the first card is the seat\'s share, the rest are spare
    const s = staged(view(st, seat), { crisis: 'cr.horror-in-the-night', cardsIn: 3, hand: ['it.food-1', 'it.food-1', 'it.food-1', 'it.food-1', 'it.food-1'] })
    const c = new PlanCache(envOf(s.v))
    expect(c.crisis().keepN).toBeLessThan(5)
    expect(c.holdsForCrisis(s.ids[0]!)).toBe(false)
  })
})

describe('AI-011 search targeting follows the crisis symbol', () => {
  it('a fuel crisis makes the gas station worth more than the grocery store, a tool crisis the reverse', async () => {
    const { st, seat } = await firstTurn('ai11', 'obj.main.we-need-more-samples')
    const base = view(st, seat)
    const fuel = new PlanCache(envOf(staged(base, { crisis: 'cr.fuel-shortage', hand: [], food: 20 }).v))
    expect(fuel.searchValue('loc.gas-station')).toBeGreaterThan(fuel.searchValue('loc.grocery-store'))
    const tool = new PlanCache(envOf(staged(base, { crisis: 'cr.zombie-wave', hand: [], food: 20 }).v))
    expect(tool.searchValue('loc.grocery-store')).toBeGreaterThan(tool.searchValue('loc.gas-station'))
    // the same deck is worth more with the symbol wanted than without a crisis showing
    const none = new PlanCache(envOf(staged(base, { crisis: null, hand: [], food: 20 }).v))
    expect(fuel.searchValue('loc.gas-station')).toBeGreaterThan(none.searchValue('loc.gas-station'))
  })

  it('what a deck is worth next round ignores the crisis showing now', async () => {
    const { st, seat } = await firstTurn('ai11b', 'obj.main.we-need-more-samples')
    const c = new PlanCache(envOf(staged(view(st, seat), { crisis: 'cr.fuel-shortage', hand: [] }).v))
    expect(c.searchValue('loc.gas-station', false)).toBeLessThan(c.searchValue('loc.gas-station', true))
  })
})

describe('AI-012 colony defence prices a failing crisis', () => {
  it('colony zombies from a failing crisis raise the expected arrivals and the value of killing one at the colony', async () => {
    const { st, seat } = await firstTurn('ai12', 'obj.main.leave-it-all-behind') // 12 colony zombies and no barricade goal: the goal layer would price the kill by what the wall survives
    const base = view(st, seat)
    const hordes = staged(base, { crisis: 'cr.legions-of-death', hand: [] }).v
    const calm = staged(base, { crisis: 'cr.fuel-shortage', hand: [], food: 20 }).v
    const cH = new PlanCache(envOf(hordes))
    const cC = new PlanCache(envOf(calm))
    expect(cH.crisis().colonyZ).toBe(12)
    expect(cH.arrivals('colony')).toBeGreaterThan(cC.arrivals('colony'))
    const mine = (base.seats[seat]!.survivors).find((id) => base.survivors[id]!.location === 'colony')!
    const ent = base.locations['colony']!.entrances.find((e) => e.zombies > 0)!
    const die = base.seats[seat]!.dice.find((d) => !d.used)!
    const kill: Action = { type: 'attack', survivorId: mine, dieId: die.id, target: { kind: 'zombie', location: 'colony', entrance: ent.index }, decisionId: base.pending.id, seat }
    expect(scoreTurnAction(cH, kill)).toBeGreaterThanOrEqual(scoreTurnAction(cC, kill))
  })
})

describe('AI-013 a loyal seat hands in its matching cards', () => {
  it('when the pile is short and the seat holds a matching card, it almost always puts one in', async () => {
    let asked = 0
    let gave = 0
    for (let g = 0; g < 4; g++) {
      const seed = `ai13-${g}`
      let st = createGame({ seats: SEATS.map((id) => ({ id, kind: 'bot' as const })), mainObjective: 'obj.main.we-need-more-samples' }, seed, bundle).state
      const ds: Record<string, AiDecider> = {}
      for (const s of st.seatOrder) ds[s] = createDecider('normal', undefined, seed)
      for (let k = 0; k < 1500 && st.phase !== 'ended'; k++) {
        const seat = st.pending.seat as string
        const legal = legalActions(st)
        let a: Action
        if (st.pending.kind === 'votes') {
          const eligible = ((st.pending.context.data as { eligible?: string[] }).eligible ?? st.seatOrder) as string[]
          const votes: Record<string, boolean> = {}
          for (const s of eligible) { const p = await ds[s]!.decide(view(st, s), st.pending, legal); votes[s] = p.type === 'castVotes' && p.votes[s] === true }
          a = { type: 'castVotes', decisionId: st.pending.id, seat: 'all', votes }
        } else a = await ds[seat]!.decide(view(st, seat), st.pending, legal)
        if (st.pending.kind === 'crisisContribution' && a.type === 'contributeCrisis' && st.seats[seat]!.secretObjectiveId?.startsWith('obj.betrayal.') !== true) {
          const v = view(st, seat)
          const prevent = (bundle.byId[v.crisis.cardId ?? ''] as { prevent?: string[] } | undefined)?.prevent ?? []
          const matching = legal.filter((x) => x.type === 'contributeCrisis' && x.cardIds.length === 1 && ((bundle.byId[v.cards[x.cardIds[0]!]!.defId] as { symbol?: string; symbols?: string[] } | undefined)?.symbols ?? [(bundle.byId[v.cards[x.cardIds[0]!]!.defId] as { symbol?: string } | undefined)?.symbol ?? '']).some((s) => prevent.includes(s)))
          const needed = v.seatOrder.length
          if (matching.length > 0 && v.crisis.contributionCount < needed) { asked++; if (a.cardIds.length > 0) gave++ }
        }
        const r = step(st, a)
        if (r.rejection) throw new Error(`rejected ${a.type}`)
        for (const s of r.state.seatOrder) ds[s]!.observe([], view(r.state, s))
        st = r.state
      }
    }
    expect(asked).toBeGreaterThan(5)
    expect(gave / asked).toBeGreaterThan(0.8)
  })
})

describe('AI-014 a seat does not park extra bodies at a colony that is about to be overrun', () => {
  it('the cost of the colony rises with one more survivor there when the board is full', async () => {
    const { st, seat } = await firstTurn('ai14', 'obj.main.stockpile')
    const c = new PlanCache(envOf(staged(view(st, seat), { crisis: null, hand: [] }).v))
    expect(c.cost('colony', undefined, 2)).toBeGreaterThanOrEqual(c.cost('colony'))
    expect(c.defW('colony')).toBeGreaterThanOrEqual(1)
  })
})

describe('AI-015 finishing the main objective outweighs the crisis hold', () => {
  it('a medicine card goes under Find a Cure when the hand completes it, though the crisis wants medicine too', async () => {
    const { st, seat } = await firstTurn('ai15', 'obj.main.find-a-cure')
    const base = view(st, seat)
    const need = 2 * base.seatOrder.length
    const mk = (have: number, hand: string[]): { c: PlanCache; act: Action } => {
      const s = staged(base, { crisis: 'cr.despair', hand, food: 20 })
      s.v.objective = { ...s.v.objective, counters: { ...s.v.objective.counters, medicine: have }, complete: false }
      return { c: new PlanCache(envOf(s.v)), act: { type: 'contributeObjective', cardId: s.ids[0]!, decisionId: s.v.pending.id, seat: s.v.seat } }
    }
    const done = mk(need - 2, ['it.medicine', 'it.medicine'])
    expect(done.c.holdsForCrisis(done.act.type === 'contributeObjective' ? done.act.cardId : '')).toBe(true)
    expect(done.c.objectiveClose().finishes).toBe(true)
    expect(scoreTurnAction(done.c, done.act)).toBeGreaterThan(0)
  })
})
