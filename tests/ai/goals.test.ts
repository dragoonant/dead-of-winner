// AI-019..AI-025: the objective-goal layer (src/ai/normal/goals.ts). It reads the main objective's condition, prices the actions that move the
// unmet parts (kills that free a barricade space, barricades the goal counts, supply food, outside kills, target decks, a weapon per seat), and
// leaves a betrayer alone.
import { describe, expect, it } from 'vitest'
import { createDecider, type AiDecider } from '../../src/ai/index'
import { PlanCache, TUNE, scoreTurnAction, useTune, type PlanEnv } from '../../src/ai/normal/plan'
import { Ledger } from '../../src/ai/normal/suspicion'
import { DEFAULT_SCALARS } from '../../src/ai/personas'
import { TIERS } from '../../src/ai/tiers'
import { createGame, legalActions, step, view, type Action, type GameState } from '../../src/engine/index'
import type { SeatView } from '../../src/engine/view'
import { DEFAULT_OPTIONS, runGame } from '../../tools/sim-core'
import { loadDefaultBundle } from '../../tools/default-bundle'

const bundle = loadDefaultBundle()
const SEATS = ['s1', 's2', 's3', 's4']
const pre = (o: string): string => `obj.main.${o}`

/** Play the bots through setup to the first seat's turn action. */
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

function envOf(v: SeatView, betrayer = false): PlanEnv {
  useTune(TIERS.normal.tune)
  return {
    v, me: v.seat, scalars: DEFAULT_SCALARS, ledger: new Ledger({ me: v.seat, paranoia: 1, trust: 0.6, selfCandidate: false }, `g-${v.seat}`), betrayer,
    selfScore: () => 0, mem: { requestTurn: -1, voteRound: -1, calledAt: -1, objRound: -1, fuelWho: null }, rand: () => 0.5, expired: () => false,
    tier: TIERS.normal, cover: () => Infinity,
  }
}
/** A copy of the view with no open crisis (so no failure zombies are priced in) and an edit applied. */
function staged(v: SeatView, edit: (o: SeatView) => void = () => undefined): SeatView {
  const o = structuredClone(v) as SeatView
  o.crisis = { ...o.crisis, cardId: null, result: null, contributionCount: 0, contributionsBySeat: {} }
  edit(o)
  return o
}
const setEntrance = (v: SeatView, loc: string, index: number, zombies: number, barricades: number): void => {
  const e = v.locations[loc]!.entrances.find((x) => x.index === index)!
  e.zombies = zombies
  e.barricades = barricades
}
const kinds = (c: PlanCache): string[] => c.goals().leaves.map((l) => l.kind)

describe('AI-019 the goal layer reads the unmet parts of the objective condition', () => {
  it('maps each main objective to its levers', async () => {
    const want: Record<string, string[]> = {
      stockpile: ['everyEntrance', 'food', 'counter'],
      'home-sweet-home': ['barricades'],
      'kill-them': ['outside'],
      'raiding-party': ['decks'],
      'leave-it-all-behind': ['weapons', 'counter'],
      'find-a-cure': ['counter'],
    }
    for (const [o, ks] of Object.entries(want)) {
      const { st, seat } = await firstTurn(`ai19-${o}`, pre(o))
      const c = new PlanCache(envOf(view(st, seat)))
      for (const k of ks) expect(kinds(c), `${o} has a ${k} lever`).toContain(k)
      expect(c.goals().on, `${o} prices progress`).toBe(true)
    }
  })

  it('counts what is missing: 15 zombies over the limit, 6 entrances, 40 cards in the two target decks, 4 unarmed seats', async () => {
    const left = async (o: string, kind: string): Promise<number> => {
      const { st, seat } = await firstTurn(`ai19b-${o}`, pre(o))
      return new PlanCache(envOf(view(st, seat))).goals().leaves.filter((l) => l.kind === kind).reduce((n, l) => n + l.left, 0)
    }
    expect(await left('kill-them', 'outside')).toBe(15)
    expect(await left('stockpile', 'everyEntrance')).toBe(6)
    expect(await left('raiding-party', 'decks')).toBe(40)
    expect(await left('leave-it-all-behind', 'weapons')).toBe(4)
  })

  it('a betrayer keeps its own plan: no goal prices at all', async () => {
    const { st, seat } = await firstTurn('ai19c', pre('stockpile'))
    const c = new PlanCache(envOf(view(st, seat), true))
    expect(c.goals().on).toBe(false)
    expect(c.goals().leaves).toEqual([])
  })
})

