// Action dice (10 R4.2, R5): the roll-dice step, die spending, food boosts. Dice belong to the seat, never to a survivor.
// Every d6 goes through rng.roll so rollSeq/state.rng stay the single seeded stream (00 §11).
import type { SpendFoodAction } from './actions'
import type { ActionDiceRolled, DieAdded, DieBoosted, DieSpent, FoodChanged, GameEvent } from './events'
import { extraDiceFor } from './code-hooks'
import { roll } from './rng'
import type { DieId, DiePurpose, GameState, Die, Rejection, SeatId, SurvivorId } from './types'
import { patchSeat, reject, type Out } from './decks'

export const MAX_DIE = 6

/** The roll-dice step at round start (R4.2): every non-eliminated seat discards its old dice and rolls 1 + alive survivors it controls. */
export function rollActionDice(state: GameState): Out {
  let s = state
  const events: GameEvent[] = []
  for (const seatId of state.seatOrder) {
    const seat = s.seats[seatId]!
    if (seat.seat.eliminated) continue
    const alive = seat.survivors.filter((id) => s.survivors[id]?.status === 'alive').length
    const rolled = roll(s, { count: Math.max(1, 1 + alive + extraDiceFor(s, seatId)), purpose: 'actionDice', seat: seatId }) // Music, Dynamite: extraDie grants
    s = rolled.state
    const dice: Die[] = rolled.event.dice.map((value, i) => ({ id: `${seatId}:d${i + 1}`, value, used: false }))
    s = patchSeat(s, seatId, { dice, abilityUses: {} }) // survivor ability uses reset with the dice (R5.5)
    events.push(rolled.event)
    const ev: ActionDiceRolled = { type: 'ActionDiceRolled', seat: seatId, dice, rollId: rolled.event.rollId }
    events.push(ev)
  }
  return { state: { ...s, cardUses: {} }, events } // once-per-round item uses reset too (R7.6)
}

// ---------- lookups and spending ----------
export const findDie = (state: GameState, seat: SeatId, dieId: DieId): Die | undefined => state.seats[seat]?.dice.find((d) => d.id === dieId)
export const unusedDice = (state: GameState, seat: SeatId): Die[] => (state.seats[seat]?.dice ?? []).filter((d) => !d.used)

/** E_NO_DIE (not this seat's), E_DIE_USED, E_DIE_TOO_LOW (value below `need`). Barricade, clean waste and attract pass no `need`. */
export function checkDie(state: GameState, seat: SeatId, dieId: DieId, need?: number): Rejection | null {
  const die = findDie(state, seat, dieId)
  if (!die) return reject('E_NO_DIE', `seat ${seat} has no die ${dieId}`, { dieId })
  if (die.used) return reject('E_DIE_USED', `die ${dieId} is already spent`, { dieId })
  if (need !== undefined && die.value < need) return reject('E_DIE_TOO_LOW', `die ${dieId} shows ${die.value}, needs ${need}+`, { dieId, value: die.value, need })
  return null
}

function patchDie(state: GameState, seat: SeatId, dieId: DieId, patch: Partial<Die>): GameState {
  return patchSeat(state, seat, { dice: state.seats[seat]!.dice.map((d) => (d.id === dieId ? { ...d, ...patch } : d)) })
}

/** Marks a die used and emits DieSpent. The caller has already run checkDie. */
export function spendDie(state: GameState, seat: SeatId, dieId: DieId, info: { purpose: DiePurpose; survivorId?: SurvivorId; need?: number }): Out {
  const die = findDie(state, seat, dieId)!
  const ev: DieSpent = { type: 'DieSpent', seat, dieId, value: die.value, purpose: info.purpose, survivorId: info.survivorId, need: info.need }
  return { state: patchDie(state, seat, dieId, { used: true }), events: [ev] }
}

