// Objective panel (O), How to Play drawer, Settings popover and the key list (50 §3, §14, §17).
import { useMemo, type ReactElement } from 'react'
import { query, type ObjectiveProgressReport, type SeatView } from '../../engine/index'
import { ExiledCard } from '../cards/ObjectiveCards'
import { MainObjectiveCard, SecretObjectiveCard } from '../cards/ObjectiveCards'
import { nameOf, partLabel, rec } from '../data'
import { useTrueView } from '../store/hooks'
import { SPEED_PRESETS, speedName, useSettingsStore, type SpeedPreset } from '../store/settingsStore'
import { ui, useUiStore } from '../store/uiStore'

function Parts({ r }: { r: ObjectiveProgressReport }): ReactElement {
  return (
    <div data-testid={`objective-progress-${r.objectiveId}`}>
      {r.parts.map((p, i) => (
        <div key={i}>
          <div className="progress-part"><span>{partLabel(p.label)}</span><b>{p.have} of {p.need}</b></div>
          <div className="bar"><i style={{ width: `${Math.min(100, p.need > 0 ? (100 * p.have) / p.need : 0)}%` }} /></div>
        </div>
      ))}
      {r.parts.length === 0 && <div className="muted">Nothing to count yet.</div>}
      <div className="muted" style={{ marginTop: 4 }}>
        {r.complete ? 'Complete.' : 'Not complete yet.'}{r.requiresMain ? ' It only counts if the main objective is also complete.' : ''}
      </div>
    </div>
  )
}

function safeProgress(v: SeatView, id?: string): ObjectiveProgressReport | null {
  try { return query.objectiveProgress(v, id) } catch { return null }
}

export function ObjectivePanel(): ReactElement | null {
  const open = useUiStore((s) => s.objectiveOpen)
  const v = useTrueView()
  const main = useMemo(() => (v ? safeProgress(v, v.objective.id) : null), [v])
  const secretId = v?.me.secretObjectiveId ?? null
  const exiledId = v?.me.exiledObjectiveId ?? null
  const secret = useMemo(() => (v && secretId ? safeProgress(v, secretId) : null), [v, secretId])
  const exiled = useMemo(() => (v && exiledId ? safeProgress(v, exiledId) : null), [v, exiledId])
  if (!open || !v) return null
  const side = v.objective.side === 'hardcore' ? 'hardcore' : 'normal'
  return (
    <div className="drawer l panel" role="dialog" aria-label="Objectives" data-testid="objective-panel">
      <button className="btn chip x" onClick={() => ui.set({ objectiveOpen: false })} aria-label="Close">Close</button>
      <h2>Objectives</h2>
      <h3>Main objective: {nameOf(v.objective.id)}</h3>
      <div className="obj-card"><MainObjectiveCard id={v.objective.id} hardcore={side === 'hardcore'} size="lg" /></div>
      {main && <Parts r={main} />}
      {exiledId ? (
        <>
          <h3>Your exiled objective: {nameOf(exiledId)}</h3>
          <div className="obj-card"><ExiledCard id={exiledId} size="xl" /></div>
          {exiled && <Parts r={exiled} />}
        </>
      ) : secretId ? (
        <>
          <h3>Your secret objective: {nameOf(secretId)}</h3>
          <div className="obj-card"><SecretObjectiveCard id={secretId} size="xl" /></div>
          {secret && <Parts r={secret} />}
        </>
      ) : <p className="muted">You have no secret objective in this game.</p>}
    </div>
  )
}

