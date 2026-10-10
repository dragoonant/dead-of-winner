// The card-effects interpreter (spec 21): conditions, effect nodes, scopes, durations, triggers, once-per-round uses.
// Pure: state in, state + events out. Suspends on a choice by storing the rest of the work in `pending.context.data.cont`
// (JSON), so the pending decision is the only place a half-finished effect lives (00 §2: pure reducer, one pending).
//
// INTEGRATION CONTRACT (for phases/step owners):
//  - Every handler returns `ActionResult`. `pending` is set only when this module raised a NEW decision (itemTarget,
//    effectChoice, crossroadsOption, requestResponse, votes, newLeader); then `state.pending` is already that decision.
//    When `pending` is undefined the caller raises its own next decision (turnAction, etc.).
//  - After any resolved action the caller (or the handler itself, for the actions owned here) runs `afterAction`
//    (crossroads.ts) so generic triggers and the held Crossroads card see the action window (FAQ 2.1.1).
//  - `isEffectPending(state)` tells step() that `state.pending` belongs to this module; route the answer to
//    `resumeEffects` (effectChoice / itemTarget / objectiveChoice / castVotes of an effect vote).
//  - The three generic routines the spec gives to other modules (kill a survivor, add zombies, exposure with the bite
//    chain) plus a few siblings are called through `routines`; the defaults here are minimal stand-ins so this module
//    works alone. The owning modules call `setRoutines({...})` at load.
import type {
  Action, ChooseCrossroadsOptionAction, EffectChoiceAction, ItemTargetAction, ObjectiveChoiceAction,
} from './actions'
import type { GameEvent } from './events'
import { WINDOW_IDS } from './types'
import type {
  CardEffectDescriptor, CodeConditionHook, ConditionNode, CrisisDescriptor, CrossroadsDescriptor, EffectNode, HookContext, HookPoint,
  HookResult, ScopeNode,
} from './hooks'
import { nextFloat, roll, shuffle } from './rng'
import type {
  CardId, DecisionContext, DecisionOption, EffectDuration, EffectExpiry, EffectInstance, ExposureFace, ExposureReason, GameEndReason,
  GameState, Id, ItemSymbol, KillCause, LocationId, MoraleReason, PendingDecision, Rejection, RejectionCode, SeatId, SurvivorId,
  SurvivorState, WindowId, WoundKind, ZombieSource,
} from './types'
import { bundleFor } from './bundles'
import { CODE_HOOKS } from './code-hooks'
import { checkCrossroads } from './crossroads'
import { addWoundInto, rollExposureFor as realRollExposure, setServices, svc as exposureServices } from './exposure'
import { addSurvivorFromDeck as realAddSurvivor, removeSurvivor as realRemoveSurvivor } from './survivors'
import { addZombies as realAddZombies } from './zombies'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Rec = any // a data record (spec 20); shapes are checked by tools/validate-data.ts, not here

// ---------- results ----------
export interface ActionResult { state: GameState; events: GameEvent[]; rejection?: Rejection; pending?: PendingDecision }
export const reject = (state: GameState, code: RejectionCode, message: string, detail?: Record<string, unknown>): ActionResult => ({
  state, events: [], rejection: { code, message, ...(detail ? { detail } : {}) },
})

/** Mutable accumulator used inside one handler call; handlers return `{state, events}` from it. */
export interface Acc { state: GameState; events: GameEvent[]; pending?: PendingDecision }
export const mkAcc = (state: GameState): Acc => ({ state, events: [] })

// ---------- run context (serialisable: it travels inside a pending decision) ----------
export interface RunCtx {
  sourceId: Id
  sourceKind: EffectInstance['sourceKind']
  seat: SeatId // acting seat: the owner for owned sources, else the active seat
  ownerSeat?: SeatId
  survivorId?: SurvivorId // the holder (ability's survivor, bearer)
  subjectId?: SurvivorId // the survivor the window names (wound.taken, survivor.killed...) when it is not the holder
  targetId?: SurvivorId
  location?: LocationId
  cardId?: Id
  dieId?: string
  face?: ExposureFace
  params?: Record<string, unknown>
  point: HookPoint
  abilityId?: Id
  duration?: EffectDuration
  itemPlay?: boolean // chosen scopes raise itemTarget instead of effectChoice
  revealed?: CardId[] // the revealDeck buffer (public until the list ends)
  revealedAt?: LocationId
  countsAs?: string
}
export interface WindowCtx {
  seat?: SeatId; survivorId?: SurvivorId; targetId?: SurvivorId; location?: LocationId; cardId?: Id; dieId?: string; face?: ExposureFace
  params?: Record<string, unknown>
}
interface Work { node: EffectNode; idx: number; answers: string[] }
export type Job =
  | { t: 'run'; work: Work[]; rc: RunCtx; later?: Job[] }
  | { t: 'fire'; desc: CardEffectDescriptor; rc: RunCtx; answers: string[]; activated?: boolean }
  | { t: 'window'; point: WindowId; ctx: WindowCtx }
  | { t: 'crossroads'; point: WindowId; ctx: WindowCtx }

// ---------- pluggable routines (00 §8) ----------
export interface Routines {
  killSurvivor(state: GameState, survivorId: SurvivorId, cause: KillCause): { state: GameState; events: GameEvent[]; pending?: PendingDecision }
  removeSurvivor(state: GameState, survivorId: SurvivorId, sourceId: Id): { state: GameState; events: GameEvent[]; pending?: PendingDecision }
  addZombies(state: GameState, location: LocationId, count: number, source: ZombieSource): { state: GameState; events: GameEvent[]; pending?: PendingDecision }
  rollExposureFor(state: GameState, survivorId: SurvivorId, reason: ExposureReason): { state: GameState; events: GameEvent[]; pending?: PendingDecision }
  addSurvivor(state: GameState, seat: SeatId, source: 'item' | 'crossroads' | 'crisis' | 'ability', location?: LocationId): { state: GameState; events: GameEvent[]; pending?: PendingDecision }
  endGame(state: GameState, reason: GameEndReason): { state: GameState; events: GameEvent[]; pending?: PendingDecision }
  exileSeat(state: GameState, seat: SeatId): { state: GameState; events: GameEvent[]; pending?: PendingDecision }
}
export const routines: Routines = {
  // the real routines live in survivors.ts / zombies.ts / exposure.ts (00 §8); this module only calls them
  killSurvivor: (s, id, c) => exposureServices().killSurvivor(s, id, c),
  removeSurvivor: (s, id, src) => { const r = realRemoveSurvivor(s, id, src); return { state: r.state, events: r.events, ...(r.pending ?? r.decision ? { pending: (r.pending ?? r.decision)! } : {}) } },
  addZombies: (s, l, n, src) => realAddZombies(s, l, n, src),
  rollExposureFor: (s, id, r) => realRollExposure(s, id, r),
  addSurvivor: (s, seat, src, loc) => { const r = realAddSurvivor(s, seat, src, loc ?? 'colony'); return { state: r.state, events: r.events } },
  endGame: (s, r) => defaultEndGame(s, r),
  exileSeat: (s, seat) => defaultExile(s, seat),
}
export function setRoutines(p: Partial<Routines>): void { Object.assign(routines, p) }

// ---------- small state helpers ----------
const emit = (acc: Acc, ...evs: GameEvent[]): void => { acc.events.push(...evs) }
const patch = (acc: Acc, p: Partial<GameState>): void => { acc.state = { ...acc.state, ...p } }
export const setSurvivor = (acc: Acc, id: SurvivorId, p: Partial<SurvivorState>): void => {
  acc.state = { ...acc.state, survivors: { ...acc.state.survivors, [id]: { ...acc.state.survivors[id]!, ...p } } }
}
const setSeat = (acc: Acc, id: SeatId, p: Partial<GameState['seats'][string]>): void => {
  acc.state = { ...acc.state, seats: { ...acc.state.seats, [id]: { ...acc.state.seats[id]!, ...p } } }
}
const setLoc = (acc: Acc, id: LocationId, p: Partial<GameState['locations'][string]>): void => {
  acc.state = { ...acc.state, locations: { ...acc.state.locations, [id]: { ...acc.state.locations[id]!, ...p } } }
}
export const recOf = (state: GameState, id: Id | undefined): Rec | undefined => (id ? bundleFor(state).byId[id] : undefined)
export const defOf = (state: GameState, cardId: CardId): Rec | undefined => {
  const inst = state.cards[cardId]
  return inst ? recOf(state, inst.defId) : undefined
}
export const symbolsOf = (def: Rec | undefined): ItemSymbol[] => (def ? (def.symbols ?? (def.symbol ? [def.symbol] : [])) : [])
export const aliveSurvivors = (state: GameState): SurvivorState[] => Object.values(state.survivors).filter((s) => s.status === 'alive')
export const survivorsAt = (state: GameState, loc: LocationId): SurvivorState[] => aliveSurvivors(state).filter((s) => s.location === loc)
export const influenceOf = (state: GameState, id: SurvivorId): number => recOf(state, id)?.stats?.influence ?? 0
export const zombiesAt = (state: GameState, loc: LocationId): number => state.locations[loc]?.entrances.reduce((a, e) => a + e.zombies, 0) ?? 0
export const activeSeats = (state: GameState): SeatId[] => state.seatOrder.filter((s) => !state.seats[s]!.seat.eliminated)
export const nonExiledSeats = (state: GameState): SeatId[] => state.seatOrder.filter((s) => !state.seats[s]!.seat.eliminated && !state.seats[s]!.seat.exiled)
/** Survivor spaces in use at a location: alive survivors plus helpless tokens (they sit on spaces, R11.3). */
export const spacesUsed = (state: GameState, loc: LocationId): number => survivorsAt(state, loc).length + (state.locations[loc]?.helpless ?? 0)
export const hasSpace = (state: GameState, loc: LocationId): boolean => spacesUsed(state, loc) < (state.locations[loc]?.capacity.survivors ?? 0)
const isWindow = (p: string): p is WindowId => (WINDOW_IDS as readonly string[]).includes(p)
const purposeOf = (k: EffectInstance['sourceKind']) =>
  k === 'item' ? 'item' as const : k === 'survivor' ? 'ability' as const : k === 'crisis' ? 'crisis' as const : k === 'crossroads' ? 'crossroads' as const
    : k === 'rule' ? 'other' as const : 'objective' as const
const moraleReasonOf = (k: EffectInstance['sourceKind']): MoraleReason =>
  k === 'item' ? 'item' : k === 'survivor' ? 'ability' : k === 'crisis' ? 'crisis' : k === 'crossroads' ? 'crossroads' : 'objective'
const zombieSourceOf = (k: EffectInstance['sourceKind']): ZombieSource =>
  k === 'item' ? 'item' : k === 'crisis' ? 'crisis' : k === 'crossroads' ? 'crossroads' : k === 'survivor' ? 'item' : 'objective'
const killCauseOf = (k: EffectInstance['sourceKind']): KillCause =>
  k === 'item' ? 'item' : k === 'survivor' ? 'ability' : k === 'crisis' ? 'crisis' : k === 'crossroads' ? 'crossroads' : 'objective'
const woundSourceOf = (k: EffectInstance['sourceKind']) =>
  (k === 'item' ? 'item' : k === 'survivor' ? 'ability' : k === 'crisis' ? 'crisis' : k === 'crossroads' ? 'crossroads' : 'objective') as 'item' | 'ability' | 'crisis' | 'crossroads' | 'objective'
const foodReasonOf = (k: EffectInstance['sourceKind']) =>
  (k === 'item' ? 'card' : k === 'survivor' ? 'ability' : k === 'crisis' ? 'crisis' : k === 'crossroads' ? 'crossroads' : 'card') as 'card' | 'ability' | 'crisis' | 'crossroads'

/** d6 for effects; advances the seeded stream and emits DiceRolled. */
function rollD6(acc: Acc, rc: RunCtx): number {
  const r = roll(acc.state, { count: 1, purpose: purposeOf(rc.sourceKind), seat: rc.seat })
  acc.state = r.state
  emit(acc, r.event)
  return r.event.dice[0]!
}
function randomIndex(acc: Acc, n: number): number {
  const [f, rng] = nextFloat(acc.state.rng)
  acc.state = { ...acc.state, rng }
  return Math.min(n - 1, Math.floor(f * n))
}

// ---------- morale / food / tracks ----------
export function changeMorale(acc: Acc, delta: number, reason: MoraleReason, sourceId?: Id): void {
  if (delta === 0) return
  const after = Math.max(0, Math.min(10, acc.state.morale + delta))
  const actual = after - acc.state.morale
  if (actual === 0) return
  patch(acc, { morale: after })
  emit(acc, { type: 'MoraleChanged', delta: actual, after, reason, ...(sourceId ? { sourceId } : {}) })
  if (after === 0 && acc.state.phase !== 'ended') {
    const r = routines.endGame(acc.state, 'moraleZero')
    acc.state = r.state; emit(acc, ...r.events)
  }
}
export function changeFood(acc: Acc, delta: number, reason: 'card' | 'ability' | 'crisis' | 'crossroads' | 'setup' | 'pay' | 'spendOnDie'): void {
  const after = Math.max(0, acc.state.food + delta)
  const actual = after - acc.state.food
  if (actual === 0) return
  patch(acc, { food: after })
  emit(acc, { type: 'FoodChanged', delta: actual, after, reason })
}

