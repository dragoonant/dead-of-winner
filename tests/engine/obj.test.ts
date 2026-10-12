import { describe, expect, it } from 'vitest'
import { beginColonyPhase } from '../../src/engine/colony-phase'
import { objectiveNeed } from '../../src/engine/effects'
import { checkMainObjective, endGame, evaluateWinners, mainObjectiveStatus, objectiveProgressFromView, ownObjectiveProgress, seatStatus } from '../../src/engine/objectives'
import { CODE_HOOKS } from '../../src/engine/code-hooks'
import type { GameState } from '../../src/engine/types'
import { view } from '../../src/engine/view'
import { makeColony, of, types } from './col-fixture'
import { createGame, legalActions, step } from '../../src/engine/index'
import { loadDefaultBundle } from '../../tools/default-bundle'

const FOOD3 = ['it.food', 'it.food', 'it.food']

describe('objectives', () => {
  it('OBJ-001 We Need More Samples at 4 seats needs 12 samples; complete only at 12', () => {
    const base = makeColony({ seats: ['s1', 's2', 's3', 's4'] })
    expect(objectiveNeed(base, 'samples')).toBe(12)
    const at11 = { ...base, objective: { ...base.objective, counters: { samples: 11 } } }
    expect(mainObjectiveStatus(at11)).toMatchObject({ complete: false, parts: [{ label: 'samples', have: 11, need: 12 }] })
    const at12 = { ...base, objective: { ...base.objective, counters: { samples: 12 } } }
    const r = checkMainObjective(at12)
    expect(r.complete).toBe(true)
    expect(r.events.map((e) => e.type)).toEqual(['ObjectiveChecked', 'ObjectiveComplete'])
    expect(r.events[1]).toMatchObject({ seat: null })
  })

  it('OBJ-002 samples reaching the need during a turn end nothing; the game ends at colony step 5', () => {
    const s = makeColony({ objective: { counters: { samples: 9 } } })
    expect(s.phase).toBe('playerTurns')
    expect(s.objective.complete).toBe(false)
    const r = beginColonyPhase(s)
    const t = types(r.events)
    expect(t.indexOf('ObjectiveChecked')).toBeGreaterThan(t.indexOf('CrisisResolved'))
    expect(of(r.events, 'GameEnded')[0]).toMatchObject({ reason: 'objectiveComplete' })
    expect(r.state.objective.complete).toBe(true)
  })

  it('OBJ-003 morale 0 with the main goal met but unchecked: objectiveComplete false, no ObjectiveChecked, the requiresMain secret loses', () => {
    const s = makeColony({ morale: 0, objective: { counters: { samples: 9 } }, secret: { s1: 'obj.secret.hunger' }, hands: { s1: FOOD3 } })
    const r = endGame(s, 'moraleZero')
    expect(of(r.events, 'GameEnded')[0]).toMatchObject({ reason: 'moraleZero', objectiveComplete: false, winners: [] })
    expect(types(r.events)).not.toContain('ObjectiveChecked')
    expect(r.state.seats['s1']!.outcome).toBe('lost')
    expect(r.pending.kind).toBe('gameOver')
  })

  it('OBJ-004 a requiresMain secret objective needs the main objective too: the private part alone loses, both win', () => {
    const base = makeColony({ secret: { s1: 'obj.secret.hunger', s2: 'obj.secret.collector' }, hands: { s1: FOOD3, s2: ['it.fuel'] } })
    expect(seatStatus(base, 's1').complete).toBe(false)
    expect(evaluateWinners(base)).toEqual([])
    const done = { ...base, objective: { ...base.objective, complete: true } }
    expect(seatStatus(done, 's1')).toMatchObject({ complete: true })
    expect(evaluateWinners(done)).toEqual(['s1'])
  })

  it('OBJ-005 a betrayal objective met at morale zero wins while the standard seats lose', () => {
    const s = makeColony({ morale: 0, secret: { s1: 'obj.betrayal.trigger', s2: 'obj.secret.hunger', s3: 'obj.secret.collector' }, hands: { s1: ['it.weapon', 'it.weapon'], s2: FOOD3, s3: FOOD3 } })
    const r = endGame(s, 'moraleZero')
    expect(of(r.events, 'GameEnded')[0]).toMatchObject({ winners: ['s1'] })
    expect(r.state.seats['s1']!.outcome).toBe('won')
    expect(r.state.seats['s2']!.outcome).toBe('lost')
    expect(r.state.seats['s3']!.outcome).toBe('lost')
  })

  it('OBJ-005 an exiled betrayer keeps the betrayal card with its first condition swapped; a standard exile gets the exiled card alone', () => {
    // exiled betrayer: condition 1 (morale 0) becomes "4 cards in hand"; the weapon part stays; no main objective needed
    const b = makeColony({ exiled: ['s1'], secret: { s1: 'obj.betrayal.trigger' }, exiledObj: { s1: 'obj.exiled.remorse' }, hands: { s1: ['it.weapon', 'it.weapon', 'it.fuel', 'it.fuel'] }, morale: 5 })
    expect(seatStatus(b, 's1')).toMatchObject({ complete: true })
    const short = { ...b, seats: { ...b.seats, s1: { ...b.seats['s1']!, hand: b.seats['s1']!.hand.slice(0, 2) } } }
    expect(seatStatus(short, 's1').complete).toBe(false)
    // exiled standard seat: only the exiled card counts (2 medicine + main complete), the hunger card is gone
    const e = makeColony({ exiled: ['s2'], secret: { s2: 'obj.secret.hunger' }, exiledObj: { s2: 'obj.exiled.remorse' }, hands: { s2: ['it.med', 'it.med'] }, objective: { complete: true } })
    expect(seatStatus(e, 's2')).toMatchObject({ complete: true, goal: { kind: 'exiled', objectiveId: 'obj.exiled.remorse' } })
    expect(seatStatus({ ...e, objective: { ...e.objective, complete: false } }, 's2').complete).toBe(false)
  })

  it("OBJ-006 progress for s1 shows s1's secret objective and the main one; another seat's objective id cannot be asked for", () => {
    const s = makeColony({ secret: { s1: 'obj.secret.hunger', s2: 'obj.secret.collector' }, hands: { s1: ['it.food', 'it.fuel'], s2: FOOD3 } })
    const v = view(s, 's1')
    const mine = objectiveProgressFromView(v, 'obj.secret.hunger')
    expect(mine).toMatchObject({ objectiveId: 'obj.secret.hunger', kind: 'secret', complete: false, requiresMain: true })
    expect(mine.parts).toEqual([{ label: 'Main objective', have: 0, need: 1 }, { label: 'hand has symbol food', have: 1, need: 3 }])
    expect(objectiveProgressFromView(v).kind).toBe('main')
    expect(ownObjectiveProgress(v).own?.objectiveId).toBe('obj.secret.hunger')
    expect(() => objectiveProgressFromView(v, 'obj.secret.collector')).toThrow()
  })

  it('OBJ-008 a hand-count condition counts every item card, an Outsider included; a symbol condition counts only the symbol', () => {
    const s = makeColony({ secret: { s1: 'obj.secret.collector', s2: 'obj.secret.hunger' }, hands: { s1: ['it.fuel', 'it.food', 'it.outsiders'], s2: ['it.food', 'it.food', 'it.outsiders'] }, objective: { complete: true } })
    expect(seatStatus(s, 's1').complete).toBe(true)
    expect(seatStatus(s, 's2').complete).toBe(false)
    expect(seatStatus(s, 's2').parts[1]).toMatchObject({ have: 2, need: 3 })
  })

  it('OBJ-017 Gluttony / Obsessed hand hook: starter cards are not counted; Hypochondriac needs a hand of only Medicine', () => {
    const base = makeColony({ hands: { s1: ['it.food', 'it.food', 'it.food', 'it.food', 'it.food', 'it.food', 'it.fuel', 'it.med'] } })
    const six = CODE_HOOKS.objectives['rule.hand.symbolsAtLeast']!
    const params = { symbols: { food: 6 }, excludeStarter: true }
    expect(six(base, 's1', params).complete).toBe(true)
    const hand = base.seats['s1']!.hand
    const starter = { ...base, cards: { ...base.cards, [hand[0]!]: { ...base.cards[hand[0]!]!, starter: true as const } } }
    expect(six(starter, 's1', params).complete).toBe(false) // five food left once one starter card is excluded
    expect(six(starter, 's1', { symbols: { food: 6 } }).complete).toBe(true)
    const only = CODE_HOOKS.objectives['rule.hand.onlySymbol']!
    expect(only(base, 's1', { symbol: 'medicine' }).complete).toBe(false)
    expect(only(makeColony({ hands: { s1: ['it.med', 'it.med'] } }), 's1', { symbol: 'medicine' }).complete).toBe(true)
    expect(only(makeColony({ hands: { s1: [] } }), 's1', { symbol: 'medicine' }).complete).toBe(false) // at least one card
  })

  it('OBJ-018 Obsessed weapon hook: every survivor the seat controls carries a weapon', () => {
    const base = makeColony({ survivors: [{ id: 'sv.a', owner: 's1' }, { id: 'sv.b', owner: 's1' }], hands: { s1: ['it.weapon', 'it.weapon'] } })
    const [w1, w2] = base.seats['s1']!.hand
    const hook = CODE_HOOKS.objectives['rule.seat-survivors.eachEquippedSymbolAtLeast']!
    const one: GameState = { ...base, survivors: { ...base.survivors, 'sv.a': { ...base.survivors['sv.a']!, equipped: [w1!] } } }
    expect(hook(one, 's1', { symbol: 'weapon', n: 1 }).complete).toBe(false)
    const both: GameState = { ...one, survivors: { ...one.survivors, 'sv.b': { ...one.survivors['sv.b']!, equipped: [w2!] } } }
    expect(hook(both, 's1', { symbol: 'weapon', n: 1 }).complete).toBe(true)
  })

  it('OBJ-019 Hoarder hook (VASSAL scan): the seat must hold strictly more cards than any other player', () => {
    const hook = CODE_HOOKS.objectives['rule.hand.mostCards']!
    const tie = makeColony({ hands: { s1: ['it.food', 'it.food'], s2: ['it.food', 'it.fuel'] } })
    expect(hook(tie, 's1').complete).toBe(false)
    const ahead = makeColony({ hands: { s1: ['it.food', 'it.food', 'it.fuel'], s2: ['it.food', 'it.fuel'] } })
    expect(hook(ahead, 's1').complete).toBe(true)
    expect(hook(ahead, 's2').complete).toBe(false)
  })

  it('OBJ-020 Leave It All Behind weapon hook (VASSAL scan): one equipped weapon per non-exiled player, not per survivor', () => {
    const base = makeColony({ seats: ['s1', 's2'], survivors: [{ id: 'sv.a', owner: 's1' }, { id: 'sv.b', owner: 's1' }, { id: 'sv.c', owner: 's2' }], hands: { s1: ['it.weapon'], s2: ['it.weapon'] } })
    const hook = CODE_HOOKS.objectives['rule.non-exiled-seats.weaponEach']!
    const w1 = base.seats['s1']!.hand[0]!
    const w2 = base.seats['s2']!.hand[0]!
    expect(hook(base, null).complete).toBe(false)
    const one: GameState = { ...base, survivors: { ...base.survivors, 'sv.a': { ...base.survivors['sv.a']!, equipped: [w1] } } }
    expect(hook(one, null).complete).toBe(false) // s2 still unarmed
    const both: GameState = { ...one, survivors: { ...one.survivors, 'sv.c': { ...one.survivors['sv.c']!, equipped: [w2] } } }
    expect(hook(both, null).complete).toBe(true) // s1 has a second survivor with no weapon: still complete
  })

  it('OBJ-021 a margin that is behind reads as 0 in the progress report (Leader: survivors over the next largest group), while the condition still compares the real number', () => {
    let st = createGame({ seats: ['s1', 's2', 's3'].map((id) => ({ id, kind: 'bot' as const })), mainObjective: 'obj.main.we-need-more-samples' }, 'obj21', loadDefaultBundle()).state
    for (let k = 0; k < 40 && st.phase === 'setup'; k++) st = step(st, legalActions(st)[0]!).state
    let s: GameState = { ...st, seats: { ...st.seats, s1: { ...st.seats['s1']!, secretObjectiveId: 'obj.betrayal.cult-leader' } } }
    for (const id of [...s.seats['s3']!.survivors]) s = { ...s, survivors: { ...s.survivors, [id]: { ...s.survivors[id]!, owner: 's2' } }, seats: { ...s.seats, s2: { ...s.seats['s2']!, survivors: [...s.seats['s2']!.survivors, id] }, s3: { ...s.seats['s3']!, survivors: [] } } }
    const raw = CODE_HOOKS.objectives['rule.group-size.mostSurvivors']!(s, 's1', { margin: 1 })
    expect(raw.parts[0]!.have).toBeLessThan(0) // the real number is behind
    const own = ownObjectiveProgress(view(s, 's1')).own!
    const lead = own.parts.find((p) => /next largest/.test(p.label))
    expect(lead).toBeDefined()
    expect(lead!.have).toBe(0)
    for (const p of own.parts) expect(p.have, p.label).toBeGreaterThanOrEqual(0)
    expect(own.complete).toBe(false)
  })

  it('OBJ-022 a seat’s progress report counts emptied location decks from the public deck sizes (Raiding Party is not complete at setup)', () => {
    let st = createGame({ seats: ['s1', 's2', 's3', 's4'].map((id) => ({ id, kind: 'bot' as const })), mainObjective: 'obj.main.raiding-party' }, 'obj22', loadDefaultBundle()).state
    for (let k = 0; k < 40 && st.phase === 'setup'; k++) st = step(st, legalActions(st)[0]!).state
    const atSetup = objectiveProgressFromView(view(st, 's1'))
    expect(atSetup.parts[0]!.have).toBe(0)
    expect(atSetup.complete).toBe(false)
    // two decks run dry: the view agrees with the engine's own check
    const dry = (s: GameState, loc: string): GameState => ({ ...s, removed: [...s.removed, ...s.locations[loc]!.deck], locations: { ...s.locations, [loc]: { ...s.locations[loc]!, deck: [] } } })
    const s = dry(dry(st, 'loc.school'), 'loc.library')
    const done = objectiveProgressFromView(view(s, 's2'))
    expect(done.parts[0]!.have).toBe(2)
    expect(done.complete).toBe(true)
    expect(CODE_HOOKS.objectives['rule.location-deck.emptyAtLeast']!(s, 's2', { n: 2 }).complete).toBe(true)
  })
})
