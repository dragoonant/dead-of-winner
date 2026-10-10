// The golden-example harness (13 §0): a state built by createGame on the fixture bundle (never hand-written from scratch),
// then shaped by the build helpers (survivors, dice, decks, hands, zombies, barricades, noise, morale, food, crisis) with
// `pending = turnAction` for the active seat in round 1. Forced dice come from a seed search over sfc32 states
// (`forceRng`), applied after the build and before the first rolling action.
import { createGame, step } from '../../src/engine/index'
import { rollDie, seedRng } from '../../src/engine/rng'
import type {
  CardId, DataBundle, DataRecord, GameState, LocationId, PendingDecision, RngState, SeatId, SeatState, SurvivorId, SurvivorState,
} from '../../src/engine/types'
import { loadFixtureBundle } from '../fixtures/loadFixtureBundle'

export const SCHOOL = 'loc.school'
export const LIBRARY = 'loc.library'
export const GAS = 'loc.gas-station'
export const HOSPITAL = 'loc.hospital'
export const POLICE = 'loc.police-station'

const rec = (r: Record<string, unknown> & { id: string; kind: string }): DataRecord => r as DataRecord
/** Survivors the scripts name that the first data slice does not carry: the printed stats, no ability (13 §0 ASSUMED). */
const extra = (id: string, name: string, influence: number, attack: number, search: number): DataRecord =>
  rec({ kind: 'survivor', id, name, stats: { influence, attack, search }, coop: true })
const sideNone = { morale: 6, rounds: 6, setup: [], complete: { test: 'moraleAtMost', value: -1 } }

export const OBJECTIVE_ID = { none: 'obj.main.golden-none', samples: 'obj.main.we-need-more-samples' } as const

/** The fixture bundle plus `obj.golden-none` (no triggers, no setup) and the four survivors the book's examples use. */
export function goldenBundle(objective: keyof typeof OBJECTIVE_ID): DataBundle {
  const base = loadFixtureBundle()
  const byId: Record<string, DataRecord> = {
    ...base.byId,
    'obj.main.golden-none': rec({ kind: 'mainObjective', id: 'obj.main.golden-none', name: 'Golden (no triggers)', code: 'G0', sides: { normal: sideNone, hardcore: sideNone } }),
    'sv.mike-cho': extra('sv.mike-cho', 'Mike Cho', 30, 2, 4),
    'sv.forest-plum': extra('sv.forest-plum', 'Forest Plum', 14, 4, 5),
    'sv.sparky': extra('sv.sparky', 'Sparky', 10, 3, 4),
    'sv.olivia-brown': extra('sv.olivia-brown', 'Olivia Brown', 56, 3, 3),
  }
  return { version: `golden-fixture-${objective}`, byId }
}

