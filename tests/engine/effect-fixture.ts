// Shared fixture for the card / Crossroads / effect tests: a hand-built GameState plus a small DataBundle.
// The real createGame is another module's job; these tests only need the interpreter, the card actions and Crossroads.
import { registerBundle } from '../../src/engine/index'
import type { Action } from '../../src/engine/actions'
import { seedRng } from '../../src/engine/rng'
import type { DataBundle, DataRecord, GameState, PendingDecision, SeatState, SurvivorState } from '../../src/engine/types'

const rec = (r: DataRecord & Record<string, unknown>): DataRecord => r

export const RECORDS: DataRecord[] = [
  // survivors
  rec({ id: 'sv.ashley', name: 'Ashley Ross', stats: { influence: 40, attack: 3, search: 3 }, ability: { id: 'quickBarricade', kind: 'action', limit: 'oncePerRound', countsAs: 'barricade', effect: [{ op: 'addBarricade', count: 1, location: 'here' }] } }),
  rec({ id: 'sv.mike', name: 'Mike Cho', stats: { influence: 30, attack: 3, search: 4 }, ability: { id: 'steady', kind: 'passive', effect: [{ op: 'grant', what: 'noExposureOnKill', scope: { who: 'self' }, duration: 'game' }] } }),
  rec({ id: 'sv.sparky', name: 'Sparky', stats: { influence: 10, attack: 2, search: 2 }, ability: { id: 'goodBoy', kind: 'passive', effect: [{ op: 'grant', what: 'biteIsWound', scope: { who: 'self' }, duration: 'game' }, { code: 'survivor.sparky.skipBiteSpread' }] } }),
  rec({ id: 'sv.forest', name: 'Forest Plum', stats: { influence: 14, attack: 2, search: 5 }, ability: { id: 'lastGift', kind: 'triggered', trigger: 'turn.start', optional: true, when: { test: 'isActiveSeat', subject: 'seat' }, effect: [{ op: 'removeSurvivor', scope: { who: 'self' } }, { op: 'morale', value: 1 }] } }),
  rec({ id: 'sv.daniel', name: 'Daniel Smith', stats: { influence: 66, attack: 2, search: 5 }, ability: { id: 'doubleTap', kind: 'action', cost: { die: 4 }, when: { test: 'zombiesAtLeast', subject: 'location', value: 1 }, effect: [{ op: 'killZombies', count: 2, location: 'here', value: 'exposureOnce' }] } }),
  rec({ id: 'sv.alexis', name: 'Alexis Grey', stats: { influence: 22, attack: 3, search: 3 }, ability: { id: 'sharpEyes', kind: 'triggered', trigger: 'search.drawn', limit: 'oncePerRound', optional: true, effect: [{ op: 'extraSearchLook', count: 1 }, { op: 'extraSearchKeep', count: 1 }] } }),
  rec({ id: 'sv.spare', name: 'Spare One', stats: { influence: 5, attack: 4, search: 4 } }),
  rec({ id: 'sv.spare2', name: 'Spare Two', stats: { influence: 6, attack: 4, search: 4 } }),
  // items
  rec({ id: 'it.food-1', name: 'Food 1', symbol: 'food', class: 'wastePile', food: 1, play: { effect: [{ op: 'food', value: 1 }] } }),
  rec({ id: 'it.food-3', name: 'Food 3', symbol: 'food', class: 'wastePile', food: 3, play: { effect: [{ op: 'food', value: 3 }] } }),
  rec({ id: 'it.fuel', name: 'Fuel', symbol: 'fuel', class: 'wastePile', play: { countsAs: 'move', effect: [{ op: 'moveSurvivor', value: 'noExposure', location: 'chosen', scope: { who: 'seatSurvivors', count: 1, chooser: 'owner', filter: { not: { test: 'movedThisTurn', subject: 'survivor' } } } }] } }),
  rec({ id: 'it.medicine', name: 'Medicine', symbol: 'medicine', class: 'wastePile', play: { effect: [{ op: 'heal', count: 1, scope: { who: 'chosen', chooser: 'owner', filter: { test: 'woundsAtLeast', subject: 'survivor', value: 1 } } }] } }),
  rec({ id: 'it.lighter', name: 'Lighter', symbol: 'weapon', class: 'equip', equipped: [{ id: 'burn', kind: 'action', limit: 'oncePerRound', countsAs: 'attack', cost: { cards: { symbol: 'fuel', count: 1 } }, when: { test: 'zombiesAtLeast', subject: 'location', value: 1 }, effect: [{ op: 'killZombies', count: 4, location: 'here', value: 'noExposure' }] }] }),
  rec({ id: 'it.junk', name: 'Junk', symbol: 'tool', class: 'none' }),
  rec({ id: 'it.outsiders', name: '2 Outsiders', symbol: 'survivor', class: 'event', outsiders: 2, play: { when: { test: 'emptySurvivorSpace', location: 'colony' }, effect: [{ op: 'addSurvivor', count: 1, scope: { who: 'seat' } }] } }),
  rec({ id: 'it.barricades', name: '1,2,3 Barricades', symbol: 'education', class: 'wastePile', play: { effect: [{ op: 'choose', scope: { who: 'seat', chooser: 'owner' }, options: [
    { id: 'one', label: 'One', effect: [{ op: 'addBarricade', count: 1, location: 'here' }] },
    { id: 'two', label: 'Two', effect: [{ op: 'addBarricade', count: 2, location: 'here' }, { op: 'addNoise', count: 1, location: 'here' }] },
  ] }] } }),
  // locations
  rec({ id: 'colony', name: 'Colony' }),
  rec({ id: 'loc.school', name: 'School' }),
  rec({ id: 'loc.gas', name: 'Gas Station' }),
  // crisis
  rec({ id: 'cr.blizzard', name: 'Blizzard', prevent: ['fuel'], fail: [{ op: 'forbid', what: 'move', scope: { who: 'nonExiledSeats' }, duration: 'nextRound' }, { op: 'morale', value: -1 }], bonus: { extraCards: 2, effect: [{ op: 'morale', value: 1 }] } }),
  // crossroads
  rec({ id: 'xr.hunted', name: 'Hunted', mature: false, text: { options: { hunt: 'Go after them', lieLow: 'Keep your heads down' } },
    trigger: { point: 'action.move', when: { all: [{ test: 'exposureReason', subject: 'survivor', value: 'move' }, { test: 'exposureFace', subject: 'survivor', face: 'wound' }] } },
    options: [
      { id: 'hunt', effect: [{ op: 'exposure', value: 'card', count: 2, scope: { who: 'seatSurvivors' } }] },
      { id: 'lieLow', effect: [{ op: 'grant', what: 'moveRollWound', scope: { who: 'allSeats' }, duration: 'game' }] },
    ] }),
  rec({ id: 'xr.needs-ashley', name: 'Needs Ashley', mature: false,
    trigger: { point: 'action.playCard', when: { test: 'hasUnusedDie', subject: 'seat' } },
    options: [
      { id: 'a', requires: { test: 'survivorIs', subject: 'survivor', value: 'sv.nobody' }, effect: [{ op: 'morale', value: -1 }] },
      { id: 'b', effect: [{ op: 'food', value: 2 }] },
    ] }),
  rec({ id: 'xr.impossible', name: 'Impossible', mature: false,
    trigger: { point: 'action.playCard', when: { test: 'hasUnusedDie', subject: 'seat' } },
    options: [
      { id: 'a', requires: { test: 'survivorIs', subject: 'survivor', value: 'sv.nobody' }, effect: [{ op: 'morale', value: -1 }] },
      { id: 'b', requires: { test: 'survivorIs', subject: 'survivor', value: 'sv.nobody' }, effect: [{ op: 'food', value: 2 }] },
    ] }),
  rec({ id: 'xr.newcomers', name: 'Newcomers', mature: false,
    trigger: { point: 'action.playCard', when: { test: 'hasUnusedDie', subject: 'seat' } },
    options: [
      { id: 'welcome', effect: [{ op: 'addSurvivor', count: 1, scope: { who: 'seat' } }] },
      { id: 'turnAway', effect: [{ op: 'morale', value: -1 }] },
    ] }),
  rec({ id: 'xr.outbreak', name: 'Outbreak', mature: false,
    trigger: { point: 'action.playCard', when: { test: 'hasUnusedDie', subject: 'seat' } },
    options: [
      { id: 'vote', vote: true, effect: [{ op: 'vote', scope: { who: 'allSeats' }, options: [{ id: 'yes', label: 'Yes', effect: [{ op: 'morale', value: 1 }] }, { id: 'no', label: 'No', effect: [{ op: 'morale', value: -1 }] }] }] },
      { id: 'ignore', effect: [{ op: 'food', value: 1 }] },
    ] }),
  rec({ id: 'xr.divisions', name: 'Old Divisions', mature: false,
    trigger: { point: 'action.playCard', when: { test: 'hasUnusedDie', subject: 'seat' } },
    options: [
      { id: 'up', effect: [{ op: 'removeCard', value: 'crisis', count: 'all' }] },
      { id: 'down', effect: [{ op: 'morale', value: -1 }] },
    ] }),
  // main objective with a zombie.killed trigger (We Need More Samples shape)
  rec({ id: 'obj.main.samples', name: 'Samples', sides: { normal: { morale: 6, rounds: 6, counters: { samples: { need: 'perSeat', perSeatMultiplier: 3 } },
    complete: { test: 'objectiveCounterAtLeast', value: 'samples' },
    triggers: [{ id: 'sample', trigger: 'zombie.killed', effect: [{ op: 'objectiveCounter', value: 'samples', count: 1, onRoll: { atLeast: 4, then: [] } }] }] } } }),
]

