import { describe, expect, it } from 'vitest'
import type { ChooseCrossroadsOptionAction, PlayCardAction } from '../../src/engine/actions'
import { chooseCrossroadsOption, drawCrossroads, returnCrossroads, seatToRight } from '../../src/engine/crossroads'
import { afterAction, isEffectPending, resumeEffects } from '../../src/engine/effects'
import { playCard } from '../../src/engine/actions/play'
import type { GameState } from '../../src/engine/types'
import { act, addCard, makeState, setSeat, types } from './effect-fixture'

const withHeld = (cardId: string, over: Partial<GameState> = {}): GameState => {
  const s = makeState(over)
  return { ...s, crossroads: { ...s.crossroads, held: { cardId, holder: 's3', forSeat: 's1' } } }
}
const hunted = { seat: 's1', survivorId: 'sv.ashley', face: 'wound' as const, params: { reason: 'move' } }

describe('Crossroads', () => {
  it('XRD-001 the seat to the right of the active seat draws; the card is hidden in `held` for the others', () => {
    const s = makeState({ crossroads: { deck: ['xr.hunted', 'xr.impossible'], held: null, active: null, log: [] } })
    expect(seatToRight(s, 's2')).toBe('s1')
    expect(seatToRight(s, 's1')).toBe('s3')
    const r = drawCrossroads(s, 's2')
    expect(r.events).toEqual([{ type: 'CrossroadsDrawn', holder: 's1', forSeat: 's2', cardId: 'xr.hunted' }])
    expect(r.state.crossroads.held).toEqual({ cardId: 'xr.hunted', holder: 's1', forSeat: 's2' })
    expect(r.state.crossroads.deck).toEqual(['xr.impossible'])
    // two seats: each draws for the other
    const two = makeState({ seatOrder: ['s1', 's2'], crossroads: { deck: ['xr.hunted'], held: null, active: null, log: [] } })
    expect(seatToRight(two, 's1')).toBe('s2')
  })

  it('XRD-002 Hunted fires after a move whose exposure was a wound and raises crossroadsOption for the active seat', () => {
    const r = afterAction(withHeld('xr.hunted'), 'action.move', hunted)
    expect(r.events.find((e) => e.type === 'CrossroadsTriggered')).toMatchObject({ window: 'action.move', cardId: 'xr.hunted' })
    expect(r.pending).toMatchObject({ kind: 'crossroadsOption', seat: 's1' })
    expect(r.pending!.options!.map((o) => o.id)).toEqual(['hunt', 'lieLow'])
    expect(r.state.crossroads.held).toBeNull()
    expect(r.state.crossroads.active).toMatchObject({ cardId: 'xr.hunted', forSeat: 's1' })
    expect(isEffectPending(r.state)).toBe(false) // the dispatcher routes chooseCrossroadsOption itself
  })

  it('XRD-003 Hunted does not fire on frostbite, a blank, or after another action', () => {
    for (const face of ['frostbite', 'blank'] as const) {
      const r = afterAction(withHeld('xr.hunted'), 'action.move', { ...hunted, face })
      expect(types(r.events)).not.toContain('CrossroadsTriggered')
      expect(r.state.crossroads.held).not.toBeNull()
    }
    expect(types(afterAction(withHeld('xr.hunted'), 'action.search', hunted).events)).not.toContain('CrossroadsTriggered')
  })

  it('XRD-004 an untriggered card goes to the BOTTOM of the deck and the log keeps it hidden as untriggered', () => {
    const s = withHeld('xr.hunted', { crossroads: { deck: ['xr.impossible'], held: { cardId: 'xr.hunted', holder: 's3', forSeat: 's1' }, active: null, log: [] } })
    const r = returnCrossroads(s)
    expect(r.events).toEqual([{ type: 'CrossroadsReturned', holder: 's3', forSeat: 's1', cardId: 'xr.hunted' }])
    expect(r.state.crossroads.deck).toEqual(['xr.impossible', 'xr.hunted'])
    expect(r.state.crossroads.held).toBeNull()
    expect(r.state.crossroads.log[0]).toMatchObject({ cardId: 'xr.hunted', triggered: false })
  })

  it('XRD-005 choosing an option resolves the card, applies its effects and never returns it to the deck', () => {
    const r = afterAction(withHeld('xr.hunted'), 'action.move', hunted)
    const lie = chooseCrossroadsOption(r.state, r.pending!.options!.find((o) => o.id === 'lieLow')!.action as ChooseCrossroadsOptionAction)
    expect(lie.events.find((e) => e.type === 'CrossroadsResolved')).toMatchObject({ optionId: 'lieLow', forced: false })
    expect(lie.state.effects.some((e) => e.grants?.includes('moveRollWound'))).toBe(true)
    expect(lie.state.crossroads.active).toBeNull()
    expect(lie.state.crossroads.deck).toEqual([])
    expect(lie.state.crossroads.log.at(-1)).toMatchObject({ triggered: true, optionId: 'lieLow' })
    const hunt = chooseCrossroadsOption(r.state, r.pending!.options!.find((o) => o.id === 'hunt')!.action as ChooseCrossroadsOptionAction)
    expect(hunt.events.filter((e) => e.type === 'ExposureRolled')).toHaveLength(4) // two survivors x two rolls
  })

  it('XRD-006 an impossible option is not offered: the other is forced; a stale option id is E_NOT_AN_OPTION', () => {
    let s = withHeld('xr.needs-ashley')
    s = setSeat(s, 's1', { dice: [{ id: 's1:d1', value: 3, used: false }] })
    const f = addCard(s, 'it.food-1', 'hand:s1')
    const r = playCard(f.state, act(f.state, 'playCard', { cardId: f.id }) as PlayCardAction)
    expect(r.pending).toBeUndefined()
    expect(r.events.find((e) => e.type === 'CrossroadsResolved')).toMatchObject({ optionId: 'b', forced: true })
    expect(r.state.food).toBe(4 + 1 + 2)
    const h = afterAction(withHeld('xr.hunted'), 'action.move', hunted)
    const bad = chooseCrossroadsOption(h.state, { ...(h.pending!.options![0]!.action as ChooseCrossroadsOptionAction), optionId: 'nope' })
    expect(bad.rejection?.code).toBe('E_NOT_AN_OPTION')
    expect(bad.state).toBe(h.state)
  })

  it('XRD-008 a card with a survivor-adding option does not trigger while the colony is full (R11.3, ruling R20.20)', () => {
    let s = withHeld('xr.newcomers')
    s = setSeat(s, 's1', { dice: [{ id: 's1:d1', value: 3, used: false }] })
    const full = { ...s, locations: { ...s.locations, colony: { ...s.locations.colony!, capacity: { ...s.locations.colony!.capacity, survivors: 5 } } } }
    const r = afterAction(full, 'action.playCard', { seat: 's1' })
    expect(types(r.events)).not.toContain('CrossroadsTriggered')
    expect(r.state.crossroads.held).not.toBeNull()
    const open = afterAction(s, 'action.playCard', { seat: 's1' })
    expect(open.pending).toMatchObject({ kind: 'crossroadsOption' })
  })

  it('XRD-010 a vote option raises `votes` for the eligible seats; the result picks the yes or no effects', () => {
    let s = withHeld('xr.outbreak')
    s = setSeat(s, 's1', { dice: [{ id: 's1:d1', value: 3, used: false }] })
    const t = afterAction(s, 'action.playCard', { seat: 's1' })
    const c = chooseCrossroadsOption(t.state, t.pending!.options!.find((o) => o.id === 'vote')!.action as ChooseCrossroadsOptionAction)
    expect(c.pending).toMatchObject({ kind: 'votes', seat: 'all' })
    expect(isEffectPending(c.state)).toBe(true)
    const yes = resumeEffects(c.state, { type: 'castVotes', decisionId: c.pending!.id, seat: 'all', votes: { s1: true, s2: true, s3: false } })
    expect(yes.rejection).toBeUndefined()
    expect(types(yes.events)).toEqual(expect.arrayContaining(['VotesCast', 'VoteResult']))
    expect(yes.state.morale).toBe(9)
    const tie = resumeEffects(c.state, { type: 'castVotes', decisionId: c.pending!.id, seat: 'all', votes: { s1: false, s2: false, s3: true } })
    expect(tie.state.morale).toBe(7)
    const bad = resumeEffects(c.state, { type: 'castVotes', decisionId: c.pending!.id, seat: 'all', votes: { s1: true } })
    expect(bad.rejection?.code).toBe('E_BAD_PAYLOAD')
  })

  it('XRD-011 Old Divisions thumbs-up removes the crisis contributions unrevealed', () => {
    let s = withHeld('xr.divisions')
    s = setSeat(s, 's1', { dice: [{ id: 's1:d1', value: 3, used: false }] })
    const a = addCard(s, 'it.fuel', 'crisis:s2'); s = a.state
    const t = afterAction(s, 'action.playCard', { seat: 's1' })
    const c = chooseCrossroadsOption(t.state, t.pending!.options!.find((o) => o.id === 'up')!.action as ChooseCrossroadsOptionAction)
    expect(c.state.crisis.contributions).toEqual([])
    expect(c.state.removedHidden).toEqual([a.id])
    expect(c.events.find((e) => e.type === 'CardDiscarded')).toMatchObject({ to: 'removed', revealed: false })
    expect(types(c.events)).not.toContain('CrisisCardRevealed')
  })

  it('XRD-013 the held card fires at most once: after it triggered the next matching action does nothing', () => {
    const first = afterAction(withHeld('xr.hunted'), 'action.move', hunted)
    expect(types(first.events)).toContain('CrossroadsTriggered')
    const again = afterAction({ ...first.state, pending: { ...first.state.pending } }, 'action.move', hunted)
    expect(types(again.events)).not.toContain('CrossroadsTriggered')
  })

  it('XRD-015 both options impossible: the card triggers, resolves with no effect and no decision', () => {
    let s = withHeld('xr.impossible')
    s = setSeat(s, 's1', { dice: [{ id: 's1:d1', value: 3, used: false }] })
    const r = afterAction(s, 'action.playCard', { seat: 's1' })
    expect(r.pending).toBeUndefined()
    expect(types(r.events)).toEqual(['CrossroadsTriggered', 'CrossroadsResolved'])
    expect(r.events[1]).toMatchObject({ forced: true, optionId: '' })
    expect(r.state.morale).toBe(8)
    expect(r.state.crossroads.log.at(-1)).toMatchObject({ triggered: true })
  })
})
