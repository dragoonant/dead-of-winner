// URL parameters and the setup a launch request builds (50 §2, §16). Pure and engine-free so the title screen stays light.
import type { AiTier, GameSetup, GameVariants, SeatKind, SeatSetup } from '../engine/types'
import { BOT_NAMES } from './data'

/** One bot's table setup: which persona plays it and how smart it is. Missing fields take the defaults below. */
export interface BotChoice { persona?: string; tier?: AiTier; name?: string }
export interface LaunchRequest {
  seats: SeatKind[]
  objective: string // a main objective id, a short name to resolve, or 'random'
  seed: string
  tier?: AiTier // every bot's tier when `bots` does not say (default normal)
  bots?: BotChoice[] // per bot, in seat order (the human excluded)
  /** Rules variants (co-op, two-player, hardcore, betrayer, player elimination, remove mature Crossroads). */
  variants?: GameVariants
  /** Continue the autosave instead of starting a new game. */
  resume?: boolean
}

export interface UrlOptions {
  tier?: AiTier
  seed?: string
  seats?: SeatKind[]
  objective?: string
  test: boolean
  fps: boolean
  speed?: number
  variants?: GameVariants
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
  const tier = q.get('tier')
  if (tier === 'random' || tier === 'normal' || tier === 'easy' || tier === 'hard') out.tier = tier
  const variants = parseVariants(q.get('variants'), q.get('mature'))
  if (variants) out.variants = variants
  const obj = q.get('objective')
  if (obj) out.objective = obj.slice(0, 80)
  const sp = q.get('speed')
  if (sp !== null && sp !== '' && Number.isFinite(Number(sp))) out.speed = Math.max(0, Math.min(8, Number(sp)))
  return out
}

/** The request the URL implies, or null when it does not skip the start screen. */
export function requestFromUrl(o: UrlOptions, randomSeed: () => string): LaunchRequest | null {
  if (!o.seats) return null
  return { seats: o.seats, objective: o.objective ?? 'random', seed: o.seed ?? randomSeed(), ...(o.tier ? { tier: o.tier } : {}), ...(o.variants ? { variants: o.variants } : {}) }
}

/** `?variants=coop,hardcore,betrayer,elimination` and `?mature=0` (leave the mature Crossroads cards out). Unknown words are ignored. */
export function parseVariants(list: string | null, mature: string | null): GameVariants | undefined {
  const v: GameVariants = {}
  for (const w of (list ?? '').split(',').map((x) => x.trim().toLowerCase())) {
    if (w === 'coop') v.coop = true
    else if (w === 'twoplayer' || w === 'two-player') v.twoPlayer = true
    else if (w === 'hardcore') v.hardcore = true
    else if (w === 'betrayer') v.betrayer = true
    else if (w === 'elimination' || w === 'playerelimination') v.playerElimination = true
  }
  if (mature === '0' || mature === 'off' || mature === 'false') v.removeMature = true
  return Object.keys(v).length ? v : undefined
}

// ---------- variants: what the start screen offers and how it checks a combination ----------
export interface VariantChoice { coop: boolean; hardcore: boolean; betrayer: boolean; playerElimination: boolean; includeMature: boolean }
export const DEFAULT_VARIANT_CHOICE: VariantChoice = { coop: false, hardcore: false, betrayer: false, playerElimination: false, includeMature: true }

export interface VariantCheck {
  /** Combinations the engine would refuse; the start screen blocks Start and says why. */
  errors: string[]
  /** What the table will actually play (two seats are the two-player game; co-op uses the hardcore side). */
  notes: string[]
  /** The variants to hand to createGame (only the flags that are on). */
  variants: GameVariants
}

/** Checks a choice for a table of `bots` bots plus the human against the engine's own setup rules (setup.ts validateSetup). Pure. */
export function checkVariants(bots: number, c: VariantChoice): VariantCheck {
  const errors: string[] = []
  const notes: string[] = []
  const seats = bots + 1
  if (bots < 1 || seats > 5) errors.push(`A table seats 2 to 5 players, you and 1 to 4 bots (this one has ${seats}).`)
  const twoPlayer = seats === 2
  const coopRules = c.coop || twoPlayer
  if (c.betrayer && coopRules) errors.push('The betrayer variant needs a competitive table: it cannot be combined with co-op or the two-player game.')
  if (twoPlayer) notes.push('Two seats play the two-player co-op game: seven starting items, keep 3 of 4 survivors, the hardcore objective side, no secret objectives and no exile.')
  else if (c.coop) notes.push('Co-op: everyone wins or loses together on the hardcore objective side, with no secret objectives and no exile.')
  if (coopRules && c.hardcore) notes.push('Co-op already uses the hardcore objective side.')
  const variants: GameVariants = {}
  if (c.coop && !twoPlayer) variants.coop = true
  if (twoPlayer) variants.twoPlayer = true
  if (c.hardcore && !coopRules) variants.hardcore = true
  if (c.betrayer && !coopRules) variants.betrayer = true
  if (c.playerElimination) variants.playerElimination = true
  if (!c.includeMature) variants.removeMature = true
  return { errors, notes, variants }
}

