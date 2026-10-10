// Hand-built states and a tiny DataBundle for the colony-phase, crisis, objective and ending tests (no createGame needed).
import { registerDataBundle } from '../../src/engine/decks'
import { registerBundle } from '../../src/engine/index'
import { rollDie, seedRng } from '../../src/engine/rng'
import type {
  CardId, DataBundle, DataRecord, GameState, LocationId, LocationState, RngState, SeatId, SeatState, SurvivorId, SurvivorState,
} from '../../src/engine/types'

const rec = (r: Record<string, unknown> & { id: string }): DataRecord => r as DataRecord
const sv = (id: string, influence: number) => rec({ id, kind: 'survivor', name: id, stats: { influence, attack: 3, search: 3 } })
const item = (id: string, symbol: string) => rec({ id, kind: 'item', name: id, symbol })

export const SCHOOL = 'loc.school'
export const GAS = 'loc.gas'

const RECORDS: DataRecord[] = [
  sv('sv.a', 50), sv('sv.b', 20), sv('sv.c', 30), sv('sv.d', 40), sv('sv.e', 10), sv('sv.f', 60), sv('sv.g', 70), sv('sv.new', 5),
  item('it.fuel', 'fuel'), item('it.weapon', 'weapon'), item('it.food', 'food'), item('it.med', 'medicine'), item('it.tool', 'tool'),
  rec({ id: 'colony', kind: 'location' }), rec({ id: SCHOOL, kind: 'location' }), rec({ id: GAS, kind: 'location' }),
  rec({
    id: 'cr.fuel', kind: 'crisis', name: 'Fuel Shortage', prevent: ['fuel'], fail: [{ op: 'morale', value: -2 }],
    bonus: { extraCards: 2, effect: [{ op: 'morale', value: 1 }] },
  }),
  rec({
    id: 'cr.blizzard', kind: 'crisis', name: 'Blizzard', prevent: ['fuel'],
    fail: [{ op: 'forbid', what: 'move', scope: { who: 'nonExiledSeats' }, duration: 'nextRound' }, { op: 'morale', value: -1 }],
    bonus: { extraCards: 2, effect: [{ op: 'morale', value: 1 }] },
  }),
  rec({
    id: 'obj.main.samples', kind: 'mainObjective', name: 'Samples',
    sides: {
      normal: { morale: 6, rounds: 6, counters: { samples: { need: 'perSeat', perSeatMultiplier: 3 } }, complete: { test: 'objectiveCounterAtLeast', value: 'samples' } },
      hardcore: { morale: 6, rounds: 5, counters: { samples: { need: 'perSeat', perSeatMultiplier: 3 } }, complete: { test: 'objectiveCounterAtLeast', value: 'samples' } },
    },
  }),
  // secret objectives
  rec({ id: 'obj.secret.hunger', kind: 'secretObjective', type: 'secret', requiresMain: true, complete: { test: 'handHasSymbol', symbol: 'food', value: 3 } }),
  rec({ id: 'obj.secret.collector', kind: 'secretObjective', type: 'secret', requiresMain: true, complete: { test: 'handAtLeast', value: 3 } }),
  rec({ id: 'obj.betrayal.trigger', kind: 'secretObjective', type: 'betrayal', requiresMain: false, complete: { all: [{ test: 'moraleAtMost', value: 0 }, { test: 'handHasSymbol', symbol: 'weapon', value: 2 }] } }),
  rec({ id: 'obj.exiled.remorse', kind: 'secretObjective', type: 'exiled', requiresMain: true, complete: { test: 'handHasSymbol', symbol: 'medicine', value: 2 }, betrayer: { firstCondition: { test: 'handAtLeast', value: 4 } } }),
  rec({ id: 'obj.exiled.vengeance', kind: 'secretObjective', type: 'exiled', requiresMain: false, complete: { test: 'handAtLeast', value: 1 } }),
]
export const BUNDLE: DataBundle = { version: 'test-colony', byId: Object.fromEntries(RECORDS.map((r) => [r.id, r])) }

/** The first rng state whose next d6/d12 draws are exactly `spec` (sides, value). */
export function forceRng(...spec: [sides: number, value: number][]): RngState {
  for (let i = 0; i < 400000; i++) {
    let s = seedRng(`colony-force-${i}`)
    const start = s
    let ok = true
    for (const [sides, value] of spec) {
      const [v, n] = rollDie(s, sides)
      s = n
      if (v !== value) { ok = false; break }
    }
    if (ok) return start
  }
  throw new Error('no seed matches the requested rolls')
}

const loc = (id: LocationId, entrances: number, entranceSpaces: number, survivors: number, noiseSpaces: number): LocationState => ({
  id, entrances: Array.from({ length: entrances }, (_, i) => ({ index: i + 1, zombies: 0, barricades: 0 })), noise: 0, deck: [], helpless: 0,
  capacity: { survivors, entranceSpaces, noiseSpaces },
})

