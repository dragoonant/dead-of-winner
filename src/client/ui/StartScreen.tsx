// Start screen (50 §2): one human plus 1-4 bots, the main objective (or random), animation speed, a seed, Start and Continue.
// It deliberately imports no engine code: the data chunk loads in the background for the objective list, the engine loads with the game.
import { useEffect, useState, type CSSProperties, type ReactElement } from 'react'
import { BOT_NAMES, mainObjectives, setClientBundle, type MainObjectiveInfo } from '../data'
import type { AiTier } from '../../engine/types'
import { useTitleMusic } from '../audio/useAudioSettings'
import { loadClientBundle } from '../dataLoad'
import { DEFAULT_PERSONAS, randomSeedWord, type BotChoice, type LaunchRequest } from '../launch'
import { SPEED_PRESETS, speedName, useSettingsStore, type SpeedPreset } from '../store/settingsStore'
import { peekAutosave } from '../store/savePeek'
import { SEAT_COLOURS } from '../table/seats'
import { titleCandidates, useArt } from '../cards/art'
import './hud.css'

interface PersonaInfo { id: string; name: string; blurb: string }

export function StartScreen({ onStart, error }: { onStart: (req: LaunchRequest) => void; error?: string | null }): ReactElement {
  const [bots, setBots] = useState(3)
  const [personas, setPersonas] = useState<PersonaInfo[]>(DEFAULT_PERSONAS.map((p) => ({ ...p, blurb: '' })))
  // per bot: the persona id and the difficulty; distinct personas by default, Normal everywhere
  const [cfg, setCfg] = useState<{ persona: string; tier: AiTier }[]>(() => Array.from({ length: 4 }, (_v, i) => ({ persona: DEFAULT_PERSONAS[i % DEFAULT_PERSONAS.length]!.id, tier: 'normal' as AiTier })))
  const [objective, setObjective] = useState<string>('random')
  const [objectives, setObjectives] = useState<MainObjectiveInfo[]>([])
  const [dataError, setDataError] = useState<string | null>(null)
  const [seed, setSeed] = useState(() => randomSeedWord())
  const speed = useSettingsStore((s) => s.speed)
  const set = useSettingsStore((s) => s.set)
  const save = peekAutosave()
  const titleArt = useArt(titleCandidates())
  useTitleMusic()

  useEffect(() => {
    let alive = true
    loadClientBundle().then((b) => {
      if (!alive) return
      setClientBundle(b)
      setObjectives(mainObjectives(b))
      const ps = b.records.personas.map((p) => ({ id: p.id, name: p.name, blurb: p.blurb }))
      if (ps.length) setPersonas(ps)
    }, (e: Error) => { if (alive) setDataError(e.message) })
    return () => { alive = false }
  }, [])

  const setBot = (i: number, patch: Partial<{ persona: string; tier: AiTier }>): void => setCfg((c) => c.map((x, k) => (k === i ? { ...x, ...patch } : x)))
  const start = (): void => {
    const choices: BotChoice[] = cfg.slice(0, bots).map((c) => ({ persona: c.persona, tier: c.tier, name: personas.find((p) => p.id === c.persona)?.name }))
    onStart({ seats: ['human', ...Array.from({ length: bots }, () => 'bot' as const)], objective, seed: seed.trim() || randomSeedWord(), bots: choices })
  }
  return (
    <div className="start" data-testid="start-screen" data-title-art={titleArt ? 'asset' : 'generated'} style={titleArt ? ({ ['--title-img' as string]: `url(${titleArt})` } as CSSProperties) : undefined}>
      <div className="start-card panel">
        <h1>Dead of Winner</h1>
        <div className="sub">A colony of AI survivors, one human at the table.</div>
        <div className="grid2">
          <div>
            <h2>Seats (clockwise)</h2>
            <div className="seat-row" data-testid="setup-seat-0"><span className="dot" style={{ background: SEAT_COLOURS[0] }} /><span className="grow"><b>You</b> <span className="muted">(human)</span></span></div>
            {Array.from({ length: bots }, (_v, i) => (
              <div key={i}>
                <div className="seat-row" data-testid={`setup-seat-${i + 1}`}>
                  <span className="dot" style={{ background: SEAT_COLOURS[(i + 1) % SEAT_COLOURS.length] }} />
                  <span className="grow">{personas.find((p) => p.id === cfg[i]!.persona)?.name ?? BOT_NAMES[i % BOT_NAMES.length]} <span className="muted">(bot)</span></span>
                  {bots > 1 && i === bots - 1 && <button className="btn chip" aria-label="Remove this bot" onClick={() => setBots(bots - 1)}>Remove</button>}
                </div>
                <div className="bot-cfg">
                  <select aria-label={`Persona for bot ${i + 1}`} value={cfg[i]!.persona} onChange={(e) => setBot(i, { persona: e.target.value })} data-testid={`setup-persona-${i + 1}`} title={personas.find((p) => p.id === cfg[i]!.persona)?.blurb}>
                    {personas.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <select aria-label={`Difficulty for bot ${i + 1}`} value={cfg[i]!.tier} onChange={(e) => setBot(i, { tier: e.target.value as AiTier })} data-testid={`setup-tier-${i + 1}`}>
                    <option value="normal">Normal</option><option value="random">Random (chaos)</option>
                  </select>
                </div>
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
