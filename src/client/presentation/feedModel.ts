// The structured event feed (50 §10): events become entries grouped by round and turn, and four kinds of event run grow breakdown groups.
//   crisis    the first CrisisCardRevealed -> each card flipped with the running total against the target -> the verdict -> the effect and morale
//   exposure  ExposureRolled -> the face with the odds it had -> wound, frostbite, bite chain steps, a death
//   zombies   ZombiesToAdd -> each zombie by entrance, barricades broken, overruns and their victims
//   vote      VoteCalled -> ballots -> the result -> the exile
// Every number comes from an event or from engine `query.*` (passed in as context); this module does no rules arithmetic, it only
// counts the children it has already listed. Pure (no stores, no clock) so it is unit tested.
import type { ExposureFace, GameEvent, GameState } from '../../engine/index'
import { COLONY_STEP_TITLE, EXPOSURE_WHY, FACE_WORD, feedLine, type Names } from './feed'

export type FeedGroupKind = 'crisis' | 'exposure' | 'zombies' | 'vote'
export type FeedTone = 'normal' | 'roll' | 'bad' | 'good' | 'crisis'
export interface FeedOdds { blank: number; wound: number; frostbite: number; bite: number; pDeath: number; face: ExposureFace; raw: number }
export interface FeedChip { text: string; tone: 'good' | 'bad' | 'neutral' }
export interface FeedRunning { running: number; needed: number | null; points: 1 | -1; index: number }

export interface FeedEntry {
  seq: number
  text: string
  /** "Round 2: Rook's turn" - the one-string group key. */
  turnKey: string
  /** The round this belongs to (null for setup and the end), the turn or phase heading, and the colony step heading.
   *  Table-talk lines (bot/talk.ts) carry none of these and join the group of the line before them. */
  round?: number | null
  turn?: string
  step?: string
  tone: FeedTone
  /** Set on the first line of a breakdown group. */
  group?: FeedGroupKind
  /** The head this line is listed under. */
  parent?: number
  chip?: FeedChip
  odds?: FeedOdds
  running?: FeedRunning
}

/** The engine numbers the director looks up for an event before it is applied (query.*), all optional. */
export interface FeedContext {
  /** query.exposureOdds for the rolled survivor, from the state just before the roll. */
  exposure?: { blank: number; wound: number; frostbite: number; bite: number; pDeath: number } | null
  /** query.crisis: the points the crisis needs (null when the engine could not say). */
  crisisNeeded?: number | null
  /** The round's crisis, named on the head that opens the card-by-card reveal. */
  crisisName?: string | null
}

export interface Heading { round: number | null; turn: string; step?: string; key: string }

/** Where in the game an event happened: the round, whose turn it is, or the colony-phase step. */
export function headingOf(s: Pick<GameState, 'phase' | 'roundNumber' | 'activeSeat' | 'colonyStep'>, N: Pick<Names, 'seat'>): Heading {
  if (s.phase === 'setup') return { round: null, turn: 'Setup', key: 'Setup' }
  if (s.phase === 'ended') return { round: null, turn: 'Game over', key: 'Game over' }
  if (s.phase === 'colony') {
    const step = s.colonyStep ? COLONY_STEP_TITLE[s.colonyStep] : undefined
    return { round: s.roundNumber, turn: 'Colony phase', ...(step ? { step } : {}), key: `Round ${s.roundNumber}: colony phase` }
  }
  const who = s.activeSeat ? `${N.seat(s.activeSeat)}'s turn` : "the table's turn"
  return { round: s.roundNumber, turn: who, key: `Round ${s.roundNumber}: ${who}` }
}

