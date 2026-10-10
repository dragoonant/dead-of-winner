// Colony step 3 (R4.10, R13): resolve this round's crisis. The face-down contributions are shuffled on the seeded stream and
// revealed one at a time (+1 for a card carrying a prevent symbol, -1 otherwise); the contributor is never named in an event.
// Needed = non-exiled, non-eliminated seats (live, at resolution time); total >= needed prevents; total >= needed + 2 also gives
// +1 morale (a card's own `bonus` may change the extra-card count or the effect, never stacks, R4.11). Below needed: the fail
// effect through the DSL. Every contributed card leaves the game, face up, in `removed`.
import type { GameEvent } from './events'
import { bundleFor } from './bundles'
import type { CrisisReport } from './index'
import { defOf, crisisDescriptor, nonExiledSeats, recOf, runCrisisEffect, symbolsOf, type Rec } from './effects'
import { fireInto, type Out } from './exposure'
import { shuffle } from './rng'
import { changeMorale } from './survivors'
import type { CrisisRevealedCard, CrisisResult, GameState, ItemSymbol } from './types'
import type { SeatView } from './view'

export const DEFAULT_BONUS_CARDS = 2 // R p12: two cards over the need

/** Seats that count toward "needed" (R p12, CRIS-009). */
export function neededFor(state: GameState, crisisId: string): number {
  const n = nonExiledSeats(state).length
  const need = (recOf(state, crisisId) as Rec | undefined)?.need as { perSeat: number; plus: number } | undefined
  return need ? need.perSeat * n + need.plus : n
}

/** The crisis' own reason for a morale change becomes the checklist's: fail -> crisisFailed, bonus -> crisisBonus. */
function relabel(events: GameEvent[], crisisId: string, kind: 'fail' | 'bonus'): GameEvent[] {
  return events.map((e): GameEvent => (e.type === 'MoraleChanged' && e.reason === 'crisis' && e.sourceId === crisisId ? { ...e, reason: kind === 'fail' ? 'crisisFailed' : 'crisisBonus' } : e))
}

function runEffect(acc: Out, crisisId: string, kind: 'fail' | 'bonus'): void {
  const r = runCrisisEffect(acc.state, crisisId, kind)
  acc.state = r.state
  acc.events.push(...relabel(r.events, crisisId, kind))
  if (r.pending) acc.pending = r.pending
}

/**
 * Resolves the open crisis into `acc`. Re-entrant: a round whose `crisis.result` is already set is left alone, so the colony
 * phase can resume after the fail effect raised a decision. Stops early (acc halted) when the game ends or a decision opens.
 */
export function resolveCrisisInto(acc: Out): void {
  let s = acc.state
  const cardId = s.crisis.cardId
  if (!cardId || s.crisis.result) return
  const desc = crisisDescriptor(s, cardId)
  const prevent: ItemSymbol[] = desc?.prevent ?? []
  const needed = neededFor(s, cardId)

  // shuffle face down, reveal one at a time
  const [order, rng] = shuffle(s.rng, s.crisis.contributions)
  s = { ...s, rng }
  let total = 0
  const revealed: CrisisRevealedCard[] = []
  for (const c of order) {
    const hit = symbolsOf(defOf(s, c.cardId)).some((sym) => prevent.includes(sym))
    const points: 1 | -1 = hit ? 1 : -1
    total += points
    revealed.push({ cardId: c.cardId, seat: c.seat, points })
    acc.events.push({ type: 'CrisisCardRevealed', cardId: c.cardId, defId: s.cards[c.cardId]?.defId ?? '', points, runningTotal: total })
  }
  const prevented = needed <= 0 || total >= needed // R13.4: nobody left to ask = prevented; nothing in with needed >= 1 = fails
  const extra = desc?.bonus?.extraCards ?? DEFAULT_BONUS_CARDS
  const bonus = prevented && total >= needed + extra

  // commit: contributions leave the game (face up, public), the result is stored before any effect can suspend
  const result: CrisisResult = { total, needed, prevented, bonus, revealed, moraleDelta: 0 }
  const moraleBefore = s.morale
  s = {
    ...s, removed: [...s.removed, ...order.map((c) => c.cardId)],
    crisis: { ...s.crisis, contributions: [], result, history: [...s.crisis.history, { roundNumber: s.roundNumber, cardId, result }] },
  }
  for (const c of order) acc.events.push({ type: 'CardDiscarded', seat: null, cardId: c.cardId, to: 'removed', reason: 'crisis' }) // seat null: the pile was shuffled
  acc.events.push({ type: 'CrisisResolved', cardId, total, needed, prevented, bonus, cards: order.length })
  acc.state = s

  // effects
  if (!prevented) runEffect(acc, cardId, 'fail')
  else if (bonus) {
    if (desc?.bonus?.effect?.length) runEffect(acc, cardId, 'bonus')
    else {
      const m = changeMorale(acc.state, 1, 'crisisBonus', cardId)
      acc.state = m.state
      acc.events.push(...m.events)
    }
  }
  const delta = acc.state.morale - moraleBefore
  if (delta !== 0) setResultMorale(acc, delta)
  fireInto(acc, 'crisis.resolved')
}

function setResultMorale(acc: Out, moraleDelta: number): void {
  const c = acc.state.crisis
  if (!c.result) return
  const result = { ...c.result, moraleDelta }
  const history = c.history.map((h, i) => (i === c.history.length - 1 ? { ...h, result } : h))
  acc.state = { ...acc.state, crisis: { ...c, result, history } }
}

// ---------- query.crisis (00 §10, R13.2) ----------
/**
 * Points the viewer knows (own cards exactly, other seats' cards as +-1 each). Equipped contributions are public (R7.3) but
 * `Contribution` carries no origin, so they are bounded like hand cards here (RULING in the module report).
 */
export function crisisReportFromView(v: SeatView): CrisisReport {
  const cardId = v.crisis.cardId
  const rec = cardId ? (bundleFor(v).byId[cardId] as Rec | undefined) : undefined
  const prevent: ItemSymbol[] = rec?.prevent ?? []
  const live = v.seatOrder.filter((id) => !v.seats[id]!.seat.eliminated && !v.seats[id]!.seat.exiled).length
  const needed = rec?.need ? rec.need.perSeat * live + rec.need.plus : live
  const bonusAt = needed + ((rec?.bonus?.extraCards as number | undefined) ?? DEFAULT_BONUS_CARDS)
  const mine = v.me.contributions
  const pointsOf = (id: string): number => {
    const defId = v.cards[id]?.defId
    const def = defId ? (bundleFor(v).byId[defId] as Rec | undefined) : undefined
    return symbolsOf(def).some((x) => prevent.includes(x)) ? 1 : -1
  }
  const myPoints = mine.reduce((n, id) => n + pointsOf(id), 0)
  const others = v.crisis.contributionCount - mine.length
  const r = v.crisis.result
  return {
    cardId, prevent, needed, bonusAt, cardsIn: v.crisis.contributionCount, cardsBySeat: { ...v.crisis.contributionsBySeat },
    myPoints, minTotal: myPoints - others, maxTotal: myPoints + others,
    resolved: r ? { total: r.total, prevented: r.prevented, bonus: r.bonus } : null,
  }
}
