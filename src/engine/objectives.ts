// Objectives (spec 11): evaluating the main, secret, betrayal and exiled objectives, their progress numbers, win evaluation per
// seat (O6, R17.5) and THE ending routine (R17). Pure: state in, state + events out. The engine owns every number the UI shows:
// `objectiveProgressFromView` is what `query.objectiveProgress` returns (index.ts is frozen, so it is exported from here).
import type { GameEvent } from './events'
import type { ConditionNode, HookContext } from './hooks'
import type { ObjectiveProgressReport } from './index'
import { bundleFor } from './bundles'
import { CODE_HOOKS, extraVictory } from './code-hooks'
import { defOf, evaluateCondition, objectiveNeed, recOf, setRoutines, symbolsOf, type Rec } from './effects'
import { isCoop } from './setup'
import type {
  CardId, GameEndReason, GameState, Id, ItemSymbol, PendingDecision, SeatId, SeatState,
} from './types'
import type { SeatView } from './view'

export interface GoalPart { label: string; have: number; need: number }
export interface GoalStatus { complete: boolean; parts: GoalPart[] }
export interface SeatGoal {
  kind: 'main' | 'secret' | 'betrayal' | 'exiled'
  objectiveId: Id
  requiresMain: boolean
  node: ConditionNode | undefined
}
export interface EndOut { state: GameState; events: GameEvent[]; pending: PendingDecision }

// ---------- counters ----------
/** A main-objective counter (public) or, with `seat`, a secret objective's private counter. */
export function counterValue(state: GameState, counter: string, seat?: SeatId): number {
  if (seat) {
    const priv = state.effects.find((e) => e.name === `counter:${counter}` && e.ownerSeat === seat)
    if (priv) return Number(priv.data?.value ?? 0)
  }
  return state.objective.counters[counter] ?? 0
}

// ---------- evaluating a condition tree (spec 21 §3 plus the objective code hooks) ----------
const ctxOf = (state: GameState, seat: SeatId): HookContext => ({ state, point: 'game.end', seat })

/** `{all|any|not}` recursion first (so a `{code}` child reaches the OBJECTIVE registry), leaves through the shared interpreter. */
export function evalGoalNode(state: GameState, seat: SeatId, node: ConditionNode | undefined): boolean {
  if (!node) return false
  if ('all' in node) return node.all.every((n) => evalGoalNode(state, seat, n))
  if ('any' in node) return node.any.some((n) => evalGoalNode(state, seat, n))
  if ('not' in node) return !evalGoalNode(state, seat, node.not)
  if ('code' in node) {
    const hook = CODE_HOOKS.objectives[node.code]
    if (hook) return hook(state, seat, node.params).complete
  }
  return evaluateCondition(ctxOf(state, seat), node)
}

const humanize = (s: string): string => s.replace(/([A-Z])/g, ' $1').toLowerCase()
const handSymbolCount = (state: GameState, seat: SeatId, symbol: ItemSymbol | undefined): number =>
  (state.seats[seat]?.hand ?? []).filter((c: CardId) => !symbol || symbolsOf(defOf(state, c)).includes(symbol)).length
const barricadesAt = (state: GameState, loc: string | undefined): number =>
  (loc ? [loc] : state.locationOrder).reduce((n, l) => n + (state.locations[l]?.entrances.reduce((a, e) => a + e.barricades, 0) ?? 0), 0)

function leafPart(state: GameState, seat: SeatId, node: Extract<ConditionNode, { test: string }>): GoalPart {
  const ok = evalGoalNode(state, seat, node)
  const v = node.value
  const num = typeof v === 'number' ? v : Number(typeof v === 'object' && v ? (v as { need?: number }).need : v)
  const label = [humanize(node.test), node.symbol, node.location].filter(Boolean).join(' ')
  const part = (have: number, need: number): GoalPart => ({ label, have, need })
  switch (node.test) {
    case 'objectiveCounterAtLeast': {
      const name = typeof v === 'object' && v ? (v as { counter: string }).counter : String(v)
      return { label: name, have: counterValue(state, name, seat), need: objectiveNeed(state, name) }
    }
    case 'moraleAtLeast': case 'moraleAtMost': return part(state.morale, num)
    case 'foodAtLeast': case 'foodAtMost': return part(state.food, num)
    case 'roundsLeftAtMost': case 'roundsLeftAtLeast': return part(state.roundsLeft, num)
    case 'starvationAtLeast': return part(state.starvation, num)
    case 'wasteAtLeast': return part(state.waste.length, num)
    case 'handAtLeast': case 'handAtMost': return part(state.seats[seat]?.hand.length ?? 0, num)
    case 'handHasSymbol': return part(handSymbolCount(state, seat, node.symbol), Number(v ?? 1))
    case 'barricadesAtLeast': return part(barricadesAt(state, node.location), num)
    case 'survivorsAtLeast': case 'survivorsAtMost':
      return part((state.seats[seat]?.survivors ?? []).filter((id) => state.survivors[id]?.status === 'alive').length, num)
    default: return part(ok ? 1 : 0, 1)
  }
}

