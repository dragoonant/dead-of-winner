// The public API (00 §2, §12) and the headless sim on the fixture bundle: legal actions are never empty and always validate,
// malformed input is a rejection, save/load/replay reproduce a game, and no view ever leaks a hidden id.
import { describe, expect, it } from 'vitest'
import { createGame, legalActions, load, query, replay, save, step, validate, view, type Action, type GameState } from '../../src/engine/index'
import { loadFixtureBundle } from '../fixtures/loadFixtureBundle'
import { DEFAULT_OPTIONS, runGame, runSim, setupFor, stateHash } from '../../tools/sim-core'

const bundle = loadFixtureBundle()
const opts = { ...DEFAULT_OPTIONS, seats: 3, validateSample: 12 }

describe('engine api', () => {
  it('ACT-002 malformed input is E_BAD_PAYLOAD with the same state reference; pass and a wrong seat are rejected too', () => {
    const r = createGame(setupFor(3, 'random'), 'api-1', bundle)
    expect(r.rejection).toBeUndefined()
    const s = r.state
    for (const junk of [null, 42, 'x', {}, { type: 'nope', decisionId: s.pending.id, seat: 's1' }, { type: 'attack', decisionId: 7, seat: 's1' }]) {
      const x = step(s, junk as unknown as Action)
      expect(x.state).toBe(s)
      expect(x.rejection?.code).toBe('E_BAD_PAYLOAD')
      expect(x.pending).toBe(s.pending)
    }
    // a well-shaped action with a missing payload is still only a rejection
    const half = step(s, { type: 'chooseSurvivors', decisionId: s.pending.id, seat: 's1' } as unknown as Action)
    expect(half.state).toBe(s)
    expect(half.rejection).toBeDefined()
    expect(step(s, { type: 'pass', decisionId: s.pending.id, seat: 's1' }).rejection?.code).toBe('E_WRONG_DECISION')
    expect(step(s, { ...s.pending.options![0]!.action, seat: 's2' } as Action).rejection?.code).toBe('E_NOT_YOUR_DECISION')
    expect(validate(s, s.pending.options![0]!.action)).toBeNull()
  })

  it('ACT-009 a concession during setup ends the game; afterwards only ack is accepted and legalActions offers it', () => {
    const r = createGame({ ...setupFor(3, 'random'), seats: [{ id: 's1', kind: 'human' }, { id: 's2', kind: 'bot' }, { id: 's3', kind: 'bot' }] }, 'api-2', bundle)
    const c = step(r.state, { type: 'concede', decisionId: r.pending.id, seat: 's1' })
    expect(c.rejection).toBeUndefined()
    expect(c.state.phase).toBe('ended')
    expect(c.state.result).toMatchObject({ reason: 'concession', winners: [] })
    expect(c.pending.kind).toBe('gameOver')
    expect(legalActions(c.state).map((a) => a.type)).toEqual(['ack', 'ack', 'ack'])
    expect(step(c.state, legalActions(c.state)[0]!).rejection).toBeUndefined()
    expect(step(c.state, { type: 'endTurn', decisionId: c.pending.id, seat: 's1' }).rejection?.code).toBe('E_GAME_OVER')
    expect(step(r.state, { type: 'concede', decisionId: r.pending.id, seat: 's2' }).rejection?.code).toBe('E_NOT_YOUR_DECISION')
  })

  it('ACT-003 ten seeded random-bot games: every decision has a legal action, every sampled member validates, every game ends', async () => {
    const report = await runSim(bundle, { ...opts, games: 10, seed: 'act-003' })
    expect(report.violations).toEqual([])
    expect(report.finished).toBe(10)
    expect(report.meanDecisions).toBeGreaterThan(10)
  }, 60000)

  it('ACT-013 replay of a random-bot game reproduces the final state byte for byte; a save with another dataVersion is E_DATA_VERSION', async () => {
    const g = await runGame(bundle, 'act-013', 0, { ...opts, games: 1 })
    expect(g.violations).toEqual([])
    expect(g.ended).toBe(true)
    // replay from a fresh fold and from the save file
    let r = createGame(setupFor(3, 'random'), 'act-013', bundle)
    const log: Action[] = []
    const { createRandomDecider } = await import('../../src/ai/random')
    const bot = createRandomDecider('act-013')
    while (r.state.phase !== 'ended') {
      const a = await bot.decide(view(r.state, r.pending.seat === 'all' ? 's1' : r.pending.seat), r.pending, legalActions(r.state))
      r = step(r.state, a)
      log.push(a)
    }
    const again = replay(setupFor(3, 'random'), 'act-013', bundle, log)
    expect(again.rejection).toBeUndefined()
    expect(stateHash(again.state)).toBe(stateHash(r.state))
    const file = save(r.state, 'test')
    expect(file.actions).toHaveLength(log.length)
    const back = load(file, bundle)
    expect(back.rejection).toBeUndefined()
    expect(stateHash(back.state)).toBe(stateHash(r.state))
    const other = load({ ...file, dataVersion: 'someone-else' }, bundle)
    expect(other.rejection?.code).toBe('E_DATA_VERSION')
    expect(other.pending.kind).toBe('gameOver')
  }, 60000)

  it('VIEW-013 leak sim: forty seeded random-bot games, every seat view and every redacted event after every step, zero needle hits', async () => {
    const report = await runSim(bundle, { ...opts, games: 40, seed: 'view-013', validateSample: 0 })
    expect(report.leaks).toEqual([])
    expect(report.violations).toEqual([])
    expect(report.finished).toBe(40)
  }, 120000)

  it('QRY-001 the query helpers read a view only and never throw on a fresh first turn', () => {
    let r = createGame(setupFor(3, 'random'), 'qry-1', bundle)
    while (r.state.phase === 'setup') r = step(r.state, r.pending.options![0]!.action)
    const s: GameState = r.state
    const seat = s.activeSeat!
    const v = view(s, seat)
    const sv = s.seats[seat]!.survivors[0]!
    expect(query.crisis(v).needed).toBe(3)
    expect(query.foodNeeded(v).needed).toBeGreaterThan(0)
    expect(query.zombiesToAdd(v).perLocation[0]!.location).toBe('colony')
    const dr = query.dieRequirement(v, sv, 'attack')
    expect(dr.dice).toHaveLength(s.seats[seat]!.dice.length)
    expect(dr.need).toBeGreaterThan(0)
    const ex = query.exposureOdds(v, sv, 'move')
    expect(ex.blank + ex.wound + ex.frostbite + ex.bite).toBeCloseTo(1)
    const other = Object.values(s.survivors).find((x) => x.owner !== seat)!
    expect(query.attackSurvivorOdds(v, sv, other.id).pHit).toBeGreaterThan(0)
    expect(query.zombieKillOdds(v, sv, 'colony', 1).pKill).toBe(0) // no zombie at the colony at setup
    expect(query.objectiveProgress(v).kind).toBe('main')
    const so = query.searchOdds(v, 'loc.library')
    expect(so.remaining).toBe(20)
    expect(Object.values(so.pSymbol).reduce((a, b) => a + b, 0)).toBeCloseTo(1)
    expect(query.moveTargets(v, sv).length).toBe(6)
    expect(query.voteForecast(v, 's2').eligible).toHaveLength(3)
  })
})
