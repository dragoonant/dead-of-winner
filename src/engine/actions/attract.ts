// attract (R6.7, F 5.1.1): any die; up to 2 zombies move into EMPTY entrance spaces at the survivor's location.
// Never destroys a barricade, never overruns: zombies that do not fit stay where they are.
import type { Action, AttractAction } from '../actions'
import { fireInto, patchEntrance, startOut, svc } from '../exposure'
import type { EntranceIndex, GameState, LocationId, Rejection } from '../types'
import { emptyEntranceSpaces, entranceAt, totalZombies } from '../zombies'
import { checkActor, checkDecision, checkDie, finish, lowestDie, rej, rejected, spendDieInto, turnContext } from './die-common'

interface Move { from: { location: LocationId; entrance: EntranceIndex }; to: { location: LocationId; entrance: EntranceIndex } }

/** Walk the requested zombies one at a time: take it from its entrance, put it in the first empty destination space (colony: lowest entrance first). */
function plan(state: GameState, destination: LocationId, from: AttractAction['from']): { state: GameState; moves: Move[] } {
  let s = state
  const moves: Move[] = []
  const queue = from.flatMap((f) => Array.from({ length: f.count }, () => ({ location: f.location, entrance: f.entrance })))
  for (const src of queue) {
    const e = entranceAt(s, src.location, src.entrance)!
    const taken = patchEntrance(s, src.location, src.entrance, { zombies: e.zombies - 1 })
    const dest = taken.locations[destination]!.entrances.find((x) => emptyEntranceSpaces(taken, destination, x.index) > 0)
    if (!dest) break
    s = patchEntrance(taken, destination, dest.index, { zombies: dest.zombies + 1 })
    moves.push({ from: src, to: { location: destination, entrance: dest.index } })
  }
  return { state: s, moves }
}

export function validateAttract(state: GameState, a: AttractAction): Rejection | null {
  const r0 = checkDecision(state, a) ?? checkActor(state, a.seat, a.survivorId)
  if (r0) return r0
  const sv = state.survivors[a.survivorId]!
  if (svc().forbidden(state, 'attract', { survivorId: a.survivorId, seat: a.seat, location: sv.location })) return rej('E_FORBIDDEN', 'attracting zombies is forbidden right now')
  const r1 = checkDie(state, a.seat, a.dieId)
  if (r1) return r1
  if (!Array.isArray(a.from) || a.from.some((f) => !Number.isInteger(f.count) || f.count < 1)) return rej('E_BAD_PAYLOAD', 'each source needs a positive whole count')
  const total = a.from.reduce((n, f) => n + f.count, 0)
  if (total > 2) return rej('E_BAD_PAYLOAD', 'attract moves two zombies at most')
  if (totalZombies(state) === 0) return rej('E_NO_ZOMBIE', 'there are no zombies to attract')
  if (total === 0) return rej('E_BAD_PAYLOAD', 'name the zombies to attract')
  const taken = new Map<string, number>()
  for (const f of a.from) {
    const e = entranceAt(state, f.location, f.entrance)
    if (!state.locations[f.location] || !e) return rej('E_TARGET_INVALID', 'no such entrance')
    const key = `${f.location}#${f.entrance}`
    const n = (taken.get(key) ?? 0) + f.count
    taken.set(key, n)
    if (n > e.zombies) return rej('E_NO_ZOMBIE', 'not that many zombies there')
  }
  if (plan(state, sv.location, a.from).moves.length === 0) return rej('E_NO_SPACE', 'no empty entrance space here')
  return null
}

export function applyAttract(state: GameState, a: AttractAction) {
  const bad = validateAttract(state, a)
  if (bad) return rejected(state, a, bad)
  const acc = startOut(state)
  const sv = state.survivors[a.survivorId]!
  spendDieInto(acc, a.seat, a.dieId, 'attract', a.survivorId)
  const p = plan(acc.state, sv.location, a.from)
  acc.state = p.state
  for (const m of p.moves) acc.events.push({ type: 'ZombieMoved', from: m.from, to: m.to, by: a.survivorId })
  fireInto(acc, 'action.attract', { seat: a.seat, survivorId: a.survivorId, location: sv.location })
  return finish(acc, 'action.attract')
}

/** A bounded set of distinct attract outcomes: single zombies and the first pairs, one candidate survivor per location. */
export function legalAttracts(state: GameState): Action[] {
  const ctx = turnContext(state)
  const die = ctx && lowestDie(ctx.dice)
  if (!ctx || !die) return []
  const sources = state.locationOrder.flatMap((location) =>
    state.locations[location]!.entrances.filter((e) => e.zombies > 0).map((e) => ({ location, entrance: e.index, zombies: e.zombies })))
  const picks: AttractAction['from'][] = []
  for (const s of sources) {
    picks.push([{ location: s.location, entrance: s.entrance, count: 1 }])
    if (s.zombies >= 2) picks.push([{ location: s.location, entrance: s.entrance, count: 2 }])
  }
  for (let i = 0; i < sources.length && picks.length < 12; i++) for (let j = i + 1; j < sources.length && picks.length < 12; j++) {
    picks.push([{ location: sources[i]!.location, entrance: sources[i]!.entrance, count: 1 }, { location: sources[j]!.location, entrance: sources[j]!.entrance, count: 1 }])
  }
  const out: Action[] = []
  const seenLocations = new Set<string>()
  for (const id of ctx.survivors) {
    const loc = state.survivors[id]!.location
    if (seenLocations.has(loc)) continue
    seenLocations.add(loc)
    for (const from of picks) {
      const a: AttractAction = { type: 'attract', decisionId: state.pending.id, seat: ctx.seat, survivorId: id, dieId: die.id, from }
      if (validateAttract(state, a) === null) out.push(a)
    }
  }
  return out
}
