// Vote and call rules (40 §8.4): a bot votes yes on a seat when its suspicion passes the persona's threshold AND the colony can afford to
// lose that seat's dice; it calls a vote when its own suspicion passes the (higher) call threshold and the estimated yes count reaches the
// majority, estimating every other seat's view of the target from the same public evidence.
import { query } from '../../engine/index'
import type { SeatId } from '../../engine/index'
import type { SeatView } from '../../engine/view'
import { DEFAULT_SCALARS, getPersona } from '../personas'
import type { Suspects } from './suspicion'

export const eligibleVoters = (v: SeatView): SeatId[] => v.seatOrder.filter((s) => !v.seats[s]!.seat.exiled && !v.seats[s]!.seat.eliminated)

/** The vote threshold another seat is known to play at (its persona is part of the public table setup). */
export function thresholdOf(v: SeatView, seat: SeatId, which: 'voteThreshold' | 'callThreshold' = 'voteThreshold'): number {
  const id = v.setup.seats.find((s) => s.id === seat)?.persona
  return (getPersona(id)?.scalars ?? DEFAULT_SCALARS)[which]
}

/**
 * What a wrong exile costs, and so how sure a bot must be before it calls or backs one (10 R15; priced on sims): the seat leaves the crisis
 * pile and the colony's chores, which costs about a tenth of the games' completions; exiling the real betrayer buys back about a thirtieth
 * (the exiled betrayer still hoards, so its cards do not return) and takes away its chance to win. That puts break-even near 0.77 true
 * odds, and the reader's posterior runs a little under the true odds (sims: 0.5 means about 0.8), so no persona goes below EXILE_FLOOR on
 * the reader's scale. A second exile of a non-betrayer drops morale to 0 (R15.6): once somebody has been exiled, the floor rises by how
 * likely it is that seat was NOT the betrayer.
 */
export const EXILE_FLOOR = 0.6
export function exileFloor(v: SeatView, ledger: Suspects): number {
  const gone = v.seatOrder.filter((s) => v.seats[s]!.seat.exiled)
  if (gone.length === 0) return EXILE_FLOOR
  const pBetrayerGone = Math.min(1, gone.reduce((a, s) => a + ledger.score(s), 0))
  return Math.min(0.97, EXILE_FLOOR + 0.35 * (1 - pBetrayerGone))
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
export function estimateYes(v: SeatView, me: SeatId, target: SeatId, myScore: number, factor: number, floor = 0): { yes: number; needed: number } {
  let needed = Math.floor(eligibleVoters(v).length / 2) + 1
  try { needed = query.voteForecast(v, target).needed } catch { /* keep the plain majority */ }
  let yes = 1
  for (const s of eligibleVoters(v)) {
    if (s === me || s === target) continue
    if (myScore * factor >= Math.max(thresholdOf(v, s) * (floor > 0 ? 1.05 : 1), floor - 0.1)) yes++
  }
  return { yes, needed }
}
