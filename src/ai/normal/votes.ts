// Vote and call rules (40 §8.4): a bot votes yes on a seat when its suspicion passes the persona's threshold AND the colony can afford to
// lose that seat's dice; it calls a vote when its own suspicion passes the (higher) call threshold and the estimated yes count reaches the
// majority, estimating every other seat's view of the target from the same public evidence.
import { query } from '../../engine/index'
import type { SeatId } from '../../engine/index'
import type { SeatView } from '../../engine/view'
import { DEFAULT_SCALARS, getPersona } from '../personas'

export const eligibleVoters = (v: SeatView): SeatId[] => v.seatOrder.filter((s) => !v.seats[s]!.seat.exiled && !v.seats[s]!.seat.eliminated)

/** The vote threshold another seat is known to play at (its persona is part of the public table setup). */
export function thresholdOf(v: SeatView, seat: SeatId, which: 'voteThreshold' | 'callThreshold' = 'voteThreshold'): number {
  const id = v.setup.seats.find((s) => s.id === seat)?.persona
  return (getPersona(id)?.scalars ?? DEFAULT_SCALARS)[which]
}

/** 0..1: how far the main objective is (mean of its parts, each capped at 1). */
export function objectiveShare(v: SeatView): number {
  try {
    const parts = query.objectiveProgress(v).parts.filter((p) => Number.isFinite(p.need) && p.need > 0)
    if (parts.length === 0) return 0
    return parts.reduce((a, p) => a + Math.min(1, p.have / p.need), 0) / parts.length
  } catch { return 0 }
}

/**
 * Can the colony afford to exile `target`? Morale 3 or more, and the dice it loses (its survivors + 1) are at most a third of the table's,
 * unless the game is about to end or the main objective is nearly done (the exile is then cheap).
 */
export function afford(v: SeatView, target: SeatId): boolean {
  if (v.morale < 3) return false
  const voters = eligibleVoters(v)
  const total = voters.reduce((a, s) => a + v.seats[s]!.dice.length, 0)
  const lost = v.seats[target]?.dice.length ?? 0
  return lost * 3 <= total || v.roundsLeft <= 1 || objectiveShare(v) >= 0.8
}

/** The yes votes a call on `target` is expected to get when this bot supports it: its own, plus every seat whose threshold the shared evidence clears. */
export function estimateYes(v: SeatView, me: SeatId, target: SeatId, myScore: number, factor: number): { yes: number; needed: number } {
  let needed = Math.floor(eligibleVoters(v).length / 2) + 1
  try { needed = query.voteForecast(v, target).needed } catch { /* keep the plain majority */ }
  let yes = 1
  for (const s of eligibleVoters(v)) {
    if (s === me || s === target) continue
    if (myScore * factor >= thresholdOf(v, s)) yes++
  }
  return { yes, needed }
}
