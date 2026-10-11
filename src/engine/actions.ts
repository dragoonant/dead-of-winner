// FROZEN after M0: every seat input is an Action answering state.pending (00 §5–§6). Additive changes only.
import type {
  AttackTarget, CardId, DecisionId, DieId, EntranceIndex, Id, ItemSymbol, LocationId, SeatId, SurvivorId,
} from './types'

interface Base<T extends string> { type: T; decisionId: DecisionId; seat: SeatId }

// ---------- generic ----------
export interface PassAction extends Base<'pass'> {} // legal iff pending.canPass
export interface AckAction extends Base<'ack'> {} // gameOver only (pending.seat === 'all': any seat may send it; `seat` is the acking seat)
/** The human resigns (R17.4): legal for a human seat on any decision addressed to it (or to 'all'); ends the game with reason 'concession' and no winners. */
export interface ConcedeAction extends Base<'concede'> {} // the human seat, on any decision addressed to it (or 'all'): GameEnded {reason:'concession', winners: []} (R17.4), then gameOver
/** Finite choice raised by a card effect or code hook (`effectChoice`); `optionId` is one of pending.options[].id. */
export interface EffectChoiceAction extends Base<'effectChoice'> { optionId: string; data?: Record<string, unknown> }

// ---------- setup (E.3) ----------
export interface ChooseSurvivorsAction extends Base<'chooseSurvivors'> { keep: SurvivorId[] } // 2 of the 4 offered (3 in the two-player variant)
export interface ChooseLeaderAction extends Base<'chooseLeader'> { survivorId: SurvivorId } // setup and `newLeader` (E.9)

// ---------- turn actions (answers to `turnAction`; one at a time, re-planned after each outcome) ----------
export interface AttackAction extends Base<'attack'> { survivorId: SurvivorId; dieId: DieId; target: AttackTarget } // E.5
export interface SearchAction extends Base<'search'> { survivorId: SurvivorId; dieId: DieId } // at the survivor's location, never the colony
export interface BarricadeAction extends Base<'barricade'> { survivorId: SurvivorId; dieId: DieId; entrance: EntranceIndex }
export interface CleanWasteAction extends Base<'cleanWaste'> { survivorId: SurvivorId; dieId: DieId } // survivor at the colony; top 3 waste cards leave the game
/** 0-2 zombies in total from ONE other location, into empty spaces only (F 5.1.1). `to` (optional, additive 2026-10-10) is the player's free choice of destination entrance spaces at the survivor's location (split allowed); its counts must add up to the zombies moved. Omitted = first empty space, lowest entrance first. */
export interface AttractAction extends Base<'attract'> { survivorId: SurvivorId; dieId: DieId; from: { location: LocationId; entrance: EntranceIndex; count: number }[]; to?: { entrance: EntranceIndex; count: number }[] }
export interface UseAbilityAction extends Base<'useAbility'> { survivorId: SurvivorId; abilityId: Id; dieId?: DieId; data?: Record<string, unknown> } // (N+) abilities spend a die ≥ N
export interface PlayCardAction extends Base<'playCard'> { cardId: CardId; equipTo?: SurvivorId; data?: Record<string, unknown> } // from hand, own turn only (E.6)
export interface ContributeCrisisAction extends Base<'contributeCrisis'> { cardIds: CardId[] } // face down, from hand or equipped; also answers `crisisContribution` ([] = nothing)
/** Add one hand card to the main objective (F 4.1.1, ruling O7.1): no die, own turn, only a card whose symbol the objective counts (starter-deck cards excluded where the objective says so). */
export interface ContributeObjectiveAction extends Base<'contributeObjective'> { cardId: CardId }
export interface MoveAction extends Base<'move'> { survivorId: SurvivorId; to: LocationId } // once per survivor per turn; exposure after
export interface SpendFoodAction extends Base<'spendFood'> { dieId: DieId; tokens: number } // +1 per token on one unused die, max 6 (F 5.3.1)
export interface RequestAction extends Base<'request'> { to: SeatId | 'all'; symbol?: ItemSymbol; defId?: Id; note?: string } // ask for an item card
export interface HandOffAction extends Base<'handOff'> { cardId: CardId; toSurvivorId: SurvivorId } // equipped item, same location
export interface CallVoteAction extends Base<'callVote'> { target: SeatId } // once per turn, another seat
export interface EndTurnAction extends Base<'endTurn'> {}

// ---------- sub-decisions ----------
export interface KeepCardAction extends Base<'keepCard'> { cardId: CardId } // `searchKeepOrNoise` and `searchKeepWhich`: keep this drawn card, the rest go under the deck
export interface MakeNoiseAction extends Base<'makeNoise'> {} // `searchKeepOrNoise`: place a noise token and draw again
export interface RespondRequestAction extends Base<'respondRequest'> { give: CardId | null } // `requestResponse`: null = decline
export interface ChooseCrossroadsOptionAction extends Base<'chooseCrossroadsOption'> { optionId: string; data?: Record<string, unknown> } // `crossroadsOption`
export interface BiteSpreadAction extends Base<'biteSpread'> { choice: 'kill' | 'roll' } // `biteSpreadOption` (E.7)
export interface PlaceExiledAction extends Base<'placeExiled'> { placements: { survivorId: SurvivorId; to: LocationId }[] } // `exilePlacement`: every colony survivor to a non-colony location
export interface ObjectiveChoiceAction extends Base<'objectiveChoice'> { optionId: string; data?: Record<string, unknown> } // `objectiveChoice`
export interface ItemTargetAction extends Base<'itemTarget'> { targets: Id[]; optionId?: string } // `itemTarget`: survivors, locations, entrances or cards the played item acts on

// ---------- simultaneous votes (`votes`, pending.seat === 'all') ----------
/** One action carries every eligible seat's private answer; the client collects the human's through a prompt and each bot's from its own view (C.4). */
export interface CastVotesAction { type: 'castVotes'; decisionId: DecisionId; seat: 'all'; votes: Record<SeatId, boolean> }

export type Action =
  | PassAction | AckAction | ConcedeAction | EffectChoiceAction
  | ChooseSurvivorsAction | ChooseLeaderAction
  | AttackAction | SearchAction | BarricadeAction | CleanWasteAction | AttractAction | UseAbilityAction | PlayCardAction
  | ContributeCrisisAction | ContributeObjectiveAction | MoveAction | SpendFoodAction | RequestAction | HandOffAction | CallVoteAction | EndTurnAction
  | KeepCardAction | MakeNoiseAction | RespondRequestAction | ChooseCrossroadsOptionAction | BiteSpreadAction | PlaceExiledAction
  | ObjectiveChoiceAction | ItemTargetAction
  | CastVotesAction

export type ActionType = Action['type']
export type ActionOf<T extends ActionType> = Extract<Action, { type: T }>

/** The turn actions a `turnAction` decision accepts (00 §5). */
export const TURN_ACTION_TYPES = [
  'attack', 'search', 'barricade', 'cleanWaste', 'attract', 'useAbility', 'playCard', 'contributeCrisis', 'contributeObjective', 'move', 'spendFood',
  'request', 'handOff', 'callVote', 'endTurn',
] as const satisfies readonly ActionType[]
export type TurnActionType = (typeof TURN_ACTION_TYPES)[number]
