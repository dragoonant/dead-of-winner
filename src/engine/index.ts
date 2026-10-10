// FROZEN after M0: the public engine API (00 §2, §10, §12). M1 wires the bodies to the rules modules.
// Nothing here ever uses Math.random, Date (except save meta) or I/O. step() is a pure reducer: illegal input returns a
// rejection and the SAME state reference; only EngineInvariantError may throw.
import type { Action } from './actions'
import { TURN_ACTION_TYPES } from './actions'
import { dieNeed } from './actions/ability'
import { attackSurvivorOdds as attackSurvivorOddsOf } from './actions/attack'
import { needFor, rejected } from './actions/die-common'
import { moveTargetsFor } from './actions/move'
import { voteForecastFor } from './actions/vote'
import { bundleFor, registerBundle } from './bundles'
import { crisisReportFromView } from './crisis'
import { expandDeck, recordOf, recordsOfKind, type DeckRec, type LocationRec } from './decks'
import { findDescriptor, isForbidden, symbolsOf } from './effects'
import { deathThreshold, exposureOddsFor, statsOf } from './exposure'
import { endGame, finalizeEnding, objectiveProgressFromView, stateFromView } from './objectives'
import { enterColonyPhase, legalColonyActions, registerNextRoundStarter, stepColony } from './phases/colony'
import { legalPlayerTurnsActions, registerColonyStarter, startRound, stepPlayerTurns } from './phases/player-turns'
import { setupLegalActions, stepSetup } from './phases/setup'
import { EXPOSURE_FACE_COUNT } from './rng'
import { createGameInternal, rejectedCreate } from './setup'
import type {
  DataBundle, DieId, EntranceIndex, ExposureOdds, ExposureReason, GameSetup, GameState, Id, ItemSymbol, LocationId, PendingDecision, Rejection, SaveFile,
  SeatId, StepResult, SurvivorId,
} from './types'
import { EngineInvariantError } from './types'
import { view as projectView, type SeatView } from './view'

export * from './types'
export * from './actions'
export * from './events'
export * from './hooks'
export * from './rng'
export * from './decider'
export * from './view'
export { registerBundle, bundleFor }

export const ENGINE_VERSION = '0.1.0'

// ---------- wiring the phase machines together (done on first use: the modules form import cycles) ----------
let wired = false
function ensureWired(): void {
  if (wired) return
  wired = true
  registerColonyStarter((state) => enterColonyPhase(state)) // R4.7: after the last turn the colony phase runs
  registerNextRoundStarter((state) => startRound(state)) // R4.15: after the token passes the next round starts
}

// ---------- reducer (00 §2) ----------
/** Builds the setup state, deals survivors, items and secret objectives from the seeded stream; the first pending is `chooseSurvivors` for the first seat. Bad setup → rejection E_BAD_SETUP, never a throw. */
export function createGame(setup: GameSetup, seed: string, bundle: DataBundle): StepResult {
  ensureWired()
  registerBundle(bundle)
  if (typeof seed !== 'string') return rejectedCreate(setup, String(seed), bundle, { code: 'E_BAD_SETUP', message: 'the seed must be a string' })
  return createGameInternal(setup, seed, bundle)
}

const KNOWN_TYPES: ReadonlySet<string> = new Set([
  ...TURN_ACTION_TYPES, 'pass', 'ack', 'concede', 'effectChoice', 'chooseSurvivors', 'chooseLeader', 'keepCard', 'makeNoise', 'respondRequest',
  'chooseCrossroadsOption', 'biteSpread', 'placeExiled', 'objectiveChoice', 'itemTarget', 'castVotes',
])
const rej = (code: Rejection['code'], message: string, detail?: Record<string, unknown>): Rejection => ({ code, message, ...(detail ? { detail } : {}) })

/** The shape every action must have before a phase module sees it (a malformed payload is a rejection, never a throw). */
function shapeCheck(action: unknown): Rejection | null {
  if (!action || typeof action !== 'object') return rej('E_BAD_PAYLOAD', 'an action must be an object')
  const a = action as Record<string, unknown>
  if (typeof a['type'] !== 'string' || !KNOWN_TYPES.has(a['type'])) return rej('E_BAD_PAYLOAD', `unknown action type ${String(a['type'])}`)
  if (typeof a['decisionId'] !== 'string') return rej('E_BAD_PAYLOAD', 'decisionId must be a string')
  if (typeof a['seat'] !== 'string') return rej('E_BAD_PAYLOAD', 'seat must be a string')
  return null
}

