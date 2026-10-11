// The in-game screen: table canvas plus every HUD panel. Lazy-loaded from App so the title screen stays light.
import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { useGameAudio } from './audio/useAudioSettings'
import { nameOf } from './data'
import { HandFan } from './cards/HandFan'
import { HoverSurvivorCard } from './cards/SurvivorChip'
import { startBotDriver, stopBotDriver } from './bot/botDriver'
import { resetDeciders } from './bot/deciders'
import { startTalk } from './bot/talk'
import { DiceTray } from './dice/DiceTray'
import type { LaunchRequest } from './launch'
import { skipAll, skipBeat } from './presentation/director'
import { usePresentedStore } from './presentation/presentedStore'
import { continueGame, installAutosave, saveGame, startGame, useGameStore } from './store/gameStore'
import { useSettingsStore } from './store/settingsStore'
import { ui } from './store/uiStore'
import Table from './table/Table'
import { buildTableModel } from './table/tableModel'
import { usePresentedView } from './store/hooks'
import { installTestHooks, isTestMode } from './testing/testHooks'
import { GameOver } from './ui/GameOver'
import { HowToPlay, KeysHelp, ObjectivePanel, SettingsPopover } from './ui/Panels'
import { PromptDock } from './ui/PromptDock'
import { FeedRail } from './ui/FeedRail'
import { SeatRail } from './ui/Rails'
import { TopBar } from './ui/TopBar'
import './ui/hud.css'
import './cards/cards.css'

function Banner(): ReactElement | null {
  const b = usePresentedStore((s) => s.banner)
  return b ? <div key={b.id} className={`banner ${b.kind}`} data-testid="banner">{b.text}</div> : null
}

/** The card-by-card crisis reveal: each flipped card with its +1 or -1, the running total against the target, then the verdict and the morale change. */
function CrisisStrip(): ReactElement | null {
  const r = usePresentedStore((s) => s.crisisReveal)
  if (!r || r.cards.length === 0) return null
  const total = r.cards[r.cards.length - 1]!.runningTotal
  const o = r.outcome
  return (
    <div className="crisis-reveal panel" data-testid="crisis-reveal">
      <div className="cr-head">
        <b>{r.crisisId ? nameOf(r.crisisId) : 'Crisis'}</b>
        <span className="muted">{r.needed !== null ? `needs ${r.needed}${r.bonusAt !== null ? `, bonus at ${r.bonusAt}` : ''}` : ''}</span>
      </div>
      <div className="cr-cards">
        {r.cards.map((c, i) => (
          <span key={i} className={`cc ${c.points < 0 ? 'neg' : ''}`} data-testid="crisis-card"><b>{c.points > 0 ? '+1' : '-1'}</b> {c.name}<i className="rt">{c.runningTotal}</i></span>
        ))}
      </div>
      <div className="cr-total" data-testid="crisis-total">
        <b>Total {o ? o.total : total}{(o?.needed ?? r.needed) !== null && (o?.needed ?? r.needed) !== undefined ? ` of ${o?.needed ?? r.needed}` : ''}</b>
        {o && <span className={`verdict ${o.prevented ? 'HIT' : 'MISS'}`} data-testid="crisis-verdict">{o.prevented ? (o.bonus ? 'PREVENTED, BONUS' : 'PREVENTED') : 'NOT PREVENTED'}</span>}
        {o && r.moraleDelta !== null && r.moraleDelta !== 0 && <span className="muted">Morale {r.moraleDelta > 0 ? `+${r.moraleDelta}` : r.moraleDelta}</span>}
      </div>
    </div>
  )
}

/** Invisible DOM mirrors of the table for e2e (50 §16): figures, zombies per entrance, seats. */
function DomProxies(): ReactElement | null {
  const v = usePresentedView()
  const m = useMemo(() => (v ? buildTableModel(v) : null), [v])
  if (!v || !m) return null
  return (
    <div aria-hidden="true" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
      {m.figures.map((f) => (
        <div key={f.id} data-testid={`figure-${f.id}`} data-location={f.location} data-slot={f.slot} data-wounds={f.wounds} data-frostbite={f.frostbite} data-status="alive" />
      ))}
      {m.entrances.map((e) => <div key={`${e.location}-${e.entrance}`} data-testid={`zombies-${e.location}-${e.entrance}`} data-count={e.count} data-barricades={e.barricadeCount} />)}
    </div>
  )
}

