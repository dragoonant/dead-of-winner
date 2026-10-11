// Music director: title theme, colony loops (alternating), tension loop, victory and defeat stingers, with crossfades of at least 1.5 s.
// Tracks stream through <audio> elements (a 120 s track decoded to PCM would be ~40 MB). Loops never use el.loop: one crossfade before the
// end the director starts the next candidate (the same track, or the other colony loop), so the seam is a fade even when the file is not
// seamless. A missing file just errors and the director moves on, so a build without music is silent, never broken.
import { AUDIO_BY_ID, audioPath } from './manifest'
import { TRIMS } from './trims'

export const CROSSFADE_S = 2
export const STINGER_FADE_S = 1.5
export type MusicScene = 'none' | 'title' | 'colony' | 'tension' | 'victory' | 'defeat'

/** Track ids per scene. Colony alternates a, b, a, b... */
export const SCENE_TRACKS: Record<Exclude<MusicScene, 'none'>, readonly string[]> = {
  title: ['music-title'],
  colony: ['music-colony-a', 'music-colony-b'],
  tension: ['music-tension'],
  victory: ['music-victory'],
  defeat: ['music-defeat'],
}
const LOOPING: Record<MusicScene, boolean> = { none: false, title: true, colony: true, tension: true, victory: false, defeat: false }

interface Track { el: HTMLAudioElement; gain: GainNode; node: MediaElementAudioSourceNode; id: string; fadingOut: boolean }

export interface MusicHost { ctx: AudioContext; bus: AudioNode; urlFor(path: string): string; isUnlocked(): boolean; onTrackStart?(id: string): void }

export class MusicDirector {
  private scene: MusicScene = 'none'
  private current: Track | null = null
  private wanted: MusicScene = 'none'
  private rotation: Record<string, number> = {}
  private dead = new Set<string>()

  constructor(private host: () => MusicHost | null) {}

  getScene(): MusicScene { return this.wanted }

  /** Ask for a scene. Remembered until the audio context is unlocked. Repeating the current scene is a no-op. */
  setScene(scene: MusicScene): void {
    if (scene === this.wanted && (this.scene === scene || !this.host()?.isUnlocked())) return
    this.wanted = scene
    this.apply()
  }

  /** Called when the context becomes available/unlocked. */
  resume(): void { if (this.wanted !== this.scene) this.apply() }

  private apply(): void {
    const host = this.host()
    if (!host || !host.isUnlocked()) return
    const scene = this.wanted
    this.scene = scene
    if (scene === 'none') { this.fadeOut(this.current, CROSSFADE_S); this.current = null; return }
    this.start(this.candidates(scene), scene)
  }

  /** Candidate ids for a scene, rotating start, skipping files that failed to load. */
  private candidates(scene: Exclude<MusicScene, 'none'>): string[] {
    const live = SCENE_TRACKS[scene].filter((id) => !this.dead.has(id) && AUDIO_BY_ID[id])
    if (!live.length) return []
    const from = this.rotation[scene] ?? 0
    this.rotation[scene] = from + 1
    return Array.from({ length: live.length }, (_, i) => live[(from + i) % live.length]!)
  }

  private start(cands: string[], scene: MusicScene): void {
    const host = this.host()
    const id = cands[0]
    if (!host || !id || scene === 'none') { this.fadeOut(this.current, CROSSFADE_S); this.current = null; return }
    const { ctx } = host
    const loop = LOOPING[scene]
    const fadeS = loop ? CROSSFADE_S : STINGER_FADE_S
    const el = new Audio(host.urlFor(audioPath({ id, kind: 'music' })))
    el.crossOrigin = 'anonymous'
    el.preload = 'auto'
    const gain = ctx.createGain()
    gain.gain.value = 0
    const node = ctx.createMediaElementSource(el)
    node.connect(gain).connect(host.bus)
    const track: Track = { el, gain, node, id, fadingOut: false }

    let failed = false
    const fail = (): void => {
      if (failed) return
      failed = true
      this.dead.add(id)
      this.dispose(track)
      if (this.current === track && this.wanted === scene) {
        this.current = null
        const rest = cands.slice(1)
        if (rest.length) this.start(rest, scene)
      }
    }
    el.addEventListener('error', fail, { once: true })

    if (loop) {
      // hand over to the next candidate one crossfade before this one ends
      let handed = false
      const next = (): void => {
        if (handed || this.current !== track || this.wanted !== scene) return
        handed = true
        this.start(this.candidates(scene as Exclude<MusicScene, 'none'>), scene)
      }
      el.addEventListener('timeupdate', () => { if (el.duration > 0 && el.duration - el.currentTime <= CROSSFADE_S + 0.1) next() })
      el.addEventListener('ended', next)
    } else {
      // a stinger plays once, then the music fades out
      el.addEventListener('ended', () => { if (this.current === track) { this.fadeOut(track, 0.5); this.current = null } })
    }

    const prev = this.current
    this.current = track
    void el.play().then(() => {
      if (this.current !== track) { this.dispose(track); return }
      this.fadeOut(prev, fadeS)
      const t = ctx.currentTime
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(TRIMS[id] ?? 1, t + fadeS)
      host.onTrackStart?.(id)
    }).catch((err: unknown) => {
      if ((err as { name?: string } | null)?.name === 'NotAllowedError') {
        // autoplay refused: drop this track and let the next unlock retry the scene
        if (this.current === track) { this.current = prev; this.scene = 'none' }
        this.dispose(track)
      } else fail()
    })
  }

  private fadeOut(track: Track | null, seconds: number): void {
    const host = this.host()
    if (!track || !host || track.fadingOut) return
    track.fadingOut = true
    const t = host.ctx.currentTime
    track.gain.gain.cancelScheduledValues(t)
    track.gain.gain.setValueAtTime(track.gain.gain.value, t)
    track.gain.gain.linearRampToValueAtTime(0, t + seconds)
    setTimeout(() => this.dispose(track), seconds * 1000 + 100)
  }

  private dispose(track: Track): void {
    try { track.el.pause(); track.el.removeAttribute('src'); track.el.load(); track.node.disconnect(); track.gain.disconnect() } catch { /* already gone */ }
  }
}
