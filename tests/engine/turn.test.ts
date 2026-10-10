import { describe, expect, it } from 'vitest'
import type { Action } from '../../src/engine/actions'
import { registerBundle } from '../../src/engine/index'
import { legalPlayerTurnsActions, startRound, stepPlayerTurns, validatePlayerTurnsAction } from '../../src/engine/phases/player-turns'
import { nextFloat, deriveSeed } from '../../src/engine/rng'
import type { DataBundle, GameState, StepResult } from '../../src/engine/types'
import { forceRng } from './atk-fixture'
import { BUNDLE as EFFECT_BUNDLE, addCard, makeState, setSeat, setSurvivor, types } from './effect-fixture'
import { BUNDLE as SETUP_BUNDLE, playSetup, setupOf } from './setup-fixture'

// a bundle with a few extra survivors (a location-bound ability, a deadly exposure-free walker)
const TURN_BUNDLE: DataBundle = {
  version: 'test-turn',
  byId: {
    ...EFFECT_BUNDLE.byId,
    'sv.maria': { id: 'sv.maria', name: 'Maria Lopez', stats: { influence: 12, attack: 3, search: 3 }, ability: { id: 'steadyAim', kind: 'action', location: 'loc.school', cost: { die: 1 }, limit: 'oncePerRound', effect: [{ op: 'killZombies', count: 1, location: 'here', value: 'noExposure' }] } },
  },
}
const state0 = (over: Partial<GameState> = {}): GameState => {
  registerBundle(TURN_BUNDLE)
  return makeState({ dataVersion: 'test-turn', ...over })
}
const act = (s: GameState, body: Record<string, unknown>): Action => ({ decisionId: s.pending.id, seat: s.pending.seat as string, ...body }) as unknown as Action
/** endTurn, then declines Forest Plum's optional turn.start prompt (the fixture's s3 survivor) so the next turnAction is open. */
const endTurn = (s: GameState): StepResult => {
  let r = stepPlayerTurns(s, act(s, { type: 'endTurn' }))
  const events = [...r.events]
  while (!r.rejection && r.pending.kind === 'effectChoice' && r.pending.options?.some((o) => o.id === 'no')) {
    r = stepPlayerTurns(r.state, r.pending.options.find((o) => o.id === 'no')!.action)
    events.push(...r.events)
  }
  return { ...r, events }
}
const withDice = (s: GameState, seat: string, values: number[]): GameState =>
  setSeat(s, seat, { dice: values.map((v, i) => ({ id: `${seat}:d${i + 1}`, value: v, used: false })) })
const place = (s: GameState, id: string, location: string, patch: object = {}): GameState => setSurvivor(s, id, { location, ...patch })