// ---------- descriptors compiled from data (21 §9) ----------
const KIND_PREFIX: Record<string, string> = { sv: 'survivor', it: 'item', cr: 'crisis', xr: 'crossroads', obj: 'objective' }
/** `effectChoice` code for a source: "survivor.forest-plum.lastGift" (R4.4). */
export function codeFor(sourceId: Id, abilityId?: Id): string {
  const [p, ...rest] = sourceId.split('.')
  const slug = rest.join('.')
  return `${KIND_PREFIX[p!] ?? p}.${slug}${abilityId ? `.${abilityId}` : ''}`
}

function abilityDescriptor(def: Rec, base: Pick<CardEffectDescriptor, 'sourceId' | 'source'> & Partial<CardEffectDescriptor>): CardEffectDescriptor {
  const point: HookPoint = def.kind === 'passive' ? 'passive' : def.kind === 'action' ? 'action' : (def.trigger as HookPoint)
  return {
    ...base,
    abilityId: def.id,
    countsAs: def.countsAs,
    point,
    when: def.when,
    effect: def.effect ?? [],
    scope: def.scope ?? { who: 'self' },
    duration: def.duration ?? (def.kind === 'passive' ? 'game' : 'instant'),
    optional: !!def.optional,
    limit: def.limit,
    cost: def.cost,
    location: def.location ?? 'anywhere',
  }
}

function locationOk(sv: SurvivorState, loc: CardEffectDescriptor['location']): boolean {
  if (!loc || loc === 'anywhere') return true
  if (loc === 'colony') return sv.location === 'colony'
  if (loc === 'nonColony') return sv.location !== 'colony'
  return sv.location === loc
}

const usableOwner = (state: GameState, owner: SeatId | null): owner is SeatId => !!owner && !!state.seats[owner] && !state.seats[owner]!.seat.eliminated

function survivorOwnDescriptors(state: GameState, sv: SurvivorState): CardEffectDescriptor[] {
  const out: CardEffectDescriptor[] = []
  const rec = recOf(state, sv.id)
  const ab = rec?.ability
  if (ab && !ab.unknown) {
    out.push(abilityDescriptor(ab, { sourceId: sv.id, source: 'survivor', ownerSeat: sv.owner!, survivorId: sv.id }))
  }
  for (const cardId of sv.equipped) {
    const def = defOf(state, cardId)
    for (const a of def?.equipped ?? []) {
      out.push(abilityDescriptor(a, { sourceId: def.id, source: 'item', ownerSeat: sv.owner!, survivorId: sv.id, cardInstanceId: cardId }))
    }
  }
  return out
}
const copiesAbilities = (d: CardEffectDescriptor): boolean =>
  d.point === 'passive' && d.effect.some((n) => 'op' in n && n.op === 'grant' && n.what === 'copyAbilitiesAtLocation')

/** Descriptors of one survivor, copies included (John Price, F 1.1.1). */
function descriptorsOfSurvivor(state: GameState, sv: SurvivorState): CardEffectDescriptor[] {
  if (sv.status !== 'alive' || !usableOwner(state, sv.owner)) return []
  const own = survivorOwnDescriptors(state, sv).filter((d) => locationOk(sv, d.location))
  const out = [...own]
  if (own.some(copiesAbilities)) {
    for (const other of survivorsAt(state, sv.location)) {
      if (other.id === sv.id) continue
      for (const d of survivorOwnDescriptors(state, other)) {
        if (d.source === 'survivor' && !locationOk(sv, d.location)) continue
        if (d.source === 'item') continue
        if (copiesAbilities(d)) continue
        out.push({ ...d, ownerSeat: sv.owner!, survivorId: sv.id, abilityId: d.abilityId })
      }
    }
  }
  return out
}

function objectiveDescriptors(state: GameState): CardEffectDescriptor[] {
  const out: CardEffectDescriptor[] = []
  const main = recOf(state, state.objective.id)
  const side = main?.sides?.[state.objective.side]
  for (const t of side?.triggers ?? []) {
    out.push({
      sourceId: main.id, source: 'objective', abilityId: t.id, point: t.trigger, when: t.when, effect: t.effect, scope: t.scope ?? { who: 'activeSeat' },
      duration: 'instant', optional: !!t.optional, limit: t.limit,
    })
  }
  for (const seatId of state.seatOrder) {
    const st = state.seats[seatId]!
    for (const [objId, kind] of [[st.secretObjectiveId, 'secretObjective'], [st.exiledObjectiveId, 'exiledObjective']] as const) {
      const rec = recOf(state, objId ?? undefined)
      for (const t of rec?.triggers ?? []) {
        out.push({
          sourceId: rec.id, source: kind, abilityId: t.id, ownerSeat: seatId, point: t.trigger, when: t.when, effect: t.effect,
          scope: t.scope ?? { who: 'seat' }, duration: 'instant', optional: !!t.optional, limit: t.limit,
        })
      }
    }
  }
  return out
}

/** Every descriptor bound to `point`, in resolution order: rule effects, then the active seat's sources, then the other seats clockwise (21 §1). */
export function collectTriggers(state: GameState, point: HookPoint, subject?: { seat?: SeatId; survivorId?: SurvivorId; location?: LocationId }): CardEffectDescriptor[] {
  const start = state.activeSeat ? Math.max(0, state.seatOrder.indexOf(state.activeSeat)) : 0
  const order = state.seatOrder.map((_, i) => state.seatOrder[(start + i) % state.seatOrder.length]!)
  const out: CardEffectDescriptor[] = objectiveDescriptors(state).filter((d) => d.point === point)
  for (const seat of order) {
    const st = state.seats[seat]
    if (!st) continue
    for (const sid of st.survivors) {
      const sv = state.survivors[sid]
      if (!sv) continue
      for (const d of descriptorsOfSurvivor(state, sv)) if (d.point === point) out.push(d)
    }
  }
  return out.filter((d) => {
    if (subject?.seat && d.ownerSeat && d.ownerSeat !== subject.seat) return false
    if (subject?.survivorId && d.survivorId && d.survivorId !== subject.survivorId) return false
    if (subject?.location) { const sv = d.survivorId ? state.survivors[d.survivorId] : undefined; if (sv && sv.location !== subject.location) return false }
    return true
  })
}

/** Find an ability descriptor (survivor ability or equipped item) for `useAbility` and item uses. */
export function findDescriptor(state: GameState, survivorId: SurvivorId, abilityId: Id): CardEffectDescriptor | undefined {
  const sv = state.survivors[survivorId]
  if (!sv) return undefined
  return descriptorsOfSurvivor(state, sv).find((d) => d.abilityId === abilityId)
}

/** An item's `play` block as a descriptor (point 'action'); `self` = the bearer picked at play time. */
export function playDescriptor(state: GameState, cardId: CardId, seat: SeatId, survivorId?: SurvivorId): CardEffectDescriptor | null {
  const def = defOf(state, cardId)
  if (!def?.play) return null
  return {
    sourceId: def.id, source: 'item', ownerSeat: seat, survivorId, cardInstanceId: cardId, point: 'action', when: def.play.when,
    effect: def.play.effect ?? [], scope: { who: 'self' }, duration: 'instant', optional: false, cost: def.play.cost, countsAs: def.play.countsAs,
  }
}

export function crossroadsDescriptor(state: GameState, id: Id): CrossroadsDescriptor | null {
  const rec = recOf(state, id)
  if (!rec) return null
  return {
    id, point: rec.trigger?.point, when: rec.trigger?.when,
    options: (rec.options ?? []).map((o: Rec) => ({ id: o.id, effect: o.effect, requires: o.requires, vote: o.vote })),
    mature: rec.mature,
  }
}
export function crisisDescriptor(state: GameState, id: Id): CrisisDescriptor | null {
  const rec = recOf(state, id)
  return rec ? { id, prevent: rec.prevent ?? [], fail: rec.fail ?? [], bonus: rec.bonus } : null
}

// ---------- conditions (21 §3) ----------
export interface EvalCtx extends HookContext { holderId?: SurvivorId; ownerSeat?: SeatId }

function survivorFor(ctx: EvalCtx, subject: string | undefined): SurvivorState | undefined {
  const dflt = ctx.holderId ? 'self' : 'survivor'
  const s = subject ?? dflt
  const id = s === 'self' ? (ctx.holderId ?? ctx.survivorId) : s === 'target' ? ctx.targetId : (ctx.survivorId ?? ctx.holderId)
  return id ? ctx.state.survivors[id] : undefined
}
function seatFor(ctx: EvalCtx, subject: string | undefined): SeatId | undefined {
  if (subject === 'activeSeat') return ctx.state.activeSeat ?? undefined
  if (subject === 'holder') return ctx.ownerSeat ?? ctx.seat
  return ctx.seat
}
function locationFor(ctx: EvalCtx, node: { location?: LocationId }): LocationId | undefined {
  if (node.location) return node.location
  if (ctx.location) return ctx.location
  const sv = ctx.holderId ? ctx.state.survivors[ctx.holderId] : ctx.survivorId ? ctx.state.survivors[ctx.survivorId] : undefined
  return sv?.location
}
const cmp = (op: 'ge' | 'le', a: number, b: unknown): boolean => (op === 'ge' ? a >= Number(b) : a <= Number(b))
const total = (s: SurvivorState): number => s.wounds + s.frostbite

export function evaluateCondition(ctx: HookContext, node: ConditionNode | undefined): boolean {
  if (!node) return true
  const c = ctx as EvalCtx
  if ('all' in node) return node.all.every((n) => evaluateCondition(c, n))
  if ('any' in node) return node.any.some((n) => evaluateCondition(c, n))
  if ('not' in node) return !evaluateCondition(c, node.not)
  if ('code' in node) {
    const fn: CodeConditionHook | undefined = CODE_HOOKS.conditions[node.code]
    return fn ? fn(c, node.params ?? {}) : false
  }
  const st = c.state
  const sv = () => survivorFor(c, node.subject)
  const loc = () => locationFor(c, node)
  const v = node.value
  switch (node.test) {
    case 'atLocation': return !!sv() && sv()!.location === (node.location ?? c.location ?? v)
    case 'isColony': return loc() === 'colony'
    case 'isNonColony': return !!loc() && loc() !== 'colony'
    case 'locationIs': return loc() === (node.location ?? v)
    case 'survivorIs': return sv()?.id === v
    case 'survivorOwnedBy': {
      const o = sv()?.owner
      return v === 'holder' ? o === (c.ownerSeat ?? c.seat) : v === 'activeSeat' ? o === st.activeSeat : !!o && o !== (c.ownerSeat ?? c.seat)
    }
    case 'survivorHasKeyword': return !!sv() && (recOf(st, sv()!.id)?.tags ?? []).includes(v)
    case 'woundsAtLeast': return !!sv() && total(sv()!) >= Number(v)
    case 'woundsAtMost': return !!sv() && total(sv()!) <= Number(v)
    case 'hasFrostbite': return !!sv() && sv()!.frostbite >= 1
    case 'hasEquipped': {
      const s = sv(); if (!s) return false
      return s.equipped.some((cid) => {
        const d = defOf(st, cid)
        return (!v || d?.id === v) && (!node.symbol || symbolsOf(d).includes(node.symbol))
      })
    }
    case 'equippedAtLeast': return !!sv() && sv()!.equipped.length >= Number(v)
    case 'influenceAtLeast': return !!sv() && cmp('ge', influenceOf(st, sv()!.id), v)
    case 'influenceAtMost': return !!sv() && cmp('le', influenceOf(st, sv()!.id), v)
    case 'exposureFace': return c.face === node.face
    case 'exposureReason': return c.params?.reason === v
    case 'woundKind': return c.params?.kind === v
    case 'movedThisTurn': return !!sv() && sv()!.movedThisTurn
    case 'actionWas': return (c.params?.action ?? c.point.replace(/^action\./, '')) === v
    case 'symbolDrawn': case 'cardKeptHasSymbol': return !!c.cardId && symbolsOf(defOf(st, c.cardId)).includes(node.symbol!)
    case 'handAtLeast': return cmp('ge', st.seats[seatFor(c, node.subject)!]?.hand.length ?? 0, v)
    case 'handAtMost': return cmp('le', st.seats[seatFor(c, node.subject)!]?.hand.length ?? 0, v)
    case 'handHasSymbol': {
      const hand = st.seats[seatFor(c, node.subject)!]?.hand ?? []
      return hand.filter((cid) => symbolsOf(defOf(st, cid)).includes(node.symbol!)).length >= Number(v ?? 1)
    }
    case 'foodAtLeast': return cmp('ge', st.food, v)
    case 'foodAtMost': return cmp('le', st.food, v)
    case 'moraleAtLeast': return cmp('ge', st.morale, v)
    case 'moraleAtMost': return cmp('le', st.morale, v)
    case 'roundsLeftAtMost': return cmp('le', st.roundsLeft, v)
    case 'roundsLeftAtLeast': return cmp('ge', st.roundsLeft, v)
    case 'starvationAtLeast': return cmp('ge', st.starvation, v)
    case 'wasteAtLeast': return cmp('ge', st.waste.length, v)
    case 'zombiesAtLeast': return cmp('ge', zombiesAt(st, loc()!), v)
    case 'zombiesAtMost': return cmp('le', zombiesAt(st, loc()!), v)
    case 'barricadesAtLeast': return cmp('ge', st.locations[loc()!]?.entrances.reduce((a, e) => a + e.barricades, 0) ?? 0, v)
    case 'noiseAtLeast': return cmp('ge', st.locations[loc()!]?.noise ?? 0, v)
    case 'helplessAtLeast': return cmp('ge', st.locations[loc()!]?.helpless ?? 0, v)
    case 'survivorsAtLeast': case 'survivorsAtMost': {
      let n: number
      if (node.subject === 'seat' || node.subject === 'holder' || node.subject === 'activeSeat') {
        const seat = st.seats[seatFor(c, node.subject)!]
        n = (seat?.survivors ?? []).filter((id) => st.survivors[id]?.status === 'alive' && (!node.location || st.survivors[id]!.location === node.location)).length
      } else n = survivorsAt(st, loc()!).length
      return cmp(node.test === 'survivorsAtLeast' ? 'ge' : 'le', n, v)
    }
    case 'emptySurvivorSpace': return hasSpace(st, loc() ?? 'colony')
    case 'seatIsExiled': return !!st.seats[seatFor(c, node.subject)!]?.seat.exiled
    case 'seatCountAtLeast': return activeSeats(st).length >= Number(v)
    case 'dieAtLeast': return (st.seats[seatFor(c, node.subject)!]?.dice ?? []).some((d) => !d.used && d.value >= Number(v))
    case 'hasUnusedDie': return (st.seats[seatFor(c, node.subject)!]?.dice ?? []).some((d) => !d.used)
    case 'crisisPrevented': return !!st.crisis.result?.prevented
    case 'objectiveCounterAtLeast': {
      const name = typeof v === 'object' && v ? (v as { counter: string }).counter : String(v)
      const need = typeof v === 'object' && v ? (v as { need: number }).need : objectiveNeed(st, name)
      return counterValue(st, name, c.ownerSeat ?? c.seat) >= need
    }
    case 'isActiveSeat': return seatFor(c, node.subject) === st.activeSeat
    case 'isFirstSeat': return seatFor(c, node.subject) === st.firstSeat
    case 'isLeader': { const s = sv(); return !!s && !!s.owner && st.seats[s.owner]?.leaderId === s.id }
    case 'variantIs': return !!(st.setup.variants as Record<string, boolean> | undefined)?.[String(v)]
    default: return false
  }
}

