// createGame internals (10 R3, 11 O2.1-O2.2, O3.1, 00 §2). Validates a GameSetup against the bundle, builds every deck on
// the seeded stream, applies the main objective's setup, deals secret objectives and starting items, and raises the first
// `chooseSurvivors`. The rest of setup (choices, leaders, first seat, round 1) is phases/setup.ts.
//
// Seeded stream order (changing it changes every game; keep it): random main objective, survivor deck, crisis deck,
// Crossroads deck, exiled-objective deck, starter items, the six location decks in locationOrder, secret-objective pools.
import type { ChooseSurvivorsAction } from './actions'
import type { GameEvent } from './events'
import { rollDie, seedRng, shuffle } from './rng'
import type {
  CardId, DecisionOption, EntranceState, GameSetup, GameState, Id, LocationId, LocationState, ObjectiveSide, PendingDecision, Rejection,
  RngState, SeatId, SeatState, StepResult, DataBundle,
} from './types'
import {
  expandDeck, isNonCoop, locationRecordsInOrder, mintDecision, recordOf, recordsOfKind, registerDataBundle, reject, survivorName,
  type CrisisRec, type CrossroadsRec, type DeckRec, type ItemRec, type MainObjectiveRec, type SecretObjectiveRec, type SetupEffect, type SurvivorRec,
} from './decks'

export const OFFERED_PER_SEAT = 4
export const keepCount = (setup: Pick<GameSetup, 'variants'>): number => (setup.variants?.twoPlayer ? 3 : 2)
export const startingItemCount = (setup: Pick<GameSetup, 'variants'>): number => (setup.variants?.twoPlayer ? 7 : 5)
export const isCoop = (setup: Pick<GameSetup, 'variants'>): boolean => !!(setup.variants?.coop || setup.variants?.twoPlayer)
export const objectiveSideOf = (setup: Pick<GameSetup, 'variants'>): ObjectiveSide => (setup.variants?.hardcore || isCoop(setup) ? 'hardcore' : 'normal')

// ---------- validation ----------
export function validateSetup(setup: GameSetup, bundle: DataBundle): Rejection | null {
  const bad = (message: string, detail?: Record<string, unknown>) => reject('E_BAD_SETUP', message, detail)
  if (!setup || !Array.isArray(setup.seats)) return bad('setup.seats must be a list')
  const n = setup.seats.length
  if (n < 2 || n > 5) return bad(`2 to 5 seats are needed, got ${n}`, { seats: n })
  const ids = new Set<string>()
  for (const s of setup.seats) {
    if (!s || typeof s.id !== 'string' || s.id === '') return bad('every seat needs an id')
    if (ids.has(s.id)) return bad(`duplicate seat id ${s.id}`)
    ids.add(s.id)
  }
  const v = setup.variants ?? {}
  if (n === 2 && !v.twoPlayer) return bad('two seats require the twoPlayer variant (R p15)')
  if (v.betrayer && isCoop(setup)) return bad('the betrayer variant contradicts co-op play')

  if (setup.mainObjective !== 'random') {
    const rec = recordOf<MainObjectiveRec>(bundle, setup.mainObjective)
    if (!rec || rec.kind !== 'mainObjective') return bad(`unknown main objective ${String(setup.mainObjective)}`)
  } else if (recordsOfKind(bundle, 'mainObjective').length === 0) return bad('the bundle has no main objective')

  // what the bundle must hold for this table
  const { colony, others } = locationRecordsInOrder(bundle)
  if (!colony) return bad('the bundle has no colony record')
  if (others.length !== 6) return bad(`the bundle needs six location cards, found ${others.length}`)
  for (const l of others) if (!l.deck || !recordOf<DeckRec>(bundle, l.deck)) return bad(`location ${l.id} has no item deck`)
  const starter = recordOf<DeckRec>(bundle, 'deck.starter')
  if (!starter) return bad('the bundle has no deck.starter')
  const starterCards = expandDeck(starter).filter((d) => !(isCoop(setup) && isNonCoop(recordOf<ItemRec>(bundle, d)))).length
  if (starterCards < startingItemCount(setup) * n) return bad('the starter deck is too small for this table')
  const survivors = recordsOfKind<SurvivorRec>(bundle, 'survivor').filter((r) => !(isCoop(setup) && r.coop === false))
  if (survivors.length < OFFERED_PER_SEAT * n) return bad('not enough survivors in the bundle for this table')
  if (recordsOfKind(bundle, 'crisis').length === 0) return bad('the bundle has no crisis cards')
  if (!isCoop(setup)) {
    const sec = recordsOfKind<SecretObjectiveRec>(bundle, 'secretObjective')
    if (sec.filter((r) => r.type === 'secret').length < n) return bad('not enough standard secret objectives')
    if (sec.filter((r) => r.type === 'betrayal').length < 1) return bad('the bundle has no betrayal objective')
  }
  return null
}

