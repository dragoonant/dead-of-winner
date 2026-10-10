/**
 * FROZEN CONTRACT (M0). Engine types: ids, data records, the DSL (DRAFT, mirrors spec 21 and
 * docs/spec/schemas/effect.schema.json), game state, seats and the single PendingDecision.
 * Spec: docs/spec/00-architecture.md §00.3–00.5. Any change needs a matching edit to spec 00.
 * Pure types and constants only: no imports from data, DOM or Node.
 */

// ---------------------------------------------------------------------------------------------
// JSON and ids (00.3.1)
// ---------------------------------------------------------------------------------------------

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

/** Seat id, engine-assigned at newGame: 's0', 's1', ... in clockwise turn order. */
export type SeatId = string
/** Content record id from the data bundle (spec 20.3), e.g. 'survivor.daniel-smith'. */
export type ContentId = string
/** Runtime instance of a card copy: '<recordId>@<n>' (20.3.7). */
export type CardInstanceId = string
/** Runtime instance of a survivor in play: '<recordId>@<n>' (20.3.7). */
export type SurvivorInstanceId = string
/** Code hook name '<area>.<record-slug>.<what>' (21.10.1). */
export type HookName = string

export const LOCATION_IDS = ['colony', 'police', 'grocery', 'school', 'gas', 'library', 'hospital'] as const
export type LocationId = (typeof LOCATION_IDS)[number]
export type NonColonyId = Exclude<LocationId, 'colony'>
/** Item deck ids: the starting deck plus the six location decks (20.7.2). */
export type ItemDeckId = 'starting' | NonColonyId

export const SYMBOLS = ['weapon', 'fuel', 'education', 'food', 'medicine', 'tool', 'survivor', 'none'] as const
export type ItemSymbol = (typeof SYMBOLS)[number]
export type PreventSymbol = Exclude<ItemSymbol, 'survivor' | 'none'>

export const FACES = ['blank', 'wound', 'frostbite', 'bitten'] as const
export type Face = (typeof FACES)[number]
export type ExposureReason = 'move' | 'kill' | 'card'
export type WoundKind = 'wound' | 'frostbite'
export type KillCause = 'bite' | 'wounds' | 'overrun' | 'attack' | 'card' | 'removed'
export type GameEndCause = 'morale' | 'rounds' | 'main' | 'card'
export type Status = 'verified' | 'partial' | 'placeholder'
export type SrcMap = { '*': string } & Record<string, string>

/** Turn action kinds; identical to effect.schema.json ActionKind and to Action['type'] (00.5). */
export const ACTION_KINDS = [
  'attackZombie', 'attackSurvivor', 'search', 'barricade', 'cleanWaste', 'attract', 'ability',
  'playCard', 'contribute', 'move', 'spendFood', 'request', 'handOff', 'callVote', 'endTurn',
] as const
export type ActionKind = (typeof ACTION_KINDS)[number]

/** DSL trigger event names (21.5); each maps to one EngineEvent type (events.ts DSL_EVENT_MAP). */
export const DSL_EVENT_NAMES = [
  'turnStarted', 'turnEnded', 'roundStarted', 'actionResolved', 'survivorMoved', 'zombieKilled',
  'survivorWounded', 'exposureRolled', 'survivorKilled', 'survivorAdded', 'cardPlayed',
  'searchResolved', 'crisisRevealed', 'crisisResolved', 'colonyPhaseStarted', 'voteResolved',
  'seatExiled',
] as const
export type DslEventName = (typeof DSL_EVENT_NAMES)[number]

// ---------------------------------------------------------------------------------------------
// Card-effects DSL (DRAFT: mirrors spec 21; freezes at the M2 dry run, 21.12)
// ---------------------------------------------------------------------------------------------

export type Ref = { ref: string }
export type SeatRef =
  | 'active' | 'controller' | 'holder' | 'firstPlayer' | 'leftOfActive' | 'rightOfActive'
  | 'eventSeat' | 'each' | 'eachOther' | 'nonExiled' | 'exiled' | 'any' | Ref
