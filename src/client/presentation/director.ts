// Presentation director (50 §4): plays each engine step's events as timed beats and moves the presented state along with them.
// The engine has already resolved everything; this only paces what the player sees.
//   gameStore (writer of batches) -> enqueueBatch() -> beats (beats.ts) -> presentedStore
// At speed 0 (instant) or after skipAll(), batches drain synchronously with one store commit per pump.
import { query, redactEvent, view, type GameEvent, type GameState } from '../../engine/index'
import { makeNames } from '../data'
import { scaled, useSettingsStore } from '../store/settingsStore'
import { pct } from '../ui/promptText'
import { prepareBeatAudio, resetPresentationAudio, stopPresentationAudio } from '../audio/presentAudio'
import { applyEvent } from './apply'
import { buildBeats, totalMs, type Beat, type SeqEvent } from './beats'
import { FACE_WORD, rollPurposeLabel, type Names } from './feed'
import { FeedBuilder, applyFeedPatches, headingOf, type FeedContext, type FeedEntry, type FeedPatch } from './feedModel'
import {
  DICE_LOG_LIMIT, FEED_LIMIT, INITIAL_PRESENTED, usePresentedStore,
  type ActiveBeat, type Banner, type CrisisReveal, type FlashKind, type PresentedState, type ShownRoll,
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
const speedIsInstant = (): boolean => useSettingsStore.getState().speed <= 0
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
let flashSeq = 0
const feedBuilder = new FeedBuilder()

interface Draft { patch: Partial<PresentedState>; feed: FeedEntry[]; patches: FeedPatch[]; dice: ShownRoll[] }
const emptyDraft = (): Draft => ({ patch: {}, feed: [], patches: [], dice: [] })
let draft: Draft = emptyDraft()

function commit(): void {
  const d = draft
  draft = emptyDraft()
  if (!Object.keys(d.patch).length && !d.feed.length && !d.patches.length && !d.dice.length) return
  usePresentedStore.setState((s) => ({
    ...d.patch,
    feed: d.feed.length || d.patches.length ? applyFeedPatches([...s.feed, ...d.feed], d.patches).slice(-FEED_LIMIT) : s.feed,
    diceLog: d.dice.length ? [...s.diceLog, ...d.dice].slice(-DICE_LOG_LIMIT) : s.diceLog,
    rev: s.rev + 1,
  }))
}
function peek<K extends keyof PresentedState>(k: K): PresentedState[K] {
  return (k in draft.patch ? draft.patch[k] : usePresentedStore.getState()[k]) as PresentedState[K]
}

/** Which group of the feed an event belongs to: the round and whose turn (or which phase) it is. */
export function turnKeyOf(s: GameState, N: Names): string { return headingOf(s, N).key }

/** "50% blank, 25% wound, 17% frostbite, 8% bite" - the engine's exposure odds, as the feed and the tray print them. */
export function oddsLine(o: { blank: number; wound: number; frostbite: number; bite: number }): string {
  return `${pct(o.blank)} blank, ${pct(o.wound)} wound, ${pct(o.frostbite)} frostbite, ${pct(o.bite)} bite`
}

/** The roll the tray shows for an event, or null when it is not a roll. The numbers and the verdict word come from the event. */
export function rollFromEvent(ev: GameEvent, N: Names, seq: number, startedAt: number, durationMs: number, ctx: FeedContext = {}): ShownRoll | null {
  const base = { seq, startedAt, durationMs }
  switch (ev.type) {
    case 'ActionDiceRolled': return { ...base, purpose: 'actionDice', title: rollPurposeLabel('actionDice'), actor: N.seat(ev.seat), seat: ev.seat, dice: ev.dice.map((d) => d.value), verdict: null }
    case 'DiceRolled': return {
      ...base, purpose: ev.purpose, title: rollPurposeLabel(ev.purpose), actor: ev.seat ? N.seat(ev.seat) : 'Table', seat: ev.seat ?? null, dice: ev.dice,
      ...(ev.target !== undefined ? { target: ev.target } : {}), verdict: null,
    }
    case 'ExposureRolled': return {
      ...base, purpose: 'exposure', title: rollPurposeLabel('exposure'), actor: N.survivor(ev.survivorId), seat: null, dice: [ev.raw], verdict: FACE_WORD[ev.face],
      ...(ctx.exposure ? { note: `Odds: ${oddsLine(ctx.exposure)}` } : {}),
    }
    case 'NoiseRolled': return { ...base, purpose: 'noise', title: `${rollPurposeLabel('noise')}: ${N.loc(ev.location)}`, actor: N.loc(ev.location), seat: null, dice: [ev.die], verdict: ev.zombie ? 'ZOMBIE' : 'QUIET' }
    case 'SurvivorAttacked': return {
      ...base, purpose: 'attackSurvivor', title: rollPurposeLabel('attackSurvivor'), actor: N.survivor(ev.attackerId), seat: null, dice: [ev.roll], target: ev.targetAttack, verdict: ev.hit ? 'HIT' : 'MISS',
    }
    default: return null
  }
}

interface CrisisNumbers { needed: number | null; bonusAt: number | null; name: string | null }
const NO_CRISIS: CrisisNumbers = { needed: null, bonusAt: null, name: null }

function crisisRevealAfter(ev: GameEvent, N: Names, nums: CrisisNumbers): CrisisReveal | undefined {
  const prev = peek('crisisReveal')
  switch (ev.type) {
    case 'RoundStarted': return { crisisId: null, cards: [], needed: null, bonusAt: null, outcome: null, moraleDelta: null }
    case 'CrisisRevealed': return { crisisId: ev.cardId, cards: [], needed: null, bonusAt: null, outcome: null, moraleDelta: null }
    case 'CrisisCardRevealed': return {
      crisisId: prev?.crisisId ?? null, needed: nums.needed ?? prev?.needed ?? null, bonusAt: nums.bonusAt ?? prev?.bonusAt ?? null, outcome: null, moraleDelta: null,
      cards: [...(prev?.cards ?? []), { name: N.item(ev.defId), points: ev.points, runningTotal: ev.runningTotal }],
    }
    case 'CrisisResolved': return prev ? { ...prev, outcome: { total: ev.total, needed: ev.needed, prevented: ev.prevented, bonus: ev.bonus } } : undefined
    case 'MoraleChanged':
      return prev?.outcome && prev.moraleDelta === null && (ev.reason === 'crisisFailed' || ev.reason === 'crisisBonus' || ev.reason === 'crisis') ? { ...prev, moraleDelta: ev.delta } : undefined
    default: return undefined
  }
}

/** What the feed and tray need from the engine for one event: the exposure odds the roll had, the crisis target (query.* on the presented state). */
function contextFor(ev: GameEvent, pre: GameState, viewer: string, N: Names): { feed: FeedContext; crisis: CrisisNumbers } {
  if (ev.type === 'ExposureRolled') {
    try { return { feed: { exposure: query.exposureOdds(view(pre, viewer), ev.survivorId, ev.reason) }, crisis: NO_CRISIS } } catch { return { feed: {}, crisis: NO_CRISIS } }
  }
  if (ev.type === 'CrisisCardRevealed' || ev.type === 'CrisisResolved') {
    let nums: CrisisNumbers = NO_CRISIS
    try {
      const v = view(pre, viewer)
      const c = query.crisis(v)
      nums = { needed: c.needed, bonusAt: c.bonusAt, name: v.crisis.cardId ? N.crisis(v.crisis.cardId) : null }
    } catch { /* the engine could not say: the feed prints without the target */ }
    return { feed: { crisisNeeded: ev.type === 'CrisisResolved' ? ev.needed : nums.needed, crisisName: nums.name }, crisis: nums }
  }
  return { feed: {}, crisis: NO_CRISIS }
}

/** The hit flash an event calls for (kills, wounds, frostbite, bites, deaths), or null. */
export function flashFor(ev: GameEvent): FlashKind | null {
  switch (ev.type) {
    case 'ZombieKilled': return 'kill'
    case 'WoundTaken': return ev.kind === 'frostbite' ? 'frostbite' : 'wound'
    case 'ExposureRolled': return ev.face === 'bite' ? 'bite' : null
    case 'SurvivorKilled': return 'death'
    default: return null
  }
}

function startBeat(beat: Beat, dur: number): void {
  if (!cur) return
  const { names, batch } = cur
  const now = clock.now()
  let s = cur.state
  let flash: FlashKind | null = null
  for (const se of beat.events) {
    const pre = s
    s = applyEvent(s, se.event)
    const ev = redactEvent(se.event, batch.viewer)
    if (!ev) continue
    const { feed: fctx, crisis } = contextFor(ev, pre, batch.viewer, names)
    const step = feedBuilder.add(ev, se.seq, s, names, fctx)
    draft.feed.push(...step.entries)
    draft.patches.push(...step.patches)
    const shown = rollFromEvent(ev, names, se.seq, now, dur, fctx)
    if (shown) { draft.patch.roll = shown; draft.dice.push(shown) }
    const cr = crisisRevealAfter(ev, names, crisis)
    if (cr) draft.patch.crisisReveal = cr
    flash = flashFor(ev) ?? flash
  }
  cur.state = s
  draft.patch.state = s
  draft.patch.cursor = Math.max(peek('cursor'), beat.events.length ? beat.events[beat.events.length - 1]!.seq : peek('cursor'))
  if (dur > 0) {
    if (flash) draft.patch.flash = { id: ++flashSeq, kind: flash }
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
      let dur = fastForward || beat.baseMs === 0 ? 0 : scaled(Math.max(60, Math.round(beat.baseMs * cur.compress)))
      // audio: effects, narration, music (killed events never reach it); a narrated beat is held until the narrator finishes
      const sound = prepareBeatAudio(
        beat.events.flatMap((se) => redactEvent(se.event, cur!.batch.viewer) ?? []), cur.state, cur.batch.viewer, { silent: fastForward || speedIsInstant() },
      )
      if (dur > 0 && sound.holdMs > dur) dur = sound.holdMs
      startBeat(beat, dur)
      sound.play()
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
  stopPresentationAudio()
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
  stopPresentationAudio()
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
  resetPresentationAudio()
  feedBuilder.reset()
  draft = emptyDraft()
  usePresentedStore.setState({ ...INITIAL_PRESENTED, paused: usePresentedStore.getState().paused, state, cursor: seq, rev: usePresentedStore.getState().rev + 1 })
}

export function queuedBatches(): number { return queue.length + (cur ? 1 : 0) }
