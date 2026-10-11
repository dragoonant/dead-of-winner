// The player-turns phase machine (10 R4.1-R4.7, R7.7-R7.8, R12 timing, R15-R16): reveal the crisis, roll every seat's dice, then one
// turn per seat clockwise from the first seat. A turn opens with the Crossroads draw (by the seat to the right), the frostbite ticks and
// the `turn.start` window, offers `turnAction` until `endTurn` (which asks once for crisis cards), then returns the unrevealed
// Crossroads card and hands over. After the last turn the colony phase starts (registered with `registerColonyStarter`).
//
// Wiring for the step() router (index.ts): while `state.phase === 'playerTurns'`, step -> `stepPlayerTurns`, legalActions ->
// `legalPlayerTurnsActions`, validate -> `validatePlayerTurnsAction`. The machine answers EVERY pending kind that can appear in
// this phase (turn actions, search / request / Crossroads / bite / leader / exile / vote / effect sub-decisions), so the router stays
// a phase switch. Importing this module registers `startRound` as the round starter for phases/setup.ts (round 1).
//
// Unfinished flows: when a decision interrupts a multi-step flow (a frostbite death that asks for a new leader, a bite chain in an
// exile placement, a `turn.end` effect choice) the remaining work rides on the decision as `context.data.resume` (vote.ts
// attachResume / readResume) and is picked up when the decision is answered.
import type { Action, BiteSpreadAction, ChooseLeaderAction, ConcedeAction, SpendFoodAction, TurnActionType } from '../actions'
import { TURN_ACTION_TYPES } from '../actions'
import { applyUseAbility, legalAbilities } from '../actions/ability'
import { applyAttack, legalAttacks } from '../actions/attack'
import { applyAttract, legalAttracts } from '../actions/attract'
import { applyBarricade, legalBarricades } from '../actions/barricade'
import { applyCleanWaste, legalCleanWaste } from '../actions/clean'
import { contributeCandidates, contributeCrisis } from '../actions/crisis'
import { rejected } from '../actions/die-common'
import { handOff, handOffCandidates } from '../actions/handoff'
import { contributeObjective, contributeObjectiveCandidates } from '../actions/objective'
import { applyMove, legalMoves } from '../actions/move'
import { playCard, playCardCandidates } from '../actions/play'
import { request, requestCandidates, respondRequest } from '../actions/request'
import { applyKeepCard, applyMakeNoise, applySearch, legalSearches } from '../actions/search'
import {
  afterVote, applyCallVote, applyCastVotes, attachResume, ballotCandidates, continueAfterResult, legalCallVotes, readResume, type Resume,
} from '../actions/vote'
import { chooseCrossroadsOption, drawCrossroads, returnCrossroads } from '../crossroads'
import { applySpendFood, rollActionDice, validateSpendFood } from '../dice'
import {
  type ActionResult, afterAction, checkDecision, crisisDescriptor, expireEffects, fireWindow, isEffectPending, isForbidden, resumeEffects,
  resetRoundUses, routines, setRoutines,
} from '../effects'
import type { GameEvent } from '../events'
import { continuePlacements, exileSeat, raisePlacement, applyPlaceExiled, validatePlaceExiled, type Placement } from '../exile'
import {
  type Out, addWoundInto, applyBiteSpread, halted, isOver, mergeInto, raisePending, resumeBiteChain, startOut, validateBiteSpread,
} from '../exposure'
import { applyChooseLeader, applyExiledPlacement, isExiledPlacement, validateChooseLeader } from '../survivors'
import type {
  DecisionKind, GameState, LocationId, PendingDecision, Rejection, SeatId, StepResult, SurvivorId,
} from '../types'
import { EngineInvariantError } from '../types'
import { registerRoundStarter } from './setup'

// ---------- colony hand-off ----------
export type ColonyStarter = (state: GameState) => Out & { pending?: PendingDecision }
let colonyStarter: ColonyStarter | null = null
/** The colony phase module registers itself here; it receives the state with `phase: 'colony'` and returns the next pending
 *  (a decision it raised, or the next round's first turn via `startRound`). */
export function registerColonyStarter(fn: ColonyStarter | null): void { colonyStarter = fn }

