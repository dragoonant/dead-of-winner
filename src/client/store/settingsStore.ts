// Player settings (50 §14): animation speed, graphics tier, narration, rails, seat colours, tutorial tips. Persisted under `dow.settings`.
import { create } from 'zustand'
import { readJson, writeJson } from './storage'

/** Animation playback rate. 1 = normal, 2 = fast, 0.5 = slow; 0 = instant (beats take no time, batches drain synchronously). */
export type AnimSpeed = number
export const SPEED_PRESETS = { slow: 0.5, normal: 1, fast: 2, instant: 0 } as const
export type SpeedPreset = keyof typeof SPEED_PRESETS
export type GraphicsTier = 'low' | 'high'
/** Seat colour sets: the default, an alternative bright set, and a colour-blind-safe set (Okabe-Ito) with a shape mark beside each colour. */
export type PaletteId = 'default' | 'alt' | 'cbsafe'
export const PALETTE_IDS: readonly PaletteId[] = ['default', 'alt', 'cbsafe']

export interface Settings {
  speed: AnimSpeed
  graphics: GraphicsTier
  narration: boolean
  leftCollapsed: boolean
  rightCollapsed: boolean
  palette: PaletteId
  /** Show the short "how this works" tips on the first occasion each one applies. */
  tips: boolean
  /** Ids of the tips already shown (cleared by "Replay tutorial tips"). */
  tipsSeen: string[]
}

export const SETTINGS_KEY = 'dow.settings'
export const DEFAULT_SETTINGS: Settings = {
  speed: 1, graphics: 'high', narration: true, leftCollapsed: false, rightCollapsed: false, palette: 'default', tips: true, tipsSeen: [],
}

export function sanitizeSettings(raw: Partial<Settings> | null): Settings {
  const s: Settings = { ...DEFAULT_SETTINGS, tipsSeen: [] }
  if (!raw || typeof raw !== 'object') return s
  if (typeof raw.speed === 'number' && Number.isFinite(raw.speed) && raw.speed >= 0 && raw.speed <= 8) s.speed = raw.speed
  if (raw.graphics === 'low' || raw.graphics === 'high') s.graphics = raw.graphics
  if (typeof raw.narration === 'boolean') s.narration = raw.narration
  if (typeof raw.leftCollapsed === 'boolean') s.leftCollapsed = raw.leftCollapsed
  if (typeof raw.rightCollapsed === 'boolean') s.rightCollapsed = raw.rightCollapsed
  if (raw.palette && PALETTE_IDS.includes(raw.palette)) s.palette = raw.palette
  if (typeof raw.tips === 'boolean') s.tips = raw.tips
  if (Array.isArray(raw.tipsSeen)) s.tipsSeen = raw.tipsSeen.filter((x): x is string => typeof x === 'string').slice(0, 64)
  return s
}

interface SettingsStore extends Settings {
  set(patch: Partial<Settings>): void
  reload(): void
}

const pick = (s: Settings): Settings => ({
  speed: s.speed, graphics: s.graphics, narration: s.narration, leftCollapsed: s.leftCollapsed, rightCollapsed: s.rightCollapsed,
  palette: s.palette, tips: s.tips, tipsSeen: s.tipsSeen,
})

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...DEFAULT_SETTINGS,
  ...sanitizeSettings(readJson<Partial<Settings>>(SETTINGS_KEY)),
  set(patch) {
    const next = sanitizeSettings({ ...pick(get()), ...patch })
    set(next)
    writeJson(SETTINGS_KEY, next)
  },
  reload() { set(sanitizeSettings(readJson<Partial<Settings>>(SETTINGS_KEY))) },
}))

export function getSettings(): Settings { return pick(useSettingsStore.getState()) }

/** Scale a base duration (ms at speed 1) by the current speed; 0 at instant speed. */
export function scaled(ms: number, speed = useSettingsStore.getState().speed): number {
  if (speed <= 0) return 0
  return Math.round(ms / speed)
}

export function speedName(speed: number): SpeedPreset | 'custom' {
  for (const [k, v] of Object.entries(SPEED_PRESETS)) if (v === speed) return k as SpeedPreset
  return 'custom'
}
