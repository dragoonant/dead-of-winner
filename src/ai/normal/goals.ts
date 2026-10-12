// The objective-goal layer of the Normal planner. It reads the main objective's completion condition from the public bundle, finds the parts that
// are still unmet and turns each into a "lever": a price, in morale points, for the one action that moves that part (kill the zombie that frees an
// entrance space, raise the barricade the goal counts, keep the supply food, search the deck that is nearest to empty, arm the seat, ...).
// One table (LEVERS) maps a condition id (a `{code}` hook or a `{test}` type) to the lever it builds, so another objective, or a future secret one,
// only needs a row here. The price of one unit of progress is the objective's value spread over the units still missing, grown as rounds run out.
// Reads only the SeatView and query.*; a betrayer never builds one (it keeps its own plan).
import type { ItemSymbol, LocationId, SurvivorId } from '../../engine/index'
import type { SeatView } from '../../engine/view'
import { recOf, simulateArrivals, symbolsOfCard, type Ent as BEnt, type Rec } from './info'
import type { PlanCache } from './plan'
import { TUNE } from './plan'

type Ent = { index: number; zombies: number; barricades: number }
const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0)
const zombiesAt = (v: SeatView, loc: LocationId): number => sum(v.locations[loc]?.entrances.map((e) => e.zombies) ?? [])
const barricadesAt = (v: SeatView, loc: LocationId): number => sum(v.locations[loc]?.entrances.map((e) => e.barricades) ?? [])
const nonExiled = (v: SeatView): string[] => v.seatOrder.filter((s) => !v.seats[s]!.seat.exiled && !v.seats[s]!.seat.eliminated)
const outsideIds = (v: SeatView): LocationId[] => v.locationOrder.filter((l) => l !== 'colony')

/** A seat is armed when one of the survivors it controls carries a weapon. */
export function seatArmed(v: SeatView, seat: string): boolean {
  return (v.seats[seat]?.survivors ?? []).some((id) => v.survivors[id]?.status === 'alive' && v.survivors[id]!.equipped.some((c) => symbolsOfCard(v, c).includes('weapon')))
}

type Kind = 'everyEntrance' | 'barricades' | 'food' | 'outside' | 'decks' | 'weapons' | 'counter'
/** One unmet part of the goal: what is still missing (`left`, in units of progress) and the facts its lever needs. */
interface Leaf { kind: Kind; left: number; loc?: LocationId; n?: number; targets?: LocationId[]; perSeat?: number; symbol?: ItemSymbol }

/**
 * The barricade goals as the colony phase will leave them: this round's arrivals fill free entrance spaces, then break barricades (the colony's
 * rotation starts at entrance 1 every time). `have` is what survives and `missing` what the goal still lacks after that.
 */
function progressAfter(c: PlanCache, kind: 'everyEntrance' | 'barricades', loc: LocationId, need: number, patch?: { entrance: number; z?: number; b?: number }): { have: number; missing: number } {
  const { ent, cap } = c.board(loc, patch)
  const after = simulateArrivals(ent, cap, c.arrivals(loc)).ent
  if (kind === 'everyEntrance') { const have = after.filter((e) => e.b > 0).length; return { have, missing: after.length - have } }
  const have = Math.min(need, sum(after.map((e) => e.b)))
  return { have, missing: need - have }
}

type Builder = (c: PlanCache, node: Rec) => Leaf | null
const num = (x: unknown, d: number): number => (typeof x === 'number' ? x : d)

/**
 * Condition id -> lever. A `{code}` node is keyed by its code, a `{test}` node by its test type. Builders return null when the part is met (or has
 * nothing the planner can push). A card counter (`objectiveCounterAtLeast`) is a lever too, but only on the search side: contributing the cards stays
 * scoreObjective's job, the goal layer just makes the symbol worth finding.
 */
