/**
 * FROZEN CONTRACT (M0). Code hooks: the `{"code": "<hook>"}` escape hatch of the DSL (21.10).
 * The registry itself lives in src/engine/code-hooks.ts (not frozen; DATA-003 checks names).
 * Spec: docs/spec/00-architecture.md §00.8.
 */
import type { Rng } from './rng'
import type {
  DataBundle, Effect, ExposureReason, GameState, HookName, JsonValue,
  KillCause, LocationId, ModifierKind, ResolvedAction, SeatId, SurvivorInstanceId,
} from './types'
import type { EngineEvent } from './events'

/** Evaluation context (21.2): the names a DSL node can refer to, resolved to concrete ids. */
export interface EvalContext {
  /** '<recordId>#<abilityId>' or '<crisisId>#fail', '<xrId>#a', ... */
  sourceKey: string
  self: SurvivorInstanceId | null
  controller: SeatId | null
  active: SeatId | null
  holder: SeatId | null
  actor: SurvivorInstanceId | null
  eventSurvivor: SurvivorInstanceId | null
  eventLocation: LocationId | null
  eventSeat: SeatId | null
  /** The triggering event, if any. */
  event: EngineEvent | null
  /** Resolved-action context for afterAction / Crossroads (21.6.3). */
  lastAction: ResolvedAction | null
  /** `{ref}` bindings: ids, numbers or lists of ids. */
  refs: Record<string, JsonValue>
}

/** Read-only inputs every hook receives. Hooks are pure functions of these (21.10.3). */
export interface HookInput {
  readonly state: Readonly<GameState>
  readonly bundle: DataBundle
  readonly ctx: Readonly<EvalContext>
  readonly rng: Rng
}

/**
 * The only way an effect hook changes the game: it schedules work. Calls are queued in order and
 * run after the hook returns, so a queued op may open a decision (the engine suspends on its stack).
 * Kills, zombie placement and exposure go only through the generic routines (10.0.5).
 */
export interface EffectApi {
  /** Queue any DSL effect (21.7) with this hook's context. */
  run(effect: Effect): void
  killSurvivor(target: SurvivorInstanceId, cause: KillCause): void
  addZombies(location: LocationId, n: number, source: string): void
  rollExposure(target: SurvivorInstanceId, reason: ExposureReason): void
  /** Bind a value for later `{ref}` lookups in the same effect tree. */
  bind(name: string, value: JsonValue): void
}

export interface EffectHook {
  kind: 'effect'
  /** Legality of an action/play whose first op is this hook (21.3.5). Default: true. */
  feasible?(input: HookInput): boolean
  run(input: HookInput, api: EffectApi): void
}
export interface ConditionHook { kind: 'condition'; run(input: HookInput): boolean }
export interface NumHook { kind: 'num'; run(input: HookInput): number }

/** Fixed points where the engine asks modifiers (21.8.1). */
export type ModifierQuery =
  | { point: 'exposure'; survivor: SurvivorInstanceId; reason: ExposureReason }
  | { point: 'search'; survivor: SurvivorInstanceId; location: LocationId }
  | { point: 'woundsToDie'; survivor: SurvivorInstanceId }
  | { point: 'legalActions'; survivor: SurvivorInstanceId }
  | { point: 'stat'; survivor: SurvivorInstanceId; stat: 'attack' | 'search' }
  | { point: 'foodNeeded' }
  | { point: 'abilities'; survivor: SurvivorInstanceId }

/**
 * A modifier hook answers a query with the equivalent built-in modifier payload(s), or null when
 * it does not apply. Example: john-price.copy-abilities answers 'abilities' with ability keys.
 */
export interface ModifierHook {
  kind: 'modifier'
  run(input: HookInput, query: ModifierQuery): { modifier: ModifierKind | 'abilities'; value: JsonValue } | null
}

export type CodeHook = EffectHook | ConditionHook | NumHook | ModifierHook
export type CodeHookRegistry = Readonly<Record<HookName, CodeHook>>

/** Identity helper that type-checks a registry literal. */
export function defineHooks<R extends Record<HookName, CodeHook>>(registry: R): R {
  return registry
}

/** Names referenced by data must match `<area>.<record-slug>.<what>` (21.10.1; schema HookName). */
export const HOOK_NAME_PATTERN = /^[a-z][a-z0-9-]*(\.[a-z0-9-]+)+$/

