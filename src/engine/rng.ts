// FROZEN after M0: sfc32 seeded by cyrb128 (00 §11). Pure: state in, state out; never Math.random.
// Implemented in M0 (the only contract file with real bodies besides view.ts).
import type { DiceRolled, ExposureRolled } from './events'
import type { ExposureFace, ExposureReason, GameState, RngState, RollPurpose, SeatId, SurvivorId } from './types'

export function cyrb128(str: string): RngState {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)
  h1 ^= h2 ^ h3 ^ h4; h2 ^= h1; h3 ^= h1; h4 ^= h1
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0]
}

export function seedRng(seed: string): RngState {
  let s = cyrb128(seed)
  for (let i = 0; i < 15; i++) s = nextU32(s)[1] // warm-up
  return s
}

export function nextU32(s: RngState): [number, RngState] {
  let [a, b, c, d] = s
  a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0
  const t = (((a + b) | 0) + d) | 0
  d = (d + 1) | 0
  a = b ^ (b >>> 9)
  b = (c + (c << 3)) | 0
  c = (c << 21) | (c >>> 11)
  c = (c + t) | 0
  return [t >>> 0, [a >>> 0, b >>> 0, c >>> 0, d >>> 0]]
}

export function nextFloat(s: RngState): [number, RngState] {
  const [u, n] = nextU32(s)
  return [u / 4294967296, n]
}

/** Uniform integer in [1, sides]. */
export function rollDie(s: RngState, sides: number): [number, RngState] {
  const [f, n] = nextFloat(s)
  return [1 + Math.floor(f * sides), n]
}
export const rollD6 = (s: RngState): [number, RngState] => rollDie(s, 6)
export const rollD12 = (s: RngState): [number, RngState] => rollDie(s, 12)

export function rollDice(s: RngState, count: number, sides = 6): [number[], RngState] {
  const out: number[] = []
  let cur = s
  for (let i = 0; i < count; i++) { const [v, n] = rollDie(cur, sides); out.push(v); cur = n }
  return [out, cur]
}

/** Fisher–Yates on a copy; the deck order is part of the seeded stream. */
export function shuffle<T>(s: RngState, items: readonly T[]): [T[], RngState] {
  const out = [...items]
  let cur = s
  for (let i = out.length - 1; i > 0; i--) {
    const [f, n] = nextFloat(cur)
    cur = n
    const j = Math.floor(f * (i + 1))
    const tmp = out[i]!; out[i] = out[j]!; out[j] = tmp
  }
  return [out, cur]
}

// ---------- the exposure die (E.7; R p11 names the four faces, the counts are a fan-source ruling: 6 blank, 3 wound, 2 frostbite, 1 bite) ----------
export const EXPOSURE_FACES: readonly ExposureFace[] = [
  'blank', 'blank', 'blank', 'blank', 'blank', 'blank',
  'wound', 'wound', 'wound',
  'frostbite', 'frostbite',
  'bite',
] as const
export const EXPOSURE_FACE_COUNT: Readonly<Record<ExposureFace, number>> = { blank: 6, wound: 3, frostbite: 2, bite: 1 }
/** Face shown by a raw d12 value 1..12. */
export const exposureFaceOf = (raw: number): ExposureFace => EXPOSURE_FACES[Math.min(12, Math.max(1, raw)) - 1]!
export function rollExposureFace(s: RngState): [{ raw: number; face: ExposureFace }, RngState] {
  const [raw, n] = rollD12(s)
  return [{ raw, face: exposureFaceOf(raw) }, n]
}

export interface RollSpec { count: number; sides?: 6 | 12; purpose: RollPurpose; seat?: SeatId; target?: number }

/** The only way the engine rolls d6s: advances state.rng and rollSeq, returns the DiceRolled event. */
export function roll(state: GameState, spec: RollSpec): { state: GameState; event: DiceRolled } {
  const [dice, rng] = rollDice(state.rng, Math.max(1, spec.count), spec.sides ?? 6)
  const rollId = `r:${state.rollSeq + 1}`
  const event: DiceRolled = { type: 'DiceRolled', rollId, purpose: spec.purpose, seat: spec.seat, dice, total: dice.reduce((a, b) => a + b, 0), target: spec.target }
  return { state: { ...state, rng, rollSeq: state.rollSeq + 1 }, event }
}

/** The only way the engine rolls the exposure die (raw face, before survivor abilities change it). */
export function rollExposure(state: GameState, survivorId: SurvivorId, reason: ExposureReason): { state: GameState; event: ExposureRolled } {
  const [{ raw, face }, rng] = rollExposureFace(state.rng)
  const rollId = `r:${state.rollSeq + 1}`
  const event: ExposureRolled = { type: 'ExposureRolled', rollId, survivorId, reason, raw, face }
  return { state: { ...state, rng, rollSeq: state.rollSeq + 1 }, event }
}

/** Seed for out-of-engine randomness (AI, random bot): never touches state.rng, so logs replay identically. */
export function deriveSeed(...parts: (string | number)[]): RngState {
  return seedRng(parts.join('|'))
}
