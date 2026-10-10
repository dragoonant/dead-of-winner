// The Normal turn planner (40 §4, slimmed): every legal turn action gets a utility in morale-equivalent points and the best one is
// returned; the engine asks again after each outcome, so the plan is greedy and re-made every action. Priorities:
//   1. colony defence (kill the zombie / raise the barricade that prevents the most expected overruns)
//   2. feed the colony (play food when the supply is short for this round's pay), clean waste near a multiple of ten
//   3. search with the best qualifying die where the deck's symbols match the crisis and the seat's objective
//   4. move only when the search gain beats the exposure roll, and never strip the colony while it is threatened
// Never attacks survivors, never spends dice on abilities it cannot value. Reads only the SeatView and query.*.
import { query } from '../../engine/index'
import type { Action, ExposureOdds, ItemSymbol, LocationId, SeatId, SurvivorId } from '../../engine/index'
import type { SeatView } from '../../engine/view'
import type { PersonaScalars } from '../personas'
import {
  OVERRUN_COST, boardCost, crisisPrevent, defOfCard, foodOf, isEquipCard, matchesCrisis, missingObjectiveSymbols, recOf, reservedCards, statsOf,
  symbolsOfCard, woundsOn, type Ent, type Rec,
} from './info'
import type { Ledger } from './suspicion'

export interface PlanMemory { requestTurn: number; voteRound: number; calledAt: number }
export interface PlanEnv {
  v: SeatView
  me: SeatId
  scalars: PersonaScalars
  ledger: Ledger
  betrayer: boolean
  mem: PlanMemory
  rand: () => number
  expired: () => boolean
}

