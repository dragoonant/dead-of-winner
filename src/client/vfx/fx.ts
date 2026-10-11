// Effects gating (50 §14): which cheap effects run. The 3D canvas uses the demand frameloop, so every ambient effect (snow, firelight)
// asks for frames only while it is active: High graphics, no reduced-motion preference, the tab in view. Low graphics turns the
// particles, the shadows and the flicker off, and then nothing requests a frame at all.
import { useEffect, useState } from 'react'
import { useSettingsStore } from '../store/settingsStore'

/** Ambient effects redraw at this rate (the scene is otherwise static), not at the display rate. */
export const FX_FPS = 24

export function prefersReducedMotion(): boolean {
  try { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

/** Pure rule: ambient effects run on High graphics unless the player asked the system for reduced motion. */
export function ambientFxOn(graphics: 'low' | 'high', reducedMotion: boolean): boolean {
  return graphics === 'high' && !reducedMotion
}

/** Shadows are a High-graphics feature. */
export const shadowsOn = (graphics: 'low' | 'high'): boolean => graphics === 'high'

/** True while ambient effects should run (and the tab is visible). */
export function useAmbientFx(): boolean {
  const graphics = useSettingsStore((s) => s.graphics)
  const [reduced, setReduced] = useState(prefersReducedMotion)
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden)
  useEffect(() => {
    const onVis = (): void => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', onVis)
    let mq: MediaQueryList | null = null
    const onMq = (): void => setReduced(prefersReducedMotion())
    try { mq = matchMedia('(prefers-reduced-motion: reduce)'); mq.addEventListener('change', onMq) } catch { /* no matchMedia */ }
    return () => { document.removeEventListener('visibilitychange', onVis); mq?.removeEventListener('change', onMq) }
  }, [])
  return ambientFxOn(graphics, reduced) && visible
}

export function useShadows(): boolean { return useSettingsStore((s) => shadowsOn(s.graphics)) }

/** Deterministic flicker in [0, 1] for time `t` seconds: a few incommensurate waves, so the light never visibly repeats. */
export function flicker(t: number): number {
  const v = 0.5 + 0.22 * Math.sin(t * 7.3) + 0.16 * Math.sin(t * 13.1 + 1.7) + 0.12 * Math.sin(t * 23.9 + 0.4) * Math.sin(t * 3.1)
  return Math.max(0, Math.min(1, v))
}

/** A snowflake's position at time `t`: it falls at its own speed, wraps at the floor and sways sideways. Pure, so it is unit tested. */
export function flakeAt(seed: { x: number; y: number; z: number; speed: number; sway: number; phase: number }, t: number, height: number): { x: number; y: number; z: number } {
  const y = ((seed.y - seed.speed * t) % height + height) % height
  return { x: seed.x + Math.sin(t * seed.sway + seed.phase) * 1.2, y, z: seed.z + Math.cos(t * seed.sway * 0.7 + seed.phase) * 0.8 }
}