export type Pick = 'chooser' | 'all' | 'lowestInfluence' | 'highestInfluence' | 'random'
export type ExposureMode = 'each' | 'once' | 'none'
export type Limit = 'oncePerTurn' | 'oncePerRound' | 'oncePerGame'

export interface LocFilter {
  nonColony?: boolean
  deckNotEmpty?: boolean
  hasZombies?: boolean
  hasFreeSurvivorSpace?: boolean
  hasFreeEntranceSpace?: boolean
  in?: LocationId[]
  not?: LocationId[]
}
export type LocRef = 'here' | 'eventLocation' | 'actorLocation' | LocationId | Ref | { choose: LocFilter; chooser?: SeatRef }
export type LocRefOrMany = LocRef | 'eachNonColony' | 'everyLocation' | LocationId[]

export interface SurvivorFilter {
  seat?: SeatRef
  at?: LocRefOrMany
  helpless?: boolean
  named?: ContentId
  notSelf?: boolean
  wounded?: boolean
  isLeader?: boolean
  exiledSeat?: boolean
}
interface SelCommon { pick?: Pick; n?: Num; upTo?: boolean; chooser?: SeatRef }
export interface SurvivorsSel extends SelCommon { survivors: SurvivorFilter }
export type SurvivorSel = 'self' | 'actor' | 'eventSurvivor' | 'leader' | Ref | SurvivorsSel
export interface CardFilter {
  from?: 'hand' | 'equipped' | 'handOrEquipped' | 'waste' | 'revealed' | 'drawn'
  seat?: SeatRef
  symbol?: ItemSymbol | ItemSymbol[]
  outsider?: boolean
  equip?: boolean
  named?: ContentId
  of?: Ref
}
export interface CardsSel extends SelCommon { cards: CardFilter }
export type CardSel = Ref | CardsSel
export interface DiceSel { dice: { seat?: SeatRef; unused?: boolean; below?: number }; pick?: Pick; n?: Num; chooser?: SeatRef }
export interface LocationsSel { locations: LocFilter; pick?: Pick; n?: Num; chooser?: SeatRef }
export interface SeatsSel { seats: SeatRef; pick?: Pick; n?: Num; chooser?: SeatRef }
export type Selector = SurvivorsSel | CardsSel | DiceSel | LocationsSel | SeatsSel | Ref

export type NumVar =
  | 'players' | 'startingPlayers' | 'round' | 'roundsLeft' | 'morale' | 'food' | 'waste'
  | 'starvation' | 'colonySurvivors' | 'foodNeeded' | 'exiledSeats'
export type Num =
  | number
  | { var: NumVar }
  | { count: Selector }
  | { progress: string }
  | { zombiesAt: LocRef }
  | { handCount: { seat?: SeatRef; symbol?: ItemSymbol; outsiderCountsAsItem?: boolean } }
  | { add: Num[] }
  | { sub: [Num, Num] }
  | { mul: Num[] }
  | { ceilDiv: [Num, Num] }
  | { neg: Num }
  | { ref: string }
  | { code: HookName }

export type NumPair = [Num, Num]
export type Condition =
  | boolean
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { eq: NumPair } | { gte: NumPair } | { gt: NumPair } | { lte: NumPair } | { lt: NumPair }
  | { at: { survivor: SurvivorSel; location: LocRefOrMany } }
  | { exists: Selector }
  | { action: ActionKind | ActionKind[] }
  | { actor: SurvivorFilter }
  | { exposureFace: Face | Face[] }
  | { searchFound: CardFilter }
  | { eventIs: { survivor?: SurvivorFilter; seat?: SeatRef; location?: LocRefOrMany; cause?: string; face?: Face; reason?: ExposureReason } }
  | { controls: { seat?: SeatRef; survivor?: SurvivorFilter } }
  | { isActiveSeat: SeatRef }
  | { isExiled: SeatRef }
  | { mainObjectiveComplete: boolean }
  | { gameEndedBy: GameEndCause }
  | { original: true }
  | { originalPrivate: true }
  | { code: HookName }

export type Duration =
  | 'instant' | 'whileEquipped' | 'whileAlive' | 'restOfGame'
  | { until: 'endOfTurn' | 'endOfRound' | 'startOfNextTurnOf'; offset?: number; seat?: SeatRef }
