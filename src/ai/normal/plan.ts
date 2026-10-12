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
import type { TierParams } from '../tiers'
import {
  OVERRUN_COST, betrayalFractions, betrayalKind, betrayalNeeds, betrayerPush, boardCost, countableForBetrayal, weaponsCarried, countableInHand, crisisPrevent, defOfCard, foodOf, isEquipCard, mainObjectiveNeeds, matchesCrisis, missingObjectiveSymbols, recOf,
  reservedCards, statsOf, symbolsOfCard, woundsOn, type Ent, type ObjNeed, type Rec,
} from './info'
import type { Ledger } from './suspicion'

import { afford, estimateYes } from './votes'

export interface PlanMemory { requestTurn: number; voteRound: number; calledAt: number; objRound: number; fuelWho: SurvivorId | null }
export interface PlanEnv {
  v: SeatView
  me: SeatId
  scalars: PersonaScalars
  ledger: Ledger
  betrayer: boolean
  /** a betrayer's estimate of how suspicious the table finds it (0..1); 0 for loyal seats */
  selfScore: () => number
  mem: PlanMemory
  rand: () => number
  expired: () => boolean
  tier: TierParams
  /** the other half of the betrayer's picture: how many log-odds of cover it has left before the table would vote it out (Infinity for a loyal seat) */
  cover: () => number
}

