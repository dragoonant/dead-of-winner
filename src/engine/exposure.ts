// Exposure rolls, the bite chain (R8) and the seams to the modules other agents own (kill routine, grants, windows).
// ONE exposure routine: rollExposureFor / exposureInto. Everything that rolls the exposure die goes through here.
// The state helpers (Out, newPending, patch*) are shared by zombies.ts and actions/*.ts.
import type { BiteSpreadAction } from './actions'
import type { GameEvent } from './events'
import { bundleFor } from './bundles'
import { EXPOSURE_FACE_COUNT, rollExposure } from './rng'
import { changeMorale, killSurvivor } from './survivors'
import type {
  BiteChain, CardId, DataRecord, EntranceState, ExposureFace, ExposureOdds, ExposureReason, GameState, Id, KillCause, LocationId,
  LocationState, MoraleReason, PendingDecision, Rejection, SeatId, SurvivorId, SurvivorState, WindowId,
} from './types'
import { EngineInvariantError } from './types'
import type { ForbidWhat, GrantWhat } from './hooks'

// ---------- result accumulator ----------
/** What every routine returns and every `*Into` routine mutates: the new state, the events in order, and a decision if one was raised. */
export interface Out { state: GameState; events: GameEvent[]; pending?: PendingDecision }
export const startOut = (state: GameState): Out => ({ state, events: [] })
export function mergeInto(acc: Out, out: Out): void {
  acc.state = out.state
  acc.events.push(...out.events)
  if (out.pending) acc.pending = out.pending
}
export const isOver = (s: GameState): boolean => s.phase === 'ended'
/** A routine stops continuing a multi-step resolution once the game is over or a decision is open. */
export const halted = (acc: Out): boolean => isOver(acc.state) || acc.pending !== undefined

// ---------- immutable state helpers ----------
export const patchSurvivor = (s: GameState, id: SurvivorId, patch: Partial<SurvivorState>): GameState => ({
  ...s, survivors: { ...s.survivors, [id]: { ...s.survivors[id]!, ...patch } },
})
export const patchLocation = (s: GameState, id: LocationId, patch: Partial<LocationState>): GameState => ({
  ...s, locations: { ...s.locations, [id]: { ...s.locations[id]!, ...patch } },
})
export function patchEntrance(s: GameState, loc: LocationId, index: number, patch: Partial<EntranceState>): GameState {
  const l = s.locations[loc]!
  return patchLocation(s, loc, { entrances: l.entrances.map((e) => (e.index === index ? { ...e, ...patch } : e)) })
}
export const aliveAt = (s: GameState, loc: LocationId): SurvivorState[] =>
  Object.values(s.survivors).filter((v) => v.status === 'alive' && v.location === loc)

/** Allocates the next decision id and stores the counter; `build` receives the id so option actions can carry it. */
export function raisePending(acc: Out, build: (id: string) => Omit<PendingDecision, 'id'>): PendingDecision {
  const id = `d:${acc.state.decisionSeq + 1}`
  const pending: PendingDecision = { id, ...build(id) }
  acc.state = { ...acc.state, decisionSeq: acc.state.decisionSeq + 1 }
  acc.pending = pending
  return pending
}

// ---------- data access ----------
export function recordOf(state: GameState, id: Id): DataRecord | undefined {
  try { return bundleFor(state).byId[id] } catch { return undefined }
}
export interface SurvivorStats { influence: number; attack: number; search: number }
export function statsOf(state: GameState, id: SurvivorId): SurvivorStats {
  const stats = (recordOf(state, id) as { stats?: SurvivorStats } | undefined)?.stats
  if (!stats) throw new EngineInvariantError(`no survivor stats in the data bundle for ${id}`)
  return stats
}

