import { describe, expect, it } from 'vitest'
import { beginColonyPhase, colonyInProgress, resumeColonyPhase } from '../../src/engine/colony-phase'
import { patchEntrance } from '../../src/engine/exposure'
import { applyChooseLeader } from '../../src/engine/survivors'
import type { GameState } from '../../src/engine/types'
import { GAS, SCHOOL, forceRng, makeColony, of, types, type SvSpec } from './col-fixture'

const crowd = (n: number, away = 0): SvSpec[] => [
  ...Array.from({ length: n }, (_, i) => ({ id: `sv.x${i}`, owner: 's1', location: 'colony' as const })),
  ...Array.from({ length: away }, (_, i) => ({ id: `sv.y${i}`, owner: 's2', location: SCHOOL })),
]
const run = (s: GameState) => beginColonyPhase(s)

describe('colony phase', () => {
  it('COL-001 the seven steps run in order, each announced by PhaseChanged', () => {
    const r = run(makeColony())
    const steps = of<{ phase: string; step: string }>(r.events, 'PhaseChanged').filter((e) => e.phase === 'colony').map((e) => e.step)
    expect(steps).toEqual(['payFood', 'checkWaste', 'resolveCrisis', 'addZombies', 'checkObjective', 'roundTick', 'passToken'])
  })

  it('COL-002 mouths are colony survivors plus helpless tokens: 5 + 2 -> pay 4, the two away do not count', () => {
    const r = run(makeColony({ survivors: crowd(5, 2), helpless: 2, food: 4 }))
    expect(of(r.events, 'FoodPaid')[0]).toMatchObject({ needed: 4, survivors: 7, foodAfter: 0 })
    expect(of(r.events, 'FoodChanged')[0]).toMatchObject({ delta: -4, reason: 'pay' })
  })

  it('COL-003 13 at the colony with food 5 starve: nothing is paid, starvation 1, morale -1', () => {
    const s = makeColony({ survivors: crowd(13), food: 5 })
    const r = run(s)
    expect(of(r.events, 'Starvation')[0]).toMatchObject({ needed: 7, supply: 5, starvationAfter: 1, moraleLoss: 1 })
    expect(r.state.food).toBe(5)
    expect(of<{ reason: string; delta: number }>(r.events, 'MoraleChanged').find((e) => e.reason === 'starvation')).toMatchObject({ delta: -1 })
  })

  it('COL-004 and COL-005 a starvation token costs nothing on a round that can pay, and 2 tokens cost 2', () => {
    const paid = run(makeColony({ survivors: crowd(15), food: 8, starvation: 1 }))
    expect(of(paid.events, 'FoodPaid')[0]).toMatchObject({ needed: 8, foodAfter: 0 })
    expect(types(paid.events)).not.toContain('Starvation')
    const short = run(makeColony({ survivors: crowd(15), food: 2, starvation: 1 }))
    expect(of(short.events, 'Starvation')[0]).toMatchObject({ starvationAfter: 2, moraleLoss: 2 })
  })

  it('COL-007 no mouths need no food, one mouth needs one', () => {
    expect(of(run(makeColony({ survivors: [{ id: 'sv.d', owner: 's3', location: SCHOOL }] })).events, 'FoodPaid')[0]).toMatchObject({ needed: 0 })
    expect(of(run(makeColony({ survivors: [{ id: 'sv.a', owner: 's1' }] })).events, 'FoodPaid')[0]).toMatchObject({ needed: 1 })
  })

  it.each([[9, 0], [10, 1], [20, 2], [29, 2]])('COL-008 waste %i cards -> morale loss %i', (cards, loss) => {
    const r = run(makeColony({ waste: cards, morale: 9 }))
    expect(of(r.events, 'WasteChecked')[0]).toMatchObject({ cards, moraleLoss: loss })
  })

  it('COL-010 and COL-011 colony zombies are half the survivors rounded up; a location adds one per survivor, empty adds none', () => {
    const r = run(makeColony({ survivors: [...crowd(7), { id: 'sv.d', owner: 's3', location: SCHOOL }, { id: 'sv.e', owner: 's3', location: SCHOOL }, { id: 'sv.f', owner: 's3', location: SCHOOL }], helpless: 1 }))
    const adds = of<{ location: string; count: number }>(r.events, 'ZombiesToAdd')
    expect(adds.find((a) => a.location === 'colony')).toMatchObject({ count: 4 })
    expect(adds.find((a) => a.location === SCHOOL)).toMatchObject({ count: 3 })
    expect(adds.find((a) => a.location === GAS)).toBeUndefined()
  })

  it('COL-012 and END-006 morale 0 in the colony zombie step ends the game and no zombie is added afterwards', () => {
    const s = patchEntrance(makeColony({ survivors: [{ id: 'sv.a', owner: 's1' }, { id: 'sv.b', owner: 's1' }, { id: 'sv.d', owner: 's3', location: SCHOOL }], morale: 1, food: 9 }), 'colony', 1, { zombies: 3 })
    const r = run(s)
    const t = types(r.events)
    expect(t).toContain('GameEnded')
    expect(t.slice(t.indexOf('GameEnded') + 1)).not.toContain('ZombieAdded')
    expect(of(r.events, 'GameEnded')[0]).toMatchObject({ reason: 'moraleZero' })
    expect(r.state.phase).toBe('ended')
    expect(r.pending.kind).toBe('gameOver')
    expect(t).not.toContain('ObjectiveChecked')
  })

  it('COL-019 morale 0 inside Adding Zombies does not stop the step: both queued overruns resolve, then the game ends before the other locations (FAQ 6.2.1)', () => {
    let s = makeColony({
      survivors: [{ id: 'sv.a', owner: 's1' }, { id: 'sv.c', owner: 's1' }, { id: 'sv.d', owner: 's1' }, { id: 'sv.b', owner: 's1' }, { id: 'sv.e', owner: 's3', location: SCHOOL }],
      morale: 1, food: 9, crisis: null,
    })
    s = patchEntrance(patchEntrance(s, 'colony', 1, { zombies: 3 }), 'colony', 2, { zombies: 3 })
    const r = run(s)
    const t = types(r.events)
    const overruns = of<{ killed: string }>(r.events, 'EntranceOverrun')
    expect(overruns).toHaveLength(2) // the second zombie still resolves after morale hit 0
    expect(t.indexOf('GameEnded')).toBeGreaterThan(t.lastIndexOf('EntranceOverrun'))
    expect(of(r.events, 'GameEnded')[0]).toMatchObject({ reason: 'moraleZero' })
    expect(of<{ location: string }>(r.events, 'ZombiesToAdd').find((z) => z.location === SCHOOL)).toBeUndefined()
    expect(r.state.phase).toBe('ended')
  })

  it('COL-013 and COL-014 each noise token is a d6; 3 or lower adds a zombie, 4 or more does not; tokens clear', () => {
    const s = makeColony({ survivors: [{ id: 'sv.a', owner: 's1' }], crisis: null, noise: { [SCHOOL]: 2 }, rng: forceRng([6, 3], [6, 4]) })
    const r = run(s)
    const rolled = of<{ die: number; zombie: boolean; location: string }>(r.events, 'NoiseRolled')
    expect(rolled.map((n) => [n.die, n.zombie])).toEqual([[3, true], [4, false]])
    expect(of(r.events, 'ZombieAdded').filter((z) => (z as { source: string }).source === 'noise')).toHaveLength(1)
    expect(of(r.events, 'NoiseCleared')[0]).toMatchObject({ location: SCHOOL, count: 2 })
    expect(of<{ purpose: string }>(r.events, 'DiceRolled').filter((d) => d.purpose === 'noise')).toHaveLength(2)
    expect(r.state.locations[SCHOOL]!.noise).toBe(0)
  })

  it('COL-015 a complete main objective at step 5 ends the game before the round ticks', () => {
    const r = run(makeColony({ objective: { counters: { samples: 9 } } }))
    expect(of(r.events, 'ObjectiveChecked')[0]).toMatchObject({ complete: true })
    expect(of(r.events, 'GameEnded')[0]).toMatchObject({ reason: 'objectiveComplete', objectiveComplete: true })
    expect(types(r.events)).not.toContain('RoundTicked')
  })

  it('COL-016 the last round ticks to 0 and ends the game with no second objective check', () => {
    const r = run(makeColony({ roundsLeft: 1 }))
    expect(of(r.events, 'RoundTicked')[0]).toMatchObject({ roundsLeft: 0 })
    expect(of(r.events, 'GameEnded')[0]).toMatchObject({ reason: 'roundsOut', objectiveComplete: false })
    expect(of(r.events, 'ObjectiveChecked')).toHaveLength(1)
    expect(types(r.events)).not.toContain('FirstSeatPassed')
  })

  it('COL-017 the token passes to the right and the next round starts with a crisis and new dice', () => {
    const r = run(makeColony())
    expect(of(r.events, 'FirstSeatPassed')[0]).toMatchObject({ from: 's1', to: 's3' })
    expect(of(r.events, 'RoundStarted')[0]).toMatchObject({ roundNumber: 2, roundsLeft: 5 })
    expect(of(r.events, 'CrisisRevealed')[0]).toMatchObject({ cardId: 'cr.blizzard' })
    expect(of(r.events, 'ActionDiceRolled')).toHaveLength(3)
    expect(r.state.phase).toBe('playerTurns')
    expect(r.state.crisis).toMatchObject({ cardId: 'cr.blizzard', contributions: [], result: null })
    expect(r.pending).toMatchObject({ kind: 'turnAction', seat: 's3' })
    expect(r.state.pending).toBe(r.pending)
    expect(colonyInProgress(r.state)).toBe(false)
  })

  it('COL-018 starvation, waste and a failed crisis each emit their own MoraleChanged and morale never drops below 0', () => {
    const r = run(makeColony({ food: 0, waste: 10, morale: 9, hands: {} }))
    const m = of<{ reason: string; delta: number; after: number }>(r.events, 'MoraleChanged')
    expect(m.map((e) => [e.reason, e.delta])).toEqual([['starvation', -1], ['waste', -1], ['crisisFailed', -2]])
    const low = run(makeColony({ food: 0, starvation: 5, morale: 2 }))
    expect(low.state.morale).toBe(0)
    expect(of(low.events, 'GameEnded')[0]).toMatchObject({ reason: 'moraleZero' })
  })

  it('COL-012 a decision opened mid-step (new leader after an overrun) halts the phase and resumeColonyPhase finishes it', () => {
    const base = makeColony({
      survivors: [{ id: 'sv.e', owner: 's1' }, { id: 'sv.a', owner: 's1' }, { id: 'sv.b', owner: 's1' }, { id: 'sv.d', owner: 's3', location: SCHOOL }], food: 9, crisis: null,
    })
    let s = base
    for (const i of [1, 2, 3, 4, 5, 6]) s = patchEntrance(s, 'colony', i, { zombies: 3 })
    const halted = run(s)
    expect(halted.pending.kind).toBe('newLeader')
    expect(halted.state.phase).toBe('colony')
    expect(colonyInProgress(halted.state)).toBe(true)
    const firstOverruns = of(halted.events, 'EntranceOverrun')
    expect(firstOverruns).toHaveLength(1)
    // the owner answers; the reducer then hands the colony phase back
    const answered = applyChooseLeader(halted.state, 's1', 'sv.a', 'replacement').state
    const done = resumeColonyPhase(answered)
    expect(of(done.events, 'EntranceOverrun')[0]).toMatchObject({ entrance: 2 })
    expect(of(done.events, 'ZombiesToAdd').find((z) => (z as { location: string }).location === SCHOOL)).toBeTruthy()
    expect(of(done.events, 'RoundStarted')[0]).toMatchObject({ roundNumber: 2 })
    expect(colonyInProgress(done.state)).toBe(false)
  })
})