/** Raises (or lowers) an unused die to `to`, clamped to 1..6 (Brian Lee, items). A change of 0 emits nothing. */
export function boostDie(state: GameState, seat: SeatId, dieId: DieId, to: number, source: DieBoosted['source']): Out {
  const die = findDie(state, seat, dieId)!
  const next = Math.max(1, Math.min(MAX_DIE, to))
  if (next === die.value) return { state, events: [] }
  const ev: DieBoosted = { type: 'DieBoosted', seat, dieId, from: die.value, to: next, source }
  return { state: patchDie(state, seat, dieId, { value: next }), events: [ev] }
}

/** A new unused die for this round (items and abilities that add one); ids continue the seat's numbering. */
export function addExtraDie(state: GameState, seat: SeatId, value: number, source: DieAdded['source']): Out {
  const dice = state.seats[seat]!.dice
  const n = dice.reduce((m, d) => Math.max(m, Number(d.id.split(':d')[1] ?? 0)), 0) + 1
  const die: Die = { id: `${seat}:d${n}`, value: Math.max(1, Math.min(MAX_DIE, value)), used: false }
  const ev: DieAdded = { type: 'DieAdded', seat, die, source }
  return { state: patchSeat(state, seat, { dice: [...dice, die] }), events: [ev] }
}

// ---------- food on dice (R5.2, F 5.3.1) ----------
const forbidsSpendFood = (state: GameState, seat: SeatId): boolean =>
  state.effects.some((e) => e.forbid?.includes('spendFood') && (!e.seats || e.seats.includes(seat)))

/** Checks in order: payload, exile / forbid, die ownership, die used, die cap, food supply. */
export function validateSpendFood(state: GameState, a: SpendFoodAction): Rejection | null {
  if (!Number.isInteger(a.tokens) || a.tokens < 1) return reject('E_BAD_PAYLOAD', 'spendFood needs a whole number of tokens, at least 1', { tokens: a.tokens })
  const seat = state.seats[a.seat]
  if (!seat) return reject('E_NOT_YOUR_DECISION', `unknown seat ${a.seat}`)
  if (seat.seat.exiled) return reject('E_EXILED', 'an exiled seat cannot spend food on dice')
  if (forbidsSpendFood(state, a.seat)) return reject('E_FORBIDDEN', 'spending food on dice is forbidden right now')
  const die = findDie(state, a.seat, a.dieId)
  if (!die) return reject('E_NO_DIE', `seat ${a.seat} has no die ${a.dieId}`, { dieId: a.dieId })
  if (die.used) return reject('E_DIE_USED', `die ${a.dieId} is already spent`, { dieId: a.dieId })
  if (die.value + a.tokens > MAX_DIE) return reject('E_DIE_MAX', `die ${a.dieId} shows ${die.value}; ${a.tokens} more would pass ${MAX_DIE}`, { dieId: a.dieId, value: die.value, tokens: a.tokens })
  if (state.food < a.tokens) return reject('E_NO_FOOD', `${a.tokens} food needed, ${state.food} in supply`, { food: state.food, tokens: a.tokens })
  return null
}

/** Pays `tokens` food into the die. Assumes validateSpendFood passed. Window `action.spendFood` is the caller's. */
export function applySpendFood(state: GameState, a: SpendFoodAction): Out {
  const die = findDie(state, a.seat, a.dieId)!
  const to = die.value + a.tokens
  const food = state.food - a.tokens
  const boosted: DieBoosted = { type: 'DieBoosted', seat: a.seat, dieId: a.dieId, from: die.value, to, source: 'food' }
  const paid: FoodChanged = { type: 'FoodChanged', delta: -a.tokens, after: food, reason: 'spendOnDie' }
  const s = patchDie({ ...state, food }, a.seat, a.dieId, { value: to, foodSpent: (die.foodSpent ?? 0) + a.tokens })
  return { state: s, events: [boosted, paid] }
}

/** Tokens a seat could still pour into some unused die right now (0 = `spendFood` is not offered by legalActions). */
export function maxFoodTokens(state: GameState, seat: SeatId): number {
  if (state.seats[seat]?.seat.exiled || forbidsSpendFood(state, seat)) return 0
  const headroom = Math.max(0, ...unusedDice(state, seat).map((d) => MAX_DIE - d.value))
  return Math.min(headroom, state.food)
}