// ---------- seams to modules owned elsewhere ----------
export interface GrantQuery { survivorId?: SurvivorId; seat?: SeatId; location?: LocationId; at?: LocationId /* where copied abilities are read from (John Price) */ }
export interface EngineServices {
  /** survivors.ts kill routine (R10). May raise a decision (newLeader); callers stop and return it. */
  killSurvivor(state: GameState, id: SurvivorId, cause: KillCause): Out
  /** morale loss with the R17.1 morale-zero ending. */
  loseMorale(state: GameState, amount: number, reason: MoraleReason, sourceId?: Id): Out
  /** effects.ts: the lasting grant in force for the query, with the source that grants it. */
  grant(state: GameState, what: GrantWhat, q: GrantQuery): { sourceId: Id } | null
  forbidden(state: GameState, what: ForbidWhat, q: GrantQuery): boolean
  /** hooks/windows: card and objective triggers keyed by window id. Default: nothing fires. */
  fire(state: GameState, point: WindowId, ctx: { seat?: SeatId; survivorId?: SurvivorId; targetId?: SurvivorId; location?: LocationId; face?: ExposureFace; params?: Record<string, unknown> }): Out
  searchBonus(state: GameState, survivorId: SurvivorId, location: LocationId): { look: number; keep: number }
  /** attack/search value reductions from grants (`attackValueMinus`, `searchValueMinus`). */
  valueMinus(state: GameState, survivorId: SurvivorId, which: 'attack' | 'search'): number
  /** Olivia Brown (M8): a round-long shield that turns a bitten result into a blank by discarding a Medicine card; null = no shield or no Medicine. */
  biteShield?(state: GameState, survivorId: SurvivorId): { state: GameState; events: GameEvent[]; sourceId: Id } | null
  /** The decision to raise when an action resolved and the turn goes on (normally a `turnAction` for the active seat). */
  afterAction(state: GameState, window: WindowId): Omit<PendingDecision, 'id'> | null
}

function passiveEffects(state: GameState, id: SurvivorId): { op?: string; what?: string }[] {
  const ab = (recordOf(state, id) as { ability?: { kind?: string; effect?: { op?: string; what?: string }[]; location?: string } } | undefined)?.ability
  if (!ab || ab.kind !== 'passive' || !Array.isArray(ab.effect)) return []
  return ab.effect
}
function abilityHolders(state: GameState, id: SurvivorId, at: LocationId): SurvivorId[] {
  const own = [id]
  const copies = passiveEffects(state, id).some((e) => e.op === 'grant' && e.what === 'copyAbilitiesAtLocation')
  if (!copies || at === 'colony') return own
  return [...own, ...aliveAt(state, at).filter((v) => v.id !== id).map((v) => v.id)]
}
function effectMatches(e: GameState['effects'][number], q: GrantQuery): boolean {
  if (e.survivorIds && !(q.survivorId && e.survivorIds.includes(q.survivorId))) return false
  if (e.seats && !(q.seat && e.seats.includes(q.seat))) return false
  if (e.locations && !(q.location && e.locations.includes(q.location))) return false
  return true
}

function defaultGrant(state: GameState, what: GrantWhat, q: GrantQuery): { sourceId: Id } | null {
  for (const e of state.effects) if (e.grants?.includes(what) && effectMatches(e, q)) return { sourceId: e.sourceId }
  if (q.survivorId) {
    const sv = state.survivors[q.survivorId]
    if (sv && sv.status === 'alive') {
      for (const holder of abilityHolders(state, q.survivorId, q.at ?? sv.location)) {
        if (passiveEffects(state, holder).some((e) => e.op === 'grant' && e.what === what)) return { sourceId: holder }
      }
    }
  }
  return null
}
function defaultForbidden(state: GameState, what: ForbidWhat, q: GrantQuery): boolean {
  const exiled = q.seat ? state.seats[q.seat]?.seat.exiled === true : false
  for (const e of state.effects) {
    if (!e.forbid?.includes(what) || !effectMatches(e, q)) continue
    if (what === 'move' && exiled) continue // an exiled seat is not stopped by Blizzard (MOVE-009)
    return true
  }
  return false
}

/** FAQ 6.2.1: inside Adding Zombies morale 0 does not end the game at once; colony-phase.ts checks it after sections B, D and F. */
let moraleEndDeferred = false
export const isMoraleEndDeferred = (): boolean => moraleEndDeferred
export function withMoraleEndDeferred<T>(fn: () => T): T {
  const prev = moraleEndDeferred
  moraleEndDeferred = true
  try { return fn() } finally { moraleEndDeferred = prev }
}

