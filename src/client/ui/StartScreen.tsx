// Start screen (50 §2): one human plus 1-4 bots (persona and difficulty each), the main objective (or random), the rules variants, animation
// speed, a seed, Start and Continue. It deliberately imports no engine code: the data chunk loads in the background for the objective list
// and the AI module (a dynamic import) tells it which difficulty tiers exist; the engine loads with the game.
import { useEffect, useMemo, useState, type CSSProperties, type ReactElement } from 'react'
import { BOT_NAMES, mainObjectives, setClientBundle, type MainObjectiveInfo } from '../data'
import type { AiTier } from '../../engine/types'
import { useTitleMusic } from '../audio/useAudioSettings'
import { loadClientBundle } from '../dataLoad'
import {
  DEFAULT_PERSONAS, DEFAULT_VARIANT_CHOICE, FALLBACK_TIERS, TIER_INFO, checkVariants, choiceFromVariants, parseUrl, randomSeedWord, tiersFromModule,
  type BotChoice, type LaunchRequest, type TierInfo, type VariantChoice,
} from '../launch'
import { SPEED_PRESETS, speedName, useSettingsStore, type SpeedPreset } from '../store/settingsStore'
import { peekAutosave } from '../store/savePeek'
import { seatColourAt, usePalette } from '../table/seats'
import { titleCandidates, useArt } from '../cards/art'
import { MainObjectiveCard, ObjectiveCardBack } from '../cards/ObjectiveCards'
import { previewProps } from '../cards/preview'
import '../cards/cards.css'
import './hud.css'

interface PersonaInfo { id: string; name: string; blurb: string }

const MAX_BOTS = 4

/** The selected main objective as a card: its printed face for the chosen side, or the face-down back for "Random". Click to read it larger. */
function ObjectiveCardPanel({ objective, hardcore, count }: { objective: string; hardcore: boolean; count: number }): ReactElement {
  const [open, setOpen] = useState(false)
  const random = objective === 'random'
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  return (
    <div className="obj-card-view" data-testid="setup-objective-card" data-objective={objective} data-side={random ? 'back' : hardcore ? 'hardcore' : 'normal'}>
      {random ? (
        <>
          <ObjectiveCardBack size="lg" />
          <div className="obj-card-cap muted">{count ? `One of the ${count} main objectives.` : 'One of the main objectives.'}</div>
        </>
      ) : (
        <>
          <button className="obj-card-btn" onClick={() => setOpen(true)} aria-label="Read this objective card larger" data-testid="setup-objective-card-open">
            <MainObjectiveCard id={objective} hardcore={hardcore} size="lg" />
          </button>
          <div className="obj-card-cap muted">{hardcore ? 'Hardcore side' : 'Normal side'} · click to enlarge</div>
        </>
      )}
      {open && !random && (
        <div className="obj-modal" role="dialog" aria-modal="true" aria-label="Main objective card" data-testid="setup-objective-modal" onClick={() => setOpen(false)}>
          <button className="obj-modal-card" onClick={() => setOpen(false)} aria-label="Close">
            <MainObjectiveCard id={objective} hardcore={hardcore} size="xl" />
          </button>
        </div>
      )}
    </div>
  )
}

function VariantRow({ id, label, hint, checked, disabled, onChange }: { id: string; label: string; hint: string; checked: boolean; disabled?: boolean; onChange: (on: boolean) => void }): ReactElement {
  return (
    <label className={`variant ${disabled ? 'off' : ''}`} title={hint}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} data-testid={`setup-variant-${id}`} />
      <span><b>{label}</b><span className="hint">{hint}</span></span>
    </label>
  )
}