/** Fallback until a colony module registers: tick the round track, pass the token, start the next round. Plays no colony step. */
const defaultColony: ColonyStarter = (state) => {
  const acc = startOut(state)
  const roundsLeft = state.roundsLeft - 1
  acc.state = { ...state, roundsLeft }
  acc.events.push({ type: 'RoundTicked', roundsLeft })
  const ex = expireEffects(acc.state, 'roundEnd')
  acc.state = ex.state; acc.events.push(...ex.events)
  if (roundsLeft <= 0) {
    const r = routines.endGame(acc.state, 'roundsOut')
    return { state: r.state, events: [...acc.events, ...r.events], pending: r.state.pending }
  }
  const order = acc.state.seatOrder
  const to = order[(order.indexOf(acc.state.firstSeat) - 1 + order.length) % order.length]!
  acc.events.push({ type: 'FirstSeatPassed', from: acc.state.firstSeat, to })
  acc.state = { ...acc.state, firstSeat: to }
  const next = startRound(acc.state)
  return { state: next.state, events: [...acc.events, ...next.events], pending: next.pending }
}

// ---------- small helpers ----------
type Part = { state: GameState; events: GameEvent[]; pending?: PendingDecision; rejection?: Rejection }
const rej = (code: Rejection['code'], message: string, detail?: Record<string, unknown>): Rejection => ({ code, message, ...(detail ? { detail } : {}) })
const eliminated = (state: GameState, seat: SeatId): boolean => !!state.seats[seat]?.seat.eliminated

/** Seats in turn order for this round: clockwise from the first-player token (R4.3). */
export function roundOrder(state: GameState): SeatId[] {
  const i = Math.max(0, state.seatOrder.indexOf(state.firstSeat))
  return [...state.seatOrder.slice(i), ...state.seatOrder.slice(0, i)]
}

// ---------- round start (R4.1, R4.2) ----------
/** Reveal the crisis, roll dice, open the first turn. Used for round 1 (phases/setup.ts) and by the colony phase's passToken step. */
export function startRound(state0: GameState): Out & { pending: PendingDecision } {
  const roundNumber = state0.roundNumber + 1
  const acc = startOut({ ...state0, phase: 'playerTurns', colonyStep: null, roundNumber, turn: null, activeSeat: null, crisis: { ...state0.crisis, result: null } })
  acc.events.push({ type: 'PhaseChanged', phase: 'playerTurns' }, { type: 'RoundStarted', roundNumber, roundsLeft: acc.state.roundsLeft })
  const window = (point: Parameters<typeof fireWindow>[1]) => { mergeInto(acc, fireWindow(acc.state, point, {})); return halted(acc) }
  if (!window('round.start')) {
    // R4.1 reveal
    const top = acc.state.crisisDeck[0]
    if (top) {
      let prevent: GameState['crisis']['cardId'][] = []
      try { prevent = crisisDescriptor(acc.state, top)?.prevent ?? [] } catch { prevent = [] }
      acc.state = { ...acc.state, crisisDeck: acc.state.crisisDeck.slice(1), crisis: { ...acc.state.crisis, cardId: top } }
      acc.events.push({ type: 'CrisisRevealed', cardId: top, prevent: prevent as never[], roundNumber })
    } else acc.state = { ...acc.state, crisis: { ...acc.state.crisis, cardId: null } }
    if (!window('crisis.revealed')) {
      // R4.2 roll; once-per-game uses survive the roll (rollActionDice clears every use table)
      const keep = resetRoundUses(acc.state)
      const dice = rollActionDice(acc.state)
      const seats = { ...dice.state.seats }
      for (const id of Object.keys(seats)) seats[id] = { ...seats[id]!, abilityUses: keep.seats[id]!.abilityUses }
      acc.state = { ...dice.state, seats, cardUses: keep.cardUses }
      acc.events.push(...dice.events)
      if (!window('dice.rolled')) beginFirstTurn(acc)
    }
  }
  return finishOut(acc)
}

function beginFirstTurn(acc: Out): void {
  const order = roundOrder(acc.state)
  const i = order.findIndex((s) => !eliminated(acc.state, s))
  if (i < 0) endPlayerTurns(acc)
  else beginTurn(acc, i)
}

// ---------- turn start (R4.4) ----------
function beginTurn(acc: Out, index: number): void {
  const seat = roundOrder(acc.state)[index]!
  const s = acc.state
  let survivors = s.survivors
  for (const sv of Object.values(s.survivors)) {
    if (sv.movedThisTurn || sv.extraMoves) {
      if (survivors === s.survivors) survivors = { ...s.survivors }
      survivors[sv.id] = { ...sv, movedThisTurn: false, extraMoves: 0 }
    }
  }
  const turnCount = s.turnCount + 1
  acc.state = { ...s, survivors, activeSeat: seat, turnCount, turn: { seat, index, actions: 0, voteCalled: false, contributionAsked: false } }
  acc.events.push({ type: 'TurnStarted', seat, turnCount, roundNumber: s.roundNumber })
  const cx = drawCrossroads(acc.state, seat)
  acc.state = cx.state; acc.events.push(...cx.events)
  runTicks(acc, [...acc.state.seats[seat]!.survivors])
}