function endGame(acc: Out, reason: 'moraleZero'): void {
  if (moraleEndDeferred) return
  const s = acc.state
  acc.events.push({ type: 'GameEnded', reason, objectiveComplete: false, winners: [], morale: s.morale, roundsLeft: s.roundsLeft })
  acc.state = { ...s, phase: 'ended', result: { reason, objectiveComplete: false, winners: [] } }
  raisePending(acc, () => ({ seat: 'all', kind: 'gameOver', window: 'game.end', context: {}, canPass: false }))
}

function defaultLoseMorale(state: GameState, amount: number, reason: MoraleReason, sourceId?: Id): Out {
  const acc = startOut(state)
  const r = changeMorale(state, -amount, reason, sourceId)
  acc.state = r.state
  acc.events.push(...r.events)
  if (r.moraleZero) endGame(acc, 'moraleZero')
  return acc
}

/** survivors.ts is THE kill routine (R10); a follow-up decision it mints (newLeader, exile placement) becomes `pending`; morale 0 ends the game. */
function defaultKill(state: GameState, id: SurvivorId, cause: KillCause): Out {
  const r = killSurvivor(state, id, cause)
  const acc: Out = { state: r.state, events: [...r.events] }
  const decision = r.pending ?? r.decision
  if (decision) acc.pending = decision // the minter already advanced decisionSeq
  if (r.moraleZero) endGame(acc, 'moraleZero')
  return acc
}

function sumAmount(state: GameState, grant: string, q: GrantQuery): number {
  let n = 0
  for (const e of state.effects) if (e.grants?.includes(grant) && effectMatches(e, q)) n += typeof e.data?.amount === 'number' ? e.data.amount : 1
  return n
}

const DEFAULT_SERVICES: EngineServices = {
  killSurvivor: defaultKill,
  loseMorale: defaultLoseMorale,
  grant: defaultGrant,
  forbidden: defaultForbidden,
  fire: (state) => ({ state, events: [] }),
  searchBonus: (state, survivorId, location) => {
    const q = { survivorId, seat: state.survivors[survivorId]?.owner ?? undefined, location }
    return { look: sumAmount(state, 'extraSearchLook', q), keep: 1 + sumAmount(state, 'extraSearchKeep', q) }
  },
  valueMinus: (state, survivorId, which) =>
    sumAmount(state, which === 'attack' ? 'attackValueMinus' : 'searchValueMinus', { survivorId, seat: state.survivors[survivorId]?.owner ?? undefined, location: state.survivors[survivorId]?.location }),
  afterAction: (state, window) => {
    const seat = state.turn?.seat ?? state.activeSeat
    if (!seat || state.phase !== 'playerTurns') return null
    return { seat, kind: 'turnAction', window, context: { seatId: seat }, canPass: false }
  },
}
let services: EngineServices = DEFAULT_SERVICES
/** Wire the real implementations (survivors.ts, effects.ts, hooks) in; unspecified members keep their defaults. */
export function setServices(partial: Partial<EngineServices>): void { services = { ...DEFAULT_SERVICES, ...partial } }
export function resetServices(): void { services = DEFAULT_SERVICES }
export const svc = (): EngineServices => services

export const grantFor = (state: GameState, what: GrantWhat, survivorId: SurvivorId, at?: LocationId): { sourceId: Id } | null => {
  const sv = state.survivors[survivorId]
  return services.grant(state, what, { survivorId, seat: sv?.owner ?? undefined, location: sv?.location, at })
}
export const killInto = (acc: Out, id: SurvivorId, cause: KillCause): void => mergeInto(acc, services.killSurvivor(acc.state, id, cause))
export const loseMoraleInto = (acc: Out, amount: number, reason: MoraleReason, sourceId?: Id): void => mergeInto(acc, services.loseMorale(acc.state, amount, reason, sourceId))
export function fireInto(acc: Out, point: WindowId, ctx: Parameters<EngineServices['fire']>[2] = {}): void {
  if (halted(acc)) return
  mergeInto(acc, services.fire(acc.state, point, ctx))
}

