// Setup phase after createGame (10 R3.7-R3.9): every seat's chooseSurvivors, then every seat's chooseLeader, then
// FirstSeatSet and round 1. step() routes any action while state.phase === 'setup' to stepSetup.
//
// Round 1 hand-off: the player-turns phase registers its round starter with registerRoundStarter; until it does,
// defaultRoundStart plays the minimal round start (crisis flip, dice, first turn, Crossroads draw) so the game is whole.
import type { Action, ChooseLeaderAction, ChooseSurvivorsAction } from '../actions'
import {
  bundleOf, mintDecision, patchSeat, recordOf, reject, shuffleOn, survivorInfluence, type CrisisRec, type Out,
} from '../decks'
import { rollActionDice } from '../dice'
import type { GameEvent } from '../events'
import { addSurvivor, applyChooseLeader, leaderOptions, validateChooseLeader } from '../survivors'
import { chooseSurvivorsDecision, keepCount } from '../setup'
import type { GameState, PendingDecision, Rejection, SeatId, StepResult, SurvivorId } from '../types'
import { seatToRight } from '../view'

// ---------- round-1 hand-off ----------
export type RoundStarter = (state: GameState) => Out & { pending?: PendingDecision }
let roundStarter: RoundStarter | null = null
export function registerRoundStarter(fn: RoundStarter | null): void { roundStarter = fn }

/** Minimal round start used until the player-turns phase registers its own: flip the crisis, roll dice, open the first seat's turn. */
export const defaultRoundStart: RoundStarter = (state0) => {
  const events: GameEvent[] = []
  let s: GameState = { ...state0, phase: 'playerTurns', roundNumber: 1, turnCount: 0 }
  events.push({ type: 'PhaseChanged', phase: 'playerTurns' }, { type: 'RoundStarted', roundNumber: 1, roundsLeft: s.roundsLeft })
  const top = s.crisisDeck[0]
  if (top) {
    s = { ...s, crisisDeck: s.crisisDeck.slice(1), crisis: { ...s.crisis, cardId: top } }
    const prevent = (recordOf<CrisisRec>(bundleOf(s), top)?.prevent ?? []) as never[]
    events.push({ type: 'CrisisRevealed', cardId: top, prevent, roundNumber: 1 })
  }
  const dice = rollActionDice(s)
  s = dice.state; events.push(...dice.events)
  const first = s.firstSeat
  s = { ...s, activeSeat: first, turnCount: 1, turn: { seat: first, index: 0, actions: 0, voteCalled: false, contributionAsked: false } }
  events.push({ type: 'TurnStarted', seat: first, turnCount: 1, roundNumber: 1 })
  const holder = seatToRight(s.seatOrder, first)
  const card = s.crossroads.deck[0]
  if (card) {
    s = { ...s, crossroads: { ...s.crossroads, deck: s.crossroads.deck.slice(1), held: { cardId: card, holder, forSeat: first } } }
    events.push({ type: 'CrossroadsDrawn', holder, forSeat: first, cardId: card })
  }
  const d = mintDecision(s, (id) => ({
    seat: first, kind: 'turnAction', window: 'turn.start', context: { seatId: first }, canPass: false,
    options: [{ id: 'endTurn', label: 'end turn', action: { type: 'endTurn', decisionId: id, seat: first } }],
  }))
  return { state: d.state, events, pending: d.pending }
}

// ---------- validation ----------
function isSetupAnswer(pending: PendingDecision, action: Action): boolean {
  return (pending.kind === 'chooseSurvivors' && action.type === 'chooseSurvivors') || (pending.kind === 'chooseLeader' && action.type === 'chooseLeader')
}

export function validateSetupAction(state: GameState, action: Action): Rejection | null {
  if (state.phase !== 'setup') return reject('E_WRONG_DECISION', 'the game is not in setup')
  const p = state.pending
  if (action.decisionId !== p.id) return reject('E_WRONG_DECISION', `expected an answer to ${p.id}`, { expected: p.id })
  if (action.seat !== p.seat) return reject('E_NOT_YOUR_DECISION', `${p.id} belongs to seat ${String(p.seat)}`)
  if (!isSetupAnswer(p, action)) return reject('E_WRONG_DECISION', `${action.type} does not answer ${p.kind}`)
  if (action.type === 'chooseSurvivors') {
    const need = keepCount(state.setup)
    const offered = state.seats[action.seat]!.offered
    if (!Array.isArray(action.keep) || action.keep.length !== need || new Set(action.keep).size !== need) return reject('E_BAD_PAYLOAD', `keep exactly ${need} different survivors`, { need })
    if (action.keep.some((id) => !offered.includes(id))) return reject('E_NOT_AN_OPTION', 'a kept survivor was not offered to this seat')
    return null
  }
  if (action.type === 'chooseLeader') return validateChooseLeader(state, action.seat, action.survivorId)
  return null
}