// ---------- objective counters (main objective in state.objective; secret ones as private effect instances) ----------
export function objectiveNeed(state: GameState, counter: string): number {
  const side = recOf(state, state.objective.id)?.sides?.[state.objective.side]
  const c = side?.counters?.[counter]
  if (!c) return Infinity
  return c.need === 'perSeat' ? state.setup.seats.length * (c.perSeatMultiplier ?? 1) : c.need
}
function counterValue(state: GameState, counter: string, seat: SeatId | undefined): number {
  const priv = state.effects.find((e) => e.name === `counter:${counter}` && e.ownerSeat === seat)
  return priv ? Number(priv.data?.value ?? 0) : state.objective.counters[counter] ?? 0
}

// ---------- lasting effects (forbid / grant / treatFaceAs) ----------
export function expiryFor(state: GameState, d: EffectDuration): EffectExpiry | null {
  switch (d) {
    case 'turn': return { roundNumber: state.roundNumber, turnCount: state.turnCount }
    case 'round': return { roundNumber: state.roundNumber }
    case 'nextRound': return { roundNumber: state.roundNumber + 1 }
    default: return null // 'game' never; 'instant' is not lasting
  }
}
/** The later of two expiries; null (never) beats everything; a round expiry outlasts a turn expiry of the same round. */
export function laterExpiry(a: EffectExpiry | null, b: EffectExpiry | null): EffectExpiry | null {
  if (a === null || b === null) return null
  if (a.roundNumber !== b.roundNumber) return a.roundNumber > b.roundNumber ? a : b
  if (a.turnCount === undefined) return a
  if (b.turnCount === undefined) return b
  return a.turnCount >= b.turnCount ? a : b
}
const sameList = (a?: readonly unknown[], b?: readonly unknown[]): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

export interface LastingSpec {
  name: string; sourceId: Id; sourceKind: EffectInstance['sourceKind']; ownerSeat?: SeatId
  seats?: SeatId[]; survivorIds?: SurvivorId[]; locations?: LocationId[]
  forbid?: string[]; grants?: string[]; data?: Record<string, unknown>; duration: EffectDuration
}
/** Create a lasting effect, or refresh the same-named one on the same targets to the LATER expiry (never overwrite). */
export function addLasting(acc: Acc, spec: LastingSpec): void {
  const expires = expiryFor(acc.state, spec.duration)
  const same = acc.state.effects.find((e) => e.name === spec.name && e.sourceId === spec.sourceId
    && sameList(e.seats, spec.seats) && sameList(e.survivorIds, spec.survivorIds) && sameList(e.locations, spec.locations))
  const targetIds = [...(spec.seats ?? []), ...(spec.survivorIds ?? []), ...(spec.locations ?? [])]
  if (same) {
    const later = laterExpiry(same.expires, expires)
    patch(acc, { effects: acc.state.effects.map((e) => (e === same ? { ...e, expires: later, duration: later === null ? 'game' : e.duration } : e)) })
    emit(acc, { type: 'EffectApplied', effectId: same.id, sourceId: spec.sourceId, name: spec.name, targetIds, expires: later, refreshed: true, ...(spec.ownerSeat ? { ownerSeat: spec.ownerSeat } : {}) })
    return
  }
  const seq = acc.state.effectSeq + 1
  const inst: EffectInstance = {
    id: `e:${seq}`, sourceId: spec.sourceId, sourceKind: spec.sourceKind, name: spec.name,
    ...(spec.ownerSeat ? { ownerSeat: spec.ownerSeat } : {}),
    ...(spec.seats ? { seats: spec.seats } : {}), ...(spec.survivorIds ? { survivorIds: spec.survivorIds } : {}),
    ...(spec.locations ? { locations: spec.locations } : {}),
    ...(spec.forbid ? { forbid: spec.forbid } : {}), ...(spec.grants ? { grants: spec.grants } : {}), ...(spec.data ? { data: spec.data } : {}),
    duration: spec.duration, expires,
  }
  patch(acc, { effectSeq: seq, effects: [...acc.state.effects, inst] })
  emit(acc, { type: 'EffectApplied', effectId: inst.id, sourceId: spec.sourceId, name: spec.name, targetIds, expires, refreshed: false, ...(spec.ownerSeat ? { ownerSeat: spec.ownerSeat } : {}) })
}

/** Drop effects whose expiry has passed. `turnEnd` after a player turn, `roundEnd` after the colony phase (21 §7). */
export function expireEffects(state: GameState, when: 'turnEnd' | 'roundEnd'): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = []
  const keep: EffectInstance[] = []
  for (const e of state.effects) {
    const x = e.expires
    let gone = false
    if (x) {
      if (when === 'roundEnd') gone = x.roundNumber <= state.roundNumber
      else gone = x.turnCount !== undefined && (x.roundNumber < state.roundNumber || (x.roundNumber === state.roundNumber && x.turnCount <= state.turnCount))
    }
    if (gone) events.push({ type: 'EffectExpired', effectId: e.id, reason: 'duration', ...(e.ownerSeat ? { ownerSeat: e.ownerSeat } : {}) })
    else keep.push(e)
  }
  return events.length ? { state: { ...state, effects: keep }, events } : { state, events }
}

function effectCovers(e: EffectInstance, st: GameState, o: { survivorId?: SurvivorId; seat?: SeatId; location?: LocationId }): boolean {
  const sv = o.survivorId ? st.survivors[o.survivorId] : undefined
  if (e.survivorIds && (!o.survivorId || !e.survivorIds.includes(o.survivorId))) return false
  const seat = o.seat ?? sv?.owner ?? undefined
  if (e.seats && (!seat || !e.seats.includes(seat))) return false
  const loc = o.location ?? sv?.location
  if (e.locations && (!loc || !e.locations.includes(loc))) return false
  return true
}
/** Is `what` forbidden for this seat / survivor now (Blizzard, exile)? */
export function isForbidden(state: GameState, what: string, o: { survivorId?: SurvivorId; seat?: SeatId; location?: LocationId }): boolean {
  const seat = state.seats[o.seat ?? state.survivors[o.survivorId ?? '']?.owner ?? '']
  const exiled = !!seat?.seat.exiled
  if (what === 'move' && exiled) return false // an exiled seat is not stopped by Blizzard (MOVE-009)
  if (state.effects.some((e) => e.forbid?.includes(what) && effectCovers(e, state, o))) return true
  return exiled && ['contribute', 'spendFood', 'vote', 'addHelpless'].includes(what) // R15.3

}

function scopeSurvivorsOfNode(state: GameState, d: CardEffectDescriptor, who: ScopeNode, holder: SurvivorState): SurvivorState[] {
  switch (who.who) {
    case 'self': case 'survivor': case 'target': return [holder]
    case 'seatSurvivors': return aliveSurvivors(state).filter((s) => s.owner === d.ownerSeat)
    case 'allSurvivors': return aliveSurvivors(state)
    case 'atLocation': return survivorsAt(state, (who.location ?? holder.location) as LocationId)
    default: return []
  }
}
/** Grants in force for a survivor: lasting instances plus passive abilities / equipped items (switch off when the source leaves play). */
export interface GrantEntry { sourceId: Id; value: number }
export function grantEntries(state: GameState, what: string, o: { survivorId?: SurvivorId; seat?: SeatId } = {}): GrantEntry[] {
  const out: GrantEntry[] = []
  for (const e of state.effects) {
    if (e.grants?.includes(what) && effectCovers(e, state, o)) out.push({ sourceId: e.sourceId, value: Number(e.data?.amount ?? e.data?.value ?? 1) })
  }
  for (const sv of aliveSurvivors(state)) {
    for (const d of descriptorsOfSurvivor(state, sv)) {
      if (d.point !== 'passive') continue
      d.effect.forEach((n) => {
        if (!('op' in n) || n.op !== 'grant' || n.what !== what) return
        const targets = scopeSurvivorsOfNode(state, d, n.scope ?? d.scope, sv)
        const hit = o.survivorId ? targets.some((t) => t.id === o.survivorId) : targets.some((t) => t.owner === o.seat)
        if (!hit) return
        const ctx: EvalCtx = { state, point: 'passive', seat: d.ownerSeat!, survivorId: sv.id, holderId: sv.id, ownerSeat: d.ownerSeat, location: sv.location }
        if (evaluateCondition(ctx, d.when)) out.push({ sourceId: d.cardInstanceId ? d.sourceId : sv.id, value: Number(n.value ?? 1) })
      })
    }
  }
  return out
}
export const hasGrant = (state: GameState, what: string, o: { survivorId?: SurvivorId; seat?: SeatId } = {}): boolean => grantEntries(state, what, o).length > 0
/** Sum of the numeric values of every matching grant (extraSearchKeep +1, attackValueMinus 1...). */
export const grantTotal = (state: GameState, what: string, o: { survivorId?: SurvivorId; seat?: SeatId } = {}): number => grantEntries(state, what, o).reduce((a, b) => a + b.value, 0)
/** Exposure-face mappings in force (treatFaceAs instances, Sparky, Harman Brooks): returns the final face. */
export function mapExposureFace(state: GameState, survivorId: SurvivorId, face: ExposureFace): ExposureFace {
  let f = face
  if (f === 'bite' && hasGrant(state, 'biteIsWound', { survivorId })) f = 'wound'
  if (f === 'frostbite' && hasGrant(state, 'frostbiteIsWound', { survivorId })) f = 'wound'
  if (f !== 'bite' && f !== 'blank' && hasGrant(state, 'nonBiteIsBlank', { survivorId })) f = 'blank'
  for (const e of state.effects) {
    if (e.grants?.includes('treatFaceAs') && e.data?.face === f && effectCovers(e, state, { survivorId })) f = e.data.asFace as ExposureFace
  }
  return f
}

// ---------- uses (once per turn / round / game) ----------
const useKey = (d: CardEffectDescriptor, state: GameState): { map: 'cardUses' | 'abilityUses'; owner: string; key: string } => {
  const ab = d.abilityId ?? d.sourceId
  const suffix = d.limit === 'oncePerTurn' ? `#turn:${state.turnCount}` : d.limit === 'oncePerGame' ? '#game' : ''
  if (d.cardInstanceId) return { map: 'cardUses', owner: d.cardInstanceId, key: ab + suffix }
  if (d.survivorId && d.source === 'survivor') return { map: 'abilityUses', owner: d.ownerSeat!, key: `${d.survivorId}|${ab}${suffix}` }
  return { map: 'cardUses', owner: d.sourceId, key: ab + suffix }
}
export function usesOf(state: GameState, d: CardEffectDescriptor): number {
  const k = useKey(d, state)
  return k.map === 'cardUses' ? state.cardUses[k.owner]?.[k.key] ?? 0 : state.seats[k.owner]?.abilityUses[k.key] ?? 0
}
export function limitBlocked(state: GameState, d: CardEffectDescriptor): boolean {
  return !!d.limit && usesOf(state, d) >= 1
}
function bumpUse(acc: Acc, d: CardEffectDescriptor): number {
  const k = useKey(d, acc.state)
  const n = usesOf(acc.state, d) + 1
  if (k.map === 'cardUses') patch(acc, { cardUses: { ...acc.state.cardUses, [k.owner]: { ...(acc.state.cardUses[k.owner] ?? {}), [k.key]: n } } })
  else setSeat(acc, k.owner, { abilityUses: { ...acc.state.seats[k.owner]!.abilityUses, [k.key]: n } })
  return n
}
/** Reset once-per-round uses at `dice.rolled` (R4.2); `#game` and given-card markers stay. */
export function resetRoundUses(state: GameState): GameState {
  const seats = { ...state.seats }
  for (const id of Object.keys(seats)) {
    const au: Record<string, number> = {}
    for (const [k, v] of Object.entries(seats[id]!.abilityUses)) if (k.includes('#')) au[k] = v
    seats[id] = { ...seats[id]!, abilityUses: au }
  }
  const cu: GameState['cardUses'] = {}
  for (const [cid, m] of Object.entries(state.cardUses)) {
    const kept: Record<string, number> = {}
    for (const [k, v] of Object.entries(m)) if (k.includes('#') || k.startsWith('$')) kept[k] = v
    if (Object.keys(kept).length) cu[cid] = kept
  }
  return { ...state, seats, cardUses: cu }
}

