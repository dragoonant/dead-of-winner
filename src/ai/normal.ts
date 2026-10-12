// The AI colonist (40 §2): one heuristic Decider for every decision kind, run at three tiers (easy, normal, hard; src/ai/tiers.ts).
// It receives only view(state, seat), the pending decision and the legal list, keeps its own suspicion ledger from the (redacted) events it is
// shown, never rolls dice and never touches GameState or the game rng (its randomness is deriveSeed(seed, seat, decision id)). It always returns an
// action the engine accepts: a member of `legal`, or a multi-card crisis contribution built from legal single-card ones.
import { deriveSeed, nextFloat, query } from '../engine/index'
import type { Action, Decider, GameEvent, PendingDecision, SeatId } from '../engine/index'
import type { SeatView } from '../engine/view'
import { crossroadsValue, effectVoteEdge, labelScore, optionOf } from './normal/options'
import { betrayerPush, foodOf, isBetrayer, mainObjectiveNeeds, matchesCrisis, recOf, reservedCards, statsOf, symbolsOfCard, woundsOn } from './normal/info'
import { PlanCache, TUNE, envTune, planTurn, useTune, type PlanEnv, type PlanMemory } from './normal/plan'
import { Ledger, gameKeyOf, postClaim, registerLedger } from './normal/suspicion'
import { afford, thresholdOf } from './normal/votes'
import { DEFAULT_SCALARS, blendScalars, getPersona, type Persona, type PersonaScalars } from './personas'
import { TIERS, type PlannerTier, type TierParams } from './tiers'

export interface DeciderStats { decisions: number; totalMs: number; maxMs: number; degraded: number; lastError?: string }
export interface AiDecider extends Decider {
  /** Feed the events (already redacted for this seat) since the last call, plus the seat's current view. */
  observe(events: readonly GameEvent[], view: SeatView): void
  readonly persona: Persona | undefined
  readonly stats: DeciderStats
  /** The suspicion row S(s) for every other seat (40 §14 trace, for the `?test=1` overlay and the bench); empty for the random bot. */
  suspicion?(): Record<SeatId, number>
  /** Why: the evidence rows behind each seat's suspicion (diagnostics). */
  evidence?(): Record<SeatId, Record<string, number>>
}

const g = globalThis as { AI_TIME_BUDGET_MS?: number; process?: { env?: Record<string, string | undefined> } }
export function budgetMs(): number {
  const fromEnv = Number(g.process?.env?.['AI_TIME_BUDGET_MS'])
  const n = Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : g.AI_TIME_BUDGET_MS
  return typeof n === 'number' && n > 0 ? n : 100
}
const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now())

function makeRand(seed: string, seat: string, id: string, tier: string): () => number {
  let st = deriveSeed(seed, seat, id, tier)
  return () => { const [f, next] = nextFloat(st); st = next; return f }
}

const logit = (p: number): number => Math.log(p / (1 - p))

export function createNormalDecider(seed: string, personaId?: string): AiDecider { return createTierDecider('normal', seed, personaId) }