/** R17.4: the human resigns on any decision addressed to it (or to 'all'); nobody wins. */
function concede(state: GameState, action: Action): StepResult {
  const pd = state.pending
  if (action.decisionId !== pd.id) return rejected(state, action, rej('E_WRONG_DECISION', 'this is not the open decision', { expected: pd.id }))
  if (pd.seat !== 'all' && action.seat !== pd.seat) return rejected(state, action, rej('E_NOT_YOUR_DECISION', 'the open decision belongs to another seat'))
  if (state.seats[action.seat]?.seat.kind !== 'human') return rejected(state, action, rej('E_NOT_YOUR_DECISION', 'only a human seat can concede'))
  const r = endGame(state, 'concession')
  return { state: r.state, events: r.events, pending: r.pending }
}

function dispatch(state: GameState, action: Action): StepResult {
  if (state.phase === 'ended') {
    if (action.type === 'ack' && action.decisionId === state.pending.id) return { state, events: [], pending: state.pending }
    return rejected(state, action, rej('E_GAME_OVER', 'the game is over'))
  }
  if (action.type === 'concede') return concede(state, action)
  switch (state.phase) {
    case 'setup': return stepSetup(state, action)
    case 'playerTurns': return stepPlayerTurns(state, action)
    case 'colony': return stepColony(state, action)
  }
}

/** Pure reducer: one action → 0..n events → exactly one pending. Illegal action → the SAME state reference, [ActionRejected], a rejection. Throws only EngineInvariantError. */
export function step(state: GameState, action: Action): StepResult {
  ensureWired()
  const bad = shapeCheck(action)
  if (bad) return rejected(state, action, bad)
  let r: StepResult
  try {
    r = dispatch(state, action)
  } catch (e) {
    if (e instanceof EngineInvariantError) throw e
    // a payload the modules could not digest: a rejection, never a throw (the message keeps the cause for the sim and the tests)
    return rejected(state, action, rej('E_BAD_PAYLOAD', `the action could not be applied: ${(e as Error).message}`, { error: String((e as Error).stack ?? e) }))
  }
  if (r.rejection) return r
  if (r.state === state) return r // an ack: nothing changed, nothing to log
  const pending = r.pending ?? r.state.pending
  if (!pending) throw new EngineInvariantError('step: no decision is open after the action')
  const out = finalizeEnding({ state: { ...r.state, pending, log: [...state.log, action] }, events: r.events, pending })
  return { state: out.state, events: out.events, pending: out.state.pending }
}

/** Exactly the checks step runs; no mutation (the reducer is pure, so this is the step without keeping its result). */
export function validate(state: GameState, action: Action): Rejection | null {
  return step(state, action).rejection ?? null
}

/** Answers to state.pending that pass full validation. NEVER empty while a decision is open (00 §5). */
export function legalActions(state: GameState): Action[] {
  ensureWired()
  const pd = state.pending
  switch (state.phase) {
    case 'setup': return setupLegalActions(state)
    case 'playerTurns': return legalPlayerTurnsActions(state)
    case 'colony': return legalColonyActions(state)
    case 'ended': return state.seatOrder.map((seat): Action => ({ type: 'ack', decisionId: pd.id, seat }))
  }
}

/** Folds step from createGame; the first rejection stops the fold and is returned. */
export function replay(setup: GameSetup, seed: string, bundle: DataBundle, actions: readonly Action[]): StepResult {
  let r = createGame(setup, seed, bundle)
  if (r.rejection) return r
  for (const a of actions) {
    const next = step(r.state, a)
    if (next.rejection) return next
    r = next
  }
  return r
}

export function save(state: GameState, label = ''): SaveFile {
  return {
    format: 1, engine: ENGINE_VERSION, dataVersion: state.dataVersion, setup: state.setup, seed: state.seed,
    actions: [...state.log], meta: { savedAt: new Date().toISOString(), label },
  }
}

/** load = replay; a data-version mismatch → E_DATA_VERSION. */
export function load(file: SaveFile, bundle: DataBundle): StepResult {
  if (!file || file.format !== 1 || !Array.isArray(file.actions)) return rejectedCreate(file?.setup ?? { seats: [], mainObjective: 'random' }, String(file?.seed ?? ''), bundle, rej('E_BAD_SETUP', 'not a save file'))
  if (file.dataVersion !== bundle.version) {
    return rejectedCreate(file.setup, file.seed, bundle, rej('E_DATA_VERSION', `the save was made with data ${file.dataVersion}, the bundle is ${bundle.version}`, { saved: file.dataVersion, bundle: bundle.version }))
  }
  return replay(file.setup, file.seed, bundle, file.actions)
}

