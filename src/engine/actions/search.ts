// search (R6.4): draw from the location deck, then keep a card or make noise for another, until the noise spaces run out.
// Open-search state lives in state.search; the drawn cards are HIDDEN from other seats (view.ts).
import type { Action, KeepCardAction, MakeNoiseAction, SearchAction } from '../actions'
import { fireInto, halted, patchLocation, raisePending, recordOf, startOut, svc, type Out } from '../exposure'
import type { CardId, GameState, ItemSymbol, Rejection } from '../types'
import { checkActor, checkDecision, checkDie, finish, lowestDie, needFor, rej, rejected, spendDieInto, turnContext } from './die-common'

const symbolsOf = (state: GameState, defId: string): ItemSymbol[] => {
  const r = recordOf(state, defId) as { symbol?: ItemSymbol; symbols?: ItemSymbol[] } | undefined
  return r?.symbols ?? (r?.symbol ? [r.symbol] : [])
}
const cardLabel = (state: GameState, cardId: CardId): string => {
  const defId = state.cards[cardId]?.defId ?? cardId
  return (recordOf(state, defId) as { name?: string } | undefined)?.name ?? defId
}

export function validateSearch(state: GameState, a: SearchAction): Rejection | null {
  const r0 = checkDecision(state, a) ?? checkActor(state, a.seat, a.survivorId)
  if (r0) return r0
  const sv = state.survivors[a.survivorId]!
  if (state.search) return rej('E_NOT_AN_OPTION', 'a search is already open')
  if (sv.location === 'colony') return rej('E_WRONG_LOCATION', 'nothing to search at the colony')
  if (svc().forbidden(state, 'search', { survivorId: a.survivorId, seat: a.seat, location: sv.location })) return rej('E_FORBIDDEN', 'searching is forbidden right now')
  const r1 = checkDie(state, a.seat, a.dieId, needFor(state, a.survivorId, 'search'))
  if (r1) return r1
  if (state.locations[sv.location]!.deck.length === 0) return rej('E_DECK_EMPTY', 'the location deck is empty')
  return null
}

/** Draw the top card into the open search (private SearchDrawn). */
function drawInto(acc: Out): boolean {
  const s = acc.state.search!
  const loc = acc.state.locations[s.location]!
  const cardId = loc.deck[0]
  if (!cardId) return false
  acc.state = { ...patchLocation(acc.state, s.location, { deck: loc.deck.slice(1) }), search: { ...s, drawn: [...s.drawn, cardId] } }
  const defId = acc.state.cards[cardId]!.defId
  acc.events.push({ type: 'SearchDrawn', seat: s.seat, location: s.location, cardId, defId, symbols: symbolsOf(acc.state, defId) })
  fireInto(acc, 'search.drawn', { seat: s.seat, survivorId: s.survivorId, location: s.location })
  return true
}

const noiseLeft = (state: GameState, location: string): number => {
  const l = state.locations[location]!
  return l.capacity.noiseSpaces - l.noise
}

/** Keep one drawn card: it goes to hand, the rest go under the deck in draw order (R6.4). */
function keepInto(acc: Out, cardId: CardId): void {
  const s = acc.state.search!
  const st = acc.state.seats[s.seat]!
  const rest = s.drawn.filter((c) => c !== cardId)
  const loc = acc.state.locations[s.location]!
  acc.state = {
    ...patchLocation(acc.state, s.location, { deck: [...loc.deck, ...rest] }),
    seats: { ...acc.state.seats, [s.seat]: { ...st, hand: [...st.hand, cardId] } },
    search: null,
  }
  acc.events.push({ type: 'SearchKept', seat: s.seat, location: s.location, cardId, returned: rest.length })
  for (const c of rest) acc.events.push({ type: 'CardDiscarded', seat: s.seat, cardId: c, to: 'deck', reason: 'searchReturned', revealed: false }) // GOLD-003 event 7; the id stays private (R6.4)
  fireInto(acc, 'search.kept', { seat: s.seat, survivorId: s.survivorId, location: s.location })
  fireInto(acc, 'action.search', { seat: s.seat, survivorId: s.survivorId, location: s.location })
}

