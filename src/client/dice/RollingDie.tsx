// A die that tumbles, shows changing faces while it rolls and lands on the engine's value. The value never comes from here:
// the faces flickered through while rolling are decoration, the settled face is `value`. No timers run while the die is at rest.
import { useEffect, useState, type CSSProperties, type ReactElement } from 'react'

/** Whether a roll that started at `startedAt` and lasts `durationMs` is still going at `now` (all performance.now milliseconds). */
export function rollRemaining(startedAt: number, durationMs: number, now: number): number {
  return Math.max(0, startedAt + durationMs - now)
}

/** True for `durationMs` after `key` changes (a new roll, or a replay of an old one); 0 duration means no animation (instant speed). */
export function useRolling(key: string | number, startedAt: number, durationMs: number): boolean {
  const [rolling, setRolling] = useState(false)
  useEffect(() => {
    const left = rollRemaining(startedAt, durationMs, performance.now())
    if (left <= 0) { setRolling(false); return }
    setRolling(true)
    const t = setTimeout(() => setRolling(false), left)
    return () => clearTimeout(t)
    // a new key or a new start time is a new roll
  }, [key, startedAt, durationMs])
  return rolling
}

const FLICKER_MS = 70

export function RollingDie({ value, sides = 6, rolling, size, className = '', testId, title }: {
  value: number | string
  sides?: number
  rolling: boolean
  size?: number
  className?: string
  testId?: string
  title?: string
}): ReactElement {
  const [face, setFace] = useState<number | null>(null)
  useEffect(() => {
    if (!rolling) { setFace(null); return }
    const id = setInterval(() => setFace(1 + Math.floor(Math.random() * sides)), FLICKER_MS)
    return () => clearInterval(id)
  }, [rolling, sides])
  const style: CSSProperties | undefined = size ? { width: size, height: size, fontSize: Math.round(size * 0.52) } : undefined
  const shown = rolling && face !== null ? face : value
  return (
    <div
      className={`die ${sides === 12 ? 'd12' : ''} ${rolling ? 'rolling' : 'settled'} ${className}`}
      style={style}
      title={title}
      data-testid={testId}
      data-rolling={rolling ? 'true' : 'false'}
      data-value={String(value)}
    >
      <span className="face">{shown}</span>
    </div>
  )
}
