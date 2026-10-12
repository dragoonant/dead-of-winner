// AI-032..AI-037: the table reader (a posterior over "nobody / seat a / seat b ...") and the exile policy built on it.
import { describe, expect, it } from 'vitest'
import { createDecider, type AiDecider } from '../../src/ai/index'
import { PlanCache, scoreTurnAction, useTune, type PlanEnv } from '../../src/ai/normal/plan'
import { Reader } from '../../src/ai/normal/reader'
import { exileFloor } from '../../src/ai/normal/votes'
import { DEFAULT_SCALARS } from '../../src/ai/personas'
import { TIERS } from '../../src/ai/tiers'
import { createGame, legalActions, step, view, type Action, type GameEvent, type GameState } from '../../src/engine/index'
import type { SeatView } from '../../src/engine/view'
import { loadDefaultBundle } from '../../tools/default-bundle'

const bundle = loadDefaultBundle()
const SEATS = ['s1', 's2', 's3', 's4']

// ---- a stub view for the pure-ledger tests: only what the reader reads ----
const stubView = (me: string, hands: Record<string, number> = {}, exiled: string[] = []): SeatView => ({
  seat: me, seatOrder: SEATS, survivors: {}, roundNumber: 2, setup: { seats: SEATS.map((id) => ({ id })) }, locations: {},
  seats: Object.fromEntries(SEATS.map((s) => [s, { seat: { exiled: exiled.includes(s), eliminated: false }, handCount: hands[s] ?? 2 }])),
}) as never
const round = { type: 'RoundStarted' } as unknown as GameEvent
const put = (seat: string, n = 1): GameEvent[] => Array.from({ length: n }, () => ({ type: 'CardContributed', seat, cardId: '', from: 'hand' }) as GameEvent)
const reveal = (...points: (1 | -1)[]): GameEvent[] => points.map((p, i) => ({ type: 'CrisisCardRevealed', cardId: `c${i}`, defId: 'it.x', points: p, runningTotal: 0 }) as GameEvent)
const resolved = (cards: number, total: number): GameEvent => ({ type: 'CrisisResolved', cardId: 'cr.x', total, needed: 4, prevented: total >= 4, bonus: false, cards })
const request = (from: string, symbol: string): GameEvent => ({ type: 'RequestMade', from, to: 's3', symbol }) as unknown as GameEvent
const reader = (me = 's1', over: Partial<ConstructorParameters<typeof Reader>[0]> = {}): Reader => new Reader({ me, paranoia: 1, trust: 0.6, ...over }, `r-${Math.random()}`)

describe('AI-032 off-symbol cards in the pile', () => {
  it('a seat that put two cards into a pile holding two off-symbol cards is the top suspect, far ahead of the seat with one card in', () => {
    const r = reader()
    const v = stubView('s1')
    // s2 put two in, s3 one, s4 none: two cards of the revealed pile were wrong, so only s2 can have supplied both without luck
    r.observe([round, ...put('s2', 2), ...put('s3'), ...reveal(-1, -1, 1), resolved(3, -1)], v)
    expect(r.top()?.seat).toBe('s2')
    expect(r.score('s2')).toBeGreaterThan(0.85)
    expect(r.score('s3')).toBeLessThan(0.15)
    expect(r.score('s4')).toBeLessThan(0.05)
  })

  it('one wrong card spread over three contributors points at all three about equally and clears the seat that sat out; the wrong card of the reader itself is nobody\'s fault', () => {
    const r = reader()
    const v = stubView('s1')
    r.observe([round, ...put('s2'), ...put('s3'), ...put('s4'), ...reveal(-1, 1, 1), resolved(3, 1)], v)
    const [a, b, c] = ['s2', 's3', 's4'].map((s) => r.score(s)) as [number, number, number]
    expect(Math.abs(a - b)).toBeLessThan(0.01)
    expect(Math.abs(b - c)).toBeLessThan(0.01)
    expect(a).toBeGreaterThan(0.25)
    expect(a).toBeLessThan(0.4)
    const own = reader()
    own.noteOwnWrong(1)
    own.observe([round, ...put('s1'), ...put('s2'), ...reveal(-1, 1), resolved(2, 0)], v)
    expect(own.score('s2')).toBeLessThan(0.12)
  })

  it('the same seat in two wrong piles while the others come and go becomes the clear suspect (the intersection of the pools)', () => {
    const r = reader()
    const v = stubView('s1')
    r.observe([round, ...put('s2'), ...put('s3'), ...reveal(-1, 1), resolved(2, 0)], v)
    r.observe([round, ...put('s2'), ...put('s4'), ...reveal(1, -1), resolved(2, 0)], v)
    r.observe([round, ...put('s2'), ...put('s3'), ...put('s4'), ...reveal(-1, 1, 1), resolved(3, 1)], v)
    expect(r.top()?.seat).toBe('s2')
    expect(r.score('s2')).toBeGreaterThan(0.75)
    expect(r.score('s3')).toBeLessThan(0.3)
  })
})

