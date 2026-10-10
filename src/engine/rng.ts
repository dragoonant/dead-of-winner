/**
 * FROZEN CONTRACT (M0). Seeded, serializable randomness. Spec: docs/spec/00-architecture.md §00.9.
 * - sfc32 PRNG seeded through cyrb128 string hashing; state is 4 uint32 words stored in GameState.
 * - ScriptedRng replays queued d6 / d12 / pick values for golden tests (13 §0.3).
 * - No Math.random anywhere in src/engine or src/ai (SIM-010).
 */
import type { Face, RngScript, RngState, ScriptState, Sfc32State } from './types'

export interface Rng {
  /** Uniform float in [0, 1). Scripted rngs use their fallback stream or throw. */
  float(): number
  /** Uniform integer in [0, n). The "pick" primitive: random steal, shuffles, random selectors. */
  int(n: number): number
  /** Action / effect d6: 1..6. */
  d6(): number
  /** Exposure d12: 1..12; map to a face with faceOfD12. */
  d12(): number
  /** Fisher–Yates; returns a new array, input untouched. Consumes int() once per position > 0. */
  shuffle<T>(items: readonly T[]): T[]
  /** One uniform element (int(items.length)). Throws on an empty array. */
  pick<T>(items: readonly T[]): T
  /** Serializable snapshot of the current state. */
  state(): RngState
}

/** d12 faces (10.7.1; Ruling R-D12): 1–6 blank, 7–9 wound, 10–11 frostbite, 12 bitten. */
export const D12_FACES: readonly Face[] = [
  'blank', 'blank', 'blank', 'blank', 'blank', 'blank',
  'wound', 'wound', 'wound', 'frostbite', 'frostbite', 'bitten',
]
/** Canonical d12 value for each face, used when a script lists faces. */
export const D12_VALUE_OF_FACE: Readonly<Record<Face, number>> = { blank: 1, wound: 7, frostbite: 10, bitten: 12 }

export function faceOfD12(value: number): Face {
  const f = D12_FACES[value - 1]
  if (f === undefined) throw new RangeError(`d12 value out of range: ${value}`)
  return f
}

/** cyrb128: string -> four 32-bit words. Deterministic on every JS engine. */
export function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044813)
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044813)
  h1 ^= h2 ^ h3 ^ h4
  h2 ^= h1
  h3 ^= h1
  h4 ^= h1
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0]
}

/** Stable 64-bit-ish hex hash of a string (state hashes, bundle hashes, replay checks). */
export function hashString(str: string): string {
  const [a, b] = cyrb128(str)
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0')
}

/** Normalised seed string: numbers and strings with the same text give the same stream. */
export function seedKey(seed: number | string): string {
  return typeof seed === 'number' ? `n:${seed}` : `s:${seed}`
}

/** Seed for a labelled sub-stream (bots use 'ai/<seatId>', 'ai/talk/<seatId>'; 40.1.8). */
export function deriveSeed(seed: number | string, label: string): string {
  return `${seedKey(seed)}|${label}`
}

function sfc32Initial(seed: number | string): Sfc32State {
  const s = cyrb128(seedKey(seed))
  const st: Sfc32State = { kind: 'sfc32', s }
  // Warm up: discard the first 15 outputs so near-identical seeds diverge.
  const r = new Sfc32(st)
  for (let i = 0; i < 15; i++) r.nextU32()
  return r.snapshot()
}

class Sfc32 {
  private a: number
  private b: number
  private c: number
  private d: number
  constructor(st: Sfc32State) {
    ;[this.a, this.b, this.c, this.d] = st.s
  }
  nextU32(): number {
    const t = (((this.a + this.b) | 0) + this.d) | 0
    this.d = (this.d + 1) | 0
    this.a = this.b ^ (this.b >>> 9)
    this.b = (this.c + (this.c << 3)) | 0
    this.c = (this.c << 21) | (this.c >>> 11)
    this.c = (this.c + t) | 0
    return t >>> 0
  }
  snapshot(): Sfc32State {
    return { kind: 'sfc32', s: [this.a >>> 0, this.b >>> 0, this.c >>> 0, this.d >>> 0] }
  }
}

abstract class BaseRng implements Rng {
  abstract float(): number
  abstract int(n: number): number
  abstract d6(): number
  abstract d12(): number
  abstract state(): RngState
  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice()
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(i + 1)
      const tmp = out[i] as T
      out[i] = out[j] as T
      out[j] = tmp
    }
    return out
  }
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError('pick from an empty array')
    return items[this.int(items.length)] as T
  }
}

