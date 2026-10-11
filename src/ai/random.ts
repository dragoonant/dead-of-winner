// The random bot (40 §tier random): a weighted draw over legalActions, seeded by (seed, decision id) so a run reproduces.
// It only ever sees its SeatView and the legal list (00 §13). The weights lean toward play that moves a game along
// (search when a die qualifies, kill zombies at the colony, feed the crisis matching cards, vote no, end the turn once the
// dice are gone); nothing here reads a number the engine did not put in the view or the bundle.
import { bundleFor, deriveSeed, nextFloat } from '../engine/index'
import type { Action, Decider, ItemSymbol, PendingDecision, SeatId } from '../engine/index'
import type { SeatView } from '../engine/view'

type Rec = Record<string, unknown>

function symbolsOf(v: SeatView, cardId: string): ItemSymbol[] {
  const defId = v.cards[cardId]?.defId
  if (!defId) return []
  let rec: Rec | undefined
  try { rec = bundleFor(v).byId[defId] as Rec | undefined } catch { rec = undefined }
  if (!rec) return []
  const many = rec['symbols'] as ItemSymbol[] | undefined
  const one = rec['symbol'] as ItemSymbol | undefined
  return many ?? (one ? [one] : [])
}
function crisisPrevent(v: SeatView): ItemSymbol[] {
  if (!v.crisis.cardId) return []
  try { return ((bundleFor(v).byId[v.crisis.cardId] as Rec | undefined)?.['prevent'] as ItemSymbol[] | undefined) ?? [] } catch { return [] }
}
const matchesCrisis = (v: SeatView, cardId: string): boolean => { const p = crisisPrevent(v); return symbolsOf(v, cardId).some((s) => p.includes(s)) }
const zombiesAt = (v: SeatView, loc: string): number => v.locations[loc]?.entrances.reduce((n, e) => n + e.zombies, 0) ?? 0
const unusedDice = (v: SeatView, seat: SeatId): number => v.seats[seat]?.dice.filter((d) => !d.used).length ?? 0

const woundsOn = (v: SeatView, id: string): number => { const s = v.survivors[id]; return s ? s.wounds + s.frostbite : 0 }
/** A card whose play adds food to the supply (the bot reads the record through the engine's bundle, never a number of its own). */
function addsFood(v: SeatView, cardId: string): boolean {
  const defId = v.cards[cardId]?.defId
  if (!defId) return false
  try { return JSON.stringify((bundleFor(v).byId[defId] as Rec | undefined)?.['play'] ?? null).includes('"op":"food"') } catch { return false }
}

/** Relative weight of one legal action for the seat that owns the decision. Every weight is > 0 so any legal answer stays possible. */
export function weightOf(v: SeatView, pending: PendingDecision, a: Action): number {
  const seat = pending.seat === 'all' ? v.seat : pending.seat
  switch (a.type) {
    case 'endTurn': {
      const dice = unusedDice(v, seat)
      const actions = v.turn?.actions ?? 0
      return dice === 0 ? 20 : actions >= 8 ? 10 : 1
    }
    case 'attack': {
      if (a.target.kind === 'survivor') return 0.3
      const careful = 1 + 2 * woundsOn(v, a.survivorId) // every kill is an exposure roll: a wounded survivor hangs back
      return (a.target.location === 'colony' ? 12 : 8) / careful
    }
    case 'search': return 10
    case 'useAbility': return 3
    case 'playCard': return addsFood(v, a.cardId) ? 6 : 3
    case 'barricade': {
      const loc = v.survivors[a.survivorId]?.location ?? 'colony'
      return zombiesAt(v, loc) > 0 ? 3 : 1
    }
    case 'cleanWaste': return v.waste.length >= 7 ? 4 : 0.5
    case 'move': return 1.5 / (1 + 2 * woundsOn(v, a.survivorId))
    case 'attract': return a.from.length === 0 ? 0.05 : a.to ? 0.1 : 0.5
    case 'spendFood': return 0.5
    case 'request': return 0.3
    case 'handOff': return 0.3
    case 'contributeObjective': return 2
    case 'callVote': return 0.05
    case 'contributeCrisis': {
      if (a.cardIds.length === 0) return 2
      return a.cardIds.every((c) => matchesCrisis(v, c)) ? 10 : 0.2
    }
    case 'castVotes': return Object.values(a.votes).every((yes) => !yes) ? 20 : 0.2
    case 'biteSpread': return a.choice === 'roll' ? 2 : 1
    case 'keepCard': return 3
    case 'makeNoise': return 1
    case 'respondRequest': return a.give === null ? 2 : 1
    default: return 1
  }
}

/** Random bot: weighted over legalActions, seeded by (seed, decisionId); never touches state.rng, so logs replay identically. */
export function createRandomDecider(seed: string): Decider {
  return {
    async decide(v, pending, legal) {
      if (legal.length === 0) throw new Error(`random decider: no legal actions for ${pending.id} (seat ${String(pending.seat)})`)
      const weights = legal.map((a) => Math.max(1e-6, weightOf(v, pending, a)))
      const total = weights.reduce((x, y) => x + y, 0)
      const [f] = nextFloat(deriveSeed(seed, pending.id))
      let acc = f * total
      for (let i = 0; i < legal.length; i++) {
        acc -= weights[i]!
        if (acc < 0) return legal[i]!
      }
      return legal[legal.length - 1]!
    },
  }
}
