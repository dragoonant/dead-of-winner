// Colony phase entry points for step() (10 R4.7-R4.15). The work is in ../colony-phase.ts; this is the seam the reducer calls.
//
//   - the player-turns phase calls `enterColonyPhase(state)` right after the last seat's `endTurn` has fully resolved;
//   - when the colony phase raised a decision (newLeader after an overrun, an effect choice in a crisis fail effect, a bite
//     spreading from a crisis exposure, an effect vote) `stepColony` answers it with the same sub-handlers the player-turns
//     phase uses and, once nothing is pending, carries the phase on with `continueColonyPhase` (guard: `colonyInProgress`);
//   - the player-turns phase registers its round start with `registerNextRoundStarter` so rounds 2.. start the way round 1 does.
//   - every step() result should pass through `finalizeEnding` (objectives.ts): modules that end the game at morale 0 do not know the winners.
import type { Action, BiteSpreadAction, ChooseLeaderAction, PlaceExiledAction } from '../actions'
import { rejected } from '../actions/die-common'
import { attachResume, ballotCandidates, readResume } from '../actions/vote'
import { beginColonyPhase, colonyInProgress, registerNextRoundStarter, resumeColonyPhase, type ColonyOut } from '../colony-phase'
import { chooseCrossroadsOption } from '../crossroads'
import { type ActionResult, isEffectPending, resumeEffects } from '../effects'
import { applyPlaceExiled, continuePlacements, validatePlaceExiled, type Placement } from '../exile'
import { type Out, applyBiteSpread, halted, isOver, mergeInto, raisePending, resumeBiteChain, startOut, validateBiteSpread } from '../exposure'
import { finalizeEnding } from '../objectives'
import { applyChooseLeader, applyExiledPlacement, isExiledPlacement, validateChooseLeader } from '../survivors'
import type { DecisionKind, GameState, Rejection, SeatId, StepResult } from '../types'

export { colonyInProgress, registerNextRoundStarter, finalizeEnding }
export type { ColonyOut }

export const enterColonyPhase = (state: GameState): ColonyOut => beginColonyPhase(state)
export const continueColonyPhase = (state: GameState): ColonyOut => resumeColonyPhase(state)

// ---------- answering a decision the colony phase raised ----------
const rej = (code: Rejection['code'], message: string, detail?: Record<string, unknown>): Rejection => ({ code, message, ...(detail ? { detail } : {}) })
const EFFECT_ANSWERS = new Set<string>(['effectChoice', 'itemTarget', 'objectiveChoice', 'chooseLeader', 'castVotes'])
const ACCEPT: Partial<Record<DecisionKind, readonly string[]>> = {
  newLeader: ['chooseLeader'], biteSpreadOption: ['biteSpread'], effectChoice: ['effectChoice'], itemTarget: ['itemTarget'],
  objectiveChoice: ['objectiveChoice'], votes: ['castVotes'], exilePlacement: ['placeExiled'], crossroadsOption: ['chooseCrossroadsOption'],
}

function precheck(state: GameState, action: Action): Rejection | null {
  if (state.phase === 'ended') return rej('E_GAME_OVER', 'the game is over')
  if (state.phase !== 'colony') return rej('E_WRONG_DECISION', 'the game is not in the colony phase')
  const pd = state.pending
  if (action.decisionId !== pd.id) return rej('E_WRONG_DECISION', 'this is not the open decision', { expected: pd.id })
  if (action.seat !== pd.seat) return rej('E_NOT_YOUR_DECISION', 'the open decision belongs to another seat', { expected: pd.seat })
  if (action.type === 'pass') return rej('E_NOT_AN_OPTION', 'this decision cannot be passed')
  if (!ACCEPT[pd.kind]?.includes(action.type)) return rej('E_WRONG_DECISION', `${action.type} does not answer ${pd.kind}`)
  return null
}