export function createTierDecider(tier: PlannerTier, seed: string, personaId?: string): AiDecider {
  const ov = envTune() // bench experiments only: hHand, hHorizon, hTau switch Hard's features one at a time
  const base: TierParams = TIERS[tier]
  const params: TierParams = { ...base, ...(ov['hHand'] !== undefined ? { handTracking: ov['hHand'] > 0 } : {}), ...(ov['hHorizon'] !== undefined ? { horizon: ov['hHorizon'] } : {}), ...(ov['hTau'] !== undefined ? { crisisTau: ov['hTau'] } : {}), ...(ov['hFin'] !== undefined ? { finishing: ov['hFin'] > 0 } : {}) }
  const persona = getPersona(personaId)
  const scalars: PersonaScalars = blendScalars(persona?.scalars ?? DEFAULT_SCALARS, params.personaStrength)
  const gameKey = gameKeyOf(seed)
  const mem: PlanMemory = { requestTurn: -1, voteRound: -1, calledAt: -1, objRound: -1, fuelWho: null }
  let ledger: Ledger | null = null
  let selfLedger: Ledger | null = null // the betrayer's view of how the table sees it
  const stats: DeciderStats = { decisions: 0, totalMs: 0, maxMs: 0, degraded: 0 }
  let lastSeat = ''

  const ledgerFor = (v: SeatView): Ledger => {
    const betrayer = isBetrayer(v)
    if (!ledger) {
      ledger = new Ledger({ me: v.seat, paranoia: scalars.paranoia, trust: scalars.trust, selfCandidate: false, attacksOnly: params.ledger === 'attacks' }, gameKey)
      registerLedger(gameKey, v.seat, ledger)
    }
    if (betrayer && !selfLedger) {
      // the table as the betrayer must imagine it: the most paranoid persona at the table reading the public record
      const others = v.seatOrder.filter((s) => s !== v.seat)
      const para = Math.max(1, ...others.map((s) => getPersona(v.setup.seats.find((x) => x.id === s)?.persona)?.scalars.paranoia ?? 1))
      selfLedger = new Ledger({ me: v.seat, paranoia: para, trust: 0.6, selfCandidate: true }, gameKey)
    }
    return ledger
  }
  /** Log-odds of cover a betrayer has left: how far the lowest vote threshold at the table is above what the record already says about it. */
  const coverLeft = (v: SeatView): number => {
    if (!selfLedger) return Infinity
    let th = 0.95
    for (const s of v.seatOrder) if (s !== v.seat && !v.seats[s]!.seat.exiled) th = Math.min(th, thresholdOf(v, s))
    return logit(th) - selfLedger.logit(v.seat)
  }

  return {
    persona,
    stats,
    suspicion() {
      const out: Record<SeatId, number> = {}
      if (ledger) for (const s of ledger.seatsKnown()) if (s !== lastSeat) out[s] = ledger.score(s)
      return out
    },
    evidence() { return ledger ? ledger.rowsBySeat : {} },
    observe(events, v) {
      lastSeat = v.seat
      const l = ledgerFor(v)
      l.observe(events, v)
      selfLedger?.observe(events, v)
    },
    async decide(v: SeatView, pending: PendingDecision, legal: Action[]): Promise<Action> {
      const t0 = now()
      const deadline = t0 + budgetMs()
      useTune(params.tune)
      const l = ledgerFor(v)
      l.syncView(v)
      selfLedger?.syncView(v)
      const rand = makeRand(seed, v.seat, pending.id, tier)
      const betrayer = isBetrayer(v)
      const env: PlanEnv = {
        v, me: v.seat, scalars, ledger: l, betrayer, selfScore: () => (selfLedger ? selfLedger.score(v.seat) : 0), mem, rand, expired: () => now() > deadline,
        tier: params, cover: () => (betrayer ? coverLeft(v) : Infinity),
      }
      let pick: Action | undefined
      try { pick = decideKind(env, pending, legal, selfLedger, mem, gameKey) } catch (e) { pick = undefined; stats.degraded++; stats.lastError = e instanceof Error ? (e.stack ?? e.message) : String(e) }
      const out = pick && (legal.length === 0 || isAcceptable(pick, legal)) ? pick : legal[0]!
      const ms = now() - t0
      stats.decisions++; stats.totalMs += ms; if (ms > stats.maxMs) stats.maxMs = ms
      if (ms > budgetMs()) stats.degraded++
      return out
    },
  }
}

/** A pick is acceptable when it is in `legal`, or is a multi-card crisis contribution (every card named by a legal single). */
function isAcceptable(a: Action, legal: Action[]): boolean {
  if (a.type === 'contributeCrisis' && a.cardIds.length > 1) {
    const singles = new Set(legal.filter((x): x is Extract<Action, { type: 'contributeCrisis' }> => x.type === 'contributeCrisis' && x.cardIds.length === 1).map((x) => x.cardIds[0]))
    return a.cardIds.every((c) => singles.has(c))
  }
  if (a.type === 'castVotes') return legal.some((x) => x.type === 'castVotes' && x.decisionId === a.decisionId)
  return legal.includes(a)
}

