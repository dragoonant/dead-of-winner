// Simple suspicion (40 §8, slimmed): a Bayesian ledger over "seat j is the betrayer" built only from public events and the
// seat's own knowledge. Evidence: crisis shortfalls split over the seats that put cards in, declined requests, attacks on others.
// Hypotheses: H_j (seat j is the betrayer) and H_0 (nobody is). Scores are posteriors in [0, 1].
import type { GameEvent, SeatId } from '../../engine/index'
import type { SeatView } from '../../engine/view'

const PRIOR_ANY = 0.4 // chance a betrayer sits at the table (it is dealt in ~44% of 4-seat games)

export interface LedgerOptions { me: SeatId; paranoia: number; selfCandidate: boolean }

export class Ledger {
  private lnL: Record<string, number> = {}
  private lnL0 = 0
  private contributed: Record<string, number> = {}
  private ownWrong = 0
  readonly declines: Record<string, number> = {}
  readonly attackers = new Set<string>()
  roundsSeen = 0
  private seats: SeatId[] = []
  private exiled = new Set<string>()
  private ownerOf: Record<string, string> = {}
  constructor(private opts: LedgerOptions) {}

  /** The decider tells the ledger when it put a wrong card into the pile (a betrayer's own sabotage). */
  noteOwnWrong(n = 1): void { this.ownWrong += n }

  syncView(v: SeatView): void {
    this.seats = v.seatOrder.filter((s) => !v.seats[s]!.seat.eliminated)
    this.exiled = new Set(v.seatOrder.filter((s) => v.seats[s]!.seat.exiled))
    for (const [id, s] of Object.entries(v.survivors)) if (s.owner) this.ownerOf[id] = s.owner
  }

  observe(events: readonly GameEvent[], v: SeatView): void {
    this.syncView(v)
    const p = this.opts.paranoia
    for (const ev of events) {
      switch (ev.type) {
        case 'CardContributed': this.contributed[ev.seat] = (this.contributed[ev.seat] ?? 0) + 1; break
        case 'CrisisResolved': {
          const wrongTotal = Math.max(0, Math.round((ev.cards - ev.total) / 2))
          const wrong = this.opts.selfCandidate ? wrongTotal : Math.max(0, wrongTotal - this.ownWrong)
          this.roundsSeen++
          for (const s of this.seats) {
            if (s === this.opts.me && !this.opts.selfCandidate) continue
            const c = this.contributed[s] ?? 0
            if (wrong > 0) this.lnL[s] = (this.lnL[s] ?? 0) + (c > 0 ? 0 : Math.log(0.04) * p)
            else if (c > 0) this.lnL[s] = (this.lnL[s] ?? 0) + Math.log(0.6) * Math.min(c, 2)
          }
          if (wrong > 0) this.lnL0 += Math.log(0.03) * p * Math.min(wrong, 2)
          this.contributed = {}
          this.ownWrong = 0
          break
        }
        case 'RequestAnswered':
          if (ev.cardId === null && ev.to !== this.opts.me) {
            this.declines[ev.to] = (this.declines[ev.to] ?? 0) + 1
            if (ev.from === this.opts.me) this.lnL[ev.to] = (this.lnL[ev.to] ?? 0) + Math.log(1.25)
          }
          break
        case 'SurvivorAttacked': {
          const attacker = this.ownerOf[ev.attackerId]
          const target = this.ownerOf[ev.targetId]
          if (!attacker || !target || attacker === target || this.exiled.has(target)) break
          this.attackers.add(attacker)
          // an attack on someone else's survivor is what a betrayer does and almost nobody else
          for (const s of this.seats) if (s !== attacker && !(s === this.opts.me && !this.opts.selfCandidate)) this.lnL[s] = (this.lnL[s] ?? 0) + Math.log(0.06) * p
          this.lnL0 += Math.log(0.06) * p
          break
        }
        default: break
      }
    }
  }

  /** Posterior that `seat` is the betrayer, given everything observed. */
  score(seat: SeatId): number {
    const cand = this.seats.filter((s) => !this.exiled.has(s) && (s !== this.opts.me || this.opts.selfCandidate))
    const n = Math.max(1, cand.length)
    const prior = PRIOR_ANY / n
    let total = (1 - PRIOR_ANY) * Math.exp(this.lnL0)
    let mine = 0
    for (const s of cand) {
      const w = prior * Math.exp(this.lnL[s] ?? 0)
      total += w
      if (s === seat) mine = w
    }
    return total > 0 ? mine / total : 0
  }

  /** The most suspected seat other than `me`, with its score. */
  top(): { seat: SeatId; score: number } | null {
    let best: { seat: SeatId; score: number } | null = null
    for (const s of this.seats) {
      if (s === this.opts.me || this.exiled.has(s)) continue
      const sc = this.score(s)
      if (!best || sc > best.score) best = { seat: s, score: sc }
    }
    return best
  }
}