/** (b) one plain wound on each survivor with frostbite, in the seat's survivor order; a death goes through the kill routine first. */
function runTicks(acc: Out, ids: SurvivorId[]): void {
  for (let i = 0; i < ids.length; i++) {
    const sv = acc.state.survivors[ids[i]!]
    if (!sv || sv.status !== 'alive' || sv.frostbite < 1) continue
    acc.events.push({ type: 'FrostbiteTicked', survivorId: sv.id, frostbite: sv.frostbite })
    addWoundInto(acc, sv.id, 'wound', 'frostbiteTick')
    if (halted(acc)) {
      if (!isOver(acc.state)) attachResume(acc, { k: 'tick', rest: ids.slice(i + 1) })
      return
    }
  }
  // (c) the turn.start window, then the held Crossroads card is checked once (R12.2)
  mergeInto(acc, afterAction(acc.state, 'turn.start', { seat: acc.state.turn!.seat }))
}

// ---------- turn end (R4.6) ----------
const canContribute = (state: GameState, seat: SeatId): boolean => {
  if (isForbidden(state, 'contribute', { seat })) return false
  const st = state.seats[seat]!
  return st.hand.length > 0 || st.survivors.some((id) => (state.survivors[id]?.equipped.length ?? 0) > 0)
}

/** `endTurn` and the skip of an eliminated seat's turn. Asks for crisis cards once, then closes the turn. */
function endTurnFlow(acc: Out, skipAsk: boolean): void {
  const turn = acc.state.turn!
  const seat = turn.seat
  const st = acc.state.seats[seat]!
  if (!skipAsk && !st.seat.exiled && !st.seat.eliminated && !turn.contributionAsked) {
    acc.state = { ...acc.state, turn: { ...turn, contributionAsked: true } }
    if (canContribute(acc.state, seat)) {
      raisePending(acc, (id) => ({
        seat, kind: 'crisisContribution', window: 'turn.end', context: { seatId: seat }, canPass: false,
        options: [{ id: 'none', label: 'Add nothing', action: { type: 'contributeCrisis', decisionId: id, seat, cardIds: [] } }],
      }))
      return
    }
    acc.events.push({ type: 'DecisionAutoResolved', kind: 'crisisContribution', seat, optionId: 'none' })
  }
  mergeInto(acc, fireWindow(acc.state, 'turn.end', { seat }))
  if (halted(acc)) { if (!isOver(acc.state)) attachResume(acc, { k: 'turnClose' }); return }
  closeTurnTail(acc)
}

function closeTurnTail(acc: Out): void {
  const turn = acc.state.turn!
  const back = returnCrossroads(acc.state)
  acc.state = back.state; acc.events.push(...back.events)
  const ex = expireEffects(acc.state, 'turnEnd')
  acc.state = ex.state; acc.events.push(...ex.events)
  acc.events.push({ type: 'TurnEnded', seat: turn.seat, turnCount: acc.state.turnCount })
  const order = roundOrder(acc.state)
  let i = turn.index + 1
  while (i < order.length && eliminated(acc.state, order[i]!)) i++
  if (i < order.length) beginTurn(acc, i)
  else endPlayerTurns(acc)
}

/** R4.7: the last turn is over; the colony phase takes the state. */
function endPlayerTurns(acc: Out): void {
  acc.state = { ...acc.state, phase: 'colony', colonyStep: null, turn: null, activeSeat: null }
  acc.events.push({ type: 'PhaseChanged', phase: 'colony' })
  const out = (colonyStarter ?? defaultColony)(acc.state)
  acc.state = out.state
  acc.events.push(...out.events)
  if (out.pending) acc.pending = out.pending
}

// ---------- closing a step ----------
/** Make sure exactly one decision is open: a gameOver when the game ended, else this turn's next turnAction (skipping eliminated seats). */
function settle(acc: Out): void {
  for (let guard = 0; guard < 64; guard++) {
    const s = acc.state
    if (isOver(s) || acc.pending || s.phase !== 'playerTurns' || !s.turn) return
    const seat = s.turn.seat
    if (eliminated(s, seat)) { endTurnFlow(acc, true); continue }
    raisePending(acc, () => ({ seat, kind: 'turnAction', window: 'turn.start', context: { seatId: seat }, canPass: false }))
    return
  }
  throw new EngineInvariantError('player-turns: the turn loop did not settle')
}

