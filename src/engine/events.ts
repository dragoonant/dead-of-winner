// FROZEN after M0: every rule effect in Part E emits one of these (00 §2 rule 3, §7). Additive changes only.
// Events are the engine's full truth and may carry hidden information; the client shows a seat only
// what view.ts `redactEvent(event, seatId)` leaves (00 §4.3).
import type { Action } from './actions'
import type {
  AttackTarget, CardId, ColonyStep, DecisionKind, Die, DieId, DiePurpose, EffectExpiry, EffectId, EntranceIndex, ExposureFace,
  ExposureReason, GameEndReason, Id, ItemSymbol, KillCause, LocationId, MoraleReason, Phase, Rejection, RollId, RollPurpose,
  SeatId, SurvivorId, WindowId, WoundKind, ZombieSource,
} from './types'

interface Ev<T extends string> { type: T }

// ---------- flow ----------
export interface GameCreated extends Ev<'GameCreated'> { seed: string; dataVersion: string; seats: SeatId[]; objectiveId: Id }
export interface ActionRejected extends Ev<'ActionRejected'> { action: Action; rejection: Rejection }
export interface DecisionAutoResolved extends Ev<'DecisionAutoResolved'> { kind: DecisionKind; seat: SeatId | 'all'; optionId: string }
export interface PhaseChanged extends Ev<'PhaseChanged'> { phase: Phase; step?: ColonyStep }
export interface RoundStarted extends Ev<'RoundStarted'> { roundNumber: number; roundsLeft: number }
export interface TurnStarted extends Ev<'TurnStarted'> { seat: SeatId; turnCount: number; roundNumber: number }
export interface TurnEnded extends Ev<'TurnEnded'> { seat: SeatId; turnCount: number }
export interface RoundTicked extends Ev<'RoundTicked'> { roundsLeft: number }
export interface FirstSeatPassed extends Ev<'FirstSeatPassed'> { from: SeatId; to: SeatId }

// ---------- setup (E.3) ----------
export interface SurvivorsDealt extends Ev<'SurvivorsDealt'> { seat: SeatId; survivorIds: SurvivorId[] } // PRIVATE to seat
export interface SurvivorsChosen extends Ev<'SurvivorsChosen'> { seat: SeatId; kept: SurvivorId[]; returned: number }
export interface LeaderChosen extends Ev<'LeaderChosen'> { seat: SeatId; survivorId: SurvivorId; reason: 'setup' | 'replacement' | 'newSurvivor' }
export interface StartingItemsDealt extends Ev<'StartingItemsDealt'> { seat: SeatId; cardIds: CardId[] } // PRIVATE to seat
export interface SecretObjectiveDealt extends Ev<'SecretObjectiveDealt'> { seat: SeatId; objectiveId: Id; kind: 'standard' | 'betrayal' } // PRIVATE to seat
export interface FirstSeatSet extends Ev<'FirstSeatSet'> { seat: SeatId; leaderId: SurvivorId; influence: number }

// ---------- dice ----------
export interface DiceRolled extends Ev<'DiceRolled'> { rollId: RollId; purpose: RollPurpose; seat?: SeatId; dice: number[]; total: number; target?: number }
export interface ActionDiceRolled extends Ev<'ActionDiceRolled'> { seat: SeatId; dice: Die[]; rollId: RollId }
export interface DieSpent extends Ev<'DieSpent'> { seat: SeatId; dieId: DieId; value: number; purpose: DiePurpose; survivorId?: SurvivorId; need?: number }
export interface DieBoosted extends Ev<'DieBoosted'> { seat: SeatId; dieId: DieId; from: number; to: number; source: 'food' | 'ability' | 'item' }
export interface DieAdded extends Ev<'DieAdded'> { seat: SeatId; die: Die; source: 'exiledFood' | 'item' | 'ability' }

// ---------- exposure, wounds and bites (E.7) ----------
export interface ExposureRolled extends Ev<'ExposureRolled'> { rollId: RollId; survivorId: SurvivorId; reason: ExposureReason; raw: number; face: ExposureFace }
export interface ExposureFaceChanged extends Ev<'ExposureFaceChanged'> { survivorId: SurvivorId; from: ExposureFace; to: ExposureFace; sourceId: Id } // Sparky, Harman Brooks
export interface ExposureSkipped extends Ev<'ExposureSkipped'> { survivorId: SurvivorId; reason: ExposureReason; sourceId: Id } // Mike Cho, Rod Miller
export interface WoundTaken extends Ev<'WoundTaken'> { survivorId: SurvivorId; kind: WoundKind; wounds: number; frostbite: number; source: 'exposure' | 'frostbiteTick' | 'attack' | 'crisis' | 'crossroads' | 'item' | 'ability' | 'objective' }
export interface WoundHealed extends Ev<'WoundHealed'> { survivorId: SurvivorId; kind: WoundKind; sourceId: Id }
export interface FrostbiteTicked extends Ev<'FrostbiteTicked'> { survivorId: SurvivorId; frostbite: number }
export interface BiteSpreadStep extends Ev<'BiteSpreadStep'> { fromId: SurvivorId; toId: SurvivorId; location: LocationId; influence: number }
export interface BiteChoiceMade extends Ev<'BiteChoiceMade'> { seat: SeatId; survivorId: SurvivorId; choice: 'kill' | 'roll' }
export interface BiteChainEnded extends Ev<'BiteChainEnded'> { location: LocationId; reason: 'killChoice' | 'blank' | 'noSurvivors'; killed: SurvivorId[] }