/** Tuning constants (morale-equivalent points). `AI_TUNE='{"death":2}'` overrides them for bench experiments; nothing else reads the environment. */
export function envTune(): Record<string, number> {
  try { return JSON.parse(((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.['AI_TUNE']) ?? '{}') as Record<string, number> } catch { return {} }
}
const BASE_TUNE = {
  death: 2, moveNow: 1.0, moveLater: 1.4, moveCostMult: 1.3, searchScale: 1.0, barricadeBase: 0.07, homeDefend: 0.4, homeDanger: 0.8, killBase: 0.015, sampleKill: 1.3, killThem: 0.1, barricadeOut: 0.25, needMatch: 0.65, frost: 1, maxOut: 9, objWeight: 0.5, foodKeep: 1, haveMatchW: 0.15, boostMin: 0.15, outsider: -5, thReq: 0.9, pickKill: 0.8, stayRounds: 1.5, fuelCost: 0.15, betLazy: 0.15, gunSample: 0.3, wpnSample: 0.4, medW: 0.12, medBase: 0.25, inP: 0.45, laterP: 0.25, cExtra: 0.7, objBarr: 0.25, foodTokenCost: 0.12, coverAt: 0.45, objBase: 1.5, pushScale: 1, betProtect: 1.4, sabBase: 0.2, hoard: 3, woundW: 1.0, pickInf: 25, pickAtk: 0.3, pickSea: 0.45, moraleFear: 0, riskModel: 0, pushGate: 0,
  // crisis reservation / targeting / colony defence
  sampleCS: 0.4, objClose: 2, objFinish: 5, crisisSearch: 1, pivot: 0.5, holdCap: 3, keepMult: 2.5, defBoost: 0, leaveCredit: 0, homeLoad: 0, failZ: 1,
}
/** The live constants of the decision being made (see `useTune`). */
export const TUNE: typeof BASE_TUNE & Record<string, number> = { ...BASE_TUNE }
/** Load a tier's constants (and the bench override) for the decision about to be made. decide() is synchronous, so one decider never sees another's. */
export function useTune(over: Record<string, number> = {}): void {
  Object.assign(TUNE, BASE_TUNE, over, envTune())
}
/** One exposure roll in morale points: a bite kills; a frostbite token adds a wound every turn until healed, so it is nearly as deadly (R p11). */
const expCost = (o: ExposureOdds): number => (o.pDeath + TUNE.frost * o.frostbite + TUNE.woundW * o.wound) * TUNE.death
export interface Patch { entrance: number; z?: number; b?: number }
/** What the open crisis means to this seat right now: how many cards it should hold back, what failing costs, how likely failing is. */
export interface CrisisCtx {
  open: boolean
  needed: number
  cardsIn: number
  /** matching cards in hand the seat is free to contribute (the secret objective's own cards excluded) */
  haveMatch: number
  seatsLeft: number
  /** cards the seat should keep for the pile: its fair share of what is still missing, with some slack */
  keepN: number
  /** cards the seat would like to hold (keepN, but counting cards it does not have yet) */
  wantN: number
  pFail: number
  /** morale-equivalent price of failing (morale, starvation, colony zombies as expected overruns, other effects) */
  failCost: number
  /** zombies a failure adds at the colony */
  colonyZ: number
  /** what one matching card is worth to the pile (morale-equivalent points) */
  holdVal: number
}
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
  private _objNeeds?: ObjNeed[]
  private _crisis?: CrisisCtx
  private _wBase?: Record<ItemSymbol, number>
  /** the survivor a fuel card played now would spare an exposure roll on its move (set while scoring the play) */
  fuelWho: SurvivorId | null = null
  constructor(readonly env: PlanEnv) {}
  get v(): SeatView { return this.env.v }
  food(): ReturnType<typeof query.foodNeeded> { return (this._food ??= query.foodNeeded(this.v)) }
  zombies(): ReturnType<typeof query.zombiesToAdd> { return (this._zombies ??= query.zombiesToAdd(this.v)) }
  objNeeds(): ObjNeed[] { return (this._objNeeds ??= mainObjectiveNeeds(this.v)) }
  /** The main objective's counters are all met and only the colony-phase check is left: now the colony must simply live through the round. */
  finishing(): boolean {
    if (this._fin !== undefined) return this._fin
    let f = false
    if (!this.env.tier.finishing) return (this._fin = false)
    try {
      const r = query.objectiveProgress(this.v)
      f = !this.v.objective.complete && r.parts.length > 0 && r.parts.every((p) => Number.isFinite(p.need) && p.have >= p.need)
    } catch { f = false }
    return (this._fin = f)
  }
  private _fin?: boolean
  /** A betrayer's wish to bring the colony down: 0 early, up to 1 when the game is nearly out of rounds or morale is already thin. */
  push(): number { return this.env.betrayer ? Math.min(1, betrayerPush(this.v, TUNE.pushGate) * TUNE.pushScale) : 0 }
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
    const raw = this.rawCost(id, o)
    return raw * (1 - 0.35 * this.env.scalars.risk) * this.protect() * (1 + TUNE.moraleFear * Math.max(0, 5 - this.v.morale))
  }
  /**
   * One roll's price in morale. Normal: the odds of death, frostbite and wounds weighted by constants. Hard (riskModel): what each face leads to for
   * THIS survivor: a frostbite token ticks a wound every turn until healed (deadly without a medicine card to hand), a wound is cheap on a
   * healthy survivor and expensive on one that already carries one, and the same face on a survivor at two wounds is already counted as a death.
   */
  rawCost(id: SurvivorId, o: ExposureOdds): number {
    if (!TUNE.riskModel) return expCost(o)
    const sv = this.v.survivors[id]
    const w = sv?.wounds ?? 0
    const f = sv?.frostbite ?? 0
    if (w + f >= 2) return o.pDeath * TUNE.death
    const healer = this.v.me.hand.some((c) => symbolsOfCard(this.v, c).includes('medicine')) ? 1 : 0
    const dFrost = Math.min(1, (healer ? 0.35 : 0.8) + 0.15 * (w + f))
    const dWound = (w + f === 0 ? 0.1 : 0.45) * (healer ? 0.6 : 1)
    return (o.pDeath + o.frostbite * dFrost + o.wound * dWound) * TUNE.death
  }
  /** A betrayer keeps its own survivors out of harm: its cards need them standing when the colony falls (serial killers wants two). */
  protect(): number { return this.env.betrayer ? (betrayalKind(this.v) === 'serial-killers' ? TUNE.betProtect * 2 : TUNE.betProtect) : 1 }
  alive(): number { return (this.v.seats[this.env.me]?.survivors ?? []).filter((s) => this.v.survivors[s]?.status === 'alive').length }
  /** Scale on the value of helping the colony: a betrayer near the end stops helping. */
  help(): number { return this.env.betrayer ? Math.max(0.05, 1 - 0.85 * this.push() - (this.v.roundNumber >= 2 ? TUNE.betLazy : 0)) : 1 }
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
  /** The open crisis as this seat sees it (see CrisisCtx); `open` is false once it resolved, when none is showing, and for a betrayer's own purposes it still reads true (callers check `betrayer`). */
  crisis(): CrisisCtx {
    if (this._crisis) return this._crisis
    const v = this.v
    const none: CrisisCtx = { open: false, needed: 0, cardsIn: 0, haveMatch: 0, seatsLeft: 1, keepN: 0, wantN: 0, pFail: 0, failCost: 0, colonyZ: 0, holdVal: 0 }
    const prevent = crisisPrevent(v)
    if (!v.crisis.cardId || v.crisis.result || prevent.length === 0) return (this._crisis = none)
    let q: ReturnType<typeof query.crisis>
    try { q = query.crisis(v) } catch { return (this._crisis = none) }
    const reserved = this.reserved()
    const haveMatch = v.me.hand.filter((x) => !reserved.has(x) && matchesCrisis(v, x)).length
    const order = v.seatOrder.indexOf(this.env.me) < 0 ? [] : rotateFrom(v.seatOrder, v.firstSeat)
    const later = order.slice(order.indexOf(this.env.me) + 1).filter((s) => !v.seats[s]!.seat.exiled && !v.seats[s]!.seat.eliminated && v.seats[s]!.handCount > 0)
    const seatsLeft = 1 + later.length
    const remaining = Math.max(0, q.needed - q.cardsIn)
    const wantN = remaining <= 0 ? 0 : Math.ceil((remaining / seatsLeft) * TUNE.keepMult - 1e-9)
    const keepN = Math.min(haveMatch, wantN)
    const margin = q.cardsIn + haveMatch + 0.75 * later.length - q.needed
    const pFail = Math.max(0.05, Math.min(0.95, 0.5 - 0.3 * margin))
    const prof = this.failProfile()
    const failCost = prof.morale + prof.other + this.colonyFailCost(prof.colonyZ)
    const holdVal = Math.min(TUNE.holdCap, failCost * TUNE.pivot)
    return (this._crisis = { open: true, needed: q.needed, cardsIn: q.cardsIn, haveMatch, seatsLeft, keepN, wantN, pFail, failCost, colonyZ: prof.colonyZ, holdVal })
  }
  /** Reads the crisis card's printed failure effects from the public bundle. */
  private failProfile(): { morale: number; colonyZ: number; other: number } {
    const rec = recOf(this.v, this.v.crisis.cardId)
    let morale = 0
    let colonyZ = 0
    let other = 0
    for (const n of (rec?.['fail'] as Rec[] | undefined) ?? []) {
      switch (n['op']) {
        case 'morale': morale += Math.max(0, -Number(n['value'] ?? 0)); break
        case 'starvation': morale += 0.8 * Number(n['value'] ?? 1); break
        case 'addZombies': {
          const val = Number(n['value'] ?? 1)
          if (n['location'] === 'colony') colonyZ += val * TUNE.failZ
          else other += 0.1 * val
          break
        }
        case 'wound': other += 0.4 * Math.min(4, this.v.seatOrder.length); break
        case 'removeBarricade': other += 0.5; break
        case 'removeCard': other += 0.3; break
        case 'forbid': other += 0.25; break
        default: if (typeof n['code'] === 'string') other += /kill/i.test(String(n['code'])) ? 2.5 : 1; break
      }
    }
    return { morale, colonyZ, other }
  }
  /** Extra expected overruns (in morale points) when `z` more zombies land on the colony board next to the ones already coming. */
  private colonyFailCost(z: number): number {
    if (z <= 0) return 0
    const { ent, cap } = this.board('colony')
    const a0 = this.baseArrivals('colony')
    return Math.max(0, boardCost(ent, cap, a0 + z, 1) - boardCost(ent, cap, a0, 1))
  }
  /** How near the main objective's card counters are to done: progress 0..1 over the cards it still wants, and whether the seat's hand alone completes them. */
  objectiveClose(): { progress: number; finishes: boolean } {
    const needs = this.objNeeds()
    if (needs.length === 0) return { progress: 0, finishes: false }
    let remaining = 0
    let inHand = 0
    for (const n of needs) { remaining += n.remaining; inHand += Math.min(n.remaining, countableInHand(this.v, n).length) }
    let have = 0
    let total = 0
    try { for (const p of query.objectiveProgress(this.v).parts) if (Number.isFinite(p.need) && p.need > 0) { have += Math.min(p.have, p.need); total += p.need } } catch { /* no progress report */ }
    return { progress: total > 0 ? have / total : 0, finishes: remaining > 0 && inHand >= remaining }
  }
  /** A crisis-matching card the seat should not spend elsewhere: the pile is short and this is part of its fair share. Betrayers decide for themselves. */
  holdsForCrisis(cardId: string): boolean {
    if (this.env.betrayer) return false
    const c = this.crisis()
    return c.open && c.keepN > 0 && c.haveMatch <= c.keepN && matchesCrisis(this.v, cardId) && !this.reserved().has(cardId)
  }
  /** What one card is worth to this seat right now, by symbol (morale-equivalent points). With `crisis` false the open crisis is ignored (it is gone by next round). */
  weights(crisis = true): Record<ItemSymbol, number> {
    if (crisis ? this._weights : this._wBase) return (crisis ? this._weights : this._wBase)!
    const v = this.v
    const w: Record<ItemSymbol, number> = { weapon: 0.2, fuel: 0.2, education: 0.18, food: 0.3, medicine: 0.2, tool: 0.2, survivor: 0.25 }
    const f = this.food()
    const ahead = Math.max(0, f.needed * 2 - f.supply)
    w.food += 0.28 * Math.min(4, ahead) + (f.shortfall > 0 ? 0.35 : 0)
    const reserved = this.reserved()
    const haveMatch = v.me.hand.filter((c) => !reserved.has(c) && matchesCrisis(v, c)).length
    if (!this.env.betrayer && v.objective.id === 'obj.main.we-need-more-samples') w.weapon += TUNE.wpnSample
    if (crisis) {
      const cr = this.crisis()
      if (cr.open && !this.env.betrayer) {
        // short of its share of the pile: a matching card is worth a slice of what failing costs; a seat with its share in hand still values one a little
        const val = cr.wantN > haveMatch ? Math.max(TUNE.needMatch, cr.holdVal * TUNE.crisisSearch) : TUNE.haveMatchW
        // a kill objective needs its dice at the colony: the crisis pull on searching is softened there
        const soft = v.objective.id === 'obj.main.we-need-more-samples' ? TUNE.sampleCS : 1
        for (const s of crisisPrevent(v)) w[s] += Math.max(TUNE.haveMatchW, val * soft)
      } else for (const s of crisisPrevent(v)) w[s] += haveMatch >= 1 ? TUNE.haveMatchW : TUNE.needMatch
    }
    for (const s of missingObjectiveSymbols(v)) w[s] += 0.55
    if (this.env.betrayer) {
      // hoard what the betrayal card asks for until it has it (the starting cards do not count): the bigger the gap, the more a search for it is worth
      const needs = betrayalNeeds(v)
      if (needs) {
        for (const [sym, k] of Object.entries(needs.hand) as [ItemSymbol, number][]) {
          const have = countableForBetrayal(v, sym, needs).length
          if (have < k) w[sym] += TUNE.hoard * (0.5 + 0.5 * (k - have) / k)
        }
        if (needs.weapons > weaponsCarried(v) + v.me.hand.filter((c) => symbolsOfCard(v, c).includes('weapon')).length) w.weapon += TUNE.hoard * 1.2
        if (needs.aliveMin > this.alive() || needs.most > 0) w.survivor += TUNE.hoard * 0.5
      }
      for (const n of this.objNeeds()) w[n.symbol] += 0.15 // hoard what the objective needs
    } else for (const n of this.objNeeds()) if (countableInHand(v, n).length < n.remaining) w[n.symbol] += TUNE.objWeight
    const wounds = (v.seats[this.env.me]?.survivors ?? []).reduce((n, id) => n + woundsOn(v, id), 0)
    w.medicine += TUNE.medW * Math.min(4, wounds) + TUNE.medBase
    if (crisis) this._weights = w
    else this._wBase = w
    return w
  }
  /** Expected value of the next card drawn at a location (0 when its deck is empty). */
  searchValue(loc: LocationId, crisis = true): number {
    if (loc === 'colony') return 0
    const o = this.searchOdds(loc)
    if (o.remaining <= 0) return 0
    const w = this.weights(crisis)
    let s = 0
    for (const sym of ALL_SYMBOLS) s += (o.pSymbol[sym] ?? 0) * w[sym]
    return s * TUNE.searchScale
  }
  // ---------- board costs ----------
  /** Zombies the next colony phase puts at `loc` (survivors there, helpless, noise), before any crisis failure. */
  baseArrivals(loc: LocationId, extraSurvivors = 0): number {
    const z = this.zombies()
    const p = z.perLocation.find((x) => x.location === loc)
    const base = loc === 'colony' ? Math.ceil(((p?.survivors ?? 0) + extraSurvivors) / 2) : (p?.survivors ?? 0) + extraSurvivors
    const noise = z.noise.find((x) => x.location === loc)?.expected ?? 0
    return base + Math.round(noise)
  }
  /** baseArrivals, plus the zombies an open crisis adds at the colony when it fails (weighted by how likely that is). */
  arrivals(loc: LocationId, extraSurvivors = 0): number {
    const base = this.baseArrivals(loc, extraSurvivors)
    if (loc !== 'colony' || this.env.betrayer) return base
    const cr = this.crisis()
    return cr.open && cr.colonyZ > 0 ? base + Math.round(cr.pFail * cr.colonyZ) : base
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
  /** Scale on what killing or walling at `loc` is worth: the colony is the only place an overrun costs a survivor and morale together. */
  defW(loc: LocationId): number {
    if (loc !== 'colony' || TUNE.defBoost <= 0 || this.env.betrayer) return 1
    return 1 + TUNE.defBoost * Math.min(1, this.cost('colony') / 1.5)
  }
  cost(loc: LocationId, patch?: Patch | Patch[], extraSurvivors = 0): number {
    const { ent, cap } = this.board(loc, patch)
    const rounds = Math.min(this.env.tier.horizon, Math.max(1, this.v.roundsLeft))
    return boardCost(ent, cap, this.arrivals(loc, extraSurvivors), rounds)
  }
}

