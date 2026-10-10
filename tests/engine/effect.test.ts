import { describe, expect, it } from 'vitest'
import type { PlayCardAction } from '../../src/engine/actions'
import { playCard } from '../../src/engine/actions/play'
import { registerCodeHook } from '../../src/engine/code-hooks'
import {
  addLasting, evaluateCondition, expireEffects, fireWindow, grantEntries, hasGrant, isForbidden, mkAcc, resumeEffects, runCrisisEffect, runEffectNodes,
  type RunCtx,
} from '../../src/engine/effects'
import type { EvalCtx } from '../../src/engine/effects'
import type { GameState } from '../../src/engine/types'
import { act, addCard, makeState, setSeat, setSurvivor, types } from './effect-fixture'

const rc = (over: Partial<RunCtx> = {}): RunCtx => ({ sourceId: 'cr.test', sourceKind: 'crossroads', seat: 's1', point: 'action.playCard', ...over })
const ev = (state: GameState, over: Partial<EvalCtx> = {}): EvalCtx => ({ state, point: 'action.playCard', seat: 's1', ...over })

describe('effects interpreter', () => {
  it('CRIS-013 a failed Blizzard forbids moves for non-exiled seats until the end of the next round and costs 1 morale', () => {
    let s = makeState()
    s = setSeat(s, 's3', { seat: { ...s.seats.s3!.seat, exiled: true } })
    const r = runCrisisEffect(s, 'cr.blizzard', 'fail')
    expect(r.events.find((e) => e.type === 'EffectApplied')).toMatchObject({ sourceId: 'cr.blizzard', name: 'cr.blizzard#0', refreshed: false })
    expect(r.events.find((e) => e.type === 'CrisisEffectApplied')).toMatchObject({ kind: 'fail' })
    expect(r.state.morale).toBe(7)
    expect(isForbidden(r.state, 'move', { seat: 's1' })).toBe(true)
    expect(isForbidden(r.state, 'move', { seat: 's3' })).toBe(false) // exiled: not stopped
    expect(expireEffects({ ...r.state, roundNumber: 1 }, 'roundEnd').state.effects).toHaveLength(1)
    const gone = expireEffects({ ...r.state, roundNumber: 2 }, 'roundEnd')
    expect(gone.state.effects).toHaveLength(0)
    expect(gone.events[0]).toMatchObject({ type: 'EffectExpired', reason: 'duration' })
  })

  it('CRIS-014 a second Blizzard while the first is active refreshes to the LATER expiry, never two effects', () => {
    const first = runCrisisEffect(makeState({ roundNumber: 1 }), 'cr.blizzard', 'fail')
    const second = runCrisisEffect({ ...first.state, roundNumber: 2 }, 'cr.blizzard', 'fail')
    expect(second.events.find((e) => e.type === 'EffectApplied')).toMatchObject({ refreshed: true })
    expect(second.state.effects).toHaveLength(1)
    expect(second.state.effects[0]!.expires).toEqual({ roundNumber: 3 })
    // a later application never shortens an existing longer one
    const acc = mkAcc(second.state)
    addLasting(acc, { name: 'cr.blizzard#0', sourceId: 'cr.blizzard', sourceKind: 'crisis', seats: second.state.effects[0]!.seats, forbid: ['move'], duration: 'turn' })
    expect(acc.state.effects[0]!.expires).toEqual({ roundNumber: 3 })
  })

  it('RULE-001 card text beats the generic rule: a code hook can kill without the morale loss, a plain killSurvivor node costs 1', () => {
    registerCodeHook('effects', 'test.killNoMorale', (ctx) => {
      const acc = mkAcc(ctx.state)
      addLasting(acc, { name: 'test#nm', sourceId: 'test', sourceKind: 'rule', survivorIds: [ctx.targetId!], grants: ['noMoraleOnDeath'], duration: 'game' })
      return { state: acc.state, events: acc.events }
    })
    const s = makeState()
    const code = runEffectNodes(s, [{ code: 'test.killNoMorale' }, { op: 'killSurvivor', scope: { who: 'target' } }], rc({ targetId: 'sv.spare' }))
    expect(code.events.find((e) => e.type === 'SurvivorKilled')).toMatchObject({ survivorId: 'sv.spare', moraleLoss: false })
    expect(code.events.some((e) => e.type === 'MoraleChanged')).toBe(false)
    const plain = runEffectNodes(s, [{ op: 'killSurvivor', scope: { who: 'target' } }], rc({ targetId: 'sv.spare' }))
    expect(plain.events.find((e) => e.type === 'MoraleChanged')).toMatchObject({ delta: -1 })
    expect(plain.state.morale).toBe(7)
  })

  it('RULE-003 an endGame op sets objective.complete first, then ends the game at once', () => {
    const r = runEffectNodes(makeState(), [{ op: 'endGame', value: 'objectiveComplete' }, { op: 'morale', value: -1 }], rc())
    expect(r.state.objective.complete).toBe(true)
    expect(r.events.find((e) => e.type === 'GameEnded')).toMatchObject({ reason: 'objectiveComplete', objectiveComplete: true })
    expect(r.state.phase).toBe('ended')
    expect(r.pending?.kind).toBe('gameOver')
    expect(r.state.morale).toBe(8) // nothing runs after the end
  })

  it('EFFECT-001 killZombies rolls exposure once per zombie by default, once for exposureOnce, never for noExposure (21 §4)', () => {
    let s = makeState()
    s = setSurvivor(s, 'sv.spare', { location: 'loc.school' })
    s = { ...s, locations: { ...s.locations, 'loc.school': { ...s.locations['loc.school']!, entrances: [{ index: 1, zombies: 3, barricades: 0 }] } } }
    const run = (value?: string) => runEffectNodes(s, [{ op: 'killZombies', count: 2, location: 'here', ...(value ? { value } : {}) }], rc({ sourceKind: 'survivor', survivorId: 'sv.spare' }))
    const dflt = run()
    expect(dflt.events.filter((e) => e.type === 'ZombieKilled')).toHaveLength(2)
    expect(dflt.events.filter((e) => e.type === 'ExposureRolled' || e.type === 'ExposureSkipped')).toHaveLength(2)
    expect(run('exposureOnce').events.filter((e) => e.type === 'ExposureRolled')).toHaveLength(1)
    expect(run('noExposure').events.some((e) => e.type === 'ExposureRolled')).toBe(false)
    expect(dflt.state.locations['loc.school']!.entrances[0]!.zombies).toBe(1)
  })

  it('EFFECT-002 an objective trigger on zombie.killed with onRoll {atLeast 4} adds a sample only on 4+ (We Need More Samples)', () => {
    let s = makeState()
    s = { ...s, locations: { ...s.locations, colony: { ...s.locations.colony!, entrances: s.locations.colony!.entrances.map((e, i) => (i === 0 ? { ...e, zombies: 6 } : e)) } } }
    const r = runEffectNodes(s, [{ op: 'killZombies', count: 6, location: 'colony', value: 'noExposure', scope: { who: 'self' } }], rc({ survivorId: 'sv.ashley', sourceKind: 'survivor' }))
    const dice = r.events.filter((e) => e.type === 'DiceRolled').map((e) => (e as { dice: number[] }).dice[0]!)
    expect(dice).toHaveLength(6)
    const progress = r.events.filter((e) => e.type === 'ObjectiveProgress')
    expect(progress).toHaveLength(dice.filter((d) => d >= 4).length)
    expect(r.state.objective.counters.samples ?? 0).toBe(progress.length)
    if (progress.length) expect(progress.at(-1)).toMatchObject({ counter: 'samples', need: 9 }) // 3 seats x 3
  })

  it('EFFECT-003 conditions: all / any / not, wounds, hand symbols, zombies at a location', () => {
    let s = makeState()
    s = setSurvivor(s, 'sv.ashley', { wounds: 2 })
    s = addCard(s, 'it.fuel', 'hand:s1').state
    s = addCard(s, 'it.fuel', 'hand:s1').state
    const c = ev(s, { survivorId: 'sv.ashley', location: 'colony' })
    expect(evaluateCondition(c, { test: 'woundsAtLeast', subject: 'survivor', value: 2 })).toBe(true)
    expect(evaluateCondition(c, { test: 'woundsAtLeast', subject: 'survivor', value: 3 })).toBe(false)
    expect(evaluateCondition(c, { test: 'handHasSymbol', subject: 'seat', symbol: 'fuel', value: 2 })).toBe(true)
    expect(evaluateCondition(c, { all: [{ test: 'isColony', subject: 'location' }, { not: { test: 'zombiesAtLeast', subject: 'location', value: 1 } }] })).toBe(true)
    expect(evaluateCondition(c, { any: [{ test: 'moraleAtMost', value: 3 }, { test: 'foodAtLeast', value: 4 }] })).toBe(true)
    expect(evaluateCondition(c, { test: 'emptySurvivorSpace', location: 'colony' })).toBe(true)
    expect(evaluateCondition(c, { code: 'unknown.code.hook' })).toBe(false) // unknown hooks never throw
  })

  it('EFFECT-004 `choose` raises an effectChoice for the owner; an answer outside the options is E_NOT_AN_OPTION', () => {
    const { state: s, id } = addCard(makeState(), 'it.barricades', 'hand:s1')
    const r = playCard(s, act(s, 'playCard', { cardId: id }) as PlayCardAction)
    expect(r.pending).toMatchObject({ kind: 'effectChoice', seat: 's1' })
    expect(r.pending!.options!.map((o) => o.id)).toEqual(['one', 'two'])
    const bad = resumeEffects(r.state, { type: 'effectChoice', decisionId: r.pending!.id, seat: 's1', optionId: 'three' })
    expect(bad.rejection?.code).toBe('E_NOT_AN_OPTION')
    const done = resumeEffects(r.state, r.pending!.options!.find((o) => o.id === 'two')!.action)
    expect(done.events.filter((e) => e.type === 'BarricadeAdded')).toHaveLength(2)
    expect(done.pending).toBeUndefined()
  })

  it('EFFECT-005 passive grants switch on with the survivor and off when it dies; Sparky turns a bite into a wound only for himself', () => {
    const s = makeState()
    expect(hasGrant(s, 'noExposureOnKill', { survivorId: 'sv.mike' })).toBe(true)
    expect(hasGrant(s, 'noExposureOnKill', { survivorId: 'sv.ashley' })).toBe(false)
    expect(grantEntries(s, 'biteIsWound', { survivorId: 'sv.sparky' })[0]).toMatchObject({ sourceId: 'sv.sparky' })
    expect(hasGrant(s, 'biteIsWound', { survivorId: 'sv.ashley' })).toBe(false)
    expect(hasGrant(setSurvivor(s, 'sv.mike', { status: 'dead', owner: null }), 'noExposureOnKill', { survivorId: 'sv.mike' })).toBe(false)
  })

  it('EFFECT-006 an optional triggered ability (Forest Plum) asks its owner at turn.start and does nothing when declined', () => {
    const s = makeState({ activeSeat: 's3', pending: { id: 'd:1', seat: 's3', kind: 'turnAction', window: 'turn.start', context: {}, canPass: false } })
    const r = fireWindow(s, 'turn.start', { seat: 's3' })
    expect(r.pending).toMatchObject({ kind: 'effectChoice', seat: 's3' })
    expect((r.pending!.context.data as { code: string }).code).toBe('survivor.forest.lastGift')
    const no = resumeEffects(r.state, r.pending!.options!.find((o) => o.id === 'no')!.action)
    expect(no.events).toEqual([])
    const yes = resumeEffects(r.state, r.pending!.options!.find((o) => o.id === 'yes')!.action)
    expect(types(yes.events)).toEqual(expect.arrayContaining(['SurvivorRemoved', 'MoraleChanged']))
    expect(yes.state.survivors['sv.forest']!.status).toBe('removed')
    expect(yes.state.morale).toBe(9)
    // not the active seat: the ability stays quiet
    expect(fireWindow(makeState(), 'turn.start', { seat: 's1' }).pending).toBeUndefined()
  })

  it('EFFECT-007 a once-per-round trigger grants its extra search card once, and the use is counted per survivor', () => {
    let s = makeState()
    s = { ...s, survivors: { ...s.survivors, 'sv.alexis': { ...s.survivors['sv.spare']!, id: 'sv.alexis' } }, seats: { ...s.seats, s1: { ...s.seats.s1!, survivors: [...s.seats.s1!.survivors, 'sv.alexis'] } } }
    const first = fireWindow(s, 'search.drawn', { seat: 's1', survivorId: 'sv.alexis' })
    expect(first.pending).toMatchObject({ kind: 'effectChoice' })
    const yes = resumeEffects(first.state, first.pending!.options!.find((o) => o.id === 'yes')!.action)
    expect(hasGrant(yes.state, 'extraSearchKeep', { survivorId: 'sv.alexis' })).toBe(true)
    expect(yes.state.seats.s1!.abilityUses['sv.alexis|sharpEyes']).toBe(1)
    expect(yes.events.find((e) => e.type === 'AbilityUsed')).toMatchObject({ abilityId: 'sharpEyes', usesThisRound: 1 })
    expect(fireWindow(yes.state, 'search.drawn', { seat: 's1', survivorId: 'sv.alexis' }).pending).toBeUndefined()
  })

  it('EFFECT-008 Fuel asks for the survivor then the destination (itemTarget), moves without exposure and reaches action.move', () => {
    const { state: s, id } = addCard(makeState(), 'it.fuel', 'hand:s1')
    const r1 = playCard(s, act(s, 'playCard', { cardId: id }) as PlayCardAction)
    expect(r1.pending).toMatchObject({ kind: 'itemTarget', seat: 's1' })
    expect(r1.pending!.options!.map((o) => o.id).sort()).toEqual(['sv.ashley', 'sv.spare'])
    const r2 = resumeEffects(r1.state, r1.pending!.options!.find((o) => o.id === 'sv.ashley')!.action)
    expect(r2.pending).toMatchObject({ kind: 'itemTarget' })
    expect(r2.pending!.options!.map((o) => o.id)).toEqual(['loc.school', 'loc.gas'])
    const r3 = resumeEffects(r2.state, r2.pending!.options!.find((o) => o.id === 'loc.school')!.action)
    expect(r3.events.find((e) => e.type === 'SurvivorMoved')).toMatchObject({ survivorId: 'sv.ashley', to: 'loc.school', kind: 'card' })
    expect(r3.events.some((e) => e.type === 'ExposureRolled')).toBe(false)
    expect(r3.state.survivors['sv.ashley']!.movedThisTurn).toBe(true)
    expect(r3.state.waste[0]).toBe(id)
  })
})
