// barricade (R6.5): any die, one barricade onto an empty space of an entrance at the survivor's location.
import type { Action, BarricadeAction } from '../actions'
import { fireInto, patchEntrance, startOut, svc, type Out } from '../exposure'
import type { EntranceIndex, GameState, Id, LocationId, Rejection, SurvivorId } from '../types'
import { emptyEntranceSpaces, entranceAt } from '../zombies'
import { checkActor, checkDecision, checkDie, finish, lowestDie, rej, rejected, spendDieInto, turnContext } from './die-common'

/** Put one barricade on an entrance (also used by Ashley Ross's free barricade and cards). Returns false when the entrance is full. */
export function addBarricadeInto(acc: Out, location: LocationId, entrance: EntranceIndex, by: SurvivorId | Id): boolean {
  const e = entranceAt(acc.state, location, entrance)
  if (!e || emptyEntranceSpaces(acc.state, location, entrance) <= 0) return false
  acc.state = patchEntrance(acc.state, location, entrance, { barricades: e.barricades + 1 })
  acc.events.push({ type: 'BarricadeAdded', location, entrance, by, barricades: e.barricades + 1 })
  return true
}

export function validateBarricade(state: GameState, a: BarricadeAction): Rejection | null {
  const r0 = checkDecision(state, a) ?? checkActor(state, a.seat, a.survivorId)
  if (r0) return r0
  const sv = state.survivors[a.survivorId]!
  if (svc().forbidden(state, 'barricade', { survivorId: a.survivorId, seat: a.seat, location: sv.location })) return rej('E_FORBIDDEN', 'barricading is forbidden right now')
  if (!entranceAt(state, sv.location, a.entrance)) return rej('E_TARGET_INVALID', 'no such entrance here')
  if (emptyEntranceSpaces(state, sv.location, a.entrance) <= 0) return rej('E_NO_SPACE', 'that entrance is full')
  return checkDie(state, a.seat, a.dieId)
}

export function applyBarricade(state: GameState, a: BarricadeAction) {
  const bad = validateBarricade(state, a)
  if (bad) return rejected(state, a, bad)
  const acc = startOut(state)
  const sv = state.survivors[a.survivorId]!
  spendDieInto(acc, a.seat, a.dieId, 'barricade', a.survivorId)
  addBarricadeInto(acc, sv.location, a.entrance, a.survivorId)
  fireInto(acc, 'action.barricade', { seat: a.seat, survivorId: a.survivorId, location: sv.location })
  return finish(acc, 'action.barricade')
}

export function legalBarricades(state: GameState): Action[] {
  const ctx = turnContext(state)
  const die = ctx && lowestDie(ctx.dice)
  if (!ctx || !die) return []
  const out: Action[] = []
  for (const id of ctx.survivors) {
    for (const e of state.locations[state.survivors[id]!.location]!.entrances) {
      const a: BarricadeAction = { type: 'barricade', decisionId: state.pending.id, seat: ctx.seat, survivorId: id, dieId: die.id, entrance: e.index }
      if (validateBarricade(state, a) === null) out.push(a)
    }
  }
  return out
}