export const BUNDLE: DataBundle = { version: 'test-1', byId: Object.fromEntries(RECORDS.map((r) => [r.id, r])) }

const SEATS = ['s1', 's2', 's3'] as const

const mkSurvivor = (id: string, owner: string | null, location = 'colony'): SurvivorState => ({
  id, owner, location, status: 'alive', wounds: 0, frostbite: 0, equipped: [], movedThisTurn: false, extraMoves: 0,
})
const mkSeat = (id: string, survivors: string[]): SeatState => ({
  seat: { id, kind: 'human', exiled: false, eliminated: false }, hand: [], secretObjectiveId: null, exiledObjectiveId: null, offered: [], dice: [],
  survivors, leaderId: survivors[0] ?? null, abilityUses: {},
})
const mkLoc = (id: string, entrances: number, entranceSpaces: number, survivors: number, noiseSpaces: number) => ({
  id, entrances: Array.from({ length: entrances }, (_, i) => ({ index: i + 1, zombies: 0, barricades: 0 })), noise: 0, deck: [] as string[], helpless: 0,
  capacity: { survivors, entranceSpaces, noiseSpaces },
})

export function turnPending(seat: string, id = 'd:1'): PendingDecision {
  return { id, seat, kind: 'turnAction', window: 'turn.start', context: {}, canPass: false }
}

