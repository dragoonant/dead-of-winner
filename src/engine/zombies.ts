// Adding and killing zombies (R9): ONE add-zombies routine with barricade breaking and overrun, ONE zombie-kill routine.
import type { EntranceIndex, GameState, Id, LocationId, SurvivorId, ZombieSource } from './types'
import { aliveAt, fireInto, halted, killInto, loseMoraleInto, patchEntrance, patchLocation, startOut, statsOf, type Out } from './exposure'

// ---------- board helpers (also used by query.moveTargets, the AI and the UI through the engine) ----------
export const entranceAt = (s: GameState, loc: LocationId, index: EntranceIndex) => s.locations[loc]?.entrances.find((e) => e.index === index)
/** Free spaces on one entrance: capacity minus zombies and barricades (R2.2). */
export function emptyEntranceSpaces(s: GameState, loc: LocationId, index: EntranceIndex): number {
  const e = entranceAt(s, loc, index)
  if (!e) return 0
  return Math.max(0, s.locations[loc]!.capacity.entranceSpaces - e.zombies - e.barricades)
}
export const emptySpacesAt = (s: GameState, loc: LocationId): number =>
  s.locations[loc]!.entrances.reduce((n, e) => n + emptyEntranceSpaces(s, loc, e.index), 0)
export const zombiesAt = (s: GameState, loc: LocationId): number => s.locations[loc]!.entrances.reduce((n, e) => n + e.zombies, 0)
export const totalZombies = (s: GameState): number => s.locationOrder.reduce((n, l) => n + zombiesAt(s, l), 0)
/** Free survivor spaces at a location; helpless tokens occupy spaces too (R2.2 colony occupants). */
export function freeSurvivorSpaces(s: GameState, loc: LocationId): number {
  const l = s.locations[loc]!
  return Math.max(0, l.capacity.survivors - aliveAt(s, loc).length - l.helpless)
}

// ---------- killing a zombie ----------
/** Removes `count` zombies from one entrance (the killer picked it at the colony, R9.8). Emits ZombieKilled and opens the zombie.killed window. */
export function killZombieInto(acc: Out, loc: LocationId, index: EntranceIndex, by: SurvivorId | Id | 'effect', count = 1): number {
  const e = entranceAt(acc.state, loc, index)
  if (!e || e.zombies <= 0 || count <= 0) return 0
  const n = Math.min(count, e.zombies)
  acc.state = patchEntrance(acc.state, loc, index, { zombies: e.zombies - n })
  acc.events.push({ type: 'ZombieKilled', location: loc, entrance: index, by, zombies: e.zombies - n })
  fireInto(acc, 'zombie.killed', { location: loc, survivorId: acc.state.survivors[by] ? by : undefined })
  return n
}
export function killZombie(state: GameState, loc: LocationId, index: EntranceIndex, by: SurvivorId | Id | 'effect', count = 1): Out {
  const acc = startOut(state)
  killZombieInto(acc, loc, index, by, count)
  return acc
}

// ---------- adding zombies ----------
export interface AddZombiesOut extends Out { remaining: number; nextIndex: number }

/** One zombie arriving at one entrance, fully resolved: placed, or breaks a barricade, or overruns and kills (R9.4-R9.6). */
function addOneInto(acc: Out, loc: LocationId, index: EntranceIndex, source: ZombieSource): void {
  const e = entranceAt(acc.state, loc, index)!
  if (emptyEntranceSpaces(acc.state, loc, index) > 0) {
    acc.state = patchEntrance(acc.state, loc, index, { zombies: e.zombies + 1 })
    acc.events.push({ type: 'ZombieAdded', location: loc, entrance: index, source, zombies: e.zombies + 1 })
    fireInto(acc, 'zombie.added', { location: loc })
    return
  }
  if (e.barricades > 0) {
    acc.state = patchEntrance(acc.state, loc, index, { barricades: e.barricades - 1 })
    acc.events.push({ type: 'BarricadeDestroyed', location: loc, entrance: index, barricades: e.barricades - 1 })
    return
  }
  // overrun: the zombie is not placed; the lowest-influence survivor there dies, else a helpless token, else nothing
  const here = aliveAt(acc.state, loc)
  const victim = here.length === 0 ? null : here.reduce((best, v) => (statsOf(acc.state, v.id).influence < statsOf(acc.state, best.id).influence ? v : best))
  const helpless = acc.state.locations[loc]!.helpless
  acc.events.push({ type: 'EntranceOverrun', location: loc, entrance: index, killed: victim ? victim.id : helpless > 0 ? 'helpless' : null })
  fireInto(acc, 'entrance.overrun', { location: loc })
  if (halted(acc)) return
  if (victim) killInto(acc, victim.id, 'overrun')
  else if (helpless > 0) {
    acc.state = patchLocation(acc.state, loc, { helpless: helpless - 1 })
    acc.events.push({ type: 'HelplessKilled', location: loc, count: 1, after: helpless - 1, cause: 'overrun', moraleLoss: true })
    loseMoraleInto(acc, 1, 'helplessKilled')
  }
}

/**
 * Adds `count` zombies one at a time (R9.1). The colony rotation starts at entrance 1 per call and advances per zombie (R9.2);
 * any other location has one entrance (R9.3). Stops early only when the game ends or a decision opens (`remaining` > 0, resume at `nextIndex`).
 */
export function addZombiesInto(acc: Out, loc: LocationId, count: number, source: ZombieSource, opts: { startIndex?: number; survivors?: number; announce?: boolean } = {}): AddZombiesOutInfo {
  const l = acc.state.locations[loc]!
  const indices = l.entrances.map((e) => e.index)
  if (opts.announce !== false) acc.events.push({ type: 'ZombiesToAdd', location: loc, count, source, survivors: opts.survivors })
  let slot = opts.startIndex ?? 0
  let left = count
  while (left > 0 && !halted(acc)) {
    addOneInto(acc, loc, indices[slot % indices.length]!, source)
    slot += 1
    left -= 1
  }
  return { remaining: left, nextIndex: slot % indices.length }
}
interface AddZombiesOutInfo { remaining: number; nextIndex: number }
export function addZombies(state: GameState, loc: LocationId, count: number, source: ZombieSource, opts: { startIndex?: number; survivors?: number; announce?: boolean } = {}): AddZombiesOut {
  const acc = startOut(state)
  const info = addZombiesInto(acc, loc, count, source, opts)
  return { ...acc, ...info }
}