describe('AI-033 the prior leaves room for nobody', () => {
  it('starts at one betrayal card in 2n+1 per seat, keeps "nobody" the likeliest single answer, and clean rounds do not lift anyone', () => {
    const r = reader()
    const v = stubView('s1')
    r.syncView(v)
    expect(r.score('s2')).toBeCloseTo(1 / 8, 2) // this seat is known loyal: 1/9 each among the other three, nobody 5/9, renormalised
    expect(r.none()).toBeGreaterThan(0.6)
    for (let i = 0; i < 4; i++) r.observe([round, ...put('s2'), ...put('s3'), ...put('s4'), ...reveal(1, 1, 1), resolved(3, 3)], v)
    for (const s of ['s2', 's3', 's4']) expect(r.score(s)).toBeLessThan(0.14)
    expect(r.none()).toBeGreaterThan(0.6)
  })
})

describe('AI-034 behaviour tells', () => {
  it('asking for a weapon twice while the hand sits above the table outranks a quiet seat; medicine is not a tell', () => {
    const r = reader()
    const hands = { s1: 2, s2: 6, s3: 2, s4: 2 }
    for (let i = 0; i < 2; i++) r.observe([round, request('s2', 'weapon'), request('s2', 'fuel'), request('s3', 'medicine'), ...put('s3'), ...put('s4'), resolved(2, 2)], stubView('s1', hands))
    expect(r.top()?.seat).toBe('s2')
    expect(r.score('s2')).toBeGreaterThan(0.5)
    expect(r.score('s3')).toBeLessThan(0.1)
    expect(r.rowsBySeat['s3']?.['request.odd'] ?? 0).toBe(0)
    expect(r.rowsBySeat['s2']?.['request.odd']).toBeGreaterThan(0)
  })

  it('paranoia sharpens a bad record, and one round of tells moves a seat by no more than the round clamp', () => {
    const calm = reader('s1', { paranoia: 0.6 })
    const sharp = reader('s1', { paranoia: 1.5 })
    const ev = [round, request('s2', 'weapon'), resolved(0, 0)]
    const hands = { s2: 4 }
    calm.observe(ev, stubView('s1', hands)); sharp.observe(ev, stubView('s1', hands))
    expect(sharp.score('s2')).toBeGreaterThan(calm.score('s2'))
    const k = Object.values(sharp.rowsBySeat['s2'] ?? {}).reduce((a, x) => a + x, 0)
    expect(k).toBeLessThanOrEqual(2 + 1e-9)
  })
})

