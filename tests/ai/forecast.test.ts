// AI-026..AI-031: the colony-phase forecast and the choices it prices: a bite spreads to the crowd at the roller's location, a waste step is worth
// cleaning only when it will bite, a headcount change moves the food bill, one survivor per seat leaves the colony, and a few objectives
// play on their own constants.
import { describe, expect, it } from 'vitest'
import { createDecider, type AiDecider } from '../../src/ai/index'
import { colonyForecast, starvationShift, wasteSaved } from '../../src/ai/normal/forecast'
import { OBJECTIVE_TUNE, PlanCache, TUNE, scoreTurnAction, useTune, type PlanEnv } from '../../src/ai/normal/plan'
import { Ledger } from '../../src/ai/normal/suspicion'
import { DEFAULT_SCALARS } from '../../src/ai/personas'
import { TIERS } from '../../src/ai/tiers'
import { createGame, legalActions, step, view, type Action, type GameState, type SurvivorId } from '../../src/engine/index'
import type { SeatView } from '../../src/engine/view'
import { DEFAULT_OPTIONS, runGame } from '../../tools/sim-core'
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

function envOf(v: SeatView, objective?: string): PlanEnv {
  useTune(TIERS.normal.tune, objective)
  return {
    v, me: v.seat, scalars: DEFAULT_SCALARS, ledger: new Ledger({ me: v.seat, paranoia: 1, trust: 0.6, selfCandidate: false }, `t-${v.seat}`), betrayer: false,
    selfScore: () => 0, mem: { requestTurn: -1, voteRound: -1, calledAt: -1, objRound: -1, fuelWho: null }, rand: () => 0.5, expired: () => false,
    tier: TIERS.normal, cover: () => Infinity,
  }
}

const clone = (v: SeatView): SeatView => structuredClone(v) as SeatView
const aliveAt = (v: SeatView, loc: string): SurvivorId[] => Object.values(v.survivors).filter((s) => s.status === 'alive' && s.location === loc).map((s) => s.id)
/** The viewer's own survivors, alive. */
const mine = (v: SeatView): SurvivorId[] => (v.seats[v.seat]!.survivors).filter((id) => v.survivors[id]?.status === 'alive')

describe('AI-026 a bite spreads to the crowd at the roller\'s location', () => {
  it('the same roll costs more where many survivors stand than where the roller is alone', async () => {
    const { st, seat } = await firstTurn('ai26', 'obj.main.find-a-cure')
    const v = clone(view(st, seat))
    const id = mine(v)[0]!
    const c = new PlanCache(envOf(v))
    // everyone starts at the colony: eight survivors, seven behind the roller
    expect(aliveAt(v, 'colony').length).toBeGreaterThanOrEqual(6)
    expect(c.chainDeaths(id)).toBeGreaterThan(0.95)
    expect(c.chainDeaths(id, 'loc.library')).toBe(0)
    const crowded = c.exposureCost(id, 'move', 'colony')
    const alone = c.exposureCost(id, 'move', 'loc.library')
    expect(crowded).toBeGreaterThan(alone)
    // a lone neighbour behind it halves the spread: one link at one in two
    const w = clone(v)
    w.survivors[aliveAt(v, 'colony').find((s) => s !== id)!]!.location = 'loc.library'
    expect(new PlanCache(envOf(w)).chainDeaths(id, 'loc.library')).toBeCloseTo(0.5, 6)
  })
})

describe('AI-027 cleaning the waste pile is worth it when the step would bite', () => {
  it('a pile at ten is worth about a morale point to clean, a pile at four almost nothing', async () => {
    const { st, seat } = await firstTurn('ai27', 'obj.main.find-a-cure')
    const base = clone(view(st, seat))
    const lastSeat = base.seatOrder[(base.seatOrder.indexOf(base.firstSeat) + base.seatOrder.length - 1) % base.seatOrder.length]!
    const asLast = clone(base)
    asLast.seat = lastSeat
    asLast.waste = Array.from({ length: 10 }, (_, i) => `w${i}`)
    const cTen = new PlanCache(envOf(asLast))
    expect(wasteSaved(cTen, 3)).toBeGreaterThanOrEqual(1)
    const four = clone(asLast)
    four.waste = four.waste.slice(0, 4)
    expect(wasteSaved(new PlanCache(envOf(four)), 3)).toBeLessThan(0.5)
    // seven cards with three seats still to act: their plays are expected to carry the pile over ten
    const early = clone(base)
    early.seat = base.firstSeat
    early.waste = Array.from({ length: 8 }, (_, i) => `w${i}`)
    expect(wasteSaved(new PlanCache(envOf(early)), 3)).toBeGreaterThanOrEqual(1)
  })
})