describe('AI-020 barricade goals are priced against what the colony phase leaves standing', () => {
  it('Stockpile: a barricade on a bare entrance with room is worth progress, one on an entrance that already has a wall is not', async () => {
    const { st, seat } = await firstTurn('ai20', pre('stockpile'))
    const v = staged(view(st, seat), (o) => {
      for (let i = 1; i <= 6; i++) setEntrance(o, 'colony', i, 0, 0)
      setEntrance(o, 'colony', 5, 1, 0) // room, no wall
      setEntrance(o, 'colony', 6, 1, 1) // room, already walled
    })
    const g = new PlanCache(envOf(v)).goals()
    expect(g.barricade('colony', 5)).toBeGreaterThan(0)
    expect(g.barricade('colony', 6)).toBe(0)
  })

  it('Stockpile: a kill on a full bare entrance (it opens the space for the wall) beats a kill on an entrance with room', async () => {
    const { st, seat } = await firstTurn('ai20b', pre('stockpile'))
    const v = staged(view(st, seat), (o) => {
      for (let i = 1; i <= 6; i++) setEntrance(o, 'colony', i, 0, 0)
      setEntrance(o, 'colony', 5, 3, 0) // full, bare
      setEntrance(o, 'colony', 6, 1, 0) // room
    })
    const g = new PlanCache(envOf(v)).goals()
    expect(g.kill('colony', 5)).toBeGreaterThan(g.kill('colony', 6))
  })

  it('Home Sweet Home: a wall at an outside location that has none is worth progress; the same wall after one stands is not', async () => {
    const { st, seat } = await firstTurn('ai20c', pre('home-sweet-home'))
    const v = staged(view(st, seat), (o) => {
      setEntrance(o, 'loc.school', 1, 0, 0)
      setEntrance(o, 'loc.library', 1, 0, 1)
    })
    const g = new PlanCache(envOf(v)).goals()
    expect(g.barricade('loc.school', 1)).toBeGreaterThan(0)
    expect(g.barricade('loc.library', 1)).toBe(0)
  })
})

describe('AI-021 the supply is progress under a Stockpile goal', () => {
  it('a food card is played into the supply and supply food is not spent on dice', async () => {
    const { st, seat } = await firstTurn('ai21', pre('stockpile'))
    const base = view(st, seat)
    const need = Math.ceil((Object.values(base.survivors).filter((s) => s.status === 'alive' && s.location === 'colony').length + base.locations['colony']!.helpless) / 2)
    const withFood = (o: SeatView): void => {
      o.food = need + 2
      o.cards['test-food'] = { id: 'test-food', defId: 'it.food-1' }
      o.me.hand = ['test-food']
    }
    const asPlain = (o: SeatView): void => { withFood(o); o.objective = { ...o.objective, id: pre('find-a-cure') } }
    const die = base.seats[seat]!.dice.find((d) => !d.used)!
    const play: Action = { type: 'playCard', cardId: 'test-food', decisionId: base.pending.id, seat }
    const spend: Action = { type: 'spendFood', dieId: die.id, tokens: 1, decisionId: base.pending.id, seat }
    const goal = new PlanCache(envOf(staged(base, withFood)))
    const plain = new PlanCache(envOf(staged(base, asPlain)))
    expect(goal.goals().food()).toBeGreaterThan(0)
    expect(goal.goals().foodLeft()).toBeGreaterThan(0)
    expect(plain.goals().food()).toBe(0)
    expect(scoreTurnAction(goal, play)).toBeGreaterThan(0.2)
    expect(scoreTurnAction(goal, play)).toBeGreaterThan(scoreTurnAction(plain, play))
    expect(scoreTurnAction(plain, spend) - scoreTurnAction(goal, spend)).toBeCloseTo(goal.goals().food() * TUNE.goalFoodMult, 5)
  })
})

describe('AI-022 hunting outside under Kill Them', () => {
  it('an outside kill is worth more than under an objective that does not count zombies, and a hunter with nothing left to kill is pulled home', async () => {
    const { st, seat } = await firstTurn('ai22', pre('kill-them'))
    const base = view(st, seat)
    const mine = base.seats[seat]!.survivors[0]!
    const out = (id: string) => (o: SeatView): void => { o.survivors[mine]!.location = 'loc.hospital'; o.objective = { ...o.objective, id } }
    const die = base.seats[seat]!.dice.find((d) => !d.used)!
    const attack: Action = { type: 'attack', survivorId: mine, dieId: die.id, target: { kind: 'zombie', location: 'loc.hospital', entrance: 1 }, decisionId: base.pending.id, seat }
    const kt = new PlanCache(envOf(staged(base, out(pre('kill-them')))))
    const other = new PlanCache(envOf(staged(base, out(pre('find-a-cure')))))
    expect(scoreTurnAction(kt, attack)).toBeGreaterThan(scoreTurnAction(other, attack) + 0.3)
    // a cleared location is a post that only draws another zombie each round: leaving it is worth more than staying
    const cleared = new PlanCache(envOf(staged(base, (o) => { out(pre('kill-them'))(o); setEntrance(o, 'loc.hospital', 1, 0, 0) })))
    expect(cleared.goals().post(mine, 'loc.hospital')).toBeLessThan(0)
    expect(kt.goals().post(mine, 'loc.hospital')).toBeGreaterThan(cleared.goals().post(mine, 'loc.hospital'))
  })
})