// ---- the exile policy, on real engine views ----
async function firstTurn(seed: string): Promise<{ st: GameState; seat: string; ds: Record<string, AiDecider> }> {
  let st = createGame({ seats: SEATS.map((id) => ({ id, kind: 'bot' as const })), mainObjective: 'obj.main.we-need-more-samples' }, seed, bundle).state
  const ds: Record<string, AiDecider> = {}
  for (const s of st.seatOrder) ds[s] = createDecider('normal', undefined, seed)
  for (let k = 0; k < 400; k++) {
    if (st.pending.kind === 'turnAction' && st.pending.seat !== 'all') return { st, seat: st.pending.seat as string, ds }
    const seat = st.pending.seat as string
    const a = await ds[seat]!.decide(view(st, seat), st.pending, legalActions(st))
    const r = step(st, a)
    if (r.rejection) throw new Error(`rejected ${a.type}`)
    for (const s of r.state.seatOrder) ds[s]!.observe([], view(r.state, s))
    st = r.state
  }
  throw new Error('no turn action reached')
}
function envOf(v: SeatView, ledger: Reader): PlanEnv {
  useTune(TIERS.normal.tune)
  return {
    v, me: v.seat, scalars: { ...DEFAULT_SCALARS, callThreshold: 0.75 }, ledger, betrayer: false,
    selfScore: () => 0, mem: { requestTurn: -1, voteRound: -1, calledAt: -1, objRound: -1, fuelWho: null }, rand: () => 0.5, expired: () => false,
    tier: TIERS.normal, cover: () => Infinity,
  }
}
/** Round 2, morale high, the seat's turn: the only thing left to decide is whether to call. */
const staged = (v: SeatView): SeatView => { const o = structuredClone(v) as SeatView; o.roundNumber = 2; o.morale = Math.max(o.morale, 6); return o }
const callOn = (v: SeatView, target: string): Action => ({ type: 'callVote', target, decisionId: v.pending.id, seat: v.seat }) as Action

describe('AI-035 calling a vote', () => {
  it('a loyal bot calls a vote on a seat the pile keeps pointing at, and does not when the record is flat', async () => {
    const { st, seat } = await firstTurn('ai35')
    const v = staged(view(st, seat))
    const others = v.seatOrder.filter((s) => s !== seat)
    const culprit = others[0]!
    const flat = new Reader({ me: seat, paranoia: 1, trust: 0.6 }, 'ai35-flat')
    flat.syncView(v)
    expect(scoreTurnAction(new PlanCache(envOf(v, flat)), callOn(v, culprit))).toBeLessThan(0)
    const hot = new Reader({ me: seat, paranoia: 1, trust: 0.6 }, 'ai35-hot')
    // the culprit is in every pile that held off-symbol cards, together with different company each time, and asks for guns and fuel
    const others2 = others.slice(1)
    hot.observe([round, ...put(culprit, 2), ...put(others2[0]!), ...reveal(-1, -1, 1), resolved(3, -1)], v)
    hot.observe([round, ...put(culprit), ...put(others2[1]!), ...reveal(1, -1), resolved(2, 0)], v)
    hot.observe([round, request(culprit, 'weapon'), request(culprit, 'fuel'), ...put(culprit), ...put(others2[0]!), ...put(others2[1]!), ...reveal(-1, 1, 1), resolved(3, 1)], v)
    expect(hot.top()?.seat).toBe(culprit)
    expect(hot.score(culprit)).toBeGreaterThan(0.85)
    expect(scoreTurnAction(new PlanCache(envOf(v, hot)), callOn(v, culprit))).toBeGreaterThan(0)
    // never against anyone but the top suspect
    expect(scoreTurnAction(new PlanCache(envOf(v, hot)), callOn(v, others2[0]!))).toBeLessThan(0)
  })

  it('a bot that suspects a seat only a little (below the floor no persona may undercut) does not call, however trigger-happy the persona', async () => {
    const { st, seat } = await firstTurn('ai35b')
    const v = staged(view(st, seat))
    const [culprit, b, c] = v.seatOrder.filter((s) => s !== seat) as [string, string, string]
    const mild = new Reader({ me: seat, paranoia: 1, trust: 0.6 }, 'ai35b')
    mild.observe([round, ...put(culprit), ...put(b), ...put(c), ...reveal(-1, 1, 1), resolved(3, 1)], v)
    expect(mild.score(culprit)).toBeLessThan(0.45)
    const env = { ...envOf(v, mild), scalars: { ...DEFAULT_SCALARS, callThreshold: 0.2 } }
    expect(scoreTurnAction(new PlanCache(env), callOn(v, culprit))).toBeLessThan(0)
  })
})

