import { beforeAll, describe, expect, it } from 'vitest'
import { view } from '../../src/engine/index'
import { buildTableModel } from '../../src/client/table/tableModel'
import { createBotDriver } from '../../src/client/bot/botDriver'
import { usePresentedStore } from '../../src/client/presentation/presentedStore'
import { setClientBundle } from '../../src/client/data'
import { dispatch, legalFor, resetGameStore, saveGame, startWithSetup, useGameStore, ballotAction, autosaveSummary, continueGame } from '../../src/client/store/gameStore'
import { useSettingsStore } from '../../src/client/store/settingsStore'
import { loadFixtureBundle } from '../fixtures/loadFixtureBundle'
import { loadDefaultBundle } from '../../tools/default-bundle'
import { setupFor } from '../../tools/sim-core'

beforeAll(() => {
  setClientBundle(loadFixtureBundle())
  useSettingsStore.getState().set({ speed: 0 })
})

describe('game runner', () => {
  it('a human-less game runs to the end through the bot driver, presented state snaps to the true state, no watchdog fires', async () => {
    resetGameStore()
    expect(startWithSetup(setupFor(3, 'random'), 'run1', loadFixtureBundle())).toBeNull()
    const driver = createBotDriver({ thinkMs: 0 })
    for (let i = 0; i < 4000 && useGameStore.getState().state?.phase !== 'ended'; i++) await driver.answerNow()
    const s = useGameStore.getState()
    expect(s.state?.phase).toBe('ended')
    expect(usePresentedStore.getState().idle).toBe(true)
    expect(usePresentedStore.getState().state).toBe(s.state)
    expect(usePresentedStore.getState().feed.length).toBeGreaterThan(20)
    expect(s.watchdog).toEqual([])
    expect(driver.forced).toBe(0)
  })

  it('the human cannot answer a bot decision, and a wrong answer is rejected with the engine message', async () => {
    resetGameStore()
    const setup = setupFor(3, 'random')
    setup.seats[0]!.kind = 'human'
    startWithSetup(setup, 'run2', loadFixtureBundle())
    const st = useGameStore.getState()
    expect(st.viewer).toBe('s1')
    const bogus = { ...legalFor(st.state)[0]!, decisionId: 'd:999' }
    expect(dispatch(bogus, 'human')?.code).toBe('E_WRONG_DECISION')
    expect(useGameStore.getState().lastRejection?.text.length).toBeGreaterThan(3)
    // answer the human's setup decisions until a bot decision is open
    const driver = createBotDriver({ thinkMs: 0 })
    for (let i = 0; i < 60; i++) {
      const s = useGameStore.getState()
      if (s.pending!.seat === 's1') dispatch(legalFor(s.state)[0]!, 'human')
      else break
      await driver.answerNow()
    }
    const s2 = useGameStore.getState()
    expect(s2.pending!.seat).not.toBe('s1')
    expect(dispatch(legalFor(s2.state)[0]!, 'human')?.code).toBe('E_NOT_YOUR_DECISION')
  })

  it('the table model places every living survivor and every zombie the view reports', () => {
    resetGameStore()
    startWithSetup(setupFor(3, 'random'), 'run3', loadFixtureBundle())
    const state = useGameStore.getState().state!
    const v = view(state, 's1')
    const m = buildTableModel(v)
    const alive = Object.values(v.survivors).filter((x) => x.status === 'alive')
    expect(m.figures).toHaveLength(alive.length)
    const zombies = Object.values(v.locations).reduce((n, l) => n + l.entrances.reduce((k, e) => k + e.zombies, 0), 0)
    expect(m.zombies).toHaveLength(zombies)
    for (const p of [...m.zombies, ...m.figures.map((f) => f.pos)]) expect(Number.isFinite(p.x + p.z)).toBe(true)
  })

  it('autosaves and continues the same game, and bot ballots merge into one castVotes', async () => {
    resetGameStore()
    startWithSetup(setupFor(3, 'random'), 'run4', loadDefaultBundle()) // continueGame reloads src/data, so the save must come from it
    const driver = createBotDriver({ thinkMs: 0 })
    for (let i = 0; i < 40; i++) await driver.answerNow()
    expect(saveGame()).toBe(true)
    const before = useGameStore.getState().state!
    expect(autosaveSummary()?.actions).toBe(before.log.length)
    expect(await continueGame()).toBeNull()
    const after = useGameStore.getState().state!
    expect(after.log).toHaveLength(before.log.length)
    expect(after.pending.id).toBe(before.pending.id)
    expect(JSON.stringify(after.seats)).toBe(JSON.stringify(before.seats))
    expect(ballotAction()).toBeNull() // no vote is open
  })
})
