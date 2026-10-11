// Web Audio manager. Buses: effects (one-shots and ambience), narrator and voices (persona lines) -> master; music -> duck -> master.
// Nothing touches Web Audio until the first click, tap or key unlocks it (so headless runs and autoplay policies are safe).
//  - volumes and mute persist (settings.ts); changes apply live,
//  - the music bus sits MUSIC_DB below the effects at equal sliders and ducks DUCK_DB under any speech,
//  - narrator lines queue and never overlap; persona lines are dropped while anyone else is speaking,
//  - throttling: a burst of one sound id becomes a few layered instances, each detuned a little,
//  - missing or undecodable files fail silently (remembered, never retried).
import { AUDIO_ASSETS, AUDIO_BY_ID, audioPath } from './manifest'
import { MusicDirector, type MusicScene } from './music'
import { loadAudioSettings, saveAudioSettings, type AudioSettings, type VolumeBus } from './settings'
import { TRIMS } from './trims'

export type Bus = 'effects' | 'narrator' | 'voices' | 'music'
export interface PlayOptions {
  /** 0..1, multiplies the sound's own trim and bus volume. */
  volume?: number
  /** Max random pitch jitter in cents (+/-). Defaults per bus; 0 disables. */
  detuneJitter?: number
  /** Start this long after the call (ms). */
  delayMs?: number
}

export const MUSIC_DB = -14
export const DUCK_DB = -6
const dbToGain = (db: number): number => Math.pow(10, db / 20)