/** The parts the UI and the bots show for a condition tree; a registered objective hook supplies its own. */
export function partsOf(state: GameState, seat: SeatId, node: ConditionNode | undefined): GoalPart[] {
  if (!node) return []
  if ('all' in node) return node.all.flatMap((n) => partsOf(state, seat, n))
  if ('any' in node) return node.any.flatMap((n) => partsOf(state, seat, n))
  if ('not' in node) return [{ label: `not (${partsOf(state, seat, node.not).map((p) => p.label).join(', ')})`, have: evalGoalNode(state, seat, node) ? 1 : 0, need: 1 }]
  if ('code' in node) {
    const hook = CODE_HOOKS.objectives[node.code]
    if (hook) return hook(state, seat, node.params).parts
    return [{ label: node.code, have: evalGoalNode(state, seat, node) ? 1 : 0, need: 1 }]
  }
  return [leafPart(state, seat, node)]
}

// ---------- the main objective ----------
export function mainObjectiveNode(state: GameState): ConditionNode | undefined {
  const side = (recOf(state, state.objective.id) as Rec | undefined)?.sides?.[state.objective.side]
  const base = side?.complete as ConditionNode | undefined
  const extra = extraVictory(state) as ConditionNode[]
  return base && extra.length ? { all: [base, ...extra] } : base // Army, The Deputy: victory conditions added to the printed one
}
/** The seat whose context the main objective is read in (conditions that name "the seat" read the active one). */
const readerSeat = (state: GameState): SeatId => state.activeSeat ?? state.firstSeat

/** Is the main objective's condition met right now? (Step 5 stores the answer in `objective.complete`; this never writes.) */
export function mainObjectiveStatus(state: GameState): GoalStatus {
  const node = mainObjectiveNode(state)
  const seat = readerSeat(state)
  return { complete: evalGoalNode(state, seat, node), parts: partsOf(state, seat, node) }
}

/** Colony step 5 (R4.13): emits ObjectiveChecked; a met condition sets `objective.complete` and returns true. */
export function checkMainObjective(state: GameState): { state: GameState; events: GameEvent[]; complete: boolean } {
  const st = mainObjectiveStatus(state)
  const events: GameEvent[] = [{ type: 'ObjectiveChecked', objectiveId: state.objective.id, complete: st.complete }]
  if (!st.complete) return { state, events, complete: false }
  events.push({ type: 'ObjectiveComplete', objectiveId: state.objective.id, seat: null })
  return { state: { ...state, objective: { ...state.objective, complete: true } }, events, complete: true }
}

// ---------- a seat's own goal (O6) ----------
/** Replaces the first child of a betrayal card's `{all:[...]}` node (O5.2, O7.5). Any other shape is returned unchanged. */
export function swapFirstCondition(node: ConditionNode | undefined, first: ConditionNode | undefined): ConditionNode | undefined {
  if (!node || !first || !('all' in node) || node.all.length === 0) return node
  return { all: [first, ...node.all.slice(1)] }
}

export function seatGoal(state: GameState, seat: SeatId): SeatGoal | null {
  const st = state.seats[seat]
  if (!st) return null
  if (isCoop(state.setup)) return { kind: 'main', objectiveId: state.objective.id, requiresMain: false, node: mainObjectiveNode(state) }
  const secret = st.secretObjectiveId ? (recOf(state, st.secretObjectiveId) as Rec | undefined) : undefined
  const exiled = st.seat.exiled && st.exiledObjectiveId ? (recOf(state, st.exiledObjectiveId) as Rec | undefined) : undefined
  if (exiled) {
    if (secret?.type === 'betrayal') {
      return { kind: 'betrayal', objectiveId: exiled.id, requiresMain: !!secret.requiresMain, node: swapFirstCondition(secret.complete, exiled.betrayer?.firstCondition) }
    }
    return { kind: 'exiled', objectiveId: exiled.id, requiresMain: !!exiled.requiresMain, node: exiled.complete }
  }
  if (secret) return { kind: secret.type === 'betrayal' ? 'betrayal' : 'secret', objectiveId: secret.id, requiresMain: !!secret.requiresMain, node: secret.complete }
  return null
}