function finishOut(acc: Out): Out & { pending: PendingDecision } {
  settle(acc)
  let pending = acc.pending
  if (isOver(acc.state)) {
    if (pending?.kind !== 'gameOver') {
      pending = acc.state.pending.kind === 'gameOver' ? acc.state.pending
        : raisePending(acc, () => ({ seat: 'all', kind: 'gameOver', window: 'game.end', context: {}, canPass: false }))
    }
  }
  if (!pending) throw new EngineInvariantError('player-turns: no decision is open after the step')
  return { state: { ...acc.state, pending }, events: acc.events, pending }
}

function finalize(acc: Out, resume?: Resume): StepResult {
  if (!isOver(acc.state)) {
    if (acc.pending) { if (resume) attachResume(acc, resume) } else continueFrom(acc, resume)
  }
  const o = finishOut(acc)
  return { state: o.state, events: o.events, pending: o.pending }
}

/** Pick up a flow that a decision interrupted (or, with nothing to resume, begin the first turn of a round whose start window asked). */
function continueFrom(acc: Out, r?: Resume): void {
  const s = acc.state
  switch (r?.k) {
    case 'tick': runTicks(acc, (r.rest as SurvivorId[]) ?? []); return
    case 'endTurn': if (s.turn) endTurnFlow(acc, false); return
    case 'turnClose': if (s.turn) closeTurnTail(acc); return
    case 'afterVote': afterVote(acc, r.caller as SeatId); return
    case 'exile': continueAfterResult(acc, true, r.target as SeatId, r.caller as SeatId); return
    case 'placePrompt': {
      raisePlacement(acc, r.seat as SeatId)
      const then = r.then as Resume | undefined
      if (acc.pending) { if (then) attachResume(acc, then) } else continueFrom(acc, then)
      return
    }
    case 'place': {
      const left = continuePlacements(acc.state, r.seat as SeatId, r.rest as Placement[])
      mergeInto(acc, left)
      afterPlacements(acc, left.rest, r.seat as SeatId, r.then as Resume | undefined)
      return
    }
    default:
      if (s.phase === 'playerTurns' && s.turn === null) beginFirstTurn(acc)
  }
}

function afterPlacements(acc: Out, rest: Placement[], seat: SeatId, then?: Resume): void {
  if (isOver(acc.state)) return
  if (acc.pending) {
    if (rest.length > 0) attachResume(acc, { k: 'place', seat, rest, ...(then ? { then } : {}) })
    else if (then) attachResume(acc, then)
    return
  }
  continueFrom(acc, then)
}

// ---------- the answers ----------
const EFFECT_ANSWERS = new Set<string>(['effectChoice', 'itemTarget', 'objectiveChoice', 'chooseLeader', 'castVotes'])
const ACCEPT: Partial<Record<DecisionKind, readonly string[]>> = {
  turnAction: TURN_ACTION_TYPES,
  searchKeepOrNoise: ['keepCard', 'makeNoise'], searchKeepWhich: ['keepCard'],
  crisisContribution: ['contributeCrisis'], requestResponse: ['respondRequest'], crossroadsOption: ['chooseCrossroadsOption'],
  biteSpreadOption: ['biteSpread'], newLeader: ['chooseLeader'], exilePlacement: ['placeExiled'], votes: ['castVotes'],
  effectChoice: ['effectChoice'], itemTarget: ['itemTarget'], objectiveChoice: ['objectiveChoice'],
}

function precheck(state: GameState, action: Action): Rejection | null {
  if (state.phase === 'ended') return rej('E_GAME_OVER', 'the game is over')
  if (state.phase !== 'playerTurns') return rej('E_WRONG_DECISION', 'the game is not in the player-turns phase')
  const pd = state.pending
  if (action.decisionId !== pd.id) return rej('E_WRONG_DECISION', 'this is not the open decision', { expected: pd.id })
  if (action.type === 'concede') {
    if (pd.seat !== 'all' && action.seat !== pd.seat) return rej('E_NOT_YOUR_DECISION', 'the open decision belongs to another seat')
    if (state.seats[action.seat]?.seat.kind !== 'human') return rej('E_NOT_YOUR_DECISION', 'only a human seat can concede')
    return null
  }
  if (action.seat !== pd.seat) return rej('E_NOT_YOUR_DECISION', 'the open decision belongs to another seat', { expected: pd.seat })
  if (action.type === 'pass') return rej('E_NOT_AN_OPTION', 'this decision cannot be passed')
  if (!ACCEPT[pd.kind]?.includes(action.type)) return rej('E_WRONG_DECISION', `${action.type} does not answer ${pd.kind}`)
  return null
}

