import { describe, expect, it } from 'vitest'
import type { Action } from '../../src/engine/actions'
import { registerBundle } from '../../src/engine/index'
import { legalPlayerTurnsActions, stepPlayerTurns } from '../../src/engine/phases/player-turns'
import type { DataBundle, GameState, StepResult } from '../../src/engine/types'
import { forceRng } from './atk-fixture'
import { BUNDLE as EFFECT_BUNDLE, addCard, makeState, setSeat, setSurvivor, types } from './effect-fixture'

const EXILE_BUNDLE: DataBundle = {
  version: 'test-exile',
  byId: { ...EFFECT_BUNDLE.byId, 'obj.betrayal.x': { id: 'obj.betrayal.x', kind: 'secretObjective', type: 'betrayal' }, 'obj.secret.y': { id: 'obj.secret.y', kind: 'secretObjective', type: 'secret' } },
}

/** Four seats (s1 Ashley + Spare One, s2 Mike + Sparky, s3 Forest, s4 Spare Two); s1 holds the turn. */
function table(over: Partial<GameState> = {}): GameState {
  registerBundle(EXILE_BUNDLE)
  let s = makeState({ dataVersion: 'test-exile', ...over })
  s = {
    ...s,
    setup: { ...s.setup, seats: [...s.setup.seats, { id: 's4', kind: 'human' as const }] },
    seatOrder: ['s1', 's2', 's3', 's4'],
    survivors: { ...s.survivors, 'sv.spare2': { ...s.survivors['sv.spare']!, id: 'sv.spare2', owner: 's4' } },
    seats: { ...s.seats, s4: { ...s.seats['s3']!, seat: { id: 's4', kind: 'human', exiled: false, eliminated: false }, survivors: ['sv.spare2'], leaderId: 'sv.spare2' } },
    exiledObjectiveDeck: ['obj.exiled.a', 'obj.exiled.b'],
  }
  return s
}
const act = (s: GameState, body: Record<string, unknown>): Action => ({ decisionId: s.pending.id, seat: s.pending.seat as string, ...body }) as unknown as Action
const step = (s: GameState, body: Record<string, unknown>): StepResult => stepPlayerTurns(s, act(s, body))
const allYes = (s: GameState): Record<string, boolean> => Object.fromEntries(((s.pending.context.data as { eligible: string[] }).eligible).map((id) => [id, true]))
const exileBy = (s: GameState, target: string): StepResult => {
  const open = step(s, { type: 'callVote', target })
  return stepPlayerTurns(open.state, { type: 'castVotes', decisionId: open.state.pending.id, seat: 'all', votes: allYes(open.state) })
}
const place = (s: GameState, placements: { survivorId: string; to: string }[]): StepResult => step(s, { type: 'placeExiled', placements })
const MIKE_SPARKY = [{ survivorId: 'sv.mike', to: 'loc.school' }, { survivorId: 'sv.sparky', to: 'loc.gas' }]
/** s2 is the active seat (for tests that need an exiled seat to act). */
const asTurnOf = (s: GameState, seat: string): GameState => ({ ...s, activeSeat: seat, turn: { seat, index: s.seatOrder.indexOf(seat), actions: 0, voteCalled: false, contributionAsked: false }, pending: { ...s.pending, seat } })