export interface SeatStatus extends GoalStatus { goal: SeatGoal | null }
/** Whether a seat's goal is met now, with the parts (the main objective shows as a part when the card requires it). */
export function seatStatus(state: GameState, seat: SeatId): SeatStatus {
  const goal = seatGoal(state, seat)
  if (!goal) return { goal, complete: false, parts: [] }
  if (goal.kind === 'main') return { goal, complete: state.objective.complete, parts: [{ label: 'Main objective', have: state.objective.complete ? 1 : 0, need: 1 }] }
  const own = evalGoalNode(state, seat, goal.node)
  const parts = partsOf(state, seat, goal.node)
  if (goal.requiresMain) parts.unshift({ label: 'Main objective', have: state.objective.complete ? 1 : 0, need: 1 })
  return { goal, complete: own && (!goal.requiresMain || state.objective.complete), parts }
}

/** R17.5 / O6: who wins if the game ended now. Eliminated seats never win. */
export function evaluateWinners(state: GameState): SeatId[] {
  return state.seatOrder.filter((id) => !state.seats[id]!.seat.eliminated && seatStatus(state, id).complete)
}

// ---------- the ending (R17) ----------
const gameOverPending = (state: GameState): PendingDecision =>
  ({ id: `d:${state.decisionSeq + 1}`, seat: 'all', kind: 'gameOver', window: 'game.end', context: {}, canPass: false })

/** THE ending routine: every in-flight context is dropped, winners and per-seat outcomes are computed, `gameOver` is raised. Idempotent once ended. */
export function endGame(state: GameState, reason: GameEndReason): EndOut {
  if (state.phase === 'ended') return { state, events: [], pending: state.pending }
  let s: GameState = reason === 'objectiveComplete' ? { ...state, objective: { ...state.objective, complete: true } } : state
  const winners = reason === 'concession' ? [] : evaluateWinners(s) // RULING: concession = nobody wins (R17.4, 00 §16), END-008 is superseded
  const seats: Record<SeatId, SeatState> = {}
  for (const id of s.seatOrder) seats[id] = { ...s.seats[id]!, outcome: winners.includes(id) ? 'won' : 'lost' }
  const events: GameEvent[] = []
  if (!isCoop(s.setup)) for (const id of winners) { const g = seatGoal(s, id); if (g) events.push({ type: 'ObjectiveComplete', objectiveId: g.objectiveId, seat: id }) }
  events.push({ type: 'GameEnded', reason, objectiveComplete: s.objective.complete, winners, morale: s.morale, roundsLeft: s.roundsLeft })
  const pending = gameOverPending(s)
  s = {
    ...s, seats, phase: 'ended', decisionSeq: s.decisionSeq + 1, pending, turn: null,
    attack: null, search: null, request: null, bite: null, vote: null, exile: null,
    result: { reason, objectiveComplete: s.objective.complete, winners },
  }
  return { state: s, events, pending }
}

/**
 * Other modules end the game themselves (exposure.ts at morale 0 does not know the winners). Run any step result through this and
 * an ended game that has no outcomes yet gets them, and its GameEnded event the real winners. Idempotent.
 */
export function finalizeEnding<T extends { state: GameState; events: GameEvent[] }>(r: T): T {
  const s = r.state
  if (s.phase !== 'ended' || !s.result) return r
  if (s.seatOrder.every((id) => s.seats[id]!.outcome !== undefined)) return r
  const winners = s.result.reason === 'concession' ? [] : evaluateWinners(s)
  const seats: Record<SeatId, SeatState> = {}
  for (const id of s.seatOrder) seats[id] = { ...s.seats[id]!, outcome: winners.includes(id) ? 'won' : 'lost' }
  const result = { reason: s.result.reason, objectiveComplete: s.objective.complete, winners }
  const events = r.events.map((e): GameEvent => (e.type === 'GameEnded' ? { ...e, winners, objectiveComplete: s.objective.complete } : e))
  return { ...r, state: { ...s, seats, result }, events }
}