/** Tuning constants (morale-equivalent points). `AI_TUNE='{"death":2}'` overrides them for bench experiments; nothing else reads the environment. */
function envTune(): Record<string, number> {
  try { return JSON.parse(((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.['AI_TUNE']) ?? '{}') as Record<string, number> } catch { return {} }
}
export const TUNE = {
  death: 2, moveNow: 1.0, moveLater: 1.4, moveCostMult: 1.3, searchScale: 1.0, barricadeBase: 0.07, homeDefend: 0.4, homeDanger: 0.8, killBase: 0.015, sampleKill: 0.85, killThem: 0.1, barricadeOut: 0.25, needMatch: 0.65, frost: 1, maxOut: 9,
  ...envTune(),
}
/** One exposure roll in morale points: a bite kills; a frostbite token adds a wound every turn until healed, so it is nearly as deadly (R p11). */
const expCost = (o: ExposureOdds): number => (o.pDeath + TUNE.frost * o.frostbite + 0.12 * o.wound) * TUNE.death
export interface Patch { entrance: number; z?: number; b?: number }
const ALL_SYMBOLS: ItemSymbol[] = ['weapon', 'fuel', 'education', 'food', 'medicine', 'tool', 'survivor']

/** Per-decision caches over the query helpers (each call rebuilds a state from the view, so call once per survivor/location). */
export class PlanCache {
  private expo = new Map<string, ExposureOdds>()
  private need = new Map<string, number | null>()
  private moves = new Map<string, ReturnType<typeof query.moveTargets>>()
  private sOdds = new Map<string, ReturnType<typeof query.searchOdds>>()
  private _food?: ReturnType<typeof query.foodNeeded>
  private _zombies?: ReturnType<typeof query.zombiesToAdd>
  private _weights?: Record<ItemSymbol, number>
  private _reserved?: Set<string>
  constructor(readonly env: PlanEnv) {}
  get v(): SeatView { return this.env.v }
  food(): ReturnType<typeof query.foodNeeded> { return (this._food ??= query.foodNeeded(this.v)) }
  zombies(): ReturnType<typeof query.zombiesToAdd> { return (this._zombies ??= query.zombiesToAdd(this.v)) }
  reserved(): Set<string> { return (this._reserved ??= reservedCards(this.v)) }
  exposure(id: SurvivorId, reason: 'zombieKill' | 'move' = 'zombieKill'): ExposureOdds {
    const k = `${id}|${reason}`
    let e = this.expo.get(k)
    if (!e) { e = query.exposureOdds(this.v, id, reason); this.expo.set(k, e) }
    return e
  }
  /** Cost of one exposure roll in morale points: death (and the bite chain it may start), plus the wounds that make the next roll deadlier. */
  exposureCost(id: SurvivorId, reason: 'zombieKill' | 'move' = 'zombieKill'): number {
    const o = this.exposure(id, reason)
    const raw = expCost(o)
    return raw * (1 - 0.35 * this.env.scalars.risk)
  }
  dieNeed(id: SurvivorId, action: 'attack' | 'search'): number | null {
    const k = `${id}|${action}`
    if (!this.need.has(k)) this.need.set(k, query.dieRequirement(this.v, id, action).need)
    return this.need.get(k) ?? null
  }
  moveTargets(id: SurvivorId): ReturnType<typeof query.moveTargets> {
    let m = this.moves.get(id)
    if (!m) { m = query.moveTargets(this.v, id); this.moves.set(id, m) }
    return m
  }
  searchOdds(loc: LocationId): ReturnType<typeof query.searchOdds> {
    let s = this.sOdds.get(loc)
    if (!s) { s = query.searchOdds(this.v, loc); this.sOdds.set(loc, s) }
    return s
  }
  /** What one card is worth to this seat right now, by symbol (morale-equivalent points). */
  weights(): Record<ItemSymbol, number> {
    if (this._weights) return this._weights
    const v = this.v
    const w: Record<ItemSymbol, number> = { weapon: 0.2, fuel: 0.2, education: 0.18, food: 0.3, medicine: 0.2, tool: 0.2, survivor: 0.25 }
    const f = this.food()
    const ahead = Math.max(0, f.needed * 2 - f.supply)
    w.food += 0.28 * Math.min(4, ahead) + (f.shortfall > 0 ? 0.35 : 0)
    const reserved = this.reserved()
    const haveMatch = v.me.hand.filter((c) => !reserved.has(c) && matchesCrisis(v, c)).length
    for (const s of crisisPrevent(v)) w[s] += haveMatch >= 1 ? 0.15 : TUNE.needMatch
    for (const s of missingObjectiveSymbols(v)) w[s] += 0.55
    const wounds = (v.seats[this.env.me]?.survivors ?? []).reduce((n, id) => n + woundsOn(v, id), 0)
    w.medicine += 0.12 * Math.min(4, wounds)
    this._weights = w
    return w
  }
  /** Expected value of the next card drawn at a location (0 when its deck is empty). */
  searchValue(loc: LocationId): number {
    if (loc === 'colony') return 0
    const o = this.searchOdds(loc)
    if (o.remaining <= 0) return 0
    const w = this.weights()
    let s = 0
    for (const sym of ALL_SYMBOLS) s += (o.pSymbol[sym] ?? 0) * w[sym]
    return s * TUNE.searchScale
  }
  // ---------- board costs ----------
  arrivals(loc: LocationId, extraSurvivors = 0): number {
    const z = this.zombies()
    const p = z.perLocation.find((x) => x.location === loc)
    const base = loc === 'colony' ? Math.ceil(((p?.survivors ?? 0) + extraSurvivors) / 2) : (p?.survivors ?? 0) + extraSurvivors
    const noise = z.noise.find((x) => x.location === loc)?.expected ?? 0
    return base + Math.round(noise)
  }
  board(loc: LocationId, patch?: Patch | Patch[]): { ent: Ent[]; cap: number } {
    const l = this.v.locations[loc]!
    const ent = l.entrances.map((e) => ({ z: e.zombies, b: e.barricades }))
    for (const p of patch === undefined ? [] : Array.isArray(patch) ? patch : [patch]) {
      const i = l.entrances.findIndex((e) => e.index === p.entrance)
      if (i >= 0) { ent[i]!.z = Math.max(0, ent[i]!.z + (p.z ?? 0)); ent[i]!.b = Math.max(0, ent[i]!.b + (p.b ?? 0)) }
    }
    return { ent, cap: l.capacity.entranceSpaces }
  }
  /** Greedy: the `count` kills (z) or barricades (b) at `loc` that cut the expected cost most, in order, and the total gain. */
  bestPatches(loc: LocationId, kind: 'z' | 'b', count: number): { patches: Patch[]; gain: number } {
    const l = this.v.locations[loc]
    if (!l) return { patches: [], gain: 0 }
    const patches: Patch[] = []
    let cur = this.cost(loc)
    const start = cur
    for (let i = 0; i < count; i++) {
      let best: { p: Patch; cost: number } | null = null
      for (const e of l.entrances) {
        const room = l.capacity.entranceSpaces - (e.zombies + e.barricades) - patches.filter((p) => p.entrance === e.index).reduce((n, p) => n + (p.b ?? 0) - (p.z ?? 0) * 0, 0)
        if (kind === 'z' && e.zombies + patches.filter((p) => p.entrance === e.index).reduce((n, p) => n + (p.z ?? 0), 0) <= 0) continue
        if (kind === 'b' && room <= 0) continue
        const p: Patch = kind === 'z' ? { entrance: e.index, z: -1 } : { entrance: e.index, b: 1 }
        const c = this.cost(loc, [...patches, p])
        if (!best || c < best.cost) best = { p, cost: c }
      }
      if (!best) break
      patches.push(best.p)
      cur = best.cost
    }
    return { patches, gain: start - cur }
  }
  cost(loc: LocationId, patch?: Patch | Patch[], extraSurvivors = 0): number {
    const { ent, cap } = this.board(loc, patch)
    const rounds = Math.min(2, Math.max(1, this.v.roundsLeft))
    return boardCost(ent, cap, this.arrivals(loc, extraSurvivors), rounds)
  }
}

const unusedDice = (v: SeatView, seat: SeatId) => v.seats[seat]!.dice.filter((d) => !d.used)
const dieOf = (v: SeatView, seat: SeatId, id: string) => v.seats[seat]!.dice.find((d) => d.id === id)

/** Utility of one legal turn action, in morale points. Large negatives mean "never". */
export function scoreTurnAction(c: PlanCache, a: Action): number {
  const { v, me, scalars } = c.env
  switch (a.type) {
    case 'endTurn': return 0.04
    case 'attack': {
      if (a.target.kind === 'survivor') return -9
      const sv = v.survivors[a.survivorId]
      if (!sv) return -9
      const loc = a.target.location
      const gain = c.cost(loc) - c.cost(loc, { entrance: a.target.entrance, z: -1 })
      const d = dieOf(v, me, a.dieId)
      const objBonus = v.objective.id === 'obj.main.we-need-more-samples' ? TUNE.sampleKill : v.objective.id === 'obj.main.kill-them' && loc !== 'colony' ? TUNE.killThem : 0
      const baseline = loc === 'colony' ? TUNE.killBase * (v.locations['colony']!.entrances.reduce((n, e) => n + e.zombies, 0)) : 0
      return gain + objBonus + baseline - c.exposureCost(a.survivorId) - 0.02 * (d?.value ?? 3)
    }
    case 'barricade': {
      const sv = v.survivors[a.survivorId]
      if (!sv) return -9
      const loc = sv.location
      const gain = c.cost(loc) - c.cost(loc, { entrance: a.entrance, b: 1 })
      const d = dieOf(v, me, a.dieId)
      const base = loc === 'colony' ? TUNE.barricadeBase : TUNE.barricadeOut
      return gain + base - 0.02 * (d?.value ?? 3)
    }
    case 'cleanWaste': {
      const w = v.waste.length
      const d = dieOf(v, me, a.dieId)
      const crosses = Math.floor(w / 10) - Math.floor(Math.max(0, w - 3) / 10)
      const near = w % 10 >= 7 ? 0.35 : 0
      return crosses * 1.0 + near - 0.02 * (d?.value ?? 3) - 0.03
    }
    case 'search': {
      const sv = v.survivors[a.survivorId]
      if (!sv) return -9
      const val = c.searchValue(sv.location)
      const d = dieOf(v, me, a.dieId)
      return val - 0.02 * (d?.value ?? 3) - 0.01
    }
    case 'playCard': return scorePlay(c, a)
    case 'move': return scoreMove(c, a.survivorId, a.to)
    case 'request': {
      if (v.turnCount === c.env.mem.requestTurn) return -1
      const f = c.food()
      const hand = v.me.hand
      const reserved = c.reserved()
      const have = (sym: ItemSymbol) => hand.some((x) => !reserved.has(x) && symbolsOfCard(v, x).includes(sym))
      let base = -1
      if (a.symbol === 'food' && f.shortfall > 0 && !hand.some((x) => foodOf(v, x) > 0)) base = 0.3 + 0.2 * f.shortfall
      else if (a.symbol === 'medicine' && !have('medicine') && (v.seats[me]?.survivors ?? []).some((s) => woundsOn(v, s) >= 2)) base = 0.2
      if (base < 0) return -1
      const to = a.to
      const target = v.seats[to]
      if (!target || target.seat.exiled || target.handCount === 0) return -1
      return base * (0.6 + 0.4 * scalars.generosity) - 0.3 * c.env.ledger.score(to) + 0.02 * Math.min(5, target.handCount)
    }
    case 'callVote': {
      if (v.roundNumber < 2 || v.turn?.voteCalled) return -1
      if (c.env.mem.voteRound === v.roundNumber) return -1
      const top = c.env.ledger.top()
      if (!top || top.seat !== a.target) return -1
      const thr = scalars.callThreshold * (exiledCount(v) > 0 ? 1.15 : 1)
      if (c.env.betrayer) return -1
      return top.score >= thr ? 2 : -1
    }
    case 'spendFood': return -1
    case 'useAbility': return scoreAbility(c, a)
    case 'attract': return -5
    case 'handOff': return -1
    case 'contributeCrisis': return -1
    default: return -2
  }
}

const exiledCount = (v: SeatView): number => v.seatOrder.filter((s) => v.seats[s]!.seat.exiled).length

/** The ability record named `abilityId` on the survivor or on an item it carries (the same lookup the engine's rawAbility does). */
function abilityRecord(v: SeatView, survivorId: SurvivorId, abilityId: string): Rec | undefined {
  const own = recOf(v, survivorId)?.['ability'] as Rec | undefined
  if (own && own['id'] === abilityId) return own
  for (const cid of v.survivors[survivorId]?.equipped ?? []) {
    const found = (defOfCard(v, cid)?.['equipped'] as Rec[] | undefined)?.find((x) => x['id'] === abilityId)
    if (found) return found
  }
  return undefined
}

/** Abilities that kill zombies, raise barricades, heal, feed or clean: valued like the plain actions they replace (and usually cheaper in exposure). */
function scoreAbility(c: PlanCache, a: Extract<Action, { type: 'useAbility' }>): number {
  const { v, me } = c.env
  const sv = v.survivors[a.survivorId]
  const raw = abilityRecord(v, a.survivorId, a.abilityId)
  if (!sv || !raw) return -0.5
  const here = sv.location
  const die = a.dieId ? dieOf(v, me, a.dieId) : undefined
  let val = 0
  let known = false
  for (const n of (raw['effect'] as Rec[] | undefined) ?? []) {
    const count = typeof n['count'] === 'number' ? (n['count'] as number) : 1
    const loc = (n['location'] === 'here' || n['location'] === undefined ? here : (n['location'] as LocationId)) as LocationId
    switch (n['op']) {
      case 'killZombies': {
        known = true
        const rolls = n['value'] === 'noExposure' ? 0 : n['value'] === 'exposureOnce' ? 1 : count
        const { gain, patches } = c.bestPatches(loc, 'z', count)
        const base = loc === 'colony' ? TUNE.killBase * patches.length : 0
        val += gain + base - rolls * c.exposureCost(a.survivorId)
        break
      }
      case 'addBarricade': {
        known = true
        const { gain, patches } = c.bestPatches(loc, 'b', count)
        val += gain + (loc === 'colony' ? TUNE.barricadeBase : TUNE.barricadeOut) * patches.length
        break
      }
      case 'heal': {
        known = true
        const atLoc = (v.seats[me]?.survivors ?? []).filter((s) => v.survivors[s]?.location === here)
        const frost = atLoc.some((s) => (v.survivors[s]?.frostbite ?? 0) > 0)
        const worst = Math.max(0, ...atLoc.map((s) => woundsOn(v, s)))
        val += worst < 1 ? -1 : frost ? 0.6 * TUNE.death : 0.1 + 0.2 * Math.min(2, worst)
        break
      }
      case 'food': {
        known = true
        const f = c.food()
        const add = typeof n['value'] === 'number' ? (n['value'] as number) : 1
        val += f.shortfall > 0 ? f.moraleLossIfShort * Math.min(1, add / f.shortfall) * 0.8 : v.food - f.needed < f.needed ? 0.12 : 0.03
        break
      }
      case 'cleanWaste': {
        known = true
        const w = v.waste.length
        const take = typeof n['count'] === 'number' ? (n['count'] as number) : 3
        val += (Math.floor(w / 10) - Math.floor(Math.max(0, w - take) / 10)) * 1.0 + (w % 10 >= 7 ? 0.2 : 0) - 0.03
        break
      }
      default: break
    }
  }
  if (!known) return -0.5
  return val - 0.02 * (die?.value ?? 0)
}

/** What carrying an item is worth, from the abilities printed on it (no exposure kills and barricades are the prizes). */
function equipValue(v: SeatView, cardId: string): number {
  let best = 0.07
  for (const ab of (defOfCard(v, cardId)?.['equipped'] as Rec[] | undefined) ?? []) {
    for (const n of (ab['effect'] as Rec[] | undefined) ?? []) {
      if (typeof n === 'string') continue
      const op = n['op'] as string | undefined
      if (op === 'killZombies') best = Math.max(best, n['value'] === 'noExposure' ? 0.5 : 0.18)
      else if (op === 'addBarricade') best = Math.max(best, 0.3)
      else if (op === 'cleanWaste') best = Math.max(best, 0.12)
      else if (op === 'extraSearchLook' || op === 'extraSearchKeep') best = Math.max(best, 0.2)
    }
  }
  return best
}

function scorePlay(c: PlanCache, a: Extract<Action, { type: 'playCard' }>): number {
  const { v, me } = c.env
  const reserved = c.reserved()
  const f = c.food()
  const food = foodOf(v, a.cardId)
  if (food > 0) {
    if (f.shortfall > 0) {
      const covers = food >= f.shortfall
      const loss = f.moraleLossIfShort
      return covers ? loss * 1.1 : loss * 0.45 * (food / f.shortfall)
    }
    if (v.food - f.needed < f.needed && v.roundsLeft > 1 && !reserved.has(a.cardId)) return 0.06
    return -1
  }
  const syms = symbolsOfCard(v, a.cardId)
  const haveMatch = v.me.hand.filter((x) => matchesCrisis(v, x)).length
  if (syms.includes('medicine') && !isEquipCard(v, a.cardId)) {
    const mineIds = (v.seats[me]?.survivors ?? []).filter((s) => v.survivors[s]?.status === 'alive')
    const worst = Math.max(0, ...mineIds.map((s) => woundsOn(v, s)))
    const frost = mineIds.some((s) => (v.survivors[s]?.frostbite ?? 0) > 0)
    if (worst < 1) return -1
    if (matchesCrisis(v, a.cardId) && haveMatch <= 1 && !frost) return -1
    return (frost ? 0.6 * TUNE.death : 0.1 + 0.2 * Math.min(2, worst)) - (reserved.has(a.cardId) ? 5 : 0)
  }
  if (isEquipCard(v, a.cardId) && a.equipTo) {
    if (reserved.has(a.cardId) || (matchesCrisis(v, a.cardId) && haveMatch <= 1)) return -1
    const st = statsOf(v, a.equipTo)
    const at = v.survivors[a.equipTo]?.location === 'colony' ? 0.02 : 0
    return equipValue(v, a.cardId) + 0.01 * (6 - st.attack) + at
  }
  return -1
}

function scoreMove(c: PlanCache, survivorId: SurvivorId, to: LocationId): number {
  const { v, me, scalars } = c.env
  const sv = v.survivors[survivorId]
  if (!sv) return -9
  const from = sv.location
  const tgt = c.moveTargets(survivorId).find((t) => t.location === to)
  const o = tgt?.exposure
  const expo = o
    ? expCost(o) * (1 - 0.35 * scalars.risk)
    : 0.25
  const mine = (v.seats[me]?.survivors ?? []).filter((s) => v.survivors[s]?.status === 'alive')
  const homeOthers = mine.filter((s) => s !== survivorId && v.survivors[s]?.location === 'colony').length
  const colonyCost = c.cost('colony')
  const outNow = mine.filter((s) => v.survivors[s]?.location !== 'colony').length
  if (to !== 'colony') {
    if (from === 'colony' && outNow >= TUNE.maxOut) return -1
    const loc = v.locations[to]!
    if (loc.deckCount <= 0) return -1
    const sval = c.searchValue(to)
    const baseline = from !== 'colony' ? c.searchValue(from) : 0
    const need = c.dieNeed(survivorId, 'search')
    const dice = unusedDice(v, me)
    const usable = need === null ? dice.length : dice.filter((d) => d.value >= need).length
    const now = TUNE.moveNow * (sval - baseline) * Math.min(usable, 2)
    const later = (sval - baseline) * (v.roundsLeft > 2 ? TUNE.moveLater : v.roundsLeft > 1 ? TUNE.moveLater / 2 : 0)
    const extra = c.cost(to, undefined, 1) - c.cost(to)
    let cost = expo * (from === 'colony' ? TUNE.moveCostMult : 1) + extra * 1.2
    if (from === 'colony' && homeOthers === 0 && colonyCost > 0.25) cost += colonyCost * 0.7
    if (from === 'colony' && v.seats[me]!.survivors.length >= 1 && colonyCost > 0.8) cost += 0.3
    const foodCredit = from === 'colony' && c.food().shortfall > 0 ? 0.12 : 0
    return now + later + foodCredit - cost - 0.02
  }
  // coming home
  const originCost = c.cost(from, undefined, 0) - c.cost(from, undefined, -1)
  const danger = originCost > 0.5 ? originCost * TUNE.homeDanger : 0
  const defend = colonyCost > 0.9 ? Math.min(1.5, colonyCost) * TUNE.homeDefend : 0
  return danger + defend - expo * 1.1 - 0.1
}

/** Pick the best-scoring legal turn action; ties and near-ties are broken by the seeded rand. */
export function planTurn(c: PlanCache, legal: Action[]): Action {
  const { v, me } = c.env
  const end = legal.find((a) => a.type === 'endTurn')
  if ((v.turn?.actions ?? 0) >= 30 && end) return end
  let best: Action | null = null
  let bestScore = -Infinity
  let n = 0
  for (const a of legal) {
    if (a.type === 'contributeCrisis' || a.type === 'attract' || a.type === 'handOff') continue
    if ((n++ & 15) === 15 && c.env.expired()) break
    const s = scoreTurnAction(c, a) + 0.002 * c.env.rand()
    if (s > bestScore) { bestScore = s; best = a }
  }
  return best ?? end ?? legal[0]!
}
