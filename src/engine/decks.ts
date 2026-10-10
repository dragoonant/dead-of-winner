// Leaf module of the setup/dice/survivor trio: bundle lookups, card minting, deck shuffling, small immutable
// state patches and the decision minter. Everything here is pure; randomness always goes through state.rng.
// (10 R3, 00 §2, §11.) The engine never imports data JSON: records come from the DataBundle passed to createGame.
import type { GameEvent } from './events'
import { shuffle } from './rng'
import type {
  CardId, DataBundle, DataRecord, DecisionId, GameState, Id, LocationId, LocationState, PendingDecision, Rejection, RejectionCode,
  SeatId, SeatState, SurvivorId, SurvivorState,
} from './types'
import { EngineInvariantError } from './types'

/** A pure step piece: the new state plus the events it produced, in order. */
export interface Out { state: GameState; events: GameEvent[] }

export const reject = (code: RejectionCode, message: string, detail?: Record<string, unknown>): Rejection => (detail ? { code, message, detail } : { code, message })

// ---------- bundle access ----------
// index.ts keeps its own registry for step(); the setup modules keep one too so they never import index.ts (no import cycle).
const DATA: Map<string, DataBundle> = new Map()
export function registerDataBundle(bundle: DataBundle): void { DATA.set(bundle.version, bundle) }
export function tryBundle(state: { dataVersion: string }): DataBundle | undefined { return DATA.get(state.dataVersion) }
export function bundleOf(state: { dataVersion: string }): DataBundle {
  const b = DATA.get(state.dataVersion)
  if (!b) throw new EngineInvariantError(`no data bundle registered for version ${state.dataVersion}`)
  return b
}

// record shapes the setup modules read (shape-compatible with docs/spec/schemas until src/data/types.ts lands)
export interface SurvivorRec extends DataRecord { kind: 'survivor'; name?: string; stats: { influence: number; attack: number; search: number }; coop?: boolean }
export interface ItemRec extends DataRecord { kind: 'item'; symbol?: string; coop?: boolean; nonCoop?: boolean }
export interface DeckRec extends DataRecord { kind: 'deck'; cards: { item: Id; count: number }[] }
export interface LocationRec extends DataRecord { kind: 'location'; name?: string; number?: number; spaces: { survivors: number; entrances: number; entranceSpaces: number; noise: number }; deck: Id | null }
export interface CrisisRec extends DataRecord { kind: 'crisis'; prevent?: string[] }
export interface CrossroadsRec extends DataRecord { kind: 'crossroads'; mature?: boolean; coop?: boolean }
export interface SideDef { morale: number; rounds: number; setup?: SetupEffect[] }
export interface MainObjectiveRec extends DataRecord { kind: 'mainObjective'; sides: { normal: SideDef; hardcore: SideDef } }
export interface SecretObjectiveRec extends DataRecord { kind: 'secretObjective'; type: 'secret' | 'betrayal' | 'exiled' }
export interface SetupEffect {
  op: string
  value?: number | string
  count?: number | string
  location?: string
  scope?: { who: string; location?: string }
}

/** Every record of one kind, sorted by id so seeded shuffles never depend on object key order. */
export function recordsOfKind<T extends DataRecord>(bundle: DataBundle, kind: string): T[] {
  const out: DataRecord[] = []
  for (const rec of Object.values(bundle.byId)) if ((rec as { kind?: unknown }).kind === kind) out.push(rec)
  out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return out as T[]
}
export const recordOf = <T extends DataRecord>(bundle: DataBundle, id: Id): T | undefined => bundle.byId[id] as T | undefined
export function survivorInfluence(bundle: DataBundle, id: SurvivorId): number { return recordOf<SurvivorRec>(bundle, id)?.stats?.influence ?? 0 }
export function survivorName(state: { dataVersion: string }, id: SurvivorId): string {
  const b = tryBundle(state)
  return (b && recordOf<SurvivorRec>(b, id)?.name) || id
}
/** Defs flagged out of the co-op game (`coop:false`, or `nonCoop:true` on item cards; R3.10). */
export const isNonCoop = (rec: { coop?: boolean; nonCoop?: boolean } | undefined): boolean => !!rec && (rec.coop === false || rec.nonCoop === true)

/** Expands a deck record into its card definition ids, in the listed order (one entry per copy). */
export function expandDeck(deck: DeckRec): Id[] {
  const out: Id[] = []
  for (const row of deck.cards) for (let i = 0; i < row.count; i++) out.push(row.item)
  return out
}

/** The six location cards in zombie-step order (R2.1: the number printed in the card corner), preceded by the colony. */
export function locationRecordsInOrder(bundle: DataBundle): { colony: LocationRec | undefined; others: LocationRec[] } {
  const all = recordsOfKind<LocationRec>(bundle, 'location')
  const colony = all.find((l) => l.id === 'colony')
  const others = all.filter((l) => l.id !== 'colony').sort((a, b) => (a.number ?? 99) - (b.number ?? 99) || (a.id < b.id ? -1 : 1))
  return { colony, others }
}

// ---------- seeded shuffle on state.rng ----------
export function shuffleOn<T>(state: GameState, items: readonly T[]): { state: GameState; items: T[] } {
  const [out, rng] = shuffle(state.rng, items)
  return { state: { ...state, rng }, items: out }
}

// ---------- card instances ----------
export function mintCards(state: GameState, defIds: readonly Id[]): { state: GameState; ids: CardId[] } {
  const cards = { ...state.cards }
  const ids: CardId[] = []
  let seq = state.cardSeq
  for (const defId of defIds) {
    seq += 1
    const id = `c:${seq}`
    cards[id] = { id, defId }
    ids.push(id)
  }
  return { state: { ...state, cards, cardSeq: seq }, ids }
}

// ---------- immutable patches ----------
export function patchSeat(state: GameState, seat: SeatId, patch: Partial<SeatState>): GameState {
  const cur = state.seats[seat]
  if (!cur) throw new EngineInvariantError(`unknown seat ${seat}`)
  return { ...state, seats: { ...state.seats, [seat]: { ...cur, ...patch } } }
}
export function patchSurvivor(state: GameState, id: SurvivorId, patch: Partial<SurvivorState>): GameState {
  const cur = state.survivors[id]
  if (!cur) throw new EngineInvariantError(`unknown survivor ${id}`)
  return { ...state, survivors: { ...state.survivors, [id]: { ...cur, ...patch } } }
}
export function patchLocation(state: GameState, id: LocationId, patch: Partial<LocationState>): GameState {
  const cur = state.locations[id]
  if (!cur) throw new EngineInvariantError(`unknown location ${id}`)
  return { ...state, locations: { ...state.locations, [id]: { ...cur, ...patch } } }
}

// ---------- decisions ----------
/** Allocates the next decision id, builds the decision with it (so options can carry their own decisionId) and installs it as `state.pending`. */
export function mintDecision(state: GameState, build: (id: DecisionId) => Omit<PendingDecision, 'id'>): { state: GameState; pending: PendingDecision } {
  const seq = state.decisionSeq + 1
  const pending: PendingDecision = { id: `d:${seq}`, ...build(`d:${seq}`) }
  return { state: { ...state, decisionSeq: seq, pending }, pending }
}

/** Alive survivors a seat controls (order = seats[s].survivors). */
export const aliveOf = (state: GameState, seat: SeatId): SurvivorId[] => (state.seats[seat]?.survivors ?? []).filter((id) => state.survivors[id]?.status === 'alive')