function decideKind(env: PlanEnv, pending: PendingDecision, legal: Action[], selfLedger: Ledger | null, mem: PlanMemory, gameKey: string): Action {
  const { v } = env
  switch (pending.kind) {
    case 'turnAction': {
      const cache = new PlanCache(env)
      const pick = planTurn(cache, legal)
      mem.fuelWho = pick.type === 'playCard' ? cache.fuelWho : null
      if (pick.type === 'request') mem.requestTurn = v.turnCount
      if (pick.type === 'callVote') mem.voteRound = v.roundNumber
      if (pick.type === 'contributeObjective') mem.objRound = v.roundNumber
      return pick
    }
    case 'chooseSurvivors': return chooseSurvivors(env, legal)
    case 'chooseLeader': case 'newLeader': return chooseLeader(env, legal)
    case 'crisisContribution': return contribute(env, legal, selfLedger, gameKey)
    case 'searchKeepOrNoise': case 'searchKeepWhich': return searchKeep(env, pending, legal)
    case 'requestResponse': return respondRequest(env, pending, legal, selfLedger)
    case 'votes': return castVote(env, pending, legal, selfLedger)
    case 'crossroadsOption': return crossroads(env, pending, legal, selfLedger)
    case 'biteSpreadOption': return biteSpread(env, pending, legal)
    case 'exilePlacement': return exilePlacement(env, legal)
    case 'itemTarget': return itemTarget(env, pending, legal, mem)
    case 'effectChoice': case 'objectiveChoice': return genericChoice(env, pending, legal)
    case 'gameOver': return legal.find((a) => a.type === 'ack') ?? legal[0]!
    default: return legal[0]!
  }
}

// ---------- setup ----------
function chooseSurvivors(env: PlanEnv, legal: Action[]): Action {
  const { v, scalars } = env
  const n = (r: Record<string, unknown> | undefined, k: string): boolean => JSON.stringify(r ?? {}).includes(k)
  const val = (id: string): number => {
    const s = statsOf(v, id)
    const abRec = recOf(v, id)?.['ability'] as Record<string, unknown> | undefined
    let kills = 0
    for (const n of (abRec?.['effect'] as Record<string, unknown>[] | undefined) ?? []) if (n['op'] === 'killZombies') kills += typeof n['count'] === 'number' ? n['count'] : 1
    const killing = kills > 0 && n(abRec, 'exposureOnce') ? 0.5 : kills > 0 && JSON.stringify(abRec).includes('noExposure') ? kills : 0
    const ab = (abRec ? 0.3 : 0) + killing * (v.objective.id === 'obj.main.we-need-more-samples' ? TUNE.pickKill : 0.15)
    return s.influence / TUNE.pickInf + (6 - s.attack) * (TUNE.pickAtk + 0.2 * scalars.risk) + (6 - s.search) * TUNE.pickSea + ab
  }
  let best = legal[0]!
  let bs = -Infinity
  for (const a of legal) {
    if (a.type !== 'chooseSurvivors') continue
    const s = a.keep.reduce((n, id) => n + val(id), 0) + 0.001 * env.rand()
    if (s > bs) { bs = s; best = a }
  }
  return best
}
function chooseLeader(env: PlanEnv, legal: Action[]): Action {
  let best = legal[0]!
  let bs = -Infinity
  for (const a of legal) {
    if (a.type !== 'chooseLeader') continue
    const st = statsOf(env.v, a.survivorId)
    // the Kid (risk 0.85+) leads with the best fighter (the lowest attack number); everyone else with the most influence (the first-player token, R p7)
    const s = (env.scalars.risk >= 0.85 ? (7 - st.attack) * 20 + st.influence / 10 : st.influence) + env.rand()
    if (s > bs) { bs = s; best = a }
  }
  return best
}

// ---------- crisis ----------
/** The cards the seat could contribute that carry the crisis' prevent symbol, least valuable first. */
function matchingCards(env: PlanEnv, legal: Action[]): { matching: string[]; other: string[] } {
  const { v } = env
  const cache = new PlanCache(env)
  const w = cache.weights()
  const keepValue = (c: string): number => Math.max(0, ...symbolsOfCard(v, c).map((s) => w[s])) + (foodOf(v, c) > 0 && cache.food().shortfall > 0 ? 1 : 0)
  const singles = legal.filter((a): a is Extract<Action, { type: 'contributeCrisis' }> => a.type === 'contributeCrisis' && a.cardIds.length === 1).map((a) => a.cardIds[0]!)
  const sorted = [...singles].sort((a, b) => keepValue(a) - keepValue(b))
  return { matching: sorted.filter((c) => matchesCrisis(v, c)), other: sorted.filter((c) => !matchesCrisis(v, c)) }
}

