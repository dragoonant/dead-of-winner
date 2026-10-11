// The colony phase (10 R4.7-R4.15, E.4 steps 1-7) as one function that emits every event in order:
//   payFood, checkWaste, resolveCrisis, addZombies, checkObjective, roundTick, passToken (then the next round's start).
// It stops (returns with `pending`) the moment a decision opens inside a step (a newLeader after an overrun, an effect choice in a
// crisis fail effect) and `resumeColonyPhase` carries on from exactly there; morale 0 or the objective ending ends the game at once.
// The progress of a step that can be interrupted (the zombie sections, whether a window already fired) lives in ONE rule effect
// named `colony#cursor`, so the pure state is the only place a half-finished phase is kept (00 §2).
import type { PhaseChanged } from './events'
import { drawCrossroads } from './crossroads'
import { rollActionDice } from './dice'
import { expireEffects, recOf } from './effects'
import { addZombiesInto } from './zombies'
import { resolveCrisisInto } from './crisis'
import { aliveAt, fireInto, halted, isOver, loseMoraleInto, mergeInto, startOut, withMoraleEndDeferred, type Out } from './exposure'
import { checkMainObjective, endGame, finalizeEnding } from './objectives'
import { roll } from './rng'
import type { ColonyStep, EffectInstance, GameEndReason, GameState, LocationId, PendingDecision, SeatId, WindowId } from './types'
import { seatToRight } from './view'

export const COLONY_STEPS: readonly ColonyStep[] = ['payFood', 'checkWaste', 'resolveCrisis', 'addZombies', 'checkObjective', 'roundTick', 'passToken']
const STEP_WINDOW: Partial<Record<ColonyStep, WindowId>> = {
  payFood: 'colony.payFood', checkWaste: 'colony.waste', resolveCrisis: 'colony.crisis', addZombies: 'colony.zombies', checkObjective: 'colony.objective', roundTick: 'colony.roundTick',
}

/** The colony phase always ends on exactly one decision: a sub-decision, the next round's first turn, or `gameOver`. */
export interface ColonyOut extends Out { pending: PendingDecision }

// ---------- the next round's start (registered by the player-turns phase) ----------
export type NextRoundStarter = (state: GameState) => Out
let nextRoundStarter: NextRoundStarter | null = null
/** The player-turns phase registers its round start (crisis flip, dice, first turn, Crossroads draw); until then `defaultNextRound` plays a minimal one. */
export function registerNextRoundStarter(fn: NextRoundStarter | null): void { nextRoundStarter = fn }

const nextActiveSeat = (s: GameState, from: SeatId): SeatId => {
  const i = s.seatOrder.indexOf(from)
  for (let k = 0; k < s.seatOrder.length; k++) {
    const id = s.seatOrder[(i + k) % s.seatOrder.length]!
    if (!s.seats[id]!.seat.eliminated) return id
  }
  return from
}

/** Round N+1 start: flip the crisis, roll dice, open the first non-eliminated seat's turn (R4.1-R4.4a). */
export const defaultNextRound: NextRoundStarter = (state0) => {
  const out = startOut(state0)
  let s = state0
  const roundNumber = s.roundNumber + 1
  s = { ...s, phase: 'playerTurns', colonyStep: null, roundNumber, turn: null }
  out.events.push({ type: 'PhaseChanged', phase: 'playerTurns' }, { type: 'RoundStarted', roundNumber, roundsLeft: s.roundsLeft })
  const top = s.crisisDeck[0]
  s = { ...s, crisisDeck: s.crisisDeck.slice(top ? 1 : 0), crisis: { ...s.crisis, cardId: top ?? null, contributions: [], result: null } }
  if (top) {
    const prevent = ((recOf(s, top) as { prevent?: never[] } | undefined)?.prevent ?? [])
    out.events.push({ type: 'CrisisRevealed', cardId: top, prevent, roundNumber })
  }
  const dice = rollActionDice(s)
  s = dice.state
  out.events.push(...dice.events)
  const first = nextActiveSeat(s, s.firstSeat)
  s = { ...s, activeSeat: first, turnCount: s.turnCount + 1, turn: { seat: first, index: 0, actions: 0, voteCalled: false, contributionAsked: false } }
  out.events.push({ type: 'TurnStarted', seat: first, turnCount: s.turnCount, roundNumber })
  const cx = drawCrossroads(s, first)
  s = cx.state
  out.events.push(...cx.events)
  const id = `d:${s.decisionSeq + 1}`
  const pending: PendingDecision = {
    id, seat: first, kind: 'turnAction', window: 'turn.start', context: { seatId: first }, canPass: false,
    options: [{ id: 'endTurn', label: 'end turn', action: { type: 'endTurn', decisionId: id, seat: first } }],
  }
  out.state = { ...s, decisionSeq: s.decisionSeq + 1, pending }
  out.pending = pending
  return out
}

