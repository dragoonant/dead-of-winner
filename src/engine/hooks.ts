// FROZEN after M0: the card-effects descriptor types (spec 21 freezes the VALUES of each vocabulary after the
// first-slice dry run; new members are additive) and the code-hook registry (00 §8–§9).
// Items, crises, Crossroads options, objectives and survivor abilities are declarative JSON built from these
// types; `{ "code": "<hook>" }` is the escape hatch, registered in src/engine/code-hooks.ts.
import type { GameEvent } from './events'
import type {
  CardId, DieId, EffectDuration, ExposureFace, GameState, Id, ItemSymbol, LocationId, PendingDecision, SeatId, SurvivorId, WindowId, WoundKind,
} from './types'
import { WINDOW_IDS } from './types'

// ---------- hook points ----------
// 'passive' = always on while the source is in play; 'action' = used as a turn action (survivor abilities, items with a use)
export type TriggerWindow = WindowId | 'passive' | 'action'
export const HOOK_POINTS: readonly TriggerWindow[] = ['passive', 'action', ...WINDOW_IDS]
export type HookPoint = TriggerWindow

// ---------- conditions ----------
export type ConditionTest =
  | 'atLocation' | 'isColony' | 'isNonColony' | 'locationIs' | 'survivorIs' | 'survivorOwnedBy' | 'survivorHasKeyword'
  | 'woundsAtLeast' | 'woundsAtMost' | 'hasFrostbite' | 'hasEquipped' | 'equippedAtLeast' | 'influenceAtLeast' | 'influenceAtMost'
  | 'exposureFace' | 'exposureReason' | 'woundKind' | 'movedThisTurn' | 'actionWas' | 'symbolDrawn' | 'cardKeptHasSymbol'
  | 'handAtLeast' | 'handAtMost' | 'handHasSymbol' | 'foodAtLeast' | 'foodAtMost' | 'moraleAtLeast' | 'moraleAtMost'
  | 'roundsLeftAtMost' | 'roundsLeftAtLeast' | 'starvationAtLeast' | 'wasteAtLeast' | 'zombiesAtLeast' | 'zombiesAtMost'
  | 'barricadesAtLeast' | 'noiseAtLeast' | 'helplessAtLeast' | 'survivorsAtLeast' | 'survivorsAtMost' | 'emptySurvivorSpace'
  | 'seatIsExiled' | 'seatCountAtLeast' | 'dieAtLeast' | 'hasUnusedDie' | 'crisisPrevented' | 'objectiveCounterAtLeast'
  | 'isActiveSeat' | 'isFirstSeat' | 'isLeader' | 'variantIs'
export type Subject = 'self' | 'survivor' | 'target' | 'seat' | 'activeSeat' | 'holder' | 'location' | 'colony' | 'card'
export type ConditionNode =
  | { all: ConditionNode[] }
  | { any: ConditionNode[] }
  | { not: ConditionNode }
  | { code: string; params?: Record<string, unknown> }
  | { test: ConditionTest; subject?: Subject; value?: unknown; location?: LocationId; symbol?: ItemSymbol; face?: ExposureFace }

// ---------- effects ----------
export type EffectOp =
  // colony resources and tracks
  | 'morale' | 'food' | 'starvation' | 'roundTrack' | 'objectiveCounter'
  // zombies, barricades, noise
  | 'addZombies' | 'killZombies' | 'moveZombies' | 'addBarricade' | 'removeBarricade' | 'addNoise' | 'removeNoise'
  // survivors
  | 'wound' | 'heal' | 'exposure' | 'killSurvivor' | 'removeSurvivor' | 'addSurvivor' | 'addHelpless' | 'removeHelpless'
  | 'moveSurvivor' | 'newLeader'
  // cards
  | 'draw' | 'drawFromDeck' | 'discard' | 'removeCard' | 'giveCard' | 'stealCard' | 'contribute' | 'peekDeck' | 'revealDeck'
  | 'shuffleDeck' | 'cleanWaste' | 'equip' | 'extraSearchKeep' | 'extraSearchLook'
  // dice
  | 'modDie' | 'addDie' | 'refundDie'
  // lasting rules
  | 'forbid' | 'grant' | 'treatFaceAs'
  // flow
  | 'choose' | 'vote' | 'exile' | 'endGame'
export type ForbidWhat =
  | 'move' | 'search' | 'attack' | 'attackSurvivor' | 'barricade' | 'cleanWaste' | 'attract' | 'request' | 'callVote' | 'vote'
  | 'playCard' | 'contribute' | 'useAbility' | 'spendFood' | 'addSurvivor' | 'addHelpless' | 'heal'