/** Share of each item symbol among the cards in circulation (the starter deck and every location deck), from the public bundle; memoised per data version. */
const shareCache = new Map<string, Record<string, number>>()
function symbolShares(v: SeatView): Record<string, number> {
  const hit = shareCache.get(v.dataVersion)
  if (hit) return hit
  const out: Record<string, number> = {}
  let total = 0
  const decks = [recOf(v, 'deck.starter'), ...v.locationOrder.map((l) => recOf(v, recOf(v, l)?.['deck'] as string | undefined))]
  for (const d of decks) for (const c of (d?.['cards'] as { item: string; count: number }[] | undefined) ?? []) {
    const rec = recOf(v, c.item)
    const syms = (rec?.['symbols'] as string[] | undefined) ?? (rec?.['symbol'] ? [rec['symbol'] as string] : [])
    for (const sym of syms) { out[sym] = (out[sym] ?? 0) + c.count; total += c.count }
  }
  for (const k of Object.keys(out)) out[k] = out[k]! / Math.max(1, total)
  shareCache.set(v.dataVersion, out)
  return out
}

const binom = (n: number, k: number): number => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r }

/** Hard: the distribution of the points the other seats will add to this round's pile, seat by seat (40 §6.1, hand-tracking). */
function othersDistribution(env: PlanEnv, q: ReturnType<typeof query.crisis>, later: SeatId[]): Map<number, number> {
  const { v, me } = env
  let dist = new Map<number, number>([[0, 1]])
  const conv = (outcomes: [number, number][]): void => {
    const next = new Map<number, number>()
    for (const [pts, p] of dist) for (const [o, po] of outcomes) if (po > 0) next.set(pts + o, (next.get(pts + o) ?? 0) + p * po)
    dist = next
  }
  for (const s of v.seatOrder) {
    if (s === me) continue
    const c = q.cardsBySeat[s] ?? 0
    const m = Math.max(0.3, 0.9 * (1 - env.ledger.score(s)))
    for (let i = 0; i < c; i++) conv([[1, m], [-1, 1 - m]])
  }
  const shares = symbolShares(v)
  const base = Math.min(0.9, q.prevent.reduce((a, sym) => a + (shares[sym] ?? 0.15), 0))
  for (const s of later) {
    const h = Math.min(7, v.seats[s]!.handCount)
    // a seat's persona says how freely it gives; the circulation share says how likely a card of its hand is the right symbol
    const gen = getPersona(v.setup.seats.find((x) => x.id === s)?.persona)?.scalars.generosity ?? 0.5
    const p = Math.min(0.9, base * (0.8 + 0.4 * gen))
    const pmf: [number, number][] = []
    let left = 1
    for (let k = 0; k < Math.min(h, 3); k++) { const pk = binom(h, k) * p ** k * (1 - p) ** (h - k); pmf.push([k, pk]); left -= pk }
    pmf.push([Math.min(h, 3), Math.max(0, left)])
    conv(pmf)
  }
  return dist
}

