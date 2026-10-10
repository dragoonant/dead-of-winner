// Start screen (50 §2): one human plus 1-4 bots, the main objective (or random), animation speed, a seed, Start and Continue.
// It deliberately imports no engine code: the data chunk loads in the background for the objective list, the engine loads with the game.
import { useEffect, useState, type ReactElement } from 'react'
import { BOT_NAMES, mainObjectives, setClientBundle, type MainObjectiveInfo } from '../data'
import { loadClientBundle } from '../dataLoad'
import { randomSeedWord, type LaunchRequest } from '../launch'
import { SPEED_PRESETS, speedName, useSettingsStore, type SpeedPreset } from '../store/settingsStore'
import { peekAutosave } from '../store/savePeek'
import { SEAT_COLOURS } from '../table/seats'
import './hud.css'

export function StartScreen({ onStart, error }: { onStart: (req: LaunchRequest) => void; error?: string | null }): ReactElement {
  const [bots, setBots] = useState(3)
  const [objective, setObjective] = useState<string>('random')
  const [objectives, setObjectives] = useState<MainObjectiveInfo[]>([])
  const [dataError, setDataError] = useState<string | null>(null)
  const [seed, setSeed] = useState(() => randomSeedWord())
  const speed = useSettingsStore((s) => s.speed)
  const set = useSettingsStore((s) => s.set)
  const save = peekAutosave()

  useEffect(() => {
    let alive = true
    loadClientBundle().then((b) => { if (alive) { setClientBundle(b); setObjectives(mainObjectives(b)) } }, (e: Error) => { if (alive) setDataError(e.message) })
    return () => { alive = false }
  }, [])

  const start = (): void => onStart({ seats: ['human', ...Array.from({ length: bots }, () => 'bot' as const)], objective, seed: seed.trim() || randomSeedWord() })
  return (
    <div className="start" data-testid="start-screen">
      <div className="start-card panel">
        <h1>Dead of Winner</h1>
        <div className="sub">A colony of AI survivors, one human at the table.</div>
        <div className="grid2">
          <div>
            <h2>Seats (clockwise)</h2>
            <div className="seat-row" data-testid="setup-seat-0"><span className="dot" style={{ background: SEAT_COLOURS[0] }} /><span className="grow"><b>You</b> <span className="muted">(human)</span></span></div>
            {Array.from({ length: bots }, (_v, i) => (
              <div className="seat-row" key={i} data-testid={`setup-seat-${i + 1}`}>
                <span className="dot" style={{ background: SEAT_COLOURS[(i + 1) % SEAT_COLOURS.length] }} />
                <span className="grow">{BOT_NAMES[i % BOT_NAMES.length]} <span className="muted">(bot)</span></span>
                {bots > 1 && i === bots - 1 && <button className="btn chip" aria-label="Remove this bot" onClick={() => setBots(bots - 1)}>Remove</button>}
              </div>
            ))}
            {bots < 4 && <button className="btn chip" data-testid="setup-add-bot" onClick={() => setBots(bots + 1)}>Add a bot</button>}
            <h2 style={{ marginTop: 12 }}>Animation speed</h2>
            <select value={speedName(speed)} onChange={(e) => set({ speed: SPEED_PRESETS[e.target.value as SpeedPreset] ?? 1 })} data-testid="setup-speed">
              <option value="instant">Instant</option><option value="fast">Fast</option><option value="normal">Normal</option><option value="slow">Slow</option>
            </select>
            <h2 style={{ marginTop: 12 }}>Seed</h2>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="text" value={seed} onChange={(e) => setSeed(e.target.value)} aria-label="Seed" data-testid="setup-seed" style={{ flex: 1, minWidth: 0 }} />
              <button className="btn chip" onClick={() => setSeed(randomSeedWord())}>New</button>
            </div>
          </div>
          <div>
            <h2>Main objective</h2>
            <div className="obj-list" data-testid="setup-objectives">
              <button className={`obj ${objective === 'random' ? 'sel' : ''}`} onClick={() => setObjective('random')} data-testid="setup-objective-random">Random</button>
              {objectives.map((o) => (
                <button key={o.id} className={`obj ${objective === o.id ? 'sel' : ''}`} onClick={() => setObjective(o.id)} data-testid={`setup-objective-${o.id}`} title={o.blurb}>
                  {o.name}<span className="t">{o.time}</span>
                </button>
              ))}
              {objectives.length === 0 && !dataError && <span className="muted">Loading the card data...</span>}
            </div>
            {dataError && <div className="error">{dataError}</div>}
          </div>
        </div>
        <div className="go">
          <button className="btn primary big" onClick={start} data-testid="setup-start">Start</button>
          {save && (
            <button className="btn big" data-testid="setup-continue" onClick={() => onStart({ seats: [], objective: 'random', seed: '', resume: true })}>
              Continue (round {save.round})
            </button>
          )}
          <span className="grow" />
        </div>
        {error && <div className="error" data-testid="setup-error">{error}</div>}
        <div className="fine">An unofficial fan project. Not affiliated with Plaid Hat Games, Fantasy Flight Games or Asmodee.</div>
      </div>
    </div>
  )
}