const MAX_CONCURRENT = 4
const MIN_RETRIGGER_MS = 35
const JITTER_CENTS = 35
const DUCK_ATTACK_S = 0.12
const DUCK_RELEASE_S = 0.7
const NARRATOR_QUEUE_MAX = 3
const PERSONA_STALE_MS = 2500
const AMBIENCE_RAMP_S = 1.2

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))
const nowMs = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now())
const baseUrl = (): string => {
  try { return (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/' } catch { return '/' }
}
export const audioUrl = (path: string): string => `${baseUrl()}${path}`

interface Throttle { active: number; lastStart: number }
interface Loop { src: AudioBufferSourceNode; gain: GainNode }

/** Counters for tests and debugging (exposed as window.__audio with ?test=1). */
export interface AudioStats { decoded: string[]; failed: string[]; played: Record<string, number>; spoken: string[]; music: string[] }

export class AudioManager {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private bus: Partial<Record<Bus, GainNode>> = {}
  private duck: GainNode | null = null
  private settings: AudioSettings = loadAudioSettings()
  private listeners = new Set<(s: AudioSettings) => void>()
  private buffers = new Map<string, AudioBuffer>()
  private loading = new Map<string, Promise<AudioBuffer | null>>()
  private missing = new Set<string>()
  private throttle = new Map<string, Throttle>()
  private loops = new Map<string, Loop>()
  private ambienceLevels: Record<string, number> = {}
  private unlocked = false
  private attached = false
  private duckHold = 0
  private narratorQueue: string[] = []
  private narratorBusy = false
  private narratorEpoch = 0
  private narratorSource: AudioBufferSourceNode | null = null
  private personaBusy = false
  readonly stats: AudioStats = { decoded: [], failed: [], played: {}, spoken: [], music: [] }
  readonly music = new MusicDirector(() => (this.ctx && this.duck ? { ctx: this.ctx, bus: this.duck, urlFor: audioUrl, isUnlocked: () => this.unlocked, onTrackStart: (id: string) => { this.stats.music.push(id) } } : null))

  /** One-time listeners: the first pointer, key or touch unlocks audio. Safe to call repeatedly. */
  attachAutoUnlock(): void {
    if (this.attached || typeof window === 'undefined') return
    this.attached = true
    const handler = (): void => {
      window.removeEventListener('pointerdown', handler, true)
      window.removeEventListener('keydown', handler, true)
      window.removeEventListener('touchstart', handler, true)
      void this.unlock()
    }
    window.addEventListener('pointerdown', handler, true)
    window.addEventListener('keydown', handler, true)
    window.addEventListener('touchstart', handler, true)
    // a soft click on every button, once audio is running
    window.addEventListener('pointerdown', (e) => {
      const t = e.target as Element | null
      if (this.unlocked && t?.closest?.('button')) this.play('ui-click', { volume: 0.35 })
    })
  }

  async unlock(): Promise<void> {
    try {
      this.ensureContext()
      if (this.ctx && this.ctx.state === 'suspended') await this.ctx.resume().catch(() => undefined)
      this.unlocked = this.ctx?.state === 'running'
      if (this.unlocked) {
        this.music.resume()
        // one-shots, ambience loops and the generic narration are small: decode them now; Crossroads and persona lines load on first use
        for (const a of AUDIO_ASSETS) if (a.kind === 'sfx' || (a.kind === 'voice' && a.bus === 'narrator' && a.id.startsWith('nar-'))) void this.ensureBuffer(a.id)
        this.applyAmbience()
      }
    } catch { /* no Web Audio: stay silent */ }
  }

  private ensureContext(): void {
    if (this.ctx || typeof window === 'undefined') return
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    const ctx = new Ctor()
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.connect(ctx.destination)
    // effects go through a fast limiter so boosted quiet clips (trim up to 4x) never clip
    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -6
    limiter.knee.value = 6
    limiter.ratio.value = 20
    limiter.attack.value = 0.002
    limiter.release.value = 0.12
    limiter.connect(this.master)
    for (const b of ['effects', 'narrator', 'voices', 'music'] as const) {
      const g = ctx.createGain()
      g.connect(b === 'effects' ? limiter : this.master)
      this.bus[b] = g
    }
    this.duck = ctx.createGain()
    this.duck.connect(this.bus.music!)
    this.applyGains()
  }

  private applyGains(): void {
    if (!this.master) return
    const s = this.settings
    this.master.gain.value = s.muted ? 0 : clamp01(s.master)
    this.bus.effects!.gain.value = clamp01(s.effects)
    this.bus.narrator!.gain.value = clamp01(s.narrator)
    this.bus.voices!.gain.value = clamp01(s.voices)
    this.bus.music!.gain.value = clamp01(s.music) * dbToGain(MUSIC_DB)
  }

  /** Decode a file into memory; failures are remembered silently. */
  private ensureBuffer(id: string): Promise<AudioBuffer | null> {
    const have = this.buffers.get(id)
    if (have) return Promise.resolve(have)
    if (this.missing.has(id)) return Promise.resolve(null)
    const inflight = this.loading.get(id)
    if (inflight) return inflight
    const asset = AUDIO_BY_ID[id]
    if (!asset || asset.kind === 'music') return Promise.resolve(null)
    const p = (async () => {
      try {
        this.ensureContext()
        if (!this.ctx) return null
        const res = await fetch(audioUrl(audioPath(asset)))
        if (!res.ok) throw new Error(String(res.status))
        const type = res.headers.get('content-type') ?? ''
        if (type.includes('text/html')) throw new Error('not audio')
        const buf = await this.ctx.decodeAudioData(await res.arrayBuffer())
        this.buffers.set(id, buf)
        this.stats.decoded.push(id)
        return buf
      } catch {
        this.missing.add(id)
        this.stats.failed.push(id)
        return null
      } finally {
        this.loading.delete(id)
      }
    })()
    this.loading.set(id, p)
    return p
  }

  /** True when a spoken line would actually be heard (so the presentation may pause for it). */
  canSpeak(bus: 'narrator' | 'voices' = 'narrator'): boolean {
    const s = this.settings
    return this.unlocked && !s.muted && s.master > 0 && s[bus] > 0
  }
  isUnlocked(): boolean { return this.unlocked }

  // ---------- one-shot effects ----------
  /** Play a one-shot effect. Silent before unlock, while decoding, if the file is missing, or when throttled. */
  play(id: string, opts: PlayOptions = {}): void {
    try {
      if (opts.delayMs && opts.delayMs > 0) { const o = { ...opts }; delete o.delayMs; setTimeout(() => this.play(id, o), opts.delayMs); return }
      const asset = AUDIO_BY_ID[id]
      if (!asset || asset.kind !== 'sfx' || asset.loop || this.missing.has(id) || !this.unlocked) return
      const t = nowMs()
      const st = this.throttle.get(id) ?? { active: 0, lastStart: 0 }
      if (st.active >= MAX_CONCURRENT || t - st.lastStart < MIN_RETRIGGER_MS) return
      const buf = this.buffers.get(id)
      if (!buf) { void this.ensureBuffer(id); return }
      const ctx = this.ctx
      const dest = this.bus.effects
      if (!ctx || !dest) return
      const src = ctx.createBufferSource()
      src.buffer = buf
      const jitter = opts.detuneJitter ?? JITTER_CENTS
      if (jitter) src.detune.value = (Math.random() * 2 - 1) * jitter
      const g = ctx.createGain()
      g.gain.value = clamp01(opts.volume ?? 1) * Math.min(12, TRIMS[id] ?? 1)
      src.connect(g).connect(dest)
      st.active++
      st.lastStart = t
      this.throttle.set(id, st)
      this.stats.played[id] = (this.stats.played[id] ?? 0) + 1
      src.onended = () => { st.active = Math.max(0, st.active - 1); src.disconnect(); g.disconnect() }
      src.start()
    } catch { /* never let sound break the game */ }
  }

  // ---------- speech ----------
  /** Narrator line (queued, never overlaps) or persona line (dropped while anyone else is speaking). */
  speak(id: string, opts: { volume?: number } = {}): void {
    try {
      const asset = AUDIO_BY_ID[id]
      if (!asset || asset.kind !== 'voice' || this.missing.has(id) || !this.unlocked) return
      if (asset.bus === 'voices') this.speakPersona(id, opts.volume ?? 1)
      else {
        if (this.narratorQueue.length >= NARRATOR_QUEUE_MAX) this.narratorQueue.shift()
        this.narratorQueue.push(id)
        this.drainNarrator(opts.volume ?? 1)
      }
    } catch { /* silent */ }
  }

  /** True while the narrator is speaking or has lines waiting. */
  narratorSpeaking(): boolean { return this.narratorBusy || this.narratorQueue.length > 0 }

  /** Cut the narrator off and drop what is queued (the player skipped ahead). */
  stopNarrator(): void {
    this.narratorEpoch++
    this.narratorQueue = []
    try { this.narratorSource?.stop() } catch { /* already ended */ }
  }

  private drainNarrator(volume: number): void {
    if (this.narratorBusy) return
    const id = this.narratorQueue.shift()
    if (!id) return
    this.narratorBusy = true
    const epoch = this.narratorEpoch
    void this.ensureBuffer(id).then((buf) => {
      if (!buf || epoch !== this.narratorEpoch || !this.unlocked) { this.narratorBusy = false; this.drainNarrator(volume); return }
      this.startVoice(id, 'narrator', buf, volume, (src) => { this.narratorSource = src }, () => { this.narratorBusy = false; this.narratorSource = null; this.drainNarrator(volume) })
    })
  }

  private speakPersona(id: string, volume: number): void {
    if (this.personaBusy || this.narratorBusy) return
    this.personaBusy = true
    const asked = nowMs()
    void this.ensureBuffer(id).then((buf) => {
      if (!buf || this.narratorBusy || nowMs() - asked > PERSONA_STALE_MS || !this.unlocked) { this.personaBusy = false; return }
      this.startVoice(id, 'voices', buf, volume, () => undefined, () => { this.personaBusy = false })
    })
  }

  private startVoice(id: string, bus: 'narrator' | 'voices', buf: AudioBuffer, volume: number, onSource: (s: AudioBufferSourceNode) => void, onEnd: () => void): void {
    const ctx = this.ctx
    const dest = this.bus[bus]
    if (!ctx || !dest) { onEnd(); return }
    const src = ctx.createBufferSource()
    src.buffer = buf
    const g = ctx.createGain()
    g.gain.value = clamp01(volume) * Math.min(12, TRIMS[id] ?? 1)
    src.connect(g).connect(dest)
    this.stats.spoken.push(id)
    this.duckMusic(buf.duration)
    onSource(src)
    src.onended = () => { src.disconnect(); g.disconnect(); onEnd() }
    src.start()
  }

  /** Duck the music bus DUCK_DB for `seconds`, then release. */
  private duckMusic(seconds: number): void {
    const ctx = this.ctx
    const duck = this.duck
    if (!ctx || !duck) return
    const now = ctx.currentTime
    this.duckHold = Math.max(this.duckHold, now + DUCK_ATTACK_S + seconds)
    duck.gain.cancelScheduledValues(now)
    duck.gain.setValueAtTime(duck.gain.value, now)
    duck.gain.linearRampToValueAtTime(dbToGain(DUCK_DB), now + DUCK_ATTACK_S)
    duck.gain.setValueAtTime(dbToGain(DUCK_DB), this.duckHold)
    duck.gain.linearRampToValueAtTime(1, this.duckHold + DUCK_RELEASE_S)
  }

  // ---------- ambience ----------
  /** Levels (0..1) per ambience loop id; loops start on first use and then ramp. Missing loops stay silent. */
  setAmbience(levels: Record<string, number>): void {
    this.ambienceLevels = { ...this.ambienceLevels, ...levels }
    this.applyAmbience()
  }

  stopAmbience(): void {
    for (const id of Object.keys(this.ambienceLevels)) this.ambienceLevels[id] = 0
    this.applyAmbience()
    for (const [id, l] of this.loops) {
      this.loops.delete(id)
      setTimeout(() => { try { l.src.stop(); l.src.disconnect(); l.gain.disconnect() } catch { /* gone */ } }, (AMBIENCE_RAMP_S + 0.3) * 1000)
    }
  }

  private applyAmbience(): void {
    const ctx = this.ctx
    const dest = this.bus.effects
    if (!this.unlocked || !ctx || !dest) return
    for (const [id, level] of Object.entries(this.ambienceLevels)) {
      const target = clamp01(level) * Math.min(12, TRIMS[id] ?? 1)
      const have = this.loops.get(id)
      if (have) { have.gain.gain.cancelScheduledValues(ctx.currentTime); have.gain.gain.setTargetAtTime(target, ctx.currentTime, AMBIENCE_RAMP_S / 3); continue }
      if (level <= 0) continue
      const buf = this.buffers.get(id)
      if (!buf) { void this.ensureBuffer(id).then((b) => { if (b) this.applyAmbience() }); continue }
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.loop = true
      const gain = ctx.createGain()
      gain.gain.value = 0
      gain.gain.setTargetAtTime(target, ctx.currentTime, AMBIENCE_RAMP_S / 3)
      src.connect(gain).connect(dest)
      src.start()
      this.loops.set(id, { src, gain })
    }
  }

  // ---------- music ----------
  setMusicScene(scene: MusicScene): void { try { this.music.setScene(scene) } catch { /* silent */ } }

  // ---------- settings ----------
  getSettings(): AudioSettings { return this.settings }
  setMuted(muted: boolean): void { this.update({ ...this.settings, muted }) }
  setVolume(bus: VolumeBus, value: number): void { this.update({ ...this.settings, [bus]: clamp01(value) }) }
  private update(next: AudioSettings): void {
    this.settings = next
    saveAudioSettings(next)
    this.applyGains()
    for (const l of this.listeners) l(next)
  }
  onSettingsChange(l: (s: AudioSettings) => void): () => void { this.listeners.add(l); return () => { this.listeners.delete(l) } }
}
