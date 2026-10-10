// FROZEN after M0 (docs/spec/00-architecture.md §3–§5, §9): additive changes only, each logged in 00 §16.
// The engine never imports data JSON; a DataBundle is passed in and registered by version.
import type { Action } from './actions'
import type { GameEvent } from './events'

// ---------- primitives ----------
export type Id = string
export type SeatId = string // 's1'..'s5', clockwise seat order
export type SurvivorId = Id // the survivor card's data id (one copy of each in the game)
export type CardId = string // item card INSTANCE id "c:<n>" (decks hold duplicate definitions)
export type DieId = string // "<seat>:d<n>", new ids every roll step
export type DecisionId = string // "d:<n>"
export type RollId = string // "r:<n>"
export type EffectId = string // "e:<n>"
export type LocationId = 'colony' | Id // the six location cards use their data ids ('loc.*')
export type EntranceIndex = number // colony 1..6 (R p5, p13); every other location has exactly 1

export type ItemSymbol = 'weapon' | 'fuel' | 'education' | 'food' | 'medicine' | 'tool' | 'survivor'
export type ExposureFace = 'blank' | 'wound' | 'frostbite' | 'bite' // R p11
export type WoundKind = 'wound' | 'frostbite'
export type SeatKind = 'human' | 'bot'
export type AiTier = 'random' | 'easy' | 'normal' | 'hard'
export type Phase = 'setup' | 'playerTurns' | 'colony' | 'ended'
export type ColonyStep = 'payFood' | 'checkWaste' | 'resolveCrisis' | 'addZombies' | 'checkObjective' | 'roundTick' | 'passToken' // R p12–13, in order
export type SurvivorStatus = 'alive' | 'dead' | 'removed' // removed = taken out of the game by a card effect: no morale loss (E.7)
export type ObjectiveSide = 'normal' | 'hardcore'
export type GameEndReason = 'moraleZero' | 'roundsOut' | 'objectiveComplete' | 'concession'
export type ExposureReason = 'move' | 'zombieKill' | 'biteChain' | 'card' | 'ability'
export type DiePurpose = 'attack' | 'search' | 'barricade' | 'cleanWaste' | 'attract' | 'ability' | 'card'
export type ZombieSource = 'colonyStep' | 'locationStep' | 'noise' | 'objective' | 'crisis' | 'crossroads' | 'item' | 'attract' | 'setup'
export type KillCause = 'wounds' | 'bite' | 'biteChoice' | 'overrun' | 'crisis' | 'crossroads' | 'item' | 'objective' | 'ability' | 'exposureChain'
export type MoraleReason =
  | 'survivorKilled' | 'helplessKilled' | 'starvation' | 'waste' | 'crisisFailed' | 'crisisBonus'
  | 'crisis' | 'crossroads' | 'item' | 'ability' | 'objective' | 'doubleExile' | 'setup'

// ---------- windows (00 §9; data triggers use the same ids, plus 'passive' and 'action' in hooks.ts) ----------
// Crossroads triggers are evaluated after the triggering action has fully resolved (FAQ 2.1.1): the `action.*` windows.
export const WINDOW_IDS = [
  'setup.done',
  'round.start', 'crisis.revealed', 'dice.rolled',
  'turn.start', 'turn.end',
  'action.attack', 'action.search', 'action.barricade', 'action.cleanWaste', 'action.attract', 'action.ability',
  'action.playCard', 'action.contribute', 'action.move', 'action.request', 'action.handOff', 'action.vote', 'action.spendFood',
  'exposure.rolled', 'wound.taken', 'survivor.killed', 'survivor.added', 'zombie.killed', 'zombie.added', 'entrance.overrun',
  'noise.added', 'search.drawn', 'search.kept', 'card.played', 'card.equipped',
  'colony.payFood', 'colony.waste', 'colony.crisis', 'colony.zombies', 'colony.objective', 'colony.roundTick',
  'crisis.resolved', 'morale.changed', 'vote.result', 'seat.exiled', 'game.end',
] as const
export type WindowId = (typeof WINDOW_IDS)[number]

// ---------- data bundle (placeholder until src/data/types.ts lands; shape-compatible) ----------
export interface DataRecord { id: Id; [key: string]: unknown }
export interface DataBundle { version: string; byId: Record<Id, DataRecord> }

