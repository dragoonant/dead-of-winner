// Exile (10 R15, F 5.4): a passed exile vote (or an `exile` effect) exiles a seat, deals it an exiled objective, ends the game when a
// second non-betrayer is exiled, and asks the exiled seat to place its colony survivors outside (each placement is a move with
// exposure that does not use `movedThisTurn`). With no empty slot anywhere a non-exiled survivor is bumped back to the colony
// (F 5.4.1). The restrictions on an exiled seat (no crisis cards, no food on dice, no vote, no morale loss on its deaths, played
// cards go to `removed`, no helpless tokens) are read from `seat.exiled` by the modules that own those rules; nothing is stored here.
import type { PlaceExiledAction } from './actions'
import { fireWindow, recOf } from './effects'
import {
  type Out, deathCheckAllAt, exposureInto, halted, isOver, loseMoraleInto, mergeInto, raisePending, startOut, statsOf,
} from './exposure'
import { freeSpaces, placeSurvivor } from './survivors'
import type { DecisionOption, GameState, LocationId, PendingDecision, Rejection, SeatId, SurvivorId } from './types'

export interface Placement { survivorId: SurvivorId; to: LocationId }

const rej = (code: Rejection['code'], message: string, detail?: Record<string, unknown>): Rejection => ({ code, message, ...(detail ? { detail } : {}) })

// ---------- reading ----------
export const exiledSeats = (state: GameState): SeatId[] => state.seatOrder.filter((s) => state.seats[s]!.seat.exiled)
/** The dealt kind decides (spec 11 O5.4): a seat holding a betrayal objective stays a betrayer after exile. */
export function holdsBetrayal(state: GameState, seat: SeatId): boolean {
  const id = state.seats[seat]?.secretObjectiveId
  if (!id) return false
  let r: { type?: string; kind?: string } | undefined
  try { r = recOf(state, id) } catch { r = undefined }
  return r?.type === 'betrayal' || r?.kind === 'betrayal' || id.startsWith('obj.betrayal.')
}
/** Alive survivors of the seat still at the colony: the ones that must be placed. */
const trapped = (state: GameState, seat: SeatId): SurvivorId[] =>
  state.seats[seat]!.survivors.filter((id) => state.survivors[id]?.status === 'alive' && state.survivors[id]!.location === 'colony')
const outside = (state: GameState): LocationId[] => state.locationOrder.filter((l) => l !== 'colony')

/** F 5.4.1: the non-exiled survivor sent back to the colony when a location is full. R20.11 lets the exiled seat pick; the frozen
 *  `placements` shape has no field for it, so the engine takes the lowest-influence one (RULING logged by the caller's issues). */
export function bumpCandidate(state: GameState, loc: LocationId, skip: ReadonlySet<SurvivorId> = new Set()): SurvivorId | null {
  const cands = Object.values(state.survivors).filter((v) => v.status === 'alive' && v.location === loc && !skip.has(v.id) && v.owner && !state.seats[v.owner]?.seat.exiled)
  if (cands.length === 0) return null
  return cands.reduce((best, v) => (statsOf(state, v.id).influence < statsOf(state, best.id).influence ? v : best)).id
}

// ---------- planning (legal placements) ----------
/** Greedy plan over a location preference list; null when someone cannot be placed at all. */
function plan(state: GameState, ids: SurvivorId[], pref: LocationId[]): Placement[] | null {
  const free: Record<string, number> = {}
  for (const l of pref) free[l] = freeSpaces(state, l)
  const bumped = new Set<SurvivorId>()
  const out: Placement[] = []
  for (const id of ids) {
    let to = pref.find((l) => free[l]! > 0)
    if (to) free[to]! -= 1
    else {
      to = pref.find((l) => bumpCandidate(state, l, bumped) !== null)
      if (!to) return null
      bumped.add(bumpCandidate(state, to, bumped)!)
    }
    out.push({ survivorId: id, to })
  }
  return out
}
/** Distinct plans: the same greedy fill starting at each outside location in turn. */
export function placementPlans(state: GameState, ids: SurvivorId[]): Placement[][] {
  const locs = outside(state)
  const seen = new Set<string>()
  const out: Placement[][] = []
  for (let k = 0; k < locs.length; k++) {
    const p = plan(state, ids, [...locs.slice(k), ...locs.slice(0, k)])
    if (!p) continue
    const key = JSON.stringify(p)
    if (!seen.has(key)) { seen.add(key); out.push(p) }
  }
  return out
}

