import { describe, expect, it } from 'vitest'
import type { AttackAction } from '../../src/engine/actions'
import { applyAttack, attackSurvivorOdds, attackSurvivorOddsFor, legalAttacks } from '../../src/engine/actions/attack'
import { patchEntrance, setServices } from '../../src/engine/exposure'
import type { GameState } from '../../src/engine/types'
import { SCHOOL, forceRng, makeState, of, types } from './atk-fixture'

const zombieAttack = (s: GameState, survivorId: string, location: string, entrance = 1, dieId = 's1:d1'): AttackAction =>
  ({ type: 'attack', decisionId: s.pending.id, seat: 's1', survivorId, dieId, target: { kind: 'zombie', location, entrance } })
const survivorAttack = (s: GameState, survivorId: string, targetId: string, dieId = 's1:d1'): AttackAction =>
  ({ type: 'attack', decisionId: s.pending.id, seat: 's1', survivorId, dieId, target: { kind: 'survivor', survivorId: targetId } })
const withZombie = (s: GameState, loc = SCHOOL, idx = 1) => patchEntrance(s, loc, idx, { zombies: 1 })

describe('attacking a zombie', () => {
  const base = (rng = forceRng([12, 7])) => withZombie(makeState({ survivors: [{ id: 'sv.ashley', owner: 's1', location: SCHOOL }], dice: { s1: [4] }, rng }))

  it('ATK-001 and ATK-002 a qualifying die kills the zombie, then exposure; a wound face wounds', () => {
    const s = base()
    const r = applyAttack(s, zombieAttack(s, 'sv.ashley', SCHOOL))
    expect(r.rejection).toBeUndefined()
    expect(types(r.events)).toEqual(['AttackDeclared', 'DieSpent', 'ZombieKilled', 'ExposureRolled', 'WoundTaken'])
    expect(of(r.events, 'AttackDeclared')[0]).toMatchObject({ need: 2 })
    expect(of(r.events, 'ZombieKilled')[0]).toMatchObject({ zombies: 0 })
    expect(of(r.events, 'ExposureRolled')[0]).toMatchObject({ reason: 'zombieKill' })
    expect(of(r.events, 'WoundTaken')[0]).toMatchObject({ kind: 'wound', wounds: 1 })
    expect(r.state.seats['s1']!.dice[0]!.used).toBe(true)
    expect(r.pending.kind).toBe('turnAction')
    expect(r.state.turn!.actions).toBe(1)
  })

  it('ATK-003 wrong location and an empty entrance are rejected', () => {
    const s = base()
    expect(applyAttack(s, zombieAttack(s, 'sv.ashley', 'colony')).rejection?.code).toBe('E_WRONG_LOCATION')
    const empty = makeState({ survivors: [{ id: 'sv.ashley', owner: 's1', location: SCHOOL }], dice: { s1: [4] } })
    expect(applyAttack(empty, zombieAttack(empty, 'sv.ashley', SCHOOL)).rejection?.code).toBe('E_NO_ZOMBIE')
    const low = makeState({ survivors: [{ id: 'sv.forest', owner: 's1', location: SCHOOL }], dice: { s1: [3] } })
    expect(applyAttack(withZombie(low), zombieAttack(low, 'sv.forest', SCHOOL)).rejection?.code).toBe('E_DIE_TOO_LOW')
  })

  it('ATK-004 at the colony the attacker names the entrance', () => {
    let s = makeState({ survivors: [{ id: 'sv.ashley', owner: 's1', location: 'colony' }], dice: { s1: [4] }, rng: forceRng([12, 1]) })
    s = patchEntrance(patchEntrance(s, 'colony', 5, { zombies: 1 }), 'colony', 1, { zombies: 1 })
    const r = applyAttack(s, zombieAttack(s, 'sv.ashley', 'colony', 5))
    expect(r.state.locations['colony']!.entrances.map((e) => e.zombies)).toEqual([1, 0, 0, 0, 0, 0])
  })

  it('ATK-012 Mike Cho never rolls exposure after a kill', () => {
    const s = withZombie(makeState({ survivors: [{ id: 'sv.mike', owner: 's1', location: SCHOOL }], dice: { s1: [4] } }))
    const r = applyAttack(s, zombieAttack(s, 'sv.mike', SCHOOL))
    expect(of(r.events, 'ExposureSkipped')[0]).toMatchObject({ sourceId: 'sv.mike' })
    expect(types(r.events)).not.toContain('ExposureRolled')
  })

  it('ATK-014 the zombie.killed window opens for objective triggers', () => {
    const seen: string[] = []
    const s = base()
    setServices({ fire: (state, point) => { seen.push(point); return { state, events: [] } } })
    applyAttack(s, zombieAttack(s, 'sv.ashley', SCHOOL))
    expect(seen).toContain('zombie.killed')
    expect(seen).toContain('action.attack')
  })
})

