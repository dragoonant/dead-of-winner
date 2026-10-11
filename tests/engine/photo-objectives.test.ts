// Golden checks for the code hooks added with the card-photo objectives (Experienced, Repopulate, Hope, Justice, Take Over).
import { beforeAll, describe, expect, it } from 'vitest'
import { createRandomDecider } from '../../src/ai/random'
import { CODE_HOOKS } from '../../src/engine/code-hooks'
import { createGame, legalActions, step, view } from '../../src/engine/index'
import type { GameState } from '../../src/engine/types'
import { setupFor } from '../../tools/sim-core'
import { loadDefaultBundle } from '../../tools/default-bundle'

let base: GameState
beforeAll(async () => {
  const decider = createRandomDecider('photo-obj')
  let r = createGame(setupFor(4, 'obj.main.find-a-cure'), 'photo-obj', loadDefaultBundle())
  while (r.state.phase === 'setup') {
    const a = await decider.decide(view(r.state, r.pending.seat === 'all' ? 's1' : r.pending.seat), r.pending, legalActions(r.state))
    r = step(r.state, a)
  }
  base = r.state
})

const o = () => CODE_HOOKS.objectives
const withHelpless = (s: GameState, n: number): GameState => ({ ...s, locations: { ...s.locations, colony: { ...s.locations['colony']!, helpless: n } } })
const aliveCount = (s: GameState) => Object.values(s.survivors).filter((v) => v.status === 'alive').length

describe('photo objective hooks', () => {
  it('Experienced needs every survivor of the seat to carry an item', () => {
    const ids = base.seats['s1']!.survivors
    expect(o()['rule.seat-survivors.allEquipped']!(base, 's1').complete).toBe(false)
    const part = { ...base, survivors: { ...base.survivors, [ids[0]!]: { ...base.survivors[ids[0]!]!, equipped: ['x1'] } } }
    expect(ids.length).toBeGreaterThan(1)
    expect(o()['rule.seat-survivors.allEquipped']!(part, 's1').complete).toBe(false)
    const all = { ...base, survivors: { ...base.survivors, ...Object.fromEntries(ids.map((id) => [id, { ...base.survivors[id]!, equipped: ['x1'] }])) } }
    expect(o()['rule.seat-survivors.allEquipped']!(all, 's1').complete).toBe(true)
    expect(o()['rule.seat-survivors.allEquipped']!(all, null).complete).toBe(false)
  })

  it('Repopulate counts survivors of every seat plus helpless tokens', () => {
    const n = aliveCount(base)
    const hook = o()['rule.board.survivorsAtLeast']!
    expect(hook(withHelpless(base, 0), 's1', { n }).complete).toBe(true)
    expect(hook(withHelpless(base, 0), 's1', { n: n + 1 }).complete).toBe(false)
    expect(hook(withHelpless(base, 1), 's1', { n: n + 1 }).complete).toBe(true)
  })

  it('Hope counts helpless tokens on the whole board', () => {
    const hook = o()['rule.board.helplessAtLeast']!
    expect(hook(withHelpless(base, 1), 's1', { n: 2 }).complete).toBe(false)
    expect(hook(withHelpless(base, 2), 's1', { n: 2 }).complete).toBe(true)
  })

  it('Justice holds with no traitor and needs every traitor exiled otherwise', () => {
    const hook = o()['rule.traitors.allExiled']!
    const clean: GameState = { ...base, seats: Object.fromEntries(base.seatOrder.map((id) => [id, { ...base.seats[id]!, secretObjectiveId: 'obj.secret.safety' }])) }
    expect(hook(clean, 's1').complete).toBe(true)
    const traitor: GameState = { ...clean, seats: { ...clean.seats, s2: { ...clean.seats['s2']!, secretObjectiveId: 'obj.betrayal.take-over' } } }
    expect(hook(traitor, 's1').complete).toBe(false)
    const exiled: GameState = { ...traitor, seats: { ...traitor.seats, s2: { ...traitor.seats['s2']!, seat: { ...traitor.seats['s2']!.seat, exiled: true } } } }
    expect(hook(exiled, 's1').complete).toBe(true)
  })

  it('Take Over looks for barricades at one location outside the colony', () => {
    const hook = o()['rule.locations.barricadedAtLeast']!
    const params = { barricades: 4, locations: 1, excludeColony: true }
    const walled = (loc: string): GameState => ({ ...base, locations: { ...base.locations, [loc]: { ...base.locations[loc]!, entrances: base.locations[loc]!.entrances.map((e, i) => (i === 0 ? { ...e, barricades: 4 } : e)) } } })
    expect(hook(walled('colony'), 's1', params).complete).toBe(false)
    expect(hook(walled('colony'), 's1', { barricades: 4, locations: 1 }).complete).toBe(true)
    expect(hook(walled('loc.school'), 's1', params).complete).toBe(true)
  })

  it('every new record references a registered hook', () => {
    const b = loadDefaultBundle()
    const text = JSON.stringify(Object.values(b.byId))
    for (const n of ['rule.seat-survivors.allEquipped', 'rule.board.survivorsAtLeast', 'rule.board.helplessAtLeast', 'rule.traitors.allExiled']) {
      expect(CODE_HOOKS.objectives[n], n).toBeTypeOf('function')
      expect(text).toContain(n)
    }
  })
})