const LEVERS: Record<string, Builder> = {
  // Stockpile: every colony entrance holds a barricade. A barricade needs a free space on the entrance, so on a full entrance the kill comes first.
  'rule.colony.everyEntranceBarricaded': (c) => {
    const left = progressAfter(c, 'everyEntrance', 'colony', 0)
    return left.missing > 0 ? { kind: 'everyEntrance', left: left.missing, loc: 'colony' } : null
  },
  // Home Sweet Home / Kill Them (hardcore): a location carries N barricades.
  barricadesAtLeast: (c, node) => {
    const loc = (node['location'] ?? 'colony') as LocationId
    const need = num(node['value'], 1)
    if (!c.v.locations[loc]) return null
    const left = progressAfter(c, 'barricades', loc, need)
    return left.missing > 0 ? { kind: 'barricades', left: left.missing, loc, n: need } : null
  },
  // Stockpile: the supply holds `perSeat` tokens per seat that is still in, after the round's food has been paid.
  'rule.food.perNonExiledSeatAtLeast': (c, node) => {
    const perSeat = num(node['params']?.['perSeat'], 3)
    const target = perSeat * nonExiled(c.v).length
    const left = target + c.food().needed - c.v.food
    return left > 0 ? { kind: 'food', left, perSeat } : null
  },
  // Kill Them: at most n zombies outside the colony once the round's arrivals are in.
  'rule.zombies-outside-colony.atMost': (c, node) => {
    const n = num(node['params']?.['n'], 3)
    const incoming = sum(c.zombies().perLocation.filter((p) => p.location !== 'colony').map((p) => p.survivors))
    const left = sum(outsideIds(c.v).map((l) => zombiesAt(c.v, l))) + incoming - n
    return left > 0 ? { kind: 'outside', left, n } : null
  },
  // Raiding Party: n location decks emptied. A search keeps exactly one card (the rest go back under the deck), so each search removes one card:
  // the n decks nearest to empty are the targets.
  'rule.location-deck.emptyAtLeast': (c, node) => {
    const n = num(node['params']?.['n'], 1)
    const decks = outsideIds(c.v).map((l) => ({ l, k: c.v.locations[l]!.deckCount })).sort((a, b) => a.k - b.k)
    const targets = decks.slice(0, n)
    const left = sum(targets.map((d) => d.k))
    return left > 0 ? { kind: 'decks', left, n, targets: targets.filter((d) => d.k > 0).map((d) => d.l) } : null
  },
  objectiveCounterAtLeast: (c, node) => {
    const name = typeof node['value'] === 'object' && node['value'] ? String((node['value'] as Rec)['counter']) : String(node['value'])
    const need = c.objNeeds().find((n) => n.counter === name)
    return need ? { kind: 'counter', left: need.remaining, symbol: need.symbol } : null
  },
  // Leave It All Behind: every seat that is still in carries a weapon.
  'rule.non-exiled-seats.weaponEach': (c) => {
    const left = nonExiled(c.v).filter((s) => !seatArmed(c.v, s)).length
    return left > 0 ? { kind: 'weapons', left } : null
  },
}

/** `{all}` flattens, `{any}` takes the first branch whose static tests (seat count) hold; `{not}` and unknown nodes carry no lever. */
function collect(c: PlanCache, node: Rec | undefined, out: Leaf[]): void {
  if (!node) return
  if (Array.isArray(node['all'])) { for (const n of node['all'] as Rec[]) collect(c, n, out); return }
  if (Array.isArray(node['any'])) {
    const ok = (n: Rec): boolean => {
      if (n['test'] === 'seatCountAtLeast') return c.v.seatOrder.length >= num(n['value'], 0)
      if (n['not']) return !ok(n['not'] as Rec)
      if (Array.isArray(n['all'])) return (n['all'] as Rec[]).every(ok)
      return true
    }
    const pick = (node['any'] as Rec[]).find(ok)
    if (pick) collect(c, pick, out)
    return
  }
  const key = typeof node['code'] === 'string' ? (node['code'] as string) : typeof node['test'] === 'string' ? (node['test'] as string) : ''
  const leaf = LEVERS[key]?.(c, node)
  if (leaf) out.push(leaf)
}

export class Goals {
  readonly leaves: Leaf[] = []
  /** Morale points one unit of progress is worth right now (0 when there is nothing to push). */
  readonly unit: number
  readonly urgency: number
  constructor(private readonly c: PlanCache) {
    const v = c.v
    const side = recOf(v, v.objective.id)?.['sides']?.[v.objective.side] as Rec | undefined
    if (!side || v.objective.complete || c.env.betrayer || !TUNE.goalV) { this.unit = 0; this.urgency = 0; return }
    collect(c, side['complete'] as Rec | undefined, this.leaves)
    const rounds = Math.max(1, num(side['rounds'], 6))
    const spent = Math.max(0, Math.min(1, 1 - v.roundsLeft / rounds))
    this.urgency = TUNE.goalU0 + TUNE.goalU1 * spent
    const left = sum(this.leaves.map((l) => l.left))
    // a colony on its last morale cannot afford to chase a goal: the price fades below goalMorale
    // (unless the goal is nearly done: then the colony has everything to gain from finishing)
    const calm = left <= TUNE.goalNear ? 1 : Math.max(0, Math.min(1, (v.morale - TUNE.goalMoraleLow) / Math.max(1, TUNE.goalMoraleFull - TUNE.goalMoraleLow)))
    this.unit = this.leaves.length === 0 ? 0 : (TUNE.goalV * this.urgency * calm) / Math.max(TUNE.goalRmin, Math.min(TUNE.goalRmax, left))
  }
  get on(): boolean { return this.unit > 0 }
  private leaf(kind: Kind, loc?: LocationId, symbol?: ItemSymbol): Leaf | undefined { return this.leaves.find((l) => l.kind === kind && (loc === undefined || l.loc === loc) && (symbol === undefined || l.symbol === symbol)) }
  private ent(loc: LocationId, entrance: number): Ent | undefined { return this.c.v.locations[loc]?.entrances.find((e) => e.index === entrance) }

