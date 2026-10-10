// OBJ-010..: adding cards under the main objective (spec 11 O2.4, ruling O7.1): the contributeObjective action.
import { describe, expect, it } from 'vitest'
import { createGame, legalActions, query, redactEvent, step, view, type Action, type GameSetup, type GameState } from '../../src/engine/index'
import { loadDefaultBundle } from '../../tools/default-bundle'

const bundle = loadDefaultBundle()
const setupOf = (objective: string, seats = 3): GameSetup => ({
  seats: Array.from({ length: seats }, (_, i) => ({ id: `s${i + 1}`, kind: 'bot' as const })), mainObjective: objective, side: 'normal',
} as unknown as GameSetup)

function toFirstTurn(objective: string, seed = 'obj-contrib'): GameState {
  let s = createGame(setupOf(objective), seed, bundle).state
  for (let i = 0; i < 80 && s.pending.kind !== 'turnAction'; i++) s = step(s, legalActions(s)[0]!).state
  expect(s.pending.kind).toBe('turnAction')
  return s
}
/** Put a fresh (non-starter) card of `defId` into the active seat's hand; returns its instance id. */
function give(s: GameState, defId: string, starter = false): { s: GameState; id: string } {
  const seat = s.pending.seat as string
  const id = `t:${Object.keys(s.cards).length}:${defId}`
  const inst = starter ? { id, defId, starter: true as const } : { id, defId }
  return { id, s: { ...s, cards: { ...s.cards, [id]: inst }, seats: { ...s.seats, [seat]: { ...s.seats[seat]!, hand: [...s.seats[seat]!.hand, id] } } } }
}
const act = (s: GameState, cardId: string): Action => ({ type: 'contributeObjective', decisionId: s.pending.id, seat: s.pending.seat as string, cardId })

describe('objective contributions', () => {
  it('OBJ-010 a non-starter medicine card joins Find a Cure: counter, events, public cards, no CardPlayed, no die spent', () => {
    const base = toFirstTurn('obj.main.find-a-cure')
    const { s, id } = give(base, 'it.medicine')
    const dice = JSON.stringify(s.seats[s.pending.seat as string]!.dice)
    const r = step(s, act(s, id))
    expect(r.rejection).toBeUndefined()
    expect(r.state.objective.cards).toEqual([id])
    expect(r.state.objective.counters['medicine']).toBe(1)
    expect(r.state.seats[s.pending.seat as string]!.hand).not.toContain(id)
    expect(r.events.map((e) => e.type)).toEqual(['CardAddedToObjective', 'ObjectiveProgress'])
    expect(r.events[0]).toMatchObject({ seat: s.pending.seat, cardId: id, counter: 'medicine' })
    expect(JSON.stringify(r.state.seats[s.pending.seat as string]!.dice)).toBe(dice)
    expect(r.state.pending.kind).toBe('turnAction')
    // public: every seat sees the card and the event, and query.objectiveProgress shows it
    const other = s.seatOrder.find((x) => x !== s.pending.seat)!
    const v = view(r.state, other)
    expect(v.objective.cards).toEqual([id])
    expect(v.cards[id]?.defId).toBe('it.medicine')
    expect(redactEvent(r.events[0]!, other)).toMatchObject({ cardId: id })
    expect(query.objectiveProgress(v).parts[0]).toMatchObject({ have: 1, need: 6 })
  })

  it('OBJ-011 a starter-deck card does not count where the objective says so; a wrong symbol is never legal', () => {
    const base = toFirstTurn('obj.main.find-a-cure')
    const a = give(base, 'it.medicine', true)
    expect(step(a.s, act(a.s, a.id)).rejection?.code).toBe('E_CARD_NOT_PLAYABLE')
    const b = give(a.s, 'it.fuel')
    expect(step(b.s, act(b.s, b.id)).rejection?.code).toBe('E_CARD_NOT_PLAYABLE')
    const legal = legalActions(b.s).filter((x) => x.type === 'contributeObjective')
    expect(legal.some((x) => (x as { cardId: string }).cardId === a.id)).toBe(false)
    expect(legal.some((x) => (x as { cardId: string }).cardId === b.id)).toBe(false)
  })

  it('OBJ-012 only own hand cards on your own turn; a stale decision is rejected', () => {
    const base = toFirstTurn('obj.main.find-a-cure')
    const { s, id } = give(base, 'it.medicine')
    const other = s.seatOrder.find((x) => x !== s.pending.seat)!
    expect(step(s, { ...act(s, id), seat: other } as Action).rejection).toBeDefined()
    expect(step(s, { ...act(s, id), cardId: 'c:nope' } as Action).rejection?.code).toBe('E_NOT_IN_HAND')
    expect(step(s, { ...act(s, id), decisionId: 'stale' } as Action).rejection?.code).toBe('E_WRONG_DECISION')
  })

  it('OBJ-013 Stockpile counts medicine, tool and fuel separately and stops accepting a symbol once its need is met', () => {
    let { s } = give(toFirstTurn('obj.main.stockpile'), 'it.medicine')
    const ids: string[] = []
    for (let i = 0; i < 3; i++) { const g = give(s, 'it.medicine'); s = g.s; ids.push(g.id) }
    const t = give(s, 'it.flashlight'); s = t.s
    for (const id of ids.slice(0, 2)) s = step(s, act(s, id)).state
    expect(s.objective.counters['medicine']).toBe(2)
    expect(step(s, act(s, ids[2]!)).rejection?.code).toBe('E_CARD_NOT_PLAYABLE')
    s = step(s, act(s, t.id)).state
    expect(s.objective.counters).toMatchObject({ medicine: 2, tool: 1 })
  })

  it('OBJ-014 an objective with no card contributions (We Need More Samples) refuses every card; Winter Has Come takes starter fuel', () => {
    const base = toFirstTurn('obj.main.we-need-more-samples')
    const { s, id } = give(base, 'it.medicine')
    expect(step(s, act(s, id)).rejection?.code).toBe('E_CARD_NOT_PLAYABLE')
    const w = give(toFirstTurn('obj.main.winter-has-come'), 'it.fuel', true)
    expect(step(w.s, act(w.s, w.id)).rejection).toBeUndefined()
  })

  it('OBJ-015 Find a Cure completes at the colony objective check once the cards are in', () => {
    let s = toFirstTurn('obj.main.find-a-cure')
    expect(s.objective.counters['medicine'] ?? 0).toBe(0)
    const need = 6 // 3 seats x 2
    for (let i = 0; i < need; i++) {
      const g = give(s, 'it.medicine'); s = step(g.s, act(g.s, g.id)).state
    }
    expect(s.objective.counters['medicine']).toBe(need)
    expect(query.objectiveProgress(view(s, 's1')).complete).toBe(true)
  })
})
