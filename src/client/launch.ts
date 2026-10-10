// URL parameters and the setup a launch request builds (50 §2, §16). Pure and engine-free so the title screen stays light.
import type { AiTier, GameSetup, GameVariants, SeatKind, SeatSetup } from '../engine/types'
import { BOT_NAMES } from './data'

export interface LaunchRequest {
  seats: SeatKind[]
  objective: string // a main objective id, a short name to resolve, or 'random'
  seed: string
  tier?: AiTier
  /** Continue the autosave instead of starting a new game. */
  resume?: boolean
}

export interface UrlOptions {
  seed?: string
  seats?: SeatKind[]
  objective?: string
  test: boolean
  fps: boolean
  speed?: number
}

export function parseUrl(search: string): UrlOptions {
  const q = new URLSearchParams(search)
  const out: UrlOptions = { test: q.get('test') === '1', fps: q.has('fps') }
  const seed = q.get('seed')
  if (seed) out.seed = seed.slice(0, 40)
  const seats = q.get('seats')
  if (seats) {
    const list = seats.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
    if (list.length >= 2 && list.length <= 5 && list.every((s) => s === 'human' || s === 'bot')) out.seats = list as SeatKind[]
  }
  const obj = q.get('objective')
  if (obj) out.objective = obj.slice(0, 80)
  const sp = q.get('speed')
  if (sp !== null && sp !== '' && Number.isFinite(Number(sp))) out.speed = Math.max(0, Math.min(8, Number(sp)))
  return out
}

/** The request the URL implies, or null when it does not skip the start screen. */
export function requestFromUrl(o: UrlOptions, randomSeed: () => string): LaunchRequest | null {
  if (!o.seats) return null
  return { seats: o.seats, objective: o.objective ?? 'random', seed: o.seed ?? randomSeed() }
}

export const SEAT_IDS = ['s1', 's2', 's3', 's4', 's5'] as const

/** Resolve an objective hint (exact id, or a word contained in an id or name) against the main-objective list. */
export function resolveObjective(hint: string, list: { id: string; name: string }[]): string | null {
  if (hint === 'random') return 'random'
  const h = hint.toLowerCase()
  const exact = list.find((o) => o.id === hint)
  if (exact) return exact.id
  const hit = list.find((o) => o.id.toLowerCase().includes(h) || o.name.toLowerCase().includes(h.replace(/-/g, ' ')))
  return hit?.id ?? null
}

export function buildSetup(req: Pick<LaunchRequest, 'seats' | 'tier'>, objective: string, variants?: GameVariants): GameSetup {
  const firstBot = req.seats[0] === 'human' ? 1 : 0
  const seats: SeatSetup[] = req.seats.map((kind, i) => ({
    id: SEAT_IDS[i]!, kind, name: kind === 'human' ? 'Player' : BOT_NAMES[(i - firstBot + BOT_NAMES.length) % BOT_NAMES.length]!,
    ...(kind === 'bot' ? { tier: req.tier ?? 'random' } : {}),
  }))
  const twoPlayer = seats.length === 2
  const v: GameVariants = { ...(variants ?? {}), ...(twoPlayer ? { twoPlayer: true } : {}) }
  return { seats, mainObjective: objective, ...(Object.keys(v).length ? { variants: v } : {}) }
}

export function randomSeedWord(rand: () => number = Math.random): string {
  const words = ['frost', 'ember', 'larder', 'cinder', 'static', 'hollow', 'drift', 'lantern', 'thaw', 'ration', 'bolt', 'quarry', 'salt', 'wick']
  return `${words[Math.floor(rand() * words.length)]}-${Math.floor(rand() * 900 + 100)}`
}