function contribute(env: PlanEnv, legal: Action[], selfLedger: Ledger | null, gameKey: string): Action {
  const { v, me, scalars, tier } = env
  const none = legal.find((a) => a.type === 'contributeCrisis' && a.cardIds.length === 0) ?? legal[0]!
  if (v.seats[me]!.seat.exiled) return none
  const q = query.crisis(v)
  const { matching, other } = matchingCards(env, legal)
  const reserved = reservedCards(v)
  const mk = (cardIds: string[]): Action => {
    if (cardIds.length === 0) return none
    if (cardIds.length === 1) return legal.find((a) => a.type === 'contributeCrisis' && a.cardIds.length === 1 && a.cardIds[0] === cardIds[0]) ?? none
    return { type: 'contributeCrisis', decisionId: v.pending.id, seat: me, cardIds }
  }
  /** Say what went in (a statement the others weigh by their trust, 40 §6.3): a bluffer claims one more than it put in. */
  const claim = (n: number, cheat = false): void => {
    if (n <= 0) return
    postClaim(gameKey, { seat: me, round: v.roundNumber, n: cheat || env.rand() < scalars.bluffing ? n + 1 : n })
  }
  // how many points the pile is expected to reach without more of my cards
  const order = rotate(v.seatOrder, v.firstSeat)
  const later = order.slice(order.indexOf(me) + 1).filter((s) => !v.seats[s]!.seat.exiled && !v.seats[s]!.seat.eliminated && v.seats[s]!.handCount > 0)
  const othersIn = q.cardsIn - v.me.contributions.length
  const expectedOthers = othersIn * TUNE.inP + later.length * TUNE.laterP
  const shortfall = q.needed - (q.myPoints + expectedOthers)

  if (env.betrayer) {
    const push = Math.min(1, betrayerPush(v, TUNE.pushGate) * TUNE.pushScale)
    const margin = q.myPoints + expectedOthers - q.needed // expected surplus without anything more from me
    const naive = tier.betrayer === 'naive'
    // a wrong card puts about 0.9 log-odds of blame on the seats that put cards in; the betrayer spends that out of the cover it has left (40 §7.3)
    const contributors = Object.entries(q.cardsBySeat).filter(([s, n]) => n > 0 && s !== me).length + 1
    const cost = 0.9 / contributors
    const endgame = v.roundsLeft <= 1 || v.morale <= 1
    const allowed = naive || endgame || (env.cover() > 0 && cost <= env.cover() * tier.coverMargin)
    // the patient betrayer waits until the blame can spread: at least two other seats have put cards in
    const patient = tier.betrayer !== 'patient' || endgame || contributors >= 3
    const appetite = naive ? 0.9 : Math.min(0.95, TUNE.sabBase + 0.6 * push + (v.morale <= 3 ? 0.15 : 0))
    const r = env.rand()
    // a wrong card turns a pass into a fail when the pile is within two points of the line; it is also the one move the ledger can trace
    if (allowed && patient && other.length > 0 && margin <= 2.2 && margin >= -2.5 && r < appetite) { env.ledger.noteOwnWrong(1); claim(1, true); return mk([other[0]!]) }
    // quiet sabotage: keep the matching card at home when that is what tips the pile under (a short pile with no wrong card leaves no trace)
    if (matching.length > 0 && margin + 1 >= 0 && margin < 1.2 && r < appetite + 0.25 && !(r < appetite)) return none
    if (matching.length > 0 && q.myPoints <= 0) { claim(1); return mk([matching[0]!]) }
    void selfLedger
    return none
  }

  const free = matching.filter((c) => !reserved.has(c))
  // with the objective's counters met only the colony phase stands between the table and the win: spend whatever the crisis needs
  const desperate = shortfall >= 1.5 || v.morale <= 2 || new PlanCache(env).finishing()
  const pool = free.length > 0 || !desperate ? free : matching
  if (pool.length === 0) return none
  let k: number
  if (tier.handTracking) {
    // Hard: pick the smallest k that makes the pile's total reach the line with probability tau, from the seat-by-seat distribution
    const dist = othersDistribution(env, q, later)
    const p = (kk: number): number => { let a = 0; for (const [pts, pr] of dist) if (q.myPoints + kk + pts >= q.needed) a += pr; return a }
    k = pool.length
    for (let kk = 0; kk <= pool.length; kk++) if (p(kk) >= tier.crisisTau) { k = kk; break }
    // a pile that cannot be saved is not worth the cards (unless the colony cannot afford the failure)
    if (p(pool.length) < 0.12 && v.morale > 2) k = 0
    // over-contributing removes cards from the game: never past the line plus the bonus
    k = Math.min(k, Math.max(1, q.bonusAt - q.myPoints))
    if (k === 0 && q.myPoints <= 0 && p(0) < 0.5) k = Math.min(1, pool.length)
  } else {
    const spare = pool.length
    const margin = spare >= 3 ? 0.6 : spare >= 2 ? 0.3 : 0
    k = Math.max(0, Math.ceil(shortfall + margin - 0.3 + 0.2 * scalars.generosity + TUNE.cExtra))
    if (k === 0 && q.myPoints <= 0 && expectedOthers < q.needed + 1) k = 1
    // at least the fair share of what is still missing (the pile is short more often than it is long), more when the line is far off
    const missing = q.needed - q.cardsIn
    if (missing > 0) k = Math.max(k, Math.ceil(missing / (1 + later.length) - 1e-9))
    k = Math.min(k, pool.length, Math.max(1, q.bonusAt - q.myPoints))
  }
  claim(k)
  return mk(pool.slice(0, k))
}
const rotate = <T,>(xs: readonly T[], first: T): T[] => { const i = xs.indexOf(first); return i <= 0 ? [...xs] : [...xs.slice(i), ...xs.slice(0, i)] }

