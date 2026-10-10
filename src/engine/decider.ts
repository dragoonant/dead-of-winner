/**
 * FROZEN CONTRACT (M0). The single Decider interface shared by the human UI and the bots (C.3).
 * A decider receives only its seat's view and the open decision as that seat sees it (C.4).
 * Spec: docs/spec/00-architecture.md §00.10.
 */
import type { Answer } from './actions'
import type { SeatEvent } from './events'
import type { JsonValue, SeatId } from './types'
import type { PlayerView, ViewDecision } from './view'

/** A public table-talk line (spec 41.5). Never engine state; never changes rules. */
export interface TalkEntry {
  seq: number
  round: number
  seat: SeatId | 'narrator'
  kind: string
  text: string
  data?: JsonValue
}

export interface DecideContext {
  /** Events delivered to this seat since its previous decide call, already redacted. */
  events: readonly SeatEvent[]
  /** Talk entries since the previous call (40.1.5). */
  talk: readonly TalkEntry[]
  /** Wall-clock budget for this decision in ms; 0 = no wall-clock cap (40.12). */
  budgetMs: number
}

export interface Decider {
  readonly seat: SeatId
  readonly kind: 'human' | 'bot'
  /**
   * Answer the open decision. Must return an element of `decision.legal` (deep equality,
   * actions.sameAnswer). For a seat:'all' decision return a Ballot for this seat.
   */
  decide(view: PlayerView, decision: ViewDecision, ctx: DecideContext): Answer | Promise<Answer>
  /** Optional: receive events and talk when this seat is not deciding (keeps belief current). */
  observe?(view: PlayerView, ctx: Omit<DecideContext, 'budgetMs'>): void
}

/** Env var for the per-decision AI wall-clock budget (CLAUDE.md; 40.12.2). */
export const AI_BUDGET_ENV = 'DOW_AI_BUDGET_MS'
/** Client build variant (Vite exposes only VITE_* vars). */
export const AI_BUDGET_ENV_VITE = 'VITE_DOW_AI_BUDGET_MS'
export const DEFAULT_AI_BUDGET_MS = 250

/**
 * Resolve the budget from an env-like record. Pure: the caller passes process.env (Node) or
 * import.meta.env (client) so the engine never touches globals. Invalid values -> default.
 */
export function resolveAiBudgetMs(env: Readonly<Record<string, string | undefined>> | undefined, override?: number): number {
  if (override !== undefined && Number.isFinite(override) && override >= 0) return Math.floor(override)
  const raw = env?.[AI_BUDGET_ENV] ?? env?.[AI_BUDGET_ENV_VITE]
  if (raw === undefined || raw.trim() === '') return DEFAULT_AI_BUDGET_MS
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_AI_BUDGET_MS
}

/**
 * Safe fallback answer (40.1.3; 50.4.4 watchdog): endTurn for a turn decision, else the first
 * legal answer. Throws if the decision is not this seat's (a caller bug, never a rules state).
 */
export function fallbackAnswer(decision: ViewDecision): Answer {
  const legal = decision.legal
  if (!decision.yours || !legal || legal.length === 0) throw new Error(`no legal answers for decision ${decision.id}`)
  if (decision.kind === 'turnAction') {
    const end = legal.find((a) => a.type === 'endTurn')
    if (end) return end
  }
  return legal[0] as Answer
}