/** The seat's view (view.ts). Deciders only ever see a view. */
export function view(state: GameState, seat: SeatId): SeatView { return projectView(state, seat) }

// ---------- query.* result shapes (00 §10): every number the UI or AI shows comes from here ----------
export interface CrisisReport {
  cardId: Id | null
  prevent: ItemSymbol[]
  needed: number // number of non-exiled, non-eliminated seats
  bonusAt: number // needed + 2
  cardsIn: number
  cardsBySeat: Record<SeatId, number>
  myPoints: number // the viewer's own contributions, +1 per matching symbol card, −1 otherwise
  minTotal: number // myPoints − (cards from other seats)
  maxTotal: number // myPoints + (cards from other seats)
  resolved: { total: number; prevented: boolean; bonus: boolean } | null
}
export interface FoodReport { survivorsAtColony: number; helpless: number; needed: number; supply: number; shortfall: number; starvationNow: number; moraleLossIfShort: number }
export interface ZombieForecast {
  perLocation: { location: LocationId; survivors: number; zombies: number }[]
  noise: { location: LocationId; tokens: number; pZombiePerToken: number; expected: number }[]
  colonyEmptySpaces: number
  expectedTotal: number
}
export interface DieRequirement {
  action: 'attack' | 'search' | 'ability' | 'any'
  need: number | null // null = any die
  dice: { dieId: DieId; value: number; ok: boolean; foodToReach: number }[]
  usable: boolean // some unused die (with affordable food) qualifies
}
export interface AttackSurvivorOdds { targetAttack: number; pHit: number; pKillTarget: number; stealsCard: boolean }
export interface ObjectiveProgressReport { objectiveId: Id; kind: 'main' | 'secret' | 'betrayal' | 'exiled'; complete: boolean; requiresMain: boolean; parts: { label: string; have: number; need: number }[] }
export interface SearchOdds { location: LocationId; remaining: number; pSymbol: Record<ItemSymbol, number>; seen: number }
export interface MoveTarget { location: LocationId; emptySpaces: number; zombies: number; exposure: ExposureOdds }
export interface VoteForecast { target: SeatId; eligible: SeatId[]; needed: number; tiebreakBy: SeatId }

const baseExposure = (): ExposureOdds => ({
  blank: EXPOSURE_FACE_COUNT.blank / 12, wound: EXPOSURE_FACE_COUNT.wound / 12, frostbite: EXPOSURE_FACE_COUNT.frostbite / 12, bite: EXPOSURE_FACE_COUNT.bite / 12, pDeath: EXPOSURE_FACE_COUNT.bite / 12,
})
const ITEM_SYMBOLS: readonly ItemSymbol[] = ['weapon', 'fuel', 'education', 'food', 'medicine', 'tool', 'survivor']
const SPEND_FOOD_MAX = 6

