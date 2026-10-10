// The Normal AI colonist (40 §2, slim M4): a heuristic Decider for every decision kind. It receives only view(state, seat), the pending
// decision and the legal list, keeps its own suspicion ledger from the (redacted) events it is shown, never rolls dice and never
// touches GameState or the game rng (its randomness is deriveSeed(seed, seat, decision id)). It always returns an action the engine
// accepts: a member of `legal`, or a multi-card crisis contribution built from legal single-card ones.
import { deriveSeed, nextFloat, query } from '../engine/index'
import type { Action, Decider, GameEvent, PendingDecision, SeatId } from '../engine/index'
import type { SeatView } from '../engine/view'
import { crossroadsValue, labelScore, optionOf } from './normal/options'
import { betrayalKind, betrayerPush, foodOf, isBetrayer, mainObjectiveNeeds, matchesCrisis, recOf, reservedCards, statsOf, symbolsOfCard, woundsOn } from './normal/info'
import { PlanCache, TUNE, planTurn, type PlanEnv, type PlanMemory } from './normal/plan'
import { Ledger } from './normal/suspicion'
import { DEFAULT_SCALARS, getPersona, type Persona, type PersonaScalars } from './personas'

export interface DeciderStats { decisions: number; totalMs: number; maxMs: number; degraded: number; lastError?: string }
export interface AiDecider extends Decider {
  /** Feed the events (already redacted for this seat) since the last call, plus the seat's current view. */
  observe(events: readonly GameEvent[], view: SeatView): void
  readonly persona: Persona | undefined
  readonly stats: DeciderStats
}

const g = globalThis as { AI_TIME_BUDGET_MS?: number; process?: { env?: Record<string, string | undefined> } }
export function budgetMs(): number {
  const fromEnv = Number(g.process?.env?.['AI_TIME_BUDGET_MS'])
  const n = Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : g.AI_TIME_BUDGET_MS
  return typeof n === 'number' && n > 0 ? n : 100
}
const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now())

function makeRand(seed: string, seat: string, id: string): () => number {
  let st = deriveSeed(seed, seat, id, 'normal')
  return () => { const [f, next] = nextFloat(st); st = next; return f }
}

