// Volume and mute section for the settings popover: master, effects, narrator, voices (the bots) and music, plus mute.
import type { ReactElement } from 'react'
import { audio, initAudio } from './audio'
import type { VolumeBus } from './settings'
import { useAudioSettings } from './useAudioSettings'

const BUSES: [VolumeBus, string][] = [['master', 'Master'], ['effects', 'Effects'], ['narrator', 'Narrator'], ['voices', 'Voices'], ['music', 'Music']]

export function AudioSettingsSection(): ReactElement {
  const s = useAudioSettings()
  initAudio()
  return (
    <div className="audio-settings" data-testid="audio-settings">
      <b>Sound</b>
      {BUSES.map(([bus, label]) => (
        <label key={bus}>{label}
          <input type="range" min={0} max={100} step={1} value={Math.round(s[bus] * 100)} aria-label={`${label} volume`}
            data-testid={`sound-${bus}`} onChange={(e) => audio.setVolume(bus, Number(e.target.value) / 100)} />
        </label>
      ))}
      <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" checked={s.muted} data-testid="sound-mute" onChange={(e) => audio.setMuted(e.target.checked)} /> Mute all sound
      </label>
    </div>
  )
}