describe('attacking a survivor', () => {
  const duel = (roll: number, o: { hand?: string[]; mikeWounds?: number } = {}) => {
    const hand = o.hand ?? ['c:fuel1', 'c:food1']
    return makeState({
      survivors: [
        { id: 'sv.ashley', owner: 's1', location: SCHOOL }, { id: 'sv.mike', owner: 's2', location: SCHOOL, wounds: o.mikeWounds }, { id: 'sv.forest', owner: 's2', location: 'colony' },
      ],
      dice: { s1: [3] }, hands: { s2: hand }, rng: forceRng([6, roll], [Math.max(1, hand.length), 1]),
    })
  }

  it('ATK-005 a low re-roll hits: a wound, a stolen card, no exposure', () => {
    const s = duel(1)
    const r = applyAttack(s, survivorAttack(s, 'sv.ashley', 'sv.mike'))
    expect(of(r.events, 'SurvivorAttacked')[0]).toMatchObject({ roll: 1, targetAttack: 2, hit: true })
    expect(of(r.events, 'WoundTaken')[0]).toMatchObject({ survivorId: 'sv.mike', source: 'attack' })
    expect(of(r.events, 'CardStolen')[0]).toMatchObject({ from: 's2', to: 's1' })
    expect(types(r.events)).not.toContain('ExposureRolled')
    expect(r.state.seats['s1']!.hand).toHaveLength(1)
    expect(r.state.seats['s2']!.hand).toHaveLength(1)
  })

  it('ATK-006 and ATK-007 a high re-roll misses; the roll is a fresh d6, not the spent die', () => {
    const s = duel(3)
    const r = applyAttack(s, survivorAttack(s, 'sv.ashley', 'sv.mike'))
    expect(of(r.events, 'SurvivorAttacked')[0]).toMatchObject({ roll: 3, hit: false })
    expect(types(r.events)).not.toContain('WoundTaken')
    expect(types(r.events)).not.toContain('CardStolen')
    expect(of(r.events, 'DiceRolled')[0]).toMatchObject({ purpose: 'attackSurvivor', dice: [3] })
    expect(of(r.events, 'DieSpent')[0]).toMatchObject({ value: 3 })
  })

  it('ATK-008 a hit on an empty hand steals nothing', () => {
    const s = duel(1, { hand: [] })
    const r = applyAttack(s, survivorAttack(s, 'sv.ashley', 'sv.mike'))
    expect(types(r.events)).toContain('WoundTaken')
    expect(types(r.events)).not.toContain('CardStolen')
  })

  it('ATK-009 a killing hit: wound, death, morale, and the steal still happens', () => {
    const s = duel(1, { mikeWounds: 2 })
    const r = applyAttack(s, survivorAttack(s, 'sv.ashley', 'sv.mike'))
    expect(types(r.events).filter((t) => ['WoundTaken', 'SurvivorKilled', 'MoraleChanged', 'CardStolen'].includes(t))).toEqual(['WoundTaken', 'SurvivorKilled', 'MoraleChanged', 'CardStolen'])
    expect(of(r.events, 'SurvivorKilled')[0]).toMatchObject({ cause: 'wounds' })
  })

  it('ATK-010 and ATK-011 own survivors, helpless tokens, other places and the dead are not targets', () => {
    const s = makeState({
      survivors: [{ id: 'sv.ashley', owner: 's1', location: SCHOOL }, { id: 'sv.extra', owner: 's1', location: SCHOOL }, { id: 'sv.mike', owner: 's2', location: 'colony' }, { id: 'sv.forest', owner: 's2', location: SCHOOL }],
      dice: { s1: [3] },
    })
    expect(applyAttack(s, survivorAttack(s, 'sv.ashley', 'sv.extra')).rejection?.code).toBe('E_OWN_SURVIVOR')
    expect(applyAttack(s, survivorAttack(s, 'sv.ashley', 'helpless:1')).rejection?.code).toBe('E_HELPLESS_TARGET')
    expect(applyAttack(s, survivorAttack(s, 'sv.ashley', 'sv.mike')).rejection?.code).toBe('E_WRONG_LOCATION')
    const dead = { ...s, survivors: { ...s.survivors, 'sv.forest': { ...s.survivors['sv.forest']!, status: 'dead' as const, owner: null } } }
    expect(applyAttack(dead, survivorAttack(dead, 'sv.ashley', 'sv.forest')).rejection?.code).toBe('E_SURVIVOR_DEAD')
  })

  it('ATK-013 the odds: hit is roll at most the target value; steal needs cards', () => {
    expect(attackSurvivorOdds({ targetAttack: 2, targetWounds: 0, targetFrostbite: 0, targetHandCount: 1 })).toMatchObject({ pHit: 1 / 3, stealsCard: true, pKillTarget: 0 })
    expect(attackSurvivorOdds({ targetAttack: 4, targetWounds: 2, targetFrostbite: 0, targetHandCount: 0 })).toMatchObject({ pHit: 2 / 3, stealsCard: false, pKillTarget: 2 / 3 })
    const s = duel(1)
    expect(attackSurvivorOddsFor(s, 'sv.mike')).toMatchObject({ pHit: 1 / 3, stealsCard: true })
  })
})