export function HowToPlay(): ReactElement | null {
  const open = useUiStore((s) => s.howToOpen)
  if (!open) return null
  return (
    <div className="drawer r panel" role="dialog" aria-label="How to play" data-testid="howto-panel" style={{ width: 420 }}>
      <button className="btn chip x" onClick={() => ui.set({ howToOpen: false })} aria-label="Close">Close</button>
      <h2>How to play</h2>
      <p>You and your bot table-mates run one colony through a hard winter. Everyone wants the colony to win, but each of you also holds a secret goal that may pull the other way.</p>
      <h3>A round</h3>
      <ul>
        <li><b>Your turn.</b> You roll one die per survivor plus one. Spend dice to search, fight zombies, barricade a gate, clean waste or use an ability. Move each survivor once, play cards, then end your turn.</li>
        <li><b>Search</b> a location to draw an item card. You may keep it or make noise to draw another; noise attracts zombies later.</li>
        <li><b>Exposure.</b> Killing a zombie or walking outside risks the exposure die: a blank is safe, a wound or frostbite hurts, a bite can kill.</li>
        <li><b>The crisis.</b> After everyone has played, each seat secretly adds cards to the round's crisis. Matching symbols help, other cards hurt. The cards are shuffled and revealed one by one.</li>
        <li><b>The colony phase.</b> The colony eats, the waste pile is checked, the crisis resolves, then zombies arrive at every location and gate. Morale drops when things go wrong.</li>
      </ul>
      <h3>Winning and losing</h3>
      <ul>
        <li>Complete the main objective before the round track runs out, and keep morale above zero.</li>
        <li>Your secret objective must also be met to win. A betrayer works against the colony.</li>
        <li>Any seat can call a vote to exile another seat. Exiled players play for their own gain.</li>
      </ul>
      <h3>Controls</h3>
      <ul>
        <li>Click a survivor on the table to bring them to the top of your action list.</li>
        <li>Right-drag to orbit, middle-drag to pan, wheel to zoom. Keys 1 to 4 pick a camera.</li>
        <li><b>Enter</b> confirms, <b>Esc</b> goes back, <b>O</b> opens objectives, <b>[</b> and <b>]</b> fold the rails.</li>
      </ul>
      <p className="muted" style={{ fontSize: 11 }}>An unofficial fan project, not affiliated with Plaid Hat Games, Fantasy Flight Games or Asmodee. All art and text here are original.</p>
    </div>
  )
}

export function KeysHelp(): ReactElement | null {
  const open = useUiStore((s) => s.keysOpen)
  if (!open) return null
  const rows: [string, string][] = [
    ['Enter', 'Confirm the open prompt'], ['Esc', 'Go back / close a panel'], ['E', 'End turn (opens the confirm)'], ['O', 'Objectives'], ['[ and ]', 'Fold the seat and feed rails'],
    ['1 - 4', 'Camera: seat, top, colony, follow'], ['Space', 'Skip the current animation'], ['S', 'Save now'], ['?', 'This list'],
  ]
  return (
    <div className="pop panel" style={{ right: 'auto', left: '50%', transform: 'translateX(-50%)', top: 80, width: 330 }} role="dialog" aria-label="Keys" data-testid="keys-panel">
      <b>Keys</b>
      {rows.map(([k, d]) => <div key={k} className="progress-part"><kbd>{k}</kbd><span>{d}</span></div>)}
      <button className="btn" onClick={() => ui.set({ keysOpen: false })}>Close</button>
    </div>
  )
}

export function SettingsPopover(): ReactElement | null {
  const open = useUiStore((s) => s.settingsOpen)
  const s = useSettingsStore()
  if (!open) return null
  return (
    <div className="pop panel" role="dialog" aria-label="Settings" data-testid="settings-panel">
      <label>Animation speed
        <select value={speedName(s.speed)} onChange={(e) => s.set({ speed: SPEED_PRESETS[e.target.value as SpeedPreset] ?? 1 })} data-testid="settings-speed">
          <option value="instant">Instant</option><option value="fast">Fast</option><option value="normal">Normal</option><option value="slow">Slow</option>
        </select>
      </label>
      <label>Graphics
        <select value={s.graphics} onChange={(e) => s.set({ graphics: e.target.value === 'low' ? 'low' : 'high' })} data-testid="settings-graphics">
          <option value="high">High</option><option value="low">Low</option>
        </select>
      </label>
      <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" checked={s.narration} onChange={(e) => s.set({ narration: e.target.checked })} /> Narration pauses
      </label>
      <button className="btn" onClick={() => ui.set({ keysOpen: true, settingsOpen: false })}>Key list</button>
      <button className="btn" onClick={() => ui.set({ settingsOpen: false })}>Close</button>
    </div>
  )
}
