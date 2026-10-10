// Presentation director (50 §4): plays each engine step's events as timed beats and moves the presented state along with them.
// The engine has already resolved everything; this only paces what the player sees.
//   gameStore (writer of batches) -> enqueueBatch() -> beats (beats.ts) -> presentedStore
// At speed 0 (instant) or after skipAll(), batches drain synchronously with one store commit per pump.
import { redactEvent, type GameEvent, type GameState } from '../../engine/index'
import { makeNames } from '../data'
import { scaled } from '../store/settingsStore'
import { applyEvent } from './apply'
import { buildBeats, totalMs, type Beat, type SeqEvent } from './beats'
import { FACE_WORD, feedLine, rollPurposeLabel, type Names } from './feed'
import {
  DICE_LOG_LIMIT, FEED_LIMIT, INITIAL_PRESENTED, usePresentedStore,
  type ActiveBeat, type Banner, type CrisisReveal, type FeedEntry, type PresentedState, type ShownRoll,
} from './presentedStore'

/** One engine step's worth of events. `before`/`after` are the true engine states around it. */
export interface Batch { firstSeq: number; lastSeq: number; before: GameState; after: GameState; events: SeqEvent[]; viewer: string }

export interface DirectorClock {
  now(): number
  setTimeout(fn: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
}
const defaultClock: DirectorClock = {
  now: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
}
let clock: DirectorClock = defaultClock
/** Tests: replace the clock (null restores the real one). */
export function setDirectorClock(c: DirectorClock | null): void { clock = c ?? defaultClock }

interface Current { batch: Batch; beats: Beat[]; index: number; state: GameState; names: Names; compress: number }

/** A batch (one engine step, like a whole colony phase) never takes longer than this at normal speed: its beats shrink to fit. */
export const BATCH_BUDGET_MS = 9000

const queue: Batch[] = []
let cur: Current | null = null
let timer: unknown = null
let timerBeat: Beat | null = null
let fastForward = false
let pumping = false
let beatSeq = 0
let bannerSeq = 0

interface Draft { patch: Partial<PresentedState>; feed: FeedEntry[]; dice: ShownRoll[] }
let draft: Draft = { patch: {}, feed: [], dice: [] }

function commit(): void {
  const d = draft
  draft = { patch: {}, feed: [], dice: [] }
  if (!Object.keys(d.patch).length && !d.feed.length && !d.dice.length) return
  usePresentedStore.setState((s) => ({
    ...d.patch,
    feed: d.feed.length ? [...s.feed, ...d.feed].slice(-FEED_LIMIT) : s.feed,
    diceLog: d.dice.length ? [...s.diceLog, ...d.dice].slice(-DICE_LOG_LIMIT) : s.diceLog,
    rev: s.rev + 1,
  }))
}
function peek<K extends keyof PresentedState>(k: K): PresentedState[K] {
  return (k in draft.patch ? draft.patch[k] : usePresentedStore.getState()[k]) as PresentedState[K]
}

/** Which group of the feed an event belongs to: the round and whose turn (or which phase) it is. */
export function turnKeyOf(s: GameState, N: Names): string {
  if (s.phase === 'setup') return 'Setup'
  if (s.phase === 'ended') return 'Game over'
  if (s.phase === 'colony') return `Round ${s.roundNumber}: colony phase`
  return `Round ${s.roundNumber}: ${s.activeSeat ? N.seat(s.activeSeat) : 'table'}'s turn`
}

const toneOf = (ev: GameEvent): FeedEntry['tone'] => {
  switch (ev.type) {
    case 'ExposureRolled': case 'ActionDiceRolled': case 'DiceRolled': case 'NoiseRolled': case 'SurvivorAttacked': return 'roll'
    case 'SurvivorKilled': case 'EntranceOverrun': case 'Starvation': case 'BarricadeDestroyed': case 'HelplessKilled': case 'WoundTaken': return 'bad'
    case 'CrisisRevealed': case 'CrisisCardRevealed': case 'CrisisResolved': case 'CrisisEffectApplied': return 'crisis'
    case 'ObjectiveComplete': case 'BarricadeAdded': case 'WoundHealed': return 'good'
    default: return 'normal'
  }
}

/** The roll the tray shows for an event, or null when it is not a roll. The numbers and the verdict word come from the event. */
export function rollFromEvent(ev: GameEvent, N: Names, seq: number, startedAt: number, durationMs: number): ShownRoll | null {
  const base = { seq, startedAt, durationMs }
  switch (ev.type) {
    case 'ActionDiceRolled': return { ...base, purpose: 'actionDice', title: rollPurposeLabel('actionDice'), actor: N.seat(ev.seat), seat: ev.seat, dice: ev.dice.map((d) => d.value), verdict: null }
    case 'DiceRolled': return {
      ...base, purpose: ev.purpose, title: rollPurposeLabel(ev.purpose), actor: ev.seat ? N.seat(ev.seat) : 'Table', seat: ev.seat ?? null, dice: ev.dice,
      ...(ev.target !== undefined ? { target: ev.target } : {}), verdict: null,
    }
    case 'ExposureRolled': return { ...base, purpose: 'exposure', title: rollPurposeLabel('exposure'), actor: N.survivor(ev.survivorId), seat: null, dice: [ev.raw], verdict: FACE_WORD[ev.face] }
    case 'NoiseRolled': return { ...base, purpose: 'noise', title: `${rollPurposeLabel('noise')}: ${N.loc(ev.location)}`, actor: N.loc(ev.location), seat: null, dice: [ev.die], verdict: ev.zombie ? 'ZOMBIE' : 'QUIET' }
    case 'SurvivorAttacked': return {
      ...base, purpose: 'attackSurvivor', title: rollPurposeLabel('attackSurvivor'), actor: N.survivor(ev.attackerId), seat: null, dice: [ev.roll], target: ev.targetAttack, verdict: ev.hit ? 'HIT' : 'MISS',
    }
    default: return null
  }
}

function applyBeatEvents(beat: Beat): void {
  if (!cur) return
  let s = cur.state
  for (const se of beat.events) s = applyEvent(s, se.event)
  cur.state = s
  draft.patch.state = s
  draft.patch.cursor = Math.max(peek('cursor'), beat.events.length ? beat.events[beat.events.length - 1]!.seq : peek('cursor'))
}

function crisisRevealAfter(ev: GameEvent, N: Names): CrisisReveal | undefined {
  const prev = peek('crisisReveal')
  switch (ev.type) {
    case 'RoundStarted': return { crisisId: null, cards: [] }
    case 'CrisisRevealed': return { crisisId: ev.cardId, cards: [] }
    case 'CrisisCardRevealed': return { crisisId: prev?.crisisId ?? null, cards: [...(prev?.cards ?? []), { name: N.item(ev.defId), points: ev.points, runningTotal: ev.runningTotal }] }
    default: return undefined
  }
}

function startBeat(beat: Beat, dur: number): void {
  if (!cur) return
  const { names, batch } = cur
  const now = clock.now()
  applyBeatEvents(beat)
  const key = turnKeyOf(cur.state, names)
  for (const se of beat.events) {
    const ev = redactEvent(se.event, batch.viewer)
    if (!ev) continue
    const text = feedLine(ev, names)
    if (text) draft.feed.push({ seq: se.seq, text, turnKey: key, tone: toneOf(ev) })
    const shown = rollFromEvent(ev, names, se.seq, now, dur)
    if (shown) { draft.patch.roll = shown; draft.dice.push(shown) }
    const cr = crisisRevealAfter(ev, names)
    if (cr) draft.patch.crisisReveal = cr
  }
  if (dur > 0) {
    if (beat.banner) {
      const b: Banner = { id: ++bannerSeq, text: beat.banner.text, kind: beat.banner.kind }
      draft.patch.banner = b
    }
    const active: ActiveBeat = { id: ++beatSeq, kind: beat.kind, startedAt: now, durationMs: dur, firstSeq: beat.events[0]?.seq ?? 0, lastSeq: beat.events[beat.events.length - 1]?.seq ?? 0 }
    draft.patch.beat = active
  }
}

function endBeat(beat: Beat): void {
  if (beat.banner && peek('banner')) draft.patch.banner = null
  if (peek('beat')) draft.patch.beat = null
}

function finishBatch(): void {
  if (!cur) return
  // snap to the true engine state: the presented state never disagrees with the engine once a batch is shown
  draft.patch.state = cur.batch.after
  draft.patch.cursor = Math.max(peek('cursor'), cur.batch.lastSeq)
  cur = null
}

function pump(): void {
  if (pumping) return
  pumping = true
  try {
    for (;;) {
      if (timer !== null) break
      if (peek('paused')) break
      if (!cur) {
        const b = queue.shift()
        if (!b) {
          fastForward = false
          if (!peek('idle')) draft.patch.idle = true
          break
        }
        const names = makeNames(b.after.setup)
        const beats = buildBeats(b.events, names)
        const total = totalMs(beats)
        cur = { batch: b, beats, index: 0, state: b.before, names, compress: total > BATCH_BUDGET_MS ? BATCH_BUDGET_MS / total : 1 }
      }
      if (cur.index >= cur.beats.length) { finishBatch(); continue }
      const beat = cur.beats[cur.index]!
      const dur = fastForward || beat.baseMs === 0 ? 0 : scaled(Math.max(60, Math.round(beat.baseMs * cur.compress)))
      startBeat(beat, dur)
      if (dur > 0) {
        timerBeat = beat
        timer = clock.setTimeout(() => {
          timer = null
          timerBeat = null
          endBeat(beat)
          if (cur) cur.index++
          pump()
        }, dur)
        break
      }
      endBeat(beat)
      cur.index++
    }
  } finally {
    pumping = false
    commit()
  }
}

// ---------- public API ----------
/** gameStore: queue one step's events for presentation. */
export function enqueueBatch(batch: Batch): void {
  queue.push(batch)
  if (peek('idle')) draft.patch.idle = false
  pump()
}

/** Skip the beat now playing (any click). */
export function skipBeat(): void {
  if (timer === null || !timerBeat) return
  clock.clearTimeout(timer)
  const beat = timerBeat
  timer = null
  timerBeat = null
  endBeat(beat)
  if (cur) cur.index++
  pump()
}

/** Show everything queued at once (rolls and feed lines still reach their logs). */
export function skipAll(): void {
  fastForward = true
  if (timer !== null) skipBeat()
  else pump()
}

export function setPaused(paused: boolean): void {
  if (peek('paused') === paused) return
  draft.patch.paused = paused
  commit()
  if (!paused) pump()
}

/** New game or load: drop everything queued and present `state` with no animation. */
export function resetPresentation(state: GameState | null, seq = 0): void {
  if (timer !== null) clock.clearTimeout(timer)
  timer = null
  timerBeat = null
  queue.length = 0
  cur = null
  fastForward = false
  draft = { patch: {}, feed: [], dice: [] }
  usePresentedStore.setState({ ...INITIAL_PRESENTED, paused: usePresentedStore.getState().paused, state, cursor: seq, rev: usePresentedStore.getState().rev + 1 })
}

export function queuedBatches(): number { return queue.length + (cur ? 1 : 0) }