export interface SvSpec { id: SurvivorId; owner: SeatId; location?: LocationId; wounds?: number }
export interface ColOpts {
  survivors?: SvSpec[]
  seats?: SeatId[]
  exiled?: SeatId[]
  hands?: Record<SeatId, string[]> // item def ids, e.g. ['it.fuel', 'it.fuel']
  waste?: number
  morale?: number
  food?: number
  starvation?: number
  roundsLeft?: number
  helpless?: number
  noise?: Record<LocationId, number>
  zombies?: Record<LocationId, number[]> // per-entrance zombie counts
  crisis?: string | null
  contributions?: Record<SeatId, string[]> // seat -> item def ids
  rng?: RngState
  secret?: Record<SeatId, string>
  exiledObj?: Record<SeatId, string>
  variants?: GameState['setup']['variants']
  objective?: Partial<GameState['objective']>
  survivorDeck?: string[]
}

export const DEFAULT_SURVIVORS: SvSpec[] = [
  { id: 'sv.a', owner: 's1' }, { id: 'sv.b', owner: 's1' }, { id: 'sv.c', owner: 's2' }, { id: 'sv.d', owner: 's3', location: SCHOOL },
]

export function makeColony(o: ColOpts = {}): GameState {
  registerBundle(BUNDLE)
  registerDataBundle(BUNDLE)
  const seatIds = o.seats ?? ['s1', 's2', 's3']
  const specs = o.survivors ?? DEFAULT_SURVIVORS
  const survivors: Record<SurvivorId, SurvivorState> = {}
  for (const s of specs) survivors[s.id] = { id: s.id, owner: s.owner, location: s.location ?? 'colony', status: 'alive', wounds: s.wounds ?? 0, frostbite: 0, equipped: [], movedThisTurn: false, extraMoves: 0 }
  const cards: GameState['cards'] = {}
  let n = 0
  const mint = (defId: string): CardId => { n += 1; const id = `c:${n}`; cards[id] = { id, defId }; return id }
  const seats: Record<SeatId, SeatState> = {}
  const crisisContribs: GameState['crisis']['contributions'] = []
  for (const id of seatIds) {
    const mine = specs.filter((s) => s.owner === id).map((s) => s.id)
    seats[id] = {
      seat: { id, kind: 'bot', exiled: o.exiled?.includes(id) ?? false, eliminated: false },
      hand: (o.hands?.[id] ?? []).map(mint), secretObjectiveId: o.secret?.[id] ?? null, exiledObjectiveId: o.exiledObj?.[id] ?? null, offered: [], dice: [],
      survivors: mine, leaderId: mine[0] ?? null, abilityUses: {},
    }
    for (const d of o.contributions?.[id] ?? []) crisisContribs.push({ seat: id, cardId: mint(d) })
  }
  const waste = Array.from({ length: o.waste ?? 0 }, () => mint('it.tool'))
  const locations: Record<LocationId, LocationState> = {
    colony: { ...loc('colony', 6, 3, 24, 0), helpless: o.helpless ?? 0 },
    [SCHOOL]: loc(SCHOOL, 1, 3, 4, 4),
    [GAS]: loc(GAS, 1, 3, 2, 4),
  }
  for (const [l, k] of Object.entries(o.noise ?? {})) locations[l] = { ...locations[l]!, noise: k }
  for (const [l, zs] of Object.entries(o.zombies ?? {})) locations[l] = { ...locations[l]!, entrances: locations[l]!.entrances.map((e, i) => ({ ...e, zombies: zs[i] ?? 0 })) }
  const crisisId = o.crisis === undefined ? 'cr.fuel' : o.crisis
  return {
    seed: 'colony-test', rng: o.rng ?? seedRng('colony-test'), rollSeq: 0, decisionSeq: 1, cardSeq: n, effectSeq: 0, dataVersion: BUNDLE.version,
    setup: { seats: seatIds.map((id) => ({ id, kind: 'bot' as const })), mainObjective: 'obj.main.samples', ...(o.variants ? { variants: o.variants } : {}) },
    phase: 'playerTurns', colonyStep: null, roundsLeft: o.roundsLeft ?? 6, roundNumber: 1, turnCount: seatIds.length,
    turn: null, seatOrder: seatIds, firstSeat: seatIds[0]!, activeSeat: seatIds[seatIds.length - 1]!, seats, survivors,
    survivorDeck: o.survivorDeck ?? ['sv.new'], locations, locationOrder: ['colony', SCHOOL, GAS], cards, waste, removed: [], removedHidden: [], cardUses: {},
    morale: o.morale ?? 8, food: o.food ?? 4, starvation: o.starvation ?? 0, crisisDeck: ['cr.blizzard'],
    crisis: { cardId: crisisId, contributions: crisisContribs, result: null, history: [] },
    crossroads: { deck: [], held: null, active: null, log: [] }, exiledObjectiveDeck: [],
    objective: { id: 'obj.main.samples', side: 'normal', counters: {}, cards: [], complete: false, ...o.objective }, effects: [],
    attack: null, search: null, request: null, bite: null, vote: null, exile: null,
    pending: { id: 'd:1', seat: seatIds[seatIds.length - 1]!, kind: 'turnAction', window: 'turn.end', context: {}, canPass: false },
    log: [], result: null,
  }
}

export const types = (events: { type: string }[]): string[] => events.map((e) => e.type)
export const of = <T extends object = Record<string, any>>(events: { type: string }[], type: string): T[] => events.filter((e) => e.type === type) as unknown as T[]
export const patch = (s: GameState, p: Partial<GameState>): GameState => ({ ...s, ...p })
