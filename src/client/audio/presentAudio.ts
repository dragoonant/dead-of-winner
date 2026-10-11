// The presentation director's audio hook: for each beat it turns the (redacted) events into sounds, narration, music scenes and
// ambience, and tells the director how long the beat must be held for the narrator.
//   const a = prepareBeatAudio(events, state, viewer, { silent })   // before the beat starts
//   duration = Math.max(duration, a.holdMs)
//   a.play()                                                         // when the beat starts
// Everything here is a no-op until the first click unlocks Web Audio, so node tests and headless runs stay silent.
import type { GameEvent, GameState } from '../../engine/index'
import { useSettingsStore } from '../store/settingsStore'
import { audio, initAudio } from './audio'
import { ambienceLevels, newSoundMemo, planEvent, type EventSound, type NarrationLine } from './eventSounds'
import { DURATIONS } from './trims'

/** Narration slows the game, so it only speaks at normal and slow animation speed; fast and instant play effects only. */
export const MAX_NARRATION_SPEED = 1
const HOLD_PAD_S = 0.3
const HOLD_CAP_MS = 9000
const HOLD_CAP_CROSSROADS_MS = 30000
const MAX_SOUNDS_PER_BEAT = 6
const FALLBACK_LINE_S = 3

let memo = newSoundMemo()
/** A new game or a load starts with fresh once-per-round flags. */
export function resetPresentationAudio(): void {
  memo = newSoundMemo()
  stopPresentationAudio()
}

/** The player skipped ahead: cut the narrator off. */
export function stopPresentationAudio(): void {
  try { audio.stopNarrator() } catch { /* silent */ }
}

export interface BeatAudio { holdMs: number; play(): void }
const SILENT: BeatAudio = { holdMs: 0, play: () => undefined }

function narrationAllowed(): boolean {
  const s = useSettingsStore.getState()
  return s.narration && s.speed > 0 && s.speed <= MAX_NARRATION_SPEED
}

const lineSeconds = (id: string): number => DURATIONS[id] ?? FALLBACK_LINE_S

export function prepareBeatAudio(events: readonly GameEvent[], state: GameState, viewer: string, opts: { silent?: boolean } = {}): BeatAudio {
  if (opts.silent || events.length === 0) return SILENT
  try {
    initAudio()
    const sounds: EventSound[] = []
    const lines: NarrationLine[] = []
    let music: ReturnType<typeof planEvent>['music']
    for (const ev of events) {
      const p = planEvent(ev, { viewer, state }, memo)
      for (const s of p.sounds) if (!sounds.some((x) => x.id === s.id && (x.delayMs ?? 0) === (s.delayMs ?? 0))) sounds.push(s)
      lines.push(...p.narration)
      if (p.music) music = p.music
    }
    const speak = narrationAllowed()
    const spoken = speak ? lines : []
    let holdMs = 0
    if (speak && audio.canSpeak('narrator')) {
      const held = spoken.filter((l) => l.hold)
      holdMs = held.reduce((n, l) => n + (lineSeconds(l.id) + HOLD_PAD_S) * 1000, 0)
      const crossroads = held.some((l) => l.id.startsWith('vo-xr-'))
      holdMs = Math.min(holdMs, crossroads ? HOLD_CAP_CROSSROADS_MS : HOLD_CAP_MS)
    }
    return {
      holdMs,
      play() {
        try {
          for (const s of sounds.slice(0, MAX_SOUNDS_PER_BEAT)) audio.play(s.id, { ...(s.volume !== undefined ? { volume: s.volume } : {}), ...(s.delayMs ? { delayMs: s.delayMs } : {}) })
          for (const l of spoken) audio.speak(l.id)
          if (music) audio.setMusicScene(music)
          audio.setAmbience(ambienceLevels(state))
        } catch { /* never let sound break the game */ }
      },
    }
  } catch {
    return SILENT
  }
}
