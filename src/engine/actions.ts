/**
 * FROZEN CONTRACT (M0). Every input the engine accepts, the per-seat Ballot used to build a
 * castVotes action, and step rejection codes. Spec: docs/spec/00-architecture.md §00.5.
 * Turn action `type` values equal ActionKind (types.ts; effect.schema.json).
 */
import type {
  BallotChoice, CardInstanceId, DecisionKind, LocationId, RequestNeed, SeatId,
  SurvivorInstanceId,
} from './types'

// ---- Setup answers (10.3.7) -----------------------------------------------------------------
export interface ChooseSurvivorsAction { type: 'chooseSurvivors'; keep: SurvivorInstanceId[] }
export interface ChooseLeaderAction { type: 'chooseLeader'; survivor: SurvivorInstanceId }

// ---- Turn actions (decision 'turnAction'; 10.5, 10.6). `die` is a Die.id of the active seat. ----
export interface AttackZombieAction { type: 'attackZombie'; survivor: SurvivorInstanceId; die: number; entrance?: number }
export interface AttackSurvivorAction { type: 'attackSurvivor'; survivor: SurvivorInstanceId; die: number; target: SurvivorInstanceId }
export interface SearchAction { type: 'search'; survivor: SurvivorInstanceId; die: number }
export interface BarricadeAction { type: 'barricade'; survivor: SurvivorInstanceId; die: number; entrance?: number }
export interface CleanWasteAction { type: 'cleanWaste'; survivor: SurvivorInstanceId; die: number }
/** Attract: 1–2 source locations in pick order; colony targets list the entrance per zombie. */
export interface AttractAction { type: 'attract'; survivor: SurvivorInstanceId; die: number; sources: LocationId[]; entrances?: number[] }
/** Survivor ability or equipped-item ability. `source` is a survivor or card instance id. */
export interface AbilityAction { type: 'ability'; source: SurvivorInstanceId | CardInstanceId; abilityId: string; die?: number }
/** Play a card from hand; equip cards name the survivor they attach to. */
export interface PlayCardAction { type: 'playCard'; card: CardInstanceId; survivor?: SurvivorInstanceId }
/** One card per action, face down; repeat for more (10.6.2). */
export interface ContributeAction { type: 'contribute'; card: CardInstanceId }
export interface MoveAction { type: 'move'; survivor: SurvivorInstanceId; to: LocationId }
export interface SpendFoodAction { type: 'spendFood'; die: number }
export interface RequestAction { type: 'request'; need: RequestNeed }
export interface HandOffAction { type: 'handOff'; card: CardInstanceId; from: SurvivorInstanceId; to: SurvivorInstanceId }
export interface CallVoteAction { type: 'callVote'; target: SeatId }
export interface EndTurnAction { type: 'endTurn' }

// ---- Other decision answers ------------------------------------------------------------------
export interface SearchMoreAction { type: 'searchMore' }
export interface SearchStopAction { type: 'searchStop' }
export interface SearchKeepAction { type: 'searchKeep'; cards: CardInstanceId[] }
export interface GiveAction { type: 'give'; card: CardInstanceId }
export interface DeclineAction { type: 'decline' }
export interface CrossroadsChoiceAction { type: 'crossroadsChoice'; option: string }
export interface BiteSpreadAction { type: 'biteSpread'; choice: 'kill' | 'roll' }
export interface NewLeaderAction { type: 'newLeader'; survivor: SurvivorInstanceId }
/** Exile placement; `displace` names the non-exiled survivor moved to the colony (10.11.6). */
export interface PlaceAction { type: 'place'; location: LocationId; displace?: SurvivorInstanceId }
/** The only answer to a seat:'all' vote. Must hold exactly one ballot per answerer. */
export interface CastVotesAction { type: 'castVotes'; votes: Record<SeatId, BallotChoice> }
export interface TiebreakAction { type: 'tiebreak'; vote: BallotChoice }
export interface OrderEffectsAction { type: 'orderEffects'; first: string }
export interface ChooseOptionAction { type: 'chooseOption'; option: string }
export interface ChooseTargetsAction { type: 'chooseTargets'; targets: string[] }
export interface SkipAction { type: 'skip' }

