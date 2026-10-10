// contributeObjective (spec 11 O2.4, F 4.1.1, ruling O7.1): a hand card whose symbol the main objective counts joins `objective.cards`, face up.
// A no-die action on the seat's own turn, any number of times, exiled seats included (F 5.4.3). It is not an item play: no effect, no waste,
// no CardPlayed and no action window. Starter-deck cards are excluded where the objective says so (`excludeStarter`).
import type { ContributeObjectiveAction } from '../actions'
import {
  type ActionResult, checkDecision, defOf, detachCard, emitEvent, mkAcc, objectiveNeed, patchState, recOf, rejection, symbolsOf, type Rec,
} from '../effects'
import type { CardId, GameState, Rejection } from '../types'

/** The objective contribution entry this card would count for (null = it counts for nothing). */
export function objectiveEntryFor(state: GameState, cardId: CardId): Rec | null {
  const def = defOf(state, cardId)
  if (!def) return null
  const side = (recOf(state, state.objective.id) as Rec | undefined)?.sides?.[state.objective.side]
  const syms = symbolsOf(def)
  const starter = !!state.cards[cardId]?.starter
  for (const c of (side?.contributions ?? []) as Rec[]) {
    if (!syms.includes(c.symbol)) continue
    if (c.excludeStarter && starter) continue
    if ((state.objective.counters[c.counter] ?? 0) >= objectiveNeed(state, c.counter)) continue // nothing left to add
    return c
  }
  return null
}

export function validateContributeObjective(state: GameState, a: ContributeObjectiveAction): Rejection | null {
  const bad = checkDecision(state, a, ['turnAction'])
  if (bad) return bad
  const st = state.seats[a.seat]
  if (!st) return rejection('E_NOT_YOUR_DECISION', 'unknown seat')
  if (!st.hand.includes(a.cardId)) return rejection('E_NOT_IN_HAND', 'that card is not in your hand')
  if (state.objective.complete) return rejection('E_CARD_NOT_PLAYABLE', 'the objective is already complete')
  if (!objectiveEntryFor(state, a.cardId)) return rejection('E_CARD_NOT_PLAYABLE', 'the objective does not count that card')
  return null
}

export function contributeObjective(state: GameState, a: ContributeObjectiveAction): ActionResult {
  const bad = validateContributeObjective(state, a)
  if (bad) return { state, events: [], rejection: bad }
  const acc = mkAcc(state)
  const entry = objectiveEntryFor(state, a.cardId)!
  const def = defOf(state, a.cardId)!
  detachCard(acc, a.cardId)
  const after = (acc.state.objective.counters[entry.counter] ?? 0) + 1
  patchState(acc, { objective: { ...acc.state.objective, cards: [...acc.state.objective.cards, a.cardId], counters: { ...acc.state.objective.counters, [entry.counter]: after } } })
  emitEvent(acc, { type: 'CardAddedToObjective', seat: a.seat, cardId: a.cardId, defId: def.id, counter: entry.counter })
  emitEvent(acc, { type: 'ObjectiveProgress', objectiveId: acc.state.objective.id, seat: null, counter: entry.counter, delta: 1, after, need: objectiveNeed(acc.state, entry.counter) })
  return { state: acc.state, events: acc.events }
}

export function contributeObjectiveCandidates(state: GameState): ContributeObjectiveAction[] {
  const pd = state.pending
  if (pd.kind !== 'turnAction' || pd.seat === 'all') return []
  const out: ContributeObjectiveAction[] = []
  for (const cardId of state.seats[pd.seat]!.hand) {
    const a: ContributeObjectiveAction = { type: 'contributeObjective', decisionId: pd.id, seat: pd.seat, cardId }
    if (!validateContributeObjective(state, a)) out.push(a)
  }
  return out
}