// ---------- default routines (stand-ins; the owning modules replace them with setRoutines) ----------
type RoutineOut = { state: GameState; events: GameEvent[]; pending?: PendingDecision }
function defaultEndGame(state: GameState, reason: GameEndReason): RoutineOut {
  const winners: SeatId[] = []
  const pending: PendingDecision = {
    id: `d:${state.decisionSeq + 1}`, seat: 'all', kind: 'gameOver', window: 'game.end', context: {}, canPass: false,
  }
  return {
    state: { ...state, decisionSeq: state.decisionSeq + 1, phase: 'ended', result: { reason, objectiveComplete: reason === 'objectiveComplete', winners }, pending },
    events: [{ type: 'GameEnded', reason, objectiveComplete: reason === 'objectiveComplete', winners, morale: state.morale, roundsLeft: state.roundsLeft }],
    pending,
  }
}
function defaultExile(state: GameState, seat: SeatId): RoutineOut {
  const acc = mkAcc(state)
  const objectiveId = acc.state.exiledObjectiveDeck[0] ?? ''
  setSeat(acc, seat, { seat: { ...acc.state.seats[seat]!.seat, exiled: true }, exiledObjectiveId: objectiveId || null })
  patch(acc, { exiledObjectiveDeck: acc.state.exiledObjectiveDeck.slice(1) })
  emit(acc, { type: 'SeatExiled', seat, objectiveId })
  return { state: acc.state, events: acc.events }
}

// ---------- asking (suspension) ----------
class NeedAnswer { constructor(public readonly spec: AskSpec) {} }
interface AskSpec { seat: SeatId; options: { id: string; label: string }[]; code: string; target?: boolean; context?: Partial<DecisionContext>; point?: HookPoint; kind?: PendingDecision['kind'] }
interface Q { acc: Acc; answers: string[]; cursor: number; rc: RunCtx }
const mkQ = (acc: Acc, answers: string[], rc: RunCtx): Q => ({ acc, answers, cursor: 0, rc })
/** Ask `spec.seat`; a single option auto-resolves (DecisionAutoResolved); no option → null. Throws NeedAnswer (caught by the job runner) when an answer is missing. */
function ask(q: Q, spec: AskSpec): string | null {
  if (spec.options.length === 0) return null
  if (spec.options.length === 1) {
    emit(q.acc, { type: 'DecisionAutoResolved', kind: spec.target ? 'itemTarget' : 'effectChoice', seat: spec.seat, optionId: spec.options[0]!.id })
    return spec.options[0]!.id
  }
  if (q.cursor < q.answers.length) return q.answers[q.cursor++]!
  throw new NeedAnswer(spec)
}
const chooserSeat = (rc: RunCtx, st: GameState, chooser: ScopeNode['chooser']): SeatId =>
  chooser === 'activeSeat' ? (st.activeSeat ?? rc.seat) : (rc.ownerSeat ?? rc.seat)
const yesNo = (q: Q, rc: RunCtx, code: string): boolean => ask(q, { seat: rc.ownerSeat ?? rc.seat, code, options: [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }], point: rc.point }) === 'yes'

// ---------- scopes (21 §5) ----------
type Domain = 'survivor' | 'seat' | 'location'
const SEAT_WHO = new Set(['seat', 'activeSeat', 'allSeats', 'otherSeats', 'nonExiledSeats'])
const LOC_WHO = new Set(['location', 'colony', 'allLocations', 'nonColonyLocations'])
const hereOf = (st: GameState, rc: RunCtx): LocationId => {
  if (rc.location) return rc.location
  const sv = st.survivors[rc.survivorId ?? rc.subjectId ?? '']
  return sv?.location ?? 'colony'
}
const evalCtxOf = (st: GameState, rc: RunCtx, over: Partial<EvalCtx> = {}): EvalCtx => ({
  state: st, point: rc.point, seat: rc.ownerSeat ?? rc.seat, ownerSeat: rc.ownerSeat, holderId: rc.survivorId, survivorId: rc.subjectId ?? rc.survivorId,
  targetId: rc.targetId, location: rc.location, cardId: rc.cardId, dieId: rc.dieId, face: rc.face, params: rc.params, ...over,
})
const survLabel = (st: GameState, id: string): string => `${recOf(st, id)?.name ?? id}`
const seatLabel = (st: GameState, id: string): string => st.seats[id]?.seat.name ?? id
const locLabel = (st: GameState, id: string): string => `${recOf(st, id)?.name ?? id}`

function candidates(st: GameState, sc: ScopeNode, rc: RunCtx, domain: Domain): string[] {
  let out: string[] = []
  if (domain === 'survivor') {
    const alive = aliveSurvivors(st)
    switch (sc.who) {
      case 'self': out = [rc.survivorId ?? rc.subjectId].filter(Boolean) as string[]; break
      case 'survivor': out = [rc.subjectId ?? rc.survivorId].filter(Boolean) as string[]; break
      case 'target': out = rc.targetId ? [rc.targetId] : []; break
      case 'seatSurvivors': out = alive.filter((s) => s.owner === rc.seat).map((s) => s.id); break
      case 'allSurvivors': case 'chosen': out = alive.map((s) => s.id); break
      case 'atLocation': out = survivorsAt(st, (sc.location ?? hereOf(st, rc)) as LocationId).map((s) => s.id); break
      case 'lowestInfluenceAtLocation': case 'highestInfluenceAtLocation': {
        const l = survivorsAt(st, (sc.location ?? hereOf(st, rc)) as LocationId).sort((a, b) => influenceOf(st, a.id) - influenceOf(st, b.id))
        const pick = sc.who === 'lowestInfluenceAtLocation' ? l[0] : l[l.length - 1]
        out = pick ? [pick.id] : []
        break
      }
      default: out = []
    }
    out = out.filter((id) => st.survivors[id]?.status === 'alive')
  } else if (domain === 'seat') {
    const seats = activeSeats(st)
    switch (sc.who) {
      case 'seat': case 'self': case 'survivor': out = [rc.seat]; break
      case 'activeSeat': out = st.activeSeat ? [st.activeSeat] : []; break
      case 'allSeats': out = seats; break
      case 'otherSeats': out = seats.filter((s) => s !== rc.seat); break
      case 'nonExiledSeats': out = nonExiledSeats(st); break
      case 'chosen': out = seats.filter((s) => s !== rc.seat); break
      default: out = [rc.seat]
    }
  } else {
    const all = st.locationOrder
    switch (sc.who) {
      case 'colony': out = ['colony']; break
      case 'location': out = [sc.location ?? hereOf(st, rc)]; break
      case 'allLocations': case 'chosen': out = all; break
      case 'nonColonyLocations': out = all.filter((l) => l !== 'colony'); break
      default: out = [hereOf(st, rc)]
    }
  }
  if (sc.filter) {
    out = out.filter((id) => {
      const over: Partial<EvalCtx> = domain === 'survivor' ? { survivorId: id } : domain === 'seat' ? { seat: id } : { location: id }
      return evaluateCondition(evalCtxOf(st, rc, over), sc.filter)
    })
  }
  return out
}

function resolveScope(q: Q, sc: ScopeNode | undefined, rc: RunCtx, domain: Domain, defaultWho: ScopeNode['who'], fallback?: ScopeNode): string[] {
  const scope: ScopeNode = sc ?? (domain === 'survivor' && fallback ? fallback : { who: defaultWho })
  const st = q.acc.state
  const cands = candidates(st, scope, rc, domain)
  const chosen = scope.who === 'chosen'
  const want = scope.count === 'all' ? Infinity : scope.count ?? (chosen ? 1 : Infinity)
  if (cands.length <= want) return cands
  const label = domain === 'survivor' ? survLabel : domain === 'seat' ? seatLabel : locLabel
  const chooser = chooserSeat(rc, st, scope.chooser)
  const picked: string[] = []
  const left = [...cands]
  while (picked.length < want && left.length) {
    let pick: string | null
    if (scope.chooser === 'engine') pick = left[0]!
    else pick = ask(q, { seat: chooser, code: codeFor(rc.sourceId, rc.abilityId), target: !!rc.itemPlay, point: rc.point, options: left.map((id) => ({ id, label: label(q.acc.state, id) })), context: domain === 'survivor' ? { survivorId: rc.survivorId } : {} })
    if (pick === null) break
    picked.push(pick)
    left.splice(left.indexOf(pick), 1)
  }
  return picked
}
const survivorsOf = (q: Q, node: { scope?: ScopeNode }, rc: RunCtx, desc?: ScopeNode): SurvivorId[] =>
  resolveScope(q, node.scope, rc, 'survivor', 'self', desc)
const seatsOf = (q: Q, node: { scope?: ScopeNode }, rc: RunCtx): SeatId[] => resolveScope(q, node.scope, rc, 'seat', 'seat')

/** Locations an op acts on: `location` ('here' | 'chosen' | id) or a location-valued scope. */
function locationsOf(q: Q, node: { location?: LocationId | 'here' | 'chosen'; scope?: ScopeNode }, rc: RunCtx, filterZombies = false): LocationId[] {
  const st = q.acc.state
  if (node.location === 'chosen') {
    const opts = st.locationOrder.filter((l) => !filterZombies || zombiesAt(st, l) > 0)
    const pick = ask(q, { seat: chooserSeat(rc, st, node.scope?.chooser), code: codeFor(rc.sourceId, rc.abilityId), target: !!rc.itemPlay, point: rc.point, options: opts.map((id) => ({ id, label: locLabel(st, id) })) })
    return pick ? [pick] : []
  }
  if (node.location && node.location !== 'here') return [node.location]
  if (node.scope && LOC_WHO.has(node.scope.who)) return resolveScope(q, node.scope, rc, 'location', 'location')
  return [hereOf(st, rc)]
}

// ---------- values ----------
function numValue(q: Q, node: { value?: number | string }, rc: RunCtx, dflt = 0): number {
  const v = node.value
  if (v === undefined) return dflt
  if (v === 'd6') return rollD6(q.acc, rc)
  return Number(v)
}
const countOf = (node: { count?: number | 'all' }, dflt = 1): number => (node.count === 'all' ? Infinity : node.count ?? dflt)
const entranceCapacity = (st: GameState, loc: LocationId): number => st.locations[loc]!.capacity.entranceSpaces
const severity = (f: ExposureFace): number => (f === 'blank' ? 0 : f === 'wound' ? 1 : f === 'frostbite' ? 2 : 3)

// ---------- generic card plumbing ----------
function seatOfCard(st: GameState, cardId: CardId): SeatId | undefined {
  return st.seatOrder.find((s) => st.seats[s]!.hand.includes(cardId))
}
/** Take a card out of whatever zone holds it (hand, equipped, waste, a location deck, the crisis pile). */
export function detachCard(acc: Acc, cardId: CardId): void {
  const st = acc.state
  for (const s of st.seatOrder) if (st.seats[s]!.hand.includes(cardId)) setSeat(acc, s, { hand: st.seats[s]!.hand.filter((c) => c !== cardId) })
  for (const sv of Object.values(acc.state.survivors)) if (sv.equipped.includes(cardId)) setSurvivor(acc, sv.id, { equipped: sv.equipped.filter((c) => c !== cardId) })
  if (acc.state.waste.includes(cardId)) patch(acc, { waste: acc.state.waste.filter((c) => c !== cardId) })
  for (const l of acc.state.locationOrder) if (acc.state.locations[l]!.deck.includes(cardId)) setLoc(acc, l, { deck: acc.state.locations[l]!.deck.filter((c) => c !== cardId) })
}
export function discardTo(acc: Acc, seat: SeatId | null, cardId: CardId, to: 'waste' | 'removed', reason: string): void {
  detachCard(acc, cardId)
  if (to === 'waste') patch(acc, { waste: [cardId, ...acc.state.waste] })
  else patch(acc, { removed: [...acc.state.removed, cardId] })
  emit(acc, { type: 'CardDiscarded', seat, cardId, to, reason })
}
const discardPileFor = (st: GameState, seat: SeatId): 'waste' | 'removed' => (st.seats[seat]?.seat.exiled ? 'removed' : 'waste')

// ---------- wounds ----------
export const deathLimit = (st: GameState, id: SurvivorId): number => (hasGrant(st, 'fourWoundsToDie', { survivorId: id }) ? 4 : 3)
function giveWounds(q: Q, id: SurvivorId, kind: WoundKind, count: number, rc: RunCtx): void {
  const acc = q.acc
  for (let i = 0; i < count; i++) {
    if (acc.state.survivors[id]?.status !== 'alive') return
    const out: { state: GameState; events: GameEvent[]; pending?: PendingDecision } = { state: acc.state, events: [] }
    addWoundInto(out, id, kind, woundSourceOf(rc.sourceKind)) // the one wound routine: event, wound.taken window, death check
    acc.state = out.state; emit(acc, ...out.events)
    if (out.pending) { acc.pending = out.pending; return }
  }
}

