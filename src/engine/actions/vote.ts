// callVote and castVotes (10 R7.7, R16). One vote per turn, called by any seat (an exiled caller too) against another seat that is
// neither exiled nor eliminated; every eligible seat answers privately inside ONE `castVotes` action (simultaneous). Yes beats no;
// a tie is always broken by the first player, even an exiled one who cannot vote (digest General; R p4, p11); only an eliminated
// first seat falls back to the next eligible seat clockwise. An ineligible tie-breaker answers through the optional extra ballot key
// `votes[tiebreakSeat]` (named in the decision's `context.data.tiebreakSeat`; missing = no). A passed vote exiles the target inside the same step (exile.ts). Votes raised by Crossroads cards run in effects.ts.
//
// Continuations: a decision raised while a multi-step flow is unfinished carries `context.data.resume` (a plain JSON object); the
// phase machine (phases/player-turns.ts) reads it back when the decision is answered and carries on.
import type { Action, CallVoteAction, CastVotesAction } from '../actions'
import { type ActionResult, afterAction, checkDecision, fireWindow, isForbidden, rejection } from '../effects'
import { exileSeat } from '../exile'
import { type Out, halted, isOver, mergeInto, raisePending, startOut } from '../exposure'
import { isCoop } from '../setup'
import type { GameState, PendingDecision, Rejection, SeatId } from '../types'

// ---------- continuations ----------
export interface Resume { k: string; [key: string]: unknown }
export const readResume = (pd: PendingDecision): Resume | undefined => (pd.context.data as { resume?: Resume } | undefined)?.resume
/** Put `resume` on the decision the accumulator is about to return (it travels with the decision until answered). */
export function attachResume(acc: Out, resume: Resume): void {
  const p = acc.pending
  if (!p) return
  acc.pending = { ...p, context: { ...p.context, data: { ...(p.context.data ?? {}), resume } } }
  acc.state = { ...acc.state, pending: acc.pending }
}

// ---------- who votes ----------
/** Every non-exiled, non-eliminated seat (R16.1); the target of an exile vote votes too. */
export const voteEligible = (state: GameState): SeatId[] =>
  state.seatOrder.filter((s) => !state.seats[s]!.seat.eliminated && !state.seats[s]!.seat.exiled && !isForbidden(state, 'vote', { seat: s }))
/** The seat whose answer decides a tie: always the first seat (exiled or not, digest General), else the next eligible seat clockwise if it was eliminated. */
export function tiebreaker(state: GameState, eligible: SeatId[]): SeatId | null {
  const first = state.seats[state.firstSeat]
  if (first && !first.seat.eliminated) return state.firstSeat
  const order = state.seatOrder
  const start = Math.max(0, order.indexOf(state.firstSeat))
  return order.map((_, i) => order[(start + i) % order.length]!).find((s) => eligible.includes(s)) ?? null
}
/** What `query.voteForecast` reports (00 §10): voters, yes votes that carry the vote on their own, the seat that breaks a tie. */
export function voteForecastFor(state: GameState, target: SeatId): { target: SeatId; eligible: SeatId[]; needed: number; tiebreakBy: SeatId } {
  const eligible = voteEligible(state)
  return { target, eligible, needed: Math.floor(eligible.length / 2) + 1, tiebreakBy: tiebreaker(state, eligible) ?? state.firstSeat }
}

/** `{tiebreakSeat}` when the tie-breaker cannot vote (exiled first player), so the ballot can carry its answer. */
function tieSeatData(state: GameState, eligible: SeatId[]): { tiebreakSeat?: SeatId } {
  const t = tiebreaker(state, eligible)
  return t && !eligible.includes(t) ? { tiebreakSeat: t } : {}
}

// ---------- callVote ----------
export function validateCallVote(state: GameState, a: CallVoteAction): Rejection | null {
  const bad = checkDecision(state, a, ['turnAction'])
  if (bad) return bad
  if (isCoop(state.setup)) return rejection('E_FORBIDDEN', 'there is no exile vote in a co-op game')
  if (isForbidden(state, 'callVote', { seat: a.seat })) return rejection('E_FORBIDDEN', 'calling a vote is forbidden right now')
  if (state.turn?.voteCalled) return rejection('E_VOTE_USED', 'a vote was already called this turn')
  if (a.target === a.seat) return rejection('E_SELF_TARGET', 'you cannot vote against yourself')
  const t = state.seats[a.target]
  if (!t || t.seat.eliminated || t.seat.exiled) return rejection('E_TARGET_INVALID', 'that seat cannot be voted out')
  return null
}

/** After the vote and any exile are done: the action window and the held Crossroads card (FAQ 2.1.1). */
export function afterVote(acc: Out, caller: SeatId): void {
  if (halted(acc)) return
  mergeInto(acc, afterAction(acc.state, 'action.vote', { seat: caller }))
}

/** The vote has a result: exile the target on a yes, else finish. */
export function continueAfterResult(acc: Out, passed: boolean, target: SeatId, caller: SeatId): void {
  if (passed) {
    const x = exileSeat(acc.state, target)
    mergeInto(acc, x)
    if (isOver(acc.state)) return
    if (x.deferredPlacement) { attachResume(acc, { k: 'placePrompt', seat: target, then: { k: 'afterVote', caller } }); return }
    if (acc.pending) { attachResume(acc, { k: 'afterVote', caller }); return }
  }
  afterVote(acc, caller)
}