export type Scope =
  | { survivors: SurvivorFilter } | { seat: SeatRef } | { location: LocRefOrMany } | { self: true } | { global: true }
export type StatMod = { delta: number } | { set: number }
export type Modifier =
  | { exposureSkip: { reasons: ExposureReason[] } }
  | { exposureFaceReplace: { from: Face; to: Face } }
  | { searchExtra: { look?: number; keep?: number } }
  | { woundsToDie: number }
  | { forbidAction: ActionKind[] }
  | { attackValue: StatMod }
  | { searchValue: StatMod }
  | { afterAction: { action: ActionKind | ActionKind[]; effect: Effect } }
  | { foodNeeded: Num }
  | { code: HookName }
export type KeysOfUnion<T> = T extends unknown ? keyof T : never
export type ModifierKind = KeysOfUnion<Modifier>
export type EffectOp = KeysOfUnion<Effect>

export type Cost =
  | { die: 'any' | { min: number } }
  | { discard: CardsSel }
  | { food: number }
  | { removeSelf: true }
  | { all: Cost[] }

export interface Option { id: string; label?: string; requires?: Condition; effect: Effect }

export type Effect =
  | { seq: Effect[] }
  | { if: { cond: Condition; then: Effect; else?: Effect } }
  | { choice: { who?: SeatRef; decision?: 'crossroadsOption' | 'objectiveChoice' | 'itemTarget'; options: Option[] } }
  | { choose: { as: string; who?: SeatRef; from: Selector | LocRef; decision?: 'itemTarget' | 'objectiveChoice' } }
  | { optional: { who?: SeatRef; effect: Effect } }
  | { forEach: { in: Selector; as?: string; effect: Effect } }
  | { repeat: { times: Num; effect: Effect } }
  | { rollD6: { as?: string; purpose?: string; atLeast?: number; atMost?: number; then?: Effect; else?: Effect } }
  | { vote: { options: Option[] } }
  | { nothing: true }
  | { code: HookName }
  | { morale: Num }
  | { food: Num }
  | { starvation: Num }
  | { cleanWaste: Num }
  | { helpless: { add?: Num; kill?: Num } }
  | { endGame: true }
  | { addZombies: { at: LocRefOrMany; n: Num } }
  | { killZombies: { at: LocRef; n: Num; upTo?: boolean; exposure: ExposureMode; by?: SurvivorSel } }
  | { removeZombies: { at: LocRefOrMany; n: Num; upTo?: boolean } }
  | { moveZombies: { from?: LocRefOrMany; to: LocRef; n: Num; upTo?: boolean } }
  | { barricade: { at: LocRef; n: Num } }
  | { removeBarricade: { at: LocRefOrMany; n: Num } }
  | { noise: { at: LocRefOrMany; delta: Num } }
  | { wound: { target: SurvivorSel; n?: Num; kind?: WoundKind } }
  | { heal: { target: SurvivorSel; n?: Num; kinds?: WoundKind[] } }
  | { kill: { target: SurvivorSel; cause?: 'card' | 'removed' } }
  | { rollExposure: { target: SurvivorSel; times?: Num } }
  | { moveSurvivor: { target: SurvivorSel; to: LocRef; exposure?: boolean; usesMove?: boolean } }
  | { addSurvivor: { seat?: SeatRef; named?: ContentId; n?: Num; drawChoose?: number } }
  | { draw: { from: LocRef | 'starting'; n: Num; seat?: SeatRef } }
  | { reveal: { deck: LocRef; n: Num; as: string; public?: boolean } }
  | { peek: { deck: LocRef; n: Num; who?: SeatRef; then?: 'returnSameOrder' | 'chooseOrder' | 'chooseTopOrBottom' } }
  | { take: { cards: CardSel; to: 'hand' | 'waste' | 'outOfGame' | 'deckBottom' | 'deckTop'; seat?: SeatRef } }
  | { discard: { cards: CardSel; to?: 'waste' | 'outOfGame' } }
  | { giveCards: { cards: CardSel; to: SeatRef } }
  | { shuffleDeck: LocRef }
  | { dieBonus: { dice: DiceSel; n: Num } }
  | { gainDice: { seat?: SeatRef; n: Num } }
  | { loseDice: { seat?: SeatRef; n: Num; pick?: Pick } }
  | { lasting: { id?: string; duration: Duration; scope?: Scope; modifier: Modifier } }
  | { progress: { counter: string; delta: Num } }