// ---------- search ----------
function searchKeep(env: PlanEnv, pending: PendingDecision, legal: Action[]): Action {
  const { v, scalars } = env
  const cache = new PlanCache(env)
  const w = cache.weights()
  const value = (c: string): number => Math.max(0.05, ...symbolsOfCard(v, c).map((s) => w[s])) + (foodOf(v, c) > 0 && cache.food().shortfall > 0 ? 0.8 : 0)
  let bestKeep: Action | null = null
  let bestVal = -Infinity
  for (const a of legal) {
    if (a.type !== 'keepCard') continue
    const val = value(a.cardId)
    if (val > bestVal) { bestVal = val; bestKeep = a }
  }
  const noise = legal.find((a) => a.type === 'makeNoise')
  if (!bestKeep) return noise ?? legal[0]!
  if (pending.kind === 'searchKeepOrNoise' && noise) {
    const loc = pending.context.location ?? v.search?.location
    const tokens = loc ? v.locations[loc]?.noise ?? 0 : 0
    const threshold = 0.16 + 0.04 * scalars.risk
    if (bestVal < threshold && tokens === 0) return noise
  }
  return bestKeep
}

// ---------- requests ----------
function respondRequest(env: PlanEnv, pending: PendingDecision, legal: Action[], selfLedger: Ledger | null): Action {
  const { v, scalars, tier } = env
  const decline = legal.find((a) => a.type === 'respondRequest' && a.give === null)
  const gives = legal.filter((a): a is Extract<Action, { type: 'respondRequest' }> => a.type === 'respondRequest' && a.give !== null)
  if (gives.length === 0) return decline ?? legal[0]!
  const reserved = reservedCards(v)
  const cache = new PlanCache(env)
  const w = cache.weights()
  const asker = (pending.context.seatId ?? '') as SeatId
  const cardValue = (c: string): number => Math.max(0.05, ...symbolsOfCard(v, c).map((s) => w[s])) + (reserved.has(c) ? 5 : 0)
  const sorted = [...gives].sort((a, b) => cardValue(a.give!) - cardValue(b.give!))
  const cheapest = sorted[0]!
  if (reserved.has(cheapest.give!)) return decline ?? legal[0]!
  const f = cache.food()
  const helpsColony = pending.context.symbol === 'food' && f.shortfall > 0
  // the card the crisis pile needs from this seat stays home unless the colony is starving
  if (!env.betrayer && !helpsColony && cache.holdsForCrisis(cheapest.give!)) return decline ?? legal[0]!
  // Easy gives by generosity alone (40 §12): no ledger, no reading of the asker
  if (tier.ledger !== 'full') return env.rand() < 0.2 + 0.7 * scalars.generosity ? cheapest : (decline ?? cheapest)
  if (env.betrayer) {
    const perceived = selfLedger?.score(v.seat) ?? 0.3
    const push = Math.min(1, betrayerPush(v, TUNE.pushGate) * TUNE.pushScale)
    const sym = String(pending.context.symbol ?? '')
    const hoarded = sym !== '' && (mainObjectiveNeeds(v).some((n) => n.symbol === sym) || reservedCards(v).size > 0 && v.me.hand.some((c) => reservedCards(v).has(c) && symbolsOfCard(v, c).includes(sym as never)))
    // a plausible refusal: "I need it myself" for what the betrayer hoards, a flat no late in the game; otherwise help now and then for cover
    const exposed = env.cover() < 0.8 // a refusal reads as evidence (request.declined, 0.5): only with room to spare
    if (!exposed && perceived < 0.5 && (hoarded || (helpsColony && push > 0.3))) return decline ?? legal[0]!
    if (!exposed && helpsColony && perceived < 0.35) return decline ?? legal[0]!
    return env.rand() < 0.4 + 0.4 * scalars.generosity ? cheapest : (decline ?? cheapest)
  }
  // give the lowest-value matching card iff value <= generosity x 3 x (1 - S(asker)) and the play helps the colony (40 §9.2)
  const p = Math.max(0, Math.min(1, 0.2 + 0.7 * scalars.generosity - 0.9 * env.ledger.score(asker) + (helpsColony ? 0.2 : 0)))
  return env.rand() < p ? cheapest : (decline ?? cheapest)
}

