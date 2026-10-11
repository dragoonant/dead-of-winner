import { useEffect, useSyncExternalStore } from 'react'
import { audio, initAudio } from './audio'
import type { AudioSettings } from './settings'

/** React hook: live audio settings. */
export function useAudioSettings(): AudioSettings {
  return useSyncExternalStore((cb) => audio.onSettingsChange(cb), () => audio.getSettings(), () => audio.getSettings())
}

/** Title screen: hook up the first-click unlock and ask for the title theme. */
export function useTitleMusic(): void {
  useEffect(() => {
    initAudio()
    audio.setMusicScene('title')
  }, [])
}

/** Game screen: colony music and ambience while it is mounted; back to the title theme when it closes. */
export function useGameAudio(): void {
  useEffect(() => {
    initAudio()
    audio.setMusicScene('colony')
    return () => {
      audio.stopNarrator()
      audio.stopAmbience()
      audio.setMusicScene('title')
    }
  }, [])
}