describe('player-turns phase', () => {
  it('ACT-001 a stale decision id is E_WRONG_DECISION and another seat answering is E_NOT_YOUR_DECISION', () => {
    const s = state0()
    expect(stepPlayerTurns(s, { type: 'endTurn', decisionId: 'd:99', seat: 's1' }).rejection?.code).toBe('E_WRONG_DECISION')
    expect(stepPlayerTurns(s, { type: 'endTurn', decisionId: s.pending.id, seat: 's2' }).rejection?.code).toBe('E_NOT_YOUR_DECISION')
  })

  it('ACT-002 a rejected action returns the same state reference, [ActionRejected] and the same pending', () => {
    const s = state0()
    const r = stepPlayerTurns(s, { type: 'endTurn', decisionId: 'd:99', seat: 's1' })
    expect(r.state).toBe(s)
    expect(types(r.events)).toEqual(['ActionRejected'])
    expect(r.pending).toBe(s.pending)
  })

  it('ACT-004 turnAction always lists endTurn; pass is E_NOT_AN_OPTION', () => {
    const s = state0()
    expect(legalPlayerTurnsActions(s).some((a) => a.type === 'endTurn')).toBe(true)
    expect(stepPlayerTurns(s, act(s, { type: 'pass' })).rejection?.code).toBe('E_NOT_AN_OPTION')
  })

  it('ACT-005 turns run clockwise from the first seat; after the last seat the colony phase starts and the token moves right', () => {
    let s = state0()
    const seen: string[] = []
    for (let i = 0; i < 3; i++) {
      const r = endTurn(s)
      expect(r.rejection).toBeUndefined()
      seen.push(...r.events.filter((e) => e.type === 'TurnEnded' || e.type === 'TurnStarted').map((e) => `${e.type}:${(e as { seat: string }).seat}`))
      if (i === 2) {
        const t = types(r.events)
        expect(t.indexOf('TurnEnded')).toBeLessThan(t.indexOf('PhaseChanged'))
        expect(r.events.find((e) => e.type === 'PhaseChanged')).toMatchObject({ phase: 'colony' })
        expect(r.events.find((e) => e.type === 'FirstSeatPassed')).toMatchObject({ from: 's1', to: 's3' })
        expect(r.events.find((e) => e.type === 'RoundStarted')).toMatchObject({ roundNumber: 2 })
      }
      s = r.state
    }
    expect(seen.slice(0, 4)).toEqual(['TurnEnded:s1', 'TurnStarted:s2', 'TurnEnded:s2', 'TurnStarted:s3'])
    expect(s.firstSeat).toBe('s3')
    expect(s.pending).toMatchObject({ kind: 'turnAction', seat: 's3' })
  })

  it('DICE-001 a new round rolls 1 + alive survivors per seat and discards the old dice', () => {
    let s = withDice(state0(), 's1', [1, 2, 3, 4])
    for (let i = 0; i < 3; i++) s = endTurn(s).state
    expect(s.roundNumber).toBe(2)
    expect(s.seats['s1']!.dice).toHaveLength(3) // Ashley + Spare One
    expect(s.seats['s2']!.dice).toHaveLength(3)
    expect(s.seats['s3']!.dice).toHaveLength(2)
    expect(s.seats['s1']!.dice.every((d) => !d.used)).toBe(true)
  })

  it('ACT-007 endTurn with cards to give asks for crisis cards once; contributeCrisis [] then closes the turn', () => {
    const { state: s } = addCard(state0(), 'it.fuel', 'hand:s1')
    const r = endTurn(s)
    expect(r.pending).toMatchObject({ kind: 'crisisContribution', seat: 's1' })
    expect(r.state.turn!.contributionAsked).toBe(true)
    expect(types(r.events)).not.toContain('TurnEnded')
    const r2 = stepPlayerTurns(r.state, act(r.state, { type: 'contributeCrisis', cardIds: [] }))
    expect(r2.rejection).toBeUndefined()
    expect(types(r2.events)).toContain('TurnEnded')
    expect(r2.pending).toMatchObject({ kind: 'turnAction', seat: 's2' })
  })

  it('ACT-008 an exiled seat is not asked for crisis cards', () => {
    let s = addCard(state0(), 'it.fuel', 'hand:s1').state
    s = setSeat(s, 's1', { seat: { ...s.seats['s1']!.seat, exiled: true } })
    const r = endTurn(s)
    expect(types(r.events)).toContain('TurnEnded')
    expect(r.pending.kind).toBe('turnAction')
  })

  it('ACT-009 after the game ended every action is E_GAME_OVER', () => {
    const s = { ...state0(), phase: 'ended' as const }
    expect(stepPlayerTurns(s, { type: 'endTurn', decisionId: 'd:1', seat: 's1' }).rejection?.code).toBe('E_GAME_OVER')
  })

  it('ACT-009 a human seat can concede on its own decision: GameEnded concession with no winners, then gameOver', () => {
    const s = state0()
    const r = stepPlayerTurns(s, act(s, { type: 'concede' }))
    expect(r.rejection).toBeUndefined()
    expect(r.events.find((e) => e.type === 'GameEnded')).toMatchObject({ reason: 'concession', winners: [] })
    expect(r.state.phase).toBe('ended')
    expect(r.pending.kind).toBe('gameOver')
    expect(stepPlayerTurns(s, { type: 'concede', decisionId: s.pending.id, seat: 's2' }).rejection?.code).toBe('E_NOT_YOUR_DECISION')
  })

  it('ACT-011 a frostbitten survivor takes exactly one extra wound at its owner\'s turn start, others are untouched', () => {
    let s = state0()
    s = setSurvivor(s, 'sv.mike', { frostbite: 2 })
    s = setSurvivor(s, 'sv.ashley', { frostbite: 1 })
    const r = endTurn(s) // s1 ends, s2 starts
    const ticks = r.events.filter((e) => e.type === 'FrostbiteTicked')
    expect(ticks).toHaveLength(1)
    expect(ticks[0]).toMatchObject({ survivorId: 'sv.mike' })
    expect(r.events.find((e) => e.type === 'WoundTaken')).toMatchObject({ survivorId: 'sv.mike', kind: 'wound', source: 'frostbiteTick', wounds: 1, frostbite: 2 })
    expect(r.state.survivors['sv.ashley']!.wounds).toBe(0)
  })

  it('ACT-012 a frostbite tick that gives a third wound kills before any action is offered', () => {
    let s = state0()
    s = setSurvivor(s, 'sv.sparky', { wounds: 1, frostbite: 1 })
    const r = endTurn(s)
    expect(r.events.find((e) => e.type === 'SurvivorKilled')).toMatchObject({ survivorId: 'sv.sparky', cause: 'wounds' })
    expect(r.state.survivors['sv.sparky']!.status).toBe('dead')
    expect(r.pending).toMatchObject({ kind: 'turnAction', seat: 's2' })
  })

  it('ACT-012 a death that asks for a new leader pauses the ticks and resumes them after the answer', () => {
    let s = state0()
    s = { ...s, survivors: { ...s.survivors, 'sv.spare2': { ...s.survivors['sv.sparky']!, id: 'sv.spare2', wounds: 0, frostbite: 1 } } }
    s = setSeat(s, 's2', { survivors: ['sv.mike', 'sv.sparky', 'sv.spare2'] })
    s = setSurvivor(s, 'sv.mike', { wounds: 1, frostbite: 1 }) // leader, dies on the tick
    const r = endTurn(s)
    expect(r.pending).toMatchObject({ kind: 'newLeader', seat: 's2' })
    expect(r.events.filter((e) => e.type === 'FrostbiteTicked')).toHaveLength(1)
    const pick = r.pending.options![0]!.action
    const r2 = stepPlayerTurns(r.state, pick)
    expect(r2.rejection).toBeUndefined()
    expect(r2.events.filter((e) => e.type === 'FrostbiteTicked')).toMatchObject([{ survivorId: 'sv.spare2' }]) // the next tick ran
    expect(r2.pending).toMatchObject({ kind: 'turnAction', seat: 's2' })
  })

  it('XRD-001 the seat to the right of the active seat draws and holds the Crossroads card; XRD-004 an untriggered card goes to the bottom', () => {
    const s = state0({ crossroads: { deck: ['xr.hunted', 'xr.impossible'], held: null, active: null, log: [] } })
    const r = endTurn(s)
    expect(r.events.find((e) => e.type === 'CrossroadsDrawn')).toMatchObject({ holder: 's1', forSeat: 's2', cardId: 'xr.hunted' })
    expect(r.state.crossroads.held).toEqual({ cardId: 'xr.hunted', holder: 's1', forSeat: 's2' })
    const r2 = endTurn(r.state)
    expect(r2.events.find((e) => e.type === 'CrossroadsReturned')).toMatchObject({ cardId: 'xr.hunted' })
    expect(r2.state.crossroads.log[0]).toMatchObject({ cardId: 'xr.hunted', triggered: false })
    expect(r2.events.find((e) => e.type === 'CrossroadsDrawn')).toMatchObject({ holder: 's2', forSeat: 's3', cardId: 'xr.impossible' })
    expect(r2.state.crossroads.deck).toEqual(['xr.hunted'])
  })

  it('ACT-014 an exiled seat still takes its turn; an eliminated seat is skipped', () => {
    let s = state0()
    s = setSeat(s, 's2', { seat: { ...s.seats['s2']!.seat, exiled: true } })
    expect(endTurn(s).pending).toMatchObject({ kind: 'turnAction', seat: 's2' })
    s = state0()
    s = setSeat(s, 's2', { seat: { ...s.seats['s2']!.seat, eliminated: true } })
    const r = endTurn(s)
    expect(r.pending).toMatchObject({ kind: 'turnAction', seat: 's3' })
    expect(r.events.some((e) => e.type === 'TurnStarted' && (e as { seat: string }).seat === 's2')).toBe(false)
  })

  it('R4.4 an optional turn.start ability asks its owner, a decline leaves the turn running (Forest Plum)', () => {
    let s = state0()
    s = { ...s, pending: { ...s.pending } }
    const raw = (x: GameState) => stepPlayerTurns(x, act(x, { type: 'endTurn' }))
    const r1 = raw(s)
    const r2 = raw(r1.state) // s3 starts: Forest Plum's lastGift is optional
    expect(r2.pending).toMatchObject({ kind: 'effectChoice', seat: 's3' })
    const no = r2.pending.options!.find((o) => o.id === 'no')!.action
    const r3 = stepPlayerTurns(r2.state, no)
    expect(r3.rejection).toBeUndefined()
    expect(r3.pending).toMatchObject({ kind: 'turnAction', seat: 's3' })
    expect(r3.state.survivors['sv.forest']!.status).toBe('alive')
  })
})