class SeededRng extends BaseRng {
  private readonly g: Sfc32
  constructor(st: Sfc32State) {
    super()
    this.g = new Sfc32(st)
  }
  float(): number {
    return this.g.nextU32() / 4294967296
  }
  /** Unbiased bounded integer (rejection sampling). */
  int(n: number): number {
    if (!Number.isInteger(n) || n <= 0 || n > 4294967296) throw new RangeError(`int(n) needs 1..2^32, got ${n}`)
    const limit = 4294967296 - (4294967296 % n)
    for (;;) {
      const x = this.g.nextU32()
      if (x < limit) return x % n
    }
  }
  d6(): number {
    return this.int(6) + 1
  }
  d12(): number {
    return this.int(12) + 1
  }
  state(): RngState {
    return this.g.snapshot()
  }
}

/** Thrown when a scripted queue runs dry and there is no fallback stream. */
export class ScriptExhausted extends Error {
  constructor(public readonly queue: 'd6' | 'd12' | 'pick' | 'float') {
    super(`scripted rng: ${queue} queue exhausted`)
    this.name = 'ScriptExhausted'
  }
}

class ScriptedRng extends BaseRng {
  private readonly q: { d6: number[]; d12: number[]; pick: number[] }
  private readonly fb: SeededRng | null
  constructor(st: ScriptState) {
    super()
    this.q = { d6: st.d6.slice(), d12: st.d12.slice(), pick: st.pick.slice() }
    this.fb = st.fallback ? new SeededRng(st.fallback) : null
  }
  private take(queue: 'd6' | 'd12' | 'pick'): number | null {
    const v = this.q[queue].shift()
    return v === undefined ? null : v
  }
  float(): number {
    if (!this.fb) throw new ScriptExhausted('float')
    return this.fb.float()
  }
  int(n: number): number {
    const v = this.take('pick')
    if (v !== null) {
      if (!Number.isInteger(v) || v < 0 || v >= n) throw new RangeError(`scripted pick ${v} out of range 0..${n - 1}`)
      return v
    }
    if (!this.fb) throw new ScriptExhausted('pick')
    return this.fb.int(n)
  }
  d6(): number {
    const v = this.take('d6')
    if (v !== null) return v
    if (!this.fb) throw new ScriptExhausted('d6')
    return this.fb.d6()
  }
  d12(): number {
    const v = this.take('d12')
    if (v !== null) return v
    if (!this.fb) throw new ScriptExhausted('d12')
    return this.fb.d12()
  }
  state(): RngState {
    return {
      kind: 'script',
      d6: this.q.d6.slice(),
      d12: this.q.d12.slice(),
      pick: this.q.pick.slice(),
      fallback: this.fb ? (this.fb.state() as Sfc32State) : null,
    }
  }
}

/** A fresh seeded rng. Same seed -> same sequence on every machine. */
export function createRng(seed: number | string): Rng {
  return new SeededRng(sfc32Initial(seed))
}

/** Restore an rng from a snapshot (GameState.rng). */
export function rngFromState(state: RngState): Rng {
  return state.kind === 'sfc32' ? new SeededRng(state) : new ScriptedRng(state)
}

/** Scripted rng for golden tests. Faces in `d12` map through D12_VALUE_OF_FACE. */
export function scriptedRng(script: RngScript, fallbackSeed?: number | string): Rng {
  return new ScriptedRng(scriptState(script, fallbackSeed))
}

export function scriptState(script: RngScript, fallbackSeed?: number | string): ScriptState {
  for (const v of script.d6 ?? []) if (!Number.isInteger(v) || v < 1 || v > 6) throw new RangeError(`scripted d6 ${v}`)
  const d12 = (script.d12 ?? []).map((v) => (typeof v === 'number' ? v : D12_VALUE_OF_FACE[v]))
  for (const v of d12) if (!Number.isInteger(v) || v < 1 || v > 12) throw new RangeError(`scripted d12 ${v}`)
  return {
    kind: 'script',
    d6: (script.d6 ?? []).slice(),
    d12,
    pick: (script.pick ?? []).slice(),
    fallback: fallbackSeed === undefined ? null : sfc32Initial(fallbackSeed),
  }
}

/** Remaining scripted values; golden tests assert all zero at the end (13 §0.3). */
export function scriptRemaining(state: RngState): { d6: number; d12: number; pick: number } {
  return state.kind === 'script' ? { d6: state.d6.length, d12: state.d12.length, pick: state.pick.length } : { d6: 0, d12: 0, pick: 0 }
}
