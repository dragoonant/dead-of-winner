/**
 * FROZEN CONTRACT (M0). The per-seat view: the ONLY thing deciders (human UI and bots) receive.
 * Spec: docs/spec/00-architecture.md §00.6. Leak tests: VIEW-001..020, SIM-007.
 */
import type { Visibility, EngineEvent, SeatEvent } from './events'
import type { Answer } from './actions'
import { HIDDEN_SOURCE_KEY } from './types'
import type {
  CardInstanceId, ContentId, CrisisOutcome, DecisionContext, DecisionKind, Die,
  GameResult, GameState, ItemDeckId, ItemSymbol, LastingEffect, LocationId, Phase, ColonyStep,
  PreventSymbol, SeatId, SeatKind, SurvivorInstanceId, VoteRecord,
} from './types'
import type { FaceOdds } from './odds'

export interface SeatPublic {
  id: SeatId
  kind: SeatKind
  name: string
  persona: string | null
  exiled: boolean
  eliminated: boolean
  handCount: number
  /** Dice are public at the table (Ruling A-DICE). */
  dice: Die[]
  /** Face-down crisis cards this seat added this round. Public count, never which cards (VIEW-004; 00.6.3). */
  contributed: number
}

export interface CardView { id: CardInstanceId; recordId: ContentId }

export interface SurvivorView {
  id: SurvivorInstanceId
  recordId: ContentId
  seat: SeatId
  location: LocationId
  isLeader: boolean
  wounds: number
  frostbite: number
  /** Equipped cards are face up on the table. */
  equipped: CardView[]
  movedThisTurn: boolean
}

export interface LocationView {
  id: LocationId
  survivorSpaces: number
  freeSurvivorSpaces: number
  entrances: { n: number; spaces: number; zombies: number; barricades: number }[]
  noise: number
  helpless: number
  /** Count only (VIEW-007). Colony: 0. */
  deckCount: number
}

/** Engine-computed numbers the UI must not derive itself (10.0.8; 50.6). */
export interface ViewNumbers {
  players: number
  colonySurvivors: number
  foodNeeded: number
  wasteCount: number
  wasteMoraleStep: number
  wasteMoraleLoss: number
  crisisPrevent: number
  crisisBonus: number
  /** Colony phase preview per location: zombies from occupants, plus noise tokens (each 50%). */
  zombiesIncoming: Record<LocationId, { fromSurvivors: number; noiseTokens: number }>
  mainTarget: number | null
}

/** The open decision as one seat sees it. Context and legal answers only for answerers. */
export interface ViewDecision {
  id: number
  kind: DecisionKind
  seat: SeatId | 'all'
  answerers: SeatId[]
  /** True when the viewing seat must answer this decision. */
  yours: boolean
  /** Present iff yours (VIEW-008, VIEW-011). */
  context?: DecisionContext
  /** Present iff yours; never empty then (00.4.2). For seat 'all' these are Ballots. */
  legal?: Answer[]
  /** Present iff yours: one engine-computed preview per `legal` entry, same order (50.6.4; 00.8.3). */
  annotations?: ActionPreview[]
}

/** One clause of the viewing seat's own secret/exiled objective, computed by the engine (50.6). */
export interface ObjectiveStatus {
  /** Clause key from the objective record, e.g. 'hand.medicine'. */
  clause: string
  /** Label key for the UI (i18n-style), not prose. */
  label: string
  current: number
  target: number
  met: boolean
}