/** The start screen's choice for a set of variants read from the URL. */
export function choiceFromVariants(v: GameVariants | undefined): VariantChoice {
  return { coop: !!v?.coop, hardcore: !!v?.hardcore, betrayer: !!v?.betrayer, playerElimination: !!v?.playerElimination, includeMature: !v?.removeMature }
}

// ---------- AI tiers ----------
export interface TierInfo { id: AiTier; label: string; blurb: string }
export const TIER_INFO: Record<AiTier, TierInfo> = {
  easy: { id: 'easy', label: 'Easy', blurb: 'Plays loosely: makes mistakes, helps little with food and only accuses after an attack.' },
  normal: { id: 'normal', label: 'Normal', blurb: 'Plays the colony sensibly and keeps a suspicion ledger.' },
  hard: { id: 'hard', label: 'Hard', blurb: 'Plays tight: tracks what the others can hold, looks two moves ahead and calls votes sooner.' },
  random: { id: 'random', label: 'Random (chaos)', blurb: 'Picks any legal move. Useful for comparison.' },
}
/** What the start screen offers when src/ai does not say which tiers it has: the two that always exist. */
export const FALLBACK_TIERS: readonly AiTier[] = ['normal', 'random']
const TIER_ORDER: readonly AiTier[] = ['easy', 'normal', 'hard', 'random']

/** The tiers an AI module offers, read from whichever list it exports (`AI_TIERS`, `TIERS`, ...); the fallback when it exports none. Normal is always kept. */
export function tiersFromModule(mod: unknown): TierInfo[] {
  const m = (mod && typeof mod === 'object' ? mod : {}) as Record<string, unknown>
  const raw = ['AI_TIERS', 'AI_TIER_IDS', 'TIERS', 'TIER_LIST', 'tiers'].map((k) => m[k]).find((x) => Array.isArray(x)) as unknown[] | undefined
  const ids = new Set<AiTier>()
  for (const item of raw ?? []) {
    const id = typeof item === 'string' ? item : item && typeof item === 'object' ? ((item as { id?: unknown; tier?: unknown }).id ?? (item as { tier?: unknown }).tier) : null
    if (typeof id === 'string' && id in TIER_INFO) ids.add(id as AiTier)
  }
  if (ids.size === 0) for (const t of FALLBACK_TIERS) ids.add(t)
  ids.add('normal')
  return TIER_ORDER.filter((t) => ids.has(t)).map((t) => TIER_INFO[t])
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

/** The three M4 personas in seat order (ids and names mirror src/data/personas; a test keeps them in step). */
export const DEFAULT_PERSONAS: { id: string; name: string }[] = [
  { id: 'ps.quartermaster', name: 'Vera Lindqvist' }, { id: 'ps.optimist', name: 'Teddy Marchbanks' }, { id: 'ps.hardcase', name: 'Ruth Castellano' },
]

export function buildSetup(req: Pick<LaunchRequest, 'seats' | 'tier' | 'bots'> & { variants?: GameVariants }, objective: string, variants: GameVariants | undefined = req.variants): GameSetup {
  let botIndex = -1
  const seats: SeatSetup[] = req.seats.map((kind, i) => {
    if (kind === 'human') return { id: SEAT_IDS[i]!, kind, name: 'Player' }
    botIndex++
    const choice = req.bots?.[botIndex]
    const fallback = DEFAULT_PERSONAS[botIndex % DEFAULT_PERSONAS.length]!
    const persona = choice?.persona ?? fallback.id
    const name = choice?.name ?? DEFAULT_PERSONAS.find((p) => p.id === persona)?.name ?? BOT_NAMES[botIndex % BOT_NAMES.length]!
    return { id: SEAT_IDS[i]!, kind, name, persona, tier: choice?.tier ?? req.tier ?? 'normal' }
  })
  const twoPlayer = seats.length === 2
  const v: GameVariants = { ...(variants ?? {}), ...(twoPlayer ? { twoPlayer: true } : {}) }
  return { seats, mainObjective: objective, ...(Object.keys(v).length ? { variants: v } : {}) }
}

export function randomSeedWord(rand: () => number = Math.random): string {
  const words = ['frost', 'ember', 'larder', 'cinder', 'static', 'hollow', 'drift', 'lantern', 'thaw', 'ration', 'bolt', 'quarry', 'salt', 'wick']
  return `${words[Math.floor(rand() * words.length)]}-${Math.floor(rand() * 900 + 100)}`
}
