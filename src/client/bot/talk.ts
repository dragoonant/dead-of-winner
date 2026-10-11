// Table talk (41): reacts to public events as the presentation reaches them and lets the bots say a line from their persona's bank.
// A line lands in the event feed (tagged with the speaker) and as a short speech bubble on that seat in the seat rail. Lines carry only
// public slots (seat and survivor names, numbers), so they cannot reveal hidden state; pacing is the talker's (about one line per bot
// per turn, scaled by the persona's chattiness).
import { create } from 'zustand'
import { speakPersonaLine } from '../audio/personaVoice'
import { createTalker, type Fills, type Talker, type TalkKey } from '../../ai/talk'
import { getPersona } from '../../ai/personas'
import type { GameEvent, GameState, SeatId } from '../../engine/index'
import { nameOf, seatNameOf } from '../data'
import { FEED_LIMIT, usePresentedStore } from '../presentation/presentedStore'
import { useGameStore } from '../store/gameStore'

export const BUBBLE_MS = 4000
export interface Bubble { id: number; text: string }
interface TalkState { bubbles: Record<string, Bubble | undefined> }
export const useTalkStore = create<TalkState>(() => ({ bubbles: {} }))

let talkers = new Map<string, Talker>()
let feedSeq = 1_000_000_000
let bubbleId = 0
let moraleSpoken = false
const timers = new Map<string, ReturnType<typeof setTimeout>>()

export function resetTalk(): void {
  talkers = new Map()
  moraleSpoken = false
  for (const t of timers.values()) clearTimeout(t)
  timers.clear()
  useTalkStore.setState({ bubbles: {} })
}

function talkerFor(st: GameState, seat: SeatId): Talker | null {
  const cfg = st.setup.seats.find((s) => s.id === seat)
  if (!cfg || cfg.kind !== 'bot') return null
  const key = `${st.seed}|${seat}`
  let t = talkers.get(key)
  if (!t) { t = createTalker(getPersona(cfg.persona), `${st.seed}|talk`, seat); talkers.set(key, t) }
  return t
}

/** One line from `seat`, if it is a bot with something to say. Returns whether a line was shown. */
export function say(seat: SeatId, key: TalkKey, fills: Fills, opts?: { force?: boolean; always?: boolean }): boolean {
  const st = useGameStore.getState().state
  if (!st) return false
  const t = talkerFor(st, seat)
  const text = t?.say(key, fills, st.turnCount, opts)
  if (!text) return false
  speakPersonaLine(st.setup.seats.find((x) => x.id === seat)?.persona, key, text)
  const name = seatNameOf(st.setup, seat)
  usePresentedStore.setState((s) => {
    const last = s.feed[s.feed.length - 1]
    const entry = { seq: feedSeq++, text: `${name}: "${text}"`, turnKey: last?.turnKey ?? 'Table talk', tone: 'normal' as const }
    return { feed: [...s.feed, entry].slice(-FEED_LIMIT) }
  })
  const id = ++bubbleId
  useTalkStore.setState((s) => ({ bubbles: { ...s.bubbles, [seat]: { id, text } } }))
  const old = timers.get(seat)
  if (old) clearTimeout(old)
  timers.set(seat, setTimeout(() => {
    useTalkStore.setState((s) => (s.bubbles[seat]?.id === id ? { bubbles: { ...s.bubbles, [seat]: undefined } } : s))
  }, BUBBLE_MS))
  return true
}

/** A bot states its lean right before the simultaneous vote (always speaks). */
export function sayLean(seat: SeatId, target: SeatId, yes: boolean): void {
  const st = useGameStore.getState().state
  if (!st) return
  say(seat, yes ? 'vote.lean.yes' : 'vote.lean.no', { seat: seatNameOf(st.setup, target) }, { force: true })
}

const botSeats = (st: GameState): SeatId[] => st.seatOrder.filter((s) => st.seats[s]?.seat.kind === 'bot' && !st.seats[s]!.seat.eliminated)

/** At most `max` bots react to one event, starting from a rotating seat so the same bot does not always answer first. */
function chorus(st: GameState, key: TalkKey, fills: Fills, max: number, skip: SeatId[] = []): void {
  const bots = botSeats(st).filter((s) => !skip.includes(s))
  if (bots.length === 0) return
  const start = (st.turnCount + st.roundNumber) % bots.length
  let spoke = 0
  for (let i = 0; i < bots.length && spoke < max; i++) if (say(bots[(start + i) % bots.length]!, key, fills)) spoke++
}

function react(ev: GameEvent, st: GameState): void {
  switch (ev.type) {
    case 'TurnStarted': say(ev.seat, 'turn.start', {}); break
    case 'CrisisResolved': {
      if (ev.prevented) chorus(st, 'crisis.prevented', { n: ev.total }, 1)
      else chorus(st, 'crisis.failed', { n: Math.max(1, ev.needed - ev.total) }, 1)
      break
    }
    case 'VoteCalled': chorus(st, 'vote.called', { seat: seatNameOf(st.setup, ev.target) }, 1, [ev.caller]); break
    case 'RequestAnswered': say(ev.to, ev.cardId ? 'request.give' : 'request.decline', { seat: seatNameOf(st.setup, ev.from) }, { force: true }); break
    case 'SurvivorKilled':
      if (ev.cause === 'bite' && ev.owner) say(ev.owner, 'exposure.bite', { survivor: nameOf(ev.survivorId) }, { force: true })
      break
    case 'MoraleChanged':
      if (ev.delta < 0 && ev.after <= 2 && !moraleSpoken) { moraleSpoken = true; chorus(st, 'morale.low', {}, 1) }
      break
    case 'GameEnded': {
      const bots = botSeats(st)
      let won = 0
      let lost = 0
      for (const s of bots) {
        if (ev.winners.includes(s)) { if (won < 2 && say(s, 'game.won', {}, { force: true })) won++ }
        else if (lost < 2 && say(s, 'game.lost', {}, { force: true })) lost++
      }
      break
    }
    default: break
  }
}

/** Start reacting to events as the presentation shows them. Returns the stop function. */
export function startTalk(): () => void {
  resetTalk()
  let handled = usePresentedStore.getState().cursor
  const unsub = usePresentedStore.subscribe((s, prev) => {
    if (s.cursor === prev.cursor || s.cursor <= handled) return
    const from = handled
    handled = s.cursor
    const gs = useGameStore.getState()
    const st = gs.state
    if (!st) return
    for (const x of gs.events) if (x.seq > from && x.seq <= s.cursor) react(x.event, st)
  })
  return () => { unsub(); resetTalk() }
}