export type AbilityTiming = 'action' | 'play' | 'passive' | 'trigger'
export interface Ability {
  id: string
  timing: AbilityTiming
  mech: string
  cost?: Cost
  limit?: Limit
  where?: LocRefOrMany
  on?: DslEventName
  when?: Condition
  requires?: Condition
  optional?: boolean
  effect?: Effect
  modifier?: Modifier
  scope?: Scope
  aiHint?: string
}

// ---------------------------------------------------------------------------------------------
// Data records and the bundle (spec 20; the engine never imports these files, 20.1.2)
// ---------------------------------------------------------------------------------------------

interface RecordCommon { id: ContentId; name: string; mech: string; status: Status; src: SrcMap; notes?: string }

export interface ColonyRecord extends Omit<RecordCommon, 'id'> {
  id: 'colony'
  kind: 'colony'
  survivorSpaces: number
  entrances: { n: number; spaces: number }[]
  moraleMax: number
  roundMax: number
  wasteMoraleStep?: number
}
export interface LocationRecord extends Omit<RecordCommon, 'id'> {
  id: NonColonyId
  kind: 'location'
  order: number
  survivorSpaces: number
  entranceSpaces: number
  noiseSpaces: 4
  symbolRow: ItemSymbol[]
  deckSize: number
}
export interface SurvivorRecord extends RecordCommon {
  profession: string
  influence: number
  attack: number
  search: number
  abilities: Ability[]
  tags?: ('animal' | 'child' | 'outsiderOnly')[]
  text: string
}
export interface ItemRecord extends RecordCommon {
  deck: ItemDeckId
  copies: number
  symbol: ItemSymbol
  equip: boolean
  outsider: boolean
  design?: string
  abilities: Ability[]
  text: string
}
export interface CrisisRecord extends RecordCommon {
  prevent: PreventSymbol
  onReveal?: Effect
  fail: Effect
  overPrevent?: Effect
  text: string
}
export interface CrossroadsRecord extends RecordCommon {
  mature: boolean
  trigger: { at: 'afterAction' | 'turnStart'; when: Condition }
  options: { id: 'a' | 'b' | 'c'; mech: string; requires?: Condition; effect: Effect }[]
  text: { vignette: string; options: Record<string, string> }
}
export interface MainObjectiveRecord extends RecordCommon {
  kind: 'main'
  side: 'normal' | 'hardcore'
  pairId: ContentId
  time: 'short' | 'medium' | 'long'
  setup: {
    morale: number
    rounds: number
    food?: number
    helpless?: number
    zombies?: { colony?: number; eachNonColony?: number; perLocation?: Partial<Record<LocationId, number>> }
    effect?: Effect
  }
  progress?: Record<string, { initial: number; label?: string }>
  hooks?: Ability[]
  complete: Condition
  target?: Num
  coop?: boolean
  text: string
}
export interface SecretObjectiveRecord extends RecordCommon {
  kind: 'secret'
  isBetrayal: false
  requiresMain: boolean
  condition: Condition
  coop?: boolean
  text: string
}
export interface BetrayalObjectiveRecord extends RecordCommon {
  kind: 'betrayal'
  isBetrayal: true
  condition: Condition
  hooks?: Ability[]
  progress?: Record<string, { initial: number; label?: string }>
  text: string
}
export interface ExiledObjectiveRecord extends RecordCommon {
  kind: 'exiled'
  appliesToBetrayal: false
  condition: Condition
  text: string
}
export type ObjectiveRecord = MainObjectiveRecord | SecretObjectiveRecord | BetrayalObjectiveRecord | ExiledObjectiveRecord

/** Persona records are owned by spec 41; the engine treats them as opaque. */
export interface PersonaRecord { id: string; name: string; [key: string]: JsonValue | undefined }