// ---------- the decision ----------
/** Raise `exilePlacement` for a seat that has survivors at the colony (nothing to place or nowhere to put them: no decision). */
export function raisePlacement(acc: Out, seat: SeatId): void {
  const ids = trapped(acc.state, seat)
  const plans = ids.length ? placementPlans(acc.state, ids) : []
  if (plans.length === 0) { acc.state = { ...acc.state, exile: null }; return }
  acc.state = { ...acc.state, exile: { seat, toPlace: ids } }
  const name = (id: string): string => { try { return (recOf(acc.state, id) as { name?: string } | undefined)?.name ?? id } catch { return id } }
  raisePending(acc, (id) => ({
    seat, kind: 'exilePlacement', window: 'seat.exiled', context: { seatId: seat, data: { code: 'exile' } }, canPass: false,
    options: plans.map((placements, i): DecisionOption => ({
      id: `place:${i}`, label: placements.map((p) => `${name(p.survivorId)} to ${name(p.to)}`).join(', '),
      action: { type: 'placeExiled', decisionId: id, seat, placements },
    })),
  }))
}

/** R15.1-R15.6. Returns the new state and events; `pending` is the placement decision (or one raised by the `seat.exiled` window). */
export function exileSeat(state: GameState, seat: SeatId): Out & { pending?: PendingDecision; deferredPlacement?: boolean } {
  const acc: Out & { deferredPlacement?: boolean } = startOut(state)
  const st = state.seats[seat]
  if (!st || st.seat.exiled || st.seat.eliminated) return acc
  const objectiveId = state.exiledObjectiveDeck[0] ?? null
  acc.state = {
    ...state, exiledObjectiveDeck: state.exiledObjectiveDeck.slice(1),
    seats: { ...state.seats, [seat]: { ...st, seat: { ...st.seat, exiled: true }, exiledObjectiveId: objectiveId } },
  }
  acc.events.push({ type: 'SeatExiled', seat, objectiveId: objectiveId ?? '' })
  // R15.6: a second exile with no betrayer among the exiled seats drops morale to 0
  const gone = exiledSeats(acc.state)
  if (gone.length >= 2 && !gone.some((s) => holdsBetrayal(acc.state, s))) loseMoraleInto(acc, acc.state.morale, 'doubleExile')
  if (isOver(acc.state)) return acc
  const w = fireWindow(acc.state, 'seat.exiled', { seat })
  mergeInto(acc, w)
  if (halted(acc)) { acc.deferredPlacement = !isOver(acc.state); return acc }
  raisePlacement(acc, seat)
  return acc
}