function FpsMeter(): ReactElement {
  const [fps, setFps] = useState(0)
  const idle = usePresentedStore((s) => s.idle)
  const wd = useGameStore((s) => s.watchdog.length)
  useEffect(() => {
    let frames = 0
    let last = performance.now()
    let raf = 0
    const tick = (): void => {
      frames++
      const now = performance.now()
      if (now - last >= 1000) { setFps(Math.round((frames * 1000) / (now - last))); frames = 0; last = now }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  const canvas = document.querySelector('canvas')
  return <div className="fps">fps {fps} | idle {String(idle)} | watchdog {wd} | canvas {canvas ? `${canvas.width}x${canvas.height}` : '-'}</div>
}

export default function GameScreen({ request, fps, onExit, onRestart }: {
  request: LaunchRequest; fps?: boolean; onExit: (error?: string) => void; onRestart: (req: LaunchRequest) => void
}): ReactElement {
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const state = useGameStore((s) => s.state)
  const fatal = useGameStore((s) => s.fatal)
  useGameAudio()

  useEffect(() => {
    let alive = true
    let stopTalk: (() => void) | null = null
    installTestHooks()
    const unsub = installAutosave()
    resetDeciders()
    const run = request.resume ? continueGame() : startGame(request)
    void run.then((err) => { if (!alive) return; if (err) { if (!request.resume) onExit(err); else setError(err) } else { setReady(true); startBotDriver(); stopTalk = startTalk() } })
    return () => { alive = false; unsub(); stopBotDriver(); stopTalk?.() }
  }, [request])

  useEffect(() => {
    const h = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return
      const set = useSettingsStore.getState().set
      const st = useSettingsStore.getState()
      switch (e.key) {
        case 'o': case 'O': ui.toggle('objectiveOpen'); break
        case '[': set({ leftCollapsed: !st.leftCollapsed }); break
        case ']': set({ rightCollapsed: !st.rightCollapsed }); break
        case '1': case '2': case '3': case '4': ui.set({ camera: Number(e.key) as 1 | 2 | 3 | 4 }); break
        case ' ': e.preventDefault(); if (e.repeat) skipAll(); else skipBeat(); break
        case 's': case 'S': saveGame('Manual'); break
        case '?': ui.toggle('keysOpen'); break
        case 'e': case 'E': document.querySelector<HTMLButtonElement>('[data-testid="prompt-end-turn"]')?.click(); break
        case 'Escape': ui.set({ objectiveOpen: false, howToOpen: false, settingsOpen: false, keysOpen: false }); break
        default: break
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  if (error || fatal) {
    return (
      <div className="start"><div className="start-card panel"><h1>Something went wrong</h1>
        <p className="error" data-testid="game-error">{error ?? fatal}</p>
        <div className="go"><button className="btn primary" onClick={() => onExit()}>Back to the title screen</button></div></div></div>
    )
  }
  return (
    <div className="game" onClick={() => skipBeat()} data-testid="game-screen" data-ready={ready && !!state}>
      <div className="table-wrap"><Table /></div>
      {ready && state && (
        <>
          <TopBar />
          <SeatRail />
          <FeedRail />
          <HandFan />
          <HoverSurvivorCard />
          <DiceTray />
          <CrisisStrip />
          <PromptDock />
          <Banner />
          <ObjectivePanel />
          <HowToPlay />
          <KeysHelp />
          <SettingsPopover />
          <GameOver onRestart={onRestart} onExit={() => onExit()} />
          {isTestMode() && <DomProxies />}
        </>
      )}
      {!ready && <div className="bot-wait panel sans" style={{ bottom: '50%' }}>Setting up the colony...</div>}
      {fps && <FpsMeter />}
    </div>
  )
}