const groupKindOf = (ev: GameEvent): FeedGroupKind | null => {
  switch (ev.type) {
    case 'ExposureRolled': return ev.reason === 'biteChain' ? null : 'exposure'
    case 'ZombiesToAdd': return 'zombies'
    case 'VoteCalled': return 'vote'
    default: return null
  }
}
/** Whether `ev` is part of an open group of `kind` (rather than closing it). */
export function joinsGroup(kind: FeedGroupKind, ev: GameEvent): boolean {
  switch (kind) {
    case 'crisis': return ev.type === 'CrisisCardRevealed' || ev.type === 'CrisisResolved' || ev.type === 'CrisisEffectApplied' || ev.type === 'MoraleChanged'
    case 'exposure':
      return ev.type === 'ExposureFaceChanged' || ev.type === 'WoundTaken' || ev.type === 'SurvivorKilled' || ev.type === 'BiteSpreadStep' || ev.type === 'BiteChoiceMade'
        || ev.type === 'BiteChainEnded' || ev.type === 'SurvivorRemoved' || ev.type === 'MoraleChanged' || ev.type === 'EquippedReturned' || ev.type === 'HandDiscarded'
        || (ev.type === 'ExposureRolled' && ev.reason === 'biteChain')
    case 'zombies':
      return ev.type === 'ZombieAdded' || ev.type === 'BarricadeDestroyed' || ev.type === 'EntranceOverrun' || ev.type === 'SurvivorKilled' || ev.type === 'HelplessKilled'
        || ev.type === 'MoraleChanged' || ev.type === 'EquippedReturned' || ev.type === 'SurvivorRemoved' || ev.type === 'HandDiscarded'
    case 'vote':
      return ev.type === 'VotesCast' || ev.type === 'VoteResult' || ev.type === 'SeatExiled' || ev.type === 'ExiledPlaced' || ev.type === 'SurvivorBumped' || ev.type === 'SeatEliminated'
        || (ev.type === 'SurvivorMoved' && ev.kind === 'exile')
  }
}

export const toneOf = (ev: GameEvent): FeedTone => {
  switch (ev.type) {
    case 'ExposureRolled': case 'ActionDiceRolled': case 'DiceRolled': case 'NoiseRolled': case 'SurvivorAttacked': return 'roll'
    case 'SurvivorKilled': case 'EntranceOverrun': case 'Starvation': case 'BarricadeDestroyed': case 'HelplessKilled': case 'WoundTaken': return 'bad'
    case 'CrisisRevealed': case 'CrisisCardRevealed': case 'CrisisResolved': case 'CrisisEffectApplied': return 'crisis'
    case 'ObjectiveComplete': case 'BarricadeAdded': case 'WoundHealed': return 'good'
    default: return 'normal'
  }
}

interface Open { kind: FeedGroupKind; seq: number; cards: number; placed: number; broken: number; overruns: number }
export interface FeedPatch { seq: number; patch: Partial<FeedEntry> }
export interface FeedStep { entries: FeedEntry[]; patches: FeedPatch[] }

/** Turns redacted events into feed entries, one call per event in order. Holds the open breakdown group between calls. */
export class FeedBuilder {
  private open: Open | null = null

  reset(): void { this.open = null }