  /** Progress the barricade goals at `loc` make if `patch` happens to its board (after this round's arrivals), in units. */
  private gain(loc: LocationId, patch: { entrance: number; z?: number; b?: number }): number {
    let t = 0
    for (const l of this.leaves) {
      if (l.loc !== loc || (l.kind !== 'everyEntrance' && l.kind !== 'barricades')) continue
      t += progressAfter(this.c, l.kind, loc, l.n ?? 0, patch).have - progressAfter(this.c, l.kind, loc, l.n ?? 0).have
    }
    return t
  }
  private touches(loc: LocationId): boolean { return this.leaves.some((l) => l.loc === loc && (l.kind === 'everyEntrance' || l.kind === 'barricades')) }
  /** Value of killing a zombie at `loc` / `entrance`. */
  kill(loc: LocationId, entrance: number): number {
    if (!this.on) return 0
    let val = 0
    if (this.touches(loc)) {
      const e = this.ent(loc, entrance)
      const cap = this.c.v.locations[loc]?.capacity.entranceSpaces ?? 3
      if (e) {
        // the arrivals it spares, plus the space it opens for a barricade the goal counts (only when the entrance had no room for one before)
        const direct = this.gain(loc, { entrance, z: -1 })
        const opens = e.zombies + e.barricades >= cap ? this.gain(loc, { entrance, z: -1, b: 1 }) - direct : 0
        val += this.unit * (direct + TUNE.goalFollow * Math.max(0, opens) + (loc === 'colony' ? TUNE.goalKillSlack : 0))
      }
    }
    if (loc !== 'colony' && this.leaf('outside')) val += this.unit * TUNE.goalHunt
    return val
  }
  /** Value of raising a barricade on `entrance` of `loc`. */
  barricade(loc: LocationId, entrance: number): number {
    if (!this.on || !this.touches(loc)) return 0
    return this.unit * Math.max(0, this.gain(loc, { entrance, b: 1 }))
  }
  /** Value of one search card drawn at `loc` (the deck-emptying goal). */
  search(loc: LocationId): number {
    if (!this.on) return 0
    const d = this.leaf('decks')
    return d?.targets?.includes(loc) ? this.unit * TUNE.goalSearch : 0
  }
  /** Value of a food token reaching the supply (and the price of spending one). */
  food(): number { return this.on && this.leaf('food') ? this.unit : 0 }
  /** Value of finding a card of `symbol` for a card counter the objective still wants (searching only: handing the card in is scoreObjective's). */
  counter(symbol: ItemSymbol): number {
    if (!this.on) return 0
    const l = this.leaf('counter', undefined, symbol)
    return l ? this.unit * TUNE.goalCounter : 0
  }
  /** Food tokens still missing from the supply (0 without a supply goal). */
  foodLeft(): number { return this.on ? (this.leaf('food')?.left ?? 0) : 0 }
  /** Value of putting a weapon on one of this seat's survivors. */
  arm(): number { return this.on && this.leaf('weapons') && !seatArmed(this.c.v, this.c.env.me) ? this.unit * TUNE.goalArm : 0 }
  /** What the survivor is worth at `loc`, as a goal worker: hunting, barricading, or searching the target deck, per round it can work there. */
  post(sid: SurvivorId, loc: LocationId): number {
    if (!this.on) return 0
    const c = this.c
    const v = c.v
    if (loc === 'colony') return 0
    let val = 0
    const dice = v.seats[c.env.me]!.dice.filter((d) => !d.used)
    const atk = c.dieNeed(sid, 'attack')
    const hit = dice.filter((d) => atk === null || d.value >= atk).length
    const mates = (v.seats[c.env.me]!.survivors).filter((s) => s !== sid && v.survivors[s]?.status === 'alive' && v.survivors[s]!.location !== 'colony').length
    if (this.leaf('outside')) {
      const z = zombiesAt(v, loc)
      const kills = Math.min(z, hit / (1 + mates))
      // every survivor outside at the colony phase draws one more zombie to its location: a hunter must out-kill that
      val += (kills * (this.unit * TUNE.goalHunt - c.exposureCost(sid)) - this.unit * TUNE.goalHunt * TUNE.goalSpawn) * TUNE.goalPost
    }
    const bar = this.leaf('barricades', loc)
    if (bar) {
      const others = Object.values(v.survivors).some((s) => s.status === 'alive' && s.location === loc && s.id !== sid)
      val += this.unit * (others ? TUNE.goalCrowd : 1) * (dice.length > 0 ? 1 : 0.4)
    }
    return val
  }
  /** The colony's pull on a survivor who could be home: kills that free spaces and barricades the goal counts. */
  home(): number {
    if (!this.on) return 0
    const v = this.c.v
    const need = this.leaf('everyEntrance', 'colony')?.left ?? 0
    const bar = this.leaf('barricades', 'colony')?.left ?? 0
    if (need + bar === 0) return 0
    const dice = v.seats[this.c.env.me]!.dice.filter((d) => !d.used).length
    return this.unit * Math.min(2, dice) * TUNE.goalHome
  }
}
