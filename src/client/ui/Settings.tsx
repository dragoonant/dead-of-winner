// Settings popover (50 §14): animation speed, graphics, seat colours, narration, rails, sound, tutorial tips.
import type { ReactElement } from 'react'
import { AudioSettingsSection } from '../audio/AudioSettings'
import { PALETTES, SEAT_MARKS } from '../table/seats'
import { PALETTE_IDS, SPEED_PRESETS, speedName, useSettingsStore, type PaletteId, type SpeedPreset } from '../store/settingsStore'
import { ui, useUiStore } from '../store/uiStore'
import { TIPS } from './tipsModel'

export function Swatches({ palette }: { palette: PaletteId }): ReactElement {
  const p = PALETTES[palette]
  return (
    <span className="swatches" data-testid={`swatches-${palette}`} aria-hidden="true">
      {p.colours.map((c, i) => <i key={c} style={{ background: c }}>{palette === 'cbsafe' ? SEAT_MARKS[i] : ''}</i>)}
    </span>
  )
}

export function SettingsPopover(): ReactElement | null {
  const open = useUiStore((s) => s.settingsOpen)
  const s = useSettingsStore()
  if (!open) return null
  const seen = TIPS.filter((t) => s.tipsSeen.includes(t.id)).length
  return (
    <div className="pop settings panel" role="dialog" aria-label="Settings" data-testid="settings-panel">
      <h2>Settings</h2>
      <label>Animation speed
        <select value={speedName(s.speed)} onChange={(e) => s.set({ speed: SPEED_PRESETS[e.target.value as SpeedPreset] ?? 1 })} data-testid="settings-speed">
          <option value="instant">Instant</option><option value="fast">Fast</option><option value="normal">Normal</option><option value="slow">Slow</option>
        </select>
      </label>
      <label>Graphics
        <select value={s.graphics} onChange={(e) => s.set({ graphics: e.target.value === 'low' ? 'low' : 'high' })} data-testid="settings-graphics">
          <option value="high">High</option><option value="low">Low</option>
        </select>
        <span className="hint">{s.graphics === 'low' ? 'Low: no snow or particles, no shadows, steady firelight. Lighter on weak machines.' : 'High: falling snow, flickering firelight, shadows.'}</span>
      </label>
      <label>Seat colours
        <select value={s.palette} onChange={(e) => s.set({ palette: e.target.value as PaletteId })} data-testid="settings-palette">
          {PALETTE_IDS.map((id) => <option key={id} value={id}>{PALETTES[id].label}</option>)}
        </select>
        <Swatches palette={s.palette} />
        {s.palette === 'cbsafe' && <span className="hint">Distinct for the common kinds of colour blindness; each seat also gets a shape mark.</span>}
      </label>
      <label className="check"><input type="checkbox" checked={s.narration} onChange={(e) => s.set({ narration: e.target.checked })} data-testid="settings-narration" /> Narration (the table pauses while the narrator speaks)</label>
      <fieldset className="rails">
        <legend>Rails</legend>
        <label className="check"><input type="checkbox" checked={!s.leftCollapsed} onChange={(e) => s.set({ leftCollapsed: !e.target.checked })} data-testid="settings-left-rail" /> Seat rail <kbd>[</kbd></label>
        <label className="check"><input type="checkbox" checked={!s.rightCollapsed} onChange={(e) => s.set({ rightCollapsed: !e.target.checked })} data-testid="settings-right-rail" /> Event feed <kbd>]</kbd></label>
      </fieldset>
      <AudioSettingsSection />
      <fieldset className="rails">
        <legend>Tutorial tips</legend>
        <label className="check"><input type="checkbox" checked={s.tips} onChange={(e) => s.set({ tips: e.target.checked })} data-testid="settings-tips" /> Show short tips the first time something comes up</label>
        <button className="btn" data-testid="settings-replay-tips" onClick={() => s.set({ tipsSeen: [], tips: true })}>Replay tutorial tips ({seen} of {TIPS.length} seen)</button>
      </fieldset>
      <div className="row">
        <button className="btn" onClick={() => ui.set({ keysOpen: true, settingsOpen: false })}>Key list</button>
        <button className="btn" onClick={() => ui.set({ settingsOpen: false })}>Close</button>
      </div>
    </div>
  )
}