  /** `post` is the presented state after the event (for the round and turn heading). */
  add(ev: GameEvent, seq: number, post: Pick<GameState, 'phase' | 'roundNumber' | 'activeSeat' | 'colonyStep'>, N: Names, ctx: FeedContext = {}): FeedStep {
    const out: FeedStep = { entries: [], patches: [] }
    const text = this.textFor(ev, N, ctx)
    if (text === null) return out // an event without a line neither opens nor closes a group
    // the start of a round belongs to no turn yet (the active seat is still the last one of the round before)
    const h = ev.type === 'RoundStarted' ? { round: post.roundNumber, turn: 'Start of round', key: `Round ${post.roundNumber}: start` } : headingOf(post, N)
    const base: FeedEntry = { seq, text, turnKey: h.key, round: h.round, turn: h.turn, ...(h.step ? { step: h.step } : {}), tone: toneOf(ev) }
    // setup drops its starting zombies one per location: plain lines, not breakdowns
    const opens = ev.type === 'ZombiesToAdd' && post.phase === 'setup' ? null : groupKindOf(ev)
    // the card-by-card reveal has no event of its own to open it: the first flipped card (or the verdict, when no card was added) does
    if ((ev.type === 'CrisisCardRevealed' || ev.type === 'CrisisResolved') && this.open?.kind !== 'crisis') {
      this.open = { kind: 'crisis', seq: seq - 0.5, cards: 0, placed: 0, broken: 0, overruns: 0 }
      const name = ctx.crisisName ?? 'The crisis'
      const headText = `${name}: the crisis cards are revealed${ctx.crisisNeeded ? ` (the colony needs ${ctx.crisisNeeded} points)` : ''}.`
      out.entries.push({ ...base, seq: seq - 0.5, text: headText, group: 'crisis', tone: 'crisis' })
    }
    if (this.open && !opens && joinsGroup(this.open.kind, ev)) {
      out.entries.push({ ...base, parent: this.open.seq, ...this.childExtras(ev, N, ctx, out) })
      return out
    }
    this.open = null
    if (opens) {
      this.open = { kind: opens, seq, cards: 0, placed: 0, broken: 0, overruns: 0 }
      out.entries.push({ ...base, group: opens, ...this.headExtras(ev, ctx) })
      return out
    }
    out.entries.push(base)
    return out
  }

  private textFor(ev: GameEvent, N: Names, ctx: FeedContext): string | null {
    switch (ev.type) {
      case 'ExposureRolled': return `${N.survivor(ev.survivorId)} rolls the exposure die (${EXPOSURE_WHY[ev.reason] ?? ev.reason}): ${FACE_WORD[ev.face]}.`
      case 'ZombiesToAdd': return `${ev.count === 1 ? '1 zombie' : `${ev.count} zombies`} to place at ${N.loc(ev.location)}${ev.survivors !== undefined ? ` (${ev.survivors === 1 ? '1 survivor' : `${ev.survivors} survivors`} there)` : ''}.`
      case 'VoteCalled': return `${N.seat(ev.caller)} calls a vote to exile ${N.seat(ev.target)}.`
      case 'CrisisCardRevealed': {
        const n = (this.open?.kind === 'crisis' ? this.open.cards : 0) + 1
        return `Card ${n}: ${N.item(ev.defId)} ${ev.points > 0 ? '+1' : '-1'}. Running total ${ev.runningTotal}${ctx.crisisNeeded ? ` of ${ctx.crisisNeeded}` : ''}.`
      }
      case 'VoteResult':
        // a vote that no VoteCalled opened was raised by a Crossroads card: there is nobody to exile, so no verdict word
        if (this.open?.kind !== 'vote') return `The table votes: ${ev.yes} yes, ${ev.no} no${ev.tiebreakBy ? ` (tie broken by ${N.seat(ev.tiebreakBy)})` : ''}.`
        return feedLine(ev, N)
      case 'ZombieAdded': return ev.location === 'colony' ? `Gate ${ev.entrance}: a zombie takes a space (${ev.zombies} there).` : `A zombie arrives at ${N.loc(ev.location)} (${ev.zombies} there).`
      case 'BarricadeDestroyed': return ev.location === 'colony' ? `Gate ${ev.entrance}: a barricade is broken (${ev.barricades} left).` : `A barricade falls at ${N.loc(ev.location)}.`
      case 'EntranceOverrun': {
        const where = ev.location === 'colony' ? `Gate ${ev.entrance}` : N.loc(ev.location)
        return `${where} is overrun${ev.killed ? (ev.killed === 'helpless' ? ': a helpless survivor dies' : `: ${N.survivor(ev.killed)} dies`) : ': no one there to kill'}.`
      }
      default: return feedLine(ev, N)
    }
  }

  private headExtras(ev: GameEvent, ctx: FeedContext): Partial<FeedEntry> {
    if (ev.type === 'ExposureRolled') {
      const o = ctx.exposure
      return { chip: { text: FACE_WORD[ev.face], tone: ev.face === 'blank' ? 'good' : 'bad' }, ...(o ? { odds: { ...o, face: ev.face, raw: ev.raw } } : {}) }
    }
    return {}
  }