// ---------- the answer ----------
export function validatePlaceExiled(state: GameState, a: PlaceExiledAction): Rejection | null {
  if (state.phase === 'ended') return rej('E_GAME_OVER', 'the game is over')
  const pd = state.pending
  if (a.decisionId !== pd.id || pd.kind !== 'exilePlacement' || !state.exile) return rej('E_WRONG_DECISION', 'no exile placement is open', { expected: pd.id })
  if (a.seat !== pd.seat || a.seat !== state.exile.seat) return rej('E_NOT_YOUR_DECISION', 'the placement belongs to the exiled seat')
  if (!Array.isArray(a.placements)) return rej('E_BAD_PAYLOAD', 'placements must be a list')
  const need = new Set(state.exile.toPlace)
  const got = new Set(a.placements.map((p) => p.survivorId))
  if (got.size !== a.placements.length) return rej('E_BAD_PAYLOAD', 'a survivor is placed twice')
  for (const id of need) if (!got.has(id)) return rej('E_BAD_PAYLOAD', 'every survivor at the colony must be placed', { missing: id })
  for (const id of got) if (!need.has(id)) return rej('E_BAD_PAYLOAD', 'that survivor is not waiting to be placed', { survivorId: id })
  for (const p of a.placements) if (!state.locations[p.to] || p.to === 'colony') return rej('E_TARGET_INVALID', 'every survivor goes to a location outside the colony', { to: p.to })
  const free: Record<string, number> = {}
  for (const l of outside(state)) free[l] = freeSpaces(state, l)
  const bumped = new Set<SurvivorId>()
  for (const p of a.placements) {
    if (free[p.to]! > 0) { free[p.to]! -= 1; continue }
    // full: allowed only when no outside location has a free space and a non-exiled survivor can be sent back (F 5.4.1)
    if (outside(state).some((l) => free[l]! > 0)) return rej('E_NO_SPACE', 'that location is full while another has room', { to: p.to })
    const b = bumpCandidate(state, p.to, bumped)
    if (!b) return rej('E_NO_SPACE', 'no free space there and nobody to send back', { to: p.to })
    bumped.add(b)
  }
  return null
}

/** Place `placements` in order; returns the ones left when a decision (bite spread, new leader) or the game end interrupted. */
export function placeLoop(acc: Out, seat: SeatId, placements: Placement[]): Placement[] {
  for (let i = 0; i < placements.length; i++) {
    const p = placements[i]!
    const sv = acc.state.survivors[p.survivorId]
    if (!sv || sv.status !== 'alive' || sv.location !== 'colony') continue
    let to = p.to
    if (freeSpaces(acc.state, to) <= 0) {
      const other = outside(acc.state).find((l) => freeSpaces(acc.state, l) > 0)
      if (other) to = other
      else {
        const b = bumpCandidate(acc.state, p.to)
        if (!b) continue // nowhere to put it: it stays at the colony
        const from = acc.state.survivors[b]!.location
        mergeInto(acc, placeSurvivor(acc.state, b, 'colony', 'bump'))
        acc.events.push({ type: 'SurvivorBumped', survivorId: b, from, forExiled: p.survivorId })
      }
    }
    mergeInto(acc, placeSurvivor(acc.state, p.survivorId, to, 'exile'))
    deathCheckAllAt(acc, ['colony', to])
    exposureInto(acc, p.survivorId, 'move', { grantAt: 'colony' })
    if (halted(acc)) return placements.slice(i + 1)
  }
  return []
}

function setExile(acc: Out, seat: SeatId, rest: Placement[]): void {
  acc.state = { ...acc.state, exile: rest.length ? { seat, toPlace: rest.map((p) => p.survivorId) } : null }
}

/** `placeExiled` (R15.1). The caller attaches a resume when `rest` is not empty and a decision is open. */
export function applyPlaceExiled(state: GameState, a: PlaceExiledAction): Out & { rest: Placement[] } {
  const acc = startOut(state)
  acc.events.push({ type: 'ExiledPlaced', seat: a.seat, placements: a.placements.map((p) => ({ survivorId: p.survivorId, to: p.to })) })
  const rest = placeLoop(acc, a.seat, a.placements)
  setExile(acc, a.seat, isOver(acc.state) ? [] : rest)
  return { ...acc, rest: isOver(acc.state) ? [] : rest }
}

/** Continue the placements left over after an interruption. */
export function continuePlacements(state: GameState, seat: SeatId, rest: Placement[]): Out & { rest: Placement[] } {
  const acc = startOut(state)
  const left = placeLoop(acc, seat, rest)
  setExile(acc, seat, isOver(acc.state) ? [] : left)
  return { ...acc, rest: isOver(acc.state) ? [] : left }
}