export interface Fixture { state: GameState }
/** s1: Ashley (+ Spare One), s2: Mike (+ Sparky), s3: Forest Plum. s1 is active; the colony holds everybody. */
export function makeState(over: Partial<GameState> = {}): GameState {
  registerBundle(BUNDLE)
  const survivors: Record<string, SurvivorState> = {
    'sv.ashley': mkSurvivor('sv.ashley', 's1'), 'sv.spare': mkSurvivor('sv.spare', 's1'),
    'sv.mike': mkSurvivor('sv.mike', 's2'), 'sv.sparky': mkSurvivor('sv.sparky', 's2'),
    'sv.forest': mkSurvivor('sv.forest', 's3'),
  }
  const seats: Record<string, SeatState> = {
    s1: mkSeat('s1', ['sv.ashley', 'sv.spare']), s2: mkSeat('s2', ['sv.mike', 'sv.sparky']), s3: mkSeat('s3', ['sv.forest']),
  }
  const s: GameState = {
    seed: 't', rng: seedRng('fixture-7'), rollSeq: 0, decisionSeq: 1, cardSeq: 0, effectSeq: 0, dataVersion: 'test-1',
    setup: { seats: SEATS.map((id) => ({ id, kind: 'human' as const })), mainObjective: 'obj.main.samples' },
    phase: 'playerTurns', colonyStep: null, roundsLeft: 6, roundNumber: 1, turnCount: 1,
    turn: { seat: 's1', index: 0, actions: 0, voteCalled: false, contributionAsked: false },
    seatOrder: [...SEATS], firstSeat: 's1', activeSeat: 's1', seats, survivors, survivorDeck: ['sv.spare2'],
    locations: { colony: mkLoc('colony', 6, 3, 24, 0), 'loc.school': mkLoc('loc.school', 1, 4, 4, 4), 'loc.gas': mkLoc('loc.gas', 1, 3, 2, 4) },
    locationOrder: ['colony', 'loc.school', 'loc.gas'], cards: {}, waste: [], removed: [], removedHidden: [], cardUses: {},
    morale: 8, food: 4, starvation: 0, crisisDeck: ['cr.blizzard'],
    crisis: { cardId: 'cr.blizzard', contributions: [], result: null, history: [] },
    crossroads: { deck: [], held: null, active: null, log: [] },
    exiledObjectiveDeck: [], objective: { id: 'obj.main.samples', side: 'normal', counters: {}, cards: [], complete: false },
    effects: [], attack: null, search: null, request: null, bite: null, vote: null, exile: null,
    pending: turnPending('s1'), log: [], result: null,
    ...over,
  }
  return s
}

