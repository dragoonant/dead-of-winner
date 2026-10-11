// Table talk (41): reacts to public events as the presentation reaches them and lets the bots say a line from their persona's bank.
// A line lands in the event feed (tagged with the speaker) and as a short speech bubble on that seat in the seat rail. Lines carry only
// public slots (seat and survivor names, numbers), so they cannot reveal hidden state; pacing is the talker's (about one line per bot
// per turn, scaled by the persona's chattiness).
import { create } from 'zustand'
import { speakPersonaLine } from '../audio/personaVoice'
import { createTalker, type Fills, type Talker, type TalkKey } from '../../ai/talk'
import { getPersona } from '../../ai/personas'
import type { GameEvent, GameState, SeatId } from '../../engine/index'
import { itemSymbols, locName, nameOf, seatNameOf } from '../data'
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

/** A bot states its lean right before the simultaneous vote (always speaks; a quiet persona says it as a silent beat), and the seat it names answers. */
export function sayLean(seat: SeatId, target: SeatId, yes: boolean): void {
  const st = useGameStore.getState().state
  if (!st) return
  say(seat, yes ? 'vote.lean.yes' : 'vote.lean.no', { seat: seatNameOf(st.setup, target) }, { force: true }) // the talker turns a quiet persona's lean into a silent beat
  if (yes) say(target, 'accused.me', { seat: seatNameOf(st.setup, seat) }, { force: true })
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

const ownerOf = (st: GameState, survivorId: string | undefined): SeatId | null => (survivorId ? st.survivors[survivorId]?.owner ?? null : null)
const SYMBOLS = ['weapon', 'fuel', 'education', 'food', 'medicine', 'tool', 'survivor'] as const

function react(ev: GameEvent, st: GameState): void {
  switch (ev.type) {
    case 'RoundStarted': chorus(st, 'round.start', { n: ev.roundsLeft }, 1); break
    case 'TurnStarted': say(ev.seat, 'turn.start', { n: st.roundsLeft }); break
    case 'CrisisRevealed': chorus(st, 'crisis.revealed', { crisis: nameOf(ev.cardId), symbol: ev.prevent[0] ?? 'food' }, 1); break
    case 'CrisisResolved': {
      if (ev.prevented) {
        chorus(st, 'crisis.prevented', { n: ev.total }, 1)
        if (ev.bonus) chorus(st, 'crisis.bonus', {}, 1)
      } else chorus(st, 'crisis.failed', { n: Math.max(1, ev.needed - ev.total) }, 1)
      break
    }
    case 'VoteCalled': {
      const caller = seatNameOf(st.setup, ev.caller)
      say(ev.target, 'vote.called.me', { seat: caller }, { force: true })
      chorus(st, 'vote.called.other', { seat: seatNameOf(st.setup, ev.target) }, 1, [ev.caller, ev.target])
      break
    }
    case 'VoteResult': chorus(st, ev.exiled ? 'vote.passed' : 'vote.failed', { seat: seatNameOf(st.setup, ev.target) }, 1, [ev.target]); break
    case 'SeatExiled': {
      say(ev.seat, 'exiled.me', {}, { force: true })
      chorus(st, 'exiled.other', { seat: seatNameOf(st.setup, ev.seat) }, 1, [ev.seat])
      break
    }
    case 'RequestMade': say(ev.from, 'request.made', { seat: seatNameOf(st.setup, ev.to), symbol: ev.symbol ?? 'food' }); break
    case 'RequestAnswered':
      say(ev.to, ev.cardId ? 'request.give' : 'request.decline', { seat: seatNameOf(st.setup, ev.from) }, { force: true })
      if (!ev.cardId) say(ev.from, 'request.refused.me', { seat: seatNameOf(st.setup, ev.to) })
      break
    case 'SearchKept': {
      const sym = SYMBOLS.find((x) => itemSymbols(st.cards[ev.cardId]?.defId).includes(x))
      if (sym) say(ev.seat, `search.found.${sym}`, { location: locName(ev.location) })
      break
    }
    case 'NoiseAdded': if (ev.by === 'search') { const who = st.search?.seat ?? st.activeSeat; if (who) say(who, 'search.noise', { location: locName(ev.location) }) } break
    case 'SurvivorMoved': {
      const o = ownerOf(st, ev.survivorId)
      if (o && ev.kind === 'action' && ev.from === 'colony') say(o, 'move.out', { survivor: nameOf(ev.survivorId), location: locName(ev.to) })
      break
    }
    case 'ZombieKilled': { const o = ownerOf(st, String(ev.by)); if (o) say(o, 'zombie.killed', { location: locName(ev.location) }); break }
    case 'BarricadeAdded': { const o = ownerOf(st, String(ev.by)); if (o) say(o, 'barricade.built', { entrance: ev.entrance }); break }
    case 'WoundTaken': { const o = ownerOf(st, ev.survivorId); if (o && ev.source === 'exposure') say(o, 'exposure.wound', { survivor: nameOf(ev.survivorId) }); break }
    case 'BiteChoiceMade': if (ev.choice === 'kill') say(ev.seat, 'bite.chain.kill', { survivor: nameOf(ev.survivorId) }, { force: true }); break
    case 'SurvivorKilled':
      if (ev.cause === 'bite' && ev.owner) say(ev.owner, 'exposure.bite', { survivor: nameOf(ev.survivorId) }, { force: true })
      else if (ev.owner) chorus(st, 'survivor.lost.other', { seat: seatNameOf(st.setup, ev.owner), survivor: nameOf(ev.survivorId) }, 1, [ev.owner])
      break
    case 'EntranceOverrun': if (ev.location === 'colony') chorus(st, 'overrun', { entrance: ev.entrance }, 1); break
    case 'Starvation': if (ev.moraleLoss > 0) chorus(st, 'food.short', { n: ev.moraleLoss }, 1); break
    case 'MoraleChanged':
      if (ev.delta < 0 && ev.after <= 2 && !moraleSpoken) { moraleSpoken = true; chorus(st, 'morale.low', { n: ev.after }, 1) }
      break
    case 'ObjectiveProgress': if (ev.seat === null && ev.delta > 0) chorus(st, 'objective.progress', { n: ev.after }, 1); break
    case 'CrossroadsResolved': say(ev.forSeat, 'crossroads.me', {}); break
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
