// Survivors, leaders, helpless tokens, morale (10 R10, R11, R14.1). killSurvivor is THE kill routine (00 §8):
// wounds, bites, overruns, crises, Crossroads, items and objectives all call it; nothing else changes a survivor's status.
// Interactive follow-ups (newLeader, an exiled seat's placement) are returned as a minted `decision` for the caller to
// install; the routine never installs it over another open decision itself. Whether morale 0 ends the game is the caller's
// (`moraleZero` in the result): this module only moves the track.
import type { ChooseLeaderAction } from './actions'
import type {
  DecisionAutoResolved, EquippedReturned, GameEvent, HandDiscarded, HelplessAdded, HelplessKilled, LeaderChosen, MoraleChanged,
  SeatEliminated, SurvivorAdded, SurvivorKilled, SurvivorMoved, SurvivorRemoved,
} from './events'
import type {
  CardId, DecisionOption, GameState, KillCause, LocationId, MoraleReason, PendingDecision, Rejection, SeatId, SurvivorId, SurvivorState,
} from './types'
import { aliveOf, mintDecision, patchLocation, patchSeat, patchSurvivor, reject, shuffleOn, survivorName, type Out } from './decks'

export const MORALE_MAX = 10 // R14.1: the top of the printed track

export interface KillResult extends Out {
  /** A follow-up the caller must raise as the new pending (`newLeader`, or the exiled seat's `effectChoice` placement), else null. */
  decision: PendingDecision | null
  /** The same decision under the name the other routines' accumulators use (exposure.ts Out.pending); absent when none. */
  pending?: PendingDecision
  moraleZero: boolean
}

// ---------- reading ----------
export const survivorsAt = (state: GameState, location: LocationId): SurvivorState[] =>
  Object.values(state.survivors).filter((s) => s.status === 'alive' && s.location === location)

/** Occupied survivor spaces: alive survivors there, plus helpless tokens at the colony (they sit in colony spaces). */
export const occupancy = (state: GameState, location: LocationId): number => survivorsAt(state, location).length + (state.locations[location]?.helpless ?? 0)
export const freeSpaces = (state: GameState, location: LocationId): number => Math.max(0, (state.locations[location]?.capacity.survivors ?? 0) - occupancy(state, location))
export const hasFreeSpace = (state: GameState, location: LocationId): boolean => freeSpaces(state, location) > 0

function noMoraleOnDeath(state: GameState, id: SurvivorId, owner: SeatId | null): boolean {
  if (owner && state.seats[owner]?.seat.exiled) return true // R10.2, R15.3
  return state.effects.some((e) => e.grants?.includes('noMoraleOnDeath') && (!e.seats || (owner !== null && e.seats.includes(owner))) && (!e.survivorIds || e.survivorIds.includes(id)))
}

// ---------- morale ----------
/** The only way morale changes (R14.1): clamped to 0..10, the event carries the applied delta. A no-op change emits nothing. */
export function changeMorale(state: GameState, delta: number, reason: MoraleReason, sourceId?: string): Out & { moraleZero: boolean } {
  const after = Math.max(0, Math.min(MORALE_MAX, state.morale + delta))
  const applied = after - state.morale
  if (applied === 0) return { state, events: [], moraleZero: state.morale <= 0 }
  const ev: MoraleChanged = { type: 'MoraleChanged', delta: applied, after, reason, ...(sourceId ? { sourceId } : {}) }
  return { state: { ...state, morale: after }, events: [ev], moraleZero: after <= 0 }
}

// ---------- adding survivors ----------
/** Puts a survivor card into play for a seat (R11.2): alive, no wounds, joins the seat's list. Space checks are the caller's (R11.3). */
export function addSurvivor(state: GameState, seat: SeatId, survivorId: SurvivorId, location: LocationId, source: SurvivorAdded['source']): Out {
  const sv: SurvivorState = { id: survivorId, owner: seat, location, status: 'alive', wounds: 0, frostbite: 0, equipped: [], movedThisTurn: false, extraMoves: 0 }
  const s = patchSeat({ ...state, survivors: { ...state.survivors, [survivorId]: sv } }, seat, { survivors: [...state.seats[seat]!.survivors, survivorId] })
  const ev: SurvivorAdded = { type: 'SurvivorAdded', survivorId, seat, location, source }
  return { state: s, events: [ev] }
}