/** Built by src/data/index.ts loadBundle() (20.12) and passed to createEngine. Arrays sorted by id. */
export interface DataBundle {
  version: string
  hash: string
  locations: (ColonyRecord | LocationRecord)[]
  survivors: SurvivorRecord[]
  items: ItemRecord[]
  crises: CrisisRecord[]
  crossroads: CrossroadsRecord[]
  objectives: ObjectiveRecord[]
  personas: PersonaRecord[]
}

// ---------------------------------------------------------------------------------------------
// Game configuration (00.3.2)
// ---------------------------------------------------------------------------------------------

export type SeatKind = 'human' | 'bot'
export interface SeatConfig { kind: SeatKind; name?: string; persona?: string; tier?: string }
export interface VariantFlags {
  coop?: boolean
  twoPlayer?: boolean
  betrayer?: boolean
  hardcore?: boolean
  playerElimination?: boolean
  excludeMature?: boolean
}
/** Test/golden overrides applied after the normal seeded setup (13 §0; 60.3.2). */
export interface SetupOverrides {
  secretObjectives?: Record<SeatId, ContentId>
  survivors?: Record<SeatId, { leader: ContentId; followers?: ContentId[]; at?: Partial<Record<ContentId, LocationId>> }>
  hands?: Record<SeatId, ContentId[]>
  deckTops?: Partial<Record<ItemDeckId | 'crisis' | 'crossroads' | 'survivors', ContentId[]>>
  morale?: number
  roundsLeft?: number
  food?: number
  firstPlayer?: SeatId
  /** Skip the setup decisions (chooseSurvivors, chooseLeader); required when `survivors` is set. */
  skipSetupDecisions?: boolean
}
export interface GameConfig {
  seed: number | string
  seats: SeatConfig[]
  /** A main objective id (normal side id; hardcore picks its pair), or 'random'. */
  mainObjective: ContentId | 'random'
  variants?: VariantFlags
  overrides?: SetupOverrides
  /** Scripted dice for golden tests (13 §0.3). When set, the game rng is a ScriptedRng. */
  script?: RngScript
}

// ---------------------------------------------------------------------------------------------
// RNG state (implemented in rng.ts; stored inside GameState so saves and replays reproduce)
// ---------------------------------------------------------------------------------------------

export type Sfc32State = { kind: 'sfc32'; s: [number, number, number, number] }
export interface RngScript {
  d6?: number[]
  /** Exposure faces or raw d12 values 1..12. */
  d12?: (Face | number)[]
  /** Uniform-choice indices consumed by int(n) (random steal, shuffles). */
  pick?: number[]
}
export type ScriptState = { kind: 'script'; d6: number[]; d12: number[]; pick: number[]; fallback: Sfc32State | null }
export type RngState = Sfc32State | ScriptState

// ---------------------------------------------------------------------------------------------
// Game state (00.3.3). Plain JSON: no Maps, Sets, classes, functions or undefined-as-meaning.
// ---------------------------------------------------------------------------------------------

export type Phase = 'setup' | 'playerTurns' | 'colony' | 'ended'
export type ColonyStep = 'payFood' | 'checkWaste' | 'resolveCrisis' | 'addZombies' | 'checkMain' | 'moveRound' | 'passFirstPlayer'

export interface Die { id: number; value: number; used: boolean }

export interface SeatState {
  id: SeatId
  kind: SeatKind
  name: string
  persona: string | null
  tier: string | null
  exiled: boolean
  eliminated: boolean
  dice: Die[]
}

export interface SurvivorState {
  id: SurvivorInstanceId
  recordId: ContentId
  seat: SeatId
  location: LocationId
  isLeader: boolean
  wounds: number
  frostbite: number
  equipped: CardInstanceId[]
  /** Round the survivor joined (its die comes at the next roll, 10.4.2). */
  joinedRound: number
}

export interface EntranceState { n: number; spaces: number; zombies: number; barricades: number }
export interface LocationState {
  id: LocationId
  survivorSpaces: number
  /** Colony: 6 entrances n=1..6; other locations: exactly one with n=1. */
  entrances: EntranceState[]
  noise: number
  /** Helpless survivor tokens; colony only (10.9.3). */
  helpless: number
}

