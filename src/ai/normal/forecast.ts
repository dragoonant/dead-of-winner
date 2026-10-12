// The colony-phase forecast of the Normal planner. Before it chooses a turn action the planner asks what the coming colony phase will cost in
// morale, from the public view alone, and prices an action by how much of that cost it removes:
//   overrun     zombies from the colony step (and from a failing crisis) against free entrance spaces and barricades: each overrun kills a survivor
//   waste       one morale per ten cards on the pile when the check runs (the cards the seats still to act will add are counted)
//   starvation  the pay is ceil(mouths at the colony / 2); a short pay costs one more than the starvation tokens already held
//   crisis      the chance the pile falls short, times what the printed failure costs
// The pieces live in PlanCache (arrivals, cost, food, crisis); this module adds the waste and food prices and sums the four into one report.
import type { SeatId } from '../../engine/index'
import { boardCost } from './info'
import type { PlanCache } from './plan'
import { TUNE } from './plan'

export interface ColonyForecast {
  /** zombies the colony step is expected to add at the colony, and the morale the overruns among them cost this phase */
  arrivals: number
  overrun: number
  /** cards on the pile when the check runs, and the morale it takes */
  waste: number
  wasteLoss: number
  /** the colony's food bill, what the supply holds, and the morale a short pay costs (0 when the supply covers it) */
  needed: number
  supply: number
  starvation: number
  /** chance the open crisis falls short, and the expected morale-equivalent cost of that */
  pFail: number
  crisis: number
  /** the sum, in morale points */
  total: number
}

const rotateFrom = <T,>(xs: readonly T[], first: T): T[] => { const i = xs.indexOf(first); return i <= 0 ? [...xs] : [...xs.slice(i), ...xs.slice(0, i)] }

/** Seats that still act this round after `me` (they may put more cards on the waste pile before the check). */
function seatsAfter(c: PlanCache, me: SeatId): number {
  const v = c.v
  const order = v.seatOrder.indexOf(me) < 0 ? [] : rotateFrom(v.seatOrder, v.firstSeat)
  return order.slice(order.indexOf(me) + 1).filter((s) => !v.seats[s]!.seat.exiled && !v.seats[s]!.seat.eliminated).length
}

/** Cards expected on the waste pile when the colony phase checks it. */
export function wasteAtCheck(c: PlanCache): number {
  return c.v.waste.length + TUNE.wasteAdd * seatsAfter(c, c.env.me)
}

/**
 * Morale saved by taking `take` cards off the pile now: the check at the end of this round, plus the later rounds a lower pile also spares
 * (a quarter of the cards a ten-card step holds, for each of up to two more rounds). Zero for a betrayer, who has no wish to save the colony.
 */
export function wasteSaved(c: PlanCache, take: number): number {
  const v = c.v
  if (v.waste.length <= 0 || c.env.betrayer) return 0
  const eff = wasteAtCheck(c)
  const now = Math.floor(eff / 10) - Math.floor(Math.max(0, eff - take) / 10)
  const later = (take / 10) * TUNE.wasteFuture * Math.min(2, Math.max(0, v.roundsLeft - 1))
  return (now + later) * TUNE.wasteW
}

/**
 * Morale a change of the colony's headcount by `delta` (+ a survivor comes home, - one leaves) takes off the starvation bill: positive when it
 * closes a gap between the pay and the supply, negative when it opens one. The pay only changes when the headcount crosses an even number.
 */
export function starvationShift(c: PlanCache, delta: number): number {
  const f = c.food()
  const mouths = f.survivorsAtColony + f.helpless
  const after = Math.max(0, Math.ceil(Math.max(0, mouths + delta) / 2) - f.supply)
  return f.moraleLossIfShort - (after > 0 ? f.starvationNow + 1 : 0)
}

/**
 * Winter Has Come ends the game at the start of any colony phase in which no hand holds a fuel card. A seat with no fuel in hand feels that more
 * the later it acts in the round (the seats before it have had their say, and it cannot see their hands): 0 for any other objective and for a seat
 * that holds one.
 */
export function fuelDuty(c: PlanCache): number {
  const v = c.v
  if (c.env.betrayer || v.objective.id !== 'obj.main.winter-has-come' || TUNE.winterFuel <= 0) return 0
  if (v.me.hand.some((x) => c.hasSymbol(x, 'fuel'))) return 0
  const n = v.seatOrder.filter((s) => !v.seats[s]!.seat.exiled && !v.seats[s]!.seat.eliminated).length
  const late = n <= 1 ? 1 : 1 - seatsAfter(c, c.env.me) / (n - 1)
  return TUNE.winterFuel * (0.4 + 0.6 * Math.max(0, Math.min(1, late)))
}

/** What the coming colony phase is expected to cost, piece by piece (see the header). */
export function colonyForecast(c: PlanCache): ColonyForecast {
  const f = c.food()
  const { ent, cap } = c.board('colony')
  const arrivals = c.arrivals('colony')
  const overrun = boardCost(ent, cap, arrivals, 1)
  const waste = wasteAtCheck(c)
  const wasteLoss = Math.floor(waste / 10)
  const starvation = f.shortfall > 0 ? f.moraleLossIfShort : 0
  const cr = c.crisis()
  const crisis = cr.open ? cr.pFail * cr.failCost : 0
  return { arrivals, overrun, waste, wasteLoss, needed: f.needed, supply: f.supply, starvation, pFail: cr.open ? cr.pFail : 0, crisis, total: overrun + wasteLoss + starvation + crisis }
}