const rotateFrom = <T,>(xs: readonly T[], first: T): T[] => { const i = xs.indexOf(first); return i <= 0 ? [...xs] : [...xs.slice(i), ...xs.slice(0, i)] }
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
      const gain = (c.cost(loc) - c.cost(loc, { entrance: a.target.entrance, z: -1 })) * c.defW(loc)
      const d = dieOf(v, me, a.dieId)
      const objBonus = c.finishing() ? 0 : v.objective.id === 'obj.main.we-need-more-samples' ? TUNE.sampleKill : v.objective.id === 'obj.main.kill-them' && loc !== 'colony' ? TUNE.killThem : 0
      const baseline = loc === 'colony' ? TUNE.killBase * (v.locations['colony']!.entrances.reduce((n, e) => n + e.zombies, 0)) : 0
      return (gain + objBonus + baseline) * c.help() - c.exposureCost(a.survivorId) - 0.02 * (d?.value ?? 3)
    }
    case 'barricade': {
      const sv = v.survivors[a.survivorId]
      if (!sv) return -9
      const loc = sv.location
      const gain = (c.cost(loc) - c.cost(loc, { entrance: a.entrance, b: 1 })) * c.defW(loc)
      const d = dieOf(v, me, a.dieId)
      const wall = v.objective.id === 'obj.main.home-sweet-home' || v.objective.id === 'obj.main.stockpile' ? TUNE.objBarr : 0
      const base = (loc === 'colony' ? TUNE.barricadeBase : TUNE.barricadeOut) + (c.env.betrayer ? 0 : wall)
      return gain * c.help() + base - 0.02 * (d?.value ?? 3)
    }
    case 'cleanWaste': {
      const w = v.waste.length
      const d = dieOf(v, me, a.dieId)
      const crosses = Math.floor(w / 10) - Math.floor(Math.max(0, w - 3) / 10)
      const near = w % 10 >= 7 ? 0.35 : 0
      return (crosses * 1.0 + near) * c.help() - 0.02 * (d?.value ?? 3) - 0.03
    }
    case 'search': {
      const sv = v.survivors[a.survivorId]
      if (!sv) return -9
      const val = c.searchValue(sv.location)
      const d = dieOf(v, me, a.dieId)
      return val - 0.02 * (d?.value ?? 3) - 0.01
    }
    case 'playCard': return scorePlay(c, a)
    case 'contributeObjective': return scoreObjective(c, a)
    case 'move': return scoreMove(c, a.survivorId, a.to)
    case 'request': {
      if (!c.env.tier.requests || v.turnCount === c.env.mem.requestTurn) return -1
      const f = c.food()
      const hand = v.me.hand
      const reserved = c.reserved()
      const have = (sym: ItemSymbol) => hand.some((x) => !reserved.has(x) && symbolsOfCard(v, x).includes(sym))
      let base = -1
      if (a.symbol === 'food' && f.shortfall > 0 && !hand.some((x) => foodOf(v, x) > 0)) base = 0.3 + 0.2 * f.shortfall
      else if (c.env.betrayer && betrayalWants(v, a.symbol)) base = TUNE.thReq
      else if (a.symbol === 'medicine' && !have('medicine') && (v.seats[me]?.survivors ?? []).some((s) => woundsOn(v, s) >= 2)) base = 0.2
      if (base < 0) return -1
      const to = a.to
      const target = v.seats[to]
      if (!target || target.seat.exiled || target.handCount === 0) return -1
      return base * (0.6 + 0.4 * scalars.generosity) - 0.3 * c.env.ledger.score(to) + 0.02 * Math.min(5, target.handCount)
    }
    case 'callVote': return scoreCallVote(c, a)
    case 'spendFood': return scoreSpendFood(c, a)
    case 'useAbility': return scoreAbility(c, a)
    case 'attract': return -5
    case 'handOff': return -1
    case 'contributeCrisis': return -1
    default: return -2
  }
}