// ---------- survivors (E.9) ----------
export interface SurvivorKilled extends Ev<'SurvivorKilled'> { survivorId: SurvivorId; owner: SeatId | null; location: LocationId; cause: KillCause; moraleLoss: boolean; wasLeader: boolean }
export interface SurvivorRemoved extends Ev<'SurvivorRemoved'> { survivorId: SurvivorId; owner: SeatId | null; sourceId: Id } // out of the game by a card: no morale
export interface EquippedReturned extends Ev<'EquippedReturned'> { survivorId: SurvivorId; cardIds: CardId[]; to: 'hand' | 'deck'; location: LocationId }
export interface SurvivorAdded extends Ev<'SurvivorAdded'> { survivorId: SurvivorId; seat: SeatId; location: LocationId; source: 'lastSurvivor' | 'item' | 'crossroads' | 'crisis' | 'ability' }
export interface HelplessAdded extends Ev<'HelplessAdded'> { location: LocationId; count: number; after: number; sourceId: Id }
export interface HelplessKilled extends Ev<'HelplessKilled'> { location: LocationId; count: number; after: number; cause: KillCause; moraleLoss: boolean }
export interface HandDiscarded extends Ev<'HandDiscarded'> { seat: SeatId; count: number; reason: 'lastSurvivor' | 'card' }
export interface SeatEliminated extends Ev<'SeatEliminated'> { seat: SeatId }
export interface SurvivorMoved extends Ev<'SurvivorMoved'> { survivorId: SurvivorId; from: LocationId; to: LocationId; kind: 'action' | 'exile' | 'bump' | 'card' | 'ability' }

// ---------- attacks (E.5) ----------
export interface AttackDeclared extends Ev<'AttackDeclared'> { attackerId: SurvivorId; target: AttackTarget; dieId: DieId; need: number }
export interface SurvivorAttacked extends Ev<'SurvivorAttacked'> { attackerId: SurvivorId; targetId: SurvivorId; rollId: RollId; roll: number; targetAttack: number; hit: boolean }
export interface CardStolen extends Ev<'CardStolen'> { from: SeatId; to: SeatId; cardId: CardId } // PRIVATE to from and to

// ---------- zombies, barricades, noise (E.8) ----------
export interface ZombiesToAdd extends Ev<'ZombiesToAdd'> { location: LocationId; count: number; source: ZombieSource; survivors?: number }
export interface ZombieAdded extends Ev<'ZombieAdded'> { location: LocationId; entrance: EntranceIndex; source: ZombieSource; zombies: number }
export interface ZombieKilled extends Ev<'ZombieKilled'> { location: LocationId; entrance: EntranceIndex; by: SurvivorId | Id | 'effect'; zombies: number }
export interface ZombieMoved extends Ev<'ZombieMoved'> { from: { location: LocationId; entrance: EntranceIndex }; to: { location: LocationId; entrance: EntranceIndex }; by: SurvivorId | Id }
export interface BarricadeAdded extends Ev<'BarricadeAdded'> { location: LocationId; entrance: EntranceIndex; by: SurvivorId | Id; barricades: number }
export interface BarricadeDestroyed extends Ev<'BarricadeDestroyed'> { location: LocationId; entrance: EntranceIndex; barricades: number }
export interface EntranceOverrun extends Ev<'EntranceOverrun'> { location: LocationId; entrance: EntranceIndex; killed: SurvivorId | 'helpless' | null }
export interface NoiseAdded extends Ev<'NoiseAdded'> { location: LocationId; count: number; after: number; by: SurvivorId | Id | 'search' }
export interface NoiseRolled extends Ev<'NoiseRolled'> { location: LocationId; rollId: RollId; die: number; zombie: boolean }
export interface NoiseCleared extends Ev<'NoiseCleared'> { location: LocationId; count: number }

