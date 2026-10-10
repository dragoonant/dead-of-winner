/**
 * FROZEN CONTRACT (M0). The engine's public API. Clients, the sim, tests and the AI import from
 * here only (60.3.1; 40.1.2). Spec: docs/spec/00-architecture.md §00.2.
 */
import { canonicalJson, type Action, type Answer, type Rejection } from './actions'
import type { TalkEntry } from './decider'
import type { EngineEvent, SeatEvent } from './events'
import { hashString } from './rng'
import type { DataBundle, GameConfig, GameState, PendingDecision, SeatId } from './types'
import { eventsForSeat, type ActionPreview, type PlayerView } from './view'

export * from './types'
export * from './actions'
export * from './events'
export * from './hooks'
export * from './rng'
export * from './decider'
export * from './view'
export * from './odds'

export const ENGINE_VERSION = '0.0.0-m0'

export interface StepOk {
  ok: true
  state: GameState
  /** Events produced by this step, in order, unredacted (store-only; deliver via eventsFor). */
  events: EngineEvent[]
  /** The one open decision, or null iff the game has ended. */
  decision: PendingDecision | null
}
export type StepResult = StepOk | Rejection

export interface SaveFile {
  engine: string
  bundleHash: string
  config: GameConfig
  /** Action log (answers in order) — replay reproduces the state exactly (SIM-008). */
  actions: Action[]
  stateHash: string
  /** Public talk log (41.5.1), so a resumed game can rebuild bot belief (40.1.4). Not engine state. */
  talk?: TalkEntry[]
}

export interface EngineOptions {
  /** Assert invariants after every step (SIM-001..006). Default false; the sim turns it on. */
  checkInvariants?: boolean
}

export interface Engine {
  readonly bundle: DataBundle
  /** Seeded setup up to the first decision (chooseSurvivors, or turnAction with skipSetupDecisions). */
  newGame(config: GameConfig): StepOk
  /** Apply one answer to the open decision. Illegal input returns a Rejection, never throws (C.3). */
  step(state: GameState, action: Action): StepResult
  pending(state: GameState): PendingDecision | null
  /** Legal answers for `seat` to the open decision; never empty when `seat` is an answerer (00.4.2). */
  legalActions(state: GameState, seat: SeatId): Answer[]
  view(state: GameState, seat: SeatId): PlayerView
  eventsFor(events: readonly EngineEvent[], seat: SeatId): SeatEvent[]
  /**
   * Helper: annotation for an answer from the view alone. Authoritative numbers are
   * ViewDecision.annotations, computed from state (code-hook modifiers need GameState; 00.8.3).
   */
  preview(view: PlayerView, answer: Answer): ActionPreview
  /** Final state after replaying the log; `events` holds only the last step's events. */
  replay(save: Pick<SaveFile, 'config' | 'actions'>): StepOk
  /** Every event of a replay (newGame plus each step), in order, unredacted (40.1.4 resume). */
  replayEvents(save: Pick<SaveFile, 'config' | 'actions'>): EngineEvent[]
  save(state: GameState): SaveFile
  load(save: SaveFile): GameState
}

export class NotImplementedError extends Error {
  constructor(what: string) {
    super(`not implemented: ${what} (M1)`)
    this.name = 'NotImplementedError'
  }
}

/** Stable hash of a state (canonical JSON). Replays compare it (SIM-008). */
export function stateHash(state: GameState): string {
  return hashString(canonicalJson(state))
}

/** Build an engine bound to one data bundle. The engine never imports data itself (C.3; 20.1.2). */
export function createEngine(bundle: DataBundle, options: EngineOptions = {}): Engine {
  void options
  const todo = (what: string): never => {
    throw new NotImplementedError(what)
  }
  return {
    bundle,
    newGame: () => todo('newGame'),
    step: () => todo('step'),
    pending: (state) => (state.ended ? null : state.pending),
    legalActions: () => todo('legalActions'),
    view: () => todo('view'),
    eventsFor: (events, seat) => eventsForSeat(events, seat),
    preview: () => todo('preview'),
    replay: () => todo('replay'),
    replayEvents: () => todo('replayEvents'),
    save: (state) => ({
      engine: ENGINE_VERSION,
      bundleHash: state.bundleHash,
      config: state.config,
      actions: state.log.map((e) => e.action as unknown as Action),
      stateHash: stateHash(state),
    }),
    load: () => todo('load'),
  }
}