export type GrantWhat =
  | 'noExposureOnMove' | 'noExposureOnKill' | 'noExposureOnAbility' | 'biteIsWound' | 'frostbiteIsWound' | 'nonBiteIsBlank'
  | 'extraSearchKeep' | 'extraSearchLook' | 'extraMove' | 'killTwoPerAttack' | 'fourWoundsToDie' | 'copyAbilitiesAtLocation'
  | 'attackValueMinus' | 'searchValueMinus' | 'freeBarricade' | 'moveRollWound' | 'noMoraleOnDeath' | 'extraDie'
export type ScopeWho =
  | 'self' | 'survivor' | 'target' | 'seatSurvivors' | 'allSurvivors' | 'atLocation' | 'lowestInfluenceAtLocation'
  | 'highestInfluenceAtLocation' | 'seat' | 'activeSeat' | 'allSeats' | 'otherSeats' | 'nonExiledSeats' | 'location'
  | 'allLocations' | 'nonColonyLocations' | 'colony' | 'chosen'
export interface ScopeNode {
  who: ScopeWho
  location?: LocationId
  filter?: ConditionNode
  count?: number | 'all'
  chooser?: 'activeSeat' | 'owner' | 'engine' // 'chosen' scopes raise an `effectChoice` / `itemTarget` for the chooser
}
export type EffectNode =
  | { code: string; params?: Record<string, unknown> }
  | {
      op: EffectOp
      value?: number | string // amount, counter name, die expression ("d6"), option id
      kind?: WoundKind
      symbol?: ItemSymbol
      face?: ExposureFace // treatFaceAs: from
      asFace?: ExposureFace // treatFaceAs: to
      location?: LocationId | 'here' | 'chosen'
      scope?: ScopeNode
      what?: ForbidWhat | GrantWhat
      duration?: EffectDuration
      count?: number | 'all'
      then?: EffectNode[] // follow-up effects (e.g. after a roll)
      onRoll?: { atLeast?: number; atMost?: number; then: EffectNode[] } // 'exposure' / d6 ops: branch on the result
      options?: { id: string; label: string; effect: EffectNode[]; requires?: ConditionNode }[] // op 'choose'
      optional?: boolean // the seat may decline
    }

// ---------- descriptors ----------
export type DescriptorSource = 'item' | 'crisis' | 'crossroads' | 'survivor' | 'objective' | 'secretObjective' | 'exiledObjective' | 'rule'
export type UseLimit = 'oncePerTurn' | 'oncePerRound' | 'oncePerGame'
export type AbilityLocation = 'anywhere' | 'colony' | 'nonColony' | LocationId
export interface DescriptorCost { die?: number; cards?: { symbol?: ItemSymbol; count: number }; food?: number; removeSelf?: boolean; noise?: number }
/** An action ability that also counts as a turn action: the engine charges that action's die and reaches its `action.*` window (21 §8). */
export type CountsAs = 'attack' | 'search' | 'barricade' | 'move' | 'cleanWaste' | 'attract'

/** One normalised trigger, built from a card or ability record and bound to its holder. */
export interface CardEffectDescriptor {
  sourceId: Id
  source: DescriptorSource
  abilityId?: Id // the ability record's id on the card or survivor (`useAbility {abilityId}` addresses it; sources with one ability may omit it)
  cardInstanceId?: CardId // the card instance carrying the effect (items): `limit` uses are kept in GameState.cardUses[cardInstanceId][abilityId] and travel with the card (R7.6)
  countsAs?: CountsAs
  ownerSeat?: SeatId // the seat holding the source (hand, equipped, secret objective)
  survivorId?: SurvivorId // the survivor carrying the ability or the equipped item
  point: HookPoint
  when?: ConditionNode
  effect: EffectNode[]
  scope: ScopeNode
  duration: EffectDuration
  optional: boolean // true → the owner is asked (effectChoice) before it fires
  limit?: UseLimit
  cost?: DescriptorCost
  location?: AbilityLocation // survivor abilities: where the survivor must be
}

/** A Crossroads card: a trigger predicate evaluated after each resolved action, then its options (E.10; R p12: MOST cards offer two). */
export interface CrossroadsOptionDescriptor { id: string; effect: EffectNode[]; requires?: ConditionNode; vote?: boolean }
export interface CrossroadsDescriptor {
  id: Id
  /** The seat that controls this survivor makes the choice instead of the active seat (Dynamite, Thomas Heart: "the choice belongs to the player who controls ..."). Additive, M8. */
  decider?: Id
  point: HookPoint
  when: ConditionNode
  options: CrossroadsOptionDescriptor[] // ≥1; `CrossroadsResolved.forced` = only one option was possible (the others failed `requires`, or the card has one)
  mature?: boolean
}

