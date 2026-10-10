import { describe, expect, it } from 'vitest'
import type { AttractAction, BarricadeAction } from '../../src/engine/actions'
import { applyAttract } from '../../src/engine/actions/attract'
import { applyBarricade } from '../../src/engine/actions/barricade'
import { patchEntrance, patchLocation } from '../../src/engine/exposure'
import type { GameState } from '../../src/engine/types'
import { addZombies, emptySpacesAt, killZombie, zombiesAt } from '../../src/engine/zombies'
import { GAS, LIBRARY, SCHOOL, act, makeState, of, types } from './atk-fixture'

const withZombies = (s: GameState, loc: string, idx: number, zombies: number, barricades = 0) => patchEntrance(s, loc, idx, { zombies, barricades })

describe('adding zombies', () => {
  it('ZOM-001 seven zombies rotate through the colony entrances 1..6 then 1', () => {
    const s = makeState({ survivors: [{ id: 'sv.ashley', owner: 's1', location: SCHOOL }] })
    const r = addZombies(s, 'colony', 7, 'colonyStep')
    expect(of<{ entrance: number }>(r.events, 'ZombieAdded').map((e) => e.entrance)).toEqual([1, 2, 3, 4, 5, 6, 1])
    expect(r.state.locations['colony']!.entrances[0]!.zombies).toBe(2)
  })

  it('ZOM-002 a full entrance is overrun and the lowest influence at the colony dies; the rotation goes on', () => {
    const base = makeState({ survivors: [{ id: 'sv.sparky', owner: 's1', location: 'colony' }, { id: 'sv.mike', owner: 's2', location: 'colony' }, { id: 'sv.extra', owner: 's1', location: SCHOOL }] })
    const r = addZombies(withZombies(base, 'colony', 3, 3), 'colony', 7, 'colonyStep')
    expect(of(r.events, 'EntranceOverrun')[0]).toMatchObject({ entrance: 3, killed: 'sv.sparky' })
    expect(of(r.events, 'SurvivorKilled')[0]).toMatchObject({ cause: 'overrun', survivorId: 'sv.sparky' })
    expect(of(r.events, 'MoraleChanged')[0]).toMatchObject({ delta: -1 })
    expect(of<{ entrance: number }>(r.events, 'ZombieAdded').map((e) => e.entrance)).toEqual([1, 2, 4, 5, 6, 1])
  })

  it('ZOM-003 a full entrance with a barricade loses the barricade instead', () => {
    const base = makeState({ survivors: [{ id: 'sv.mike', owner: 's2', location: 'colony' }] })
    const r = addZombies(withZombies(base, 'colony', 1, 2, 1), 'colony', 1, 'colonyStep')
    expect(of(r.events, 'BarricadeDestroyed')[0]).toMatchObject({ entrance: 1, barricades: 0 })
    expect(types(r.events)).not.toContain('ZombieAdded')
    expect(r.state.locations['colony']!.entrances[0]).toMatchObject({ zombies: 2, barricades: 0 })
  })

  it('ZOM-004 an overrun with only helpless tokens kills one helpless token', () => {
    const base = patchLocation(makeState({ survivors: [{ id: 'sv.mike', owner: 's2', location: SCHOOL }] }), 'colony', { helpless: 2 })
    const r = addZombies(withZombies(base, 'colony', 1, 3), 'colony', 1, 'colonyStep')
    expect(of(r.events, 'HelplessKilled')[0]).toMatchObject({ count: 1, moraleLoss: true, after: 1 })
    expect(of(r.events, 'MoraleChanged')[0]).toMatchObject({ delta: -1 })
  })

  it('ZOM-005 an overrun with nobody there does nothing more', () => {
    const base = makeState({ survivors: [{ id: 'sv.mike', owner: 's2', location: SCHOOL }] })
    const r = addZombies(withZombies(base, 'colony', 1, 3), 'colony', 1, 'colonyStep')
    expect(of(r.events, 'EntranceOverrun')[0]).toMatchObject({ killed: null })
    expect(types(r.events)).toEqual(['ZombiesToAdd', 'EntranceOverrun'])
  })

  it('ZOM-006 and ZOM-008 overrun kills the lowest influence of ANY seat, and an exiled owner costs no morale', () => {
    const base = makeState({
      survivors: [{ id: 'sv.mike', owner: 's1', location: 'colony' }, { id: 'sv.forest', owner: 's2', location: 'colony' }, { id: 'sv.extra', owner: 's2', location: SCHOOL }],
      exiled: ['s2'],
    })
    const r = addZombies(withZombies(base, 'colony', 1, 3), 'colony', 1, 'colonyStep')
    expect(of(r.events, 'SurvivorKilled')[0]).toMatchObject({ survivorId: 'sv.forest', moraleLoss: false })
    expect(types(r.events)).not.toContain('MoraleChanged')
  })

  it('ZOM-007 a card location has one entrance: place, then overrun, then overrun again', () => {
    const base = makeState({ survivors: [{ id: 'sv.forest', owner: 's1', location: SCHOOL }, { id: 'sv.mike', owner: 's2', location: SCHOOL }, { id: 'sv.extra', owner: 's1', location: 'colony' }] })
    const r = addZombies(withZombies(base, SCHOOL, 1, 2), SCHOOL, 4, 'locationStep')
    expect(of(r.events, 'ZombieAdded')).toHaveLength(1)
    expect(of(r.events, 'EntranceOverrun')).toHaveLength(3)
    expect(of<{ survivorId: string }>(r.events, 'SurvivorKilled').map((e) => e.survivorId)).toEqual(['sv.forest', 'sv.mike'])
  })

  it('ZOM-009 an overrun that takes the last survivor of a seat brings in a replacement and the step goes on', () => {
    const base = makeState({ survivors: [{ id: 'sv.sparky', owner: 's1', location: 'colony' }, { id: 'sv.mike', owner: 's2', location: SCHOOL }], hands: { s1: ['c:fuel1'] } })
    const r = addZombies(withZombies(base, 'colony', 1, 3), 'colony', 2, 'colonyStep')
    expect(types(r.events)).toEqual(expect.arrayContaining(['EntranceOverrun', 'SurvivorKilled', 'HandDiscarded', 'SurvivorAdded', 'LeaderChosen']))
    expect(of(r.events, 'SurvivorAdded')[0]).toMatchObject({ source: 'lastSurvivor', location: 'colony' })
    expect(of(r.events, 'ZombieAdded')).toHaveLength(1)
    expect(r.remaining).toBe(0)
  })

  it('ZOM-009b a killed leader with followers left stops the step on the newLeader decision and reports what remains', () => {
    const base = makeState({ survivors: [{ id: 'sv.sparky', owner: 's1', location: 'colony' }, { id: 'sv.forest', owner: 's1', location: SCHOOL }, { id: 'sv.extra', owner: 's1', location: SCHOOL }, { id: 'sv.mike', owner: 's2', location: SCHOOL }] })
    const r = addZombies(withZombies(base, 'colony', 1, 3), 'colony', 3, 'colonyStep')
    expect(r.pending).toMatchObject({ kind: 'newLeader', seat: 's1' })
    expect(r.remaining).toBe(2)
    expect(r.nextIndex).toBe(1)
  })

  it('ZOM-012 a barricade takes a space: capacity 3 with one barricade accepts two zombies, the third breaks it', () => {
    const base = makeState({ survivors: [{ id: 'sv.mike', owner: 's2', location: SCHOOL }] })
    const r = addZombies(withZombies(base, 'colony', 2, 0, 1), 'colony', 14, 'colonyStep')
    expect(r.state.locations['colony']!.entrances[1]).toMatchObject({ zombies: 2, barricades: 0 })
  })

  it('ZOM-017 killing at one colony entrance leaves the others alone, and counts are never capped', () => {
    let s = makeState({ survivors: [{ id: 'sv.mike', owner: 's2', location: SCHOOL }] })
    s = withZombies(withZombies(s, 'colony', 4, 2), 'colony', 1, 1)
    const k = killZombie(s, 'colony', 4, 'sv.mike')
    expect(k.state.locations['colony']!.entrances.map((e) => e.zombies)).toEqual([1, 0, 0, 1, 0, 0])
    expect(of(k.events, 'ZombieKilled')[0]).toMatchObject({ entrance: 4, zombies: 1 })
    expect(zombiesAt(addZombies(s, SCHOOL, 0, 'setup').state, 'colony')).toBe(3)
  })
})

