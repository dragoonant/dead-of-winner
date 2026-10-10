import { describe, expect, it } from 'vitest'
import { beginColonyPhase } from '../../src/engine/colony-phase'
import { svc } from '../../src/engine/exposure'
import { endGame, finalizeEnding } from '../../src/engine/objectives'
import { view } from '../../src/engine/view'
import { makeColony, of, types } from './col-fixture'

describe('game ending', () => {
  it('END-001 morale 1 and a survivor dies: morale 0 ends the game at once; the winners are filled in afterwards', () => {
    const s = makeColony({ morale: 1, secret: { s1: 'obj.betrayal.trigger', s2: 'obj.secret.hunger', s3: 'obj.secret.collector' }, hands: { s1: ['it.weapon', 'it.weapon'] } })
    const raw = svc().killSurvivor(s, 'sv.b', 'wounds')
    expect(of(raw.events, 'MoraleChanged')[0]).toMatchObject({ after: 0 })
    expect(of(raw.events, 'GameEnded')[0]).toMatchObject({ reason: 'moraleZero' })
    expect(raw.state.phase).toBe('ended')
    expect(raw.pending?.kind).toBe('gameOver')
    const fin = finalizeEnding(raw)
    expect(of(fin.events, 'GameEnded')[0]).toMatchObject({ winners: ['s1'] })
    expect(fin.state.result).toMatchObject({ reason: 'moraleZero', winners: ['s1'] })
    expect(finalizeEnding(fin)).toBe(fin) // idempotent
  })

  it('END-002 the last round tick ends the game with reason roundsOut', () => {
    const r = beginColonyPhase(makeColony({ roundsLeft: 1 }))
    expect(of(r.events, 'GameEnded')[0]).toMatchObject({ reason: 'roundsOut', roundsLeft: 0 })
    expect(r.state.phase).toBe('ended')
    expect(r.pending).toMatchObject({ kind: 'gameOver', seat: 'all' })
    expect(r.state.pending).toBe(r.pending)
  })

  it('END-003 winners are the seats whose goal is met; every seat gets an outcome; several winners and none are both possible', () => {
    const base = makeColony({ secret: { s1: 'obj.secret.collector', s2: 'obj.secret.collector', s3: 'obj.secret.hunger' }, hands: { s1: ['it.fuel', 'it.food', 'it.tool'], s2: ['it.fuel', 'it.food', 'it.tool'] }, objective: { complete: true } })
    const two = endGame(base, 'roundsOut')
    expect(of(two.events, 'GameEnded')[0]).toMatchObject({ winners: ['s1', 's2'] })
    expect(Object.values(two.state.seats).map((s) => s.outcome)).toEqual(['won', 'won', 'lost'])
    const none = endGame({ ...base, objective: { ...base.objective, complete: false } }, 'roundsOut')
    expect(of(none.events, 'GameEnded')[0]).toMatchObject({ winners: [] })
    expect(Object.values(none.state.seats).every((s) => s.outcome === 'lost')).toBe(true)
  })

  it('END-004 in co-op every seat wins iff the main objective completed; running out of rounds loses for all', () => {
    const coop = makeColony({ variants: { coop: true }, objective: { counters: { samples: 9 } } })
    const win = beginColonyPhase(coop)
    expect(of(win.events, 'GameEnded')[0]).toMatchObject({ reason: 'objectiveComplete', winners: ['s1', 's2', 's3'] })
    const lose = beginColonyPhase(makeColony({ variants: { coop: true }, roundsLeft: 1 }))
    expect(of(lose.events, 'GameEnded')[0]).toMatchObject({ reason: 'roundsOut', winners: [] })
    expect(Object.values(lose.state.seats).every((s) => s.outcome === 'lost')).toBe(true)
  })

  it('END-005 after the end the view carries a recap with every secret objective, hand and revealed crisis contributor', () => {
    const s = makeColony({ roundsLeft: 1, secret: { s1: 'obj.secret.hunger', s2: 'obj.secret.collector' }, hands: { s2: ['it.fuel'] }, contributions: { s3: ['it.fuel'] } })
    const r = beginColonyPhase(s)
    const v = view(r.state, 's1')
    expect(v.phase).toBe('ended')
    expect(v.recap?.secretObjectives['s2']).toMatchObject({ secret: 'obj.secret.collector', outcome: 'lost' })
    expect(v.recap?.hands['s2']).toHaveLength(1)
    expect(v.recap?.contributions[0]?.revealed.map((c) => c.seat)).toEqual(['s3'])
    expect(v.crisis.history[0]!.result.revealed[0]!.seat).toBe('s3')
  })

  it('END-008 a concession ends the game with nobody winning and still gives every seat an outcome', () => {
    const r = endGame(makeColony({ variants: { coop: true }, objective: { complete: true } }), 'concession')
    expect(of(r.events, 'GameEnded')[0]).toMatchObject({ reason: 'concession', winners: [] })
    expect(Object.values(r.state.seats).every((s) => s.outcome === 'lost')).toBe(true)
    expect(endGame(r.state, 'roundsOut').events).toEqual([]) // an ended game stays ended
    expect(types(r.events)).toEqual(['GameEnded'])
  })

  it('END-007 ending drops every in-flight context (no chain, vote, attack or search survives into gameOver)', () => {
    const s = { ...makeColony(), bite: { location: 'colony', originId: 'sv.a', currentId: 'sv.b', killed: [] }, vote: { caller: 's1', target: 's2', votes: null, result: null } }
    const r = endGame(s, 'moraleZero')
    expect(r.state.bite).toBeNull()
    expect(r.state.vote).toBeNull()
    expect(r.state.pending.kind).toBe('gameOver')
  })
})
