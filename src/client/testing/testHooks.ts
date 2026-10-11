// Test hooks (50 §16): `?test=1` exposes window.__game for e2e; prompts also show context.data.code in test mode.
import { view, type Action, type GameState, type PendingDecision, type SeatId, type SeatView } from '../../engine/index'
import { startBotDriver, stopBotDriver } from '../bot/botDriver'
import { skipAll } from '../presentation/director'
import { isPresentationIdle } from '../presentation/presentedStore'
import { dispatch, exportSave, importSave, legalFor, useGameStore, type ClientRejection, type ClientSave } from '../store/gameStore'
import { useSettingsStore } from '../store/settingsStore'
import { frameCount } from '../vfx/frameStats'

export interface GameTestApi {
  state(): GameState | null
  view(seat?: SeatId): SeatView | null
  pending(): PendingDecision | null
  legal(): Action[]
  /** Dispatch as 'test': allowed for any seat's decision. Returns the rejection or null. */
  dispatch(action: Action): ClientRejection | null
  presentedIdle(): boolean
  readonly seed: string | null
  load(save: ClientSave): Promise<string | null>
  save(): ClientSave | null
  /** Animation speed: 1 normal, 2 fast, 0.5 slow, 0 instant. */
  speed(n: number): void
  seatIds(): SeatId[]
  skipAll(): void
  watchdog(): string[]
  /** Stop (true) or restart (false) the bot driver, so a test can answer bot decisions itself through dispatch(). */
  pauseBots(paused: boolean): void
  /** Frames the 3D canvas has rendered so far (the demand loop renders only when asked). */
  frames(): number
}

export function createTestApi(): GameTestApi {
  return {
    state: () => useGameStore.getState().state,
    view: (seat) => {
      const s = useGameStore.getState()
      return s.state ? view(s.state, seat ?? s.viewer) : null
    },
    pending: () => useGameStore.getState().pending,
    legal: () => legalFor(useGameStore.getState().state),
    dispatch: (a) => dispatch(a, 'test'),
    presentedIdle: () => isPresentationIdle(),
    get seed() { return useGameStore.getState().state?.seed ?? null },
    load: (s) => importSave(s),
    save: () => exportSave('test'),
    speed: (n) => useSettingsStore.getState().set({ speed: n }),
    seatIds: () => useGameStore.getState().state?.seatOrder ?? [],
    skipAll: () => skipAll(),
    watchdog: () => useGameStore.getState().watchdog,
    pauseBots: (paused) => { if (paused) stopBotDriver(); else startBotDriver() },
    frames: () => frameCount(),
  }
}

declare global {
  interface Window { __game?: GameTestApi }
}

export function isTestMode(search = typeof location !== 'undefined' ? location.search : ''): boolean {
  return new URLSearchParams(search).get('test') === '1'
}

/** Install window.__game when `?test=1`. Idempotent. */
export function installTestHooks(force = false): GameTestApi | null {
  if (typeof window === 'undefined') return null
  if (!force && !isTestMode()) return null
  window.__game ??= createTestApi()
  return window.__game
}