// ---------- exposure and movement ----------
function exposeOnce(q: Q, id: SurvivorId, reason: ExposureReason): ExposureFace | null {
  const r = routines.rollExposureFor(q.acc.state, id, reason)
  q.acc.state = r.state; emit(q.acc, ...r.events)
  if (r.pending) q.acc.pending = r.pending
  let face: ExposureFace | null = null
  for (const e of r.events) {
    if (e.type === 'ExposureRolled') face = e.face
    if (e.type === 'ExposureFaceChanged') face = e.to
  }
  return face
}
function moveSurvivorTo(q: Q, id: SurvivorId, to: LocationId, noExposure: boolean, kind: 'card' | 'ability'): boolean {
  const acc = q.acc
  const sv = acc.state.survivors[id]
  if (!sv || sv.status !== 'alive' || sv.location === to || !hasSpace(acc.state, to)) return false
  setSurvivor(acc, id, { location: to, movedThisTurn: true })
  emit(acc, { type: 'SurvivorMoved', survivorId: id, from: sv.location, to, kind })
  if (!noExposure) exposeOnce(q, id, 'move')
  return true
}

// ---------- one effect node ----------
const fmt = (...p: (string | number)[]): string => p.join('|')
function entranceOptions(st: GameState, onlyWithZombies: boolean, exceptLoc?: LocationId): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = []
  for (const l of st.locationOrder) {
    if (l === exceptLoc) continue
    for (const e of st.locations[l]!.entrances) {
      if (onlyWithZombies && e.zombies <= 0) continue
      out.push({ id: fmt(l, e.index), label: `${locLabel(st, l)} entrance ${e.index} (${e.zombies})` })
    }
  }
  return out
}

function execNode(q: Q, w: Work, work: Work[], rc: RunCtx, later: Job[]): void {
  const node = w.node
  const acc = q.acc
  if ('code' in node) {
    const fn = CODE_HOOKS.effects[node.code]
    if (fn) {
      const r = fn({ ...evalCtxOf(acc.state, rc), seat: rc.seat, point: rc.point }, node.params ?? {})
      acc.state = r.state; emit(acc, ...r.events)
    }
    return
  }
  if (node.optional && !yesNo(q, rc, `${codeFor(rc.sourceId, rc.abilityId)}.${node.op}`)) return
  let extra: EffectNode[] = [...(node.then ?? [])]
  if (node.onRoll && node.op !== 'exposure') {
    const r = rollD6(acc, rc)
    const ok = (node.onRoll.atLeast === undefined || r >= node.onRoll.atLeast) && (node.onRoll.atMost === undefined || r <= node.onRoll.atMost)
    if (!ok) { work.unshift(...extra.map((n) => ({ node: n, idx: w.idx, answers: [] }))); return }
    extra = [...node.onRoll.then, ...extra]
  }
  const more = applyOp(q, node, w, rc, later)
  extra = [...(more ?? []), ...extra]
  work.unshift(...extra.map((n) => ({ node: n, idx: w.idx, answers: [] })))
}

type OpNode = Extract<EffectNode, { op: unknown }>

