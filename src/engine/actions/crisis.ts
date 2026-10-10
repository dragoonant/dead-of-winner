// contributeCrisis (R7.3, R12): cards from hand and/or equipped go face down onto the crisis pile; contributions cannot be
// taken back. A turn action at any time on the own turn, and the answer to `crisisContribution` at endTurn (R4.6).
import type { ContributeCrisisAction } from '../actions'
import {
  type ActionResult, afterActionJobs, checkDecision, emitEvent, isForbidden, mkAcc, patchState, rejection, runJobs, setSeatState, setSurvivor, wasGiven,
} from '../effects'
import type { CardId, GameState, Rejection, SurvivorId } from '../types'

const equippedOn = (state: GameState, cardId: CardId): SurvivorId | undefined =>
  Object.values(state.survivors).find((s) => s.equipped.includes(cardId))?.id

export function validateContribute(state: GameState, a: ContributeCrisisAction): Rejection | null {
  const bad = checkDecision(state, a, ['turnAction', 'crisisContribution'])
  if (bad) return bad
  const st = state.seats[a.seat]
  if (!st) return rejection('E_NOT_YOUR_DECISION', 'unknown seat')
  if (st.seat.exiled) return rejection('E_EXILED', 'an exiled seat cannot add to the crisis')
  if (isForbidden(state, 'contribute', { seat: a.seat })) return rejection('E_FORBIDDEN', 'contributing is forbidden right now')
  if (state.pending.kind === 'turnAction' && a.cardIds.length === 0) return rejection('E_BAD_PAYLOAD', 'name at least one card')
  if (new Set(a.cardIds).size !== a.cardIds.length) return rejection('E_BAD_PAYLOAD', 'a card is named twice')
  for (const id of a.cardIds) {
    if (st.hand.includes(id)) continue
    const bearer = equippedOn(state, id)
    if (bearer) {
      if (state.survivors[bearer]!.owner !== a.seat) return rejection('E_NOT_YOUR_SURVIVOR', 'that item is on another seat\'s survivor')
      continue
    }
    if (wasGiven(state, id)) return rejection('E_REQUESTED_CARD', 'a requested card was already played')
    return rejection('E_NOT_IN_HAND', 'that card is not in your hand or equipped')
  }
  return null
}

export function contributeCrisis(state: GameState, a: ContributeCrisisAction): ActionResult {
  const bad = validateContribute(state, a)
  if (bad) return { state, events: [], rejection: bad }
  const acc = mkAcc(state)
  const answeringAsk = state.pending.kind === 'crisisContribution'
  for (const id of a.cardIds) {
    const from: 'hand' | 'equipped' = acc.state.seats[a.seat]!.hand.includes(id) ? 'hand' : 'equipped'
    if (from === 'hand') setSeatState(acc, a.seat, { hand: acc.state.seats[a.seat]!.hand.filter((c) => c !== id) })
    else { const b = equippedOn(acc.state, id)!; setSurvivor(acc, b, { equipped: acc.state.survivors[b]!.equipped.filter((c) => c !== id) }) }
    patchState(acc, { crisis: { ...acc.state.crisis, contributions: [...acc.state.crisis.contributions, { seat: a.seat, cardId: id }] } })
    emitEvent(acc, { type: 'CardContributed', seat: a.seat, cardId: id, from })
  }
  if (answeringAsk && acc.state.turn) patchState(acc, { turn: { ...acc.state.turn, contributionAsked: true } })
  // the end-of-turn ask is not a turn action: the caller carries on with endTurn; a turn action reaches action.contribute
  if (answeringAsk || a.cardIds.length === 0) return { state: acc.state, events: acc.events }
  const pending = runJobs(acc, afterActionJobs('action.contribute', { seat: a.seat }))
  return { state: acc.state, events: acc.events, ...(pending ? { pending } : {}) }
}

/** Candidates for legalActions: nothing, then each single card (hand first, then equipped). */
export function contributeCandidates(state: GameState): ContributeCrisisAction[] {
  const pd = state.pending
  if (pd.seat === 'all' || (pd.kind !== 'turnAction' && pd.kind !== 'crisisContribution')) return []
  const seat = pd.seat
  const st = state.seats[seat]!
  const out: ContributeCrisisAction[] = []
  const mk = (cardIds: CardId[]): ContributeCrisisAction => ({ type: 'contributeCrisis', decisionId: pd.id, seat, cardIds })
  if (pd.kind === 'crisisContribution') out.push(mk([]))
  const equipped = st.survivors.flatMap((s) => state.survivors[s]?.equipped ?? [])
  for (const id of [...st.hand, ...equipped]) { const a = mk([id]); if (!validateContribute(state, a)) out.push(a) }
  return out
}
