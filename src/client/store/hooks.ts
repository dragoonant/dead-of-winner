// Small hooks every panel shares: the human's view of the PRESENTED state (what is on screen) and of the TRUE state (the open decision).
import { useMemo } from 'react'
import { view, type GameState, type SeatView } from '../../engine/index'
import { usePresentedStore } from '../presentation/presentedStore'
import { useGameStore } from './gameStore'

/** The viewer's seat view of the state at the animation cursor. Null before a game exists. */
export function usePresentedView(): SeatView | null {
  const state = usePresentedStore((s) => s.state)
  const viewer = useGameStore((s) => s.viewer)
  return useMemo(() => (state ? safeView(state, viewer) : null), [state, viewer])
}

/** The viewer's seat view of the engine's true state (what prompts read). */
export function useTrueView(): SeatView | null {
  const state = useGameStore((s) => s.state)
  const viewer = useGameStore((s) => s.viewer)
  return useMemo(() => (state ? safeView(state, viewer) : null), [state, viewer])
}

function safeView(state: GameState, seat: string): SeatView | null {
  try { return view(state, seat) } catch { return null }
}