describe('survivor abilities as turn actions', () => {
  const daniel = (): GameState => {
    let s = state0()
    s = { ...s, survivors: { ...s.survivors, 'sv.daniel': { ...s.survivors['sv.ashley']!, id: 'sv.daniel', location: 'loc.school' } } }
    s = setSeat(s, 's1', { survivors: ['sv.ashley', 'sv.daniel'] })
    s = withDice(s, 's1', [3, 4, 5])
    s = { ...s, locations: { ...s.locations, 'loc.school': { ...s.locations['loc.school']!, entrances: [{ index: 1, zombies: 4, barricades: 0 }] } }, rng: forceRng([12, 1], [12, 1]) }
    return s
  }

  it('DICE-004 a (4+) ability on a die showing 3 is E_DIE_TOO_LOW; on a 4 it kills two with ONE exposure roll, and may be used again', () => {
    const s = daniel()
    const low = stepPlayerTurns(s, act(s, { type: 'useAbility', survivorId: 'sv.daniel', abilityId: 'doubleTap', dieId: 's1:d1' }))
    expect(low.rejection?.code).toBe('E_DIE_TOO_LOW')
    const ok = stepPlayerTurns(s, act(s, { type: 'useAbility', survivorId: 'sv.daniel', abilityId: 'doubleTap', dieId: 's1:d2' }))
    expect(ok.rejection).toBeUndefined()
    expect(ok.events.filter((e) => e.type === 'ZombieKilled').reduce((n, _e) => n + 1, 0)).toBeGreaterThanOrEqual(1)
    expect(ok.state.locations['loc.school']!.entrances[0]!.zombies).toBe(2)
    expect(ok.events.filter((e) => e.type === 'ExposureRolled')).toHaveLength(1)
    expect(ok.state.seats['s1']!.dice.find((d) => d.id === 's1:d2')!.used).toBe(true)
    expect(ok.pending).toMatchObject({ kind: 'turnAction', seat: 's1' })
    const again = stepPlayerTurns(ok.state, act(ok.state, { type: 'useAbility', survivorId: 'sv.daniel', abilityId: 'doubleTap', dieId: 's1:d3' }))
    expect(again.rejection).toBeUndefined()
  })

  it('ACT-006 an ability of a survivor the seat does not control is E_NOT_YOUR_SURVIVOR', () => {
    const s = daniel()
    const r = stepPlayerTurns(s, act(s, { type: 'useAbility', survivorId: 'sv.mike', abilityId: 'steady' }))
    expect(r.rejection?.code).toBe('E_NOT_YOUR_SURVIVOR')
  })

  it('DICE-010 a once-per-round free ability runs without a die, then is E_ABILITY_USED', () => {
    const s = place(state0(), 'sv.ashley', 'loc.school')
    const r = stepPlayerTurns(s, act(s, { type: 'useAbility', survivorId: 'sv.ashley', abilityId: 'quickBarricade' }))
    expect(r.rejection).toBeUndefined()
    expect(r.events.find((e) => e.type === 'AbilityUsed')).toMatchObject({ survivorId: 'sv.ashley', usesThisRound: 1 })
    expect(r.state.locations['loc.school']!.entrances[0]!.barricades).toBe(1)
    const again = stepPlayerTurns(r.state, act(r.state, { type: 'useAbility', survivorId: 'sv.ashley', abilityId: 'quickBarricade' }))
    expect(again.rejection?.code).toBe('E_ABILITY_USED')
  })

  it('DICE-011 a once-per-round ability is available again after the next roll step', () => {
    let s = place(state0(), 'sv.ashley', 'loc.school')
    s = stepPlayerTurns(s, act(s, { type: 'useAbility', survivorId: 'sv.ashley', abilityId: 'quickBarricade' })).state
    for (let i = 0; i < 3; i++) s = endTurn(s).state // into round 2
    expect(s.roundNumber).toBe(2)
    expect(s.seats['s1']!.abilityUses).toEqual({})
  })

  it('R4.4 a triggered ability cannot be used as a turn action (E_FORBIDDEN); a wrong location is E_ABILITY_LOCATION', () => {
    let s = state0()
    s = { ...s, survivors: { ...s.survivors, 'sv.maria': { ...s.survivors['sv.ashley']!, id: 'sv.maria', location: 'colony' } } }
    s = setSeat(s, 's1', { survivors: ['sv.ashley', 'sv.maria'] })
    s = withDice(s, 's1', [5])
    const forbidden = stepPlayerTurns(s, act(s, { type: 'useAbility', survivorId: 'sv.ashley', abilityId: 'lastGift' }))
    expect(forbidden.rejection?.code).toBe('E_BAD_PAYLOAD') // Ashley has no such ability
    const wrongPlace = stepPlayerTurns(s, act(s, { type: 'useAbility', survivorId: 'sv.maria', abilityId: 'steadyAim', dieId: 's1:d1' }))
    expect(wrongPlace.rejection?.code).toBe('E_ABILITY_LOCATION')
    const t = { ...s, pending: { ...s.pending, id: 'd:5', seat: 's3' }, seats: s.seats }
    const plum = stepPlayerTurns({ ...t, turn: { ...t.turn!, seat: 's3' } }, { type: 'useAbility', decisionId: 'd:5', seat: 's3', survivorId: 'sv.forest', abilityId: 'lastGift' })
    expect(plum.rejection?.code).toBe('E_FORBIDDEN')
  })
})

