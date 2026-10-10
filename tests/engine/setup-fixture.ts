// Throwaway DataBundle for the setup/dice/survivor tests: real survivor influence values where the checklist names them,
// invented everything else. Not game data.
import type { Action } from '../../src/engine/actions'
import { stepSetup } from '../../src/engine/phases/setup'
import { createGameInternal } from '../../src/engine/setup'
import type { DataBundle, DataRecord, GameSetup, GameState, StepResult } from '../../src/engine/types'

const rec = (r: Record<string, unknown> & { id: string; kind: string }): DataRecord => r as DataRecord

const LOCS: [string, string, number, number, number][] = [
  ['loc.police-station', 'Police Station', 1, 3, 4], ['loc.grocery-store', 'Grocery Store', 2, 3, 4], ['loc.school', 'School', 3, 4, 4],
  ['loc.library', 'Library', 4, 3, 3], ['loc.hospital', 'Hospital', 5, 4, 4], ['loc.gas-station', 'Gas Station', 6, 2, 3],
]
const NAMED: [string, string, number, boolean][] = [
  ['sv.olivia-brown', 'Olivia Brown', 56, true], ['sv.ashley-ross', 'Ashley Ross', 52, true], ['sv.brian-lee', 'Brian Lee', 68, true],
  ['sv.sparky', 'Sparky', 10, true], ['sv.annaleigh-chan', 'Annaleigh Chan', 5, false], ['sv.gray-beard', 'Gray Beard', 6, false],
]
const sideOf = (zombies: number, rounds: number) => ({
  morale: 6, rounds, setup: [{ op: 'addZombies', value: zombies, scope: { who: 'nonColonyLocations' } }],
  counters: { samples: { need: 'perSeat', perSeatMultiplier: 3 } }, complete: { test: 'objectiveCounterAtLeast', value: 'samples' },
})

