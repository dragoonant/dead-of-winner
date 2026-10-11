// Top bar (50 §3): morale, rounds left, food, waste, the crisis with "cards added", zombies at the colony, first and active seat.
// Everything reads the PRESENTED view, so a number never runs ahead of its animation.
import { useMemo, type ReactElement } from 'react'
import { query } from '../../engine/index'
import { nameOf, seatNameOf } from '../data'
import { previewProps } from '../cards/preview'
import { usePresentedView } from '../store/hooks'
import { useSettingsStore } from '../store/settingsStore'
import { ui, useUiStore, type CameraPreset } from '../store/uiStore'
import { MoraleIcon, SnowIcon, SymbolIcon, ZombieIcon } from './Icons'

export function TopBar(): ReactElement | null {
  const v = usePresentedView()
  const camera = useUiStore((s) => s.camera)
  const graphics = useSettingsStore((s) => s.graphics)
  void graphics
  const crisis = useMemo(() => {
    if (!v) return null
    try { return query.crisis(v) } catch { return null }
  }, [v])
  if (!v) return null
  const colony = v.locations['colony']
  const zombies = colony ? colony.entrances.reduce((n, e) => n + e.zombies, 0) : 0
  const name = (s: string | null): string => (s ? seatNameOf(v.setup, s) : '-')
  const cams: [CameraPreset, string, string][] = [[1, '1', 'Seat view'], [2, '2', 'Top down'], [3, '3', 'Colony close'], [4, '4', 'Follow the active survivor']]
  return (
    <div className="topbar" data-testid="topbar">
      <span className="title">DEAD OF WINNER</span>
      <span className="stat" title="Morale: the game is lost at 0" data-testid="topbar-morale"><MoraleIcon /> Morale <b>{v.morale}</b></span>
      <span className="stat" title="Rounds left" data-testid="topbar-round"><SnowIcon /> Rounds <b>{v.roundsLeft}</b></span>
      <span className="stat" title="Food in the supply" data-testid="topbar-food"><SymbolIcon symbol="food" size={15} /> Food <b>{v.food}</b></span>
      <span className="stat" title="Cards in the waste pile" data-testid="topbar-waste">Waste <b>{v.waste.length}</b></span>
      <span className="stat" title="Zombies standing at the colony entrances" data-testid="topbar-zombies"><ZombieIcon /> Gates <b>{zombies}</b></span>
      <span className="stat crisis" title="This round's crisis" data-testid="topbar-crisis" {...(v.crisis.cardId ? previewProps({ kind: 'crisis', id: v.crisis.cardId }) : {})}>
        Crisis: {v.crisis.cardId ? nameOf(v.crisis.cardId) : 'none yet'}{crisis && v.crisis.cardId ? ` - cards added: ${crisis.cardsIn}` : ''}
      </span>
      <span className="grow" />
      <span className="stat seatstat" data-testid="topbar-seat">First <b>{name(v.firstSeat)}</b> Active <b>{name(v.activeSeat)}</b></span>
      <span style={{ display: 'flex', gap: 3 }}>
        {cams.map(([n, label, tip]) => <button key={n} className={`btn chip ${camera === n ? 'sel' : ''}`} title={`Camera ${n}: ${tip}`} onClick={() => ui.set({ camera: n })}>{label}</button>)}
      </span>
      <button className="btn chip" onClick={() => ui.toggle('objectiveOpen')} data-testid="topbar-objective" title="Objectives (O)">Objectives</button>
      <button className="btn chip" onClick={() => ui.toggle('howToOpen')} title="How to play">How to play</button>
      <button className="btn chip" onClick={() => ui.toggle('settingsOpen')} title="Settings" data-testid="topbar-settings">Settings</button>
    </div>
  )
}