// ---------- state skeleton ----------
function blankState(setup: GameSetup, seed: string, dataVersion: string): GameState {
  const seats: Record<SeatId, SeatState> = {}
  for (const s of setup.seats ?? []) {
    seats[s.id] = {
      seat: { id: s.id, kind: s.kind, ...(s.persona ? { persona: s.persona } : {}), ...(s.name ? { name: s.name } : {}), exiled: false, eliminated: false },
      hand: [], secretObjectiveId: null, exiledObjectiveId: null, offered: [], dice: [], survivors: [], leaderId: null, abilityUses: {},
    }
  }
  const order = (setup.seats ?? []).map((s) => s.id)
  return {
    seed, rng: seedRng(seed), rollSeq: 0, decisionSeq: 0, cardSeq: 0, effectSeq: 0, dataVersion, setup, phase: 'setup', colonyStep: null,
    roundsLeft: 0, roundNumber: 0, turnCount: 0, turn: null, seatOrder: order, firstSeat: order[0] ?? '', activeSeat: null, seats,
    survivors: {}, survivorDeck: [], locations: {}, locationOrder: [], cards: {}, waste: [], removed: [], removedHidden: [], cardUses: {},
    morale: 0, food: 0, starvation: 0, crisisDeck: [], crisis: { cardId: null, contributions: [], result: null, history: [] },
    crossroads: { deck: [], held: null, active: null, log: [] }, exiledObjectiveDeck: [],
    objective: { id: '', side: 'normal', counters: {}, cards: [], complete: false }, effects: [],
    attack: null, search: null, request: null, bite: null, vote: null, exile: null,
    pending: { id: 'd:0', seat: 'all', kind: 'gameOver', window: 'game.end', context: {}, canPass: false },
    log: [], result: null,
  }
}

/** createGame on a bad setup: no game exists, so the result carries an inert ended stub, no events and the rejection. */
export function rejectedCreate(setup: GameSetup, seed: string, bundle: DataBundle, rejection: Rejection): StepResult {
  const stub = { ...blankState(setup, seed, bundle.version), phase: 'ended' as const }
  return { state: stub, events: [], pending: stub.pending, rejection }
}