export function createNormalDecider(seed: string, personaId?: string): AiDecider {
  const persona = getPersona(personaId)
  const scalars: PersonaScalars = persona?.scalars ?? DEFAULT_SCALARS
  const mem: PlanMemory = { requestTurn: -1, voteRound: -1, calledAt: -1, objRound: -1, fuelWho: null }
  let ledger: Ledger | null = null
  let selfLedger: Ledger | null = null // the betrayer's view of how the table sees it
  const stats: DeciderStats = { decisions: 0, totalMs: 0, maxMs: 0, degraded: 0 }

  const ledgerFor = (v: SeatView): Ledger => {
    const betrayer = isBetrayer(v)
    if (!ledger) ledger = new Ledger({ me: v.seat, paranoia: scalars.paranoia, selfCandidate: false })
    if (betrayer && !selfLedger) selfLedger = new Ledger({ me: v.seat, paranoia: 1, selfCandidate: true })
    return ledger
  }

  return {
    persona,
    stats,
    observe(events, v) {
      const l = ledgerFor(v)
      l.observe(events, v)
      selfLedger?.observe(events, v)
    },
    async decide(v: SeatView, pending: PendingDecision, legal: Action[]): Promise<Action> {
      const t0 = now()
      const deadline = t0 + budgetMs()
      const l = ledgerFor(v)
      l.syncView(v)
      selfLedger?.syncView(v)
      const rand = makeRand(seed, v.seat, pending.id)
      const env: PlanEnv = { v, me: v.seat, scalars, ledger: l, betrayer: isBetrayer(v), selfScore: () => (selfLedger ? selfLedger.score(v.seat) : 0), mem, rand, expired: () => now() > deadline }
      let pick: Action | undefined
      try { pick = decideKind(env, pending, legal, selfLedger, mem) } catch (e) { pick = undefined; stats.degraded++; stats.lastError = e instanceof Error ? (e.stack ?? e.message) : String(e) }
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

function decideKind(env: PlanEnv, pending: PendingDecision, legal: Action[], selfLedger: Ledger | null, mem: PlanMemory): Action {
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
    case 'crisisContribution': return contribute(env, legal, selfLedger)
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
    return s.influence / 25 + (6 - s.attack) * (0.3 + 0.2 * scalars.risk) + (6 - s.search) * 0.45 + ab
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
    const s = statsOf(env.v, a.survivorId).influence + env.rand()
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

function contribute(env: PlanEnv, legal: Action[], selfLedger: Ledger | null): Action {
  const { v, me, scalars } = env
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
  // how many points the pile is expected to reach without more of my cards
  const order = rotate(v.seatOrder, v.firstSeat)
  const later = order.slice(order.indexOf(me) + 1).filter((s) => !v.seats[s]!.seat.exiled && !v.seats[s]!.seat.eliminated && v.seats[s]!.handCount > 0)
  const othersIn = q.cardsIn - v.me.contributions.length
  const expectedOthers = othersIn * TUNE.inP + later.length * TUNE.laterP
  const shortfall = q.needed - (q.myPoints + expectedOthers)

  if (env.betrayer) {
    const perceived = selfLedger?.score(me) ?? 0.3
    const push = Math.min(1, betrayerPush(v) * TUNE.pushScale)
    const hide = Math.min(1, Math.max(0, (perceived - 0.25) / 0.35)) // how exposed the table's suspicion has made it
    const margin = q.myPoints + expectedOthers - q.needed // expected surplus without anything more from me
    const appetite = Math.min(0.95, TUNE.sabBase + 0.6 * push + (v.morale <= 3 ? 0.15 : 0)) * (1 - 0.7 * hide)
    const r = env.rand()
    // a wrong card turns a pass into a fail when the pile is within two points of the line; it is also the one move the ledger can trace
    if (other.length > 0 && margin <= 2.2 && margin >= -2.5 && r < appetite) { env.ledger.noteOwnWrong(1); return mk([other[0]!]) }
    // quiet sabotage: keep the matching card at home when that is what tips the pile under (a short pile with no wrong card leaves no trace)
    if (matching.length > 0 && margin + 1 >= 0 && margin < 1.2 && r < appetite + 0.25 && !(r < appetite)) return none
    return matching.length > 0 && q.myPoints <= 0 ? mk([matching[0]!]) : none
  }

  const free = matching.filter((c) => !reserved.has(c))
  const desperate = shortfall >= 1.5 || v.morale <= 2
  const pool = free.length > 0 || !desperate ? free : matching
  if (pool.length === 0) return none
  const spare = pool.length
  const margin = spare >= 3 ? 0.6 : spare >= 2 ? 0.3 : 0
  let k = Math.max(0, Math.ceil(shortfall + margin - 0.3 + 0.2 * scalars.generosity + TUNE.cExtra))
  if (k === 0 && q.myPoints <= 0 && expectedOthers < q.needed + 1) k = 1
  k = Math.min(k, pool.length, Math.max(1, q.bonusAt - q.myPoints))
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
  const { v, scalars } = env
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
  if (env.betrayer) {
    const perceived = selfLedger?.score(v.seat) ?? 0.3
    const push = Math.min(1, betrayerPush(v) * TUNE.pushScale)
    const sym = String(pending.context.symbol ?? '')
    const hoarded = sym !== '' && (mainObjectiveNeeds(v).some((n) => n.symbol === sym) || (betrayalKind(v) === 'trigger-happy' && sym === 'weapon'))
    // a plausible refusal: "I need it myself" for what the betrayer hoards, a flat no late in the game; otherwise help now and then for cover
    if (perceived < 0.5 && (hoarded || (helpsColony && push > 0.3))) return decline ?? legal[0]!
    if (helpsColony && perceived < 0.35) return decline ?? legal[0]!
    return env.rand() < 0.4 + 0.4 * scalars.generosity ? cheapest : (decline ?? cheapest)
  }
  const p = Math.max(0, Math.min(1, 0.2 + 0.7 * scalars.generosity - 0.9 * env.ledger.score(asker) + (helpsColony ? 0.2 : 0)))
  return env.rand() < p ? cheapest : (decline ?? cheapest)
}

// ---------- votes ----------
function castVote(env: PlanEnv, pending: PendingDecision, legal: Action[], selfLedger: Ledger | null): Action {
  const { v, me, scalars } = env
  const data = (pending.context.data ?? {}) as { target?: SeatId; eligible?: SeatId[] }
  const target = data.target
  let yes = false
  if (target && target !== me) {
    const exiled = v.seatOrder.filter((s) => v.seats[s]!.seat.exiled).length
    if (env.betrayer) {
      // protect itself, and blend in: join a vote the table's own evidence already supports
      const s = selfLedger ? selfLedger.score(target) : 0
      yes = v.roundNumber >= 2 && s > scalars.voteThreshold * 0.8
    } else {
      const thr = scalars.voteThreshold * (exiled > 0 ? 1.25 : 1)
      const top = env.ledger.top()
      yes = v.roundNumber >= 2 && top?.seat === target && env.ledger.score(target) > Math.min(0.95, thr * 1.1)
    }
  }
  const mine = legal.filter((a): a is Extract<Action, { type: 'castVotes' }> => a.type === 'castVotes')
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
    const perceived = selfLedger?.score(v.seat) ?? 0.3
    const gap = scored[0]!.val - scored[scored.length - 1]!.val
    if (gap >= 0.4 && gap <= 2 && env.rand() < 0.35 * (1 - Math.min(1, perceived / 0.5))) return scored[scored.length - 1]!.a
  }
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
