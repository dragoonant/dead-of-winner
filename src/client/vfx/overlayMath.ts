// How strongly the frost vignette shows for a morale value (presentation only: the morale itself comes from the engine).
/** 0 while morale is 7 or more, rising to 1 at morale 0. */
export function frostStrength(morale: number, high = 7): number {
  if (!Number.isFinite(morale)) return 0
  const k = Math.max(0, Math.min(1, (high - morale) / high))
  return Math.pow(k, 1.15)
}