/** A crisis card: the prevent symbols, the fail effect and the optional bonus (E.4 step 3). */
export interface CrisisDescriptor { id: Id; prevent: ItemSymbol[]; fail: EffectNode[]; bonus?: { extraCards: number; effect: EffectNode[] } }

/** An objective (main side, secret, betrayal or exiled): completion is a condition over counters and state (spec 11). */
export interface ObjectiveDescriptor {
  id: Id
  kind: 'main' | 'secret' | 'betrayal' | 'exiled'
  requiresMain?: boolean // secret objectives usually also need the main objective (E.12)
  counters?: Record<string, { need: number | 'perSeat'; perSeatMultiplier?: number }>
  complete: ConditionNode
  triggers?: CardEffectDescriptor[] // e.g. "after every zombie kill roll a d6, on 4+ add a sample" (We Need More Samples)
  setup?: EffectNode[] // morale, rounds, extra zombies at setup
}

// ability.kind → hook points it may bind to; 'triggered' binds to its own `trigger` field.
export type AbilityKind = 'passive' | 'action' | 'triggered'
export const KIND_HOOK_POINTS: Record<AbilityKind, readonly HookPoint[] | 'fromTrigger'> = {
  passive: ['passive'],
  action: ['action'],
  triggered: 'fromTrigger',
}

/** Every `action.*` window (a Crossroads card may trigger after any resolved action, FAQ 2.1.1). */
export const ACTION_WINDOWS: readonly HookPoint[] = WINDOW_IDS.filter((w) => w.startsWith('action.'))

// effect op → hook points where it is meaningful (validate-data warns on others; empty = anywhere).
export const OP_HOOK_POINTS: Partial<Record<EffectOp, readonly HookPoint[]>> = {
  treatFaceAs: ['passive', 'exposure.rolled'],
  extraSearchKeep: ['passive', 'action', 'search.drawn', 'search.kept'],
  extraSearchLook: ['passive', 'action', 'search.drawn'],
  modDie: ['action', 'dice.rolled', 'turn.start', 'passive'],
  addDie: ['action', 'dice.rolled', 'card.played'],
  contribute: ['action', 'turn.end'],
  vote: ['action', 'crisis.resolved', ...ACTION_WINDOWS],
  exile: ['vote.result', 'action'],
}

// ---------- runtime hook context ----------
export interface HookContext {
  state: GameState
  point: HookPoint
  seat: SeatId // the seat the hook acts for (owner or active seat)
  survivorId?: SurvivorId
  targetId?: SurvivorId
  location?: LocationId
  cardId?: Id
  dieId?: DieId
  face?: ExposureFace
  params?: Record<string, unknown>
}
/** `pending` = a decision a routine raised inside the hook (a bite chain, a new leader); `then` = effect nodes to run right after the hook (additive, M8: lets a hook decide what happens and let the interpreter do it). */
export interface HookResult { state: GameState; events: GameEvent[]; pending?: PendingDecision; then?: EffectNode[] }

/** Code escape hatch ({code, params}); implementations live in src/engine/code-hooks.ts. */
export type CodeConditionHook = (ctx: HookContext, params: Record<string, unknown>) => boolean
/** What a code hook may do to ask a seat a question (additive, M8): the interpreter re-runs the hook from the same state once the answer is in, so a hook that asks must be deterministic up to the ask. `null` = no option to offer. */
export interface HookIO { ask(seat: SeatId, options: { id: string; label: string }[]): string | null }
export type CodeEffectHook = (ctx: HookContext, params: Record<string, unknown>, io?: HookIO) => HookResult
/** `params` (additive, M1) = the `{code, params}` node's params, so one hook serves every card that names it with a different number. */
export type CodeObjectiveHook = (state: GameState, seat: SeatId | null, params?: Record<string, unknown>) => { complete: boolean; parts: { label: string; have: number; need: number }[] }
export interface CodeHookRegistry {
  conditions: Record<string, CodeConditionHook>
  effects: Record<string, CodeEffectHook>
  objectives: Record<string, CodeObjectiveHook>
}

// ---------- signatures (bodies land in M1) ----------
export function collectTriggers(_state: GameState, _point: HookPoint, _subject?: { seat?: SeatId; survivorId?: SurvivorId; location?: LocationId }): CardEffectDescriptor[] {
  throw new Error('hooks.collectTriggers: not implemented (M1)')
}
export function evaluateCondition(_ctx: HookContext, _node: ConditionNode | undefined): boolean {
  throw new Error('hooks.evaluateCondition: not implemented (M1)')
}
export function applyEffects(_ctx: HookContext, _descriptor: CardEffectDescriptor): HookResult {
  throw new Error('hooks.applyEffects: not implemented (M1)')
}
