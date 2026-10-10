import { describe, expect, it } from 'vitest'
import type { KeepCardAction, MakeNoiseAction, SearchAction } from '../../src/engine/actions'
import { applyKeepCard, applyMakeNoise, applySearch, legalSearchAnswers, legalSearches } from '../../src/engine/actions/search'
import { patchLocation } from '../../src/engine/exposure'
import type { GameState } from '../../src/engine/types'
import { GAS, makeState, of, types } from './atk-fixture'

const DECK = ['c:lighter1', 'c:fuel1', 'c:food1', 'c:food2']
const setup = (o: { dice?: number[]; deck?: string[]; where?: string; noise?: number } = {}) => {
  let s = makeState({
    survivors: [{ id: 'sv.forest', owner: 's1', location: o.where ?? GAS }, { id: 'sv.mike', owner: 's2', location: GAS }],
    dice: { s1: o.dice ?? [5, 5] }, decks: { [GAS]: o.deck ?? DECK },
  })
  if (o.noise) s = patchLocation(s, GAS, { noise: o.noise })
  return s
}
const search = (s: GameState, dieId = 's1:d1'): SearchAction => ({ type: 'search', decisionId: s.pending.id, seat: 's1', survivorId: 'sv.forest', dieId })
const keep = (s: GameState, cardId: string): KeepCardAction => ({ type: 'keepCard', decisionId: s.pending.id, seat: 's1', cardId })
const noise = (s: GameState): MakeNoiseAction => ({ type: 'makeNoise', decisionId: s.pending.id, seat: 's1' })

describe('searching', () => {
  it('SRCH-001 a qualifying die draws the top card privately and asks keep-or-noise', () => {
    const r = applySearch(setup(), search(setup()))
    expect(of(r.events, 'SearchStarted')[0]).toMatchObject({ need: 5, location: GAS })
    expect(of(r.events, 'SearchDrawn')[0]).toMatchObject({ cardId: 'c:lighter1', defId: 'it.lighter', symbols: ['weapon'] })
    expect(r.pending).toMatchObject({ kind: 'searchKeepOrNoise', seat: 's1' })
    expect(r.state.search!.drawn).toEqual(['c:lighter1'])
    expect(r.state.locations[GAS]!.deck).toEqual(DECK.slice(1))
  })

  it('SRCH-002 making noise adds a token and draws the next card', () => {
    const a = applySearch(setup(), search(setup()))
    const r = applyMakeNoise(a.state, noise(a.state))
    expect(of(r.events, 'NoiseAdded')[0]).toMatchObject({ after: 1, by: 'search' })
    expect(of(r.events, 'SearchDrawn')[0]).toMatchObject({ cardId: 'c:fuel1' })
    expect(r.pending.kind).toBe('searchKeepOrNoise')
  })

  it('SRCH-003 keeping a card puts the others under the deck', () => {
    const a = applySearch(setup(), search(setup()))
    const b = applyMakeNoise(a.state, noise(a.state))
    const r = applyKeepCard(b.state, keep(b.state, 'c:fuel1'))
    expect(of(r.events, 'SearchKept')[0]).toMatchObject({ cardId: 'c:fuel1', returned: 1 })
    expect(r.state.seats['s1']!.hand).toEqual(['c:fuel1'])
    expect(r.state.locations[GAS]!.deck).toEqual(['c:food1', 'c:food2', 'c:lighter1'])
    expect(r.state.search).toBeNull()
    expect(r.pending.kind).toBe('turnAction')
  })

  it('SRCH-004 keeping a card that was not drawn is not an option', () => {
    const a = applySearch(setup(), search(setup()))
    const r = applyKeepCard(a.state, keep(a.state, 'c:food2'))
    expect(r.rejection?.code).toBe('E_NOT_AN_OPTION')
    expect(r.state).toBe(a.state)
  })

  it('SRCH-005 no searching at the colony and no searching with a low die', () => {
    const colony = setup({ where: 'colony' })
    expect(applySearch(colony, search(colony)).rejection?.code).toBe('E_WRONG_LOCATION')
    const low = setup({ dice: [4] })
    expect(applySearch(low, search(low)).rejection?.code).toBe('E_DIE_TOO_LOW')
  })

  it('SRCH-006 with every noise space taken the single drawn card is kept at once', () => {
    const s = setup({ noise: 4 })
    const r = applySearch(s, search(s))
    expect(of(r.events, 'DecisionAutoResolved')).toHaveLength(1)
    expect(r.state.seats['s1']!.hand).toEqual(['c:lighter1'])
    expect(r.pending.kind).toBe('turnAction')
  })

  it('SRCH-007 the fourth noise token leaves a keep-which decision over both cards', () => {
    const s = setup({ noise: 3 })
    const a = applySearch(s, search(s))
    const r = applyMakeNoise(a.state, noise(a.state))
    expect(r.state.locations[GAS]!.noise).toBe(4)
    expect(r.pending).toMatchObject({ kind: 'searchKeepWhich' })
    expect(legalSearchAnswers(r.state).map((x) => x.type)).toEqual(['keepCard', 'keepCard'])
    expect(r.pending.options!.map((o) => o.action.type)).toEqual(['keepCard', 'keepCard'])
    expect(applyMakeNoise(r.state, noise(r.state)).rejection?.code).toBe('E_NO_NOISE_SPACE')
  })

  it('SRCH-008 returned cards go under the deck in draw order', () => {
    let st = applySearch(setup(), search(setup())).state
    for (let i = 0; i < 2; i++) st = applyMakeNoise(st, noise(st)).state
    const r = applyKeepCard(st, keep(st, 'c:fuel1'))
    expect(r.state.locations[GAS]!.deck).toEqual(['c:food2', 'c:lighter1', 'c:food1'])
  })

  it('SRCH-009 an empty deck blocks the search; running dry mid-search keeps the card', () => {
    const empty = setup({ deck: [] })
    expect(applySearch(empty, search(empty)).rejection?.code).toBe('E_DECK_EMPTY')
    const one = setup({ deck: ['c:fuel1'] })
    const r = applySearch(one, search(one))
    expect(r.state.seats['s1']!.hand).toEqual(['c:fuel1'])
    expect(r.pending.kind).toBe('turnAction')
  })

  it('SRCH-010 two searches in a turn accumulate noise', () => {
    let st = applySearch(setup(), search(setup())).state
    st = applyMakeNoise(st, noise(st)).state
    st = applyKeepCard(st, keep(st, 'c:fuel1')).state
    st = applySearch(st, search(st, 's1:d2')).state
    st = applyMakeNoise(st, noise(st)).state
    expect(st.locations[GAS]!.noise).toBe(2)
  })

  it('SRCH-014 the open search keeps the drawn cards in state.search only', () => {
    const r = applySearch(setup(), search(setup()))
    expect(r.state.seats['s1']!.hand).toEqual([])
  })

  it('ACT-003 the candidate searches all validate', () => {
    const s = setup()
    const list = legalSearches(s)
    expect(list).toHaveLength(1)
    expect(types(applySearch(s, list[0] as SearchAction).events)).toContain('SearchStarted')
  })
})
