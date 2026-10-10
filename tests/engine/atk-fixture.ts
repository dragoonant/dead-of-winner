// Hand-built states for the die-action tests (no createGame needed): two seats, a colony, a school, a library, a gas station.
import { registerBundle } from '../../src/engine/index'
import { registerDataBundle } from '../../src/engine/decks'
import { resetServices } from '../../src/engine/exposure'
import { rollDie, seedRng } from '../../src/engine/rng'
import type {
  CardId, DataBundle, GameState, LocationId, LocationState, RngState, SeatId, SeatState, SurvivorId, SurvivorState,
} from '../../src/engine/types'

const passive = (what: string, extra: Record<string, unknown> = {}) => ({ id: 'ab', kind: 'passive', effect: [{ op: 'grant', what, scope: { who: 'self' }, duration: 'game', ...extra }] })
const sv = (id: string, influence: number, attack: number, search: number, ability?: unknown) => ({ id, kind: 'survivor', name: id, stats: { influence, attack, search }, ability })

export const BUNDLE: DataBundle = {
  version: 'test-actions',
  byId: {
    'sv.ashley': sv('sv.ashley', 20, 2, 5),
    'sv.mike': sv('sv.mike', 30, 2, 4, passive('noExposureOnKill')),
    'sv.forest': sv('sv.forest', 14, 4, 5),
    'sv.sparky': sv('sv.sparky', 10, 2, 2, passive('biteIsWound')),
    'sv.rod': sv('sv.rod', 40, 3, 3, passive('noExposureOnMove')),
    'sv.harman': sv('sv.harman', 32, 3, 3, passive('frostbiteIsWound')),
    'sv.buddy': sv('sv.buddy', 36, 2, 4, passive('fourWoundsToDie')),
    'sv.olivia': sv('sv.olivia', 25, 4, 3),
    'sv.price': sv('sv.price', 22, 3, 3, passive('copyAbilitiesAtLocation')),
    'sv.extra': sv('sv.extra', 18, 3, 3),
    'it.fuel': { id: 'it.fuel', symbol: 'fuel', name: 'Fuel' },
    'it.lighter': { id: 'it.lighter', symbol: 'weapon', name: 'Lighter' },
    'it.food': { id: 'it.food', symbol: 'food', name: 'Canned Food' },
  },
}

export function forceRng(...spec: [sides: number, value: number][]): RngState {
  for (let i = 0; i < 200000; i++) {
    let s = seedRng(`force-${i}`)
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

const loc = (id: LocationId, entrances: number, entranceSpaces: number, survivors: number, noiseSpaces: number, deck: CardId[] = []): LocationState => ({
  id, entrances: Array.from({ length: entrances }, (_, i) => ({ index: i + 1, zombies: 0, barricades: 0 })), noise: 0, deck, helpless: 0,
  capacity: { survivors, entranceSpaces, noiseSpaces },
})

export interface SvSpec { id: SurvivorId; owner: SeatId; location: LocationId; wounds?: number; frostbite?: number }
export interface StateOpts {
  survivors: SvSpec[]
  dice?: Record<SeatId, number[]>
  rng?: RngState
  decks?: Partial<Record<LocationId, CardId[]>>
  hands?: Record<SeatId, CardId[]>
  waste?: CardId[]
  morale?: number
  exiled?: SeatId[]
}

export const SCHOOL = 'loc.school'
export const LIBRARY = 'loc.library'
export const GAS = 'loc.gas'

export function makeState(o: StateOpts): GameState {
  registerBundle(BUNDLE)
  registerDataBundle(BUNDLE)
  resetServices()
  const seatIds = ['s1', 's2']
  const survivors: Record<SurvivorId, SurvivorState> = {}
  for (const s of o.survivors) {
    survivors[s.id] = { id: s.id, owner: s.owner, location: s.location, status: 'alive', wounds: s.wounds ?? 0, frostbite: s.frostbite ?? 0, equipped: [], movedThisTurn: false, extraMoves: 0 }
  }
  const seats: Record<SeatId, SeatState> = {}
  for (const id of seatIds) {
    const mine = o.survivors.filter((s) => s.owner === id).map((s) => s.id)
    seats[id] = {
      seat: { id, kind: 'human', exiled: o.exiled?.includes(id) ?? false, eliminated: false },
      hand: o.hands?.[id] ?? [], secretObjectiveId: null, exiledObjectiveId: null, offered: [],
      dice: (o.dice?.[id] ?? []).map((v, i) => ({ id: `${id}:d${i + 1}`, value: v, used: false })),
      survivors: mine, leaderId: mine[0] ?? null, abilityUses: {},
    }
  }
  const cards: GameState['cards'] = {}
  const allCards = [...Object.values(o.decks ?? {}).flat(), ...Object.values(o.hands ?? {}).flat(), ...(o.waste ?? [])]
  for (const c of allCards as string[]) cards[c] = { id: c, defId: c.includes('fuel') ? 'it.fuel' : c.includes('lighter') ? 'it.lighter' : 'it.food' }
  const locations: Record<LocationId, LocationState> = {
    colony: loc('colony', 6, 3, 24, 0),
    [SCHOOL]: loc(SCHOOL, 1, 3, 4, 4, o.decks?.[SCHOOL]),
    [LIBRARY]: loc(LIBRARY, 1, 3, 3, 4, o.decks?.[LIBRARY]),
    [GAS]: loc(GAS, 1, 3, 2, 4, o.decks?.[GAS]),
  }
  return {
    seed: 'test', rng: o.rng ?? seedRng('test'), rollSeq: 0, decisionSeq: 1, cardSeq: 0, effectSeq: 0, dataVersion: BUNDLE.version,
    setup: { seats: seatIds.map((id) => ({ id, kind: 'human' as const })), mainObjective: 'random' },
    phase: 'playerTurns', colonyStep: null, roundsLeft: 8, roundNumber: 1, turnCount: 1,
    turn: { seat: 's1', index: 0, actions: 0, voteCalled: false, contributionAsked: false },
    seatOrder: seatIds, firstSeat: 's1', activeSeat: 's1', seats, survivors, survivorDeck: ['sv.extra'],
    locations, locationOrder: ['colony', SCHOOL, LIBRARY, GAS], cards, waste: o.waste ?? [], removed: [], removedHidden: [], cardUses: {},
    morale: o.morale ?? 8, food: 4, starvation: 0, crisisDeck: [],
    crisis: { cardId: null, contributions: [], result: null, history: [] },
    crossroads: { deck: [], held: null, active: null, log: [] }, exiledObjectiveDeck: [],
    objective: { id: 'obj', side: 'normal', counters: {}, cards: [], complete: false }, effects: [],
    attack: null, search: null, request: null, bite: null, vote: null, exile: null,
    pending: { id: 'd:1', seat: 's1', kind: 'turnAction', window: 'turn.start', context: {}, canPass: false },
    log: [], result: null,
  }
}

export const types = (events: { type: string }[]): string[] => events.map((e) => e.type)
export const of = <T extends object = Record<string, any>>(events: { type: string }[], type: string): T[] => events.filter((e) => e.type === type) as unknown as T[]
/** A turn action with the open decision id and seat filled in. */
export const act = <T extends Record<string, unknown>>(state: GameState, body: T) => ({ decisionId: state.pending.id, seat: state.pending.seat as string, ...body })
