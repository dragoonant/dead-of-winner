// Bot driver (50 §4, §11): answers bot-owned decisions through gameStore.dispatch, only while the presentation is idle, so a bot never
// acts over an animation the player has not seen. Votes: each bot answers privately from its own view, then one castVotes goes in.
// A watchdog force-answers (first legal action) when a bot decision has made no progress for WATCHDOG_MS.
import { view, type Action, type PendingDecision, type SeatId } from '../../engine/index'
import { skipAll } from '../presentation/director'
import { isPresentationIdle, usePresentedStore } from '../presentation/presentedStore'
import {
  ballotAction, ballotSeats, dispatch, isBotDecision, isBotSeat, legalFor, setBotVote, useGameStore, voteEligible,
} from '../store/gameStore'
import { scaled, useSettingsStore } from '../store/settingsStore'
import { getDecider } from './deciders'
import { sayLean } from './talk'

export const WATCHDOG_MS = 5000
/** Pause before a bot answers at speed 1 so the human can follow along (scaled by speed; 0 when instant). */
export const BOT_THINK_MS = 350

export interface BotDriverOptions {
  now?: () => number
  setTimeout?: (fn: () => void, ms: number) => unknown
  clearTimeout?: (h: unknown) => void
  watchdogMs?: number
  thinkMs?: number
}

export interface BotDriver {
  start(): void
  stop(): void
  /** Answer the open bot decision now (ignores the think delay). */
  answerNow(force?: boolean): Promise<void>
  readonly running: boolean
  readonly forced: number
}

export function createBotDriver(opts: BotDriverOptions = {}): BotDriver {
  const now = opts.now ?? (() => Date.now())
  const setT = opts.setTimeout ?? ((fn, ms) => setTimeout(fn, ms))
  const clearT = opts.clearTimeout ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>))
  const watchdogMs = opts.watchdogMs ?? WATCHDOG_MS
  const thinkMs = opts.thinkMs ?? BOT_THINK_MS

  let running = false
  let forced = 0
  let seenDecision: string | null = null
  let since = now()
  let tickTimer: unknown = null
  let dogTimer: unknown = null
  let inflight: string | null = null // "<decision id>" a decider is thinking about
  let unsubs: (() => void)[] = []

  const stillOpen = (id: string): boolean => useGameStore.getState().pending?.id === id

  function noteDecision(): void {
    const id = useGameStore.getState().pending?.id ?? null
    if (id !== seenDecision) { seenDecision = id; since = now() }
  }

  async function answerVotes(pd: PendingDecision, force: boolean): Promise<void> {
    const s = useGameStore.getState()
    const st = s.state!
    const eligible = voteEligible(pd)
    for (const seat of ballotSeats(pd)) { // the voters, then a bot exiled first player's tie-break key
      if (!isBotSeat(st, seat) || s.botVotes[seat] !== undefined) continue
      let yes = false
      if (!force) {
        try {
          const legal = legalFor(st)
          const pick = await getDecider(seat, st).decide(view(st, seat), pd, legal)
          if (pick.type === 'castVotes') yes = pick.votes[seat] === true
        } catch { yes = false }
      }
      if (!stillOpen(pd.id)) return
      setBotVote(pd.id, seat, yes)
      const target = (pd.context.data as { target?: SeatId } | undefined)?.target
      if (!force && target && eligible.includes(seat)) sayLean(seat, target, yes)
    }
    const cur = useGameStore.getState()
    if (!stillOpen(pd.id)) return
    if (voteEligible(pd).every((x) => isBotSeat(cur.state!, x))) {
      const ballot = ballotAction()
      if (ballot) dispatch(ballot, force ? 'watchdog' : 'bot')
    }
  }

  async function answerSeat(pd: PendingDecision, force: boolean): Promise<void> {
    const st = useGameStore.getState().state!
    const seat = pd.seat as SeatId
    const legal = legalFor(st)
    if (!legal.length) return
    let pick: Action = legal[0]!
    if (!force) {
      try { pick = await getDecider(seat, st).decide(view(st, seat), pd, legal) } catch { pick = legal[0]! }
    }
    if (!stillOpen(pd.id)) return
    const rej = dispatch(pick, force ? 'watchdog' : 'bot')
    if (rej && pick !== legal[0]) dispatch(legal[0]!, 'watchdog')
  }

  async function answerNow(force = false): Promise<void> {
    const s = useGameStore.getState()
    const pd = s.pending
    if (!s.state || !pd || s.fatal || !isBotDecision(s)) return
    if (inflight === pd.id && !force) return
    inflight = pd.id
    try {
      if (pd.kind === 'votes' && pd.seat === 'all') await answerVotes(pd, force)
      else await answerSeat(pd, force)
    } finally {
      if (inflight === pd.id) inflight = null
    }
  }

  function schedule(): void {
    if (!running || tickTimer !== null) return
    const s = useGameStore.getState()
    if (!isBotDecision(s) || !isPresentationIdle() || inflight === s.pending?.id) return
    tickTimer = setT(() => {
      tickTimer = null
      if (!running) return
      void answerNow().then(() => schedule())
    }, scaled(thinkMs, useSettingsStore.getState().speed))
  }

  function armWatchdog(): void {
    if (dogTimer !== null) clearT(dogTimer)
    dogTimer = null
    if (!running) return
    noteDecision()
    if (!isBotDecision()) return
    const left = Math.max(250, since + watchdogMs - now())
    dogTimer = setT(() => {
      dogTimer = null
      if (!running) return
      noteDecision()
      if (isBotDecision() && !isPresentationIdle() && now() - since >= watchdogMs * 6) {
        skipAll() // the presentation itself is stuck: show everything at once
        since = now()
        armWatchdog()
      } else if (isBotDecision() && isPresentationIdle() && now() - since >= watchdogMs) {
        forced++
        console.warn('[dow] watchdog force-answered', useGameStore.getState().pending?.id)
        skipAll()
        inflight = null
        void answerNow(true).then(() => { schedule(); armWatchdog() })
      } else armWatchdog()
    }, left + 1)
  }

  return {
    start() {
      if (running) return
      running = true
      noteDecision()
      unsubs = [
        useGameStore.subscribe((s, prev) => { if (s.pending !== prev.pending || s.botVotes !== prev.botVotes) { schedule(); armWatchdog() } }),
        // the watchdog only counts time the presentation was idle: a long colony-phase animation is not a stuck bot
        usePresentedStore.subscribe((s, prev) => { if (s.idle !== prev.idle && s.idle) { since = now(); schedule(); armWatchdog() } }),
      ]
      schedule()
      armWatchdog()
    },
    stop() {
      running = false
      inflight = null
      for (const u of unsubs) u()
      unsubs = []
      if (tickTimer !== null) clearT(tickTimer)
      if (dogTimer !== null) clearT(dogTimer)
      tickTimer = null
      dogTimer = null
    },
    answerNow,
    get running() { return running },
    get forced() { return forced },
  }
}

let appDriver: BotDriver | null = null
export function startBotDriver(): BotDriver {
  appDriver ??= createBotDriver()
  appDriver.start()
  return appDriver
}
export function stopBotDriver(): void { appDriver?.stop() }
