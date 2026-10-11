// request / respondRequest (R7.5, F 5.2.1; R p11 "from other players"): ask one other seat, or every other seat (`to: 'all'`, asked in turn order until one gives), for an item card; the asked seat answers with a card or
// declines. A given card is revealed (CardGiven, public) and played at once by the requester; it never enters their hand
// and can never go to the crisis (E_REQUESTED_CARD).
import type { RequestAction, RespondRequestAction } from '../actions'
import type { DecisionOption, GameState, ItemSymbol, PendingDecision, Rejection, SeatId } from '../types'
import {
  type ActionResult, afterActionJobs, checkDecision, defOf, emitEvent, isForbidden, markGiven, mkAcc, patchState, rejection, runJobs, symbolsOf,
} from '../effects'
import { playPrecheck, startPlay } from './play'

export const ITEM_SYMBOLS: readonly ItemSymbol[] = ['weapon', 'fuel', 'education', 'food', 'medicine', 'tool', 'survivor']

export function validateRequest(state: GameState, a: RequestAction): Rejection | null {
  const bad = checkDecision(state, a, ['turnAction'])
  if (bad) return bad
  if (a.to === 'all') {
    if (askedSeats(state, a.seat, 'all').length === 0) return rejection('E_TARGET_INVALID', 'there is nobody to ask')
  } else {
    if (a.to === a.seat) return rejection('E_SELF_TARGET', 'you cannot ask yourself')
    const target = state.seats[a.to]
    if (!target || target.seat.eliminated) return rejection('E_TARGET_INVALID', 'that seat is not in the game')
  }
  if (isForbidden(state, 'request', { seat: a.seat })) return rejection('E_FORBIDDEN', 'requests are forbidden right now')
  return null
}

/** The seats a request reaches, in turn order after the requester (exiled seats included, eliminated ones not). */
function askedSeats(state: GameState, from: SeatId, to: SeatId | 'all'): SeatId[] {
  if (to !== 'all') return [to]
  const order = state.seatOrder
  const start = order.indexOf(from)
  return order.map((_, i) => order[(start + 1 + i) % order.length]!).filter((s) => s !== from && !state.seats[s]!.seat.eliminated)
}

/** Raise the requestResponse decision for `to` (state.request already names it). */
function askSeat(acc: ReturnType<typeof mkAcc>, from: SeatId, to: SeatId, want: { symbol?: ItemSymbol; defId?: string }, queue: SeatId[], note?: string): PendingDecision {
  const id = `d:${acc.state.decisionSeq + 1}`
  const options: DecisionOption[] = [
    { id: 'decline', label: 'Decline', action: { type: 'respondRequest', decisionId: id, seat: to, give: null } },
    ...requestableCards(acc.state, from, to, want).map((cardId): DecisionOption => ({
      id: cardId, label: defOf(acc.state, cardId)?.name ?? cardId, action: { type: 'respondRequest', decisionId: id, seat: to, give: cardId },
    })),
  ]
  const pending: PendingDecision = {
    id, seat: to, kind: 'requestResponse', window: 'action.request',
    context: { seatId: from, ...(want.symbol ? { symbol: want.symbol } : {}), data: { code: 'request' } }, options, canPass: false,
  }
  patchState(acc, { request: { from, to, want, ...(note ? { note } : {}), ...(queue.length ? { queue } : {}) }, decisionSeq: acc.state.decisionSeq + 1, pending })
  return pending
}

/** Cards in `to`'s hand that match the request and that the requester could play now. */
export function requestableCards(state: GameState, from: SeatId, to: SeatId, want: { symbol?: ItemSymbol; defId?: string }): string[] {
  return state.seats[to]!.hand.filter((id) => {
    const def = defOf(state, id)
    if (!def) return false
    if (want.symbol && !symbolsOf(def).includes(want.symbol)) return false
    if (want.defId && def.id !== want.defId) return false
    return !playPrecheck(state, from, id, undefined, { requireHand: false })
  })
}

export function request(state: GameState, a: RequestAction): ActionResult {
  const bad = validateRequest(state, a)
  if (bad) return { state, events: [], rejection: bad }
  const acc = mkAcc(state)
  const want = { ...(a.symbol ? { symbol: a.symbol } : {}), ...(a.defId ? { defId: a.defId } : {}) }
  const asked = askedSeats(state, a.seat, a.to)
  emitEvent(acc, { type: 'RequestMade', from: a.seat, to: asked[0]!, ...want, ...(a.note ? { note: a.note } : {}), ...(a.to === 'all' ? { all: true as const } : {}) })
  const pending = askSeat(acc, a.seat, asked[0]!, want, asked.slice(1), a.note)
  return { state: acc.state, events: acc.events, pending }
}

export function validateRespond(state: GameState, a: RespondRequestAction): Rejection | null {
  const bad = checkDecision(state, a, ['requestResponse'])
  if (bad) return bad
  if (a.give === null) return null
  if (!state.seats[a.seat]!.hand.includes(a.give)) return rejection('E_NOT_IN_HAND', 'that card is not in your hand')
  if (!(state.pending.options ?? []).some((o) => o.id === a.give)) return rejection('E_NOT_AN_OPTION', 'that card does not answer the request')
  return null
}

export function respondRequest(state: GameState, a: RespondRequestAction): ActionResult {
  const bad = validateRespond(state, a)
  if (bad) return { state, events: [], rejection: bad }
  const req = state.request!
  const acc = mkAcc(state)
  patchState(acc, { request: null })
  emitEvent(acc, { type: 'RequestAnswered', from: req.from, to: req.to, cardId: a.give })
  if (a.give === null && req.queue?.length) { // a request to everyone: the next seat is asked
    const pending = askSeat(acc, req.from, req.queue[0]!, req.want, req.queue.slice(1), req.note)
    return { state: acc.state, events: acc.events, pending }
  }
  if (a.give === null) {
    const pending = runJobs(acc, afterActionJobs('action.request', { seat: req.from }))
    return { state: acc.state, events: acc.events, ...(pending ? { pending } : {}) }
  }
  emitEvent(acc, { type: 'CardGiven', from: req.to, to: req.from, cardId: a.give, defId: state.cards[a.give]!.defId })
  markGiven(acc, a.give)
  const played = startPlay(acc.state, req.from, a.give, { given: true })
  return { state: played.state, events: [...acc.events, ...played.events], ...(played.pending ? { pending: played.pending } : {}) }
}

/** Candidates for legalActions of the requester: each other seat x each symbol. */
export function requestCandidates(state: GameState): RequestAction[] {
  const pd = state.pending
  if (pd.kind !== 'turnAction' || pd.seat === 'all') return []
  const out: RequestAction[] = []
  for (const to of [...state.seatOrder, 'all' as const]) {
    for (const symbol of ITEM_SYMBOLS) {
      const a: RequestAction = { type: 'request', decisionId: pd.id, seat: pd.seat, to, symbol }
      if (!validateRequest(state, a)) out.push(a)
    }
  }
  return out
}