export function StartScreen({ onStart, error }: { onStart: (req: LaunchRequest) => void; error?: string | null }): ReactElement {
  const urlVariants = useMemo(() => parseUrl(typeof location !== 'undefined' ? location.search : '').variants, [])
  const [bots, setBots] = useState(3)
  const [personas, setPersonas] = useState<PersonaInfo[]>(DEFAULT_PERSONAS.map((p) => ({ ...p, blurb: '' })))
  // per bot: the persona id and the difficulty; distinct personas by default, Normal everywhere
  const [cfg, setCfg] = useState<{ persona: string; tier: AiTier }[]>(() => Array.from({ length: MAX_BOTS }, (_v, i) => ({ persona: DEFAULT_PERSONAS[i % DEFAULT_PERSONAS.length]!.id, tier: 'normal' as AiTier })))
  const [tiers, setTiers] = useState<TierInfo[]>(() => FALLBACK_TIERS.map((t) => TIER_INFO[t]))
  const [objective, setObjective] = useState<string>('random')
  const [objectives, setObjectives] = useState<MainObjectiveInfo[]>([])
  const [matureCards, setMatureCards] = useState<number | null>(null)
  const [cardShown, setCardShown] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)
  const [seed, setSeed] = useState(() => randomSeedWord())
  const [choice, setChoice] = useState<VariantChoice>(() => ({ ...DEFAULT_VARIANT_CHOICE, ...choiceFromVariants(urlVariants) }))
  const speed = useSettingsStore((s) => s.speed)
  const set = useSettingsStore((s) => s.set)
  const palette = usePalette()
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
      setMatureCards(b.records.crossroads.filter((c) => (c as { mature?: boolean }).mature).length)
    }, (e: Error) => { if (alive) setDataError(e.message) })
    // the difficulty tiers the AI offers (the module is already in the engine chunk the data load fetches); a failure keeps the fallback list
    import('../../ai/index').then((m) => { if (alive) setTiers(tiersFromModule(m)) }, () => { /* keep the fallback tiers */ })
    return () => { alive = false }
  }, [])

  const twoPlayer = bots === 1
  const coopRules = choice.coop || twoPlayer
  const check = checkVariants(bots, choice)
  const setBot = (i: number, patch: Partial<{ persona: string; tier: AiTier }>): void => setCfg((c) => c.map((x, k) => (k === i ? { ...x, ...patch } : x)))
  const setVariant = (patch: Partial<VariantChoice>): void => setChoice((c) => ({ ...c, ...patch }))
  const tierIds = tiers.map((t) => t.id)
  const start = (): void => {
    if (check.errors.length) return
    const choices: BotChoice[] = cfg.slice(0, bots).map((c) => ({ persona: c.persona, tier: tierIds.includes(c.tier) ? c.tier : 'normal', name: personas.find((p) => p.id === c.persona)?.name }))
    onStart({ seats: ['human', ...Array.from({ length: bots }, () => 'bot' as const)], objective, seed: seed.trim() || randomSeedWord(), bots: choices, ...(Object.keys(check.variants).length ? { variants: check.variants } : {}) })
  }
  return (
    <div className="start" data-testid="start-screen" data-title-art={titleArt ? 'asset' : 'generated'} style={titleArt ? ({ ['--title-img' as string]: `url(${titleArt})` } as CSSProperties) : undefined}>
      <div className="start-card panel">
        <h1>Dead of Winner</h1>
        <div className="sub">A colony of AI survivors, one human at the table.</div>
        <div className="grid3">
          <div>
            <h2>Seats (clockwise)</h2>
            <div className="seat-row" data-testid="setup-seat-0"><span className="dot" style={{ background: seatColourAt(0, palette) }} /><span className="grow"><b>You</b> <span className="muted">(human)</span></span></div>
            {Array.from({ length: bots }, (_v, i) => {
              const persona = personas.find((p) => p.id === cfg[i]!.persona)
              const tier = TIER_INFO[cfg[i]!.tier]
              return (
                <div key={i}>
                  <div className="seat-row" data-testid={`setup-seat-${i + 1}`}>
                    <span className="dot" style={{ background: seatColourAt(i + 1, palette) }} />
                    <span className="grow">{persona?.name ?? BOT_NAMES[i % BOT_NAMES.length]} <span className="muted">(bot)</span></span>
                    {bots > 1 && i === bots - 1 && <button className="btn chip" aria-label="Remove this bot" onClick={() => setBots(bots - 1)}>Remove</button>}
                  </div>
                  <div className="bot-cfg">
                    <select aria-label={`Persona for bot ${i + 1}`} value={cfg[i]!.persona} onChange={(e) => setBot(i, { persona: e.target.value })} data-testid={`setup-persona-${i + 1}`} title={persona?.blurb}>
                      {personas.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <select aria-label={`Difficulty for bot ${i + 1}`} value={tierIds.includes(cfg[i]!.tier) ? cfg[i]!.tier : 'normal'} onChange={(e) => setBot(i, { tier: e.target.value as AiTier })} data-testid={`setup-tier-${i + 1}`} title={tier?.blurb}>
                      {tiers.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                  </div>
                  {persona?.blurb && <div className="bot-blurb muted" data-testid={`setup-blurb-${i + 1}`}>{persona.blurb}</div>}
                </div>
              )
            })}
            {bots < MAX_BOTS && <button className="btn chip" data-testid="setup-add-bot" onClick={() => setBots(bots + 1)}>Add a bot</button>}
            <h2 style={{ marginTop: 10 }}>Animation speed</h2>
            <select value={speedName(speed)} onChange={(e) => set({ speed: SPEED_PRESETS[e.target.value as SpeedPreset] ?? 1 })} data-testid="setup-speed">
              <option value="instant">Instant</option><option value="fast">Fast</option><option value="normal">Normal</option><option value="slow">Slow</option>
            </select>
            <h2 style={{ marginTop: 10 }}>Seed</h2>
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
                <button key={o.id} className={`obj ${objective === o.id ? 'sel' : ''}`} onClick={() => setObjective(o.id)} data-testid={`setup-objective-${o.id}`} title={o.blurb} {...previewProps({ kind: 'main', id: o.id, hardcore: choice.hardcore || coopRules })}>
                  {o.name}<span className="t">{o.time}</span>
                </button>
              ))}
              {objectives.length === 0 && !dataError && <span className="muted">Loading the card data...</span>}
            </div>
            {dataError && <div className="error">{dataError}</div>}
          </div>
          <div className="obj-card-col">
            <button className="btn chip obj-card-toggle" aria-expanded={cardShown} onClick={() => setCardShown(!cardShown)} data-testid="setup-objective-card-toggle">
              {cardShown ? 'Hide' : 'Show'} the objective card
            </button>
            <div className={`obj-card-panel ${cardShown ? 'open' : ''}`}>
              <ObjectiveCardPanel objective={objective} hardcore={choice.hardcore || coopRules} count={objectives.length} />
            </div>
          </div>
          <div data-testid="setup-variants">
            <h2>Variants</h2>
            <VariantRow id="coop" label="Co-op" hint="One team, no secret objectives, no exile. Plays the hardcore objective side." checked={coopRules} disabled={twoPlayer} onChange={(on) => setVariant({ coop: on, betrayer: on ? false : choice.betrayer })} />
            <VariantRow id="twoPlayer" label="Two players" hint="You and one bot on the co-op rules: 7 starting items, keep 3 of 4 survivors." checked={twoPlayer} onChange={(on) => setBots(on ? 1 : 2)} />
            <VariantRow id="hardcore" label="Hardcore objective side" hint="Use the harder printed side of the main objective." checked={choice.hardcore || coopRules} disabled={coopRules} onChange={(on) => setVariant({ hardcore: on })} />
            <VariantRow id="betrayer" label="Betrayer variant" hint="A smaller secret-objective deck, so a betrayer is much more likely to be at the table." checked={choice.betrayer && !coopRules} disabled={coopRules} onChange={(on) => setVariant({ betrayer: on })} />
            <VariantRow id="elimination" label="Player elimination" hint="A seat whose last survivor dies is out of the game instead of drawing a new leader." checked={choice.playerElimination} onChange={(on) => setVariant({ playerElimination: on })} />
            <VariantRow id="mature" label="Mature Crossroads cards" hint={`On (default): all 80 Crossroads cards, as in the original game.${matureCards ? ` Off: the ${matureCards} cards with adult themes are left out.` : ' Off: the cards with adult themes are left out.'}`} checked={choice.includeMature} onChange={(on) => setVariant({ includeMature: on })} />
            {check.notes.map((n) => <div key={n} className="note" data-testid="setup-note">{n}</div>)}
            {check.errors.map((n) => <div key={n} className="error" data-testid="setup-variant-error">{n}</div>)}
          </div>
        </div>
        <div className="go">
          <button className="btn primary big" onClick={start} disabled={check.errors.length > 0} data-testid="setup-start">Start</button>
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