/** Ordered card zones; index 0 is the top of a deck or pile. Every card instance is in exactly one zone (SIM-005). */
export interface CardZones {
  decks: Record<ItemDeckId, CardInstanceId[]>
  hands: Record<SeatId, CardInstanceId[]>
  waste: CardInstanceId[]
  outOfGame: CardInstanceId[]
  /** Cards drawn by an in-progress search or reveal, before they are kept or returned. */
  limbo: CardInstanceId[]
}

export interface CrisisContribution { seat: SeatId; card: CardInstanceId }
export interface CrisisState { cardId: ContentId; prevent: PreventSymbol; contributions: CrisisContribution[] }

export interface CrossroadsDraw {
  round: number
  activeSeat: SeatId
  holder: SeatId
  card: ContentId
  triggered: boolean
  option: string | null
}
export interface CrossroadsState {
  deck: ContentId[]
  held: { holder: SeatId; card: ContentId } | null
  /** Recap log; hidden in views until GameEnded except triggered entries. */
  draws: CrossroadsDraw[]
}

export interface ObjectivesState {
  main: { id: ContentId; progress: Record<string, number> }
  secret: Record<SeatId, ContentId>
  exiled: Record<SeatId, ContentId>
  exiledDeck: ContentId[]
  /** Undealt secret objectives; never in any view (VIEW-014). */
  boxed: ContentId[]
  /** Per-seat counters for betrayal/secret hooks. */
  seatProgress: Record<SeatId, Record<string, number>>
}

export interface LastingEffect {
  id: string
  /** '<recordId>#<abilityId>' or '<crisisId>#fail' etc. */
  sourceKey: string
  scope: Scope
  /** SeatRefs inside scope resolved to concrete seats at creation (21.2.1). */
  scopeSeats: SeatId[]
  modifier: Modifier
  expires: { kind: 'endOfTurn'; seat: SeatId } | { kind: 'endOfRound'; round: number } | { kind: 'startOfNextTurnOf'; seat: SeatId } | { kind: 'never' }
}

/** Snapshot of the last resolved action for Crossroads and afterAction (21.6.3). */
export interface ResolvedAction {
  kind: ActionKind
  seat: SeatId
  actor: SurvivorInstanceId | null
  from: LocationId | null
  to: LocationId | null
  location: LocationId | null
  exposures: { face: Face; reason: ExposureReason }[]
  drawn: CardInstanceId[]
  kept: CardInstanceId[]
  zombiesKilled: number
  deaths: SurvivorInstanceId[]
  actorDied: boolean
}

export interface TurnState {
  seat: SeatId
  movedSurvivors: SurvivorInstanceId[]
  voteCalled: boolean
  crossroadsResolved: boolean
  actionsTaken: number
  lastAction: ResolvedAction | null
}

/** Engine-internal continuation frame: lets an effect suspend for a decision and resume after it. */
export interface WorkFrame { kind: string; data: JsonValue }

export interface ActionLogEntry { decisionId: number; seat: SeatId | 'all'; action: JsonValue }

export interface GameResult {
  cause: GameEndCause
  round: number
  morale: number
  results: SeatResult[]
}
export interface SeatResult {
  seat: SeatId
  objectiveId: ContentId | null
  exiledObjectiveId: ContentId | null
  isBetrayal: boolean
  won: boolean
}

