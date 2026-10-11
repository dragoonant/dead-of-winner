// Crossroads (R12, E.10): draw at turn start for the active seat (the holder is the seat to the right), hold it secretly,
// evaluate its trigger after each resolved action (FAQ 2.1.1), offer its options, remove it; untriggered cards go to the bottom.
import type { ChooseCrossroadsOptionAction } from './actions'
import type { GameEvent } from './events'
import type { CrossroadsDescriptor, EffectNode } from './hooks'
import type { CrossroadsLogEntry, DecisionOption, GameState, PendingDecision, SeatId, WindowId } from './types'
import {
  type Acc, type ActionResult, type EvalCtx, type Job, type RunCtx, type WindowCtx, crossroadsDescriptor, evaluateCondition, hasSpace, mkAcc,
  recOf, reject, runJobs,
} from './effects'

export { afterAction } from './effects'

/** The seat to the right of `seat` (R12.1): the previous seat in clockwise order, skipping eliminated seats. With two seats, the other seat. */
export function seatToRight(state: GameState, seat: SeatId): SeatId {
  const order = state.seatOrder
  const i = order.indexOf(seat)
  for (let k = 1; k <= order.length; k++) {
    const s = order[(i - k + order.length * 2) % order.length]!
    if (!state.seats[s]!.seat.eliminated) return s
  }
  return seat
}

const logEntry = (state: GameState, e: Omit<CrossroadsLogEntry, 'roundNumber' | 'turnCount'>): CrossroadsLogEntry => ({ roundNumber: state.roundNumber, turnCount: state.turnCount, ...e })

/** Turn start (R4.4a): the seat to the right draws a Crossroads card for the active seat and holds it. No-op when one is held or the deck is empty. */
export function drawCrossroads(state: GameState, activeSeat: SeatId): { state: GameState; events: GameEvent[] } {
  const cx = state.crossroads
  if (cx.held || cx.deck.length === 0) return { state, events: [] }
  const [top, ...rest] = cx.deck
  const holder = seatToRight(state, activeSeat)
  return {
    state: { ...state, crossroads: { ...cx, deck: rest, held: { cardId: top!, holder, forSeat: activeSeat } } },
    events: [{ type: 'CrossroadsDrawn', holder, forSeat: activeSeat, cardId: top! }],
  }
}

/** Turn end (R4.6): an unrevealed held card goes to the bottom; its id stays hidden in the log until the recap. */
export function returnCrossroads(state: GameState): { state: GameState; events: GameEvent[] } {
  const cx = state.crossroads
  if (!cx.held) return { state, events: [] }
  const h = cx.held
  return {
    state: { ...state, crossroads: { ...cx, deck: [...cx.deck, h.cardId], held: null, log: [...cx.log, logEntry(state, { cardId: h.cardId, holder: h.holder, forSeat: h.forSeat, triggered: false })] } },
    events: [{ type: 'CrossroadsReturned', holder: h.holder, forSeat: h.forSeat, cardId: h.cardId }],
  }
}

const addsPopulation = (nodes: unknown): boolean => /"op":"(addSurvivor|addHelpless)"/.test(JSON.stringify(nodes ?? null))

/** What the action just did, read from the events of this step (M8): the survivor a Medicine healed, the survivors and helpless tokens an effect added. */
function enrich(acc: Acc, point: WindowId, ctx: WindowCtx): WindowCtx {
  const params: Record<string, unknown> = { ...(ctx.params ?? {}) }
  let targetId = ctx.targetId
  if (point === 'action.playCard' && !targetId) {
    const healed = [...acc.events].reverse().find((e) => e.type === 'WoundHealed')
    if (healed && healed.type === 'WoundHealed') targetId = healed.survivorId
  }
  const added = acc.events.flatMap((e) => (e.type === 'SurvivorAdded' ? [e.survivorId] : []))
  if (added.length) params['addedSurvivors'] = added
  const helpless = acc.events.reduce((n, e) => n + (e.type === 'HelplessAdded' ? e.count : 0), 0)
  if (helpless) params['addedHelpless'] = helpless
  return { ...ctx, ...(targetId ? { targetId } : {}), params }
}

/** The seat that makes the choice: the controller of the survivor the card names as its decider (Dynamite, Thomas Heart), else the active seat. */
function deciderSeat(state: GameState, desc: CrossroadsDescriptor, active: SeatId): SeatId {
  const sv = desc.decider ? state.survivors[desc.decider] : undefined
  return sv?.status === 'alive' && sv.owner && !state.seats[sv.owner]?.seat.eliminated ? sv.owner : active
}

function ctxFor(state: GameState, held: { forSeat: SeatId; holder: SeatId }, point: WindowId, ctx: WindowCtx): EvalCtx {
  return {
    state, point, seat: held.forSeat, ownerSeat: undefined, survivorId: ctx.survivorId, targetId: ctx.targetId, location: ctx.location,
    cardId: ctx.cardId, dieId: ctx.dieId, face: ctx.face, params: ctx.params,
  }
}

function optionLabel(state: GameState, cardId: string, optionId: string): string {
  return recOf(state, cardId)?.text?.options?.[optionId] ?? optionId
}