function spendFoodPart(state: GameState, a: SpendFoodAction): Part {
  const bad = checkDecision(state, a, ['turnAction']) ?? validateSpendFood(state, a)
  if (bad) return { state, events: [], rejection: bad }
  const acc = startOut(state)
  mergeInto(acc, applySpendFood(state, a))
  mergeInto(acc, afterAction(acc.state, 'action.spendFood', { seat: a.seat, dieId: a.dieId, params: { tokens: a.tokens } }))
  return acc
}

function endTurnPart(state: GameState, a: Action): Part {
  const bad = checkDecision(state, a as { decisionId: string; seat: string }, ['turnAction'])
  if (bad) return { state, events: [], rejection: bad }
  const acc = startOut(state)
  endTurnFlow(acc, false)
  return acc
}

function turnActionPart(state: GameState, action: Action & { type: TurnActionType }): Part {
  switch (action.type) {
    case 'attack': return applyAttack(state, action)
    case 'search': return applySearch(state, action)
    case 'barricade': return applyBarricade(state, action)
    case 'cleanWaste': return applyCleanWaste(state, action)
    case 'attract': return applyAttract(state, action)
    case 'move': return applyMove(state, action)
    case 'useAbility': return applyUseAbility(state, action)
    case 'playCard': return playCard(state, action)
    case 'contributeCrisis': return contributeCrisis(state, action)
    case 'contributeObjective': return contributeObjective(state, action)
    case 'spendFood': return spendFoodPart(state, action)
    case 'request': return request(state, action)
    case 'handOff': return handOff(state, action)
    case 'callVote': return applyCallVote(state, action)
    case 'endTurn': return endTurnPart(state, action)
  }
}

function leaderPart(state: GameState, a: ChooseLeaderAction): Part {
  const bad = validateChooseLeader(state, a.seat, a.survivorId)
  if (bad) return { state, events: [], rejection: bad }
  const acc = startOut(state)
  mergeInto(acc, applyChooseLeader(state, a.seat, a.survivorId, 'replacement'))
  if (acc.state.bite) mergeInto(acc, resumeBiteChain(acc.state)) // a bite chain was waiting on this leader
  return acc
}

function biteSpreadPart(state: GameState, a: BiteSpreadAction): Part {
  const bad = validateBiteSpread(state, a)
  if (bad) return { state, events: [], rejection: bad }
  return applyBiteSpread(state, a)
}

function exiledPlacementPart(state: GameState, a: Action & { type: 'effectChoice' }): Part {
  const pd = state.pending
  if (!isExiledPlacement(pd)) return { state, events: [], rejection: rej('E_WRONG_DECISION', 'no effect is waiting for an answer') }
  if (!(pd.options ?? []).some((o) => o.id === a.optionId)) return { state, events: [], rejection: rej('E_NOT_AN_OPTION', 'not one of the offered places') }
  const acc = startOut(state)
  mergeInto(acc, applyExiledPlacement(state, a.seat, pd.context.survivorId!, a.optionId as LocationId))
  if (acc.state.bite) mergeInto(acc, resumeBiteChain(acc.state))
  return acc
}

function concede(state: GameState, a: ConcedeAction): StepResult {
  const r = routines.endGame(state, 'concession')
  return finalize({ state: r.state, events: r.events, ...(r.pending ? { pending: r.pending } : {}) })
}