describe('AI-036 casting votes', () => {
  it('nobody votes to exile itself; a bot votes yes on a seat its own record points at and no on a flat one', async () => {
    const { st, seat, ds } = await firstTurn('ai36')
    const caller = seat
    const target = st.seatOrder.find((s) => s !== caller)!
    const call = legalActions(st).find((a) => a.type === 'callVote' && a.target === target)
    expect(call).toBeTruthy()
    const raised = step(st, call!)
    expect(raised.state.pending.kind).toBe('votes')
    const pending = raised.state.pending
    const legal = legalActions(raised.state)
    const ballot = async (s: string): Promise<boolean> => {
      const pick = await ds[s]!.decide(view(raised.state, s), pending, legal)
      return pick.type === 'castVotes' && pick.votes[s] === true
    }
    // flat record: everyone says no, the target above all (it never votes to exile itself)
    for (const s of st.seatOrder) expect(await ballot(s)).toBe(false)
    // a record that points at the target: the others say yes, the target still says no
    const others = st.seatOrder.filter((s) => s !== target && s !== caller)
    const feed: GameEvent[] = [
      round, ...put(target, 2), ...put(others[0]!), ...reveal(-1, -1, 1), resolved(3, -1),
      round, ...put(target), ...put(others[1]!), ...reveal(1, -1), resolved(2, 0),
      round, request(target, 'weapon'), request(target, 'fuel'), ...put(target), ...put(others[0]!), ...put(others[1]!), ...reveal(-1, 1, 1), resolved(3, 1),
    ]
    for (const s of st.seatOrder) ds[s]!.observe(feed, { ...view(raised.state, s), roundNumber: 3, morale: 8 } as SeatView)
    // the decider reads morale and dice from the view it is handed, so ask with the staged view
    const hot = async (s: string): Promise<boolean> => {
      const vv = { ...view(raised.state, s), roundNumber: 3, morale: 8 } as SeatView
      const pick = await ds[s]!.decide(vv, pending, legal)
      return pick.type === 'castVotes' && pick.votes[s] === true
    }
    expect(await hot(target)).toBe(false)
    const yes = (await Promise.all(others.concat(caller).filter((s, i, a) => a.indexOf(s) === i).map(hot))).filter(Boolean).length
    expect(yes).toBeGreaterThanOrEqual(2)
  })
})

describe('AI-037 pricing a wrong exile', () => {
  const fake = (exiled: string[], scores: Record<string, number>): { v: SeatView; ledger: Reader } => {
    const ledger = new Reader({ me: 's1', paranoia: 1, trust: 0.6 }, 'ai37')
    ;(ledger as unknown as { score: (s: string) => number }).score = (s: string) => scores[s] ?? 0
    return { v: stubView('s1', {}, exiled), ledger }
  }
  it('before any exile the floor is the base; after one it rises with the chance the exiled seat was not the betrayer', () => {
    const none = fake([], {})
    expect(exileFloor(none.v, none.ledger)).toBeCloseTo(0.6, 5)
    const sure = fake(['s2'], { s2: 0.95 })
    expect(exileFloor(sure.v, sure.ledger)).toBeCloseTo(0.6 + 0.35 * 0.05, 5)
    const doubt = fake(['s2'], { s2: 0.4 })
    expect(exileFloor(doubt.v, doubt.ledger)).toBeGreaterThan(0.8)
    const wrong = fake(['s2'], { s2: 0.02 })
    expect(exileFloor(wrong.v, wrong.ledger)).toBeLessThanOrEqual(0.97)
    expect(exileFloor(wrong.v, wrong.ledger)).toBeGreaterThan(0.9)
  })

  it('an exiled seat keeps its share of the probability: the others do not inherit it', () => {
    const r = reader()
    r.observe([round, ...put('s2', 2), ...put('s3'), ...reveal(-1, -1, 1), resolved(3, -1)], stubView('s1'))
    const before = r.score('s3')
    r.syncView(stubView('s1', {}, ['s2']))
    expect(r.top()?.seat).not.toBe('s2')
    expect(r.score('s2')).toBeGreaterThan(0.85)
    expect(r.score('s3')).toBeCloseTo(before, 5)
  })
})