/** Everything the open setup decision accepts (its enumerated options). Never empty. */
export function setupLegalActions(state: GameState): Action[] {
  return (state.pending.options ?? []).map((o) => o.action)
}

// ---------- the step ----------
const rejectedResult = (state: GameState, action: Action, rejection: Rejection): StepResult =>
  ({ state, events: [{ type: 'ActionRejected', action, rejection }], pending: state.pending, rejection })

export function stepSetup(state: GameState, action: Action): StepResult {
  const rej = validateSetupAction(state, action)
  if (rej) return rejectedResult(state, action, rej)
  const out = action.type === 'chooseSurvivors' ? applyChooseSurvivors(state, action) : applyChooseLeaderSetup(state, action as ChooseLeaderAction)
  // state.log is appended by the generic step() for every phase, not here
  return { state: out.state, events: out.events, pending: out.pending }
}

function nextSeat(state: GameState, seat: SeatId): SeatId | null { return state.seatOrder[state.seatOrder.indexOf(seat) + 1] ?? null }

function applyChooseSurvivors(state: GameState, a: ChooseSurvivorsAction): Out & { pending: PendingDecision } {
  const events: GameEvent[] = []
  const offered = state.seats[a.seat]!.offered
  const returned = offered.filter((id) => !a.keep.includes(id))
  // kept survivors enter play at the colony, alive, in the order named (R3.7); returned cards go to the deck bottom until the final reshuffle
  let s: GameState = patchSeat({ ...state, survivorDeck: [...state.survivorDeck, ...returned] }, a.seat, { offered: [] })
  for (const id of a.keep) {
    const added = addSurvivor(s, a.seat, id, 'colony', 'lastSurvivor')
    s = added.state // SurvivorAdded is not emitted at setup: SurvivorsChosen is the public record
  }
  events.push({ type: 'SurvivorsChosen', seat: a.seat, kept: [...a.keep], returned: returned.length })

  const next = nextSeat(s, a.seat)
  if (next) {
    const d = chooseSurvivorsDecision(s, next)
    return { state: d.state, events, pending: d.pending }
  }
  // every seat has chosen: reshuffle the survivor deck on the seeded stream (SETUP-010), then leaders
  const sh = shuffleOn(s, s.survivorDeck)
  s = { ...sh.state, survivorDeck: sh.items }
  events.push({ type: 'DeckShuffled', location: 'survivor', reason: 'returnedSurvivors' })
  const d = chooseLeaderDecision(s, s.seatOrder[0]!)
  return { state: d.state, events, pending: d.pending }
}

function chooseLeaderDecision(state: GameState, seat: SeatId) {
  return mintDecision(state, (id) => ({
    seat, kind: 'chooseLeader', window: 'setup.done', context: { seatId: seat }, canPass: false, options: leaderOptions(state, seat, id),
  }))
}

function applyChooseLeaderSetup(state: GameState, a: ChooseLeaderAction): Out & { pending: PendingDecision } {
  const led = applyChooseLeader(state, a.seat, a.survivorId, 'setup')
  let s = led.state
  const events = [...led.events]
  const next = nextSeat(s, a.seat)
  if (next) {
    const d = chooseLeaderDecision(s, next)
    return { state: d.state, events, pending: d.pending }
  }
  // R3.9: the highest-influence leader takes the first-player token
  const bundle = bundleOf(s)
  let best: { seat: SeatId; leaderId: SurvivorId; influence: number } | null = null
  for (const seat of s.seatOrder) {
    const leaderId = s.seats[seat]!.leaderId
    if (!leaderId) continue
    const influence = survivorInfluence(bundle, leaderId)
    if (!best || influence > best.influence) best = { seat, leaderId, influence }
  }
  const first = best ?? { seat: s.seatOrder[0]!, leaderId: s.seats[s.seatOrder[0]!]!.leaderId!, influence: 0 }
  s = { ...s, firstSeat: first.seat }
  events.push({ type: 'FirstSeatSet', seat: first.seat, leaderId: first.leaderId, influence: first.influence })
  const round = (roundStarter ?? defaultRoundStart)(s)
  return { state: round.state, events: [...events, ...round.events], pending: round.pending ?? round.state.pending }
}