// ---------- setup (E.3, E.13) ----------
export interface SeatSetup { id: SeatId; kind: SeatKind; name?: string; persona?: Id; tier?: AiTier }
export interface GameVariants {
  coop?: boolean // hardcore side, no secret objectives, no exile (R p15)
  twoPlayer?: boolean // co-op rules, 7 starting items, keep 3 of 4 survivors
  betrayer?: boolean // 1 non-betrayal per seat + 1 betrayal
  hardcore?: boolean // standard game on the hardcore side
  playerElimination?: boolean // a seat whose last survivor dies is out instead of drawing a new leader (E.9)
  removeMature?: boolean // Crossroads cards with the mature mark are left out (E.3)
}
export interface GameSetup {
  seats: SeatSetup[] // 2–5, in clockwise order
  mainObjective: Id | 'random'
  variants?: GameVariants
}

// ---------- seats (C.4) ----------
export interface Seat { id: SeatId; kind: SeatKind; persona?: Id; name?: string; exiled: boolean; eliminated: boolean }
export interface Die { id: DieId; value: number; used: boolean; foodSpent?: number } // foodSpent: tokens spent on this die (E.6)
export interface SeatState {
  seat: Seat
  hand: CardId[] // HIDDEN from other seats (count only)
  secretObjectiveId: Id | null // HIDDEN; null in co-op
  exiledObjectiveId: Id | null // HIDDEN; set when exiled (E.11)
  offered: SurvivorId[] // setup: the 4 dealt survivors while chooseSurvivors is open; HIDDEN; [] afterwards
  dice: Die[]
  survivors: SurvivorId[] // alive, controlled, in the order they were taken
  leaderId: SurvivorId | null
  abilityUses: Record<string, number> // "<survivorId>|<abilityId>" → uses this round (survivor abilities only, E.5); item uses live in GameState.cardUses
  outcome?: 'won' | 'lost' // set at game end (E.12)
}

// ---------- survivors (E.9) ----------
export interface SurvivorState {
  id: SurvivorId
  owner: SeatId | null // null once dead or removed
  location: LocationId
  status: SurvivorStatus
  wounds: number // plain wound tokens
  frostbite: number // frostbite tokens; each is also a wound and ticks one more wound at the owner's turn start (E.7)
  equipped: CardId[]
  movedThisTurn: boolean
  extraMoves: number // moves granted beyond the one per turn (abilities)
}

// ---------- locations (E.2, E.8) ----------
export interface EntranceState { index: EntranceIndex; zombies: number; barricades: number }
export interface LocationCapacity { survivors: number; entranceSpaces: number; noiseSpaces: number } // copied from data at setup so views need no bundle
export interface LocationState {
  id: LocationId
  entrances: EntranceState[] // colony: 6; others: 1
  noise: number // tokens on the noise spaces (4 per location, E.5)
  deck: CardId[] // top first; order HIDDEN (count only); [] at the colony
  helpless: number // helpless survivor tokens (only the colony receives them in the base game)
  capacity: LocationCapacity
}

// ---------- cards ----------
export interface CardInstance { id: CardId; defId: Id; starter?: true } // zone is derived: deck, hand, equipped, waste, crisis, objective, removed

// ---------- crisis (E.4 step 3) ----------
export interface Contribution { seat: SeatId; cardId: CardId }
export interface CrisisRevealedCard { cardId: CardId; seat: SeatId; points: 1 | -1 } // seat is revealed only in the recap
export interface CrisisResult { total: number; needed: number; prevented: boolean; bonus: boolean; revealed: CrisisRevealedCard[]; moraleDelta: number }
/** One resolved crisis, kept for the recap (00 §4): appended at `CrisisResolved`, never edited afterwards. */
export interface CrisisHistoryEntry { roundNumber: number; cardId: Id; result: CrisisResult }
export interface CrisisState {
  cardId: Id | null // this round's face-up crisis
  contributions: Contribution[] // face-down; HIDDEN (count per seat only)
  result: CrisisResult | null // this round's resolution, once it happened
  history: CrisisHistoryEntry[] // every resolved crisis so far, oldest first; the contributor seats are HIDDEN until the recap
}

// ---------- crossroads (E.10) ----------
export interface CrossroadsHeld { cardId: Id; holder: SeatId; forSeat: SeatId } // cardId HIDDEN unless the viewer is the holder
export interface CrossroadsActive { cardId: Id; holder: SeatId; forSeat: SeatId; window: WindowId }
export interface CrossroadsLogEntry { roundNumber: number; turnCount: number; cardId: Id; holder: SeatId; forSeat: SeatId; triggered: boolean; optionId?: string }
export interface CrossroadsState {
  deck: Id[] // top first; order HIDDEN (count only)
  held: CrossroadsHeld | null
  active: CrossroadsActive | null // face up while its option is chosen and resolved
  log: CrossroadsLogEntry[] // untriggered entries have their cardId HIDDEN until the recap
}

// ---------- objectives (E.12, spec 11) ----------
export interface ObjectiveState { id: Id; side: ObjectiveSide; counters: Record<string, number>; cards: CardId[]; complete: boolean }

