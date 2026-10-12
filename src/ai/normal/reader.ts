// The table reader (40 §8, second generation): who is the betrayer, from public information only.
//
// The old ledger scored every seat on its own logistic scale, so no number could say "the betrayer is probably one of these two". The
// reader keeps ONE posterior over exclusive hypotheses {nobody, seat a, seat b, ...} (the deal puts at most one betrayal card in play,
// R p6), so scores across seats compete for the same probability mass and "there may be no betrayer at all" is a real hypothesis.
//
//   P(H_s) ∝ prior_s · exp(L_s)      P(nobody) ∝ prior_none      L_s = the log likelihood ratio of everything seen of seat s
//
// Evidence, all from the redacted events and the seat views (never GameState):
//   crisis.wrong   the count of off-symbol cards in the revealed pile is public and shuffled, so it is not pinned on anyone; each seat gets
//                  the likelihood of that count if IT were the betrayer (it must have put cards in; a seat with c cards in the pile explains
//                  at most c wrong cards) over the likelihood if nobody were. Loyal seats do not put off-symbol cards in (WRONG_EPS).
//   hoard          a hand that sits above the rest of the table at the end of a round
//   request.odd    asking for fuel, tools, weapons, or food when the colony is fed: nothing the colony needs. Food while it is short and
//                  medicine read as help (request.ok, nearly neutral)
//   work           kills, barricades, cleaning, cards added to the objective, cards given: the colony's chores; fewer than the others reads badly
//   contrib        cards put into the crisis pile; played: cards played from the hand (a betrayer is fitting out its own hand)
//   attack.survivor, attract.others, crossroads.hurt   the old per-event tells
//   claim.*        table-talk statements, scaled by the persona's trust
// Positive evidence is multiplied by the persona's paranoia. A seat's non-crisis evidence per round is clamped. Weights were fitted on sim
// rounds (tools: scratch fits on seed 101, checked on seed 202) and then shrunk, because rounds of one hand are not independent.
import type { GameEvent, SeatId } from '../../engine/index'
import type { SeatView } from '../../engine/view'
import { query } from '../../engine/index'
import { crossroadsValue } from './options'
import { recOf } from './info'
import { claimsFor, type SuspicionPoint, type Suspects } from './suspicion'

export interface ReaderOptions { me: SeatId; paranoia: number; trust: number }

const env = ((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.['AI_TUNE'])
const ov: Record<string, number> = (() => { try { return JSON.parse(env ?? '{}') as Record<string, number> } catch { return {} } })() // bench experiments only
/** Evidence weights (log-odds). */
export const W = {
  hand: ov['rHand'] ?? 0.2, handLo: -1, handHi: 4,
  reqOdd: ov['rReqOdd'] ?? 1.6, reqOddCap: 3.2, reqOk: 0.1,
  work: ov['rWork'] ?? -0.2, contrib: ov['rContrib'] ?? -0.15, played: ov['rPlayed'] ?? 0.1,
  attack: 1.2, attract: 0.7, crossroads: 0.6,
  /** the chance a betrayer's card in the pile is off-symbol (sim: a betrayer puts one card per crisis and sabotages about one in seven) and a loyal seat's */
  wrongP: ov['rWrongP'] ?? 0.15, wrongEps: 0.005,
  roundClamp: ov['rClamp'] ?? 2,
}

const clip = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x))
const binom = (n: number, k: number, p: number): number => {
  if (k < 0 || k > n) return 0
  let c = 1
  for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1)
  return c * Math.pow(p, k) * Math.pow(1 - p, n - k)
}
/** P(w off-symbol cards in a pile of C cards | the seat with `ck` of them is the betrayer). */
const wrongLik = (w: number, C: number, ck: number): number => {
  let s = 0
  for (let j = 0; j <= Math.min(w, ck); j++) s += binom(ck, j, W.wrongP) * binom(C - ck, w - j, W.wrongEps)
  return s
}

interface RoundTally { contrib: number; played: number; work: number; reqOdd: number; reqOk: number }
const blank = (): RoundTally => ({ contrib: 0, played: 0, work: 0, reqOdd: 0, reqOk: 0 })

export class Reader implements Suspects {
  private L: Record<string, number> = {}
  private seats: SeatId[] = []
  private exiled = new Set<string>()
  private eliminated = new Set<string>()
  private ownerOf: Record<string, string> = {}
  private hands: Record<string, number> = {}
  private round: Record<string, RoundTally> = {}
  private oddTotal: Record<string, number> = {}
  private ownWrong = 0
  private ownCards = 0
  private roundNo = 0
  private priorSeat = 1 / 9
  private priorNone = 5 / 9
  readonly rows: Record<string, number> = {}
  readonly rowsBySeat: Record<string, Record<string, number>> = {}
  readonly attackers = new Set<string>()
  readonly history: SuspicionPoint[] = []
  roundsSeen = 0
  constructor(private opts: ReaderOptions, private gameKey = '') {}