// ---------- votes ----------
function castVote(env: PlanEnv, pending: PendingDecision, legal: Action[], selfLedger: Ledger | null): Action {
  const { v, me, scalars, tier } = env
  const data = (pending.context.data ?? {}) as { target?: SeatId; eligible?: SeatId[]; code?: string; tiebreakSeat?: SeatId }
  const target = data.target
  let yes = false
  if (!target) {
    // a vote raised by a Crossroads card: yes lets the first outcome happen; back whichever the table is better off with
    const edge = effectVoteEdge(v, (id) => recOf(v, id))
    yes = edge !== null && (env.betrayer ? edge < -0.3 : edge > 0)
  } else if (target !== me && !v.seats[target]?.seat.exiled) {
    const exiled = v.seatOrder.filter((s) => v.seats[s]!.seat.exiled).length
    const theta = Math.min(0.97, Math.max(0.05, scalars.voteThreshold + tier.voteShift)) * (exiled > 0 ? 1.15 : 1)
    if (env.betrayer) {
      // never against its own interest and never on itself: it joins a vote the table's own evidence already supports (looking like the table),
      // and the patient betrayer backs it only while it has cover to spare, so its yes does not become the story
      const s = selfLedger ? selfLedger.score(target) : 0
      yes = v.roundNumber >= 2 && s > theta * 0.8 && afford(v, target)
    } else {
      // the first vote of the game needs a second round of evidence; afterwards: suspicion over the persona's threshold, and the colony can afford it
      yes = v.roundNumber >= 2 && env.ledger.score(target) >= Math.min(0.97, theta * 1.05) && afford(v, target) && tier.ledger === 'full'
      // Easy never votes without an attack as the evidence (40 §12)
      if (tier.ledger !== 'full') yes = v.roundNumber >= 2 && env.ledger.attackers.has(target)
    }
  }
  const mine = legal.filter((a): a is Extract<Action, { type: 'castVotes' }> => a.type === 'castVotes')
  // the ballot carries one key per eligible seat, plus the tiebreaker's when an exiled first player breaks ties (R p11): answer for `me` in both cases
  return mine.find((a) => (a.votes[me] === true) === yes) ?? mine[0] ?? legal[0]!
}

// ---------- crossroads, bite, exile, generic ----------
function crossroads(env: PlanEnv, pending: PendingDecision, legal: Action[], selfLedger: Ledger | null): Action {
  const { v } = env
  const rec = (id: string) => recOf(v, id)
  const cardId = pending.context.cardId as string | undefined
  const scored = legal
    .filter((a): a is Extract<Action, { type: 'chooseCrossroadsOption' }> => a.type === 'chooseCrossroadsOption')
    .map((a) => ({ a, val: crossroadsValue(v, cardId, a.optionId, rec) + 0.001 * env.rand() }))
    .sort((x, y) => y.val - x.val)
  if (scored.length === 0) return legal[0]!
  if (env.betrayer && scored.length > 1) {
    const gap = scored[0]!.val - scored[scored.length - 1]!.val
    // the colony-hurting option reads as evidence (crossroads.hurt, 0.6) unless the other was also costly: only with cover to spare, and only when it looks plausible
    const naive = env.tier.betrayer === 'naive'
    const allowed = naive || (env.cover() > 0 && 0.6 <= env.cover() * env.tier.coverMargin)
    if (gap >= 0.4 && gap <= 2 && allowed && env.rand() < (naive ? 0.6 : 0.35)) return scored[scored.length - 1]!.a
  }
  void selfLedger
  return scored[0]!.a
}

function biteSpread(env: PlanEnv, pending: PendingDecision, legal: Action[]): Action {
  const { v, me } = env
  const val = (id: string | undefined): number => {
    if (!id) return 0
    const s = v.survivors[id]
    if (!s) return 0
    return 1 + statsOf(v, id).influence / 100 + (s.owner === me ? 0.3 : 0) - 0.1 * woundsOn(v, id) * 0
  }
  const cur = val(pending.context.survivorId)
  const next = val(pending.context.targetId)
  const wantRoll = 0.7 * next < cur
  return legal.find((a) => a.type === 'biteSpread' && (a.choice === 'roll') === wantRoll) ?? legal[0]!
}