// The effects interpreter ends the game through this seam (`op:'endGame'`, `roundTrack`, morale 0); install the real routine.
setRoutines({ endGame })

// ---------- query.objectiveProgress (00 §10) ----------
/** A GameState-shaped projection of a view, enough for condition evaluation and the query.* helpers; hands/ids are the viewer's own (or the recap's after the end). */
export function stateFromView(v: SeatView): GameState {
  const recap = v.phase === 'ended' ? v.recap : undefined
  const seats: Record<SeatId, SeatState> = {}
  for (const id of v.seatOrder) {
    const p = v.seats[id]!
    const mine = id === v.seat
    seats[id] = {
      seat: p.seat, hand: mine ? v.me.hand : recap?.hands[id] ?? [],
      secretObjectiveId: mine ? v.me.secretObjectiveId : recap?.secretObjectives[id]?.secret ?? null,
      exiledObjectiveId: mine ? v.me.exiledObjectiveId : recap?.secretObjectives[id]?.exiled ?? null,
      offered: [], dice: p.dice, survivors: p.survivors, leaderId: p.leaderId, abilityUses: p.abilityUses, ...(p.outcome ? { outcome: p.outcome } : {}),
    }
  }
  // the deck's cards are hidden but its size is public: placeholders keep deck-count conditions true to the table (Raiding Party, OBJ-022)
  const locations = Object.fromEntries(Object.entries(v.locations).map(([id, l]) => [id, { ...l, deck: Array.from({ length: l.deckCount }, (_, i) => `hidden:${id}:${i}`) as CardId[] }]))
  return { ...v, seats, locations, log: [], seed: '', rng: [0, 0, 0, 0], rollSeq: 0, decisionSeq: 0, cardSeq: 0, effectSeq: 0, survivorDeck: [], crisisDeck: [], exiledObjectiveDeck: [] } as unknown as GameState
}

const reportOf = (kind: ObjectiveProgressReport['kind'], objectiveId: Id, st: GoalStatus, requiresMain: boolean): ObjectiveProgressReport =>
  // progress is shown from zero: a margin that is behind (Leader: -1 of 1) reads as 0 (the condition itself still compares the real number)
  ({ objectiveId, kind, complete: st.complete, requiresMain, parts: st.parts.map((p) => (p.have < 0 ? { ...p, have: 0 } : p)) })

/** The main objective's parts (any viewer), or the viewer's own secret/exiled objective by id. Another seat's id before the end throws (OBJ-006). */
export function objectiveProgressFromView(v: SeatView, objectiveId?: Id): ObjectiveProgressReport {
  bundleFor(v) // the records must be registered; throws otherwise
  const st = stateFromView(v)
  if (!objectiveId || objectiveId === v.objective.id) {
    const seat = v.activeSeat ?? v.firstSeat
    return reportOf('main', v.objective.id, { complete: v.objective.complete || evalGoalNode(st, seat, mainObjectiveNode(st)), parts: partsOf(st, seat, mainObjectiveNode(st)) }, false)
  }
  const owner = v.seatOrder.find((id) => {
    const s = st.seats[id]!
    return (id === v.seat || v.phase === 'ended') && (s.secretObjectiveId === objectiveId || s.exiledObjectiveId === objectiveId)
  })
  if (!owner) throw new Error(`objective ${objectiveId} is not visible to seat ${v.seat}`)
  const status = seatStatus(st, owner)
  return reportOf(status.goal?.kind ?? 'secret', status.goal?.objectiveId ?? objectiveId, status, !!status.goal?.requiresMain)
}

/** The viewer's own goal (null in co-op or when none) next to the main objective, for the secret-objective panel and the bots. */
export function ownObjectiveProgress(v: SeatView): { main: ObjectiveProgressReport; own: ObjectiveProgressReport | null } {
  const main = objectiveProgressFromView(v)
  const st = stateFromView(v)
  const goal = seatGoal(st, v.seat)
  if (!goal || goal.kind === 'main') return { main, own: null }
  const status = seatStatus(st, v.seat)
  return { main, own: reportOf(goal.kind, goal.objectiveId, status, goal.requiresMain) }
}