  /** The decider tells the reader about the off-symbol cards it put into the pile itself (not evidence against anybody). */
  noteOwnWrong(n = 1): void { this.ownWrong += n }

  private tally(seat: SeatId): RoundTally { return (this.round[seat] ??= blank()) }
  /** `raw` skips the persona's paranoia (the exact crisis likelihood and rows already scaled by the caller). */
  private add(seat: SeatId, delta: number, row: string, statement = false, raw = false): void {
    if (seat === this.opts.me || this.exiled.has(seat) || this.eliminated.has(seat)) return
    let d = delta
    if (d > 0 && !raw) d *= this.opts.paranoia
    if (statement) d *= this.opts.trust
    if (d === 0) return
    this.L[seat] = (this.L[seat] ?? 0) + d
    this.rows[row] = (this.rows[row] ?? 0) + d
    const by = (this.rowsBySeat[seat] ??= {})
    by[row] = (by[row] ?? 0) + d
  }

  syncView(v: SeatView): void {
    this.seats = v.seatOrder.filter((s) => !v.seats[s]!.seat.eliminated)
    this.exiled = new Set(v.seatOrder.filter((s) => v.seats[s]!.seat.exiled))
    this.eliminated = new Set(v.seatOrder.filter((s) => v.seats[s]!.seat.eliminated))
    for (const [id, s] of Object.entries(v.survivors)) if (s.owner) this.ownerOf[id] = s.owner
    for (const s of v.seatOrder) this.hands[s] = v.seats[s]!.handCount
    const variants = v.setup.variants
    const n = Math.max(2, v.seatOrder.length)
    // one betrayal card among 2n+1 dealt n (R p6): each seat 1/(2n+1), nobody (n+1)/(2n+1); one more per seat in the betrayer variant; none in co-op
    this.priorSeat = variants?.coop ? 0.001 : variants?.betrayer ? 1 / (n + 1) : 1 / (2 * n + 1)
    this.priorNone = Math.max(0.05, 1 - n * this.priorSeat)
    this.roundNo = v.roundNumber
  }

  observe(events: readonly GameEvent[], v: SeatView): void {
    this.syncView(v)
    let revealedWrong = 0
    for (const ev of events) {
      switch (ev.type) {
        case 'RoundStarted': this.round = {}; break
        case 'CardContributed': this.tally(ev.seat).contrib++; if (ev.seat === this.opts.me) this.ownCards++; break
        case 'CardPlayed': this.tally(ev.seat).played++; break
        case 'CardAddedToObjective': this.tally(ev.seat).work++; break
        case 'CardGiven': this.tally(ev.from).work++; break
        case 'ZombieKilled': { const o = this.ownerOf[String(ev.by)]; if (o) this.tally(o).work++; break }
        case 'BarricadeAdded': { const o = this.ownerOf[String(ev.by)]; if (o) this.tally(o).work++; break }
        case 'WasteCleaned': { const o = this.ownerOf[ev.by]; if (o) this.tally(o).work++; break }
        case 'RequestMade': {
          let short = false
          try { short = query.foodNeeded(v).shortfall > 0 } catch { short = false }
          // food while the colony is short and medicine are what a loyal hand asks for; anything else is for the asker's own pile
          if (ev.symbol === 'medicine' || (ev.symbol === 'food' && short)) this.tally(ev.from).reqOk++
          else this.tally(ev.from).reqOdd++
          break
        }
        case 'SurvivorAttacked': {
          const attacker = this.ownerOf[ev.attackerId]
          const target = this.ownerOf[ev.targetId]
          if (!attacker || !target || attacker === target || this.exiled.has(target)) break
          this.attackers.add(attacker)
          this.add(attacker, W.attack, 'attack.survivor')
          break
        }
        case 'ZombieMoved': {
          const by = this.ownerOf[String(ev.by)]
          if (!by) break
          const there = Object.values(v.survivors).some((s) => s.status === 'alive' && s.location === ev.to.location && s.owner && s.owner !== by)
          if (there && ev.to.location !== ev.from.location) this.add(by, W.attract, 'attract.others')
          break
        }
        case 'CrossroadsResolved': {
          if (ev.forced) break
          const card = recOf(v, ev.cardId)
          const options = ((card?.['options'] as { id: string }[] | undefined) ?? []).map((o) => o.id)
          if (options.length < 2) break
          const val = (id: string): number => crossroadsValue(v, ev.cardId, id, (x) => recOf(v, x))
          if (Math.max(...options.map(val)) - val(ev.optionId) >= 0.5) this.add(ev.forSeat, W.crossroads, 'crossroads.hurt')
          break
        }
        case 'CrisisCardRevealed': if (ev.points < 0) revealedWrong++; break
        case 'CrisisResolved': this.onCrisis(ev, revealedWrong, v); revealedWrong = 0; break
        case 'VotesCast': this.onVotes(ev.target, ev.votes); break
        default: break
      }
    }
  }