function answer(state: GameState, action: Action): ActionResult {
  const pd = state.pending
  if (isEffectPending(state) && EFFECT_ANSWERS.has(action.type)) return resumeEffects(state, action)
  switch (pd.kind) {
    case 'newLeader': {
      const a = action as ChooseLeaderAction
      const bad = validateChooseLeader(state, a.seat, a.survivorId)
      if (bad) return { state, events: [], rejection: bad }
      const acc = startOut(state)
      mergeInto(acc, applyChooseLeader(state, a.seat, a.survivorId, 'replacement'))
      if (acc.state.bite) mergeInto(acc, resumeBiteChain(acc.state))
      return acc
    }
    case 'biteSpreadOption': {
      const bad = validateBiteSpread(state, action as BiteSpreadAction)
      if (bad) return { state, events: [], rejection: bad }
      return applyBiteSpread(state, action as BiteSpreadAction)
    }
    case 'effectChoice': {
      const a = action as Action & { type: 'effectChoice' }
      if (!isExiledPlacement(pd)) return { state, events: [], rejection: rej('E_WRONG_DECISION', 'no effect is waiting for an answer') }
      if (!(pd.options ?? []).some((o) => o.id === a.optionId)) return { state, events: [], rejection: rej('E_NOT_AN_OPTION', 'not one of the offered places') }
      const acc = startOut(state)
      mergeInto(acc, applyExiledPlacement(state, a.seat, pd.context.survivorId!, a.optionId))
      if (acc.state.bite) mergeInto(acc, resumeBiteChain(acc.state))
      return acc
    }
    case 'exilePlacement': {
      const a = action as PlaceExiledAction
      const bad = validatePlaceExiled(state, a)
      if (bad) return { state, events: [], rejection: bad }
      const out = applyPlaceExiled(state, a)
      const acc: Out = { state: out.state, events: out.events, ...(out.pending ? { pending: out.pending } : {}) }
      if (acc.pending && out.rest.length > 0 && !isOver(acc.state)) attachResume(acc, { k: 'place', seat: a.seat, rest: out.rest })
      return acc
    }
    case 'crossroadsOption': return chooseCrossroadsOption(state, action as Action & { type: 'chooseCrossroadsOption' })
    default: return { state, events: [], rejection: rej('E_WRONG_DECISION', `${pd.kind} cannot be answered here`) }
  }
}

/** Exactly one decision: the one a routine raised, the next round's first turn, or `gameOver`. */
function close(acc: Out): StepResult {
  let pending = acc.pending ?? acc.state.pending
  if (isOver(acc.state) && pending.kind !== 'gameOver') {
    pending = acc.state.pending.kind === 'gameOver' ? acc.state.pending
      : raisePending(acc, () => ({ seat: 'all', kind: 'gameOver', window: 'game.end', context: {}, canPass: false }))
  }
  const state = { ...acc.state, pending }
  return finalizeEnding({ state, events: acc.events, pending })
}

/** The colony phase's reducer: answer the open decision, finish any interrupted exile placement, then carry the phase on. */
export function stepColony(state: GameState, action: Action): StepResult {
  const bad = precheck(state, action)
  if (bad) return rejected(state, action, bad)
  const resume = readResume(state.pending)
  const part = answer(state, action)
  if (part.rejection) return rejected(state, action, part.rejection)
  const acc: Out = { state: part.state, events: [...part.events], ...(part.pending ? { pending: part.pending } : {}) }
  if (!halted(acc) && resume?.k === 'place') {
    const seat = resume['seat'] as SeatId
    const left = continuePlacements(acc.state, seat, (resume['rest'] as Placement[]) ?? [])
    mergeInto(acc, left)
    if (acc.pending && left.rest.length > 0 && !isOver(acc.state)) attachResume(acc, { k: 'place', seat, rest: left.rest })
  }
  if (!halted(acc) && colonyInProgress(acc.state)) mergeInto(acc, continueColonyPhase(acc.state))
  return close(acc)
}

/** Exactly the checks `stepColony` runs (the reducer is pure, so this is the step without keeping its result). */
export function validateColonyAction(state: GameState, action: Action): Rejection | null {
  return stepColony(state, action).rejection ?? null
}

/** Answers to `state.pending` while the phase is colony: the engine's own options, or every ballot for an effect vote. Never empty. */
export function legalColonyActions(state: GameState): Action[] {
  const pd = state.pending
  if (pd.kind === 'votes') return ballotCandidates(state)
  return (pd.options ?? []).map((o) => o.action)
}
