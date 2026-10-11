import { describe, expect, it } from 'vitest'
import type { MoveAction } from '../../src/engine/actions'
import { applyMove, legalMoves, moveTargetsFor } from '../../src/engine/actions/move'
import { setServices } from '../../src/engine/exposure'
import type { GameState } from '../../src/engine/types'
import { GAS, LIBRARY, SCHOOL, forceRng, makeState, of, types } from './atk-fixture'

const move = (s: GameState, survivorId: string, to: string, seat = 's1'): MoveAction => ({ type: 'move', decisionId: s.pending.id, seat, survivorId, to })

describe('moving', () => {
  const start = (rng = forceRng([12, 2]), extra: Parameters<typeof makeState>[0]['survivors'] = []) =>
    makeState({ survivors: [{ id: 'sv.ashley', owner: 's1', location: 'colony' }, ...extra], rng })

  it('MOVE-001 a move changes the location and then rolls exposure', () => {
    const s = start()
    const r = applyMove(s, move(s, 'sv.ashley', SCHOOL))
    expect(types(r.events)).toEqual(['SurvivorMoved', 'ExposureRolled'])
    expect(of(r.events, 'SurvivorMoved')[0]).toMatchObject({ from: 'colony', to: SCHOOL, kind: 'action' })
    expect(of(r.events, 'ExposureRolled')[0]).toMatchObject({ reason: 'move' })
    expect(r.state.survivors['sv.ashley']).toMatchObject({ location: SCHOOL, movedThisTurn: true })
  })

  it('MOVE-002 a survivor moves once per turn', () => {
    const s = start()
    const r = applyMove(s, move(s, 'sv.ashley', SCHOOL))
    expect(applyMove(r.state, move(r.state, 'sv.ashley', LIBRARY)).rejection?.code).toBe('E_ALREADY_MOVED')
    const nextTurn = { ...r.state, survivors: { ...r.state.survivors, 'sv.ashley': { ...r.state.survivors['sv.ashley']!, movedThisTurn: false } } }
    expect(applyMove(nextTurn, move(nextTurn, 'sv.ashley', LIBRARY)).rejection).toBeUndefined()
  })

  it('MOVE-003 and MOVE-004 a full location and the current location are not destinations', () => {
    const s = start(undefined, [{ id: 'sv.mike', owner: 's2', location: GAS }, { id: 'sv.forest', owner: 's2', location: GAS }])
    expect(applyMove(s, move(s, 'sv.ashley', GAS)).rejection?.code).toBe('E_NO_SPACE')
    expect(applyMove(s, move(s, 'sv.ashley', 'colony')).rejection?.code).toBe('E_TARGET_INVALID')
    expect(applyMove(s, move(s, 'sv.ashley', 'loc.nowhere')).rejection?.code).toBe('E_TARGET_INVALID')
  })

  it('MOVE-005 Rod Miller moves without an exposure roll', () => {
    const s = makeState({ survivors: [{ id: 'sv.rod', owner: 's1', location: 'colony' }] })
    const r = applyMove(s, move(s, 'sv.rod', SCHOOL))
    expect(of(r.events, 'ExposureSkipped')[0]).toMatchObject({ sourceId: 'sv.rod', reason: 'move' })
    expect(types(r.events)).not.toContain('ExposureRolled')
  })

  it('MOVE-006 a bite on the move kills at the destination and spreads there, not at the origin', () => {
    const s = makeState({
      survivors: [{ id: 'sv.ashley', owner: 's1', location: 'colony' }, { id: 'sv.mike', owner: 's2', location: SCHOOL }, { id: 'sv.forest', owner: 's2', location: 'colony' }],
      rng: forceRng([12, 12]),
    })
    const r = applyMove(s, move(s, 'sv.ashley', SCHOOL))
    expect(of(r.events, 'BiteSpreadStep')[0]).toMatchObject({ toId: 'sv.mike', location: SCHOOL })
    expect(r.pending).toMatchObject({ kind: 'biteSpreadOption', seat: 's2' })
  })

  it('MOVE-007 a mover who dies on the exposure roll never opens the action.move window', () => {
    const windows: string[] = []
    const s = makeState({ survivors: [{ id: 'sv.ashley', owner: 's1', location: 'colony', wounds: 2 }, { id: 'sv.forest', owner: 's1', location: 'colony' }], rng: forceRng([12, 8]) })
    setServices({ fire: (state, point) => { windows.push(point); return { state, events: [] } } })
    const r = applyMove(s, move(s, 'sv.ashley', SCHOOL))
    expect(of(r.events, 'SurvivorKilled')[0]).toMatchObject({ cause: 'wounds' })
    expect(windows).not.toContain('action.move')
    const ok = makeState({ survivors: [{ id: 'sv.ashley', owner: 's1', location: 'colony' }], rng: forceRng([12, 2]) })
    setServices({ fire: (state, point) => { windows.push(point); return { state, events: [] } } })
    applyMove(ok, move(ok, 'sv.ashley', SCHOOL))
    expect(windows).toContain('action.move')
  })

  it('MOVE-008 the move targets list every other location with room and the exposure it costs', () => {
    const s = start(undefined, [{ id: 'sv.mike', owner: 's2', location: GAS }, { id: 'sv.forest', owner: 's2', location: GAS }])
    const t = moveTargetsFor(s, 'sv.ashley')
    expect(t.map((x) => x.location)).toEqual([SCHOOL, LIBRARY])
    expect(t[0]!.exposure.bite).toBeCloseTo(1 / 12)
    expect(legalMoves(s).length).toBe(2)
  })

  it('MOVE-009 a movement ban stops a live seat but not an exiled one', () => {
    const ban = { id: 'e:1', sourceId: 'cr.blizzard', sourceKind: 'crisis' as const, name: 'blizzard', forbid: ['move'], duration: 'round' as const, expires: null }
    const s = { ...start(), effects: [ban] }
    expect(applyMove(s, move(s, 'sv.ashley', SCHOOL)).rejection?.code).toBe('E_FORBIDDEN')
    const exiled = makeState({ survivors: [{ id: 'sv.ashley', owner: 's1', location: 'colony' }], exiled: ['s1'] })
    expect(applyMove({ ...exiled, effects: [ban] }, move(exiled, 'sv.ashley', SCHOOL)).rejection).toBeUndefined()
  })

  it('MOVE-010 an exiled seat cannot move a survivor back to the colony (digest, Exile)', () => {
    const s = makeState({ survivors: [{ id: 'sv.ashley', owner: 's1', location: SCHOOL }], exiled: ['s1'], dice: { s1: [1] } })
    const r = applyMove(s, move(s, 'sv.ashley', 'colony'))
    expect(r.rejection?.code).toBe('E_TARGET_INVALID')
    expect(legalMoves(s).some((a) => (a as { to: string }).to === 'colony')).toBe(false)
    expect(moveTargetsFor(s, 'sv.ashley').some((t) => t.location === 'colony')).toBe(false)
    expect(applyMove(s, move(s, 'sv.ashley', LIBRARY)).rejection).toBeUndefined() // other locations stay open
  })

  it('MOVE-011 John Price moving away from Rod Miller still skips exposure; copies start after arrival', () => {
    const s = makeState({
      survivors: [{ id: 'sv.price', owner: 's1', location: SCHOOL }, { id: 'sv.rod', owner: 's2', location: SCHOOL }, { id: 'sv.harman', owner: 's2', location: LIBRARY }],
      rng: forceRng([12, 10]),
    })
    const r = applyMove(s, move(s, 'sv.price', LIBRARY))
    expect(of(r.events, 'ExposureSkipped')[0]).toMatchObject({ sourceId: 'sv.rod' })
    const arrive = makeState({ survivors: [{ id: 'sv.price', owner: 's1', location: 'colony' }, { id: 'sv.harman', owner: 's2', location: LIBRARY }], rng: forceRng([12, 10]) })
    const r2 = applyMove(arrive, move(arrive, 'sv.price', LIBRARY))
    expect(of(r2.events, 'WoundTaken')[0]).toMatchObject({ kind: 'frostbite' })
  })

  it('EXPO-013 John Price copies Buddy Davis away from the colony and dies the moment he leaves', () => {
    const s = makeState({
      survivors: [{ id: 'sv.price', owner: 's1', location: SCHOOL, wounds: 3 }, { id: 'sv.buddy', owner: 's2', location: SCHOOL }, { id: 'sv.forest', owner: 's1', location: 'colony' }],
      rng: forceRng([12, 2]),
    })
    expect(s.survivors['sv.price']!.status).toBe('alive')
    const r = applyMove(s, move(s, 'sv.price', LIBRARY))
    expect(of(r.events, 'SurvivorKilled')[0]).toMatchObject({ survivorId: 'sv.price', cause: 'wounds' })
    expect(types(r.events)).not.toContain('ExposureRolled')
  })
})