let seq = 0
/** Add a card instance in a zone. zone: 'hand:<seat>' | 'equipped:<survivor>' | 'waste' | 'deck:<location>' | 'crisis:<seat>'. */
export function addCard(state: GameState, defId: string, zone: string): { state: GameState; id: string } {
  const id = `c:${++seq}`
  const cards = { ...state.cards, [id]: { id, defId } }
  let st: GameState = { ...state, cards, cardSeq: state.cardSeq + 1 }
  const [kind, arg] = zone.split(':') as [string, string | undefined]
  if (kind === 'hand') st = { ...st, seats: { ...st.seats, [arg!]: { ...st.seats[arg!]!, hand: [...st.seats[arg!]!.hand, id] } } }
  else if (kind === 'equipped') st = { ...st, survivors: { ...st.survivors, [arg!]: { ...st.survivors[arg!]!, equipped: [...st.survivors[arg!]!.equipped, id] } } }
  else if (kind === 'waste') st = { ...st, waste: [id, ...st.waste] }
  else if (kind === 'deck') st = { ...st, locations: { ...st.locations, [arg!]: { ...st.locations[arg!]!, deck: [...st.locations[arg!]!.deck, id] } } }
  else if (kind === 'crisis') st = { ...st, crisis: { ...st.crisis, contributions: [...st.crisis.contributions, { seat: arg!, cardId: id }] } }
  return { state: st, id }
}
export function give(state: GameState, defId: string, zone: string): { state: GameState; id: string } { return addCard(state, defId, zone) }

export const act = <T extends Action['type']>(state: GameState, type: T, rest: Record<string, unknown> = {}, seat?: string): Action =>
  ({ type, decisionId: state.pending.id, seat: seat ?? state.pending.seat, ...rest }) as unknown as Action

export const setSurvivor = (state: GameState, id: string, p: Partial<SurvivorState>): GameState =>
  ({ ...state, survivors: { ...state.survivors, [id]: { ...state.survivors[id]!, ...p } } })
export const setSeat = (state: GameState, id: string, p: Partial<SeatState>): GameState =>
  ({ ...state, seats: { ...state.seats, [id]: { ...state.seats[id]!, ...p } } })
export const types = (events: { type: string }[]): string[] => events.map((e) => e.type)