describe('exile', () => {
  it('EXIL-001 a passed vote exiles the seat, deals it a private exiled objective and asks it to place its colony survivors', () => {
    const r = exileBy(table(), 's2')
    expect(r.events.find((e) => e.type === 'SeatExiled')).toEqual({ type: 'SeatExiled', seat: 's2', objectiveId: 'obj.exiled.a' })
    expect(r.state.seats['s2']!.seat.exiled).toBe(true)
    expect(r.state.seats['s2']!.exiledObjectiveId).toBe('obj.exiled.a')
    expect(r.state.exiledObjectiveDeck).toEqual(['obj.exiled.b'])
    expect(r.pending).toMatchObject({ kind: 'exilePlacement', seat: 's2' })
    expect(r.state.exile).toEqual({ seat: 's2', toPlace: ['sv.mike', 'sv.sparky'] })
    expect(r.pending.options!.length).toBeGreaterThan(0)
  })

  it('EXIL-002 placeExiled must name every survivor at the colony and send each outside it', () => {
    const open = exileBy(table(), 's2').state
    expect(place(open, [{ survivorId: 'sv.mike', to: 'loc.school' }]).rejection?.code).toBe('E_BAD_PAYLOAD')
    expect(place(open, [...MIKE_SPARKY, { survivorId: 'sv.ashley', to: 'loc.school' }]).rejection?.code).toBe('E_BAD_PAYLOAD')
    expect(place(open, [{ survivorId: 'sv.mike', to: 'colony' }, { survivorId: 'sv.sparky', to: 'loc.gas' }]).rejection?.code).toBe('E_TARGET_INVALID')
    expect(place(open, [{ survivorId: 'sv.mike', to: 'loc.nowhere' }, { survivorId: 'sv.sparky', to: 'loc.gas' }]).rejection?.code).toBe('E_TARGET_INVALID')
    expect(stepPlayerTurns(open, { type: 'placeExiled', decisionId: open.pending.id, seat: 's1', placements: MIKE_SPARKY }).rejection?.code).toBe('E_NOT_YOUR_DECISION')
  })

  it('EXIL-003 each placement is a move with an exposure roll that does not use the survivor\'s move for the turn', () => {
    const open = exileBy({ ...table(), rng: forceRng([12, 1], [12, 1]) }, 's2').state
    const r = place(open, MIKE_SPARKY)
    expect(r.rejection).toBeUndefined()
    const t = types(r.events)
    expect(r.events.filter((e) => e.type === 'SurvivorMoved')).toMatchObject([{ survivorId: 'sv.mike', from: 'colony', to: 'loc.school', kind: 'exile' }, { survivorId: 'sv.sparky', to: 'loc.gas', kind: 'exile' }])
    expect(r.events.filter((e) => e.type === 'ExposureRolled')).toMatchObject([{ survivorId: 'sv.mike', reason: 'move' }, { survivorId: 'sv.sparky', reason: 'move' }])
    expect(t.indexOf('SurvivorMoved')).toBeLessThan(t.indexOf('ExposureRolled'))
    expect(r.state.survivors['sv.mike']).toMatchObject({ location: 'loc.school', movedThisTurn: false })
    expect(r.state.exile).toBeNull()
    expect(r.pending).toMatchObject({ kind: 'turnAction', seat: 's1' }) // the vote is done, the caller's turn goes on
  })

  it('EXIL-004 with no free outside space a non-exiled survivor goes back to the colony and the exile takes the slot (no exposure, no move flag)', () => {
    let s = table({ rng: forceRng([12, 1], [12, 1]) })
    s = { ...s, locations: { ...s.locations, 'loc.school': { ...s.locations['loc.school']!, capacity: { ...s.locations['loc.school']!.capacity, survivors: 1 } }, 'loc.gas': { ...s.locations['loc.gas']!, capacity: { ...s.locations['loc.gas']!.capacity, survivors: 1 } } } }
    s = setSurvivor(setSurvivor(s, 'sv.ashley', { location: 'loc.school' }), 'sv.forest', { location: 'loc.gas' })
    const open = exileBy(s, 's2').state
    const r = place(open, MIKE_SPARKY)
    expect(r.rejection).toBeUndefined()
    expect(r.events.filter((e) => e.type === 'SurvivorBumped')).toMatchObject([{ survivorId: 'sv.ashley', from: 'loc.school', forExiled: 'sv.mike' }, { survivorId: 'sv.forest', from: 'loc.gas', forExiled: 'sv.sparky' }])
    expect(r.state.survivors['sv.ashley']).toMatchObject({ location: 'colony', movedThisTurn: false })
    expect(r.state.survivors['sv.mike']!.location).toBe('loc.school')
    expect(r.events.filter((e) => e.type === 'ExposureRolled').map((e) => (e as { survivorId: string }).survivorId)).toEqual(['sv.mike', 'sv.sparky']) // only the exiled roll
    // a full location while another has room is refused
    const roomy = exileBy(table(), 's2').state
    const full = { ...roomy, locations: { ...roomy.locations, 'loc.school': { ...roomy.locations['loc.school']!, capacity: { ...roomy.locations['loc.school']!.capacity, survivors: 1 } } } }
    const two = place(setSurvivor(full, 'sv.ashley', { location: 'loc.school' }), [{ survivorId: 'sv.mike', to: 'loc.school' }, { survivorId: 'sv.sparky', to: 'loc.gas' }])
    expect(two.rejection?.code).toBe('E_NO_SPACE')
  })

  it('EXIL-003 a bite during a placement pauses the rest, which carries on after the choice', () => {
    const s = table({ rng: forceRng([12, 12], [12, 1]) })
    const open = exileBy(setSurvivor(s, 'sv.ashley', { location: 'loc.school' }), 's2').state
    const r = place(open, MIKE_SPARKY)
    expect(r.pending).toMatchObject({ kind: 'biteSpreadOption', seat: 's1' }) // Mike is bitten at the school; the bite reaches Ashley
    expect(r.state.survivors['sv.mike']!.status).toBe('dead')
    expect(r.state.survivors['sv.sparky']!.location).toBe('colony') // not placed yet
    const kill = r.pending.options!.find((o) => o.id === 'kill')!.action
    const done = stepPlayerTurns(r.state, kill)
    expect(done.rejection).toBeUndefined()
    expect(done.state.survivors['sv.sparky']!.location).toBe('loc.gas') // the paused placement went on
    expect(done.state.exile).toBeNull()
    expect(done.pending).toMatchObject({ kind: 'turnAction', seat: 's1' })
  })

  it('EXIL-005 an exiled seat cannot add to the crisis, spend food on dice or cast a ballot', () => {
    let s = table()
    s = setSeat(s, 's2', { seat: { ...s.seats['s2']!.seat, exiled: true }, dice: [{ id: 's2:d1', value: 3, used: false }] })
    s = addCard(s, 'it.fuel', 'hand:s2').state
    const mine = asTurnOf(s, 's2')
    const card = mine.seats['s2']!.hand[0]!
    expect(step(mine, { type: 'contributeCrisis', cardIds: [card] }).rejection?.code).toBe('E_EXILED')
    expect(step(mine, { type: 'spendFood', dieId: 's2:d1', tokens: 1 }).rejection?.code).toBe('E_EXILED')
    const open = step(asTurnOf(s, 's1'), { type: 'callVote', target: 's3' }).state
    const bad = stepPlayerTurns(open, { type: 'castVotes', decisionId: open.pending.id, seat: 'all', votes: { s1: true, s2: true, s3: true, s4: true } })
    expect(bad.rejection?.code).toBe('E_BAD_PAYLOAD')
  })

  it('EXIL-007 an exiled seat may still call a vote, and an exiled seat cannot be voted on again (EXIL-011)', () => {
    let s = table()
    s = setSeat(s, 's2', { seat: { ...s.seats['s2']!.seat, exiled: true } })
    const mine = asTurnOf(s, 's2')
    const open = step(mine, { type: 'callVote', target: 's3' })
    expect(open.rejection).toBeUndefined()
    expect((open.pending.context.data as { eligible: string[] }).eligible).toEqual(['s1', 's3', 's4'])
    expect(step(asTurnOf(s, 's1'), { type: 'callVote', target: 's2' }).rejection?.code).toBe('E_TARGET_INVALID')
    expect(legalPlayerTurnsActions(asTurnOf(s, 's1')).some((a) => a.type === 'callVote' && (a as { target: string }).target === 's2')).toBe(false)
  })

  it('EXIL-011 there is no exile vote in a co-op game', () => {
    const s = table()
    const coop = { ...s, setup: { ...s.setup, variants: { coop: true } } }
    expect(step(coop, { type: 'callVote', target: 's2' }).rejection?.code).toBe('E_FORBIDDEN')
  })

  it('EXIL-008 a second exile with no betrayer morale-zeroes the colony and ends the game', () => {
    const first = exileBy(table(), 's2')
    const placed = place(first.state, MIKE_SPARKY)
    let s = placed.state
    s = { ...s, turn: { ...s.turn!, voteCalled: false }, rng: forceRng([12, 1], [12, 1]) }
    const second = exileBy(s, 's3')
    expect(second.events.find((e) => e.type === 'MoraleChanged')).toMatchObject({ reason: 'doubleExile', after: 0 })
    expect(second.events.find((e) => e.type === 'GameEnded')).toMatchObject({ reason: 'moraleZero' })
    expect(second.state.phase).toBe('ended')
    expect(second.pending.kind).toBe('gameOver')
  })

  it('EXIL-009 with a betrayal objective among the exiled the game continues', () => {
    let s = table()
    s = setSeat(s, 's2', { secretObjectiveId: 'obj.betrayal.x' })
    s = setSeat(s, 's3', { secretObjectiveId: 'obj.secret.y' })
    const first = exileBy(s, 's2')
    const placed = place(first.state, MIKE_SPARKY)
    const again = { ...placed.state, turn: { ...placed.state.turn!, voteCalled: false } }
    const second = exileBy(again, 's3')
    expect(second.state.phase).toBe('playerTurns')
    expect(second.state.morale).toBe(8)
    expect(second.pending).toMatchObject({ kind: 'exilePlacement', seat: 's3' })
    expect(second.state.seats['s3']!.exiledObjectiveId).toBe('obj.exiled.b')
  })

  it('EXIL-001 an exiled seat with nobody at the colony is exiled with no placement decision', () => {
    const s = setSurvivor(setSurvivor(table(), 'sv.mike', { location: 'loc.school' }), 'sv.sparky', { location: 'loc.gas' })
    const r = exileBy(s, 's2')
    expect(r.state.seats['s2']!.seat.exiled).toBe(true)
    expect(r.pending).toMatchObject({ kind: 'turnAction', seat: 's1' })
    expect(r.state.exile).toBeNull()
  })
})