describe('barricades', () => {
  const barricade = (s: GameState, entrance: number): BarricadeAction => act(s, { type: 'barricade', survivorId: 'sv.ashley', dieId: 's1:d1', entrance }) as BarricadeAction
  it('ZOM-011 a barricade needs an empty space; a card location only has entrance 1', () => {
    const s = makeState({ survivors: [{ id: 'sv.ashley', owner: 's1', location: 'colony' }], dice: { s1: [1, 1] } })
    const r = applyBarricade(s, barricade(s, 2))
    expect(of(r.events, 'BarricadeAdded')[0]).toMatchObject({ entrance: 2, barricades: 1 })
    const full = applyBarricade(withZombies(s, 'colony', 2, 3), barricade(s, 2))
    expect(full.rejection?.code).toBe('E_NO_SPACE')
    const school = makeState({ survivors: [{ id: 'sv.ashley', owner: 's1', location: SCHOOL }], dice: { s1: [1] } })
    expect(applyBarricade(school, barricade(school, 2)).rejection?.code).toBe('E_TARGET_INVALID')
    expect(applyBarricade(school, barricade(school, 1)).rejection).toBeUndefined()
  })
})

describe('attract', () => {
  const attract = (s: GameState, from: AttractAction['from']): AttractAction => act(s, { type: 'attract', survivorId: 'sv.ashley', dieId: 's1:d1', from }) as AttractAction
  const board = (extra: (s: GameState) => GameState = (s) => s) => {
    let s = makeState({ survivors: [{ id: 'sv.ashley', owner: 's1', location: 'colony' }], dice: { s1: [1, 1] } })
    s = withZombies(s, SCHOOL, 1, 1)
    s = withZombies(s, LIBRARY, 1, 1)
    return extra(s)
  }

  it('ZOM-013 two zombies arrive in the lowest empty colony entrances', () => {
    const s = board()
    const r = applyAttract(s, attract(s, [{ location: SCHOOL, entrance: 1, count: 1 }, { location: LIBRARY, entrance: 1, count: 1 }]))
    expect(of(r.events, 'ZombieMoved')).toHaveLength(2)
    expect(r.state.locations['colony']!.entrances.map((e) => e.zombies).slice(0, 2)).toEqual([2, 0])
    expect(zombiesAt(r.state, SCHOOL) + zombiesAt(r.state, LIBRARY)).toBe(0)
  })

  it('ZOM-014 only the zombies that fit move, and never by breaking a barricade', () => {
    const s = board((b) => {
      let x = b
      for (let i = 1; i <= 6; i++) x = withZombies(x, 'colony', i, i === 6 ? 2 : 3)
      return x
    })
    expect(emptySpacesAt(s, 'colony')).toBe(1)
    const r = applyAttract(s, attract(s, [{ location: SCHOOL, entrance: 1, count: 1 }, { location: LIBRARY, entrance: 1, count: 1 }]))
    expect(of(r.events, 'ZombieMoved')).toHaveLength(1)
    expect(zombiesAt(r.state, SCHOOL) + zombiesAt(r.state, LIBRARY)).toBe(1)
    const none = board((b) => { let x = b; for (let i = 1; i <= 6; i++) x = withZombies(x, 'colony', i, 3); return x })
    expect(applyAttract(none, attract(none, [{ location: SCHOOL, entrance: 1, count: 1 }])).rejection?.code).toBe('E_NO_SPACE')
  })

  it('ZOM-015 bad counts are rejected', () => {
    const s = board()
    expect(applyAttract(s, attract(s, [{ location: SCHOOL, entrance: 1, count: 2 }])).rejection?.code).toBe('E_NO_ZOMBIE')
    expect(applyAttract(s, attract(s, [{ location: SCHOOL, entrance: 1, count: 1 }, { location: LIBRARY, entrance: 1, count: 1 }, { location: GAS, entrance: 1, count: 1 }])).rejection?.code).toBe('E_BAD_PAYLOAD')
  })

  it('ZOM-016 one zombie on the board moves that one; none is an error', () => {
    const one = makeState({ survivors: [{ id: 'sv.ashley', owner: 's1', location: 'colony' }], dice: { s1: [1] } })
    const s = withZombies(one, SCHOOL, 1, 1)
    expect(of(applyAttract(s, attract(s, [{ location: SCHOOL, entrance: 1, count: 1 }])).events, 'ZombieMoved')).toHaveLength(1)
    expect(applyAttract(one, attract(one, [{ location: SCHOOL, entrance: 1, count: 1 }])).rejection?.code).toBe('E_NO_ZOMBIE')
  })
})