function resolveVote(acc: Out, votes: Record<SeatId, boolean>, eligible: SeatId[], caller: SeatId, target: SeatId): void {
  const yes = eligible.filter((s) => votes[s]).length
  const no = eligible.length - yes
  const shown: Record<SeatId, boolean> = {}
  for (const s of eligible) shown[s] = votes[s]!
  let tiebreakBy: SeatId | null = null
  let passed = yes > no
  if (eligible.length > 0 && yes === no) {
    tiebreakBy = tiebreaker(acc.state, eligible)
    passed = !!tiebreakBy && !!votes[tiebreakBy]
  }
  acc.events.push({ type: 'VotesCast', target, votes: { ...shown } }, { type: 'VoteResult', target, yes, no, exiled: passed, tiebreakBy })
  acc.state = { ...acc.state, vote: null }
  mergeInto(acc, fireWindow(acc.state, 'vote.result', { seat: caller, params: { yes, no, passed } }))
  if (halted(acc)) {
    if (!isOver(acc.state)) attachResume(acc, passed ? { k: 'exile', target, caller } : { k: 'afterVote', caller })
    return
  }
  continueAfterResult(acc, passed, target, caller)
}

export function applyCallVote(state: GameState, a: CallVoteAction): ActionResult {
  const bad = validateCallVote(state, a)
  if (bad) return { state, events: [], rejection: bad }
  const acc = startOut(state)
  acc.state = { ...state, vote: { caller: a.seat, target: a.target, votes: null, result: null }, turn: state.turn ? { ...state.turn, voteCalled: true } : state.turn }
  acc.events.push({ type: 'VoteCalled', caller: a.seat, target: a.target })
  const eligible = voteEligible(acc.state)
  if (eligible.length === 0) { resolveVote(acc, {}, eligible, a.seat, a.target); return acc } // nobody may vote: it fails at once (R16.4)
  raisePending(acc, () => ({
    seat: 'all', kind: 'votes', window: 'action.vote', canPass: false,
    context: { seatId: a.target, data: { code: 'callVote', eligible, caller: a.seat, target: a.target, ...tieSeatData(acc.state, eligible) } },
  }))
  return acc
}

// ---------- castVotes ----------
export function validateCastVotes(state: GameState, a: CastVotesAction): Rejection | null {
  if (state.phase === 'ended') return rejection('E_GAME_OVER', 'the game is over')
  const pd = state.pending
  if (a.decisionId !== pd.id) return rejection('E_WRONG_DECISION', 'stale decision id', { expected: pd.id })
  if (pd.kind !== 'votes' || !state.vote) return rejection('E_WRONG_DECISION', 'no vote is open')
  if (a.seat !== 'all') return rejection('E_NOT_YOUR_DECISION', 'a ballot answers for every seat at once (seat "all")')
  const eligible = ((pd.context.data as { eligible?: SeatId[] } | undefined)?.eligible ?? []) as SeatId[]
  const votes = a.votes
  if (!votes || typeof votes !== 'object' || Array.isArray(votes)) return rejection('E_BAD_PAYLOAD', 'votes must be a seat -> boolean map')
  const tieSeat = (pd.context.data as { tiebreakSeat?: SeatId } | undefined)?.tiebreakSeat
  for (const s of Object.keys(votes)) if (!eligible.includes(s) && s !== tieSeat) return rejection('E_BAD_PAYLOAD', `seat ${s} cannot vote`, { seat: s })
  for (const s of eligible) if (typeof votes[s] !== 'boolean') return rejection('E_BAD_PAYLOAD', `seat ${s} needs a yes or no`, { seat: s })
  if (tieSeat && votes[tieSeat] !== undefined && typeof votes[tieSeat] !== 'boolean') return rejection('E_BAD_PAYLOAD', `seat ${tieSeat} needs a yes or no`, { seat: tieSeat })
  return null
}

export function applyCastVotes(state: GameState, a: CastVotesAction): ActionResult {
  const bad = validateCastVotes(state, a)
  if (bad) return { state, events: [], rejection: bad }
  const acc = startOut(state)
  const v = state.vote!
  const eligible = (state.pending.context.data as { eligible: SeatId[] }).eligible
  const votes: Record<SeatId, boolean> = {}
  for (const s of eligible) votes[s] = a.votes[s]!
  const tieSeat = (state.pending.context.data as { tiebreakSeat?: SeatId } | undefined)?.tiebreakSeat
  if (tieSeat) votes[tieSeat] = a.votes[tieSeat] === true // the exiled first player's tie-break answer (ignored unless there is a tie)
  acc.state = { ...state, vote: { ...v, votes } }
  resolveVote(acc, votes, eligible, v.caller, v.target)
  return acc
}

// ---------- candidates for legalActions ----------
/** Every ballot for the open call-vote (all-no first; at most 2^5 = 32). */
export function ballotCandidates(state: GameState): CastVotesAction[] {
  const pd = state.pending
  if (pd.kind !== 'votes') return []
  const data = pd.context.data as { eligible?: SeatId[]; tiebreakSeat?: SeatId } | undefined
  const eligible = [...((data?.eligible ?? []) as SeatId[]), ...(data?.tiebreakSeat ? [data.tiebreakSeat] : [])]
  const out: CastVotesAction[] = []
  for (let mask = 0; mask < 1 << eligible.length; mask++) {
    const votes: Record<SeatId, boolean> = {}
    eligible.forEach((s, i) => { votes[s] = (mask & (1 << i)) !== 0 })
    out.push({ type: 'castVotes', decisionId: pd.id, seat: 'all', votes })
  }
  return out
}

export function legalCallVotes(state: GameState): Action[] {
  const pd = state.pending
  if (pd.kind !== 'turnAction' || pd.seat === 'all') return []
  const out: Action[] = []
  for (const target of state.seatOrder) {
    const a: CallVoteAction = { type: 'callVote', decisionId: pd.id, seat: pd.seat, target }
    if (validateCallVote(state, a) === null) out.push(a)
  }
  return out
}