describe('turn plumbing shared by the die actions', () => {
  const s = withZombie(makeState({ survivors: [{ id: 'sv.ashley', owner: 's1', location: SCHOOL }, { id: 'sv.mike', owner: 's2', location: SCHOOL }], dice: { s1: [4] } }))

  it('ACT-001 and ACT-002 a wrong decision or seat is rejected and nothing changes', () => {
    const wrongId = applyAttack(s, { ...zombieAttack(s, 'sv.ashley', SCHOOL), decisionId: 'd:99' })
    expect(wrongId.rejection?.code).toBe('E_WRONG_DECISION')
    expect(wrongId.state).toBe(s)
    expect(types(wrongId.events)).toEqual(['ActionRejected'])
    expect(wrongId.pending).toBe(s.pending)
    expect(applyAttack(s, { ...zombieAttack(s, 'sv.ashley', SCHOOL), seat: 's2' }).rejection?.code).toBe('E_NOT_YOUR_DECISION')
  })

  it('ACT-006 a survivor you do not control, or a dead one, cannot act', () => {
    expect(applyAttack(s, zombieAttack(s, 'sv.mike', SCHOOL)).rejection?.code).toBe('E_NOT_YOUR_SURVIVOR')
    const dead = { ...s, survivors: { ...s.survivors, 'sv.ashley': { ...s.survivors['sv.ashley']!, status: 'dead' as const, owner: null } } }
    expect(applyAttack(dead, zombieAttack(dead, 'sv.ashley', SCHOOL)).rejection?.code).toBe('E_SURVIVOR_DEAD')
  })

  it('ACT-009 nothing is legal after the game ends', () => {
    expect(applyAttack({ ...s, phase: 'ended' }, zombieAttack(s, 'sv.ashley', SCHOOL)).rejection?.code).toBe('E_GAME_OVER')
  })

  it('ACT-010 one survivor can attack several times with several dice, and each attack counts', () => {
    let st = makeState({ survivors: [{ id: 'sv.ashley', owner: 's1', location: SCHOOL }], dice: { s1: [4, 5, 6] }, rng: forceRng([12, 1], [12, 1], [12, 1]) })
    st = patchEntrance(st, SCHOOL, 1, { zombies: 3 })
    for (const die of ['s1:d1', 's1:d2', 's1:d3']) {
      const r = applyAttack(st, zombieAttack(st, 'sv.ashley', SCHOOL, 1, die))
      expect(r.rejection).toBeUndefined()
      st = r.state
    }
    expect(st.turn!.actions).toBe(3)
    expect(st.locations[SCHOOL]!.entrances[0]!.zombies).toBe(0)
  })

  it('ACT-003 every candidate attack passes validation', () => {
    const list = legalAttacks(s)
    expect(list.length).toBeGreaterThan(0)
    for (const a of list) expect(applyAttack(s, a as AttackAction).rejection).toBeUndefined()
  })
})