  private childExtras(ev: GameEvent, N: Names, ctx: FeedContext, out: FeedStep): Partial<FeedEntry> {
    const g = this.open
    if (!g) return {}
    switch (ev.type) {
      case 'CrisisCardRevealed':
        g.cards++
        return { running: { running: ev.runningTotal, needed: ctx.crisisNeeded ?? null, points: ev.points, index: g.cards } }
      case 'CrisisResolved':
        out.patches.push({
          seq: g.seq,
          patch: { chip: { text: ev.prevented ? (ev.bonus ? 'PREVENTED WITH BONUS' : 'PREVENTED') : 'NOT PREVENTED', tone: ev.prevented ? 'good' : 'bad' } },
        })
        return {}
      case 'ZombieAdded': g.placed++; this.zombieChip(out); return {}
      case 'BarricadeDestroyed': g.broken++; this.zombieChip(out); return {}
      case 'EntranceOverrun': g.overruns++; this.zombieChip(out); return {}
      case 'SurvivorKilled':
        if (g.kind === 'exposure') out.patches.push({ seq: g.seq, patch: { chip: { text: `${N.survivor(ev.survivorId)} DIES`, tone: 'bad' } } })
        return {}
      case 'VoteResult':
        out.patches.push({ seq: g.seq, patch: { chip: { text: ev.exiled ? 'EXILED' : 'STAYS', tone: ev.exiled ? 'bad' : 'good' } } })
        return {}
      default: return {}
    }
  }

  private zombieChip(out: FeedStep): void {
    const g = this.open
    if (!g) return
    const parts = [`${g.placed} placed`]
    if (g.broken) parts.push(`${g.broken} ${g.broken === 1 ? 'barricade' : 'barricades'} broken`)
    if (g.overruns) parts.push(`${g.overruns} ${g.overruns === 1 ? 'overrun' : 'overruns'}`)
    out.patches.push({ seq: g.seq, patch: { chip: { text: parts.join(', '), tone: g.overruns || g.broken ? 'bad' : 'neutral' } } })
  }
}

/** Apply patches to a list of entries (entries are replaced, never mutated). */
export function applyFeedPatches(list: readonly FeedEntry[], patches: readonly FeedPatch[]): FeedEntry[] {
  if (!patches.length) return list as FeedEntry[]
  const bySeq = new Map<number, Partial<FeedEntry>>()
  for (const p of patches) bySeq.set(p.seq, { ...(bySeq.get(p.seq) ?? {}), ...p.patch })
  return list.map((e) => (bySeq.has(e.seq) ? { ...e, ...bySeq.get(e.seq)! } : e))
}

/** The feed as the rail shows it: rounds, then turns, then lines with each breakdown's children under its head. */
export interface FeedItem { entry: FeedEntry; children: FeedEntry[] }
export interface FeedTurn { turn: string; items: FeedItem[] }
export interface FeedRound { round: number | null; turns: FeedTurn[] }
export function arrangeFeed(entries: readonly FeedEntry[]): FeedRound[] {
  const rounds: FeedRound[] = []
  const heads = new Map<number, FeedItem>()
  let round: number | null = null
  let turn = ''
  for (const e of entries) {
    if (e.turn !== undefined) { round = e.round ?? null; turn = e.turn }
    let r = rounds[rounds.length - 1]
    if (!r || r.round !== round) { r = { round, turns: [] }; rounds.push(r); heads.clear() }
    let t = r.turns[r.turns.length - 1]
    if (!t || t.turn !== turn) { t = { turn, items: [] }; r.turns.push(t); heads.clear() }
    const head = e.parent !== undefined ? heads.get(e.parent) : undefined
    if (head) { head.children.push(e); continue }
    const item: FeedItem = { entry: e, children: [] }
    t.items.push(item)
    if (e.group) heads.set(e.seq, item)
  }
  return rounds
}