  private onCrisis(ev: Extract<GameEvent, { type: 'CrisisResolved' }>, revealedWrong: number, v: SeatView): void {
    this.roundsSeen++
    const me = this.opts.me
    const live = this.seats.filter((s) => !this.exiled.has(s))
    const wrongAll = revealedWrong > 0 ? revealedWrong : Math.max(0, Math.round((ev.cards - ev.total) / 2))
    const wrong = Math.max(0, wrongAll - this.ownWrong)
    const cards = Math.max(0, ev.cards - this.ownCards)
    // ---- the pile: who could have put the off-symbol cards in
    for (const s of live) {
      if (s === me) continue
      const ck = this.round[s]?.contrib ?? 0
      const lr = wrongLik(wrong, cards, ck) / Math.max(1e-12, binom(cards, wrong, W.wrongEps))
      const d = Math.log(Math.max(1e-6, lr))
      // the likelihood ratio is exact; paranoia scales only the share that points at a seat, and a seat that cannot explain the pile is not cleared beyond reason
      this.add(s, d > 0 ? d : Math.max(d, -3), 'crisis.wrong', false, true)
    }
    // ---- the round's behaviour
    const handMean = (s: SeatId): number => {
      const others = live.filter((x) => x !== s)
      return others.length ? others.reduce((a, x) => a + (this.hands[x] ?? 0), 0) / others.length : 0
    }
    for (const s of live) {
      if (s === me) continue
      const t = this.round[s] ?? blank()
      const parts: [string, number][] = [
        ['hoard', W.hand * clip((this.hands[s] ?? 0) - handMean(s), W.handLo, W.handHi)],
        ['request.ok', W.reqOk * t.reqOk],
        ['work', W.work * clip(t.work, 0, 4)],
        ['contrib', W.contrib * clip(t.contrib, 0, 2)],
        ['played', W.played * clip(t.played, 0, 4)],
      ]
      const odd = Math.min(W.reqOddCap - (this.oddTotal[s] ?? 0), W.reqOdd * t.reqOdd)
      if (odd > 0) this.oddTotal[s] = (this.oddTotal[s] ?? 0) + odd
      parts.push(['request.odd', Math.max(0, odd)])
      const scaled = parts.map(([row, d]): [string, number] => [row, d > 0 ? d * this.opts.paranoia : d])
      const sum = scaled.reduce((a, p) => a + p[1], 0)
      const k = Math.abs(sum) > W.roundClamp ? W.roundClamp / Math.abs(sum) : 1
      for (const [row, d] of scaled) this.add(s, d * k, row, false, true)
    }
    // ---- table talk: what each bot said went in against what the pile held
    const claims = claimsFor(this.gameKey, this.roundNo).filter((c) => c.seat !== me)
    if (claims.length > 0) {
      const matching = Math.max(0, Math.round((ev.cards + ev.total) / 2))
      const claimed = claims.reduce((a, c) => a + c.n, 0) + this.ownCards
      if (claimed <= matching) for (const c of claims) this.add(c.seat, -0.2, 'claim.consistent', true)
      else {
        const sum = claims.reduce((a, c) => a + c.n, 0)
        for (const c of claims) this.add(c.seat, 0.5 * ((claimed - matching) / Math.max(1, claimed)) * 2 * (c.n / Math.max(1, sum)), 'claim.broken', true)
      }
    }
    this.round = {}
    this.ownWrong = 0
    this.ownCards = 0
    const scores: Record<SeatId, number> = {}
    for (const s of this.seats) if (s !== me) scores[s] = this.score(s)
    this.history.push({ round: this.roundNo, scores })
    void v
  }

  private onVotes(target: SeatId, votes: Record<SeatId, boolean>): void {
    for (const [voter, yes] of Object.entries(votes)) {
      if (!yes || voter === target || voter === this.opts.me) continue
      // a yes from a seat the table does not suspect itself counts for more
      this.add(target, 0.2 * (1 - this.score(voter)), 'accused', true)
    }
  }

  seatsKnown(): SeatId[] { return [...this.seats] }
  /** The hypotheses still in play: every seat but this one. An exiled or eliminated seat keeps the mass it had (it may have been the betrayer). */
  private mass(): { total: number; of: (s: SeatId) => number } {
    const w = (s: SeatId): number => this.priorSeat * Math.exp(clip(this.L[s] ?? 0, -30, 30))
    let total = this.priorNone
    for (const s of this.seats) if (s !== this.opts.me) total += w(s)
    return { total, of: w }
  }
  /** Log-odds that `seat` is the betrayer against everyone else (including nobody). */
  logit(seat: SeatId): number {
    const p = this.score(seat)
    return Math.log(Math.max(1e-9, p) / Math.max(1e-9, 1 - p))
  }
  /** Posterior that `seat` is the betrayer, given everything observed. */
  score(seat: SeatId): number {
    if (seat === this.opts.me) return 0
    const m = this.mass()
    return m.of(seat) / m.total
  }
  /** Posterior that nobody at the table is the betrayer. */
  none(): number {
    const m = this.mass()
    return this.priorNone / m.total
  }

  /** The most suspected seat other than `me` that can still be voted on, with its score. */
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