// ---------- effects (one list for every lasting rule effect; same name refreshes to the LATER expiry, never overwrites) ----------
export type EffectDuration = 'instant' | 'turn' | 'round' | 'nextRound' | 'game'
export interface EffectExpiry { roundNumber: number; turnCount?: number } // expires at the end of that round (or that turn)
export interface EffectInstance {
  id: EffectId
  sourceId: Id // crisis, crossroads, item, survivor ability or objective id
  sourceKind: 'crisis' | 'crossroads' | 'item' | 'survivor' | 'objective' | 'secretObjective' | 'exiledObjective' | 'rule'
  ownerSeat?: SeatId // REQUIRED for 'secretObjective' / 'exiledObjective': the effect (its counters in `data`) is PRIVATE to that seat (00 §4)
  name: string
  seats?: SeatId[] // affected seats; omitted = every seat
  survivorIds?: SurvivorId[] // affected survivors; omitted = not survivor-scoped
  locations?: LocationId[]
  forbid?: string[] // ForbidWhat (hooks.ts)
  grants?: string[] // GrantWhat (hooks.ts)
  data?: Record<string, unknown>
  duration: EffectDuration
  expires: EffectExpiry | null
}

// ---------- in-flight contexts ----------
export interface TurnContext { seat: SeatId; index: number; actions: number; voteCalled: boolean; contributionAsked: boolean }
export interface VoteState { caller: SeatId; target: SeatId; votes: Record<SeatId, boolean> | null; result: { yes: number; no: number; exiled: boolean; tiebreakBy: SeatId | null } | null }
export interface BiteChain { location: LocationId; originId: SurvivorId; currentId: SurvivorId; killed: SurvivorId[] }
export interface SearchContext { seat: SeatId; survivorId: SurvivorId; location: LocationId; dieId: DieId; drawn: CardId[]; noiseAdded: number } // drawn HIDDEN except to `seat`
export interface RequestContext { from: SeatId; to: SeatId; want: { symbol?: ItemSymbol; defId?: Id }; note?: string }
export interface ExileContext { seat: SeatId; toPlace: SurvivorId[] }
export interface AttackContext {
  attackerId: SurvivorId
  target: AttackTarget
  dieId: DieId
  need: number // the die value needed to attack
  pHit?: number // vs a survivor: P(d6 ≤ target attack value)
}
export type AttackTarget = { kind: 'zombie'; location: LocationId; entrance: EntranceIndex } | { kind: 'survivor'; survivorId: SurvivorId }

// ---------- decisions (00 §5) ----------
export type DecisionKind =
  | 'chooseSurvivors' | 'chooseLeader' | 'turnAction' | 'searchKeepOrNoise' | 'searchKeepWhich' | 'crisisContribution'
  | 'requestResponse' | 'crossroadsOption' | 'biteSpreadOption' | 'newLeader' | 'exilePlacement' | 'votes'
  | 'objectiveChoice' | 'itemTarget' | 'effectChoice' | 'gameOver'
export interface ExposureOdds { blank: number; wound: number; frostbite: number; bite: number; pDeath: number }
export interface DecisionOdds { exposure?: ExposureOdds; pHit?: number; pKill?: number; pSuccess?: number; expectedZombies?: number }
export interface DecisionOptionCost { dieId?: DieId; food?: number; cards?: number }
export interface DecisionOption { id: string; label: string; action: Action; cost?: DecisionOptionCost; odds?: DecisionOdds }
export interface DecisionContext {
  survivorId?: SurvivorId
  targetId?: SurvivorId
  seatId?: SeatId
  location?: LocationId
  cardId?: CardId | Id
  cardIds?: CardId[]
  symbol?: ItemSymbol
  need?: number // die value needed (turnAction sub-prompts)
  odds?: DecisionOdds
  data?: Record<string, unknown> & { code?: string } // effectChoice / objectiveChoice / itemTarget: `code` names the hook or card
}
export interface PendingDecision {
  id: DecisionId
  seat: SeatId | 'all' // 'all' for `votes` (every non-exiled, non-eliminated seat answers privately, one castVotes action) and for `gameOver` (any seat may `ack`)
  kind: DecisionKind
  window: WindowId
  context: DecisionContext
  options?: DecisionOption[] // finite answers when the engine can enumerate them
  canPass: boolean
  redacted?: true // set by view.ts on another seat's decision: context card ids and options are stripped (00 §4)
}