function dispatch(state: GameState, action: Action): StepResult {
  const pd = state.pending
  let resume = readResume(pd)
  if (action.type === 'concede') return concede(state, action)
  let part: Part
  if (isEffectPending(state) && EFFECT_ANSWERS.has(action.type)) part = resumeEffects(state, action) as ActionResult
  else {
    switch (pd.kind) {
      case 'turnAction': part = turnActionPart(state, action as Action & { type: TurnActionType }); resume = undefined; break
      case 'searchKeepOrNoise': case 'searchKeepWhich':
        part = action.type === 'keepCard' ? applyKeepCard(state, action) : applyMakeNoise(state, action as Action & { type: 'makeNoise' }); break
      case 'crisisContribution': part = contributeCrisis(state, action as Action & { type: 'contributeCrisis' }); resume = { k: 'endTurn' }; break
      case 'requestResponse': part = respondRequest(state, action as Action & { type: 'respondRequest' }); break
      case 'crossroadsOption': part = chooseCrossroadsOption(state, action as Action & { type: 'chooseCrossroadsOption' }); break
      case 'biteSpreadOption': part = biteSpreadPart(state, action as BiteSpreadAction); break
      case 'newLeader': part = leaderPart(state, action as ChooseLeaderAction); break
      case 'votes': part = applyCastVotes(state, action as Action & { type: 'castVotes' }); break
      case 'effectChoice': part = exiledPlacementPart(state, action as Action & { type: 'effectChoice' }); break
      case 'exilePlacement': {
        const a = action as Action & { type: 'placeExiled' }
        const bad = validatePlaceExiled(state, a)
        if (bad) return rejected(state, action, bad)
        const out = applyPlaceExiled(state, a)
        const acc: Out = { state: out.state, events: out.events, ...(out.pending ? { pending: out.pending } : {}) }
        if (!isOver(acc.state) && acc.pending) {
          if (out.rest.length > 0) attachResume(acc, { k: 'place', seat: a.seat, rest: out.rest, ...(resume ? { then: resume } : {}) })
          else if (resume) attachResume(acc, resume)
          return finalize(acc)
        }
        return finalize(acc, resume)
      }
      default: return rejected(state, action, rej('E_WRONG_DECISION', `${pd.kind} cannot be answered here`))
    }
  }
  if (part.rejection) return rejected(state, action, part.rejection)
  const acc: Out = { state: part.state, events: [...part.events] }
  // a generic turnAction raised by a sub-module is kept unless the seat has been eliminated meanwhile (settle re-raises)
  if (part.pending && !(part.pending.kind === 'turnAction' && state.turn && eliminated(part.state, state.turn.seat))) acc.pending = part.pending
  return finalize(acc, resume)
}

/** The phase's reducer: validates against the open decision, applies, and returns exactly one new pending. */
export function stepPlayerTurns(state: GameState, action: Action): StepResult {
  const bad = precheck(state, action)
  if (bad) return rejected(state, action, bad)
  return dispatch(state, action)
}

/** Exactly the checks `stepPlayerTurns` runs (the reducer is pure, so this is the step without keeping its result). */
export function validatePlayerTurnsAction(state: GameState, action: Action): Rejection | null {
  return stepPlayerTurns(state, action).rejection ?? null
}

// ---------- legalActions ----------
function spendFoodCandidates(state: GameState): Action[] {
  const pd = state.pending
  if (pd.kind !== 'turnAction' || pd.seat === 'all') return []
  const out: Action[] = []
  const seen = new Set<number>()
  for (const d of state.seats[pd.seat]!.dice) {
    if (d.used || seen.has(d.value)) continue
    seen.add(d.value)
    for (let tokens = 1; tokens <= 6 - d.value; tokens++) {
      const a: SpendFoodAction = { type: 'spendFood', decisionId: pd.id, seat: pd.seat, dieId: d.id, tokens }
      if (validateSpendFood(state, a) === null) out.push(a)
    }
  }
  return out
}

/** Answers to `state.pending` while the phase is playerTurns. Never empty: `endTurn`, the empty contribution and the all-no ballot always qualify. */
export function legalPlayerTurnsActions(state: GameState): Action[] {
  const pd = state.pending
  switch (pd.kind) {
    case 'turnAction': {
      if (pd.seat === 'all') return []
      return [
        ...legalAttacks(state), ...legalSearches(state), ...legalBarricades(state), ...legalCleanWaste(state), ...legalAttracts(state), ...legalMoves(state),
        ...playCardCandidates(state), ...contributeCandidates(state), ...contributeObjectiveCandidates(state), ...requestCandidates(state), ...handOffCandidates(state), ...legalAbilities(state),
        ...spendFoodCandidates(state), ...legalCallVotes(state),
        { type: 'endTurn', decisionId: pd.id, seat: pd.seat },
      ]
    }
    case 'crisisContribution': return contributeCandidates(state)
    case 'votes': return ballotCandidates(state)
    default: return (pd.options ?? []).map((o) => o.action)
  }
}

// ---------- registration ----------
registerRoundStarter(startRound)
setRoutines({
  exileSeat: (state, seat) => {
    const x = exileSeat(state, seat)
    return { state: x.state, events: x.events, ...(x.pending ? { pending: x.pending } : {}) }
  },
})