export function makeBundle(version = 'fixture-1'): DataBundle {
  const records: DataRecord[] = []
  records.push(rec({ id: 'colony', kind: 'location', name: 'Colony', spaces: { survivors: 24, entrances: 6, entranceSpaces: 3, noise: 0 }, symbolOrder: [], deck: null }))
  for (const [id, name, number, survivors, entranceSpaces] of LOCS) {
    records.push(rec({ id, kind: 'location', name, number, spaces: { survivors, entrances: 1, entranceSpaces, noise: 4 }, symbolOrder: ['food'], deck: `deck.${id.slice(4)}` }))
  }
  const items: [string, string, boolean?][] = [['it.food-1', 'food'], ['it.medicine', 'medicine'], ['it.fuel', 'fuel'], ['it.junk', 'tool'], ['it.weapon', 'weapon'], ['it.tool', 'tool'], ['it.noncoop', 'tool', true]]
  for (const [id, symbol, nonCoop] of items) records.push(rec({ id, kind: 'item', name: id, symbol, ...(nonCoop ? { nonCoop: true } : {}) }))
  records.push(rec({ id: 'deck.starter', kind: 'deck', size: 25, cards: [{ item: 'it.food-1', count: 10 }, { item: 'it.medicine', count: 5 }, { item: 'it.fuel', count: 5 }, { item: 'it.junk', count: 5 }] }))
  for (const [id] of LOCS) {
    records.push(rec({ id: `deck.${id.slice(4)}`, kind: 'deck', size: 20, cards: [{ item: 'it.food-1', count: 6 }, { item: 'it.weapon', count: 5 }, { item: 'it.tool', count: 5 }, { item: 'it.fuel', count: 3 }, { item: 'it.noncoop', count: 1 }] }))
  }
  NAMED.forEach(([id, name, influence, coop]) => records.push(rec({ id, kind: 'survivor', name, stats: { influence, attack: 3, search: 3 }, coop })))
  for (let i = 0; i < 26; i++) records.push(rec({ id: `sv.extra-${String(i).padStart(2, '0')}`, kind: 'survivor', name: `Extra ${i}`, stats: { influence: 11 + i, attack: 3, search: 3 }, coop: true }))
  for (let i = 0; i < 20; i++) records.push(rec({ id: `cr.test-${String(i).padStart(2, '0')}`, kind: 'crisis', name: `Crisis ${i}`, prevent: ['food'] }))
  for (let i = 0; i < 40; i++) records.push(rec({ id: `xr.test-${String(i).padStart(2, '0')}`, kind: 'crossroads', name: `Crossroads ${i}`, mature: i % 5 === 0, coop: i % 7 !== 0 }))
  records.push(rec({ id: 'obj.main.we-need-more-samples', kind: 'mainObjective', name: 'We Need More Samples', code: 'M10', sides: { normal: sideOf(1, 6), hardcore: sideOf(3, 5) } }))
  records.push(rec({
    id: 'obj.main.too-many-mouths', kind: 'mainObjective', name: 'Too Many Mouths', code: 'M09',
    sides: {
      normal: { morale: 7, rounds: 5, setup: [{ op: 'addHelpless', value: 'seats+3' }, { op: 'addZombies', value: 6, scope: { who: 'colony' } }], complete: { test: 'roundsLeftAtMost', value: 0 } },
      hardcore: { morale: 7, rounds: 6, setup: [{ op: 'addHelpless', value: 'seats+5' }, { op: 'addZombies', value: 12, scope: { who: 'colony' } }], complete: { test: 'roundsLeftAtMost', value: 0 } },
    },
  }))
  for (let i = 0; i < 24; i++) records.push(rec({ id: `obj.secret.t${String(i).padStart(2, '0')}`, kind: 'secretObjective', type: 'secret', name: `Secret ${i}` }))
  for (let i = 0; i < 10; i++) records.push(rec({ id: `obj.betrayal.t${String(i).padStart(2, '0')}`, kind: 'secretObjective', type: 'betrayal', name: `Betrayal ${i}` }))
  for (let i = 0; i < 10; i++) records.push(rec({ id: `obj.exiled.t${String(i).padStart(2, '0')}`, kind: 'secretObjective', type: 'exiled', name: `Exiled ${i}` }))
  const byId: Record<string, DataRecord> = {}
  for (const r of records) byId[r.id] = r
  return { version, byId }
}

export const BUNDLE = makeBundle()

export const seatsOf = (n: number): GameSetup['seats'] => Array.from({ length: n }, (_, i) => ({ id: `s${i + 1}`, kind: 'bot' as const }))
export const setupOf = (n: number, variants: GameSetup['variants'] = {}, mainObjective = 'obj.main.we-need-more-samples'): GameSetup => ({ seats: seatsOf(n), mainObjective, variants })

/** Plays the whole setup phase with the first legal option each time, optionally choosing named leaders. Returns the state at the first turn. */
export function playSetup(setup: GameSetup, seed: string, opts: { bundle?: DataBundle; leaders?: Record<string, string>; keep?: Record<string, string[]> } = {}): { result: StepResult; events: StepResult['events']; created: StepResult } {
  const created = createGameInternal(setup, seed, opts.bundle ?? BUNDLE)
  let cur = created
  const events = [...created.events]
  for (let guard = 0; guard < 40 && cur.state.phase === 'setup'; guard++) {
    const p = cur.pending
    let action: Action = p.options![0]!.action
    if (p.kind === 'chooseLeader' && opts.leaders?.[p.seat as string]) action = { type: 'chooseLeader', decisionId: p.id, seat: p.seat as string, survivorId: opts.leaders[p.seat as string]! }
    if (p.kind === 'chooseSurvivors' && opts.keep?.[p.seat as string]) action = { type: 'chooseSurvivors', decisionId: p.id, seat: p.seat as string, keep: opts.keep[p.seat as string]! }
    cur = stepSetup(cur.state, action)
    if (cur.rejection) throw new Error(`setup rejected: ${cur.rejection.code} ${cur.rejection.message}`)
    events.push(...cur.events)
  }
  return { result: cur, events, created }
}

export type { GameState }