/** Draws the top survivor card for a seat to `location` (colony by default). `survivorId` is null when the deck is empty (nothing changes). */
export function addSurvivorFromDeck(state: GameState, seat: SeatId, source: SurvivorAdded['source'], location: LocationId = 'colony'): Out & { survivorId: SurvivorId | null } {
  const top = state.survivorDeck[0]
  if (!top) return { state, events: [], survivorId: null }
  const r = addSurvivor({ ...state, survivorDeck: state.survivorDeck.slice(1) }, seat, top, location, source)
  return { ...r, survivorId: top }
}

// ---------- leaders ----------
export const leaderCandidates = (state: GameState, seat: SeatId): SurvivorId[] => aliveOf(state, seat)

/** E_NOT_LEADER_CANDIDATE unless the survivor is alive and controlled by the seat (SURV-002, SETUP-011). */
export function validateChooseLeader(state: GameState, seat: SeatId, survivorId: SurvivorId): Rejection | null {
  if (!leaderCandidates(state, seat).includes(survivorId)) return reject('E_NOT_LEADER_CANDIDATE', `${survivorId} cannot lead seat ${seat}`, { survivorId })
  return null
}

export function applyChooseLeader(state: GameState, seat: SeatId, survivorId: SurvivorId, reason: LeaderChosen['reason']): Out {
  const ev: LeaderChosen = { type: 'LeaderChosen', seat, survivorId, reason }
  return { state: patchSeat(state, seat, { leaderId: survivorId }), events: [ev] }
}

/** `chooseLeader` options for a seat, one per candidate (decision id supplied by the caller). */
export function leaderOptions(state: GameState, seat: SeatId, decisionId: string, candidates = leaderCandidates(state, seat)): DecisionOption[] {
  return candidates.map((survivorId) => {
    const action: ChooseLeaderAction = { type: 'chooseLeader', decisionId, seat, survivorId }
    return { id: `leader:${survivorId}`, label: `${survivorName(state, survivorId)} leads`, action }
  })
}

/** The `newLeader` decision for a seat whose leader fell (R10.4); install it with the returned state. */
export function newLeaderDecision(state: GameState, seat: SeatId): { state: GameState; pending: PendingDecision } {
  return mintDecision(state, (id) => ({
    seat, kind: 'newLeader', window: 'survivor.killed', context: { seatId: seat }, canPass: false, options: leaderOptions(state, seat, id),
  }))
}

// ---------- the exiled seat's placement of a replacement survivor (R10.5) ----------
const PLACEMENT_CODE = 'exiledSurvivorPlacement'
function placementDecision(state: GameState, seat: SeatId, survivorId: SurvivorId, spots: LocationId[]): { state: GameState; pending: PendingDecision } {
  return mintDecision(state, (id) => ({
    seat, kind: 'effectChoice', window: 'survivor.killed', canPass: false,
    context: { seatId: seat, survivorId, data: { code: PLACEMENT_CODE } },
    options: spots.map((loc) => ({ id: loc, label: `place at ${loc}`, action: { type: 'effectChoice', decisionId: id, seat, optionId: loc } })),
  }))
}

/** Answer to the placement decision: the drawn survivor enters play at the chosen non-colony location (a placement, not a move: no exposure). */
export function applyExiledPlacement(state: GameState, seat: SeatId, survivorId: SurvivorId, location: LocationId): Out {
  const added = addSurvivor(state, seat, survivorId, location, 'lastSurvivor')
  const chosen = applyChooseLeader(added.state, seat, survivorId, 'newSurvivor')
  return { state: chosen.state, events: [...added.events, ...chosen.events] }
}
export const isExiledPlacement = (pending: PendingDecision): boolean => pending.kind === 'effectChoice' && pending.context.data?.code === PLACEMENT_CODE

// ---------- losing a survivor ----------
interface LoseOpts { mode: 'kill' | 'remove'; cause?: KillCause; sourceId?: string; moraleLoss: boolean }

function lose(state0: GameState, id: SurvivorId, o: LoseOpts): KillResult {
  const r = loseInner(state0, id, o)
  return r.decision ? { ...r, pending: r.decision } : r
}