/** Does the betrayal card still want `symbol` in this seat's hand (or on its survivors, for weapons)? */
function betrayalWants(v: SeatView, symbol: ItemSymbol | undefined): boolean {
  const nd = betrayalNeeds(v)
  if (!nd || !symbol) return false
  if (symbol === 'weapon') return nd.weapons > weaponsCarried(v) + v.me.hand.filter((c) => symbolsOfCard(v, c).includes('weapon')).length
  const k = nd.hand[symbol]
  return !!k && countableForBetrayal(v, symbol, nd).length < k
}
const exiledCount = (v: SeatView): number => v.seatOrder.filter((s) => v.seats[s]!.seat.exiled).length

/** Calling a vote (40 §8.4): the target must be the seat this bot suspects most, above the call threshold, affordable, and the estimated yes votes must reach a majority. */
function scoreCallVote(c: PlanCache, a: Extract<Action, { type: 'callVote' }>): number {
  const { v, me, scalars, tier } = c.env
  if (v.roundNumber < 2 || v.turn?.voteCalled || a.target === me) return -1
  if (c.env.mem.voteRound === v.roundNumber) return -1
  if (tier.ledger !== 'full') return -1
  const top = c.env.ledger.top()
  if (!top || top.seat !== a.target) return -1
  const thetaCall = Math.min(0.97, scalars.callThreshold + tier.callShift) * (exiledCount(v) > 0 ? 1.1 : 1)
  if (top.score < Math.min(0.97, thetaCall)) return -1
  if (!afford(v, a.target)) return -1
  const { yes, needed } = estimateYes(v, me, a.target, top.score, tier.callEstimate)
  if (c.env.betrayer) {
    // only the patient betrayer deflects with a vote, and only while it has cover to spare (the table must be about to agree anyway)
    return tier.betrayer === 'patient' && yes >= needed && c.env.cover() > 1 ? 0.8 : -1
  }
  return yes >= needed ? 2 : -1
}

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
        const objBonus = v.objective.id === 'obj.main.we-need-more-samples' ? TUNE.sampleKill : v.objective.id === 'obj.main.kill-them' && loc !== 'colony' ? TUNE.killThem : 0
        val += (gain * c.defW(loc) + base + objBonus * patches.length) * c.help() - rolls * c.exposureCost(a.survivorId)
        break
      }
      case 'addBarricade': {
        known = true
        const { gain, patches } = c.bestPatches(loc, 'b', count)
        val += gain * c.defW(loc) + (loc === 'colony' ? TUNE.barricadeBase : TUNE.barricadeOut) * patches.length
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
  const cardCost = raw['cost']?.['cards'] as { symbol?: string; count?: number } | undefined
  const spend = cardCost?.symbol ? (cardCost.count ?? 1) * c.weights()[cardCost.symbol as ItemSymbol] : 0
  return val - 0.02 * (die?.value ?? 0) - spend
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

/** The best use of up to `tokens` food on one unused die: a kill at the colony or a search the die cannot make as it shows. */
function bestBoost(c: PlanCache, tokens: number): { net: number; tokens: number } | null {
  const { v, me } = c.env
  if (tokens < 1) return null
  const dice = unusedDice(v, me)
  let best: { net: number; tokens: number } | null = null
  const kill = c.bestPatches('colony', 'z', 1).gain
  const objBonus = v.objective.id === 'obj.main.we-need-more-samples' ? TUNE.sampleKill : 0
  for (const sid of v.seats[me]!.survivors) {
    const sv = v.survivors[sid]
    if (!sv || sv.status !== 'alive') continue
    const atk = sv.location === 'colony' ? c.dieNeed(sid, 'attack') : null
    const sn = sv.location !== 'colony' ? c.dieNeed(sid, 'search') : null
    const killNet = atk !== null ? (kill + objBonus + TUNE.killBase * 3) * c.help() - c.exposureCost(sid) : -1
    const searchNet = sn !== null ? c.searchValue(sv.location) : -1
    for (const d of dice) {
      for (const [need, net] of [[atk, killNet], [sn, searchNet]] as const) {
        if (need === null || d.value >= need) continue
        const delta = need - d.value
        if (delta > tokens || net <= 0) continue
        const n = net - TUNE.foodTokenCost * delta - 0.02 * d.value
        if (!best || n > best.net) best = { net: n, tokens: delta }
      }
    }
  }
  return best
}

/** Food tokens on a die, only from a real surplus, and only when the boosted die unlocks a kill at the colony or a search the die could not make. */
function scoreSpendFood(c: PlanCache, a: Extract<Action, { type: 'spendFood' }>): number {
  const { v, me } = c.env
  if (a.tokens > c.env.tier.foodBoostMax) return -1
  const f = c.food()
  const spare = v.food - f.needed - TUNE.foodKeep
  if (spare < a.tokens || f.shortfall > 0) return -1
  const d = dieOf(v, me, a.dieId)
  if (!d || d.used) return -1
  const reach = d.value + a.tokens
  let best = -1
  for (const sid of v.seats[me]!.survivors) {
    const sv = v.survivors[sid]
    if (!sv || sv.status !== 'alive') continue
    const atk = c.dieNeed(sid, 'attack')
    if (sv.location === 'colony' && atk !== null && d.value < atk && reach >= atk) {
      const { gain } = c.bestPatches('colony', 'z', 1)
      if (gain > 0 || TUNE.killBase > 0) {
        const objBonus = v.objective.id === 'obj.main.we-need-more-samples' ? TUNE.sampleKill : 0
        best = Math.max(best, (gain + objBonus + TUNE.killBase * 3) * c.help() - c.exposureCost(sid))
      }
    }
    const sn = c.dieNeed(sid, 'search')
    if (sv.location !== 'colony' && sn !== null && d.value < sn && reach >= sn) best = Math.max(best, c.searchValue(sv.location) - 0.02 * d.value)
  }
  return best - TUNE.foodTokenCost * a.tokens
}

/** Adding a card under the main objective: free (no die), permanent. Loyal seats do it as soon as the card is not needed more elsewhere; a betrayer hoards. */
function scoreObjective(c: PlanCache, a: Extract<Action, { type: 'contributeObjective' }>): number {
  const { v, mem } = c.env
  if (c.env.betrayer) {
    // cover: a seat the table already suspects shows willing, once a round; otherwise the cards stay in the hoard
    const cover = c.env.selfScore() > TUNE.coverAt && mem.objRound !== v.roundNumber
    return cover ? 0.6 : -2
  }
  if (c.reserved().has(a.cardId)) return -2 // the seat's own secret objective counts this card in hand
  if (v.objective.id === 'obj.main.winter-has-come' && v.me.hand.filter((x) => symbolsOfCard(v, x).includes('fuel')).length <= 1) return -1 // the colony-phase fuel duty draws on this one
  let val = TUNE.objBase
  if (matchesCrisis(v, a.cardId) && !v.crisis.result) {
    const mine = v.me.hand.filter((x) => matchesCrisis(v, x)).length
    const q = crisisNeed(v)
    if (mine <= q || v.morale <= 3) return -1 // the colony needs this card for the crisis first
    if (c.holdsForCrisis(a.cardId)) {
      // weigh the objective against the crisis pile instead of vetoing: progress makes each card worth more, and a hand that finishes the objective wins outright
      const o = c.objectiveClose()
      const gain = val * (1 + TUNE.objClose * o.progress) + (o.finishes ? TUNE.objFinish : 0)
      val = gain - c.crisis().holdVal * (1 - (o.finishes ? 0.7 : 0))
      if (val <= 0) return -1
    }
  }
  if (foodOf(v, a.cardId) > 0 && c.food().shortfall > 0) val -= 0.6 // starving costs morale now
  return val
}
const crisisNeed = (v: SeatView): number => { try { return Math.max(1, Math.ceil(query.crisis(v).needed / Math.max(1, v.seatOrder.length))) } catch { return 1 } }

/** A fuel card played before a move spares that survivor the exposure roll for the turn: worth the roll it saves on the best move it unlocks. */
function scoreFuel(c: PlanCache, cardId: string, haveMatch: number): number {
  const { v, me } = c.env
  if (c.reserved().has(cardId) || (matchesCrisis(v, cardId) && (haveMatch <= 1 || c.holdsForCrisis(cardId))) || c.env.betrayer) return -1
  if (v.objective.id === 'obj.main.winter-has-come' && v.me.hand.filter((x) => symbolsOfCard(v, x).includes('fuel')).length <= 1) return -1
  let best = 0
  let who: SurvivorId | null = null
  for (const sid of v.seats[me]!.survivors) {
    const sv = v.survivors[sid]
    if (!sv || sv.status !== 'alive' || sv.movedThisTurn) continue
    for (const t of c.moveTargets(sid)) {
      const base = scoreMove(c, sid, t.location)
      const term = moveExpo(c, sid, t.location) * (sv.location === 'colony' ? TUNE.moveCostMult : t.location === 'colony' ? 1.1 : 1)
      const gain = Math.max(0, base + term) - Math.max(0, base)
      if (gain > best) { best = gain; who = sid }
    }
  }
  if (who === null) return -1
  c.fuelWho = who
  return best - Math.max(TUNE.fuelCost, c.weights().fuel)
}

function scorePlay(c: PlanCache, a: Extract<Action, { type: 'playCard' }>): number {
  const { v, me } = c.env
  const reserved = c.reserved()
  const f = c.food()
  const food = foodOf(v, a.cardId)
  if (food > 0) {
    const hold = c.holdsForCrisis(a.cardId)
    if (f.shortfall > 0) {
      const covers = food >= f.shortfall
      const loss = f.moraleLossIfShort
      // a food card the crisis wants too: starving costs morale now, failing the crisis costs it later; spend it only when starvation is the bigger bill
      return (covers ? loss * 1.1 : loss * 0.45 * (food / f.shortfall)) * c.help() - (hold ? c.crisis().holdVal : 0)
    }
    if (hold) return -1
    if (v.food - f.needed < f.needed && v.roundsLeft > 1 && !reserved.has(a.cardId)) return 0.06
    // spare food in hand turns into dice: play it when a boosted die would unlock a kill or a search
    if (!reserved.has(a.cardId) && !c.env.betrayer) {
      const spare = Math.max(0, v.food - f.needed - TUNE.foodKeep)
      const b = bestBoost(c, spare + food)
      if (b && b.tokens > spare && b.net > TUNE.boostMin) return b.net - 0.05
    }
    return -1
  }
  const syms = symbolsOfCard(v, a.cardId)
  const haveMatch = v.me.hand.filter((x) => matchesCrisis(v, x)).length
  if (syms.includes('survivor')) {
    // an Outsider joins the seat at the colony: one more body and die; the later ones also bring helpless mouths
    const helpless = (defOfCard(v, a.cardId)?.['play']?.['effect'] as Rec[] | undefined)?.filter((n) => n['op'] === 'addHelpless').reduce((n, x) => n + (typeof x['count'] === 'number' ? (x['count'] as number) : 1), 0) ?? 0
    if (c.env.betrayer) { const nd = betrayalNeeds(v); return nd && (nd.most > 0 || nd.aliveMin > c.alive()) ? 1.5 : -1 }
    if (v.roundsLeft <= 1 || c.food().shortfall > 0) return -1
    return TUNE.outsider - 0.15 * helpless // Normal leaves them in hand: the extra mouths cost more than the die brings (bench)
  }
  if (syms.includes('fuel') && !isEquipCard(v, a.cardId) && !a.equipTo) return scoreFuel(c, a.cardId, haveMatch)
  if (syms.includes('medicine') && !isEquipCard(v, a.cardId)) {
    const mineIds = (v.seats[me]?.survivors ?? []).filter((s) => v.survivors[s]?.status === 'alive')
    const worst = Math.max(0, ...mineIds.map((s) => woundsOn(v, s)))
    const frost = mineIds.some((s) => (v.survivors[s]?.frostbite ?? 0) > 0)
    if (worst < 1) return -1
    if (matchesCrisis(v, a.cardId) && (haveMatch <= 1 || c.holdsForCrisis(a.cardId)) && !frost) return -1
    return (frost ? 0.6 * TUNE.death : 0.1 + 0.2 * Math.min(2, worst)) - (reserved.has(a.cardId) ? 5 : 0) - (c.holdsForCrisis(a.cardId) ? c.crisis().holdVal : 0)
  }
  if (isEquipCard(v, a.cardId) && a.equipTo) {
    if (reserved.has(a.cardId) || (matchesCrisis(v, a.cardId) && (haveMatch <= 1 || c.holdsForCrisis(a.cardId)))) return -1
    const st = statsOf(v, a.equipTo)
    const at = v.survivors[a.equipTo]?.location === 'colony' ? 0.02 : 0
    const nd = c.env.betrayer ? betrayalNeeds(v) : null
    const trig = nd && syms.includes('weapon') && (nd.weapons > weaponsCarried(v) || nd.weaponsEach > 0) ? 0.7 : 0
    const samplesGun = !c.env.betrayer && v.objective.id === 'obj.main.we-need-more-samples' && equipValue(v, a.cardId) >= 0.5 ? TUNE.gunSample * Math.min(3, v.roundsLeft) : 0
    const arm = !c.env.betrayer && v.objective.id === 'obj.main.leave-it-all-behind' && syms.includes('weapon') ? 0.6 : 0
    return equipValue(v, a.cardId) + 0.01 * (6 - st.attack) + at + trig + arm + samplesGun
  }
  return -1
}

/** The exposure price of a move, as scoreMove charges it (a fuel card played first wipes it out). */
function moveExpo(c: PlanCache, survivorId: SurvivorId, to: LocationId): number {
  const o = c.moveTargets(survivorId).find((t) => t.location === to)?.exposure
  return (o ? c.rawCost(survivorId, o) * (1 - 0.35 * c.env.scalars.risk) : 0.25) * c.protect()
}
/** What a survivor's colony-only kill ability is worth over the rounds left, lost the moment it leaves (Thomas Heart, Edward White). */
export function stayValue(c: PlanCache, survivorId: SurvivorId): number {
  const { v } = c.env
  const ab = recOf(v, survivorId)?.['ability'] as Rec | undefined
  if (!ab || ab['location'] !== 'colony') return 0
  let kills = 0
  for (const n of (ab['effect'] as Rec[] | undefined) ?? []) if (n['op'] === 'killZombies') kills += typeof n['count'] === 'number' ? (n['count'] as number) : 1
  if (kills === 0) return 0
  const per = (v.objective.id === 'obj.main.we-need-more-samples' ? TUNE.sampleKill : 0.3) * kills * (ab['limit'] === 'oncePerRound' ? 1 : 0.5)
  return per * TUNE.stayRounds * Math.min(3, Math.max(1, v.roundsLeft)) / 3
}
function scoreMove(c: PlanCache, survivorId: SurvivorId, to: LocationId): number {
  const { v, me } = c.env
  const sv = v.survivors[survivorId]
  if (!sv) return -9
  const from = sv.location
  const expo = moveExpo(c, survivorId, to)
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
    // the crisis showing now is gone next round: what a deck is worth later is judged without it
    const svalLater = c.searchValue(to, false)
    const baselineLater = from !== 'colony' ? c.searchValue(from, false) : 0
    const need = c.dieNeed(survivorId, 'search')
    const dice = unusedDice(v, me)
    const usable = need === null ? dice.length : dice.filter((d) => d.value >= need).length
    const now = TUNE.moveNow * (sval - baseline) * Math.min(usable, 2)
    const later = (svalLater - baselineLater) * (v.roundsLeft > 2 ? TUNE.moveLater : v.roundsLeft > 1 ? TUNE.moveLater / 2 : 0)
    const extra = c.cost(to, undefined, 1) - c.cost(to)
    let cost = expo * (from === 'colony' ? TUNE.moveCostMult : 1) + extra * 1.2
    if (from === 'colony' && homeOthers === 0 && colonyCost > 0.25) cost += colonyCost * 0.7
    if (from === 'colony' && v.seats[me]!.survivors.length >= 1 && colonyCost > 0.8) cost += 0.3
    const foodCredit = from === 'colony' && c.food().shortfall > 0 ? 0.12 : 0
    if (from === 'colony') cost += stayValue(c, survivorId)
    // one body fewer at the colony: fewer zombies next colony phase (ceil(survivors / 2))
    const relief = from === 'colony' && homeOthers > 0 ? TUNE.leaveCredit * Math.max(0, colonyCost - c.cost('colony', undefined, -1)) : 0
    return now + later + foodCredit + relief - cost - 0.02
  }
  // coming home
  const originCost = c.cost(from, undefined, 0) - c.cost(from, undefined, -1)
  const danger = originCost > 0.5 ? originCost * TUNE.homeDanger : 0
  const defend = colonyCost > 0.9 ? Math.min(1.5, colonyCost) * TUNE.homeDefend : 0
  // one more body at the colony adds a zombie to the next colony phase every second survivor
  const load = TUNE.homeLoad * Math.max(0, c.cost('colony', undefined, 1) - colonyCost)
  return danger + defend - load - expo * 1.1 - 0.1
}