export interface PlayerView {
  seat: SeatId
  bundleHash: string
  phase: Phase
  colonyStep: ColonyStep | null
  round: number
  roundsLeft: number
  morale: number
  moraleMax: number
  food: number
  starvation: number
  firstPlayer: SeatId
  activeSeat: SeatId | null
  seats: SeatPublic[]
  survivors: SurvivorView[]
  locations: LocationView[]
  deckCounts: { crisis: number; survivors: number; crossroads: number; exiledObjectives: number; items: Record<ItemDeckId, number> }
  /** Waste pile: count plus the top card, face up. */
  waste: { count: number; top: CardView | null }
  crisis: { id: ContentId; prevent: PreventSymbol[]; contributed: number } | null
  lastCrisis: { id: ContentId; total: number; symbols: Partial<Record<ItemSymbol, number>>; outcome: CrisisOutcome } | null
  main: { id: ContentId; progress: Record<string, number>; target: number | null }
  /** Effects from hidden objectives show sourceKey HIDDEN_SOURCE_KEY to non-owners (lastingForSeat). */
  lasting: LastingEffect[]
  numbers: ViewNumbers
  /** The viewing seat's private zone. */
  you: {
    hand: CardView[]
    secretObjective: ContentId | null
    exiledObjective: ContentId | null
    /** Progress on this seat's own secret (or exiled) objective, clause by clause. */
    objectiveStatus: ObjectiveStatus[]
    /** The Crossroads card this seat holds, if any (VIEW-006). */
    heldCrossroads: ContentId | null
    /** Cards drawn by this seat's in-progress search (VIEW-008). */
    searchDrawn: CardView[]
  }
  /** Whether someone holds a Crossroads card this turn (the holder is public, the card is not). */
  crossroadsHolder: SeatId | null
  decision: ViewDecision | null
  ended: GameResult | null
  /** Present only after GameEnded (10.13.3). */
  recap: Recap | null
}

export interface Recap {
  objectives: Record<SeatId, { secret: ContentId | null; exiled: ContentId | null; isBetrayal: boolean }>
  crises: { round: number; crisis: ContentId; contributions: { seat: SeatId; card: ContentId }[]; total: number; outcome: CrisisOutcome }[]
  crossroads: { round: number; activeSeat: SeatId; holder: SeatId; card: ContentId; triggered: boolean; option: string | null }[]
  votes: VoteRecord[]
}

/** Annotation for one legal answer (50.6.4): what the prompt says, with engine numbers. */
export interface ActionPreview {
  /** i18n-style label key plus params, e.g. {key:'search', params:{survivor, location, min:3}}. */
  label: { key: string; params: Record<string, string | number> }
  dieMin: number | null
  exposure: FaceOdds | null
  hitOdds: number | null
  location: LocationId | null
  target: string | null
}

/** A lasting effect as `seat` sees it: a hidden objective's source is masked for non-owners (00.6.8). */
export function lastingForSeat(effect: LastingEffect, seat: SeatId, revealAll = false): LastingEffect {
  if (revealAll || effect.hiddenOwner === null || effect.hiddenOwner === seat) return effect
  return { ...effect, sourceKey: HIDDEN_SOURCE_KEY }
}

/** Build `seat`'s view. Pure; the output is JSON-serializable and deterministic (VIEW-017). */
export type ViewFn = (state: GameState, seat: SeatId) => PlayerView

/**
 * Redact one event for one seat (00.7.2). Returns null when the seat must not receive it.
 * After the game ends (`revealAll`), every event is delivered whole.
 */
export function eventForSeat(event: EngineEvent, seat: SeatId, revealAll = false): SeatEvent | null {
  const vis: Visibility | undefined = event.vis
  if (revealAll || vis === undefined) return event
  if ('to' in vis) return vis.to.includes(seat) ? event : null
  if (vis.except.includes(seat)) return event
  const copy: Record<string, unknown> = { ...event }
  for (const f of vis.redact) delete copy[f]
  return copy as unknown as SeatEvent
}

/** Filter a batch of events for one seat, preserving order. */
export function eventsForSeat(events: readonly EngineEvent[], seat: SeatId, revealAll = false): SeatEvent[] {
  const out: SeatEvent[] = []
  for (const e of events) {
    const r = eventForSeat(e, seat, revealAll || e.type === 'GameEnded')
    if (r) out.push(r)
  }
  return out
}
