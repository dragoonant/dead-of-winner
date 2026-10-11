// Suspicion (40 §8): every bot keeps a log-odds ledger L(s) for "seat s is the betrayer", built only from public events (the redacted
// events its seat may see) and the bot's own knowledge. Evidence rows (Δ in log-odds):
//   crisis.shortfall  a wrong card in the revealed pile, split over the seats that put cards in (minus the ones the bot itself put in)
//   crisis.none       a seat with cards in hand put nothing into a crisis that failed
//   request.declined  a seat refused a request while it plausibly held the card
//   crossroads.hurt   the holder took the option that was worse for the colony when it could have taken the other
//   attract.others    a seat's survivor drew zombies toward a place holding other seats' survivors
//   attack.survivor   a survivor attacked another seat's survivor
//   colony.hungry     ended a turn with the colony short of food while holding food-sized hands and playing nothing
//   hoard             a hand that grew with no card played and no contribution
//   claim.*           the table-talk claims of what went into the pile against the revealed total (statement rows, scaled by trust)
//   accused           a yes vote against a seat (statement row, scaled by trust and by how little the accuser is suspected itself)
//   help.visible, crisis.prevented  small negatives
// Positive Δ is multiplied by the persona's paranoia, statement rows by its trust. A seat's net change per round is clamped to ±1.5.
// Only behaviour counts: personas add no prior (41 §1). A betrayer runs the same model on itself to know what the table sees (§7.3).
import type { GameEvent, SeatId } from '../../engine/index'
import type { SeatView } from '../../engine/view'
import { query } from '../../engine/index'
import { crossroadsValue } from './options'
import { recOf } from './info'

export interface LedgerOptions {
  me: SeatId
  paranoia: number
  trust: number
  /** true: the ledger scores `me` too (a betrayer asking "what does the table think of me") */
  selfCandidate: boolean
  /** scales every row (a tier knob: Easy keeps no ledger at all, Hard weighs claims across rounds) */
  gain?: number
  /** Easy: only attacks on other seats' survivors count */
  attacksOnly?: boolean
}

/** One bot's claim of what it put into this round's crisis pile (a statement, 40 §6.3). */
export interface Claim { seat: SeatId; round: number; n: number }

// ---- the table-talk channel: claims are public statements, so the deciders of one game (one worker) may read each other's ----
const talkBus = new Map<string, Claim[]>()
/** The game a decider belongs to: the client seeds a decider with `<game seed>|<seat>`, the sim with the game seed. */
export const gameKeyOf = (seed: string): string => seed.split('|')[0]!
export function postClaim(gameKey: string, claim: Claim): void {
  const list = talkBus.get(gameKey) ?? []
  list.push(claim)
  if (list.length > 40) list.splice(0, list.length - 40)
  talkBus.set(gameKey, list)
}
export function claimsFor(gameKey: string, round: number): Claim[] { return (talkBus.get(gameKey) ?? []).filter((c) => c.round === round) }
export function resetTalkBus(): void { talkBus.clear() }

// ---- the suspicion log the recap reads (50 recap): per game, per observer seat, the score of every other seat after each crisis ----
export interface SuspicionPoint { round: number; scores: Record<SeatId, number> }
const registry = new Map<string, Map<SeatId, Ledger>>()
let lastGame = ''
export function registerLedger(gameKey: string, seat: SeatId, ledger: Ledger): void {
  let game = registry.get(gameKey)
  if (!game) {
    game = new Map()
    registry.set(gameKey, game)
    if (registry.size > 8) registry.delete(registry.keys().next().value as string)
  }
  game.set(seat, ledger)
  lastGame = gameKey
}
/** For each observer seat, how suspicious it found every other seat after each round's crisis (0..1), from that bot's own memory. `seed` is the game seed; omitted = the latest game. */
export function suspicionTrajectory(seed?: string): Record<SeatId, SuspicionPoint[]> {
  const game = registry.get(seed ? gameKeyOf(seed) : lastGame)
  const out: Record<SeatId, SuspicionPoint[]> = {}
  if (game) for (const [seat, l] of game) if (l.history.length) out[seat] = l.history.map((p) => ({ round: p.round, scores: { ...p.scores } }))
  return out
}

