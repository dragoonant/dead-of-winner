// cleanWaste (R6.6): a survivor at the colony spends any die; the top 3 waste cards leave the game (fewer if fewer remain).
import type { Action, CleanWasteAction } from '../actions'
import { fireInto, startOut, svc } from '../exposure'
import type { GameState, Rejection } from '../types'
import { checkActor, checkDecision, checkDie, finish, lowestDie, rej, rejected, spendDieInto, turnContext } from './die-common'

export function validateCleanWaste(state: GameState, a: CleanWasteAction): Rejection | null {
  const r0 = checkDecision(state, a) ?? checkActor(state, a.seat, a.survivorId)
  if (r0) return r0
  if (state.survivors[a.survivorId]!.location !== 'colony') return rej('E_WRONG_LOCATION', 'the waste is cleaned from the colony')
  if (svc().forbidden(state, 'cleanWaste', { survivorId: a.survivorId, seat: a.seat, location: 'colony' })) return rej('E_FORBIDDEN', 'cleaning waste is forbidden right now')
  if (state.waste.length === 0) return rej('E_TARGET_INVALID', 'the waste pile is empty')
  return checkDie(state, a.seat, a.dieId)
}

export function applyCleanWaste(state: GameState, a: CleanWasteAction) {
  const bad = validateCleanWaste(state, a)
  if (bad) return rejected(state, a, bad)
  const acc = startOut(state)
  spendDieInto(acc, a.seat, a.dieId, 'cleanWaste', a.survivorId)
  const cardIds = acc.state.waste.slice(0, 3)
  acc.state = { ...acc.state, waste: acc.state.waste.slice(3), removed: [...acc.state.removed, ...cardIds] }
  acc.events.push({ type: 'WasteCleaned', by: a.survivorId, cardIds, wasteAfter: acc.state.waste.length })
  fireInto(acc, 'action.cleanWaste', { seat: a.seat, survivorId: a.survivorId, location: 'colony' })
  return finish(acc, 'action.cleanWaste')
}

export function legalCleanWaste(state: GameState): Action[] {
  const ctx = turnContext(state)
  const die = ctx && lowestDie(ctx.dice)
  if (!ctx || !die) return []
  const out: Action[] = []
  for (const id of ctx.survivors) {
    const a: CleanWasteAction = { type: 'cleanWaste', decisionId: state.pending.id, seat: ctx.seat, survivorId: id, dieId: die.id }
    if (validateCleanWaste(state, a) === null) out.push(a)
  }
  return out.slice(0, 1)
}