describe('AI-028 the headcount at the colony moves the food bill', () => {
  it('leaving closes a one-food gap when the headcount is odd; coming home opens one when the supply is exactly the bill', async () => {
    const { st, seat } = await firstTurn('ai28', 'obj.main.find-a-cure')
    const v = clone(view(st, seat))
    const atColony = aliveAt(v, 'colony')
    // keep five at the colony, send the rest away
    for (const id of atColony.slice(5)) v.survivors[id]!.location = 'loc.library'
    v.locations['colony']!.helpless = 0
    v.starvation = 0
    v.food = 2 // five mouths need three
    const c = new PlanCache(envOf(v))
    expect(c.food().needed).toBe(3)
    expect(c.food().shortfall).toBe(1)
    expect(starvationShift(c, -1)).toBe(1) // four mouths need two: the starvation token and its morale are spared
    expect(starvationShift(c, -2)).toBe(1)
    const fed = clone(v)
    fed.food = 3
    const cf = new PlanCache(envOf(fed))
    expect(cf.food().shortfall).toBe(0)
    expect(starvationShift(cf, 1)).toBe(0) // six mouths still need three
    expect(starvationShift(cf, 2)).toBeLessThan(0) // seven need four
  })
})

describe('AI-029 one survivor per seat leaves the colony', () => {
  it('a seat with a survivor already out does not send the second, but a seat with none does', async () => {
    const { st, seat } = await firstTurn('ai29', 'obj.main.find-a-cure')
    const v = clone(view(st, seat))
    const [a, b] = mine(v)
    expect(a && b).toBeTruthy()
    const move = (sid: SurvivorId, s: SeatView): Action => ({ type: 'move', survivorId: sid, to: 'loc.hospital', decisionId: s.pending.id, seat: s.seat })
    const none = new PlanCache(envOf(v))
    expect(TUNE.maxOut).toBe(1)
    expect(scoreTurnAction(none, move(a!, v))).toBeGreaterThan(-1)
    const out = clone(v)
    out.survivors[a!]!.location = 'loc.library'
    const one = new PlanCache(envOf(out))
    expect(scoreTurnAction(one, move(b!, out))).toBe(-1)
  })

  it('in whole games no seat sends a second survivor out of the colony', async () => {
    let worst = 0
    for (let g = 0; g < 3; g++) {
      const done = await runGame(bundle, `ai29-${g}`, g, {
        ...DEFAULT_OPTIONS, seats: 4, objective: 'obj.main.find-a-cure', tier: 'normal',
        onEvents: (events, state) => {
          // right after a survivor leaves the colony, its seat has at most that one outside
          for (const e of events) {
            if (e.type !== 'SurvivorMoved' || e.from !== 'colony' || e.to === 'colony') continue
            const owner = state.survivors[e.survivorId]!.owner
            if (!owner) continue
            const out = state.seats[owner]!.survivors.filter((id) => state.survivors[id]!.status === 'alive' && state.survivors[id]!.location !== 'colony').length
            worst = Math.max(worst, out)
          }
        },
      })
      expect(done.violations).toEqual([])
    }
    expect(worst).toBeLessThanOrEqual(1)
  })
})

describe('AI-030 objectives that need cards or a wall play on their own constants', () => {
  it('Find a Cure prices its goal higher, Samples searches harder, and everything else keeps the defaults; the bench override still wins', () => {
    useTune({}, 'obj.main.find-a-cure')
    expect(TUNE.goalV).toBe(OBJECTIVE_TUNE['obj.main.find-a-cure']!['goalV'])
    expect(TUNE.goalV).toBeGreaterThan(12)
    useTune({}, 'obj.main.we-need-more-samples')
    expect(TUNE.searchScale).toBeGreaterThan(1)
    expect(TUNE.goalV).toBe(12)
    useTune({}, 'obj.main.too-many-mouths')
    expect(TUNE.goalV).toBe(12)
    expect(TUNE.searchScale).toBe(1)
    useTune({})
    expect(TUNE.goalV).toBe(12)
    process.env['AI_TUNE'] = '{"goalV":3}'
    try {
      useTune({}, 'obj.main.find-a-cure')
      expect(TUNE.goalV).toBe(3)
    } finally {
      delete process.env['AI_TUNE']
      useTune({})
    }
  })
})

describe('AI-031 the colony-phase forecast adds up its four pieces', () => {
  it('overrun, waste, starvation and crisis sum to the total, each one read from the public view', async () => {
    const { st, seat } = await firstTurn('ai31', 'obj.main.stockpile') // 18 zombies fill the colony: the colony step overruns
    const v = clone(view(st, seat))
    v.food = 0
    v.waste = Array.from({ length: 12 }, (_, i) => `w${i}`)
    const f = colonyForecast(new PlanCache(envOf(v, 'obj.main.stockpile')))
    expect(f.overrun).toBeGreaterThan(0)
    expect(f.wasteLoss).toBeGreaterThanOrEqual(1)
    expect(f.starvation).toBeGreaterThan(0)
    expect(f.total).toBeCloseTo(f.overrun + f.wasteLoss + f.starvation + f.crisis, 9)
    const calm = clone(v)
    calm.food = 40
    calm.waste = []
    const g = colonyForecast(new PlanCache(envOf(calm, 'obj.main.stockpile')))
    expect(g.starvation).toBe(0)
    expect(g.wasteLoss).toBe(0)
    expect(g.total).toBeLessThan(f.total)
  })
})