const logit = (p: number): number => Math.log(p / (1 - p))
const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x))
/** Log-odds a wrong card puts on the seats that put cards in (split over them), and takes off the seats that put none in. 40 §8.2 lists 0.9 per attributed card; the split makes each seat's share small, so the table is scaled until the ledger separates the betrayer from the field (tests/ai, tools/ai-bench). */
const env = ((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.['AI_TUNE'])
const ov: Record<string, number> = (() => { try { return JSON.parse(env ?? '{}') as Record<string, number> } catch { return {} } })() // bench experiments only
export const ROUND_CLAMP = ov['clamp'] ?? 1.5
export const W_SHORTFALL = ov['wShort'] ?? 2.4
export const W_CLEARED = ov['wCleared'] ?? 0.5
/** Rows that are weak evidence on their own (a refusal, an empty hand at a failed crisis, a swollen hand): their total against one seat is capped for the whole game. */
export const ROW_CAP: Record<string, number> = { 'request.declined': 0.8, 'crisis.none': 0.6, hoard: 0.4, 'colony.hungry': 0.4 }

export class Ledger {
  private L: Record<string, number> = {}
  private net: Record<string, number> = {}
  private contributed: Record<string, number> = {}
  private ownWrong = 0
  private ownCards = 0
  private seats: SeatId[] = []
  private exiled = new Set<string>()
  private ownerOf: Record<string, string> = {}
  private hands: Record<string, number> = {}
  private handsAtRoundStart: Record<string, number> = {}
  private played: Record<string, number> = {}
  private helped: Record<string, number> = {}
  private lastRequest: { from: SeatId; to: SeatId; symbol?: string } | null = null
  private prior = 0.11
  private round = 0
  /** the log-odds the ledger last explained, per row, for the bench and the tests */
  readonly rows: Record<string, number> = {}
  /** the same rows per seat (bench and tests) */
  readonly rowsBySeat: Record<string, Record<string, number>> = {}
  readonly declines: Record<string, number> = {}
  readonly attackers = new Set<string>()
  roundsSeen = 0
  constructor(private opts: LedgerOptions, private gameKey = '') {}

  /** The decider tells the ledger about the cards it put into the pile itself (its own wrong cards are not evidence against others). */
  noteOwnWrong(n = 1): void { this.ownWrong += n }

  private gain(): number { return this.opts.gain ?? 1 }
  private add(seat: SeatId, delta: number, row: string, statement = false): void {
    if (seat === this.opts.me && !this.opts.selfCandidate) return
    if (this.opts.attacksOnly && row !== 'attack.survivor') return
    let d = delta * this.gain()
    if (d > 0) d *= this.opts.paranoia
    if (statement) d *= this.opts.trust
    const cap = ROW_CAP[row]
    if (cap !== undefined && d > 0) d = Math.max(0, Math.min(d, cap - (this.rowsBySeat[seat]?.[row] ?? 0)))
    if (d === 0) return
    const cur = this.net[seat] ?? 0
    const next = Math.max(-ROUND_CLAMP, Math.min(ROUND_CLAMP, cur + d))
    this.L[seat] = (this.L[seat] ?? this.l0()) + (next - cur)
    this.net[seat] = next
    this.rows[row] = (this.rows[row] ?? 0) + (next - cur)
    const bySeat = (this.rowsBySeat[seat] ??= {})
    bySeat[row] = (bySeat[row] ?? 0) + (next - cur)
  }
  private l0(): number { return logit(this.prior) }

  syncView(v: SeatView): void {
    this.seats = v.seatOrder.filter((s) => !v.seats[s]!.seat.eliminated)
    this.exiled = new Set(v.seatOrder.filter((s) => v.seats[s]!.seat.exiled))
    for (const [id, s] of Object.entries(v.survivors)) if (s.owner) this.ownerOf[id] = s.owner
    for (const s of v.seatOrder) this.hands[s] = v.seats[s]!.handCount
    const variants = v.setup.variants
    const n = Math.max(2, this.seats.length)
    // one betrayal card among 2n+1 dealt n (R p6); one more per seat in the betrayer variant; none without secret objectives
    this.prior = variants?.coop ? 0.001 : variants?.betrayer ? 1 / (n + 1) : 1 / (2 * n + 1)
    this.round = v.roundNumber
  }

  observe(events: readonly GameEvent[], v: SeatView): void {
    this.syncView(v)
    let revealedWrong = 0
    for (const ev of events) {
      switch (ev.type) {
        case 'RoundStarted':
          this.net = {}
          this.handsAtRoundStart = { ...this.hands }
          this.played = {}
          this.helped = {}
          break
        case 'CardContributed':
          this.contributed[ev.seat] = (this.contributed[ev.seat] ?? 0) + 1
          if (ev.seat === this.opts.me) this.ownCards++
          break
        case 'CrisisCardRevealed': if (ev.points < 0) revealedWrong++; break
        case 'CrisisResolved': this.onCrisis(ev, revealedWrong, v); revealedWrong = 0; break
        case 'CardPlayed': this.played[ev.seat] = (this.played[ev.seat] ?? 0) + 1; break
        case 'CardAddedToObjective': this.played[ev.seat] = (this.played[ev.seat] ?? 0) + 1; break
        case 'RequestMade': this.lastRequest = { from: ev.from, to: ev.to, ...(ev.symbol ? { symbol: ev.symbol } : {}) }; break
        case 'RequestAnswered':
          if (ev.cardId === null) {
            this.declines[ev.to] = (this.declines[ev.to] ?? 0) + 1
            if (ev.to !== this.opts.me) {
              const hand = this.hands[ev.to] ?? 0
              // a refusal from a seat with a full hand reads worse than one from a seat with almost nothing; a request to everyone is not a snub
              this.add(ev.to, hand >= 3 ? 0.3 : hand >= 1 ? 0.12 : 0, 'request.declined')
            }
          } else this.noteHelp(ev.to)
          break
        case 'CardGiven': this.noteHelp(ev.from); break
        case 'ZombieKilled': { const o = this.ownerOf[String(ev.by)]; if (o) this.noteHelp(o); break }
        case 'BarricadeAdded': { const o = this.ownerOf[String(ev.by)]; if (o) this.noteHelp(o); break }
        case 'WasteCleaned': { const o = this.ownerOf[ev.by]; if (o) this.noteHelp(o); break }
        case 'SurvivorAttacked': {
          const attacker = this.ownerOf[ev.attackerId]
          const target = this.ownerOf[ev.targetId]
          if (!attacker || !target || attacker === target || this.exiled.has(target)) break
          this.attackers.add(attacker)
          this.add(attacker, 1.2, 'attack.survivor')
          break
        }
        case 'ZombieMoved': {
          const by = this.ownerOf[String(ev.by)]
          if (!by) break
          const there = Object.values(v.survivors).some((s) => s.status === 'alive' && s.location === ev.to.location && s.owner && s.owner !== by)
          if (there && ev.to.location !== ev.from.location) this.add(by, 0.7, 'attract.others')
          break
        }
        case 'CrossroadsResolved': {
          if (ev.forced) break
          const card = recOf(v, ev.cardId)
          const options = ((card?.['options'] as { id: string }[] | undefined) ?? []).map((o) => o.id)
          if (options.length < 2) break
          const val = (id: string): number => crossroadsValue(v, ev.cardId, id, (x) => recOf(v, x))
          const chosen = val(ev.optionId)
          const best = Math.max(...options.map(val))
          if (best - chosen >= 0.5) this.add(ev.forSeat, 0.6, 'crossroads.hurt')
          break
        }
        case 'TurnEnded': {
          const seat = ev.seat
          if (seat === this.opts.me) break
          let short = false
          try { short = query.foodNeeded(v).shortfall > 0 } catch { short = false }
          if (short && (this.hands[seat] ?? 0) >= 4 && !(this.played[seat] ?? 0)) this.add(seat, 0.3, 'colony.hungry')
          break
        }
        case 'VotesCast': this.onVotes(ev.target, ev.votes); break
        default: break
      }
    }
  }

  private noteHelp(seat: SeatId): void {
    if (seat === this.opts.me) return
    const n = (this.helped[seat] ?? 0) + 1
    this.helped[seat] = n
    if (n <= 3) this.add(seat, -0.1, 'help.visible') // capped at -0.3 a round
  }

  private onCrisis(ev: Extract<GameEvent, { type: 'CrisisResolved' }>, revealedWrong: number, v: SeatView): void {
    this.roundsSeen++
    const wrongTotal = revealedWrong > 0 ? revealedWrong : Math.max(0, Math.round((ev.cards - ev.total) / 2))
    const matching = Math.max(0, Math.round((ev.cards + ev.total) / 2))
    const mineWrong = this.opts.selfCandidate ? 0 : this.ownWrong
    const wrong = Math.max(0, wrongTotal - mineWrong)
    const contributors = this.seats.filter((s) => (this.contributed[s] ?? 0) > 0 && (s !== this.opts.me || this.opts.selfCandidate))
    const cards = contributors.reduce((a, s) => a + (this.contributed[s] ?? 0), 0)
    if (wrong > 0 && cards > 0) {
      for (const s of contributors) this.add(s, W_SHORTFALL * wrong * ((this.contributed[s] ?? 0) / cards), 'crisis.shortfall')
      // elimination: a wrong card can only have come from a seat that put cards in
      for (const s of this.seats) if (s !== this.opts.me && !this.exiled.has(s) && (this.contributed[s] ?? 0) === 0) this.add(s, -W_CLEARED * wrong, 'crisis.cleared')
    }
    // a seat that sat out a failed crisis with a full hand
    if (!ev.prevented) for (const s of this.seats) if (s !== this.opts.me && !this.exiled.has(s) && (this.contributed[s] ?? 0) === 0 && (this.handsAtRoundStart[s] ?? this.hands[s] ?? 0) >= 3) this.add(s, 0.3, 'crisis.none')
    if (ev.prevented) for (const s of contributors) this.add(s, -0.2, 'crisis.prevented')
    // statements: what each bot said went in against what the pile held
    const claims = claimsFor(this.gameKey, this.round).filter((c) => c.seat !== this.opts.me)
    if (claims.length > 0) {
      const claimed = claims.reduce((a, c) => a + c.n, 0) + (this.opts.selfCandidate ? 0 : this.ownCards)
      if (claimed <= matching) for (const c of claims) this.add(c.seat, -0.2, 'claim.consistent', true)
      else {
        const sum = claims.reduce((a, c) => a + c.n, 0)
        for (const c of claims) this.add(c.seat, 0.5 * ((claimed - matching) / Math.max(1, claimed)) * 2 * (c.n / Math.max(1, sum)), 'claim.broken', true)
      }
    }
    // hoarding: a hand that grew by two with nothing played and nothing contributed
    for (const s of this.seats) {
      if (s === this.opts.me || this.exiled.has(s)) continue
      const grew = (this.hands[s] ?? 0) - (this.handsAtRoundStart[s] ?? this.hands[s] ?? 0)
      if (grew >= 2 && !(this.played[s] ?? 0) && !(this.contributed[s] ?? 0)) this.add(s, 0.2, 'hoard')
    }
    this.contributed = {}
    this.ownWrong = 0
    this.ownCards = 0
    const scores: Record<SeatId, number> = {}
    for (const s of this.seats) if (s !== this.opts.me) scores[s] = this.score(s)
    this.history.push({ round: this.round, scores })
    void v
  }

  private onVotes(target: SeatId, votes: Record<SeatId, boolean>): void {
    for (const [voter, yes] of Object.entries(votes)) {
      if (!yes || voter === target || voter === this.opts.me) continue
      // a yes from a seat the table does not suspect itself counts for more
      this.add(target, 0.2 * (1 - this.score(voter)), 'accused', true)
    }
  }

  /** The score of every other seat after each crisis resolved (the recap's trajectory). */
  readonly history: SuspicionPoint[] = []
  seatsKnown(): SeatId[] { return [...this.seats] }
  /** Log-odds that `seat` is the betrayer. */
  logit(seat: SeatId): number { return this.L[seat] ?? this.l0() }
  /** Posterior that `seat` is the betrayer, given everything observed. */
  score(seat: SeatId): number { return sigmoid(this.logit(seat)) }

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