function loseInner(state0: GameState, id: SurvivorId, o: LoseOpts): KillResult {
  const sv = state0.survivors[id]
  if (!sv || sv.status !== 'alive') return { state: state0, events: [], decision: null, moraleZero: state0.morale <= 0 }
  const events: GameEvent[] = []
  const owner = sv.owner
  const ownerSeat = owner ? state0.seats[owner] : undefined
  const wasLeader = !!ownerSeat && ownerSeat.leaderId === id
  const exempt = noMoraleOnDeath(state0, id, owner)
  const moraleLoss = o.moraleLoss && !exempt

  // R10.1 die / removed
  let s = patchSurvivor(state0, id, { status: o.mode === 'kill' ? 'dead' : 'removed', owner: null, equipped: [], movedThisTurn: false })
  if (owner) s = patchSeat(s, owner, { survivors: s.seats[owner]!.survivors.filter((x) => x !== id) })
  if (o.mode === 'kill') {
    const ev: SurvivorKilled = { type: 'SurvivorKilled', survivorId: id, owner, location: sv.location, cause: o.cause ?? 'item', moraleLoss, wasLeader }
    events.push(ev)
  } else {
    const ev: SurvivorRemoved = { type: 'SurvivorRemoved', survivorId: id, owner, sourceId: o.sourceId ?? 'effect' }
    events.push(ev)
  }
  // R10.2 morale
  if (moraleLoss) {
    const m = changeMorale(s, -1, 'survivorKilled', id)
    s = m.state; events.push(...m.events)
  }
  // R10.3 equipped cards: colony -> owner's hand, elsewhere -> shuffled into that location's deck
  if (sv.equipped.length > 0) {
    const cardIds: CardId[] = sv.equipped
    if (sv.location === 'colony' && owner) {
      s = patchSeat(s, owner, { hand: [...s.seats[owner]!.hand, ...cardIds] })
      events.push({ type: 'EquippedReturned', survivorId: id, cardIds, to: 'hand', location: sv.location } as EquippedReturned)
    } else if (sv.location !== 'colony') {
      const sh = shuffleOn(s, [...s.locations[sv.location]!.deck, ...cardIds])
      s = patchLocation(sh.state, sv.location, { deck: sh.items })
      events.push({ type: 'EquippedReturned', survivorId: id, cardIds, to: 'deck', location: sv.location } as EquippedReturned)
      events.push({ type: 'DeckShuffled', location: sv.location, reason: 'equippedReturned' })
    }
  }
  const moraleZero = s.morale <= 0
  if (!owner || !ownerSeat) return { state: s, events, decision: null, moraleZero }

  // R10.4 leader lost, followers left
  const remaining = aliveOf(s, owner)
  if (remaining.length > 0) {
    if (!wasLeader) return { state: s, events, decision: null, moraleZero }
    if (remaining.length === 1) {
      const only = remaining[0]!
      const auto: DecisionAutoResolved = { type: 'DecisionAutoResolved', kind: 'newLeader', seat: owner, optionId: `leader:${only}` }
      const l = applyChooseLeader(s, owner, only, 'replacement')
      return { state: l.state, events: [...events, auto, ...l.events], decision: null, moraleZero }
    }
    s = patchSeat(s, owner, { leaderId: null })
    const d = newLeaderDecision(s, owner)
    return { state: d.state, events, decision: d.pending, moraleZero }
  }

  // R10.5 last survivor lost: the hand leaves the game unrevealed
  const hand = s.seats[owner]!.hand
  s = patchSeat(s, owner, { hand: [], leaderId: null })
  s = { ...s, removedHidden: [...s.removedHidden, ...hand] }
  for (const cardId of hand) events.push({ type: 'CardDiscarded', seat: owner, cardId, to: 'removed', reason: 'lastSurvivor', revealed: false })
  events.push({ type: 'HandDiscarded', seat: owner, count: hand.length, reason: 'lastSurvivor' } as HandDiscarded)

  // R10.6 elimination (variant, or nobody left to draw: R20.9)
  if (s.setup.variants?.playerElimination || s.survivorDeck.length === 0) {
    s = patchSeat(s, owner, { seat: { ...s.seats[owner]!.seat, eliminated: true } })
    events.push({ type: 'SeatEliminated', seat: owner } as SeatEliminated)
    return { state: s, events, decision: null, moraleZero }
  }
  const top = s.survivorDeck[0]!
  s = { ...s, survivorDeck: s.survivorDeck.slice(1) }
  if (ownerSeat.seat.exiled) {
    // an exiled owner places the new survivor at a non-colony location with a free space
    let spots = s.locationOrder.filter((l) => l !== 'colony' && hasFreeSpace(s, l))
    if (spots.length === 0) spots = ['colony']
    if (spots.length === 1) {
      events.push({ type: 'DecisionAutoResolved', kind: 'effectChoice', seat: owner, optionId: spots[0]! })
      const p = applyExiledPlacement(s, owner, top, spots[0]!)
      return { state: p.state, events: [...events, ...p.events], decision: null, moraleZero }
    }
    const d = placementDecision(s, owner, top, spots)
    return { state: d.state, events, decision: d.pending, moraleZero }
  }
  const added = addSurvivor(s, owner, top, 'colony', 'lastSurvivor')
  const l = applyChooseLeader(added.state, owner, top, 'newSurvivor')
  return { state: l.state, events: [...events, ...added.events, ...l.events], decision: null, moraleZero }
}

