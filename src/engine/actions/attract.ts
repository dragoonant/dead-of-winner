// attract (R6.7, F 5.1.1): any die; the player chooses 0-2 zombies from ONE other location and where they go: any EMPTY entrance spaces at
// the survivor's location, split across entrances as they like (digest Attracting). Without `to` they fill the lowest empty entrance first.
// Never destroys a barricade, never overruns: zombies that do not fit stay where they are.
import type { Action, AttractAction } from '../actions'
import { fireInto, patchEntrance, startOut, svc } from '../exposure'
import type { EntranceIndex, GameState, LocationId, Rejection } from '../types'
import { emptyEntranceSpaces, entranceAt, totalZombies } from '../zombies'
import { checkActor, checkDecision, checkDie, finish, lowestDie, rej, rejected, spendDieInto, turnContext } from './die-common'

interface Move { from: { location: LocationId; entrance: EntranceIndex }; to: { location: LocationId; entrance: EntranceIndex } }

/** Walk the requested zombies one at a time: take it from its entrance, put it in the first empty destination space (colony: lowest entrance first). */
function plan(state: GameState, destination: LocationId, from: AttractAction['from'], to?: AttractAction['to']): { state: GameState; moves: Move[] } {
  let s = state
  const moves: Move[] = []
  const queue = from.flatMap((f) => Array.from({ length: f.count }, () => ({ location: f.location, entrance: f.entrance })))
  const chosen = (to ?? []).flatMap((t) => Array.from({ length: t.count }, () => t.entrance))
  let n = 0
  for (const src of queue) {
    const e = entranceAt(s, src.location, src.entrance)!
    const taken = patchEntrance(s, src.location, src.entrance, { zombies: e.zombies - 1 })
    const want = to ? chosen[n++] : undefined
    const dest = to
      ? taken.locations[destination]!.entrances.find((x) => x.index === want && emptyEntranceSpaces(taken, destination, x.index) > 0)
      : taken.locations[destination]!.entrances.find((x) => emptyEntranceSpaces(taken, destination, x.index) > 0)
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
  if (a.to !== undefined && (!Array.isArray(a.to) || a.to.some((t) => !Number.isInteger(t.count) || t.count < 1 || !Number.isInteger(t.entrance)))) return rej('E_BAD_PAYLOAD', 'each destination needs an entrance and a positive whole count')
  if (a.to && a.to.reduce((n, t) => n + t.count, 0) !== total) return rej('E_BAD_PAYLOAD', 'the destination counts must add up to the zombies attracted')
  if (total === 0) return null // you may attract fewer than 2, even none (digest Errata); the die is still spent
  if (totalZombies(state) === 0) return rej('E_NO_ZOMBIE', 'there are no zombies to attract')
  if (new Set(a.from.map((f) => f.location)).size > 1) return rej('E_BAD_PAYLOAD', 'attract draws from one location only')
  if (a.from[0]!.location === sv.location) return rej('E_TARGET_INVALID', 'attracted zombies come from another location')
  const taken = new Map<string, number>()
  for (const f of a.from) {
    const e = entranceAt(state, f.location, f.entrance)
    if (!state.locations[f.location] || !e) return rej('E_TARGET_INVALID', 'no such entrance')
    const key = `${f.location}#${f.entrance}`
    const n = (taken.get(key) ?? 0) + f.count
    taken.set(key, n)
    if (n > e.zombies) return rej('E_NO_ZOMBIE', 'not that many zombies there')
  }
  const p = plan(state, sv.location, a.from, a.to)
  if (a.to ? p.moves.length < total : p.moves.length === 0) return rej('E_NO_SPACE', 'no empty entrance space there')
  return null
}

export function applyAttract(state: GameState, a: AttractAction) {
  const bad = validateAttract(state, a)
  if (bad) return rejected(state, a, bad)
  const acc = startOut(state)
  const sv = state.survivors[a.survivorId]!
  spendDieInto(acc, a.seat, a.dieId, 'attract', a.survivorId)
  const p = plan(acc.state, sv.location, a.from, a.to)
  acc.state = p.state
  for (const m of p.moves) acc.events.push({ type: 'ZombieMoved', from: m.from, to: m.to, by: a.survivorId })
  fireInto(acc, 'action.attract', { seat: a.seat, survivorId: a.survivorId, location: sv.location })
  return finish(acc, 'action.attract')
}

/** Destination choices at the colony for `n` zombies: each empty entrance, and a few splits (other locations have one entrance, so no `to`). Bounded to 8. */
function destinationChoices(state: GameState, loc: LocationId, n: number): NonNullable<AttractAction['to']>[] {
  if (loc !== 'colony' || n === 0) return []
  const open = state.locations[loc]!.entrances.map((e) => ({ index: e.index, space: emptyEntranceSpaces(state, loc, e.index) })).filter((e) => e.space > 0)
  const out: NonNullable<AttractAction['to']>[] = []
  if (n === 1) { for (const e of open) out.push([{ entrance: e.index, count: 1 }]); return out.slice(0, 8) }
  for (const e of open) if (e.space >= 2) out.push([{ entrance: e.index, count: 2 }])
  for (let i = 0; i < open.length; i++) for (let j = i + 1; j < open.length; j++) out.push([{ entrance: open[i]!.index, count: 1 }, { entrance: open[j]!.index, count: 1 }])
  return out.slice(0, 8)
}

/** A bounded set of distinct attract outcomes: none at all, single zombies and pairs from ONE source location, one candidate survivor per location; at the colony also the chosen entrance spaces. */
export function legalAttracts(state: GameState): Action[] {
  const ctx = turnContext(state)
  const die = ctx && lowestDie(ctx.dice)
  if (!ctx || !die) return []
  const sources = state.locationOrder.flatMap((location) =>
    state.locations[location]!.entrances.filter((e) => e.zombies > 0).map((e) => ({ location, entrance: e.index, zombies: e.zombies })))
  const picks: AttractAction['from'][] = [[]]
  for (const s of sources) {
    picks.push([{ location: s.location, entrance: s.entrance, count: 1 }])
    if (s.zombies >= 2) picks.push([{ location: s.location, entrance: s.entrance, count: 2 }])
  }
  for (let i = 0; i < sources.length && picks.length < 13; i++) for (let j = i + 1; j < sources.length && picks.length < 13; j++) {
    if (sources[i]!.location !== sources[j]!.location) continue
    picks.push([{ location: sources[i]!.location, entrance: sources[i]!.entrance, count: 1 }, { location: sources[j]!.location, entrance: sources[j]!.entrance, count: 1 }])
  }
  const out: Action[] = []
  const seenLocations = new Set<string>()
  for (const id of ctx.survivors) {
    const loc = state.survivors[id]!.location
    if (seenLocations.has(loc)) continue
    seenLocations.add(loc)
    for (const from of picks) {
      const base: AttractAction = { type: 'attract', decisionId: state.pending.id, seat: ctx.seat, survivorId: id, dieId: die.id, from }
      if (validateAttract(state, base) !== null) continue
      out.push(base)
      for (const to of destinationChoices(state, loc, from.reduce((n, f) => n + f.count, 0))) {
        const a: AttractAction = { ...base, to }
        if (validateAttract(state, a) === null) out.push(a)
      }
    }
  }
  return out
}