// ---------- search and cards (E.5, E.6) ----------
export interface SearchStarted extends Ev<'SearchStarted'> { seat: SeatId; survivorId: SurvivorId; location: LocationId; dieId: DieId; need: number }
export interface SearchDrawn extends Ev<'SearchDrawn'> { seat: SeatId; location: LocationId; cardId: CardId; defId: Id; symbols: ItemSymbol[] } // PRIVATE to seat
export interface SearchKept extends Ev<'SearchKept'> { seat: SeatId; location: LocationId; cardId: CardId; returned: number } // cardId PRIVATE to seat
export interface CardDrawn extends Ev<'CardDrawn'> { seat: SeatId; from: LocationId | 'startingItems'; cardId: CardId; sourceId: Id } // PRIVATE to seat (effects that draw)
export interface CardPlayed extends Ev<'CardPlayed'> { seat: SeatId; cardId: CardId; defId: Id; survivorId?: SurvivorId; to: 'waste' | 'equipped' | 'removed' }
export interface CardEquipped extends Ev<'CardEquipped'> { seat: SeatId; cardId: CardId; survivorId: SurvivorId }
export interface CardHandedOff extends Ev<'CardHandedOff'> { cardId: CardId; fromSurvivorId: SurvivorId; toSurvivorId: SurvivorId }
export interface CardContributed extends Ev<'CardContributed'> { seat: SeatId; cardId: CardId; from: 'hand' | 'equipped' } // cardId PRIVATE to seat
export interface CardGiven extends Ev<'CardGiven'> { from: SeatId; to: SeatId; cardId: CardId; defId: Id } // public: a given card is revealed and played at once (F 5.2.1)
export interface CardDiscarded extends Ev<'CardDiscarded'> { seat: SeatId | null; cardId: CardId; to: 'waste' | 'removed' | 'deck'; reason: string; revealed?: false } // revealed:false → state.removedHidden; cardId PRIVATE to seat (F 2.3.1, R p14)
export interface WasteCleaned extends Ev<'WasteCleaned'> { by: SurvivorId; cardIds: CardId[]; wasteAfter: number }
export interface RequestMade extends Ev<'RequestMade'> { from: SeatId; to: SeatId; symbol?: ItemSymbol; defId?: Id; note?: string }
export interface RequestAnswered extends Ev<'RequestAnswered'> { from: SeatId; to: SeatId; cardId: CardId | null }

// ---------- colony phase (E.4) ----------
export interface FoodPaid extends Ev<'FoodPaid'> { needed: number; survivors: number; foodAfter: number }
export interface Starvation extends Ev<'Starvation'> { needed: number; supply: number; starvationAfter: number; moraleLoss: number }
export interface FoodChanged extends Ev<'FoodChanged'> { delta: number; after: number; reason: 'pay' | 'card' | 'spendOnDie' | 'crisis' | 'crossroads' | 'ability' | 'setup' }
export interface WasteChecked extends Ev<'WasteChecked'> { cards: number; moraleLoss: number }
export interface MoraleChanged extends Ev<'MoraleChanged'> { delta: number; after: number; reason: MoraleReason; sourceId?: Id }
export interface CrisisRevealed extends Ev<'CrisisRevealed'> { cardId: Id; prevent: ItemSymbol[]; roundNumber: number }
export interface CrisisCardRevealed extends Ev<'CrisisCardRevealed'> { cardId: CardId; defId: Id; points: 1 | -1; runningTotal: number } // contributor never named (shuffled face down)
export interface CrisisResolved extends Ev<'CrisisResolved'> { cardId: Id; total: number; needed: number; prevented: boolean; bonus: boolean; cards: number }
export interface CrisisEffectApplied extends Ev<'CrisisEffectApplied'> { cardId: Id; kind: 'fail' | 'bonus' }
export interface ObjectiveChecked extends Ev<'ObjectiveChecked'> { objectiveId: Id; complete: boolean }

// ---------- crossroads (E.10) ----------
export interface CrossroadsDrawn extends Ev<'CrossroadsDrawn'> { holder: SeatId; forSeat: SeatId; cardId: Id } // cardId PRIVATE to holder
export interface CrossroadsTriggered extends Ev<'CrossroadsTriggered'> { cardId: Id; holder: SeatId; forSeat: SeatId; window: WindowId }
export interface CrossroadsResolved extends Ev<'CrossroadsResolved'> { cardId: Id; forSeat: SeatId; optionId: string; forced: boolean } // forced: only one option was possible (the others failed `requires`, or the card has one)
export interface CrossroadsReturned extends Ev<'CrossroadsReturned'> { holder: SeatId; forSeat: SeatId; cardId: Id } // untriggered → bottom of the deck; cardId PRIVATE to holder
export interface CrossroadsDeckShuffled extends Ev<'CrossroadsDeckShuffled'> { reason: 'search' | 'setup' }