// ---------- rejection ----------
export type RejectionCode =
  | 'E_WRONG_DECISION' | 'E_NOT_YOUR_DECISION' | 'E_NOT_AN_OPTION' | 'E_BAD_PAYLOAD' | 'E_BAD_SETUP' | 'E_DATA_VERSION' | 'E_GAME_OVER'
  | 'E_NOT_YOUR_SURVIVOR' | 'E_SURVIVOR_DEAD' | 'E_WRONG_LOCATION' | 'E_NO_SPACE' | 'E_ALREADY_MOVED'
  | 'E_NO_DIE' | 'E_DIE_USED' | 'E_DIE_TOO_LOW' | 'E_DIE_MAX' | 'E_NO_FOOD'
  | 'E_NO_ZOMBIE' | 'E_HELPLESS_TARGET' | 'E_OWN_SURVIVOR' | 'E_NO_NOISE_SPACE' | 'E_DECK_EMPTY'
  | 'E_NOT_IN_HAND' | 'E_NOT_EQUIPPED' | 'E_CARD_NOT_PLAYABLE' | 'E_TARGET_INVALID' | 'E_REQUESTED_CARD'
  | 'E_ABILITY_USED' | 'E_ABILITY_LOCATION' | 'E_FORBIDDEN' | 'E_EXILED' | 'E_VOTE_USED' | 'E_SELF_TARGET' | 'E_NOT_LEADER_CANDIDATE'
export interface Rejection { code: RejectionCode; message: string; detail?: Record<string, unknown> }
export class EngineInvariantError extends Error { override name = 'EngineInvariantError' }
export class NotImplementedError extends Error { override name = 'NotImplementedError' }
export const notImplemented = (what: string, milestone = 'M1'): never => { throw new NotImplementedError(`${what}: not implemented (${milestone})`) }

// ---------- rng (00 §11) ----------
export type RngState = [number, number, number, number] // sfc32 state, u32 each
export type RollPurpose = 'actionDice' | 'exposure' | 'attackSurvivor' | 'noise' | 'objective' | 'crisis' | 'crossroads' | 'item' | 'ability' | 'other'

// ---------- game result ----------
export interface GameResult { reason: GameEndReason; objectiveComplete: boolean; winners: SeatId[] }

// ---------- game state (00 §3) ----------
export interface GameState {
  seed: string
  rng: RngState
  rollSeq: number
  decisionSeq: number
  cardSeq: number
  effectSeq: number
  dataVersion: string
  setup: GameSetup
  phase: Phase
  colonyStep: ColonyStep | null // set during the colony phase
  roundsLeft: number // the round track; the game ends when it reaches 0 (E.4 step 6)
  roundNumber: number // 1-based rounds played; 0 during setup
  turnCount: number // player turns started this game
  turn: TurnContext | null
  seatOrder: SeatId[] // clockwise
  firstSeat: SeatId
  activeSeat: SeatId | null
  seats: Record<SeatId, SeatState>
  survivors: Record<SurvivorId, SurvivorState> // every survivor that entered play, dead ones included (recap)
  survivorDeck: SurvivorId[] // top first; order HIDDEN (count only)
  locations: Record<LocationId, LocationState>
  locationOrder: LocationId[] // 'colony' first, then the six in the rulebook's order (zombie step order, E.4)
  cards: Record<CardId, CardInstance>
  waste: CardId[]
  removed: CardId[] // out of the game, face up (revealed crisis contributions, cleaned waste, exiled plays)
  removedHidden: CardId[] // out of the game UNREVEALED (Old Divisions contributions F 2.3.1, a last survivor's discarded hand R p14); HIDDEN from every view (count only) until the recap
  cardUses: Record<CardId, Record<Id, number>> // card instance → abilityId → uses this round; a once-per-round item use travels with the card (R7.6, CARD-005)
  morale: number
  food: number
  starvation: number
  crisisDeck: Id[] // top first; order HIDDEN
  crisis: CrisisState
  crossroads: CrossroadsState
  exiledObjectiveDeck: Id[] // order HIDDEN
  objective: ObjectiveState
  effects: EffectInstance[]
  attack: AttackContext | null
  search: SearchContext | null
  request: RequestContext | null
  bite: BiteChain | null
  vote: VoteState | null
  exile: ExileContext | null
  pending: PendingDecision
  log: Action[] // full action log for save/replay; never part of a view
  result: GameResult | null
}

// ---------- engine API results (00 §2, §12) ----------
export interface StepResult {
  state: GameState // the SAME reference when rejected
  events: GameEvent[] // ordered; [ActionRejected] only when rejected
  pending: PendingDecision // exactly one; kind 'gameOver' once the game has ended
  rejection?: Rejection
}
export interface SaveFile {
  format: 1
  engine: string // semver
  dataVersion: string
  setup: GameSetup
  seed: string
  actions: Action[]
  meta: { savedAt: string; label: string }
}
