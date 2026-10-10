// Read-only facts the Normal AI derives from a SeatView and the public data bundle (hidden-information contract, 00 §4):
// card symbols, the crisis' prevent symbols, what the seat's own secret objective counts, and the cards it should keep.
// Nothing here touches GameState or the rng.
import { bundleFor, query } from '../../engine/index'
import type { ItemSymbol, SeatId, SurvivorId } from '../../engine/index'
import type { SeatView } from '../../engine/view'

export type Rec = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export function recOf(v: SeatView, id: string | null | undefined): Rec | undefined {
  if (!id) return undefined
  try { return bundleFor(v).byId[id] as unknown as Rec | undefined } catch { return undefined }
}
export const defOfCard = (v: SeatView, cardId: string): Rec | undefined => recOf(v, v.cards[cardId]?.defId)
export function symbolsOfCard(v: SeatView, cardId: string): ItemSymbol[] {
  const d = defOfCard(v, cardId)
  if (!d) return []
  return (d['symbols'] as ItemSymbol[] | undefined) ?? (d['symbol'] ? [d['symbol'] as ItemSymbol] : [])
}
export function crisisPrevent(v: SeatView): ItemSymbol[] {
  return (recOf(v, v.crisis.cardId)?.['prevent'] as ItemSymbol[] | undefined) ?? []
}
export const matchesCrisis = (v: SeatView, cardId: string): boolean => {
  const p = crisisPrevent(v)
  return symbolsOfCard(v, cardId).some((s) => p.includes(s))
}
/** Food a card adds to the supply when played (0 for anything else). */
export function foodOf(v: SeatView, cardId: string): number {
  const d = defOfCard(v, cardId)
  if (!d) return 0
  if (typeof d['food'] === 'number') return d['food'] as number
  const nodes = (d['play']?.['effect'] as Rec[] | undefined) ?? []
  return nodes.filter((n) => n['op'] === 'food' && typeof n['value'] === 'number').reduce((a, n) => a + (n['value'] as number), 0)
}
export const isEquipCard = (v: SeatView, cardId: string): boolean => defOfCard(v, cardId)?.['class'] === 'equip'
export const woundsOn = (v: SeatView, id: SurvivorId): number => { const s = v.survivors[id]; return s ? s.wounds + s.frostbite : 0 }

export const aliveSurvivorsOf = (v: SeatView, seat: SeatId): SurvivorId[] => (v.seats[seat]?.survivors ?? []).filter((id) => v.survivors[id]?.status === 'alive')
export const isBetrayer = (v: SeatView): boolean => (v.me.secretObjectiveId ?? '').startsWith('obj.betrayal.')
/** Which betrayal card the seat holds ('trigger-happy', 'cult-leader', 'serial-killers', ...), or '' for a loyal seat. */
export const betrayalKind = (v: SeatView): string => (isBetrayer(v) ? (v.me.secretObjectiveId ?? '').replace('obj.betrayal.', '') : '')
/** A betrayer's wish to bring the colony down: 0 early, rising as rounds run out and morale thins (the betrayal cards all need morale 0). */
export function betrayerPush(v: SeatView): number {
  let p = v.roundsLeft <= 1 ? 0.9 : v.roundsLeft <= 2 ? 0.6 : v.roundsLeft <= 3 ? 0.3 : v.roundNumber >= 2 ? 0.1 : 0
  if (v.morale <= 3) p += 0.25
  if (v.morale <= 1) p += 0.2
  p = Math.min(1, p)
  // the colony must fall with the card's other condition already met: pace the collapse to the private goal
  const g = betrayalProgress(v)
  if (g >= 1) return Math.max(p, 0.8)
  return v.roundsLeft <= 1 ? p : p * (0.4 + 0.6 * g)
}
/** 0..1: how close the held betrayal card's non-morale condition is (1 = met right now). */
export function betrayalProgress(v: SeatView): number {
  const kind = betrayalKind(v)
  const mine = v.seats[v.seat]?.survivors.filter((id) => v.survivors[id]?.status === 'alive') ?? []
  if (kind === 'trigger-happy') {
    const eq = mine.reduce((n, id) => n + (v.survivors[id]?.equipped ?? []).filter((c) => symbolsOfCard(v, c).includes('weapon')).length, 0)
    return Math.min(1, eq / 4)
  }
  if (kind === 'serial-killers') {
    const gone = Object.values(v.survivors).filter((s) => s.status !== 'alive').length
    return mine.length < 2 ? 0.2 : Math.min(1, gone / 5)
  }
  if (kind === 'cult-leader') {
    const others = v.seatOrder.filter((s) => s !== v.seat).map((s) => v.seats[s]?.survivors.filter((id) => v.survivors[id]?.status === 'alive').length ?? 0)
    return Math.max(0, Math.min(1, (mine.length - Math.max(0, ...others) + 2) / 4))
  }
  return 0.5
}

// ---------- what the seat's own objective counts (hold-in-hand objectives only) ----------
export interface ObjectiveNeeds { symbols: Partial<Record<ItemSymbol, number>>; anyCards: number }
function walk(node: unknown, out: ObjectiveNeeds): void {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) { for (const n of node) walk(n, out); return }
  const n = node as Rec
  if (n['test'] === 'handHasSymbol' && typeof n['symbol'] === 'string') {
    const k = n['symbol'] as ItemSymbol
    out.symbols[k] = Math.max(out.symbols[k] ?? 0, typeof n['value'] === 'number' ? (n['value'] as number) : 1)
  } else if (n['test'] === 'handAtLeast' && typeof n['value'] === 'number') out.anyCards = Math.max(out.anyCards, n['value'] as number)
  else if (typeof n['code'] === 'string' && n['params'] && typeof (n['params'] as Rec)['symbol'] === 'string') {
    const p = n['params'] as Rec
    const k = p['symbol'] as ItemSymbol
    out.symbols[k] = Math.max(out.symbols[k] ?? 0, typeof p['n'] === 'number' ? (p['n'] as number) : 1)
  }
  for (const k of Object.keys(n)) if (k === 'all' || k === 'any' || k === 'not') walk(n[k], out)
}
export function objectiveNeeds(v: SeatView): ObjectiveNeeds {
  const out: ObjectiveNeeds = { symbols: {}, anyCards: 0 }
  const id = v.seats[v.seat]?.seat.exiled ? v.me.exiledObjectiveId : v.me.secretObjectiveId
  if (!id || id.startsWith('obj.betrayal.')) return out
  walk(recOf(v, id)?.['complete'], out)
  return out
}