/** Returns nodes to run next (an exposure's `onRoll.then` branches, a chosen option's effects). */
function applyOp(q: Q, node: OpNode, w: Work, rc: RunCtx, later: Job[]): EffectNode[] | void {
  const acc = q.acc
  const st = () => acc.state
  const holderLoc = () => hereOf(st(), rc)
  switch (node.op) {
    // ----- tracks -----
    case 'morale': changeMorale(acc, numValue(q, node, rc), moraleReasonOf(rc.sourceKind), rc.sourceId); return
    case 'food': changeFood(acc, numValue(q, node, rc), foodReasonOf(rc.sourceKind)); return
    case 'starvation': patch(acc, { starvation: Math.max(0, st().starvation + numValue(q, node, rc)) }); return
    case 'roundTrack': {
      const after = Math.max(0, Math.min(10, st().roundsLeft + numValue(q, node, rc)))
      patch(acc, { roundsLeft: after })
      emit(acc, { type: 'RoundTicked', roundsLeft: after })
      if (after === 0 && st().phase !== 'ended') { const r = routines.endGame(st(), 'roundsOut'); acc.state = r.state; emit(acc, ...r.events) }
      return
    }
    case 'objectiveCounter': {
      const name = String(node.value)
      const delta = countOf(node, 1)
      const priv = rc.sourceKind === 'secretObjective' || rc.sourceKind === 'exiledObjective'
      if (priv && rc.ownerSeat) {
        const cur = st().effects.find((e) => e.name === `counter:${name}` && e.ownerSeat === rc.ownerSeat)
        const after = Number(cur?.data?.value ?? 0) + delta
        if (cur) patch(acc, { effects: st().effects.map((e) => (e === cur ? { ...e, data: { value: after } } : e)) })
        else patch(acc, { effectSeq: st().effectSeq + 1, effects: [...st().effects, { id: `e:${st().effectSeq + 1}`, sourceId: rc.sourceId, sourceKind: rc.sourceKind, ownerSeat: rc.ownerSeat, name: `counter:${name}`, data: { value: after }, duration: 'game', expires: null }] })
        emit(acc, { type: 'ObjectiveProgress', objectiveId: rc.sourceId, seat: rc.ownerSeat, counter: name, delta, after, need: Number(recOf(st(), rc.sourceId)?.counters?.[name]?.need ?? Infinity) })
      } else {
        const after = (st().objective.counters[name] ?? 0) + delta
        patch(acc, { objective: { ...st().objective, counters: { ...st().objective.counters, [name]: after } } })
        emit(acc, { type: 'ObjectiveProgress', objectiveId: st().objective.id, seat: null, counter: name, delta, after, need: objectiveNeed(st(), name) })
      }
      return
    }
    // ----- zombies, barricades, noise -----
    case 'addZombies': {
      const locs = locationsOf(q, node, rc)
      for (const loc of locs) {
        const n = node.value === 'perSurvivor' ? survivorsAt(st(), loc).length : numValue(q, node, rc, countOf(node, 1))
        if (n <= 0) continue
        const r = routines.addZombies(st(), loc, n, zombieSourceOf(rc.sourceKind)); acc.state = r.state; emit(acc, ...r.events)
      }
      return
    }
    case 'killZombies': {
      const loc = locationsOf(q, node, rc)[0]
      if (!loc) return
      const killerId = (node.scope || rc.survivorId) ? survivorsOf(q, node, rc)[0] : undefined
      let n = countOf(node, 1)
      const l0 = st().locations[loc]!
      const have = l0.entrances.reduce((a, e) => a + e.zombies, 0)
      if (have === 0) return
      n = Math.min(n, have)
      let first: number | undefined
      if (loc === 'colony' && l0.entrances.filter((e) => e.zombies > 0).length > 1 && n < have) {
        const pick = ask(q, { seat: chooserSeat(rc, st(), node.scope?.chooser), code: codeFor(rc.sourceId, rc.abilityId), target: !!rc.itemPlay, point: rc.point, options: l0.entrances.filter((e) => e.zombies > 0).map((e) => ({ id: String(e.index), label: `entrance ${e.index} (${e.zombies})` })) })
        first = pick ? Number(pick) : undefined
      }
      let killed = 0
      for (let i = 0; i < n; i++) {
        const cur = st().locations[loc]!
        const e = (first !== undefined ? cur.entrances.find((x) => x.index === first && x.zombies > 0) : undefined)
          ?? [...cur.entrances].sort((a, b) => b.zombies - a.zombies)[0]!
        if (e.zombies <= 0) break
        setLoc(acc, loc, { entrances: cur.entrances.map((x) => (x === e ? { ...x, zombies: x.zombies - 1 } : x)) })
        emit(acc, { type: 'ZombieKilled', location: loc, entrance: e.index, by: killerId ?? rc.sourceId, zombies: 1 })
        later.push({ t: 'window', point: 'zombie.killed', ctx: { seat: rc.seat, survivorId: killerId, location: loc, params: { entrance: e.index } } })
        killed++
      }
      if (killerId && killed > 0 && node.value !== 'noExposure') {
        const rolls = node.value === 'exposureOnce' ? 1 : killed
        for (let i = 0; i < rolls && st().survivors[killerId]?.status === 'alive'; i++) exposeOnce(q, killerId, 'zombieKill')
      }
      return
    }
    case 'moveZombies': {
      const dest = locationsOf(q, node, rc)[0]
      if (!dest) return
      const n = countOf(node, 1)
      for (let i = 0; i < n; i++) {
        const opts = entranceOptions(st(), true, dest)
        const pick = opts.length ? ask(q, { seat: chooserSeat(rc, st(), node.scope?.chooser), code: codeFor(rc.sourceId, rc.abilityId), target: !!rc.itemPlay, point: rc.point, options: opts }) : null
        if (!pick) break
        const [fl, fi] = pick.split('|') as [LocationId, string]
        const dl = st().locations[dest]!
        const cap = entranceCapacity(st(), dest)
        const de = dl.entrances.find((e) => e.zombies + e.barricades < cap)
        if (!de) break
        const fe = st().locations[fl]!.entrances.find((e) => e.index === Number(fi))!
        setLoc(acc, fl, { entrances: st().locations[fl]!.entrances.map((x) => (x === fe ? { ...x, zombies: x.zombies - 1 } : x)) })
        const dl2 = st().locations[dest]!
        setLoc(acc, dest, { entrances: dl2.entrances.map((x) => (x.index === de.index ? { ...x, zombies: x.zombies + 1 } : x)) })
        emit(acc, { type: 'ZombieMoved', from: { location: fl, entrance: fe.index }, to: { location: dest, entrance: de.index }, by: rc.survivorId ?? rc.sourceId })
      }
      return
    }
    case 'addBarricade': case 'removeBarricade': {
      for (const loc of locationsOf(q, node, rc)) {
        const n = countOf(node, 1)
        for (let i = 0; i < n; i++) {
          const l = st().locations[loc]!
          const cap = entranceCapacity(st(), loc)
          if (node.op === 'addBarricade') {
            const e = l.entrances.find((x) => x.zombies + x.barricades < cap)
            if (!e) break
            setLoc(acc, loc, { entrances: l.entrances.map((x) => (x === e ? { ...x, barricades: x.barricades + 1 } : x)) })
            emit(acc, { type: 'BarricadeAdded', location: loc, entrance: e.index, by: rc.survivorId ?? rc.sourceId, barricades: e.barricades + 1 })
          } else {
            const e = [...l.entrances].sort((a, b) => b.barricades - a.barricades)[0]!
            if (e.barricades <= 0) break
            setLoc(acc, loc, { entrances: l.entrances.map((x) => (x === e ? { ...x, barricades: x.barricades - 1 } : x)) })
            emit(acc, { type: 'BarricadeDestroyed', location: loc, entrance: e.index, barricades: e.barricades - 1 })
          }
        }
      }
      return
    }
    case 'addNoise': case 'removeNoise': {
      for (const loc of locationsOf(q, node, rc)) {
        const l = st().locations[loc]!
        const n = Math.min(countOf(node, 1), node.op === 'addNoise' ? l.capacity.noiseSpaces - l.noise : l.noise)
        if (n <= 0) continue
        const after = l.noise + (node.op === 'addNoise' ? n : -n)
        setLoc(acc, loc, { noise: after })
        if (node.op === 'addNoise') {
          emit(acc, { type: 'NoiseAdded', location: loc, count: n, after, by: rc.survivorId ?? rc.sourceId })
          later.push({ t: 'window', point: 'noise.added', ctx: { seat: rc.seat, location: loc } })
        } else emit(acc, { type: 'NoiseCleared', location: loc, count: n })
      }
      return
    }
    // ----- survivors -----
    case 'wound': {
      const kind: WoundKind = node.kind ?? 'wound'
      for (const id of survivorsOf(q, node, rc)) giveWounds(q, id, kind, countOf(node, 1), rc)
      return
    }
    case 'heal': {
      if (isForbidden(st(), 'heal', { seat: rc.seat })) return
      for (const id of survivorsOf(q, node, rc)) {
        for (let i = 0; i < countOf(node, 1); i++) {
          const sv = st().survivors[id]!
          const kind: WoundKind | null = node.kind ? (sv[node.kind === 'wound' ? 'wounds' : 'frostbite'] > 0 ? node.kind : null) : sv.frostbite > 0 ? 'frostbite' : sv.wounds > 0 ? 'wound' : null
          if (!kind) break
          setSurvivor(acc, id, kind === 'wound' ? { wounds: sv.wounds - 1 } : { frostbite: sv.frostbite - 1 })
          emit(acc, { type: 'WoundHealed', survivorId: id, kind, sourceId: rc.sourceId })
        }
      }
      return
    }
    case 'exposure': {
      const reason = (typeof node.value === 'string' ? node.value : 'card') as ExposureReason
      const more: EffectNode[] = []
      for (const id of survivorsOf(q, node, rc)) {
        for (let i = 0; i < countOf(node, 1) && st().survivors[id]?.status === 'alive'; i++) {
          const face = exposeOnce(q, id, reason)
          if (face && node.onRoll) {
            const sev = severity(face)
            if ((node.onRoll.atLeast === undefined || sev >= node.onRoll.atLeast) && (node.onRoll.atMost === undefined || sev <= node.onRoll.atMost)) more.push(...node.onRoll.then)
          }
          if (q.acc.pending) break
        }
      }
      return more
    }
    case 'killSurvivor': {
      for (const id of survivorsOf(q, node, rc)) {
        const r = routines.killSurvivor(st(), id, killCauseOf(rc.sourceKind)); acc.state = r.state; emit(acc, ...r.events)
        if (r.pending) q.acc.pending = r.pending
      }
      return
    }
    case 'removeSurvivor': {
      for (const id of survivorsOf(q, node, rc)) {
        const r = routines.removeSurvivor(st(), id, rc.sourceId); acc.state = r.state; emit(acc, ...r.events)
        if (r.pending) q.acc.pending = r.pending
      }
      return
    }
    case 'addSurvivor': {
      const src = rc.sourceKind === 'item' ? 'item' : rc.sourceKind === 'crossroads' ? 'crossroads' : rc.sourceKind === 'crisis' ? 'crisis' : 'ability'
      if (isForbidden(st(), 'addSurvivor', { seat: rc.seat })) return
      for (const seat of seatsOf(q, node, rc)) {
        for (let i = 0; i < countOf(node, 1); i++) {
          let loc: LocationId | undefined
          if (st().seats[seat]!.seat.exiled) {
            const spaces = st().locationOrder.filter((l) => l !== 'colony' && hasSpace(st(), l))
            const pick = ask(q, { seat, code: 'exiledSurvivorPlacement', point: rc.point, options: spaces.map((id) => ({ id, label: locLabel(st(), id) })) })
            if (!pick) break
            loc = pick
          } else if (!hasSpace(st(), 'colony')) break
          const r = routines.addSurvivor(st(), seat, src, loc); acc.state = r.state; emit(acc, ...r.events)
          if (r.pending) q.acc.pending = r.pending
        }
      }
      return
    }
    case 'addHelpless': case 'removeHelpless': {
      const loc = locationsOf(q, { location: node.location ?? 'colony' }, rc)[0]!
      const l = st().locations[loc]!
      if (node.op === 'addHelpless') {
        if (st().seats[rc.seat]?.seat.exiled || isForbidden(st(), 'addHelpless', { seat: rc.seat })) return
        const n = Math.min(countOf(node, 1), l.capacity.survivors - spacesUsed(st(), loc))
        if (n <= 0) return
        setLoc(acc, loc, { helpless: l.helpless + n })
        emit(acc, { type: 'HelplessAdded', location: loc, count: n, after: l.helpless + n, sourceId: rc.sourceId })
      } else {
        const n = Math.min(countOf(node, 1), l.helpless)
        if (n <= 0) return
        setLoc(acc, loc, { helpless: l.helpless - n })
        emit(acc, { type: 'HelplessKilled', location: loc, count: n, after: l.helpless - n, cause: killCauseOf(rc.sourceKind), moraleLoss: true })
        changeMorale(acc, -n, 'helplessKilled', rc.sourceId)
      }
      return
    }
    case 'moveSurvivor': {
      for (const id of survivorsOf(q, node, rc)) {
        const sv = st().survivors[id]!
        let dest: LocationId | undefined
        if (node.location === 'chosen') {
          const opts = st().locationOrder.filter((l) => l !== sv.location && hasSpace(st(), l))
          dest = ask(q, { seat: chooserSeat(rc, st(), node.scope?.chooser), code: codeFor(rc.sourceId, rc.abilityId), target: !!rc.itemPlay, point: rc.point, options: opts.map((l) => ({ id: l, label: locLabel(st(), l) })) }) ?? undefined
        } else dest = locationsOf(q, node, rc)[0]
        if (dest) moveSurvivorTo(q, id, dest, node.value === 'noExposure', rc.sourceKind === 'item' ? 'card' : 'ability')
      }
      return
    }
    case 'newLeader': {
      for (const seat of seatsOf(q, node, rc)) {
        const opts = st().seats[seat]!.survivors.filter((s) => st().survivors[s]?.status === 'alive')
        const pick = ask(q, { seat, kind: 'newLeader', code: 'newLeader', point: rc.point, options: opts.map((id) => ({ id, label: survLabel(st(), id) })) })
        if (pick) { setSeat(acc, seat, { leaderId: pick }); emit(acc, { type: 'LeaderChosen', seat, survivorId: pick, reason: 'replacement' }) }
      }
      return
    }
    // ----- cards -----
    case 'draw': {
      for (const seat of seatsOf(q, { scope: node.scope?.who === 'chosen' ? undefined : node.scope }, rc)) {
        const from = node.value === 'revealed' ? (rc.revealedAt ?? holderLoc()) : node.value === 'here' || node.value === undefined ? holderLoc() : (node.value as LocationId)
        const deck = st().locations[from]?.deck ?? []
        let pool = node.value === 'revealed' ? (rc.revealed ?? []) : deck
        if (node.symbol) pool = pool.filter((c) => symbolsOf(defOf(st(), c)).includes(node.symbol!))
        let take: CardId[]
        if (node.value === 'revealed' && node.scope?.who === 'chosen') {
          const opts = pool.map((id) => ({ id, label: defOf(st(), id)?.name ?? id }))
          const options = node.optional ? opts : opts
          take = []
          for (let i = 0; i < countOf(node, 1) && options.length; i++) {
            const pick = ask(q, { seat: chooserSeat(rc, st(), node.scope.chooser), code: codeFor(rc.sourceId, rc.abilityId), target: !!rc.itemPlay, point: rc.point, options: options.filter((o) => !take.includes(o.id)) })
            if (!pick) break
            take.push(pick)
          }
        } else take = pool.slice(0, countOf(node, 1) === Infinity ? pool.length : countOf(node, 1))
        for (const c of take) {
          setLoc(acc, from, { deck: st().locations[from]!.deck.filter((x) => x !== c) })
          setSeat(acc, seat, { hand: [...st().seats[seat]!.hand, c] })
          emit(acc, { type: 'CardDrawn', seat, from, cardId: c, sourceId: rc.sourceId })
          if (rc.revealed) rc.revealed = rc.revealed.filter((x) => x !== c)
        }
      }
      return
    }
    case 'drawFromDeck': {
      for (const seat of seatsOf(q, node, rc)) {
        if (node.value === 'survivor') {
          for (let i = 0; i < countOf(node, 1); i++) { const r = routines.addSurvivor(st(), seat, 'ability'); acc.state = r.state; emit(acc, ...r.events) }
        } else if (node.value === 'crossroads' && !st().crossroads.held && st().crossroads.deck.length) {
          const [top, ...rest] = st().crossroads.deck
          patch(acc, { crossroads: { ...st().crossroads, deck: rest, held: { cardId: top!, holder: seat, forSeat: st().activeSeat ?? seat } } })
          emit(acc, { type: 'CrossroadsDrawn', holder: seat, forSeat: st().activeSeat ?? seat, cardId: top! })
        }
      }
      return
    }
    case 'discard': {
      for (const seat of seatsOf(q, node, rc)) {
        const hand = st().seats[seat]!.hand.filter((c) => !node.symbol || symbolsOf(defOf(st(), c)).includes(node.symbol))
        const n = Math.min(countOf(node, 1), hand.length)
        const chosen: CardId[] = []
        for (let i = 0; i < n; i++) {
          const left = hand.filter((c) => !chosen.includes(c))
          let pick: string | null
          if (node.value === 'random') pick = left[randomIndex(acc, left.length)]!
          else pick = ask(q, { seat, code: codeFor(rc.sourceId, rc.abilityId), point: rc.point, options: left.map((id) => ({ id, label: defOf(st(), id)?.name ?? id })) })
          if (pick) chosen.push(pick)
        }
        for (const c of chosen) discardTo(acc, seat, c, discardPileFor(st(), seat), 'effect')
      }
      return
    }
    case 'removeCard': {
      if (node.value === 'self') { if (rc.cardId) discardTo(acc, rc.seat, rc.cardId, 'removed', 'self'); return }
      if (node.value === 'waste') { for (const c of st().waste.slice(0, countOf(node, 1))) discardTo(acc, null, c, 'removed', 'effect'); return }
      if (node.value === 'crisis') {
        const cards = st().crisis.contributions.map((c) => c.cardId)
        patch(acc, { crisis: { ...st().crisis, contributions: [] }, removedHidden: [...st().removedHidden, ...cards] })
        for (const c of cards) emit(acc, { type: 'CardDiscarded', seat: null, cardId: c, to: 'removed', reason: 'unrevealed', revealed: false })
        return
      }
      for (const seat of seatsOf(q, node, rc)) {
        const hand = [...st().seats[seat]!.hand]
        for (let i = 0; i < countOf(node, 1) && hand.length; i++) {
          const c = hand.splice(randomIndex(acc, hand.length), 1)[0]!
          discardTo(acc, seat, c, 'removed', 'effect')
        }
      }
      return
    }
    case 'giveCard': {
      const from = rc.seat
      for (const to of seatsOf(q, node, rc)) {
        if (to === from) continue
        for (let i = 0; i < countOf(node, 1); i++) {
          const hand = st().seats[from]!.hand.filter((c) => !node.symbol || symbolsOf(defOf(st(), c)).includes(node.symbol))
          const pick = ask(q, { seat: from, code: codeFor(rc.sourceId, rc.abilityId), point: rc.point, options: hand.map((id) => ({ id, label: defOf(st(), id)?.name ?? id })) })
          if (!pick) break
          setSeat(acc, from, { hand: st().seats[from]!.hand.filter((c) => c !== pick) })
          setSeat(acc, to, { hand: [...st().seats[to]!.hand, pick] })
          emit(acc, { type: 'CardGiven', from, to, cardId: pick, defId: st().cards[pick]!.defId })
        }
      }
      return
    }
    case 'stealCard': {
      const from = resolveScope(q, node.scope ?? { who: 'chosen', chooser: 'owner', filter: { test: 'handAtLeast', subject: 'seat', value: 1 } }, rc, 'seat', 'chosen')
      for (const victim of from) {
        for (let i = 0; i < countOf(node, 1); i++) {
          const hand = st().seats[victim]!.hand
          if (!hand.length) break
          const c = hand[randomIndex(acc, hand.length)]!
          setSeat(acc, victim, { hand: hand.filter((x) => x !== c) })
          setSeat(acc, rc.seat, { hand: [...st().seats[rc.seat]!.hand, c] })
          emit(acc, { type: 'CardStolen', from: victim, to: rc.seat, cardId: c })
        }
      }
      return
    }
    case 'contribute': {
      for (const seat of seatsOf(q, node, rc)) {
        if (node.value === 'crisis' && st().seats[seat]!.seat.exiled) continue
        const hand = st().seats[seat]!.hand.filter((c) => !node.symbol || symbolsOf(defOf(st(), c)).includes(node.symbol))
        const n = Math.min(countOf(node, 1), hand.length)
        const chosen: CardId[] = []
        for (let i = 0; i < n; i++) {
          const left = hand.filter((c) => !chosen.includes(c))
          const pick = ask(q, { seat, code: codeFor(rc.sourceId, rc.abilityId), point: rc.point, options: left.map((id) => ({ id, label: defOf(st(), id)?.name ?? id })) })
          if (pick) chosen.push(pick)
        }
        for (const c of chosen) {
          detachCard(acc, c)
          if (node.value === 'objective') {
            patch(acc, { objective: { ...st().objective, cards: [...st().objective.cards, c] } })
            const side = recOf(st(), st().objective.id)?.sides?.[st().objective.side]
            const hit = (side?.contributions ?? []).find((x: Rec) => symbolsOf(defOf(st(), c)).includes(x.symbol))
            if (hit) {
              const after = (st().objective.counters[hit.counter] ?? 0) + 1
              patch(acc, { objective: { ...st().objective, counters: { ...st().objective.counters, [hit.counter]: after } } })
              emit(acc, { type: 'ObjectiveProgress', objectiveId: st().objective.id, seat: null, counter: hit.counter, delta: 1, after, need: objectiveNeed(st(), hit.counter) })
            }
          } else patch(acc, { crisis: { ...st().crisis, contributions: [...st().crisis.contributions, { seat, cardId: c }] } })
          emit(acc, { type: 'CardContributed', seat, cardId: c, from: 'hand' })
        }
      }
      return
    }
    case 'peekDeck': {
      for (const seat of seatsOf(q, node, rc)) {
        let ids: string[] = []
        const n = countOf(node, 1)
        if (node.value === 'crisis') ids = st().crisisDeck.slice(0, n)
        else if (node.value === 'survivor') ids = st().survivorDeck.slice(0, n)
        else if (node.value === 'crossroads') ids = st().crossroads.deck.slice(0, n)
        else { const l = locationsOf(q, node, rc)[0]!; ids = st().locations[l]!.deck.slice(0, n) }
        // private to `seat` through the ownerSeat redaction of EffectApplied (events.ts has no dedicated peek event)
        emit(acc, { type: 'EffectApplied', effectId: `peek:${st().rollSeq}`, sourceId: rc.sourceId, name: 'peek', targetIds: ids, expires: null, refreshed: false, ownerSeat: seat })
      }
      return
    }
    case 'revealDeck': {
      const loc = locationsOf(q, node, rc)[0]!
      rc.revealed = st().locations[loc]!.deck.slice(0, Number(node.value ?? 1))
      rc.revealedAt = loc
      return
    }
    case 'shuffleDeck': {
      if (node.value === 'crossroads') {
        const [deck, rng] = shuffle(st().rng, st().crossroads.deck)
        patch(acc, { rng, crossroads: { ...st().crossroads, deck } })
        emit(acc, { type: 'CrossroadsDeckShuffled', reason: 'search' })
      } else {
        const loc = locationsOf(q, node, rc)[0]!
        const [deck, rng] = shuffle(st().rng, st().locations[loc]!.deck)
        patch(acc, { rng }); setLoc(acc, loc, { deck })
        emit(acc, { type: 'DeckShuffled', location: loc, reason: rc.sourceKind === 'survivor' ? 'ability' : 'card' })
      }
      rc.revealed = undefined
      return
    }
    case 'cleanWaste': {
      const cards = st().waste.slice(0, countOf(node, 3))
      if (!cards.length) return
      patch(acc, { waste: st().waste.slice(cards.length), removed: [...st().removed, ...cards] })
      emit(acc, { type: 'WasteCleaned', by: rc.survivorId ?? rc.sourceId, cardIds: cards, wasteAfter: st().waste.length })
      return
    }
    case 'equip': {
      const cardId = node.value === 'self' || node.value === undefined ? rc.cardId : String(node.value)
      for (const id of survivorsOf(q, node, rc)) {
        if (!cardId) break
        detachCard(acc, cardId)
        setSurvivor(acc, id, { equipped: [...st().survivors[id]!.equipped, cardId] })
        emit(acc, { type: 'CardEquipped', seat: rc.seat, cardId, survivorId: id })
      }
      return
    }
    case 'extraSearchKeep': case 'extraSearchLook': {
      const value = countOf(node, 1)
      for (const id of survivorsOf(q, node, rc)) {
        addLasting(acc, { name: `${rc.sourceId}#${w.idx}`, sourceId: rc.sourceId, sourceKind: rc.sourceKind, survivorIds: [id], grants: [node.op], data: { value, amount: value }, duration: 'turn' })
      }
      return
    }
    // ----- dice -----
    case 'modDie': {
      for (const seat of seatsOf(q, node, rc)) {
        const unused = () => st().seats[seat]!.dice.filter((d) => !d.used)
        const mode = String(node.value ?? '+1')
        const n = Math.min(countOf(node, 1), unused().length)
        const picked: string[] = []
        for (let i = 0; i < n; i++) {
          const opts = unused().filter((d) => !picked.includes(d.id)).map((d) => ({ id: d.id, label: `die ${d.value}` }))
          if (node.count === 'all') opts.push({ id: 'done', label: 'Done' })
          const pick = ask(q, { seat, code: codeFor(rc.sourceId, rc.abilityId), point: rc.point, options: opts })
          if (!pick || pick === 'done') break
          picked.push(pick)
        }
        for (const id of picked) {
          const d = st().seats[seat]!.dice.find((x) => x.id === id)!
          let to = d.value
          if (mode === 'reroll') to = rollD6(acc, rc)
          else if (mode.startsWith('set:')) to = Number(mode.slice(4))
          else to = Math.max(1, Math.min(6, d.value + Number(mode)))
          setSeat(acc, seat, { dice: st().seats[seat]!.dice.map((x) => (x.id === id ? { ...x, value: to } : x)) })
          emit(acc, { type: 'DieBoosted', seat, dieId: id, from: d.value, to, source: rc.sourceKind === 'item' ? 'item' : 'ability' })
        }
      }
      return
    }
    case 'addDie': {
      for (const seat of seatsOf(q, node, rc)) {
        const dice = st().seats[seat]!.dice
        const maxN = dice.reduce((m, d) => Math.max(m, Number(d.id.split(':d')[1] ?? 0)), 0)
        const die = { id: `${seat}:d${maxN + 1}`, value: Math.max(1, Math.min(6, numValue(q, node, rc, 1))), used: false }
        setSeat(acc, seat, { dice: [...dice, die] })
        emit(acc, { type: 'DieAdded', seat, die, source: rc.sourceKind === 'item' ? 'item' : 'ability' })
      }
      return
    }
    case 'refundDie': {
      if (!rc.dieId) return
      const s = st().seats[rc.seat]
      const d = s?.dice.find((x) => x.id === rc.dieId)
      if (d?.used) setSeat(acc, rc.seat, { dice: s!.dice.map((x) => (x.id === rc.dieId ? { ...x, used: false } : x)) })
      return
    }
    // ----- lasting rules -----
    case 'forbid': case 'grant': case 'treatFaceAs': {
      const duration = node.duration ?? rc.duration ?? 'game'
      const sc = node.scope
      const base = { name: `${rc.sourceId}#${w.idx}`, sourceId: rc.sourceId, sourceKind: rc.sourceKind, duration } as const
      const kindData = node.op === 'forbid' ? { forbid: [String(node.what)] } : node.op === 'grant' ? { grants: [String(node.what)], data: { value: node.value ?? 1, amount: node.value ?? 1 } } : { grants: ['treatFaceAs'], data: { face: node.face, asFace: node.asFace } }
      if (sc && SEAT_WHO.has(sc.who)) addLasting(acc, { ...base, ...kindData, seats: seatsOf(q, node, rc) })
      else if (sc && LOC_WHO.has(sc.who)) addLasting(acc, { ...base, ...kindData, locations: locationsOf(q, node, rc) })
      else if (sc || rc.survivorId) {
        const ids = survivorsOf(q, node, rc)
        if (ids.length) addLasting(acc, { ...base, ...kindData, survivorIds: ids })
      } else addLasting(acc, { ...base, ...kindData })
      return
    }
    // ----- flow -----
    case 'choose': {
      const opts = (node.options ?? []).filter((o) => evaluateCondition(evalCtxOf(st(), rc), o.requires))
      const seat = chooserSeat(rc, st(), node.scope?.chooser)
      const pick = ask(q, { seat, code: codeFor(rc.sourceId, rc.abilityId), point: rc.point, options: opts.map((o) => ({ id: o.id, label: o.label })) })
      return pick ? opts.find((o) => o.id === pick)!.effect : undefined
    }
    case 'vote': {
      const eligible = (node.scope ? seatsOf(q, node, rc) : nonExiledSeats(st())).filter((s) => !isForbidden(st(), 'vote', { seat: s }))
      if (!eligible.length) return node.options?.[1]?.effect
      const raw = askVotes(q, rc, eligible)
      const yes = eligible.filter((s) => raw[s]).length
      const no = eligible.length - yes
      let tiebreakBy: SeatId | null = null
      let passed = yes > no
      if (yes === no) {
        const order = st().seatOrder
        const start = order.indexOf(st().firstSeat)
        tiebreakBy = order.map((_, i) => order[(start + i) % order.length]!).find((s) => eligible.includes(s)) ?? null
        passed = !!tiebreakBy && !!raw[tiebreakBy]
      }
      emit(acc, { type: 'VotesCast', target: rc.seat, votes: raw }, { type: 'VoteResult', target: rc.seat, yes, no, exiled: false, tiebreakBy })
      later.push({ t: 'window', point: 'vote.result', ctx: { seat: rc.seat, params: { yes, no, passed } } })
      return passed ? node.options?.[0]?.effect : node.options?.[1]?.effect
    }
    case 'exile': {
      for (const seat of seatsOf(q, node, rc)) {
        if (st().seats[seat]!.seat.exiled) continue
        const r = routines.exileSeat(st(), seat); acc.state = r.state; emit(acc, ...r.events)
        if (r.pending) q.acc.pending = r.pending
      }
      return
    }
    case 'endGame': {
      const reason = (node.value as GameEndReason) ?? 'objectiveComplete'
      if (reason === 'objectiveComplete') patch(acc, { objective: { ...st().objective, complete: true } }) // RULE-003: the flag first, then the end
      const r = routines.endGame(st(), reason); acc.state = r.state; emit(acc, ...r.events)
      if (r.pending) q.acc.pending = r.pending
      return
    }
    default: return
  }
}

