import { describe, expect, it } from 'vitest'
import type { SpendFoodAction } from '../../src/engine/actions'
import { applySpendFood, boostDie, checkDie, maxFoodTokens, rollActionDice, spendDie, validateSpendFood } from '../../src/engine/dice'
import { addSurvivor } from '../../src/engine/survivors'
import type { GameEvent } from '../../src/engine/events'
import type { GameState } from '../../src/engine/types'
import { patchSeat } from '../../src/engine/decks'
import { playSetup, setupOf } from './setup-fixture'

const base = (seed = 'dice') => playSetup(setupOf(4), seed).result.state
const ofType = <T extends GameEvent['type']>(events: GameEvent[], type: T) => events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type)
const withDice = (s: GameState, seat: string, values: number[], used: boolean[] = []): GameState =>
  patchSeat(s, seat, { dice: values.map((value, i) => ({ id: `${seat}:d${i + 1}`, value, used: used[i] ?? false })) })
const food = (s: GameState, n: number): GameState => ({ ...s, food: n })
const spend = (seat: string, dieId: string, tokens: number): SpendFoodAction => ({ type: 'spendFood', decisionId: 'd:x', seat, dieId, tokens })

describe('action dice', () => {
  it('DICE-001 a seat rolls 1 + its alive survivors; last round dice (used or not) are gone', () => {
    let s = withDice(base(), 's1', [6, 6, 6], [true, false, true])
    expect(s.seats['s1']!.survivors).toHaveLength(2)
    s = addSurvivor(s, 's1', s.survivorDeck[0]!, 'colony', 'item').state
    const r = rollActionDice(s)
    expect(r.state.seats['s1']!.dice).toHaveLength(4)
    expect(r.state.seats['s2']!.dice).toHaveLength(3)
    expect(r.state.seats['s1']!.dice.every((d) => !d.used && d.value >= 1 && d.value <= 6)).toBe(true)
    expect(r.state.seats['s1']!.dice.map((d) => d.id)).toEqual(['s1:d1', 's1:d2', 's1:d3', 's1:d4'])
    expect(ofType(r.events, 'ActionDiceRolled')).toHaveLength(4)
    expect(ofType(r.events, 'DiceRolled').every((e) => e.purpose === 'actionDice')).toBe(true)
  })

  it('DICE-002 a survivor added mid-round gives no die until the next roll step, which then counts it', () => {
    const s0 = base('dice-2')
    const diceBefore = s0.seats['s1']!.dice.length
    const s1 = addSurvivor(s0, 's1', s0.survivorDeck[0]!, 'colony', 'item').state
    expect(s1.seats['s1']!.dice).toHaveLength(diceBefore)
    expect(rollActionDice(s1).state.seats['s1']!.dice).toHaveLength(diceBefore + 1)
  })

  it('DICE-001b rolling is deterministic on the seeded stream, advances rollSeq once per seat; eliminated seats roll nothing', () => {
    const s = base('dice-det')
    const a = rollActionDice(s)
    const b = rollActionDice(s)
    expect(a.state.seats['s2']!.dice).toEqual(b.state.seats['s2']!.dice)
    expect(a.state.rollSeq).toBe(s.rollSeq + 4)
    const out = patchSeat(s, 's3', { seat: { ...s.seats['s3']!.seat, eliminated: true }, dice: [] })
    expect(rollActionDice(out).state.seats['s3']!.dice).toHaveLength(0)
  })

  it('DICE-003 both of a seat dice may be spent on the same survivor in one turn', () => {
    let s = withDice(base(), 's1', [4, 5, 2])
    const sv = s.seats['s1']!.survivors[0]!
    for (const id of ['s1:d1', 's1:d2']) {
      expect(checkDie(s, 's1', id)).toBeNull()
      const r = spendDie(s, 's1', id, { purpose: 'attack', survivorId: sv, need: 2 })
      s = r.state
      expect(r.events[0]).toMatchObject({ type: 'DieSpent', dieId: id, survivorId: sv })
    }
    expect(s.seats['s1']!.dice.map((d) => d.used)).toEqual([true, true, false])
  })

  it('DICE-004 a die below the survivor value is E_DIE_TOO_LOW; at the value it is accepted and DieSpent carries need', () => {
    const s = withDice(base(), 's1', [3, 4, 6])
    expect(checkDie(s, 's1', 's1:d1', 4)?.code).toBe('E_DIE_TOO_LOW')
    expect(checkDie(s, 's1', 's1:d2', 4)).toBeNull()
    expect(spendDie(s, 's1', 's1:d2', { purpose: 'attack', need: 4 }).events[0]).toMatchObject({ value: 4, need: 4 })
  })

  it('DICE-005 a used die is E_DIE_USED; a die the seat does not own is E_NO_DIE', () => {
    const s = withDice(withDice(base(), 's1', [3, 3, 3], [true]), 's2', [5, 5, 5])
    expect(checkDie(s, 's1', 's1:d1')?.code).toBe('E_DIE_USED')
    expect(checkDie(s, 's1', 's2:d1')?.code).toBe('E_NO_DIE')
  })

  it('DICE-006 spendFood 2 on a die showing 3 with food 5 gives die 5, DieBoosted(food), FoodChanged -2', () => {
    const s = food(withDice(base(), 's1', [3, 3, 3]), 5)
    const a = spend('s1', 's1:d1', 2)
    expect(validateSpendFood(s, a)).toBeNull()
    const r = applySpendFood(s, a)
    expect(r.state.seats['s1']!.dice[0]).toMatchObject({ value: 5, foodSpent: 2, used: false })
    expect(r.state.food).toBe(3)
    expect(ofType(r.events, 'DieBoosted')[0]).toMatchObject({ from: 3, to: 5, source: 'food' })
    expect(ofType(r.events, 'FoodChanged')[0]).toMatchObject({ delta: -2, after: 3, reason: 'spendOnDie' })
  })

  it('DICE-007 spendFood past 6 is E_DIE_MAX (die 5 + 2; die 6 + 1)', () => {
    const s = food(withDice(base(), 's1', [5, 6, 1]), 5)
    expect(validateSpendFood(s, spend('s1', 's1:d1', 2))?.code).toBe('E_DIE_MAX')
    expect(validateSpendFood(s, spend('s1', 's1:d2', 1))?.code).toBe('E_DIE_MAX')
    expect(validateSpendFood(s, spend('s1', 's1:d1', 1))).toBeNull()
  })

  it('DICE-008 spendFood on a used die is E_DIE_USED; with no unused die nothing can be spent', () => {
    const s = food(withDice(base(), 's1', [2, 2, 2], [true, true, true]), 5)
    expect(validateSpendFood(s, spend('s1', 's1:d1', 1))?.code).toBe('E_DIE_USED')
    expect(maxFoodTokens(s, 's1')).toBe(0)
    expect(maxFoodTokens(withDice(s, 's1', [2, 6]), 's1')).toBe(4)
  })

  it('DICE-009 spendFood with food 0 is E_NO_FOOD; zero or fractional tokens are E_BAD_PAYLOAD', () => {
    const s = food(withDice(base(), 's1', [3, 3, 3]), 0)
    expect(validateSpendFood(s, spend('s1', 's1:d1', 1))?.code).toBe('E_NO_FOOD')
    expect(validateSpendFood(s, spend('s1', 's1:d1', 0))?.code).toBe('E_BAD_PAYLOAD')
    expect(validateSpendFood(s, spend('s1', 's1:d1', 1.5))?.code).toBe('E_BAD_PAYLOAD')
  })

  it('DICE-014 barricade, clean waste and attract take a die of any value, a 1 included', () => {
    expect(checkDie(withDice(base(), 's1', [1, 1, 1]), 's1', 's1:d1')).toBeNull()
  })

  it('DICE-016 an exiled seat cannot spend food on dice (E_EXILED)', () => {
    let s = food(withDice(base(), 's2', [3, 3, 3]), 5)
    s = patchSeat(s, 's2', { seat: { ...s.seats['s2']!.seat, exiled: true } })
    expect(validateSpendFood(s, spend('s2', 's2:d1', 1))?.code).toBe('E_EXILED')
    expect(maxFoodTokens(s, 's2')).toBe(0)
  })

  it('DICE-010 boostDie raises an unused die, clamps at 6, and emits DieBoosted for its source', () => {
    const s = withDice(base(), 's1', [2, 6, 3])
    const r = boostDie(s, 's1', 's1:d1', 3, 'ability')
    expect(r.state.seats['s1']!.dice[0]!.value).toBe(3)
    expect(r.events[0]).toMatchObject({ type: 'DieBoosted', from: 2, to: 3, source: 'ability' })
    expect(boostDie(s, 's1', 's1:d2', 9, 'item').events).toHaveLength(0)
  })

  it('DICE-011 the roll step resets survivor ability uses and once-per-round item uses', () => {
    let s = patchSeat(base(), 's1', { abilityUses: { 'sv.brian-lee|boost': 1 } })
    s = { ...s, cardUses: { 'c:1': { lighter: 1 } } }
    const r = rollActionDice(s).state
    expect(r.seats['s1']!.abilityUses).toEqual({})
    expect(r.cardUses).toEqual({})
  })
})
