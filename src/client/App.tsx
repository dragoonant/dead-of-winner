// App shell: the title screen is eager and light; the game screen (3D table, HUD, engine, bots) is a lazy chunk.
import { Suspense, lazy, useState, type ReactElement } from 'react'
import { parseUrl, randomSeedWord, requestFromUrl, type LaunchRequest } from './launch'
import { useSettingsStore } from './store/settingsStore'
import { StartScreen } from './ui/StartScreen'

const GameScreen = lazy(() => import('./GameScreen'))

type Screen = { kind: 'start'; error?: string } | { kind: 'game'; request: LaunchRequest; nonce: number }

const urlOptions = parseUrl(typeof location !== 'undefined' ? location.search : '')
if (urlOptions.speed !== undefined) useSettingsStore.getState().set({ speed: urlOptions.speed })

export function App(): ReactElement {
  const [screen, setScreen] = useState<Screen>(() => {
    const req = requestFromUrl(urlOptions, randomSeedWord)
    return req ? { kind: 'game', request: req, nonce: 0 } : { kind: 'start' }
  })
  const start = (request: LaunchRequest): void => setScreen((s) => ({ kind: 'game', request, nonce: (s.kind === 'game' ? s.nonce : 0) + 1 }))
  if (screen.kind === 'start') return <StartScreen onStart={start} error={screen.error ?? null} />
  return (
    <Suspense fallback={<div className="start"><div className="start-card panel" style={{ textAlign: 'center' }}>Loading the table...</div></div>}>
      <GameScreen key={screen.nonce} request={screen.request} fps={urlOptions.fps} onExit={(error) => setScreen(error ? { kind: 'start', error } : { kind: 'start' })} onRestart={start} />
    </Suspense>
  )
}