describe('AI-023 Raiding Party concentrates searches on the decks nearest to empty', () => {
  it('only the two smallest decks carry a goal price, and a deck that is empty hands the target to the next one', async () => {
    const { st, seat } = await firstTurn('ai23', pre('raiding-party'))
    const deck = (o: SeatView, sizes: Record<string, number>): void => { for (const [l, n] of Object.entries(sizes)) o.locations[l]!.deckCount = n }
    const v = staged(view(st, seat), (o) => deck(o, { 'loc.grocery-store': 3, 'loc.library': 5, 'loc.hospital': 17, 'loc.school': 18, 'loc.police-station': 19, 'loc.gas-station': 20 }))
    const g = new PlanCache(envOf(v)).goals()
    expect(g.search('loc.grocery-store')).toBeGreaterThan(0)
    expect(g.search('loc.library')).toBeGreaterThan(0)
    expect(g.search('loc.hospital')).toBe(0)
    const c = new PlanCache(envOf(v))
    expect(c.searchValue('loc.library')).toBeGreaterThan(c.searchValue('loc.hospital') + g.search('loc.library') - 0.5)
    const one = staged(view(st, seat), (o) => deck(o, { 'loc.grocery-store': 0, 'loc.library': 5, 'loc.hospital': 17, 'loc.school': 18, 'loc.police-station': 19, 'loc.gas-station': 20 }))
    const g1 = new PlanCache(envOf(one)).goals()
    expect(g1.search('loc.library')).toBeGreaterThan(0)
    expect(g1.search('loc.hospital')).toBe(0)
  })
})

describe('AI-024 Leave It All Behind arms every seat', () => {
  it('a weapon is worth equipping while the seat is unarmed, and not once it carries one', async () => {
    const { st, seat } = await firstTurn('ai24', pre('leave-it-all-behind'))
    const base = view(st, seat)
    const mine = base.seats[seat]!.survivors.filter((s) => base.survivors[s]!.status === 'alive')
    const give = (o: SeatView): void => { o.cards['test-gun'] = { id: 'test-gun', defId: 'it.colt-1911-pistol' }; o.me.hand = ['test-gun'] }
    const equip: Action = { type: 'playCard', cardId: 'test-gun', equipTo: mine[0]!, decisionId: base.pending.id, seat }
    const bare = new PlanCache(envOf(staged(base, give)))
    const armed = new PlanCache(envOf(staged(base, (o) => { give(o); o.cards['test-gun2'] = { id: 'test-gun2', defId: 'it.switchblade' }; o.survivors[mine[1]!]!.equipped = ['test-gun2'] })))
    expect(bare.goals().arm()).toBeGreaterThan(0)
    expect(armed.goals().arm()).toBe(0)
    expect(scoreTurnAction(bare, equip)).toBeGreaterThan(scoreTurnAction(armed, equip) + 0.3)
    // an unarmed seat values weapon cards in a search; an armed one does not add the goal
    expect(bare.weights().weapon).toBeGreaterThan(armed.weights().weapon)
  })
})

describe('AI-025 games with the goal layer on stay clean and finish objectives the bots never completed', () => {
  it('every objective it prices plays whole games with no violation, no leak and fast decisions', async () => {
    for (const o of ['stockpile', 'home-sweet-home', 'kill-them', 'raiding-party', 'leave-it-all-behind']) {
      const g = await runGame(bundle, `ai25-${o}`, 0, { ...DEFAULT_OPTIONS, seats: 4, objective: pre(o), tier: 'normal' })
      expect(g.ended, `${o} ended`).toBe(true)
      expect(g.violations.map((x) => `${x.kind}: ${x.message}`)).toEqual([])
      expect(g.leaks).toEqual([])
      expect(Math.max(...g.decisionMs)).toBeLessThan(100)
    }
  })

  it('Home Sweet Home and Kill Them are completed by Normal bots (they never were without the layer)', async () => {
    let done = 0
    for (let i = 0; i < 30; i++) {
      for (const o of ['home-sweet-home', 'kill-them']) {
        const g = await runGame(bundle, `ai25b-${o}-${i}`, i, { ...DEFAULT_OPTIONS, seats: 4, objective: pre(o), tier: 'normal', validateSample: 0 })
        if (g.objectiveComplete) done++
      }
    }
    expect(done).toBeGreaterThan(0)
  })

  it('goalV 0 switches the layer off', async () => {
    const { st, seat } = await firstTurn('ai25c', pre('stockpile'))
    const v = view(st, seat)
    const env = envOf(v)
    useTune({ ...TIERS.normal.tune, goalV: 0 })
    expect(new PlanCache(env).goals().on).toBe(false)
    useTune(TIERS.normal.tune)
    expect(TUNE.goalV).toBeGreaterThan(0)
  })
})