// ---------- votes and exile (E.6, E.11) ----------
export interface VoteCalled extends Ev<'VoteCalled'> { caller: SeatId; target: SeatId }
export interface VotesCast extends Ev<'VotesCast'> { target: SeatId; votes: Record<SeatId, boolean> } // simultaneous and public once cast
export interface VoteResult extends Ev<'VoteResult'> { target: SeatId; yes: number; no: number; exiled: boolean; tiebreakBy: SeatId | null }
export interface SeatExiled extends Ev<'SeatExiled'> { seat: SeatId; objectiveId: Id } // objectiveId PRIVATE to seat
export interface ExiledPlaced extends Ev<'ExiledPlaced'> { seat: SeatId; placements: { survivorId: SurvivorId; to: LocationId }[] }
export interface SurvivorBumped extends Ev<'SurvivorBumped'> { survivorId: SurvivorId; from: LocationId; forExiled: SurvivorId } // F 5.4.1: a non-exiled survivor returns to the colony

// ---------- objectives (spec 11) ----------
export interface ObjectiveProgress extends Ev<'ObjectiveProgress'> { objectiveId: Id; seat: SeatId | null; counter: string; delta: number; after: number; need: number } // seat !== null → secret objective, PRIVATE to seat
export interface ObjectiveComplete extends Ev<'ObjectiveComplete'> { objectiveId: Id; seat: SeatId | null } // PRIVATE to seat when secret

// ---------- effects and abilities ----------
export interface EffectApplied extends Ev<'EffectApplied'> { effectId: EffectId; sourceId: Id; name: string; targetIds: Id[]; expires: EffectExpiry | null; refreshed: boolean; ownerSeat?: SeatId } // ownerSeat set → a secret/exiled objective's effect, PRIVATE to that seat
export interface EffectExpired extends Ev<'EffectExpired'> { effectId: EffectId; reason: 'duration' | 'replaced' | 'other'; ownerSeat?: SeatId } // PRIVATE to ownerSeat when set
export interface AbilityUsed extends Ev<'AbilityUsed'> { survivorId: SurvivorId; abilityId: Id; dieId?: DieId; usesThisRound: number; cardId?: CardId } // cardId set → an equipped item's ability (uses keyed by the card instance)
export interface DeckShuffled extends Ev<'DeckShuffled'> { location: LocationId | 'survivor' | 'crisis' | 'exiledObjective'; reason: 'setup' | 'equippedReturned' | 'card' | 'ability' | 'returnedSurvivors' }

// ---------- end ----------
export interface GameEnded extends Ev<'GameEnded'> { reason: GameEndReason; objectiveComplete: boolean; winners: SeatId[]; morale: number; roundsLeft: number }

export type GameEvent =
  | GameCreated | ActionRejected | DecisionAutoResolved | PhaseChanged | RoundStarted | TurnStarted | TurnEnded | RoundTicked | FirstSeatPassed
  | SurvivorsDealt | SurvivorsChosen | LeaderChosen | StartingItemsDealt | SecretObjectiveDealt | FirstSeatSet
  | DiceRolled | ActionDiceRolled | DieSpent | DieBoosted | DieAdded
  | ExposureRolled | ExposureFaceChanged | ExposureSkipped | WoundTaken | WoundHealed | FrostbiteTicked | BiteSpreadStep | BiteChoiceMade | BiteChainEnded
  | SurvivorKilled | SurvivorRemoved | EquippedReturned | SurvivorAdded | HelplessAdded | HelplessKilled | HandDiscarded | SeatEliminated | SurvivorMoved
  | AttackDeclared | SurvivorAttacked | CardStolen
  | ZombiesToAdd | ZombieAdded | ZombieKilled | ZombieMoved | BarricadeAdded | BarricadeDestroyed | EntranceOverrun | NoiseAdded | NoiseRolled | NoiseCleared
  | SearchStarted | SearchDrawn | SearchKept | CardDrawn | CardPlayed | CardEquipped | CardHandedOff | CardContributed | CardGiven | CardDiscarded | WasteCleaned
  | RequestMade | RequestAnswered
  | FoodPaid | Starvation | FoodChanged | WasteChecked | MoraleChanged | CrisisRevealed | CrisisCardRevealed | CrisisResolved | CrisisEffectApplied | ObjectiveChecked
  | CrossroadsDrawn | CrossroadsTriggered | CrossroadsResolved | CrossroadsReturned | CrossroadsDeckShuffled
  | VoteCalled | VotesCast | VoteResult | SeatExiled | ExiledPlaced | SurvivorBumped
  | ObjectiveProgress | ObjectiveComplete
  | EffectApplied | EffectExpired | AbilityUsed | DeckShuffled
  | GameEnded

export type GameEventType = GameEvent['type']
export type EventOf<T extends GameEventType> = Extract<GameEvent, { type: T }>