export type TurnAction =
  | AttackZombieAction | AttackSurvivorAction | SearchAction | BarricadeAction | CleanWasteAction
  | AttractAction | AbilityAction | PlayCardAction | ContributeAction | MoveAction | SpendFoodAction
  | RequestAction | HandOffAction | CallVoteAction | EndTurnAction

export type Action =
  | ChooseSurvivorsAction | ChooseLeaderAction | TurnAction
  | SearchMoreAction | SearchStopAction | SearchKeepAction | GiveAction | DeclineAction
  | CrossroadsChoiceAction | BiteSpreadAction | NewLeaderAction | PlaceAction | CastVotesAction
  | TiebreakAction | OrderEffectsAction | ChooseOptionAction | ChooseTargetsAction | SkipAction

export type ActionType = Action['type']

/** A single seat's private answer to a seat:'all' decision. Never passed to step (00.4.4). */
export interface Ballot { type: 'ballot'; seat: SeatId; vote: BallotChoice }

/** What a Decider returns: an Action, or a Ballot for a simultaneous decision. */
export type Answer = Action | Ballot

/** Which answer types each decision kind accepts (00.4.3). */
export const ANSWERS_BY_KIND: Record<DecisionKind, readonly (ActionType | 'ballot')[]> = {
  chooseSurvivors: ['chooseSurvivors'],
  chooseLeader: ['chooseLeader'],
  turnAction: [
    'attackZombie', 'attackSurvivor', 'search', 'barricade', 'cleanWaste', 'attract', 'ability',
    'playCard', 'contribute', 'move', 'spendFood', 'request', 'handOff', 'callVote', 'endTurn',
  ],
  searchKeepOrNoise: ['searchMore', 'searchStop'],
  searchKeepWhich: ['searchKeep'],
  crisisContribution: ['contribute', 'skip'],
  requestResponse: ['give', 'decline'],
  crossroadsOption: ['crossroadsChoice'],
  biteSpread: ['biteSpread'],
  newLeader: ['newLeader'],
  exilePlacement: ['place'],
  vote: ['ballot'],
  voteTiebreak: ['tiebreak'],
  orderEffects: ['orderEffects'],
  objectiveChoice: ['chooseOption'],
  itemTarget: ['chooseTargets', 'skip'],
}

/** Rejection codes returned (never thrown) by step (C.3). */
export const REJECT_CODES = [
  'GAME_OVER', 'NO_DECISION', 'WRONG_KIND', 'NOT_LEGAL', 'BAD_BALLOTS', 'MALFORMED',
] as const
export type RejectCode = (typeof REJECT_CODES)[number]
export interface Rejection { ok: false; code: RejectCode; message: string }

const TURN_TYPES: ReadonlySet<string> = new Set(ANSWERS_BY_KIND.turnAction)

export function isTurnAction(a: Answer): a is TurnAction {
  return TURN_TYPES.has(a.type)
}

/** Canonical JSON: object keys sorted, undefined dropped. Used for deep equality and hashing. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? 'null' : canonicalJson(v))).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`
}

/** Deep equality of two answers (40.1.3: a decider must return an element of legalActions). */
export function sameAnswer(a: Answer, b: Answer): boolean {
  return canonicalJson(a) === canonicalJson(b)
}

/** Combine one ballot per answerer into the castVotes action for step (10.12.3). */
export function collectBallots(answerers: readonly SeatId[], ballots: readonly Ballot[]): CastVotesAction {
  const votes: Record<SeatId, BallotChoice> = {}
  for (const b of ballots) {
    if (!answerers.includes(b.seat)) throw new Error(`ballot from non-answerer ${b.seat}`)
    if (b.seat in votes) throw new Error(`duplicate ballot from ${b.seat}`)
    votes[b.seat] = b.vote
  }
  for (const s of answerers) if (!(s in votes)) throw new Error(`missing ballot from ${s}`)
  return { type: 'castVotes', votes }
}