function askVotes(q: Q, rc: RunCtx, eligible: SeatId[]): Record<SeatId, boolean> {
  if (q.cursor < q.answers.length) return JSON.parse(q.answers[q.cursor++]!) as Record<SeatId, boolean>
  throw new NeedAnswer({ seat: 'all' as SeatId, kind: 'votes', code: 'effectVote', point: rc.point, options: [], context: { data: { eligible } } })
}

// ---------- the job runner ----------
function mkAction(kind: PendingDecision['kind'], decisionId: string, seat: SeatId, optionId: string): Action {
  if (kind === 'itemTarget') return { type: 'itemTarget', decisionId, seat, targets: [optionId], optionId }
  if (kind === 'newLeader') return { type: 'chooseLeader', decisionId, seat, survivorId: optionId }
  if (kind === 'objectiveChoice') return { type: 'objectiveChoice', decisionId, seat, optionId }
  return { type: 'effectChoice', decisionId, seat, optionId }
}
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T

function raise(acc: Acc, spec: AskSpec, jobs: Job[]): PendingDecision {
  const seq = acc.state.decisionSeq + 1
  const id = `d:${seq}`
  const kind = spec.kind ?? (spec.target ? 'itemTarget' : 'effectChoice')
  const window: WindowId = spec.point && isWindow(spec.point) ? spec.point : 'action.playCard'
  const pd: PendingDecision = {
    id, seat: spec.seat, kind, window,
    context: { ...spec.context, data: { ...(spec.context?.data ?? {}), code: spec.code, cont: { jobs: clone(jobs) } } },
    ...(kind === 'votes' ? {} : { options: spec.options.map((o): DecisionOption => ({ id: o.id, label: o.label, action: mkAction(kind, id, spec.seat, o.id) })) }),
    canPass: false,
  }
  acc.state = { ...acc.state, decisionSeq: seq, pending: pd }
  return pd
}

function snapshot(acc: Acc) { return { state: acc.state, n: acc.events.length } }
function restore(acc: Acc, s: { state: GameState; n: number }): void { acc.state = s.state; acc.events.length = s.n }

function rcFor(state: GameState, d: CardEffectDescriptor, ctx: WindowCtx, point: HookPoint): RunCtx {
  return {
    sourceId: d.sourceId, sourceKind: d.source, seat: d.ownerSeat ?? ctx.seat ?? state.activeSeat ?? state.firstSeat, ownerSeat: d.ownerSeat,
    survivorId: d.survivorId, subjectId: ctx.survivorId, targetId: ctx.targetId, location: ctx.location, cardId: d.cardInstanceId ?? ctx.cardId,
    dieId: ctx.dieId, face: ctx.face, params: ctx.params, point, abilityId: d.abilityId, duration: d.duration,
    itemPlay: d.source === 'item' && d.point === 'action', countsAs: d.countsAs,
  }
}

function payCost(q: Q, d: CardEffectDescriptor, rc: RunCtx): void {
  const acc = q.acc
  const c = d.cost
  if (!c) return
  if (c.food) changeFood(acc, -c.food, 'ability')
  if (c.noise) {
    const loc = hereOf(acc.state, rc)
    const l = acc.state.locations[loc]!
    const n = Math.min(c.noise, l.capacity.noiseSpaces - l.noise)
    if (n > 0) { setLoc(acc, loc, { noise: l.noise + n }); emit(acc, { type: 'NoiseAdded', location: loc, count: n, after: l.noise + n, by: rc.survivorId ?? rc.sourceId }) }
  }
  if (c.cards) {
    const seat = rc.ownerSeat ?? rc.seat
    const hand = acc.state.seats[seat]!.hand
    const eq = (rc.survivorId ? acc.state.survivors[rc.survivorId]?.equipped : []) ?? []
    const pool = [...hand, ...eq].filter((x) => x !== rc.cardId && (!c.cards!.symbol || symbolsOf(defOf(acc.state, x)).includes(c.cards!.symbol)))
    const chosen: CardId[] = []
    for (let i = 0; i < c.cards.count; i++) {
      const left = pool.filter((x) => !chosen.includes(x))
      const pick = ask(q, { seat, code: codeFor(d.sourceId, d.abilityId), point: rc.point, options: left.map((id) => ({ id, label: defOf(acc.state, id)?.name ?? id })) })
      if (pick) chosen.push(pick)
    }
    for (const x of chosen) {
      const cls = defOf(acc.state, x)?.class
      discardTo(acc, seat, x, cls === 'event' || acc.state.seats[seat]!.seat.exiled ? 'removed' : 'waste', 'cost')
    }
  }
  if (c.removeSelf && rc.survivorId) {
    const r = routines.removeSurvivor(acc.state, rc.survivorId, d.sourceId); acc.state = r.state; emit(acc, ...r.events)
  }
}