// ---------- a whole random game through createGame's setup, the machine and the fallback colony ----------
describe('player-turns full flow', () => {
  const pick = (seed: string, n: number, i: number): number => Math.floor(nextFloat(deriveSeed(seed, i))[0] * n)

  it('ACT-003 random play: one pending after every step, legalActions never empty and every member validates', () => {
    registerBundle(SETUP_BUNDLE)
    let sawVote = false
    let sawExile = false
    for (const seed of ['alpha', 'bravo', 'charlie', 'delta']) {
      const { result } = playSetup(setupOf(4), seed)
      let s = result.state
      expect(s.phase).toBe('playerTurns')
      for (let i = 0; i < 1500 && s.phase !== 'ended'; i++) {
        const legal = legalPlayerTurnsActions(s)
        expect(legal.length).toBeGreaterThan(0)
        for (const a of legal.slice(0, 40)) expect(validatePlayerTurnsAction(s, a)).toBeNull()
        // bias toward the interesting actions: prefer a vote when available, otherwise random
        const vote = legal.find((a) => a.type === 'callVote')
        const end = legal.find((a) => a.type === 'endTurn')
        const a = vote && pick(seed, 12, i) === 0 ? vote : end && pick(seed, 4, i + 7) === 0 ? end : legal[pick(seed, legal.length, i)]!
        const r = stepPlayerTurns(s, a)
        expect(r.rejection, `${a.type} ${JSON.stringify(r.rejection)}`).toBeUndefined()
        expect(r.state.pending).toBe(r.pending)
        if (r.events.some((e) => e.type === 'VoteCalled')) sawVote = true
        if (r.events.some((e) => e.type === 'SeatExiled')) sawExile = true
        s = r.state
      }
      expect(s.roundNumber).toBeGreaterThan(1)
    }
    expect(sawVote).toBe(true)
    expect(sawExile).toBe(true)
  })

  it('startRound reveals the next crisis and numbers the round', () => {
    registerBundle(SETUP_BUNDLE)
    const { result } = playSetup(setupOf(3), 'echo')
    const s0 = result.state
    expect(s0.roundNumber).toBe(1)
    expect(s0.crisis.cardId).not.toBeNull()
    const r = startRound({ ...s0, phase: 'colony', turn: null })
    expect(r.state.roundNumber).toBe(2)
    expect(r.events.find((e) => e.type === 'CrisisRevealed')).toMatchObject({ roundNumber: 2 })
    expect(r.pending.kind).toBe('turnAction')
  })
})
