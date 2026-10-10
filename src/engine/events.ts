/**
 * FROZEN CONTRACT (M0). The event stream: every state change step() makes is described by one or
 * more events, in order. Events carry their own visibility; view.ts redacts them per seat.
 * Spec: docs/spec/00-architecture.md §00.7. Read targets from state, not from events (C.3).
 */
import type {
  BallotChoice, CardInstanceId, ContentId, CrisisOutcome, DecisionKind, DslEventName,
  ExposureReason, Face, GameResult, ItemDeckId, ItemSymbol, KillCause, LocationId, NonColonyId,
  ColonyStep, PreventSymbol, RequestNeed, SeatId, SurvivorInstanceId, WoundKind, ActionKind,
} from './types'

/**
 * Visibility (00.7.2):
 * - absent: public, delivered whole to every seat.
 * - {to}: only the listed seats receive the event at all.
 * - {redact, except}: every seat receives it; seats not in `except` get it with the `redact`
 *   fields deleted. Redactable fields are typed optional below.
 * After GameEnded every event is delivered whole to every seat (the recap, 10.13.3).
 */
export type Visibility = { to: SeatId[] } | { redact: string[]; except: SeatId[] }

interface Base { seq: number; round: number; vis?: Visibility }

export type EngineEvent =
  | (Base & { type: 'GameStarted'; seats: SeatId[]; mainObjective: ContentId; seed: string })
  | (Base & { type: 'SurvivorsDealt'; seat: SeatId; survivors?: SurvivorInstanceId[] })
  | (Base & { type: 'GroupsRevealed'; groups: Record<SeatId, { leader: SurvivorInstanceId; followers: SurvivorInstanceId[] }> })
  | (Base & { type: 'FirstPlayerSet'; seat: SeatId })
  | (Base & { type: 'RoundStarted' })
  | (Base & { type: 'CrisisRevealed'; crisis: ContentId; prevent: PreventSymbol })
  | (Base & { type: 'DiceRolled'; seat: SeatId; dice: { id: number; value: number }[] })
  | (Base & { type: 'DieRolled'; purpose: string; value: number; seat?: SeatId; survivor?: SurvivorInstanceId })
  | (Base & { type: 'DieChanged'; seat: SeatId; die: number; from: number; to: number; reason: 'food' | 'card' | 'ability' })
  | (Base & { type: 'DiceLost'; seat: SeatId; dice: number[] })
  | (Base & { type: 'TurnStarted'; seat: SeatId })
  | (Base & { type: 'TurnEnded'; seat: SeatId })
  | (Base & { type: 'ColonyStepStarted'; step: ColonyStep })
  | (Base & { type: 'ActionTaken'; seat: SeatId; kind: ActionKind; survivor?: SurvivorInstanceId; die?: number; dieValue?: number })
  | (Base & { type: 'ActionResolved'; seat: SeatId; kind: ActionKind; actor: SurvivorInstanceId | null; location: LocationId | null })
  | (Base & { type: 'CrossroadsDrawn'; holder: SeatId; activeSeat: SeatId; card?: ContentId })
  | (Base & { type: 'CrossroadsTriggered'; holder: SeatId; card: ContentId; available: string[] })
  | (Base & { type: 'CrossroadsResolved'; card: ContentId; option: string })
  | (Base & { type: 'CrossroadsReturned'; holder: SeatId; card?: ContentId })
  | (Base & { type: 'SurvivorMoved'; survivor: SurvivorInstanceId; from: LocationId; to: LocationId; usedMove: boolean })
  | (Base & { type: 'ExposureRolled'; survivor: SurvivorInstanceId; location: LocationId; reason: ExposureReason; d12: number; rolled: Face; face: Face })
  | (Base & { type: 'ExposureSkipped'; survivor: SurvivorInstanceId; reason: ExposureReason; sourceKey: string })
  | (Base & { type: 'BiteSpread'; target: SurvivorInstanceId; location: LocationId; choice: 'kill' | 'roll' })
  | (Base & { type: 'SurvivorWounded'; survivor: SurvivorInstanceId; kind: WoundKind; wounds: number; frostbite: number })
  | (Base & { type: 'SurvivorHealed'; survivor: SurvivorInstanceId; kind: WoundKind; wounds: number; frostbite: number })
  | (Base & { type: 'SurvivorKilled'; survivor: SurvivorInstanceId | null; helpless: boolean; seat: SeatId | null; cause: KillCause; location: LocationId; wasLeader: boolean })
  | (Base & { type: 'SurvivorAdded'; survivor: SurvivorInstanceId; recordId: ContentId; seat: SeatId; location: LocationId })
  | (Base & { type: 'LeaderChanged'; seat: SeatId; survivor: SurvivorInstanceId })
  | (Base & { type: 'HelplessAdded'; n: number; total: number })
  | (Base & { type: 'ZombiePlaced'; location: LocationId; entrance: number; source: string })
  | (Base & { type: 'BarricadeBroken'; location: LocationId; entrance: number })
  | (Base & { type: 'Overrun'; location: LocationId; entrance: number; victim: SurvivorInstanceId | null; helpless: boolean })
  | (Base & { type: 'ZombieKilled'; location: LocationId; entrance: number; by: SurvivorInstanceId | null })
  | (Base & { type: 'ZombieRemoved'; location: LocationId; entrance: number })
  | (Base & { type: 'ZombieMoved'; from: LocationId; fromEntrance: number; to: LocationId; toEntrance: number })
  | (Base & { type: 'BarricadePlaced'; location: LocationId; entrance: number })
  | (Base & { type: 'NoiseChanged'; location: NonColonyId; total: number })
  | (Base & { type: 'NoiseResolved'; location: NonColonyId; roll: number; zombie: boolean })
  | (Base & { type: 'CardDrawn'; seat: SeatId; from: ItemDeckId; reason: 'setup' | 'search' | 'effect'; card?: CardInstanceId })
  | (Base & { type: 'SearchKept'; seat: SeatId; survivor: SurvivorInstanceId; location: NonColonyId; kept?: CardInstanceId[]; returned: number })
  | (Base & { type: 'CardsRevealed'; deck: ItemDeckId; cards?: CardInstanceId[] })
  | (Base & { type: 'CardPlayed'; seat: SeatId; card: CardInstanceId; recordId: ContentId })
  | (Base & { type: 'CardEquipped'; seat: SeatId; card: CardInstanceId; survivor: SurvivorInstanceId })
  | (Base & { type: 'CardHandedOff'; card: CardInstanceId; from: SurvivorInstanceId; to: SurvivorInstanceId })
  | (Base & { type: 'CardMoved'; card?: CardInstanceId; from: string; to: string; seat?: SeatId })
  | (Base & { type: 'CardContributed'; seat: SeatId; card?: CardInstanceId; count: number })
  | (Base & { type: 'WasteChanged'; total: number; delta: number })
  | (Base & { type: 'FoodChanged'; total: number; delta: number })
  | (Base & { type: 'MoraleChanged'; total: number; delta: number; reason: string })
  | (Base & { type: 'StarvationChanged'; total: number; delta: number })
  | (Base & { type: 'CrisisResolved'; crisis: ContentId; total: number; players: number; symbols: Partial<Record<ItemSymbol, number>>; outcome: CrisisOutcome })
  | (Base & { type: 'RequestMade'; seat: SeatId; need: RequestNeed })
  | (Base & { type: 'RequestAnswered'; seat: SeatId; requester: SeatId; given: boolean; card?: CardInstanceId })
  | (Base & { type: 'SurvivorAttacked'; attacker: SurvivorInstanceId; target: SurvivorInstanceId; roll: number; hit: boolean })
  | (Base & { type: 'CardStolen'; from: SeatId; to: SeatId; card?: CardInstanceId })
  | (Base & { type: 'VoteCalled'; caller: SeatId; target: SeatId })
  | (Base & { type: 'VotesCast'; caller: SeatId; target: SeatId; votes: Record<SeatId, BallotChoice>; tiebreak: BallotChoice | null; exiled: boolean })
  | (Base & { type: 'SeatExiled'; seat: SeatId })
  | (Base & { type: 'ExiledObjectiveDrawn'; seat: SeatId; objective?: ContentId })
  | (Base & { type: 'LastingAdded'; id: string; sourceKey: string; modifier: string })
  | (Base & { type: 'LastingExpired'; id: string })
  | (Base & { type: 'ObjectiveProgress'; objective: ContentId; counter: string; value: number; target: number | null; seat?: SeatId })
  | (Base & { type: 'RoundTrackMoved'; roundsLeft: number })
  | (Base & { type: 'FirstPlayerPassed'; seat: SeatId })
  | (Base & { type: 'SeatEliminated'; seat: SeatId })
  | (Base & { type: 'DecisionOpened'; decision: number; kind: DecisionKind; seat: SeatId | 'all' })
  | (Base & { type: 'GameEnded'; result: GameResult })