/** Hand cards the seat should not give away, play or put into the crisis: what its secret objective counts. */
export function reservedCards(v: SeatView): Set<string> {
  const needs = objectiveNeeds(v)
  const out = new Set<string>()
  for (const [sym, n] of Object.entries(needs.symbols) as [ItemSymbol, number][]) {
    let left = n
    for (const c of v.me.hand) {
      if (left <= 0) break
      if (!out.has(c) && symbolsOfCard(v, c).includes(sym)) { out.add(c); left-- }
    }
  }
  if (needs.anyCards > 0) for (const c of v.me.hand) { if (out.size >= needs.anyCards + 0) break; out.add(c) }
  // Winter Has Come: some seat must hand over a fuel card at the start of every colony phase or the game ends; keep one at home
  if (v.objective.id === 'obj.main.winter-has-come' && !isBetrayer(v)) { const f = v.me.hand.find((c) => !out.has(c) && symbolsOfCard(v, c).includes('fuel')); if (f) out.add(f) }
  return out
}
/** Symbols the seat's objective still lacks in hand. */
export function missingObjectiveSymbols(v: SeatView): ItemSymbol[] {
  const needs = objectiveNeeds(v)
  const out: ItemSymbol[] = []
  for (const [sym, n] of Object.entries(needs.symbols) as [ItemSymbol, number][]) {
    const have = v.me.hand.filter((c) => symbolsOfCard(v, c).includes(sym)).length
    if (have < n) out.push(sym)
  }
  return out
}

// ---------- what the main objective counts (cards added under it) ----------
export interface ObjNeed { symbol: ItemSymbol; counter: string; remaining: number; excludeStarter: boolean }
/** Symbols the main objective still wants under it (empty when the objective takes no cards), with how many more it needs. */
export function mainObjectiveNeeds(v: SeatView): ObjNeed[] {
  const side = recOf(v, v.objective.id)?.['sides']?.[v.objective.side] as Rec | undefined
  const contribs = (side?.['contributions'] as Rec[] | undefined) ?? []
  if (contribs.length === 0 || v.objective.complete) return []
  let parts: readonly { label: string; have: number; need: number }[] = []
  try { parts = query.objectiveProgress(v).parts } catch { parts = [] }
  const out: ObjNeed[] = []
  for (const c of contribs) {
    const part = parts.find((p) => p.label === c['counter'])
    const need = part ? part.need : 2
    const have = part ? part.have : (v.objective.counters[c['counter'] as string] ?? 0)
    const remaining = Number.isFinite(need) ? Math.max(0, need - have) : 0
    if (remaining > 0) out.push({ symbol: c['symbol'] as ItemSymbol, counter: c['counter'] as string, remaining, excludeStarter: !!c['excludeStarter'] })
  }
  return out
}
/** Hand cards of `symbol` that would count for the main objective right now. */
export function countableInHand(v: SeatView, n: ObjNeed): string[] {
  return v.me.hand.filter((c) => symbolsOfCard(v, c).includes(n.symbol) && !(n.excludeStarter && v.cards[c]?.starter))
}

export function symbolOrder(v: SeatView, loc: string): ItemSymbol[] {
  return (recOf(v, loc)?.['symbolOrder'] as ItemSymbol[] | undefined) ?? []
}
export function statsOf(v: SeatView, id: SurvivorId): { influence: number; attack: number; search: number } {
  const s = recOf(v, id)?.['stats'] as { influence: number; attack: number; search: number } | undefined
  return s ?? { influence: 30, attack: 4, search: 4 }
}

// ---------- colony board model ----------
export interface Ent { z: number; b: number }
/** Drop `n` arrivals round-robin from `start` (engine zombies.ts addOneInto): fill an empty space, else break a barricade, else overrun. */
export function simulateArrivals(ent: Ent[], cap: number, n: number, start = 0): { ent: Ent[]; overruns: number; broken: number } {
  const e = ent.map((x) => ({ ...x }))
  let overruns = 0
  let broken = 0
  for (let k = 0; k < n && e.length > 0; k++) {
    const t = e[(start + k) % e.length]!
    if (t.z + t.b < cap) t.z++
    else if (t.b > 0) { t.b--; broken++ }
    else overruns++
  }
  return { ent: e, overruns, broken }
}
export const OVERRUN_COST = 1.3 // morale-equivalents: a survivor dies and morale drops
/** Expected cost of a location's board over the next two colony phases (the second discounted). */
export function boardCost(ent: Ent[], cap: number, arrivals: number, rounds: number): number {
  if (arrivals <= 0) return 0
  const a = simulateArrivals(ent, cap, arrivals)
  let cost = OVERRUN_COST * a.overruns + 0.05 * a.broken
  if (rounds > 1) {
    const b = simulateArrivals(a.ent, cap, arrivals)
    cost += 0.55 * (OVERRUN_COST * b.overruns + 0.05 * b.broken)
  }
  return cost
}