/** After a draw: ask keep-or-noise, ask keep-which, or keep the only card at once. */
function decideInto(acc: Out): void {
  const s = acc.state.search!
  const canNoise = noiseLeft(acc.state, s.location) > 0 && acc.state.locations[s.location]!.deck.length > 0
  if (!canNoise && s.drawn.length === 1) {
    const only = s.drawn[0]!
    acc.events.push({ type: 'DecisionAutoResolved', kind: 'searchKeepWhich', seat: s.seat, optionId: only })
    keepInto(acc, only)
    return
  }
  raisePending(acc, (id) => ({
    seat: s.seat, kind: canNoise ? 'searchKeepOrNoise' : 'searchKeepWhich', window: 'search.drawn',
    context: { survivorId: s.survivorId, location: s.location, cardIds: s.drawn },
    options: [
      ...s.drawn.map((c) => ({ id: c, label: `Keep ${cardLabel(acc.state, c)}`, action: { type: 'keepCard' as const, decisionId: id, seat: s.seat, cardId: c } })),
      ...(canNoise ? [{ id: 'noise', label: 'Make noise and draw another card', action: { type: 'makeNoise' as const, decisionId: id, seat: s.seat } }] : []),
    ],
    canPass: false,
  }))
}

export function applySearch(state: GameState, a: SearchAction) {
  const bad = validateSearch(state, a)
  if (bad) return rejected(state, a, bad)
  const acc = startOut(state)
  const sv = state.survivors[a.survivorId]!
  const need = needFor(state, a.survivorId, 'search')
  spendDieInto(acc, a.seat, a.dieId, 'search', a.survivorId, need)
  acc.events.push({ type: 'SearchStarted', seat: a.seat, survivorId: a.survivorId, location: sv.location, dieId: a.dieId, need })
  acc.state = { ...acc.state, search: { seat: a.seat, survivorId: a.survivorId, location: sv.location, dieId: a.dieId, drawn: [], noiseAdded: 0 } }
  const look = 1 + svc().searchBonus(acc.state, a.survivorId, sv.location).look
  for (let i = 0; i < look; i++) if (!drawInto(acc)) break
  decideInto(acc)
  return finish(acc, 'search.drawn')
}

export function validateKeepCard(state: GameState, a: KeepCardAction): Rejection | null {
  const r0 = checkDecision(state, a, ['searchKeepOrNoise', 'searchKeepWhich'])
  if (r0) return r0
  if (!state.search || !state.search.drawn.includes(a.cardId)) return rej('E_NOT_AN_OPTION', 'that card was not drawn')
  return null
}
export function applyKeepCard(state: GameState, a: KeepCardAction) {
  const bad = validateKeepCard(state, a)
  if (bad) return rejected(state, a, bad)
  const acc = startOut(state)
  keepInto(acc, a.cardId)
  return finish(acc, 'action.search')
}

export function validateMakeNoise(state: GameState, a: MakeNoiseAction): Rejection | null {
  const r0 = checkDecision(state, a, ['searchKeepOrNoise', 'searchKeepWhich'])
  if (r0) return r0
  const s = state.search
  if (!s) return rej('E_NOT_AN_OPTION', 'no search is open')
  if (noiseLeft(state, s.location) <= 0) return rej('E_NO_NOISE_SPACE', 'every noise space is taken')
  if (state.locations[s.location]!.deck.length === 0) return rej('E_DECK_EMPTY', 'the location deck is empty')
  if (state.pending.kind !== 'searchKeepOrNoise') return rej('E_NOT_AN_OPTION', 'noise is not an option now')
  return null
}
export function applyMakeNoise(state: GameState, a: MakeNoiseAction) {
  const bad = validateMakeNoise(state, a)
  if (bad) return rejected(state, a, bad)
  const acc = startOut(state)
  const s = state.search!
  const loc = state.locations[s.location]!
  acc.state = { ...patchLocation(acc.state, s.location, { noise: loc.noise + 1 }), search: { ...s, noiseAdded: s.noiseAdded + 1 } }
  acc.events.push({ type: 'NoiseAdded', location: s.location, count: 1, after: loc.noise + 1, by: 'search' })
  fireInto(acc, 'noise.added', { location: s.location, seat: s.seat })
  if (!halted(acc)) { drawInto(acc); decideInto(acc) }
  return finish(acc, 'search.drawn')
}

// ---------- candidates for legalActions ----------
export function legalSearches(state: GameState): Action[] {
  const ctx = turnContext(state)
  if (!ctx) return []
  const out: Action[] = []
  for (const id of ctx.survivors) {
    const die = lowestDie(ctx.dice, needFor(state, id, 'search'))
    if (!die) continue
    const a: SearchAction = { type: 'search', decisionId: state.pending.id, seat: ctx.seat, survivorId: id, dieId: die.id }
    if (validateSearch(state, a) === null) out.push(a)
  }
  return out
}
/** Answers to an open searchKeepOrNoise / searchKeepWhich: exactly the options the engine raised. */
export const legalSearchAnswers = (state: GameState): Action[] => (state.pending.options ?? []).map((o) => o.action)