// ---------- the cursor ----------
interface ZCursor { stage: 'colony' | 'locations' | 'noise'; idx: number; started: boolean; remaining: number; nextIndex: number; noiseTotal: number }
interface Cursor { fired: boolean; z?: ZCursor }
const CURSOR = 'colony#cursor'
function readCursor(s: GameState): Cursor {
  const e = s.effects.find((x) => x.name === CURSOR)
  return (e?.data as unknown as Cursor | undefined) ?? { fired: false }
}
function writeCursor(s: GameState, c: Cursor | null): GameState {
  const rest = s.effects.filter((x) => x.name !== CURSOR)
  if (!c) return rest.length === s.effects.length ? s : { ...s, effects: rest }
  const inst: EffectInstance = { id: 'e:colony-cursor', sourceId: 'rule.colony', sourceKind: 'rule', name: CURSOR, data: c as unknown as Record<string, unknown>, duration: 'game', expires: null }
  return { ...s, effects: [...rest, inst] }
}
/** Is a colony phase half done (a decision opened inside it)? */
export const colonyInProgress = (s: GameState): boolean => s.phase === 'colony' && s.effects.some((e) => e.name === CURSOR)

// ---------- step 1: pay food (R4.8) ----------
function payFood(acc: Out): void {
  const s = acc.state
  const mouths = aliveAt(s, 'colony').length + s.locations['colony']!.helpless
  const needed = Math.ceil(mouths / 2)
  if (s.food >= needed) {
    const after = s.food - needed
    acc.state = { ...s, food: after }
    acc.events.push({ type: 'FoodPaid', needed, survivors: mouths, foodAfter: after })
    if (needed > 0) acc.events.push({ type: 'FoodChanged', delta: -needed, after, reason: 'pay' })
    return
  }
  const starvation = s.starvation + 1
  acc.state = { ...s, starvation }
  acc.events.push({ type: 'Starvation', needed, supply: s.food, starvationAfter: starvation, moraleLoss: starvation })
  loseMoraleInto(acc, starvation, 'starvation')
}

// ---------- step 2: check waste (R4.9) ----------
function checkWaste(acc: Out): void {
  const cards = acc.state.waste.length
  const moraleLoss = Math.floor(cards / 10)
  acc.events.push({ type: 'WasteChecked', cards, moraleLoss })
  if (moraleLoss > 0) loseMoraleInto(acc, moraleLoss, 'waste')
}

// ---------- step 4: add zombies (R4.12, F 6.2.1) ----------
const fresh = (): ZCursor => ({ stage: 'colony', idx: 0, started: false, remaining: 0, nextIndex: 0, noiseTotal: 0 })
const survivorsThere = (s: GameState, loc: LocationId): number => aliveAt(s, loc).length + (s.locations[loc]?.helpless ?? 0)

/** Morale 0 reached inside Adding Zombies ends the game only at a checkpoint: after (B) colony, (D) other locations, (F) noise (FAQ 6.2.1). */
function moraleCheckpoint(acc: Out): boolean {
  if (acc.state.morale > 0 || isOver(acc.state)) return isOver(acc.state)
  endWith(acc, 'moraleZero')
  return true
}

function addZombiesStep(acc: Out): void { withMoraleEndDeferred(() => addZombiesStepInner(acc)) }

function addZombiesStepInner(acc: Out): void {
  let z = readCursor(acc.state).z ?? fresh()
  const save = (): void => { acc.state = writeCursor(acc.state, { ...readCursor(acc.state), z }) }
  const order = acc.state.locationOrder

  // (A) the colony: half the survivors there (helpless tokens included), rounded up
  if (z.stage === 'colony') {
    if (!z.started) {
      const n = survivorsThere(acc.state, 'colony')
      const count = Math.ceil(n / 2)
      z = { ...z, started: true, remaining: count, nextIndex: 0 }
      if (count > 0) acc.events.push({ type: 'ZombiesToAdd', location: 'colony', count, source: 'colonyStep', survivors: n })
    }
    if (z.remaining > 0) {
      const r = addZombiesInto(acc, 'colony', z.remaining, 'colonyStep', { startIndex: z.nextIndex, announce: false })
      z = { ...z, remaining: r.remaining, nextIndex: r.nextIndex }
      if (halted(acc)) { save(); return }
    }
    z = { ...fresh(), stage: 'locations' }
    if (moraleCheckpoint(acc)) return // (B)
  }

  // (C) every other location in locationOrder: one per survivor there
  if (z.stage === 'locations') {
    for (; z.idx < order.length; z = { ...fresh(), stage: 'locations', idx: z.idx + 1 }) {
      const loc = order[z.idx]!
      if (loc === 'colony') continue
      if (!z.started) {
        const n = survivorsThere(acc.state, loc)
        z = { ...z, started: true, remaining: n, nextIndex: 0 }
        if (n > 0) acc.events.push({ type: 'ZombiesToAdd', location: loc, count: n, source: 'locationStep', survivors: n })
      }
      if (z.remaining > 0) {
        const r = addZombiesInto(acc, loc, z.remaining, 'locationStep', { announce: false })
        z = { ...z, remaining: r.remaining }
        if (halted(acc)) { save(); return }
      }
    }
    z = { ...fresh(), stage: 'noise' }
    if (moraleCheckpoint(acc)) return // (D)
  }

  // (E) noise, location by location: each token is a d6, 3 or lower adds a zombie (tokens leave as they are rolled)
  for (; z.idx < order.length; z = { ...fresh(), stage: 'noise', idx: z.idx + 1 }) {
    const loc = order[z.idx]!
    if (!z.started) {
      z = { ...z, started: true, noiseTotal: acc.state.locations[loc]!.noise }
      if (z.noiseTotal === 0) continue
    }
    while (acc.state.locations[loc]!.noise > 0) {
      const r = roll(acc.state, { count: 1, purpose: 'noise' })
      acc.state = r.state
      acc.events.push(r.event)
      const die = r.event.dice[0]!
      const l = acc.state.locations[loc]!
      acc.state = { ...acc.state, locations: { ...acc.state.locations, [loc]: { ...l, noise: l.noise - 1 } } }
      acc.events.push({ type: 'NoiseRolled', location: loc, rollId: r.event.rollId, die, zombie: die <= 3 })
      if (die <= 3) {
        addZombiesInto(acc, loc, 1, 'noise', { announce: false })
        if (halted(acc)) { save(); return }
      }
    }
    acc.events.push({ type: 'NoiseCleared', location: loc, count: z.noiseTotal })
  }
  moraleCheckpoint(acc) // (F)
}