// ---------- wound total, death threshold (R8.6) ----------
export const woundTotal = (sv: SurvivorState): number => sv.wounds + sv.frostbite
export const deathThreshold = (state: GameState, id: SurvivorId): number => (grantFor(state, 'fourWoundsToDie', id) ? 4 : 3)

/** R8.6: a survivor at or over the threshold dies. */
export function deathCheckInto(acc: Out, id: SurvivorId): void {
  const sv = acc.state.survivors[id]
  if (!sv || sv.status !== 'alive' || halted(acc)) return
  if (woundTotal(sv) >= deathThreshold(acc.state, id)) killInto(acc, id, 'wounds')
}
/** Re-run the death check for everyone at the given locations (a move can end Buddy Davis's protection, F 1.1.5). */
export function deathCheckAllAt(acc: Out, locations: LocationId[]): void {
  for (const loc of locations) for (const v of aliveAt(acc.state, loc)) deathCheckInto(acc, v.id)
}

/** One wound or frostbite token and its follow-ups (event, window, death check). */
export function addWoundInto(acc: Out, id: SurvivorId, kind: 'wound' | 'frostbite', source: 'exposure' | 'frostbiteTick' | 'attack' | 'crisis' | 'crossroads' | 'item' | 'ability' | 'objective'): void {
  const sv = acc.state.survivors[id]
  if (!sv || sv.status !== 'alive') return
  const patch = kind === 'wound' ? { wounds: sv.wounds + 1 } : { frostbite: sv.frostbite + 1 }
  acc.state = patchSurvivor(acc.state, id, patch)
  const now = acc.state.survivors[id]!
  acc.events.push({ type: 'WoundTaken', survivorId: id, kind, wounds: now.wounds, frostbite: now.frostbite, source })
  fireInto(acc, 'wound.taken', { survivorId: id, seat: sv.owner ?? undefined, location: sv.location })
  deathCheckInto(acc, id)
}

// ---------- the exposure routine (R8) ----------
/** One exposure roll on a survivor with skips, face changes, wounds, death and the bite chain. `grantAt` = where copied abilities are read from (the origin of a move, MOVE-011). */
export function exposureInto(acc: Out, survivorId: SurvivorId, reason: ExposureReason, opts: { grantAt?: LocationId } = {}): void {
  const sv = acc.state.survivors[survivorId]
  if (!sv || sv.status !== 'alive' || halted(acc)) return
  const skip: GrantWhat | null = reason === 'move' ? 'noExposureOnMove' : reason === 'zombieKill' ? 'noExposureOnKill' : reason === 'ability' ? 'noExposureOnAbility' : null
  if (skip) {
    const g = grantFor(acc.state, skip, survivorId, opts.grantAt)
    if (g) { acc.events.push({ type: 'ExposureSkipped', survivorId, reason, sourceId: g.sourceId }); return }
  }
  const r = rollExposure(acc.state, survivorId, reason)
  acc.state = r.state
  acc.events.push(r.event)
  let face = r.event.face
  const change = (to: ExposureFace, sourceId: Id) => { acc.events.push({ type: 'ExposureFaceChanged', survivorId, from: face, to, sourceId }); face = to }
  if (face === 'bite') { const g = grantFor(acc.state, 'biteIsWound', survivorId, opts.grantAt); if (g) change('wound', g.sourceId) }
  else if (face === 'frostbite') { const g = grantFor(acc.state, 'frostbiteIsWound', survivorId, opts.grantAt); if (g) change('wound', g.sourceId) }
  if (face === 'bite') { const sh = services.biteShield?.(acc.state, survivorId); if (sh) { acc.state = sh.state; acc.events.push(...sh.events); change('blank', sh.sourceId) } }
  if (face === 'wound' || face === 'frostbite') { const g = grantFor(acc.state, 'nonBiteIsBlank', survivorId, opts.grantAt); if (g) change('blank', g.sourceId) }
  fireInto(acc, 'exposure.rolled', { survivorId, seat: sv.owner ?? undefined, location: sv.location, face })
  if (halted(acc)) return
  if (face === 'wound' || face === 'frostbite') addWoundInto(acc, survivorId, face, 'exposure')
  else if (face === 'bite') {
    const location = sv.location
    killInto(acc, survivorId, 'bite')
    startChain(acc, location, survivorId)
  }
}
export function rollExposureFor(state: GameState, survivorId: SurvivorId, reason: ExposureReason, opts: { grantAt?: LocationId } = {}): Out {
  const acc = startOut(state)
  exposureInto(acc, survivorId, reason, opts)
  return acc
}