/** The first rng state whose next draws are exactly `spec` as (sides, value) pairs, in order. */
export function forceRng(...spec: [sides: number, value: number][]): RngState {
  for (let i = 0; i < 400000; i++) {
    let s = seedRng(`golden-force-${i}`)
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

export interface SvSpec { id: SurvivorId; owner: SeatId; location: LocationId; leader?: boolean; wounds?: number; frostbite?: number }
export interface GoldenOpts {
  seats: number
  survivors: SvSpec[]
  dice?: Record<SeatId, number[]>
  hands?: Record<SeatId, string[]> // item def ids, minted in order
  decks?: Record<LocationId, string[]> // item def ids, top first
  zombies?: Record<LocationId, number[]> // per entrance
  barricades?: Record<LocationId, number[]>
  noise?: Record<LocationId, number>
  helpless?: number
  morale?: number
  food?: number
  starvation?: number
  crisis?: string | null
  contributions?: { seat: SeatId; defId: string }[]
  active?: SeatId // whose turnAction is open; the turn index follows the seat order from s1
  rng?: RngState
}

/** createGame + the setup phase with the first option each time, then the script's shape on top. */
export function buildGolden(bundle: DataBundle, o: GoldenOpts): GameState {
  const objective = bundle.byId['obj.main.golden-none'] && bundle.version.endsWith('none') ? OBJECTIVE_ID.none : OBJECTIVE_ID.samples
  const seats = Array.from({ length: o.seats }, (_, i) => ({ id: `s${i + 1}`, kind: 'bot' as const }))
  // R p15: two seats play the two-player (co-op) variant; the scripts' values do not depend on it (the sample need is per seat either side)
  let r = createGame({ seats, mainObjective: objective, variants: o.seats === 2 ? { twoPlayer: true } : {} }, 'golden', bundle)
  if (r.rejection) throw new Error(`golden: createGame rejected: ${r.rejection.message}`)
  for (let guard = 0; guard < 40 && r.state.phase === 'setup'; guard++) {
    r = step(r.state, r.pending.options![0]!.action)
    if (r.rejection) throw new Error(`golden: setup rejected: ${r.rejection.message}`)
  }
  const s = r.state
  let cardSeq = 0
  const cards: GameState['cards'] = {}
  const mint = (defId: string): CardId => { cardSeq += 1; const id = `c:${cardSeq}`; cards[id] = { id, defId }; return id }

  const seatsOut: Record<SeatId, SeatState> = {}
  for (const id of s.seatOrder) {
    seatsOut[id] = {
      ...s.seats[id]!, hand: (o.hands?.[id] ?? []).map(mint), offered: [], abilityUses: {}, survivors: [], leaderId: null,
      dice: (o.dice?.[id] ?? []).map((v, i) => ({ id: `${id}:d${i + 1}`, value: v, used: false })),
    }
  }
  const survivors: Record<SurvivorId, SurvivorState> = {}
  for (const sv of o.survivors) {
    survivors[sv.id] = { id: sv.id, owner: sv.owner, location: sv.location, status: 'alive', wounds: sv.wounds ?? 0, frostbite: sv.frostbite ?? 0, equipped: [], movedThisTurn: false, extraMoves: 0 }
    seatsOut[sv.owner]!.survivors.push(sv.id)
  }
  for (const id of s.seatOrder) {
    const mine = o.survivors.filter((x) => x.owner === id)
    seatsOut[id]!.leaderId = (mine.find((x) => x.leader) ?? mine[0])?.id ?? null
  }
  const locations: GameState['locations'] = {}
  for (const id of s.locationOrder) {
    const l = s.locations[id]!
    locations[id] = {
      ...l, noise: o.noise?.[id] ?? 0, deck: (o.decks?.[id] ?? []).map(mint), helpless: id === 'colony' ? o.helpless ?? 0 : 0,
      entrances: l.entrances.map((e, i) => ({ index: e.index, zombies: o.zombies?.[id]?.[i] ?? 0, barricades: o.barricades?.[id]?.[i] ?? 0 })),
    }
  }
  const contributions = (o.contributions ?? []).map((c) => ({ seat: c.seat, cardId: mint(c.defId) }))
  const active = o.active ?? 's1'
  const decisionSeq = s.decisionSeq + 1
  const pending: PendingDecision = { id: `d:${decisionSeq}`, seat: active, kind: 'turnAction', window: 'turn.start', context: { seatId: active }, canPass: false }
  return {
    ...s, rng: o.rng ?? s.rng, cardSeq, cards, seats: seatsOut, survivors, survivorDeck: s.survivorDeck.filter((id) => !(id in survivors)), locations,
    waste: [], removed: [], removedHidden: [], cardUses: {}, morale: o.morale ?? 6, food: o.food ?? 0, starvation: o.starvation ?? 0,
    roundsLeft: 6, roundNumber: 1, crisisDeck: [], crisis: { cardId: o.crisis ?? null, contributions, result: null, history: [] },
    crossroads: { deck: [], held: null, active: null, log: [] }, objective: { ...s.objective, counters: {}, cards: [], complete: false }, effects: [],
    attack: null, search: null, request: null, bite: null, vote: null, exile: null,
    firstSeat: 's1', activeSeat: active, turn: { seat: active, index: s.seatOrder.indexOf(active), actions: 0, voteCalled: false, contributionAsked: false },
    decisionSeq, pending, log: [],
  }
}

/** Reopen a turnAction for `seat` as the round's last turn (GOLD-006 runs three colony phases on one state), with the colony entrances cleared. */
export function reopenLastTurn(state: GameState, seat: SeatId, patch: Partial<Pick<GameState, 'food' | 'starvation' | 'morale'>> & { helpless?: number } = {}): GameState {
  const decisionSeq = state.decisionSeq + 1
  const pending: PendingDecision = { id: `d:${decisionSeq}`, seat, kind: 'turnAction', window: 'turn.start', context: { seatId: seat }, canPass: false }
  const colony = state.locations['colony']!
  const { helpless, ...rest } = patch
  return {
    ...state, ...rest, decisionSeq, pending, activeSeat: seat, turn: { seat, index: state.seatOrder.indexOf(seat), actions: 0, voteCalled: false, contributionAsked: false },
    locations: { ...state.locations, colony: { ...colony, helpless: helpless ?? colony.helpless, entrances: colony.entrances.map((e) => ({ ...e, zombies: 0, barricades: 0 })) } },
  }
}

// ---------- event helpers ----------
export const types = (events: { type: string }[]): string[] => events.map((e) => e.type)
export const of = <T extends object = Record<string, any>>(events: { type: string }[], type: string): T[] => events.filter((e) => e.type === type) as unknown as T[]
/** Indices of the first occurrence of each type, searched left to right from the previous hit (−1 = missing or out of order). */
export function orderOf(events: { type: string }[], seq: string[]): number[] {
  const out: number[] = []
  let from = 0
  for (const t of seq) {
    let i = -1
    for (let k = from; k < events.length; k++) if (events[k]!.type === t) { i = k; break }
    out.push(i)
    if (i >= 0) from = i + 1
  }
  return out
}
export const act = <T extends Record<string, unknown>>(state: GameState, body: T) => ({ decisionId: state.pending.id, seat: state.pending.seat as string, ...body })