export const query = {
  /** Crisis points so far from the viewer's knowledge: own cards are known, other seats' cards count as ±1 (00 §10). */
  crisis(v: SeatView): CrisisReport { return crisisReportFromView(v) },
  /** Food the colony phase will need and what happens if it is short (E.4 step 1, F 6.1.1). */
  foodNeeded(v: SeatView): FoodReport {
    const colony = v.locations['colony']!
    const survivorsAtColony = Object.values(v.survivors).filter((s) => s.status === 'alive' && s.location === 'colony').length
    const mouths = survivorsAtColony + colony.helpless
    const needed = Math.ceil(mouths / 2)
    const shortfall = Math.max(0, needed - v.food)
    return {
      survivorsAtColony, helpless: colony.helpless, needed, supply: v.food, shortfall, starvationNow: v.starvation,
      moraleLossIfShort: shortfall > 0 ? v.starvation + 1 : 0,
    }
  },
  /** Zombies the next colony phase adds, location by location, plus the noise rolls (E.4 step 4). */
  zombiesToAdd(v: SeatView): ZombieForecast {
    const alive = Object.values(v.survivors).filter((s) => s.status === 'alive')
    const perLocation = v.locationOrder.map((location) => {
      const loc = v.locations[location]!
      const survivors = alive.filter((s) => s.location === location).length + loc.helpless
      const zombies = location === 'colony' ? Math.ceil(survivors / 2) : survivors
      return { location, survivors, zombies }
    })
    const noise = v.locationOrder.filter((l) => (v.locations[l]!.noise ?? 0) > 0).map((location) => {
      const tokens = v.locations[location]!.noise
      return { location, tokens, pZombiePerToken: 0.5, expected: tokens * 0.5 }
    })
    const colony = v.locations['colony']!
    const colonyEmptySpaces = colony.entrances.reduce((a, e) => a + Math.max(0, colony.capacity.entranceSpaces - e.zombies - e.barricades), 0)
    return { perLocation, noise, colonyEmptySpaces, expectedTotal: perLocation.reduce((a, p) => a + p.zombies, 0) + noise.reduce((a, n) => a + n.expected, 0) }
  },
  /** The die a survivor needs for an action and which of the seat's dice qualify, with the food each would need (E.5, E.6). */
  dieRequirement(v: SeatView, survivorId: SurvivorId, action: DieRequirement['action'], abilityId?: Id): DieRequirement {
    const st = stateFromView(v)
    const sv = st.survivors[survivorId]
    const seat = sv?.owner ?? v.seat
    let need: number | null = null
    if (sv && (action === 'attack' || action === 'search')) need = needFor(st, survivorId, action)
    else if (sv && action === 'ability' && abilityId) { const d = findDescriptor(st, survivorId, abilityId); need = d ? dieNeed(st, d) : null }
    const canFeed = !!st.seats[seat] && !st.seats[seat]!.seat.exiled && !isForbidden(st, 'spendFood', { seat })
    const dice = (st.seats[seat]?.dice ?? []).map((d) => {
      const ok = !d.used && (need === null || d.value >= need)
      const foodToReach = ok || need === null ? 0 : Math.max(0, need - d.value)
      return { dieId: d.id, value: d.value, ok, foodToReach }
    })
    const usable = dice.some((d, i) => {
      const die = st.seats[seat]!.dice[i]!
      if (die.used) return false
      if (d.ok) return true
      return canFeed && d.foodToReach > 0 && d.foodToReach <= v.food && die.value + d.foodToReach <= SPEND_FOOD_MAX
    })
    return { action, need, dice, usable }
  },
  /** Exposure odds for one roll on this survivor, abilities and effects applied (Sparky, Harman Brooks, Rod Miller), and the chance that roll kills them given their wounds (E.7). */
  exposureOdds(v: SeatView, survivorId: SurvivorId, reason: ExposureReason = 'zombieKill'): ExposureOdds {
    return exposureOddsFor(stateFromView(v), survivorId, reason)
  },
  /** The raw die, no abilities: 6/3/2/1 faces of 12. */
  exposureBase(): ExposureOdds { return baseExposure() },
  /** Attacking a survivor: the spent die is rolled; a hit needs roll ≤ the target's attack value (E.5). */
  attackSurvivorOdds(v: SeatView, _attackerId: SurvivorId, targetId: SurvivorId): AttackSurvivorOdds {
    const st = stateFromView(v)
    const t = st.survivors[targetId]
    if (!t) throw new EngineInvariantError(`attackSurvivorOdds: unknown survivor ${targetId}`)
    const handCount = t.owner ? v.seats[t.owner]?.handCount ?? 0 : 0
    return attackSurvivorOddsOf({ targetAttack: statsOf(st, targetId).attack, targetWounds: t.wounds, targetFrostbite: t.frostbite, threshold: deathThreshold(st, targetId), targetHandCount: handCount })
  },
  /** Kill probability of a zombie attack: 1 when a qualifying die exists (zombie attacks never miss); the exposure roll is the cost. */
  zombieKillOdds(v: SeatView, survivorId: SurvivorId, location: LocationId, entrance: EntranceIndex): { pKill: number; exposure: ExposureOdds } {
    const st = stateFromView(v)
    const sv = st.survivors[survivorId]
    const e = st.locations[location]?.entrances.find((x) => x.index === entrance)
    const there = !!sv && sv.status === 'alive' && sv.location === location && !!e && e.zombies > 0
    const pKill = there && query.dieRequirement(v, survivorId, 'attack').usable ? 1 : 0
    return { pKill, exposure: sv ? exposureOddsFor(st, survivorId, 'zombieKill') : baseExposure() }
  },
  /** Progress on the viewer's secret (or exiled) objective and on the main objective; other seats' objectives only after the game ends. */
  objectiveProgress(v: SeatView, objectiveId?: Id): ObjectiveProgressReport { return objectiveProgressFromView(v, objectiveId) },
  /**
   * Chance that the next card drawn at a location carries a symbol (AI, H.2): the deck's printed composition less the visible
   * cards that can only have come from this deck (a definition printed in two decks is never subtracted, so the estimate
   * stays conservative); with nothing left to count, the printed mix.
   */
  searchOdds(v: SeatView, location: LocationId): SearchOdds {
    const bundle = bundleFor(v)
    const loc = recordOf<LocationRec>(bundle, location)
    const deckRec = loc?.deck ? recordOf<DeckRec>(bundle, loc.deck) : undefined
    const composition = deckRec ? expandDeck(deckRec) : []
    const remaining = v.locations[location]?.deckCount ?? 0
    const seen = Math.max(0, composition.length - remaining)
    const inOtherDecks = new Set<string>()
    for (const d of recordsOfKind<DeckRec>(bundle, 'deck')) if (d.id !== deckRec?.id) for (const c of d.cards) inOtherDecks.add(c.item)
    const symbolOf = (defId: string): ItemSymbol[] => symbolsOf(bundle.byId[defId])
    const printed: Record<string, number> = {}
    const unique = new Set(composition.filter((d) => !inOtherDecks.has(d)))
    for (const defId of composition) for (const s of symbolOf(defId)) printed[s] = (printed[s] ?? 0) + 1
    const gone: Record<string, number> = {}
    for (const inst of Object.values(v.cards)) if (unique.has(inst.defId)) for (const s of symbolOf(inst.defId)) gone[s] = (gone[s] ?? 0) + 1
    const left: Record<string, number> = {}
    let total = 0
    for (const s of ITEM_SYMBOLS) { left[s] = Math.max(0, (printed[s] ?? 0) - (gone[s] ?? 0)); total += left[s]! }
    const pSymbol = {} as Record<ItemSymbol, number>
    for (const s of ITEM_SYMBOLS) pSymbol[s] = remaining === 0 ? 0 : total > 0 ? left[s]! / total : composition.length > 0 ? (printed[s] ?? 0) / composition.length : 0
    return { location, remaining, pSymbol, seen }
  },
  /** Where a survivor may move now and the exposure each move would cost (E.6). */
  moveTargets(v: SeatView, survivorId: SurvivorId): MoveTarget[] { return moveTargetsFor(stateFromView(v), survivorId) },
  /** Who votes, how many yes votes exile, and who breaks a tie (E.6). */
  voteForecast(v: SeatView, target: SeatId): VoteForecast { return voteForecastFor(stateFromView(v), target) },
}