function execJob(acc: Acc, job: Job, jobs: Job[]): void {
  switch (job.t) {
    case 'run': {
      const later = (job.later ??= [])
      while (job.work.length) {
        const w = job.work[0]!
        const snap = snapshot(acc)
        const laterN = later.length
        const q = mkQ(acc, w.answers, job.rc)
        const next = job.work.slice(1)
        try { execNode(q, w, next, job.rc, later) } catch (e) { restore(acc, snap); later.length = laterN; throw e }
        job.work = next
        if (acc.pending || acc.state.phase === 'ended') return
      }
      jobs.shift()
      jobs.unshift(...later)
      return
    }
    case 'fire': {
      const d = job.desc
      const snap = snapshot(acc)
      const q = mkQ(acc, job.answers, job.rc)
      try {
        if (d.optional && !job.activated && !yesNo(q, job.rc, codeFor(d.sourceId, d.abilityId))) { jobs.shift(); return }
        payCost(q, d, job.rc)
      } catch (e) { restore(acc, snap); throw e }
      let uses = 0
      if (d.limit) uses = bumpUse(acc, d)
      if (d.abilityId && d.source === 'survivor' && d.survivorId) emit(acc, { type: 'AbilityUsed', survivorId: d.survivorId, abilityId: d.abilityId, ...(job.rc.dieId ? { dieId: job.rc.dieId } : {}), usesThisRound: uses })
      else if (d.abilityId && d.cardInstanceId && d.survivorId) emit(acc, { type: 'AbilityUsed', survivorId: d.survivorId, abilityId: d.abilityId, usesThisRound: uses, cardId: d.cardInstanceId })
      jobs.shift()
      jobs.unshift({ t: 'run', work: d.effect.map((node, idx) => ({ node, idx, answers: [] })), rc: job.rc, later: [] })
      return
    }
    case 'window': {
      jobs.shift()
      const fires: Job[] = []
      for (const d of collectTriggers(acc.state, job.point)) {
        if (limitBlocked(acc.state, d)) continue
        const rc = rcFor(acc.state, d, job.ctx, job.point)
        if (!evaluateCondition(evalCtxOf(acc.state, rc), d.when)) continue
        fires.push({ t: 'fire', desc: d, rc, answers: [] })
      }
      jobs.unshift(...fires)
      return
    }
    case 'crossroads': {
      jobs.shift()
      checkCrossroads(acc, job.point, job.ctx, jobs)
      return
    }
  }
}

/** Run jobs until they finish (null) or one needs an answer / a routine raised a decision (the pending, already in state). */
export function runJobs(acc: Acc, jobs: Job[]): PendingDecision | null {
  let guard = 0
  while (jobs.length) {
    if (++guard > 2000) throw new Error('effects: job loop did not terminate')
    try { execJob(acc, jobs[0]!, jobs) } catch (e) {
      if (e instanceof NeedAnswer) return raise(acc, e.spec, jobs)
      throw e
    }
    if (acc.pending) { acc.state = { ...acc.state, pending: acc.pending }; return acc.pending }
    if (acc.state.phase === 'ended') return acc.state.pending
  }
  return null
}

export function runToResult(state: GameState, jobs: Job[], pre?: GameEvent[]): ActionResult {
  const acc = mkAcc(state)
  if (pre) acc.events.push(...pre)
  const pending = runJobs(acc, jobs)
  return { state: acc.state, events: acc.events, ...(pending ? { pending } : {}) }
}

// ---------- public API ----------
/** Window jobs for a resolved action: generic triggers in `extra` windows, then in `point`, then the held Crossroads card (FAQ 2.1.1). */
export function afterActionJobs(point: WindowId, ctx: WindowCtx, extra: WindowId[] = []): Job[] {
  return [...extra.map((p): Job => ({ t: 'window', point: p, ctx })), { t: 'window', point, ctx }, { t: 'crossroads', point, ctx }]
}
/** Call after any turn action has fully resolved. Fires triggers bound to `point`, then evaluates the held Crossroads card. */
export function afterAction(state: GameState, point: WindowId, ctx: WindowCtx = {}): ActionResult {
  return runToResult(state, afterActionJobs(point, ctx))
}
/** Fire the triggers bound to a rule window (exposure.rolled, wound.taken, turn.start, ...). No Crossroads check. */
export function fireWindow(state: GameState, point: WindowId, ctx: WindowCtx = {}): ActionResult {
  return runToResult(state, [{ t: 'window', point, ctx }])
}

/** hooks.ts `applyEffects` body: run one descriptor's effect list. A suspension leaves its decision in `state.pending`. */
export function applyEffects(ctx: HookContext, descriptor: CardEffectDescriptor): HookResult {
  const e = ctx as EvalCtx
  const rc = rcFor(ctx.state, descriptor, { seat: ctx.seat, survivorId: ctx.survivorId, targetId: ctx.targetId, location: ctx.location, cardId: ctx.cardId, dieId: ctx.dieId, face: ctx.face, params: ctx.params }, ctx.point)
  if (e.ownerSeat === undefined && descriptor.ownerSeat === undefined) rc.seat = ctx.seat
  const r = runToResult(ctx.state, [{ t: 'run', work: descriptor.effect.map((node, idx) => ({ node, idx, answers: [] })), rc, later: [] }])
  return { state: r.state, events: r.events }
}

/** Run a plain node list for a source (crisis fail effects, objective setup, Crossroads options). */
export function runEffectNodes(state: GameState, nodes: EffectNode[], rc: RunCtx, post: Job[] = [], pre: GameEvent[] = []): ActionResult {
  return runToResult(state, [{ t: 'run', work: nodes.map((node, idx) => ({ node, idx, answers: [] })), rc, later: [] }, ...post], pre)
}

/** Colony step 3: the crisis card's fail or bonus effect (emits CrisisEffectApplied). */
export function runCrisisEffect(state: GameState, crisisId: Id, kind: 'fail' | 'bonus'): ActionResult {
  const d = crisisDescriptor(state, crisisId)
  if (!d) return { state, events: [] }
  const nodes = kind === 'fail' ? d.fail : d.bonus?.effect ?? []
  const rc: RunCtx = { sourceId: crisisId, sourceKind: 'crisis', seat: state.activeSeat ?? state.firstSeat, point: 'colony.crisis', duration: 'instant' }
  return runEffectNodes(state, nodes, rc, [], [{ type: 'CrisisEffectApplied', cardId: crisisId, kind }])
}

/** The checks `activateDescriptor` runs before anything is charged (forbid, use limit, location, `when`, non-die costs): null = usable now. */
export function checkDescriptor(state: GameState, d: CardEffectDescriptor, ctx: WindowCtx = {}): Rejection | null {
  const seat = d.ownerSeat ?? ctx.seat ?? state.activeSeat ?? state.firstSeat
  const sv = d.survivorId ? state.survivors[d.survivorId] : undefined
  if (isForbidden(state, 'useAbility', { seat, survivorId: d.survivorId })) return rejection('E_FORBIDDEN', 'abilities are forbidden right now')
  if (limitBlocked(state, d)) return rejection('E_ABILITY_USED', 'already used')
  if (sv && !locationOk(sv, d.location)) return rejection('E_ABILITY_LOCATION', 'wrong location for this ability')
  const rc = rcFor(state, d, { ...ctx, seat, location: ctx.location ?? sv?.location }, 'action')
  if (!evaluateCondition(evalCtxOf(state, rc), d.when)) return rejection('E_CARD_NOT_PLAYABLE', 'the ability cannot be used now')
  if (d.cost?.food && state.food < d.cost.food) return rejection('E_NO_FOOD', 'not enough food')
  if (d.cost?.cards) {
    const hand = state.seats[seat]!.hand
    const eq = sv?.equipped ?? []
    const n = [...hand, ...eq].filter((c) => c !== d.cardInstanceId && (!d.cost!.cards!.symbol || symbolsOf(defOf(state, c)).includes(d.cost!.cards!.symbol))).length
    if (n < d.cost.cards.count) return rejection('E_NOT_IN_HAND', 'missing the card the ability costs')
  }
  return null
}

/** Use an ability or an equipped item's action ability (`useAbility`): checks, pays non-die costs, runs the effect, fires `action.<type>`. The caller has already charged the die. */
export function activateDescriptor(state: GameState, d: CardEffectDescriptor, ctx: WindowCtx = {}): ActionResult {
  const seat = d.ownerSeat ?? ctx.seat ?? state.activeSeat ?? state.firstSeat
  const sv = d.survivorId ? state.survivors[d.survivorId] : undefined
  const bad = checkDescriptor(state, d, ctx)
  if (bad) return { state, events: [], rejection: bad }
  const rc = rcFor(state, d, { ...ctx, seat, location: ctx.location ?? sv?.location }, 'action')
  const point: WindowId = d.countsAs ? (`action.${d.countsAs}` as WindowId) : 'action.ability'
  const wctx: WindowCtx = { seat, survivorId: d.survivorId, location: rc.location, dieId: ctx.dieId }
  return runToResult(state, [{ t: 'fire', desc: d, rc, answers: [], activated: true }, ...afterActionJobs(point, wctx)])
}

/** Does `state.pending` belong to this module (an effect waiting for a choice / vote)? */
export function isEffectPending(state: GameState): boolean {
  return !!(state.pending.context.data as { cont?: unknown } | undefined)?.cont
}

/** Answer a pending effect decision: effectChoice, itemTarget, objectiveChoice, chooseLeader (newLeader) or castVotes (effect vote). */
export function resumeEffects(state: GameState, action: Action): ActionResult {
  const pd = state.pending
  const cont = (pd.context.data as { cont?: { jobs: Job[] } } | undefined)?.cont
  if (!cont) return reject(state, 'E_WRONG_DECISION', 'no effect is waiting for an answer')
  if (action.decisionId !== pd.id) return reject(state, 'E_WRONG_DECISION', 'stale decision id')
  if (action.seat !== pd.seat) return reject(state, 'E_NOT_YOUR_DECISION', 'not your decision')
  let answer: string | undefined
  switch (action.type) {
    case 'effectChoice': case 'objectiveChoice': answer = action.optionId; break
    case 'itemTarget': answer = action.optionId ?? action.targets[0]; break
    case 'chooseLeader': answer = action.survivorId; break
    case 'castVotes': answer = JSON.stringify(action.votes); break
    default: return reject(state, 'E_WRONG_DECISION', `${action.type} does not answer this decision`)
  }
  if (pd.kind === 'votes') {
    const eligible = ((pd.context.data as { eligible?: SeatId[] }).eligible ?? [])
    const votes = (action as { votes: Record<SeatId, boolean> }).votes
    if (eligible.some((s) => typeof votes[s] !== 'boolean')) return reject(state, 'E_BAD_PAYLOAD', 'a ballot is missing')
  } else if (answer === undefined || !(pd.options ?? []).some((o) => o.id === answer)) return reject(state, 'E_NOT_AN_OPTION', 'not one of the offered options')
  const jobs = clone(cont.jobs)
  const first = jobs[0]!
  if (first.t === 'run') first.work[0]!.answers.push(answer) ; else if (first.t === 'fire') first.answers.push(answer)
  return runToResult(state, jobs)
}

// ---------- shared validation helpers for the action handlers ----------
export const rejection = (code: RejectionCode, message: string, detail?: Record<string, unknown>): Rejection => ({ code, message, ...(detail ? { detail } : {}) })
/** The generic decision checks every handler starts with (00 §5): game over, decision id, seat, decision kind. */
export function checkDecision(state: GameState, a: { decisionId: string; seat: string }, kinds: PendingDecision['kind'][]): Rejection | null {
  if (state.phase === 'ended') return rejection('E_GAME_OVER', 'the game is over')
  if (a.decisionId !== state.pending.id) return rejection('E_WRONG_DECISION', 'stale decision id')
  if (state.pending.seat !== a.seat) return rejection('E_NOT_YOUR_DECISION', 'it is not your decision')
  if (!kinds.includes(state.pending.kind)) return rejection('E_WRONG_DECISION', `no ${kinds.join('/')} decision is open`)
  return null
}
const SURVIVOR_OPS = new Set(['wound', 'heal', 'exposure', 'killSurvivor', 'removeSurvivor', 'moveSurvivor', 'equip'])
/** An item is playable when at least one node with an explicit survivor scope has a candidate (or no node names one). */
export function scopesViable(state: GameState, nodes: EffectNode[], rc: RunCtx): boolean {
  const scoped = nodes.filter((n): n is OpNode => 'op' in n && SURVIVOR_OPS.has(n.op) && !!n.scope)
  if (!scoped.length) return true
  return scoped.some((n) => candidates(state, n.scope!, rc, 'survivor').length > 0)
}
/** The evaluation context for a descriptor's `when` (play conditions, ability conditions). */
export const evalContext = (state: GameState, rc: RunCtx): EvalCtx => evalCtxOf(state, rc)
export const markGiven = (acc: Acc, cardId: CardId): void => {
  patch(acc, { cardUses: { ...acc.state.cardUses, [cardId]: { ...(acc.state.cardUses[cardId] ?? {}), $given: 1 } } })
}
export const wasGiven = (state: GameState, cardId: CardId): boolean => !!state.cardUses[cardId]?.$given
export { patch as patchState, setSeat as setSeatState, emit as emitEvent }

// ---------- wiring into exposure.ts's service seam ----------
/** The members of exposure.ts `EngineServices` this module implements; installed when the module loads (it keeps whatever else is wired). */
export function effectServices() {
  return {
    grant: (state: GameState, what: string, q: { survivorId?: SurvivorId; seat?: SeatId }): { sourceId: Id } | null => {
      const hit = grantEntries(state, what, q)[0]
      return hit ? { sourceId: hit.sourceId } : null
    },
    forbidden: (state: GameState, what: string, q: { survivorId?: SurvivorId; seat?: SeatId; location?: LocationId }): boolean => isForbidden(state, what, q),
    fire: (state: GameState, point: WindowId, ctx: WindowCtx = {}) => {
      const r = fireWindow(state, point, ctx)
      return { state: r.state, events: r.events, ...(r.pending ? { pending: r.pending } : {}) }
    },
    searchBonus: (state: GameState, survivorId: SurvivorId): { look: number; keep: number } => ({
      look: grantTotal(state, 'extraSearchLook', { survivorId }), keep: 1 + grantTotal(state, 'extraSearchKeep', { survivorId }),
    }),
    valueMinus: (state: GameState, survivorId: SurvivorId, which: 'attack' | 'search'): number =>
      grantTotal(state, which === 'attack' ? 'attackValueMinus' : 'searchValueMinus', { survivorId }),
  }
}
setServices({ ...exposureServices(), ...(effectServices() as object) })
