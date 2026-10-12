// Golden checks for the M2 code hooks (src/engine/code-hooks.ts) on a game built from the default bundle (src/data).
import { beforeAll, describe, expect, it } from 'vitest'
import { createRandomDecider } from '../../src/ai/random'
import { CODE_HOOKS } from '../../src/engine/code-hooks'
import { createGame, legalActions, step, view } from '../../src/engine/index'
import type { GameState } from '../../src/engine/types'
import { setupFor } from '../../tools/sim-core'
import { loadDefaultBundle } from '../../tools/default-bundle'

let base: GameState
beforeAll(async () => {
  const decider = createRandomDecider('m2-hooks')
  let r = createGame(setupFor(4, 'obj.main.stockpile'), 'm2-hooks', loadDefaultBundle())
  while (r.state.phase === 'setup') {
    const a = await decider.decide(view(r.state, r.pending.seat === 'all' ? 's1' : r.pending.seat), r.pending, legalActions(r.state))
    r = step(r.state, a)
  }
  base = r.state
})

const fx = (name: string, state: GameState, seat = 's1', params: Record<string, unknown> = {}) =>
  CODE_HOOKS.effects[name]!({ state, point: 'passive', seat, params }, params)
const alive = (s: GameState) => Object.values(s.survivors).filter((v) => v.status === 'alive')

describe('M2 code hooks', () => {
  it('registers every name the data uses', () => {
    for (const n of ['crisis.exhaustion.frostbiteTopFive', 'crisis.hailstorm.frostbiteRolls', 'crisis.no-waste.foodToWaste', 'crisis.overpopulation.killLowestTwo', 'crisis.reorganization.passSurvivors',
      'crossroads.bev-russel.schoolWound', 'crossroads.bev-russel.clearSchool', 'crossroads.old-divisions.skipCrisis', 'objective.kill-them.removeExiledSeat', 'objective.winter-has-come.fuelOrEnd']) expect(CODE_HOOKS.effects[n], n).toBeTypeOf('function')
    for (const n of ['rule.zombies-outside-colony.atMost', 'rule.non-exiled-seats.weaponEach', 'rule.hand.mostCards', 'rule.food.perNonExiledSeatAtLeast', 'rule.colony.everyEntranceBarricaded']) expect(CODE_HOOKS.objectives[n], n).toBeTypeOf('function')
  })

  it('exhaustion puts frostbite on the five highest-influence survivors', () => {
    const r = fx('crisis.exhaustion.frostbiteTopFive', base)
    expect(alive(r.state).filter((v) => v.frostbite > 0).length).toBe(Math.min(5, alive(base).length))
  })

  it('overpopulation kills the two lowest-influence survivors and each kill costs morale', () => {
    const r = fx('crisis.overpopulation.killLowestTwo', base)
    expect(alive(r.state).length).toBe(alive(base).length - 2)
    expect(r.state.morale).toBe(base.morale - 2)
  })

  it('reorganization hands one survivor to the next seat and keeps every seat consistent', () => {
    const r = fx('crisis.reorganization.passSurvivors', base)
    expect(alive(r.state).length).toBe(alive(base).length)
    for (const id of r.state.seatOrder) {
      const st = r.state.seats[id]!
      expect(st.survivors.length).toBe(base.seats[id]!.survivors.length)
      for (const sid of st.survivors) expect(r.state.survivors[sid]!.owner).toBe(id)
      expect(st.survivors).toContain(st.leaderId)
    }
    expect(r.state.seats['s2']!.survivors.some((id) => base.seats['s1']!.survivors.includes(id))).toBe(true)
  })

  it('hailstorm rolls one d6 per seat', () => {
    const r = fx('crisis.hailstorm.frostbiteRolls', base)
    expect(r.events.filter((e) => e.type === 'DiceRolled').length).toBe(4)
  })

  it('no-waste moves removed food cards to the waste pile', () => {
    const anyFood = Object.keys(base.cards).find((id) => (loadDefaultBundle().byId[base.cards[id]!.defId] as { symbol?: string }).symbol === 'food')!
    const s = { ...base, removed: [anyFood] }
    const r = fx('crisis.no-waste.foodToWaste', s)
    expect(r.state.removed).not.toContain(anyFood)
    expect(r.state.waste).toContain(anyFood)
  })

  it('kill-them removes an exiled seat, its survivors and its hand', () => {
    const s: GameState = { ...base, seats: { ...base.seats, s2: { ...base.seats['s2']!, seat: { ...base.seats['s2']!.seat, exiled: true } } } }
    const r = fx('objective.kill-them.removeExiledSeat', s, 's2')
    expect(r.state.seats['s2']!.seat.eliminated).toBe(true)
    expect(r.state.seats['s2']!.survivors).toEqual([])
    expect(r.state.seats['s2']!.hand).toEqual([])
    expect(alive(r.state).every((v) => v.owner !== 's2')).toBe(true)
  })

  it('winter-has-come takes a fuel card or ends the game', () => {
    const noFuel: GameState = { ...base, seats: Object.fromEntries(base.seatOrder.map((id) => [id, { ...base.seats[id]!, hand: [] }])) }
    expect(fx('objective.winter-has-come.fuelOrEnd', noFuel).state.phase).toBe('ended')
    const fuelCard = Object.keys(base.cards).find((id) => (loadDefaultBundle().byId[base.cards[id]!.defId] as { symbol?: string }).symbol === 'fuel')!
    const withFuel: GameState = { ...noFuel, seats: { ...noFuel.seats, s1: { ...noFuel.seats['s1']!, hand: [fuelCard] } } }
    const r = fx('objective.winter-has-come.fuelOrEnd', withFuel)
    expect(r.state.phase).not.toBe('ended')
    expect(r.state.objective.counters['fuel']).toBe(1)
    expect(r.state.seats['s1']!.hand).toEqual([])
  })

  it('old-divisions puts the crisis under the deck and skips it', () => {
    const s: GameState = { ...base, crisis: { ...base.crisis, cardId: 'cr.zombie-wave' } }
    const r = fx('crossroads.old-divisions.skipCrisis', s)
    expect(r.state.crisis.cardId).toBeNull()
    expect(r.state.crisisDeck[r.state.crisisDeck.length - 1]).toBe('cr.zombie-wave')
  })

  it('bev russell: clearSchool empties the School deck; schoolWound is a lasting rule', () => {
    const r = fx('crossroads.bev-russel.clearSchool', base)
    expect(r.state.locations['loc.school']!.deck).toEqual([])
    const w = fx('crossroads.bev-russel.schoolWound', base)
    expect(w.state.effects.some((e) => e.grants?.includes('woundOnMoveTo'))).toBe(true)
  })

  it('objective rules read the board', () => {
    const o = CODE_HOOKS.objectives
    expect(o['rule.colony.everyEntranceBarricaded']!(base, null).complete).toBe(false)
    expect(o['rule.food.perNonExiledSeatAtLeast']!({ ...base, food: 12 }, null, { perSeat: 3 }).complete).toBe(true)
    expect(o['rule.food.perNonExiledSeatAtLeast']!({ ...base, food: 11 }, null, { perSeat: 3 }).complete).toBe(false)
    expect(o['rule.zombies-outside-colony.atMost']!(base, null, { n: 99 }).complete).toBe(true)
    expect(o['rule.non-exiled-seats.weaponEach']!(base, null).parts[0]!.need).toBe(base.seatOrder.filter((s) => !base.seats[s]!.seat.exiled).length)
  })
})