// ---------- describe (prompt text helpers; no rules arithmetic, numbers come from query) ----------
export interface DescribedLine { label: string; value: string; detail?: string }
export const describe = {
  percent(p: number): string { return `${Math.round(Math.max(0, Math.min(1, p)) * 100)}%` },
  exposure(o: ExposureOdds): DescribedLine[] {
    return [
      { label: 'Wound', value: describe.percent(o.wound) },
      { label: 'Frostbite', value: describe.percent(o.frostbite) },
      { label: 'Bite', value: describe.percent(o.bite), detail: `dies ${describe.percent(o.pDeath)}` },
    ]
  },
  /** A short title per decision kind, in our own words (the client's fallback heading). */
  decision(pd: PendingDecision): string {
    switch (pd.kind) {
      case 'chooseSurvivors': return 'pick your survivors'
      case 'chooseLeader': return 'pick your group leader'
      case 'turnAction': return 'take an action'
      case 'searchKeepOrNoise': return 'keep this card or make noise for another'
      case 'searchKeepWhich': return 'keep one of the cards you drew'
      case 'crisisContribution': return 'add cards to the crisis'
      case 'requestResponse': return 'give a card or decline'
      case 'crossroadsOption': return 'a crossroads: choose'
      case 'biteSpreadOption': return 'the bite spreads: kill or roll'
      case 'newLeader': return 'pick a new leader'
      case 'exilePlacement': return 'place your exiled survivors'
      case 'votes': return 'vote to exile'
      case 'objectiveChoice': return 'objective: choose'
      case 'itemTarget': return 'pick a target for the item'
      case 'effectChoice': return 'make a choice'
      case 'gameOver': return 'game over'
      default: return String(pd.kind)
    }
  },
}