// ---------- the bite chain (R8.7-R8.11) ----------
/** Next victim: the alive survivor with the lowest influence at the location; Sparky-style `biteIsWound` holders are passed over. */
export function nextBiteTarget(state: GameState, location: LocationId): SurvivorState | null {
  const cands = aliveAt(state, location).filter((v) => !grantFor(state, 'biteIsWound', v.id))
  if (cands.length === 0) return null
  return cands.reduce((best, v) => (statsOf(state, v.id).influence < statsOf(state, best.id).influence ? v : best))
}
function endChain(acc: Out, reason: 'killChoice' | 'blank' | 'noSurvivors'): void {
  const b = acc.state.bite
  if (!b) return
  acc.events.push({ type: 'BiteChainEnded', location: b.location, reason, killed: b.killed })
  acc.state = { ...acc.state, bite: null }
}
function startChain(acc: Out, location: LocationId, originId: SurvivorId): void {
  acc.state = { ...acc.state, bite: { location, originId, currentId: originId, killed: [] } }
  if (halted(acc)) return // a decision (newLeader) is open: resumeBiteChain continues afterwards
  stepChain(acc)
}
function stepChain(acc: Out): void {
  const b = acc.state.bite
  if (!b) return
  const next = nextBiteTarget(acc.state, b.location)
  if (!next) { endChain(acc, 'noSurvivors'); return }
  const influence = statsOf(acc.state, next.id).influence
  acc.events.push({ type: 'BiteSpreadStep', fromId: b.currentId, toId: next.id, location: b.location, influence })
  acc.state = { ...acc.state, bite: { ...b, currentId: next.id } }
  const seat = next.owner!
  raisePending(acc, (id) => ({
    seat, kind: 'biteSpreadOption', window: 'exposure.rolled',
    context: { survivorId: next.id, targetId: b.originId, location: b.location, odds: { exposure: BITE_CHAIN_ODDS } },
    options: [
      { id: 'kill', label: 'Let the bite take this survivor', action: { type: 'biteSpread', decisionId: id, seat, choice: 'kill' } },
      { id: 'roll', label: 'Roll the exposure die: only a blank saves them', action: { type: 'biteSpread', decisionId: id, seat, choice: 'roll' }, odds: { exposure: BITE_CHAIN_ODDS } },
    ],
    canPass: false,
  }))
}
/** After a decision raised inside a kill (newLeader) is answered, continue a chain that was waiting on it. */
export function resumeBiteChain(state: GameState): Out {
  const acc = startOut(state)
  const b = state.bite
  if (b && !isOver(state)) stepChain(acc)
  return acc
}