/** THE kill routine (R10). `opts.noMorale` is for a card whose text skips the morale loss (RULE-001). */
export function killSurvivor(state: GameState, survivorId: SurvivorId, cause: KillCause, opts: { noMorale?: boolean } = {}): KillResult {
  return lose(state, survivorId, { mode: 'kill', cause, moraleLoss: !opts.noMorale })
}

/** Taken out of the game by a card (R10.7): no morale loss unless the card says so; leader and last-survivor handling still apply. */
export function removeSurvivor(state: GameState, survivorId: SurvivorId, sourceId: string, opts: { moraleLoss?: boolean } = {}): KillResult {
  return lose(state, survivorId, { mode: 'remove', sourceId, moraleLoss: !!opts.moraleLoss })
}

// ---------- helpless tokens (R11.4, R14) ----------
/** Adds up to `count` helpless tokens to the colony as space allows (R11.3); exiled seats add none (pass `byExiledSeat`). */
export function addHelpless(state: GameState, count: number, sourceId: string, opts: { byExiledSeat?: boolean } = {}): Out & { added: number } {
  if (opts.byExiledSeat || count <= 0) return { state, events: [], added: 0 }
  const added = Math.min(count, freeSpaces(state, 'colony'))
  if (added === 0) return { state, events: [], added: 0 }
  const after = state.locations['colony']!.helpless + added
  const ev: HelplessAdded = { type: 'HelplessAdded', location: 'colony', count: added, after, sourceId }
  return { state: patchLocation(state, 'colony', { helpless: after }), events: [ev], added }
}

/** Kills helpless tokens: morale -1 for EACH, always (R10.2). */
export function killHelpless(state: GameState, count: number, cause: KillCause): Out & { killed: number; moraleZero: boolean } {
  const have = state.locations['colony']?.helpless ?? 0
  const killed = Math.min(count, have)
  if (killed <= 0) return { state, events: [], killed: 0, moraleZero: state.morale <= 0 }
  const after = have - killed
  let s = patchLocation(state, 'colony', { helpless: after })
  const events: GameEvent[] = [{ type: 'HelplessKilled', location: 'colony', count: killed, after, cause, moraleLoss: true } as HelplessKilled]
  const m = changeMorale(s, -killed, 'helplessKilled')
  s = m.state; events.push(...m.events)
  return { state: s, events, killed, moraleZero: m.moraleZero }
}

/** A placement that is not a move (exile, bump): updates the location and emits SurvivorMoved with the given kind. */
export function placeSurvivor(state: GameState, survivorId: SurvivorId, to: LocationId, kind: SurvivorMoved['kind']): Out {
  const sv = state.survivors[survivorId]!
  const ev: SurvivorMoved = { type: 'SurvivorMoved', survivorId, from: sv.location, to, kind }
  return { state: patchSurvivor(state, survivorId, { location: to }), events: [ev] }
}