// ---------- the main objective's setup list ----------
function amountOf(e: SetupEffect, seats: number): number {
  const raw = e.value ?? e.count ?? 1
  if (typeof raw === 'number') return raw
  if (raw === 'perSeat') return seats * (typeof e.count === 'number' ? e.count : 1)
  const m = /^seats(?:\+(\d+))?$/.exec(raw)
  if (m) return seats + Number(m[1] ?? 0)
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

function targetsOf(e: SetupEffect, order: LocationId[]): LocationId[] {
  const nonColony = order.filter((l) => l !== 'colony')
  switch (e.scope?.who) {
    case 'nonColonyLocations': return nonColony
    case 'allLocations': return order
    case 'colony': return ['colony']
    case 'location': return e.scope.location && order.includes(e.scope.location) ? [e.scope.location] : []
    default: break
  }
  if (e.location && e.location !== 'here' && e.location !== 'chosen' && order.includes(e.location)) return [e.location]
  return ['colony']
}

/** Zombies at setup (source 'setup'): one at a time, colony rotation from entrance 1 (R9.2). No survivor is on the board yet, so an overrun can only be recorded, never kill (R9.6). */
function seedZombies(locations: Record<LocationId, LocationState>, location: LocationId, count: number, events: GameEvent[]): void {
  if (count <= 0) return
  events.push({ type: 'ZombiesToAdd', location, count, source: 'setup' })
  const loc = locations[location]!
  for (let i = 0; i < count; i++) {
    const idx = loc.entrances.length === 1 ? 0 : i % loc.entrances.length
    const ent = loc.entrances[idx]!
    if (ent.zombies + ent.barricades >= loc.capacity.entranceSpaces) {
      events.push({ type: 'EntranceOverrun', location, entrance: ent.index, killed: null })
      continue
    }
    ent.zombies += 1
    events.push({ type: 'ZombieAdded', location, entrance: ent.index, source: 'setup', zombies: ent.zombies })
  }
}

// ---------- chooseSurvivors ----------
const combos = <T,>(items: readonly T[], k: number): T[][] => {
  const out: T[][] = []
  const rec = (start: number, acc: T[]) => {
    if (acc.length === k) { out.push([...acc]); return }
    for (let i = start; i < items.length; i++) { acc.push(items[i]!); rec(i + 1, acc); acc.pop() }
  }
  rec(0, [])
  return out
}

/** The `chooseSurvivors` decision for a seat whose `offered` list is set; options enumerate every legal keep-set. */
export function chooseSurvivorsDecision(state: GameState, seat: SeatId): { state: GameState; pending: PendingDecision } {
  const offered = state.seats[seat]!.offered
  const k = keepCount(state.setup)
  return mintDecision(state, (id) => {
    const options: DecisionOption[] = combos(offered, k).map((keep) => {
      const action: ChooseSurvivorsAction = { type: 'chooseSurvivors', decisionId: id, seat, keep }
      return { id: `keep:${keep.join('+')}`, label: `keep ${keep.map((s) => survivorName(state, s)).join(' and ')}`, action }
    })
    return { seat, kind: 'chooseSurvivors', window: 'setup.done', context: { seatId: seat, data: { offered: [...offered], keep: k } }, options, canPass: false }
  })
}

// ---------- createGame ----------
export function createGameInternal(setup: GameSetup, seed: string, bundle: DataBundle): StepResult {
  registerDataBundle(bundle)
  const bad = validateSetup(setup, bundle)
  if (bad) return rejectedCreate(setup, seed, bundle, bad)

  const variants = setup.variants ?? {}
  const coop = isCoop(setup)
  const n = setup.seats.length
  const seatIds = setup.seats.map((s) => s.id)
  const events: GameEvent[] = []
  let st = blankState(setup, seed, bundle.version)
  let rng: RngState = st.rng
  const sh = <T,>(xs: readonly T[]): T[] => { const [o, r] = shuffle(rng, xs); rng = r; return o }
  let cardSeq = 0
  const cards: GameState['cards'] = {}
  const mint = (defId: Id, starter = false): CardId => { cardSeq += 1; const id = `c:${cardSeq}`; cards[id] = starter ? { id, defId, starter: true } : { id, defId }; return id }

  // main objective (R3.2)
  let mainId: Id
  if (setup.mainObjective === 'random') {
    const ids = recordsOfKind(bundle, 'mainObjective').map((r) => r.id)
    const [v, r] = rollDie(rng, ids.length); rng = r
    mainId = ids[v - 1]!
  } else mainId = setup.mainObjective
  const main = recordOf<MainObjectiveRec>(bundle, mainId)!
  const side = objectiveSideOf(setup)
  const sideDef = main.sides[side]
  events.push({ type: 'GameCreated', seed, dataVersion: bundle.version, seats: seatIds, objectiveId: mainId })

  // decks (R3.4)
  const survivorDeck = sh(recordsOfKind<SurvivorRec>(bundle, 'survivor').filter((r) => !(coop && r.coop === false)).map((r) => r.id))
  const crisisDeck = sh(recordsOfKind<CrisisRec>(bundle, 'crisis').map((r) => r.id))
  const crossroadsDeck = sh(recordsOfKind<CrossroadsRec>(bundle, 'crossroads').filter((r) => !(variants.removeMature && r.mature) && !(coop && r.coop === false)).map((r) => r.id))
  events.push({ type: 'CrossroadsDeckShuffled', reason: 'setup' })
  const exiledObjectiveDeck = sh(recordsOfKind<SecretObjectiveRec>(bundle, 'secretObjective').filter((r) => r.type === 'exiled').map((r) => r.id))

  // starting items (R3.5): only the dealt cards ever exist as instances
  const seats: Record<SeatId, SeatState> = { ...st.seats }
  const starterDefs = sh(expandDeck(recordOf<DeckRec>(bundle, 'deck.starter')!).filter((d) => !(coop && isNonCoop(recordOf<ItemRec>(bundle, d)))))
  const per = startingItemCount(setup)
  seatIds.forEach((sid, i) => {
    const hand = starterDefs.slice(i * per, (i + 1) * per).map((d) => mint(d, true))
    seats[sid] = { ...seats[sid]!, hand }
    events.push({ type: 'StartingItemsDealt', seat: sid, cardIds: hand })
  })

  // locations and their decks (R3.6)
  const { colony, others } = locationRecordsInOrder(bundle)
  const locationOrder: LocationId[] = ['colony', ...others.map((l) => l.id)]
  const locations: Record<LocationId, LocationState> = {}
  for (const rec of [colony!, ...others]) {
    const entrances: EntranceState[] = Array.from({ length: rec.spaces.entrances }, (_, i) => ({ index: i + 1, zombies: 0, barricades: 0 }))
    let deck: CardId[] = []
    if (rec.id !== 'colony') {
      const defs = expandDeck(recordOf<DeckRec>(bundle, rec.deck!)!).filter((d) => !(coop && isNonCoop(recordOf<ItemRec>(bundle, d))))
      deck = sh(defs.map((d) => mint(d)))
      events.push({ type: 'DeckShuffled', location: rec.id, reason: 'setup' })
    }
    locations[rec.id] = { id: rec.id, entrances, noise: 0, deck, helpless: 0, capacity: { survivors: rec.spaces.survivors, entranceSpaces: rec.spaces.entranceSpaces, noiseSpaces: rec.spaces.noise } }
  }

  // secret objectives (R3.3)
  if (!coop) {
    const sec = recordsOfKind<SecretObjectiveRec>(bundle, 'secretObjective')
    const standardPool = sh(sec.filter((r) => r.type === 'secret').map((r) => r.id)).slice(0, variants.betrayer ? n : 2 * n)
    const betrayal = sh(sec.filter((r) => r.type === 'betrayal').map((r) => r.id)).slice(0, 1)
    const pool = sh([...standardPool, ...betrayal])
    seatIds.forEach((sid, i) => {
      const objectiveId = pool[i]!
      seats[sid] = { ...seats[sid]!, secretObjectiveId: objectiveId }
      events.push({ type: 'SecretObjectiveDealt', seat: sid, objectiveId, kind: betrayal.includes(objectiveId) ? 'betrayal' : 'standard' })
    })
  }

  // survivors offered (R3.7)
  let deckLeft = survivorDeck
  for (const sid of seatIds) {
    const offered = deckLeft.slice(0, OFFERED_PER_SEAT)
    deckLeft = deckLeft.slice(OFFERED_PER_SEAT)
    seats[sid] = { ...seats[sid]!, offered }
    events.push({ type: 'SurvivorsDealt', seat: sid, survivorIds: [...offered] })
  }

  // main objective setup (R3.2, O2.2): tracks first, then its effect list in order
  let helpless = 0
  for (const e of sideDef.setup ?? []) {
    const targets = targetsOf(e, locationOrder)
    if (e.op === 'addZombies') for (const loc of targets) seedZombies(locations, loc, amountOf(e, n), events)
    else if (e.op === 'addHelpless') helpless += amountOf(e, n)
  }
  if (helpless > 0) {
    const have = Math.min(helpless, locations['colony']!.capacity.survivors)
    locations['colony'] = { ...locations['colony']!, helpless: have }
    events.push({ type: 'HelplessAdded', location: 'colony', count: have, after: have, sourceId: mainId })
  }

  st = {
    ...st, rng, cardSeq, cards, seats, locations, locationOrder, survivorDeck: deckLeft, crisisDeck, exiledObjectiveDeck,
    crossroads: { deck: crossroadsDeck, held: null, active: null, log: [] },
    morale: sideDef.morale, roundsLeft: sideDef.rounds, objective: { id: mainId, side, counters: {}, cards: [], complete: false },
  }
  const d = chooseSurvivorsDecision(st, seatIds[0]!)
  return { state: d.state, events, pending: d.pending }
}