/** Pick the best-scoring legal turn action; ties and near-ties are broken by the seeded rand. */
export function planTurn(c: PlanCache, legal: Action[]): Action {
  const { v, me } = c.env
  const end = legal.find((a) => a.type === 'endTurn')
  if ((v.turn?.actions ?? 0) >= 30 && end) return end
  // adding to the objective costs no die and nothing else depends on it: do it before anything that could change the plan
  let free: Action | null = null
  let freeScore = 0
  for (const a of legal) if (a.type === 'contributeObjective') { const s = scoreObjective(c, a); if (s > freeScore) { freeScore = s; free = a } }
  if (free) return free
  let best: Action | null = null
  let bestScore = -Infinity
  let n = 0
  for (const a of legal) {
    if (a.type === 'contributeCrisis' || a.type === 'attract' || a.type === 'handOff') continue
    if ((n++ & 15) === 15 && c.env.expired()) break
    let s = scoreTurnAction(c, a)
    if (c.env.tier.noise > 0 && s > -5) s *= 1 + c.env.tier.noise * (c.env.rand() + c.env.rand() + c.env.rand() - 1.5) * 2
    s += 0.002 * c.env.rand()
    if (s > bestScore) { bestScore = s; best = a }
  }
  // a fuel card played before the move spares that survivor the exposure roll: play it first when the move is the plan
  if (best && best.type === 'move' && !c.env.betrayer) {
    const term = moveExpo(c, best.survivorId, best.to) * (v.survivors[best.survivorId]?.location === 'colony' ? TUNE.moveCostMult : 1)
    if (term > TUNE.fuelCost + 0.03) {
      for (const a of legal) {
        if (a.type !== 'playCard' || a.equipTo || !symbolsOfCard(v, a.cardId).includes('fuel') || isEquipCard(v, a.cardId)) continue
        const haveMatch = v.me.hand.filter((x) => matchesCrisis(v, x)).length
        if (scoreFuel(c, a.cardId, haveMatch) <= -1) continue
        c.fuelWho = best.survivorId
        return a
      }
    }
  }
  return best ?? end ?? legal[0]!
}