export type EventType = EngineEvent['type']
export type EventOf<T extends EventType> = Extract<EngineEvent, { type: T }>

/** An event as delivered to one seat: redacted fields removed (00.7.2). Same shape, fields optional. */
export type SeatEvent = EngineEvent

/**
 * DSL trigger names (21.5) -> engine event type. events.ts is authoritative (Ruling DSL-EVENTS).
 * Abstract DSL events with no 1:1 engine event map to the engine event that marks the moment.
 */
export const DSL_EVENT_MAP: Record<DslEventName, EventType> = {
  turnStarted: 'TurnStarted',
  turnEnded: 'TurnEnded',
  roundStarted: 'RoundStarted',
  actionResolved: 'ActionResolved',
  survivorMoved: 'SurvivorMoved',
  zombieKilled: 'ZombieKilled',
  survivorWounded: 'SurvivorWounded',
  exposureRolled: 'ExposureRolled',
  survivorKilled: 'SurvivorKilled',
  survivorAdded: 'SurvivorAdded',
  cardPlayed: 'CardPlayed',
  searchResolved: 'SearchKept',
  crisisRevealed: 'CrisisRevealed',
  crisisResolved: 'CrisisResolved',
  colonyPhaseStarted: 'ColonyStepStarted',
  voteResolved: 'VotesCast',
  seatExiled: 'SeatExiled',
}
