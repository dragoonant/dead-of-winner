// FROZEN after M0: the public engine API (00 §2, §10, §12). M1 wires the bodies to the rules modules.
// Bodies that are not yet built throw NotImplementedError; nothing here ever uses Math.random, Date (except save meta) or I/O.
import type { Action } from './actions'
import type {
  DataBundle, DieId, EntranceIndex, ExposureOdds, ExposureReason, GameSetup, GameState, Id, ItemSymbol, LocationId, PendingDecision, Rejection, SaveFile,
  SeatId, StepResult, SurvivorId,
} from './types'
import { EngineInvariantError, notImplemented } from './types'
import { EXPOSURE_FACE_COUNT } from './rng'
import { view as projectView, type SeatView } from './view'

export * from './types'
export * from './actions'
export * from './events'
export * from './hooks'
export * from './rng'
export * from './decider'
export * from './view'

export const ENGINE_VERSION = '0.1.0'

// ---------- data bundles ----------
// step(state, action) takes no bundle (frozen signature), so the engine keeps the bundles it has seen, keyed by version.
const BUNDLES = new Map<string, DataBundle>()
/** Make a bundle available to step()/validate()/legalActions()/query for states built from it. */
export function registerBundle(bundle: DataBundle): void { BUNDLES.set(bundle.version, bundle) }
export function bundleFor(stateOrView: { dataVersion: string }): DataBundle {
  const hit = BUNDLES.get(stateOrView.dataVersion)
  if (!hit) throw new EngineInvariantError(`no data bundle registered for version ${stateOrView.dataVersion}`)
  return hit
}

// ---------- reducer (00 §2) ----------
/** Builds the setup state, deals survivors, items and secret objectives from the seeded stream; the first pending is `chooseSurvivors` for the first seat. Bad setup → rejection E_BAD_SETUP, never a throw. */
export function createGame(_setup: GameSetup, _seed: string, bundle: DataBundle): StepResult {
  registerBundle(bundle)
  return notImplemented('createGame')
}
/** Pure reducer: one action → 0..n events → exactly one pending. Illegal action → the SAME state reference, [ActionRejected], a rejection. Throws only EngineInvariantError. */
export function step(_state: GameState, _action: Action): StepResult { return notImplemented('step') }
/** Exactly the checks step runs; no mutation. */
export function validate(_state: GameState, _action: Action): Rejection | null { return notImplemented('validate') }
/** Answers to state.pending that pass full validation. NEVER empty while a decision is open (00 §5). */
export function legalActions(_state: GameState): Action[] { return notImplemented('legalActions') }
/** Folds step from createGame; the first rejection stops the fold and is returned. */
export function replay(_setup: GameSetup, _seed: string, _bundle: DataBundle, _actions: readonly Action[]): StepResult { return notImplemented('replay') }
export function save(state: GameState, label = ''): SaveFile {
  return {
    format: 1, engine: ENGINE_VERSION, dataVersion: state.dataVersion, setup: state.setup, seed: state.seed,
    actions: [...state.log], meta: { savedAt: new Date().toISOString(), label },
  }
}
/** load = replay; a data-version mismatch → E_DATA_VERSION. */
export function load(_file: SaveFile, _bundle: DataBundle): StepResult { return notImplemented('load') }
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

export const query = {
  /** Crisis points so far from the viewer's knowledge: own cards are known, other seats' cards count as ±1 (00 §10). */
  crisis(_v: SeatView): CrisisReport { return notImplemented('query.crisis') },
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
  dieRequirement(_v: SeatView, _survivorId: SurvivorId, _action: DieRequirement['action'], _abilityId?: Id): DieRequirement { return notImplemented('query.dieRequirement') },
  /** Exposure odds for one roll on this survivor, abilities and effects applied (Sparky, Harman Brooks, Rod Miller), and the chance that roll kills them given their wounds (E.7). */
  exposureOdds(_v: SeatView, _survivorId: SurvivorId, _reason?: ExposureReason): ExposureOdds { return notImplemented('query.exposureOdds') },
  /** The raw die, no abilities: 6/3/2/1 faces of 12. */
  exposureBase(): ExposureOdds { return baseExposure() },
  /** Attacking a survivor: the spent die is rolled; a hit needs roll ≤ the target's attack value (E.5). */
  attackSurvivorOdds(_v: SeatView, _attackerId: SurvivorId, _targetId: SurvivorId): AttackSurvivorOdds { return notImplemented('query.attackSurvivorOdds') },
  /** Kill probability of a zombie attack: 1 when a qualifying die exists (zombie attacks never miss); the exposure roll is the cost. */
  zombieKillOdds(_v: SeatView, _survivorId: SurvivorId, _location: LocationId, _entrance: EntranceIndex): { pKill: number; exposure: ExposureOdds } { return notImplemented('query.zombieKillOdds') },
  /** Progress on the viewer's secret (or exiled) objective and on the main objective; other seats' objectives only after the game ends. */
  objectiveProgress(_v: SeatView, _objectiveId?: Id): ObjectiveProgressReport { return notImplemented('query.objectiveProgress') },
  /** Chance that the next card drawn at a location carries a symbol, from the deck's known composition minus the cards already seen (AI, H.2). */
  searchOdds(_v: SeatView, _location: LocationId): SearchOdds { return notImplemented('query.searchOdds') },
  /** Where a survivor may move now and the exposure each move would cost (E.6). */
  moveTargets(_v: SeatView, _survivorId: SurvivorId): MoveTarget[] { return notImplemented('query.moveTargets') },
  /** Who votes, how many yes votes exile, and who breaks a tie (E.6). */
  voteForecast(_v: SeatView, _target: SeatId): VoteForecast { return notImplemented('query.voteForecast') },
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