export interface GameState {
  schema: 1
  bundleHash: string
  config: GameConfig
  rng: RngState
  /** Monotonic counters: next event seq, next decision id, next instance number. */
  seq: { event: number; decision: number; instance: number; die: number }
  phase: Phase
  colonyStep: ColonyStep | null
  round: number
  roundsLeft: number
  morale: number
  moraleMax: number
  food: number
  starvation: number
  /** Clockwise turn order. */
  seats: SeatState[]
  firstPlayer: SeatId
  activeSeat: SeatId | null
  /** Seats that already took their turn this round. */
  turnsTaken: SeatId[]
  turn: TurnState | null
  survivors: Record<SurvivorInstanceId, SurvivorState>
  /** Instance id -> record id for every card copy in the game. */
  cards: Record<CardInstanceId, ContentId>
  zones: CardZones
  /** Survivor deck (record ids, top first). Setup returns go back here. */
  survivorDeck: ContentId[]
  crisisDeck: ContentId[]
  crisis: CrisisState | null
  /** Resolved crises for the end recap: contributions by seat (10.13.3). */
  crisisHistory: (CrisisState & { round: number; total: number; outcome: CrisisOutcome })[]
  locations: Record<LocationId, LocationState>
  crossroads: CrossroadsState
  objectives: ObjectivesState
  lasting: LastingEffect[]
  /** Used limits keyed '<recordId>#<abilityId>@<instance>' -> period stamp (21.3.3). */
  limits: Record<string, string>
  stack: WorkFrame[]
  pending: PendingDecision | null
  log: ActionLogEntry[]
  /** Every vote for the recap. */
  votes: { round: number; caller: SeatId; target: SeatId; ballots: Record<SeatId, BallotChoice>; exiled: boolean }[]
  ended: GameResult | null
}

export type CrisisOutcome = 'failed' | 'prevented' | 'bonus'

// ---------------------------------------------------------------------------------------------
// Decisions (00.4). Exactly one PendingDecision while the game is open.
// ---------------------------------------------------------------------------------------------

/** Frozen decision kinds (C.4; 10.15). */
export const DECISION_KINDS = [
  'chooseSurvivors', 'chooseLeader', 'turnAction', 'searchKeepOrNoise', 'searchKeepWhich',
  'crisisContribution', 'requestResponse', 'crossroadsOption', 'biteSpread', 'newLeader',
  'exilePlacement', 'vote', 'voteTiebreak', 'orderEffects', 'objectiveChoice', 'itemTarget',
] as const
export type DecisionKind = (typeof DECISION_KINDS)[number]

export type BallotChoice = 'yes' | 'no'

export interface RequestNeed { symbol?: ItemSymbol; named?: ContentId; purpose?: string }

/** Kind-specific context. Shown only to the answering seat(s) in views (00.6). */
export type DecisionContext =
  | { kind: 'chooseSurvivors'; offered: SurvivorInstanceId[]; keep: number }
  | { kind: 'chooseLeader'; survivors: SurvivorInstanceId[] }
  | { kind: 'turnAction' }
  | { kind: 'searchKeepOrNoise'; survivor: SurvivorInstanceId; location: NonColonyId; drawn: CardInstanceId[]; noiseFree: boolean; deckLeft: number }
  | { kind: 'searchKeepWhich'; survivor: SurvivorInstanceId; location: NonColonyId; drawn: CardInstanceId[]; keep: number }
  | { kind: 'crisisContribution'; crisis: ContentId; source: string }
  | { kind: 'requestResponse'; requester: SeatId; need: RequestNeed }
  | { kind: 'crossroadsOption'; card: ContentId; holder: SeatId; available: string[] }
  | { kind: 'biteSpread'; target: SurvivorInstanceId; location: LocationId }
  | { kind: 'newLeader'; candidates: SurvivorInstanceId[] }
  | { kind: 'exilePlacement'; survivor: SurvivorInstanceId | null; locations: LocationId[]; reason: 'exiled' | 'added' | 'lastSurvivor' | 'displace' }
  | { kind: 'vote'; caller: SeatId; target: SeatId; voters: SeatId[] }
  | { kind: 'voteTiebreak'; caller: SeatId; target: SeatId }
  | { kind: 'orderEffects'; effects: { key: string; sourceKey: string }[] }
  | { kind: 'objectiveChoice'; sourceKey: string; options: { id: string; label?: string }[] }
  | { kind: 'itemTarget'; sourceKey: string; purpose: string; candidates: string[]; min: number; max: number; canSkip: boolean }

export interface PendingDecision {
  id: number
  kind: DecisionKind
  /** Who answers. 'all' = simultaneous (votes); answered by one castVotes action. */
  seat: SeatId | 'all'
  /** For seat 'all': the seats whose ballots castVotes must contain. Else [seat]. */
  answerers: SeatId[]
  context: DecisionContext
}
