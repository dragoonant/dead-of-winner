// move (R7.4): once per survivor per turn, to a different location with a free survivor space (never the colony for an exiled seat); exposure follows,
// and a bite spreads among the survivors at the DESTINATION.
import type { Action, MoveAction } from '../actions'
import { woundOnMoveInto } from '../code-hooks'
import { addWoundInto, deathCheckAllAt, exposureInto, exposureOddsFor, fireInto, halted, patchSurvivor, startOut, svc } from '../exposure'
import type { ExposureOdds, GameState, LocationId, Rejection, SurvivorId } from '../types'
import { freeSurvivorSpaces, zombiesAt } from '../zombies'
import { checkActor, checkDecision, finish, rej, rejected, turnContext } from './die-common'

export function validateMove(state: GameState, a: MoveAction): Rejection | null {
  const r0 = checkDecision(state, a) ?? checkActor(state, a.seat, a.survivorId)
  if (r0) return r0
  const sv = state.survivors[a.survivorId]!
  if (!state.locations[a.to]) return rej('E_TARGET_INVALID', 'no such location')
  if (a.to === sv.location) return rej('E_TARGET_INVALID', 'the survivor is already there')
  if (a.to === 'colony' && state.seats[a.seat]?.seat.exiled) return rej('E_TARGET_INVALID', 'exiled survivors cannot move back to the colony') // digest, Exile
  if (sv.movedThisTurn && sv.extraMoves <= 0) return rej('E_ALREADY_MOVED', 'this survivor has already moved this turn')
  if (svc().forbidden(state, 'move', { survivorId: a.survivorId, seat: a.seat, location: sv.location })) return rej('E_FORBIDDEN', 'moving is forbidden right now')
  if (freeSurvivorSpaces(state, a.to) <= 0) return rej('E_NO_SPACE', 'no free survivor space there')
  return null
}

export function applyMove(state: GameState, a: MoveAction) {
  const bad = validateMove(state, a)
  if (bad) return rejected(state, a, bad)
  const acc = startOut(state)
  const sv = state.survivors[a.survivorId]!
  const from = sv.location
  acc.state = patchSurvivor(acc.state, a.survivorId, sv.movedThisTurn ? { location: a.to, extraMoves: sv.extraMoves - 1 } : { location: a.to, movedThisTurn: true })
  acc.events.push({ type: 'SurvivorMoved', survivorId: a.survivorId, from, to: a.to, kind: 'action' })
  deathCheckAllAt(acc, [from, a.to]) // leaving Buddy Davis can end a 3-wound survivor's protection (F 1.1.5)
  exposureInto(acc, a.survivorId, 'move', { grantAt: from })
  if (!halted(acc) && acc.state.survivors[a.survivorId]?.status === 'alive' && woundOnMoveInto(acc.state, a.to)) addWoundInto(acc, a.survivorId, 'wound', 'crossroads') // Bev Russel's School
  // the action.move window opens only if the mover is still alive and nothing is waiting on a decision (F 2.1.1)
  if (!halted(acc) && acc.state.survivors[a.survivorId]?.status === 'alive') fireInto(acc, 'action.move', { seat: a.seat, survivorId: a.survivorId, location: a.to })
  return finish(acc, 'action.move')
}

export interface MoveTargetInfo { location: LocationId; emptySpaces: number; zombies: number; exposure: ExposureOdds }
/** Every location the survivor could move to now, with the exposure it would cost. */
export function moveTargetsFor(state: GameState, survivorId: SurvivorId): MoveTargetInfo[] {
  const sv = state.survivors[survivorId]
  if (!sv || sv.status !== 'alive' || (sv.movedThisTurn && sv.extraMoves <= 0)) return []
  const exposure = exposureOddsFor(state, survivorId, 'move')
  return state.locationOrder
    .filter((l) => l !== sv.location && freeSurvivorSpaces(state, l) > 0 && !(l === 'colony' && sv.owner && state.seats[sv.owner]?.seat.exiled))
    .map((location) => ({ location, emptySpaces: freeSurvivorSpaces(state, location), zombies: zombiesAt(state, location), exposure }))
}

export function legalMoves(state: GameState): Action[] {
  const ctx = turnContext(state)
  if (!ctx) return []
  const out: Action[] = []
  for (const id of ctx.survivors) {
    for (const t of moveTargetsFor(state, id)) {
      const a: MoveAction = { type: 'move', decisionId: state.pending.id, seat: ctx.seat, survivorId: id, to: t.location }
      if (validateMove(state, a) === null) out.push(a)
    }
  }
  return out
}