// ---------- the driver ----------
function endWith(acc: Out, reason: GameEndReason): void {
  const r = endGame(acc.state, reason)
  acc.state = r.state
  acc.events.push(...r.events)
  acc.pending = r.pending
}

function stepBody(acc: Out, step: ColonyStep): void {
  switch (step) {
    case 'payFood': payFood(acc); return
    case 'checkWaste': checkWaste(acc); return
    case 'resolveCrisis': resolveCrisisInto(acc); return
    case 'addZombies': addZombiesStep(acc); return
    case 'checkObjective': {
      const r = checkMainObjective(acc.state)
      acc.state = r.state
      acc.events.push(...r.events)
      if (r.complete) endWith(acc, 'objectiveComplete')
      return
    }
    case 'roundTick': {
      const after = Math.max(0, acc.state.roundsLeft - 1)
      acc.state = { ...acc.state, roundsLeft: after }
      acc.events.push({ type: 'RoundTicked', roundsLeft: after })
      if (after === 0) endWith(acc, 'roundsOut') // no objective check here (R17.2, COL-016)
      return
    }
    case 'passToken': {
      acc.state = writeCursor(acc.state, null)
      const ex = expireEffects(acc.state, 'roundEnd') // "until the end of the round" ends with the colony phase
      acc.state = ex.state
      acc.events.push(...ex.events)
      const from = acc.state.firstSeat
      const to = seatToRight(acc.state.seatOrder, from) // an exiled or eliminated seat may hold the token (R4.15)
      acc.state = { ...acc.state, firstSeat: to, colonyStep: null }
      acc.events.push({ type: 'FirstSeatPassed', from, to })
      const next = (nextRoundStarter ?? defaultNextRound)(acc.state)
      mergeInto(acc, next)
    }
  }
}

function drive(acc: Out, from: number, resuming: boolean): ColonyOut {
  for (let i = from; i < COLONY_STEPS.length && !isOver(acc.state); i++) {
    const step = COLONY_STEPS[i]!
    if (!(resuming && i === from)) {
      acc.state = writeCursor({ ...acc.state, colonyStep: step }, { fired: false })
      const ev: PhaseChanged = { type: 'PhaseChanged', phase: 'colony', step }
      acc.events.push(ev)
    }
    const window = STEP_WINDOW[step]
    if (window && !readCursor(acc.state).fired) {
      acc.state = writeCursor(acc.state, { ...readCursor(acc.state), fired: true })
      fireInto(acc, window)
      if (halted(acc)) break
    }
    stepBody(acc, step)
    if (halted(acc)) break
  }
  if (isOver(acc.state)) acc.state = writeCursor(acc.state, null)
  const pending = acc.pending ?? (acc.state.pending as PendingDecision)
  return finalizeEnding({ state: { ...acc.state, pending }, events: acc.events, pending })
}

/** Called once the last player turn has ended (R4.7): runs the colony phase, then the next round's start, in one go. */
export function beginColonyPhase(state: GameState): ColonyOut {
  const acc = startOut({ ...state, phase: 'colony', colonyStep: null, turn: null })
  return drive(acc, 0, false)
}

/** Continue a colony phase whose step was interrupted by a decision that has since been answered (`colonyInProgress`). */
export function resumeColonyPhase(state: GameState): ColonyOut {
  if (state.phase !== 'colony') return { state, events: [], pending: state.pending }
  const idx = state.colonyStep ? COLONY_STEPS.indexOf(state.colonyStep) : 0
  return drive(startOut(state), Math.max(0, idx), true)
}