export function validateBiteSpread(state: GameState, a: BiteSpreadAction): Rejection | null {
  if (state.phase === 'ended') return { code: 'E_GAME_OVER', message: 'the game is over' }
  if (a.decisionId !== state.pending.id) return { code: 'E_WRONG_DECISION', message: 'not the open decision' }
  if (state.pending.kind !== 'biteSpreadOption' || !state.bite) return { code: 'E_WRONG_DECISION', message: 'no bite is spreading' }
  if (a.seat !== state.pending.seat) return { code: 'E_NOT_YOUR_DECISION', message: 'that choice belongs to another seat' }
  if (a.choice !== 'kill' && a.choice !== 'roll') return { code: 'E_BAD_PAYLOAD', message: 'choice must be kill or roll' }
  return null
}
/** biteSpread {kill|roll} (R8.9, R8.10). The caller (step) installs the returned pending or the turn's next decision. */
export function applyBiteSpread(state: GameState, a: BiteSpreadAction): Out {
  const acc = startOut(state)
  const b = state.bite as BiteChain
  const cur = b.currentId
  acc.events.push({ type: 'BiteChoiceMade', seat: a.seat, survivorId: cur, choice: a.choice })
  if (a.choice === 'kill') {
    acc.state = { ...acc.state, bite: { ...b, killed: [...b.killed, cur] } }
    killInto(acc, cur, 'biteChoice')
    endChain(acc, 'killChoice')
    return acc
  }
  const r = rollExposure(acc.state, cur, 'biteChain')
  acc.state = r.state
  acc.events.push(r.event)
  if (r.event.face === 'blank') { endChain(acc, 'blank'); return acc }
  acc.state = { ...acc.state, bite: { ...b, killed: [...b.killed, cur] } }
  killInto(acc, cur, 'exposureChain')
  if (!halted(acc)) stepChain(acc)
  return acc
}

// ---------- closed-form odds (R8.12; the UI shows these, never computes its own) ----------
const FACE_TOTAL = 12
export interface ExposureOddsParams {
  wounds: number
  frostbite: number
  threshold?: number // 3, or 4 under fourWoundsToDie
  skip?: boolean // noExposure grant for this reason: the roll never happens
  biteIsWound?: boolean
  frostbiteIsWound?: boolean
  nonBiteIsBlank?: boolean
}
/** Face probabilities after face-changing grants, and the chance one roll kills the survivor. */
export function exposureOdds(p: ExposureOddsParams): ExposureOdds {
  if (p.skip) return { blank: 1, wound: 0, frostbite: 0, bite: 0, pDeath: 0 }
  const c = { ...EXPOSURE_FACE_COUNT }
  if (p.frostbiteIsWound) { c.wound += c.frostbite; c.frostbite = 0 }
  if (p.biteIsWound) { c.wound += c.bite; c.bite = 0 }
  if (p.nonBiteIsBlank) { c.blank += c.wound + c.frostbite; c.wound = 0; c.frostbite = 0 }
  const threshold = p.threshold ?? 3
  const tokenKills = p.wounds + p.frostbite + 1 >= threshold
  const dying = c.bite + (tokenKills ? c.wound + c.frostbite : 0)
  return { blank: c.blank / FACE_TOTAL, wound: c.wound / FACE_TOTAL, frostbite: c.frostbite / FACE_TOTAL, bite: c.bite / FACE_TOTAL, pDeath: dying / FACE_TOTAL }
}
/** The bite-chain roll: only a blank saves the survivor, no grant changes the faces (R8.10). */
export const BITE_CHAIN_ODDS: ExposureOdds = exposureOdds({ wounds: 0, frostbite: 0, threshold: 1 })
/** State-based odds for one survivor and reason (Sparky, Harman Brooks, Rod Miller, Buddy Davis applied). */
export function exposureOddsFor(state: GameState, survivorId: SurvivorId, reason: ExposureReason = 'zombieKill'): ExposureOdds {
  const sv = state.survivors[survivorId]
  if (!sv) throw new EngineInvariantError(`exposureOddsFor: unknown survivor ${survivorId}`)
  if (reason === 'biteChain') return BITE_CHAIN_ODDS
  const skipGrant: GrantWhat | null = reason === 'move' ? 'noExposureOnMove' : reason === 'zombieKill' ? 'noExposureOnKill' : reason === 'ability' ? 'noExposureOnAbility' : null
  return exposureOdds({
    wounds: sv.wounds, frostbite: sv.frostbite, threshold: deathThreshold(state, survivorId),
    skip: skipGrant ? grantFor(state, skipGrant, survivorId) !== null : false,
    biteIsWound: grantFor(state, 'biteIsWound', survivorId) !== null,
    frostbiteIsWound: grantFor(state, 'frostbiteIsWound', survivorId) !== null,
    nonBiteIsBlank: grantFor(state, 'nonBiteIsBlank', survivorId) !== null,
  })
}