function exilePlacement(env: PlanEnv, legal: Action[]): Action {
  const cache = new PlanCache(env)
  let best = legal[0]!
  let bs = -Infinity
  for (const a of legal) {
    if (a.type !== 'placeExiled') continue
    let s = 0
    for (const p of a.placements) {
      const z = cache.v.locations[p.to]?.entrances.reduce((n, e) => n + e.zombies, 0) ?? 0
      s += cache.searchValue(p.to) - 0.12 * z
    }
    s += 0.001 * env.rand()
    if (s > bs) { bs = s; best = a }
  }
  return best
}

/** Entrance prompts ("entrance 3 (2)" = entrance 3 holding 2 zombies): pick the one that cuts the expected overruns most. */
function entrancePick(env: PlanEnv, pending: PendingDecision, acts: Action[]): Action | null {
  const labels: Record<string, string> = {}
  for (const o of pending.options ?? []) labels[o.id] = o.label
  const parsed: ({ a: Action; entrance: number; zombies: number | undefined } | null)[] = acts.map((a) => {
    const id = optionOf(a) ?? (a.type === 'itemTarget' ? a.targets[0] : undefined) ?? ''
    const m = /entrance\s+(\d+)(?:\s*\((\d+)\))?/i.exec(labels[id] ?? '')
    return m ? { a, entrance: Number(m[1]), zombies: m[2] !== undefined ? Number(m[2]) : undefined } : null
  })
  if (parsed.length === 0 || parsed.some((p) => p === null)) return null
  const cache = new PlanCache(env)
  const loc = (pending.context.location as string | undefined) ?? 'colony'
  if (!env.v.locations[loc]) return null
  let best: Action | null = null
  let bs = -Infinity
  for (const p of parsed) {
    if (!p) continue
    const patch = p.zombies !== undefined ? { entrance: p.entrance, z: -1 } : { entrance: p.entrance, b: 1 }
    const s = -cache.cost(loc, patch) + 0.001 * env.rand()
    if (s > bs) { bs = s; best = p.a }
  }
  return best
}

function itemTarget(env: PlanEnv, pending: PendingDecision, legal: Action[], mem: PlanMemory): Action {
  const { v, me } = env
  const code = String((pending.context.data as { code?: string } | undefined)?.code ?? '')
  const acts = legal.filter((a): a is Extract<Action, { type: 'itemTarget' }> => a.type === 'itemTarget')
  if (acts.length === 0) return legal[0]!
  const ent = entrancePick(env, pending, acts)
  if (ent) return ent
  const planned = mem.fuelWho ? acts.find((a) => (a.targets[0] ?? a.optionId) === mem.fuelWho) : undefined
  if (planned) { mem.fuelWho = null; return planned }
  const cache = new PlanCache(env)
  const score = (a: Extract<Action, { type: 'itemTarget' }>): number => {
    const id = a.targets[0] ?? a.optionId ?? ''
    const sv = v.survivors[id]
    if (sv) {
      const own = sv.owner === me ? 1 : 0
      const wounds = woundsOn(v, id)
      return /medic|heal|adrenaline/.test(code) ? own * 2 + wounds : own * 2 - wounds * 0.2
    }
    if (v.locations[id]) {
      const z = v.locations[id]!.entrances.reduce((n, e) => n + e.zombies, 0)
      return id === 'colony' ? 1 + cache.cost('colony') : z * 0.3
    }
    return 0
  }
  return acts.map((a) => ({ a, s: score(a) + 0.001 * env.rand() })).sort((x, y) => y.s - x.s)[0]!.a
}

function genericChoice(env: PlanEnv, pending: PendingDecision, legal: Action[]): Action {
  const acts = legal.filter((a) => a.type === 'effectChoice' || a.type === 'objectiveChoice')
  if (acts.length === 0) return legal[0]!
  const labels: Record<string, string> = {}
  for (const o of pending.options ?? []) labels[o.id] = o.label
  const ent = entrancePick(env, pending, acts)
  if (ent) return ent
  const ids = acts.map((a) => optionOf(a) ?? '')
  // optional "do you want to ..." prompts: the quiet answer unless the label clearly pays
  if (ids.includes('yes') && ids.includes('no')) return acts.find((a) => optionOf(a) === 'no') ?? acts[0]!
  return acts.map((a) => ({ a, s: labelScore(labels[optionOf(a) ?? ''] ?? '') + 0.001 * env.rand() })).sort((x, y) => y.s - x.s)[0]!.a
}
