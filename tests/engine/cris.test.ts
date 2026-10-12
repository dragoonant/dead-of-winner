import { describe, expect, it } from 'vitest'
import { beginColonyPhase } from '../../src/engine/colony-phase'
import { crisisReportFromView } from '../../src/engine/crisis'
import { isForbidden } from '../../src/engine/effects'
import { CODE_HOOKS } from '../../src/engine/code-hooks'
import { view } from '../../src/engine/view'
import { makeColony, of, types, type ColOpts } from './col-fixture'

/** Runs the whole colony phase on a roomy, well-fed table so only the crisis step matters. */
const run = (o: ColOpts) => beginColonyPhase(makeColony({ food: 9, ...o }))
const fuel3 = { s1: ['it.fuel', 'it.fuel'], s2: ['it.fuel'] }

describe('crisis resolution', () => {
  it('CRIS-004 three Fuel and a weapon at 3 seats: +1 +1 +1 -1 in shuffled order, total 2 of 3, the fail effect and -2 morale', () => {
    const r = run({ contributions: { s1: ['it.fuel', 'it.fuel'], s2: ['it.fuel', 'it.weapon'] } })
    const revealed = of<{ points: number; runningTotal: number }>(r.events, 'CrisisCardRevealed')
    expect(revealed).toHaveLength(4)
    expect(revealed.map((c) => c.points).sort()).toEqual([-1, 1, 1, 1])
    expect(revealed[3]!.runningTotal).toBe(2)
    const res = of(r.events, 'CrisisResolved')[0]
    expect(res).toMatchObject({ total: 2, needed: 3, prevented: false, bonus: false })
    expect(of(r.events, 'CrisisEffectApplied')[0]).toMatchObject({ kind: 'fail', cardId: 'cr.fuel' })
    expect(of(r.events, 'MoraleChanged').find((m) => (m as { reason: string }).reason === 'crisisFailed')).toMatchObject({ delta: -2 })
  })

  it('CRIS-021 the contributed cards are listed as removed after the fail effect and the morale change (R p12)', () => {
    const r = run({ contributions: { s1: ['it.fuel', 'it.fuel'], s2: ['it.fuel', 'it.weapon'] } })
    const t = types(r.events)
    const removals = of<{ reason: string }>(r.events, 'CardDiscarded').filter((d) => d.reason === 'crisis')
    expect(removals).toHaveLength(4)
    expect(t.indexOf('CardDiscarded')).toBeGreaterThan(t.indexOf('CrisisEffectApplied'))
    expect(t.indexOf('CardDiscarded')).toBeGreaterThan(t.indexOf('MoraleChanged'))
  })

  it('CRIS-005 three Fuel meet the need of 3: prevented, no effect, no bonus', () => {
    const r = run({ contributions: { s1: ['it.fuel', 'it.fuel'], s2: ['it.fuel'] } })
    expect(of(r.events, 'CrisisResolved')[0]).toMatchObject({ total: 3, needed: 3, prevented: true, bonus: false })
    expect(types(r.events)).not.toContain('CrisisEffectApplied')
    expect(of(r.events, 'MoraleChanged')).toHaveLength(0)
  })

  it('CRIS-006 five Fuel at 3 seats: need + 2 gives the bonus and +1 morale', () => {
    const r = run({ contributions: { s1: ['it.fuel', 'it.fuel'], s2: ['it.fuel', 'it.fuel'], s3: ['it.fuel'] } })
    expect(of(r.events, 'CrisisResolved')[0]).toMatchObject({ total: 5, bonus: true, prevented: true })
    expect(of(r.events, 'MoraleChanged').find((m) => (m as { reason: string }).reason === 'crisisBonus')).toMatchObject({ delta: 1 })
    expect(r.state.morale).toBe(9)
  })

  it('CRIS-007 four Fuel at 3 seats are prevented but earn no bonus', () => {
    const r = run({ contributions: { s1: ['it.fuel', 'it.fuel'], s2: ['it.fuel', 'it.fuel'] } })
    expect(of(r.events, 'CrisisResolved')[0]).toMatchObject({ total: 4, prevented: true, bonus: false })
    expect(r.state.morale).toBe(8)
  })

  it('CRIS-008 no contributions: total 0, not prevented, the fail effect applies; with every seat exiled nothing is needed', () => {
    const r = run({})
    expect(of(r.events, 'CrisisResolved')[0]).toMatchObject({ total: 0, needed: 3, prevented: false })
    expect(r.state.morale).toBe(6)
    const none = run({ exiled: ['s1', 's2', 's3'] })
    expect(of(none.events, 'CrisisResolved')[0]).toMatchObject({ needed: 0, prevented: true })
  })

  it('CRIS-009 needed counts the non-exiled seats: 4 seats with one exiled need 3', () => {
    const r = run({ seats: ['s1', 's2', 's3', 's4'], exiled: ['s4'], contributions: fuel3 })
    expect(of(r.events, 'CrisisResolved')[0]).toMatchObject({ needed: 3, total: 3, prevented: true })
  })

  it('CRIS-010 contributed cards leave the game face up, never to the waste, and the pile empties', () => {
    const s = makeColony({ food: 9, contributions: fuel3 })
    const ids = s.crisis.contributions.map((c) => c.cardId)
    const r = beginColonyPhase(s)
    expect(of<{ to: string; cardId: string }>(r.events, 'CardDiscarded').map((d) => d.to)).toEqual(['removed', 'removed', 'removed'])
    expect(ids.every((id) => r.state.removed.includes(id))).toBe(true)
    expect(r.state.waste).toHaveLength(0)
    expect(r.state.crisis.contributions).toEqual([])
  })

  it('CRIS-011 revealed cards never name the contributor; other seats see null, the owner sees their own, the recap lists all', () => {
    const r = run({ contributions: { s1: ['it.fuel'], s2: ['it.fuel', 'it.weapon'] } })
    for (const e of of(r.events, 'CrisisCardRevealed')) expect(e).not.toHaveProperty('seat')
    const mine = view(r.state, 's1').crisis.history[0]!.result.revealed
    expect(mine.filter((c) => c.seat === 's1')).toHaveLength(1)
    expect(mine.filter((c) => c.seat === null)).toHaveLength(2)
    const entry = r.state.crisis.history[0]!
    expect(entry.result.revealed.map((c) => c.seat).sort()).toEqual(['s1', 's2', 's2'])
  })

  it('CRIS-012 query.crisis for s1 (1 Fuel, 1 weapon) while s2 put in 2 cards: myPoints 0, min -2, max 2, needed 4, bonusAt 6', () => {
    const s = makeColony({ seats: ['s1', 's2', 's3', 's4'], contributions: { s1: ['it.fuel', 'it.weapon'], s2: ['it.tool', 'it.tool'] } })
    const rep = crisisReportFromView(view(s, 's1'))
    expect(rep).toMatchObject({ cardId: 'cr.fuel', needed: 4, bonusAt: 6, cardsIn: 4, myPoints: 0, minTotal: -2, maxTotal: 2, resolved: null })
    expect(rep.cardsBySeat).toMatchObject({ s1: 2, s2: 2 })
  })

  it('CRIS-013 a failed Blizzard forbids movement until the end of next round and costs 1 morale; the effect expires then', () => {
    const r = run({ crisis: 'cr.blizzard' })
    const applied = of<{ name: string; sourceId: string; refreshed: boolean }>(r.events, 'EffectApplied')[0]!
    expect(applied).toMatchObject({ sourceId: 'cr.blizzard', name: 'cr.blizzard#0', refreshed: false })
    expect(of(r.events, 'MoraleChanged').find((m) => (m as { reason: string }).reason === 'crisisFailed')).toMatchObject({ delta: -1 })
    expect(isForbidden(r.state, 'move', { seat: 's1' })).toBe(true)
    expect(types(r.events)).not.toContain('EffectExpired')
    // next round's colony phase (a crisis that is prevented this time) ends the effect
    const next = beginColonyPhase({ ...r.state, food: 9, crisis: { ...r.state.crisis, cardId: null } })
    expect(of(next.events, 'EffectExpired')[0]).toMatchObject({ reason: 'duration' })
    expect(isForbidden(next.state, 'move', { seat: 's1' })).toBe(false)
  })

  it('CRIS-014 a second Blizzard failure refreshes the one effect to the later expiry instead of adding another', () => {
    const r = run({ crisis: 'cr.blizzard' })
    const again = beginColonyPhase({ ...r.state, food: 9 }) // round 2 flipped Blizzard too
    expect(of(again.events, 'EffectApplied')[0]).toMatchObject({ name: 'cr.blizzard#0', refreshed: true })
    expect(again.state.effects.filter((e) => e.name === 'cr.blizzard#0')).toHaveLength(1)
    expect(again.state.effects.find((e) => e.name === 'cr.blizzard#0')!.expires).toEqual({ roundNumber: 3 })
  })

  it('CRIS-022 an Overpopulation fail costs 1 morale per survivor killed (R p11, p14)', () => {
    const start = makeColony({ morale: 8 })
    const r = CODE_HOOKS.effects['crisis.overpopulation.killLowestTwo']!({ state: start, point: 'passive', seat: 's1', params: {} }, {})
    const killed = of(r.events, 'SurvivorKilled')
    expect(killed).toHaveLength(2)
    expect(of(r.events, 'MoraleChanged').filter((m) => (m as { delta: number }).delta === -1)).toHaveLength(2)
    expect(r.state.morale).toBe(6)
  })
})
