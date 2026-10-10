// Shared plumbing for the die actions: decision/actor/die validation, spending a die, rejections, and finishing a step
// with exactly one pending decision. Pure; no module here knows about a specific action.
import type { Action } from '../actions'
import { startOut, svc, type Out } from '../exposure'
import type { DieId, GameState, Rejection, RejectionCode, SeatId, StepResult, SurvivorId, WindowId, DiePurpose, Die } from '../types'
import { statsOf } from '../exposure'

export const rej = (code: RejectionCode, message: string, detail?: Record<string, unknown>): Rejection => ({ code, message, ...(detail ? { detail } : {}) })

/** The rejection result: the SAME state reference, [ActionRejected], the same pending (ACT-002). */
export function rejected(state: GameState, action: Action, rejection: Rejection): StepResult {
  return { state, events: [{ type: 'ActionRejected', action, rejection }], pending: state.pending, rejection }
}

/** The action answers the open decision, from the right seat. `kinds` = the decision kinds that accept it. */
export function checkDecision(state: GameState, action: { decisionId: string; seat: SeatId | 'all' }, kinds: readonly string[] = ['turnAction']): Rejection | null {
  if (state.phase === 'ended') return rej('E_GAME_OVER', 'the game is over')
  if (action.decisionId !== state.pending.id) return rej('E_WRONG_DECISION', 'this is not the open decision', { expected: state.pending.id })
  if (action.seat !== state.pending.seat) return rej('E_NOT_YOUR_DECISION', 'the open decision belongs to another seat', { expected: state.pending.seat })
  if (!kinds.includes(state.pending.kind)) return rej('E_NOT_AN_OPTION', `${state.pending.kind} does not accept this action`)
  return null
}

/** The acting survivor is alive and controlled by the seat (ACT-006: dead is checked first, a dead survivor has no owner). */
export function checkActor(state: GameState, seat: SeatId, survivorId: SurvivorId): Rejection | null {
  const sv = state.survivors[survivorId]
  if (!sv) return rej('E_NOT_YOUR_SURVIVOR', 'no such survivor', { survivorId })
  if (sv.status !== 'alive') return rej('E_SURVIVOR_DEAD', 'that survivor is not in play', { survivorId })
  if (sv.owner !== seat) return rej('E_NOT_YOUR_SURVIVOR', 'that survivor belongs to another seat', { survivorId })
  return null
}

export const findDie = (state: GameState, seat: SeatId, dieId: DieId): Die | undefined => state.seats[seat]?.dice.find((d) => d.id === dieId)

/** The die exists, is unused, and shows at least `need` (omit `need` for actions that take any die). */
export function checkDie(state: GameState, seat: SeatId, dieId: DieId, need?: number): Rejection | null {
  const die = findDie(state, seat, dieId)
  if (!die) return rej('E_NO_DIE', 'no such die', { dieId })
  if (die.used) return rej('E_DIE_USED', 'that die is already spent', { dieId })
  if (need !== undefined && die.value < need) return rej('E_DIE_TOO_LOW', `the die shows ${die.value}, ${need}+ is needed`, { need, value: die.value })
  return null
}

/** The die value an action needs: the printed number, less any grant (never below 1). */
export function needFor(state: GameState, survivorId: SurvivorId, which: 'attack' | 'search'): number {
  return Math.max(1, statsOf(state, survivorId)[which] - svc().valueMinus(state, survivorId, which))
}

export function spendDieInto(acc: Out, seat: SeatId, dieId: DieId, purpose: DiePurpose, survivorId?: SurvivorId, need?: number): void {
  const st = acc.state.seats[seat]!
  const die = st.dice.find((d) => d.id === dieId)!
  acc.state = {
    ...acc.state,
    seats: { ...acc.state.seats, [seat]: { ...st, dice: st.dice.map((d) => (d.id === dieId ? { ...d, used: true } : d)) } },
    turn: acc.state.turn ? { ...acc.state.turn, actions: acc.state.turn.actions + 1 } : acc.state.turn,
  }
  acc.events.push({ type: 'DieSpent', seat, dieId, value: die.value, purpose, survivorId, need })
}

/** Close a step: the open decision (if the routines raised one) or the turn's next decision. */
export function finish(acc: Out, window: WindowId): StepResult {
  let state = acc.state
  let pending = acc.pending
  if (!pending) {
    const next = svc().afterAction(state, window)
    if (next) {
      const id = `d:${state.decisionSeq + 1}`
      pending = { id, ...next }
      state = { ...state, decisionSeq: state.decisionSeq + 1 }
    } else pending = state.pending
  }
  state = { ...state, pending }
  return { state, events: acc.events, pending }
}

/** Run `check` then `run`; a failed check is the standard rejection. */
export function guarded(state: GameState, action: Action, check: (s: GameState) => Rejection | null, run: (acc: Out) => WindowId): StepResult {
  const r = check(state)
  if (r) return rejected(state, action, r)
  const acc = startOut(state)
  const window = run(acc)
  return finish(acc, window)
}

/** Seat whose turnAction is open, with its alive survivors and unused dice: the candidate source for legal-action lists. */
export function turnContext(state: GameState): { seat: SeatId; survivors: SurvivorId[]; dice: Die[] } | null {
  if (state.pending.kind !== 'turnAction' || state.pending.seat === 'all') return null
  const seat = state.pending.seat
  const st = state.seats[seat]
  if (!st) return null
  return { seat, survivors: st.survivors.filter((id) => state.survivors[id]?.status === 'alive'), dice: st.dice.filter((d) => !d.used) }
}
/** Lowest unused die showing at least `need` (a candidate list never offers a wasteful die twice). */
export const lowestDie = (dice: Die[], need = 1): Die | undefined => [...dice].filter((d) => d.value >= need).sort((a, b) => a.value - b.value)[0]
