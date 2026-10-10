// handOff (R7.6): an equipped item moves from one of the seat's survivors to another alive survivor at the same location,
// own or another seat's. A once-per-round use already spent stays spent (the count lives on the card instance).
import type { HandOffAction } from '../actions'
import {
  type ActionResult, afterActionJobs, checkDecision, emitEvent, mkAcc, rejection, runJobs, setSurvivor,
} from '../effects'
import type { GameState, Rejection } from '../types'

export function validateHandOff(state: GameState, a: HandOffAction): Rejection | null {
  const bad = checkDecision(state, a, ['turnAction'])
  if (bad) return bad
  const from = Object.values(state.survivors).find((s) => s.equipped.includes(a.cardId))
  if (!from) return rejection('E_NOT_EQUIPPED', 'that card is not equipped')
  if (from.owner !== a.seat) return rejection('E_NOT_YOUR_SURVIVOR', 'that item is on another seat\'s survivor')
  const to = state.survivors[a.toSurvivorId]
  if (!to) return rejection('E_BAD_PAYLOAD', 'unknown survivor')
  if (to.status !== 'alive') return rejection('E_SURVIVOR_DEAD', 'that survivor is gone')
  if (to.id === from.id) return rejection('E_TARGET_INVALID', 'the item is already on that survivor')
  if (to.location !== from.location) return rejection('E_WRONG_LOCATION', 'the survivors are not at the same location')
  return null
}

export function handOff(state: GameState, a: HandOffAction): ActionResult {
  const bad = validateHandOff(state, a)
  if (bad) return { state, events: [], rejection: bad }
  const acc = mkAcc(state)
  const from = Object.values(state.survivors).find((s) => s.equipped.includes(a.cardId))!
  setSurvivor(acc, from.id, { equipped: from.equipped.filter((c) => c !== a.cardId) })
  setSurvivor(acc, a.toSurvivorId, { equipped: [...acc.state.survivors[a.toSurvivorId]!.equipped, a.cardId] })
  emitEvent(acc, { type: 'CardHandedOff', cardId: a.cardId, fromSurvivorId: from.id, toSurvivorId: a.toSurvivorId })
  const pending = runJobs(acc, afterActionJobs('action.handOff', { seat: a.seat, survivorId: from.id, targetId: a.toSurvivorId, cardId: a.cardId, location: from.location }))
  return { state: acc.state, events: acc.events, ...(pending ? { pending } : {}) }
}

export function handOffCandidates(state: GameState): HandOffAction[] {
  const pd = state.pending
  if (pd.kind !== 'turnAction' || pd.seat === 'all') return []
  const out: HandOffAction[] = []
  for (const sid of state.seats[pd.seat]!.survivors) {
    const sv = state.survivors[sid]!
    if (sv.status !== 'alive') continue
    for (const cardId of sv.equipped) {
      for (const other of Object.values(state.survivors)) {
        const a: HandOffAction = { type: 'handOff', decisionId: pd.id, seat: pd.seat, cardId, toSurvivorId: other.id }
        if (!validateHandOff(state, a)) out.push(a)
      }
    }
  }
  return out
}