function runOption(acc: Acc, desc: CrossroadsDescriptor, optionId: string, forced: boolean, forSeat: SeatId, point: WindowId, ctx: WindowCtx, jobs: Job[]): void {
  const opt = desc.options.find((o) => o.id === optionId)
  acc.events.push({ type: 'CrossroadsResolved', cardId: desc.id, forSeat, optionId, forced })
  const cx = acc.state.crossroads
  acc.state = { ...acc.state, crossroads: { ...cx, active: null, log: cx.log.map((l, i) => (i === cx.log.length - 1 && l.cardId === desc.id ? { ...l, optionId } : l)) } }
  const rc: RunCtx = {
    sourceId: desc.id, sourceKind: 'crossroads', seat: deciderSeat(acc.state, desc, forSeat), point, subjectId: ctx.survivorId, targetId: ctx.targetId, location: ctx.location,
    cardId: ctx.cardId, dieId: ctx.dieId, face: ctx.face, params: ctx.params, duration: 'instant',
  }
  const nodes: EffectNode[] = opt?.effect ?? []
  jobs.unshift({ t: 'run', work: nodes.map((node, idx) => ({ node, idx, answers: [] })), rc, later: [] })
}

/**
 * Evaluate the held card after `point` resolved. A trigger makes the card face up and either resolves it at once
 * (one option possible, or none: R12.6) or raises `crossroadsOption` for the active seat. Called by the job runner.
 */
export function checkCrossroads(acc: Acc, point: WindowId, ctx0: WindowCtx, jobs: Job[]): void {
  const cx = acc.state.crossroads
  const held = cx.held
  if (!held || cx.active || acc.state.phase === 'ended') return
  const desc = crossroadsDescriptor(acc.state, held.cardId)
  // `action.any` (M8): a card that waits for a state of the table rather than one action is checked after every action window
  if (!desc || !(desc.point === point || (desc.point === 'action.any' && point.startsWith('action.')))) return
  const ctx = enrich(acc, point, ctx0)
  const ev = ctxFor(acc.state, held, point, ctx)
  if (!evaluateCondition(ev, desc.when)) return
  // R11.3 / R20.20: a card with an option that adds a survivor or helpless token does not trigger while the colony is full.
  if (addsPopulation(desc.options.map((o) => o.effect)) && !hasSpace(acc.state, 'colony')) return
  // vote cards carry the same table vote under both thumbs (Old Divisions, Outbreak ...): offer it once, and run it at once when it is all that is left
  let possible = desc.options.filter((o) => evaluateCondition(ev, o.requires))
  const firstVote = possible.find((o) => o.vote)
  if (firstVote) possible = possible.filter((o) => !o.vote || o === firstVote)
  acc.events.push({ type: 'CrossroadsTriggered', cardId: held.cardId, holder: held.holder, forSeat: held.forSeat, window: point })
  acc.state = {
    ...acc.state,
    crossroads: {
      ...cx, held: null, active: { cardId: held.cardId, holder: held.holder, forSeat: held.forSeat, window: point },
      log: [...cx.log, logEntry(acc.state, { cardId: held.cardId, holder: held.holder, forSeat: held.forSeat, triggered: true })],
    },
  }
  if (possible.length === 0) {
    acc.events.push({ type: 'CrossroadsResolved', cardId: held.cardId, forSeat: held.forSeat, optionId: '', forced: true })
    acc.state = { ...acc.state, crossroads: { ...acc.state.crossroads, active: null } }
    return
  }
  const decider = deciderSeat(acc.state, desc, held.forSeat)
  if (possible.length === 1) { runOption(acc, desc, possible[0]!.id, true, held.forSeat, point, ctx, jobs); return }
  const seq = acc.state.decisionSeq + 1
  const id = `d:${seq}`
  const options: DecisionOption[] = possible.map((o) => ({
    id: o.id, label: optionLabel(acc.state, held.cardId, o.id),
    action: { type: 'chooseCrossroadsOption', decisionId: id, seat: decider, optionId: o.id },
  }))
  const pending: PendingDecision = {
    id, seat: decider, kind: 'crossroadsOption', window: point,
    context: { cardId: held.cardId, seatId: held.holder, data: { code: 'crossroads', ctx } }, options, canPass: false,
  }
  acc.state = { ...acc.state, decisionSeq: seq, pending }
  acc.pending = pending
}

export function validateCrossroadsOption(state: GameState, a: ChooseCrossroadsOptionAction): ReturnType<typeof reject> | null {
  const pd = state.pending
  if (state.phase === 'ended') return reject(state, 'E_GAME_OVER', 'the game is over')
  if (a.decisionId !== pd.id || pd.kind !== 'crossroadsOption') return reject(state, 'E_WRONG_DECISION', 'no Crossroads choice is open')
  if (a.seat !== pd.seat) return reject(state, 'E_NOT_YOUR_DECISION', 'not your decision')
  if (!(pd.options ?? []).some((o) => o.id === a.optionId)) return reject(state, 'E_NOT_AN_OPTION', 'that option is not available')
  return null
}

/** Answer `crossroadsOption`: apply the chosen option's effects; the card leaves the game (R12.3). */
export function chooseCrossroadsOption(state: GameState, a: ChooseCrossroadsOptionAction): ActionResult {
  const bad = validateCrossroadsOption(state, a)
  if (bad) return bad
  const active = state.crossroads.active
  if (!active) return reject(state, 'E_WRONG_DECISION', 'no Crossroads card is face up')
  const desc = crossroadsDescriptor(state, active.cardId)
  if (!desc) return reject(state, 'E_BAD_PAYLOAD', 'unknown Crossroads card')
  const ctx = ((state.pending.context.data as { ctx?: WindowCtx } | undefined)?.ctx) ?? {}
  const acc = mkAcc(state)
  const jobs: Job[] = []
  runOption(acc, desc, a.optionId, false, active.forSeat, active.window, ctx, jobs)
  const pending = runJobs(acc, jobs)
  return { state: acc.state, events: acc.events, ...(pending ? { pending } : {}) }
}
