// Static valuation of effect lists and option labels (40 §10, slimmed): Crossroads options, objective/effect/item choices.
// A view has no `step`, so each option's effect list from the public data bundle is folded into morale-equivalent points.
import type { Action } from '../../engine/index'
import type { SeatView } from '../../engine/view'
import { OVERRUN_COST, type Rec } from './info'

const num = (x: unknown, d = 1): number => (typeof x === 'number' ? x : d)

/** Extra main-objective victory conditions (Army, The Deputy) as the leaf tests they hold, e.g. foodAtLeast 5. */
export function conditionLeaves(cond: unknown): Rec[] {
  if (!cond || typeof cond !== 'object') return []
  const c = cond as Rec
  if (Array.isArray(c['all'])) return (c['all'] as unknown[]).flatMap(conditionLeaves)
  if (Array.isArray(c['any'])) return (c['any'] as unknown[]).flatMap(conditionLeaves)
  return typeof c['test'] === 'string' ? [c] : []
}
/** The price of a printed victory condition the table has to meet on top of the objective (food in the supply, zombie-free places). */
export function victoryPenalty(cond: unknown): number {
  let t = 0
  for (const leaf of conditionLeaves(cond)) {
    if (leaf['test'] === 'foodAtLeast') t += 0.12 * num(leaf['value'], 5)
    else if (leaf['test'] === 'zombiesAtMost') t += 1.6
    else t += 1
  }
  return t
}

/** Static value of the Crossroads helper hooks (`crossroads.rule.*`) that carry a plain effect list or a lasting rule. */
function valueOfCode(n: Rec, depth: number, colony: number): number {
  const p = (n['params'] as Rec | undefined) ?? {}
  switch (n['code']) {
    case 'crossroads.rule.attach': {
      const name = String(p['name'] ?? '')
      if (name === 'victory') return -victoryPenalty(p['condition'])
      if (name === 'addicted') return -0.8
      if (name === 'noContributions') return -1
      if (p['attackSkip']) return 0.8 // kills without the exposure roll
      if (p['upkeep']) return -0.35
      if (p['ability'] || p['global'] || p['snowmobile'] || p['wasteStep']) return 0.4
      return 0
    }
    // each survivor at a place rolls a die; the effect lands on the ones at or under `atMost`
    case 'crossroads.rule.rollEach': return valueOfEffects(p['then'], depth + 1) * Math.max(1, colony) * (num(p['atMost'], 3) / 6)
    case 'crossroads.rule.eachSeatPick': return valueOfEffects(p['then'], depth + 1) * 3
    case 'crossroads.rule.pick': return valueOfEffects(p['then'], depth + 1)
    case 'crossroads.rule.ifAlive': case 'crossroads.rule.ifInPlay': return valueOfEffects(p['then'], depth + 1) * 0.8
    case 'crossroads.rule.collectiveDiscard': return valueOfEffects(p['then'], depth + 1) - 0.9
    case 'crossroads.rule.rollThen': {
      const ranges = (p['ranges'] as Rec[] | undefined) ?? []
      return ranges.reduce((a, r) => a + valueOfEffects(r['then'], depth + 1) * ((num(r['atMost'], 6) - num(r['atLeast'], 1) + 1) / 6), 0)
    }
    case 'crossroads.rule.recruit': return 0.6
    case 'crossroads.rule.searchDeck': return 0.5
    case 'crossroads.rule.recoverRemoved': return 0.5
    case 'crossroads.rule.spendDice': return -0.25 * num(p['count'], 1)
    case 'crossroads.rule.removeFromHand': case 'crossroads.rule.wasteCard': return -0.3
    case 'crossroads.rule.woundByInfluence': return -0.25
    default: return 0
  }
}

/** Value of an effect list to the colony, in morale points (positive is good). Unknown ops count 0. `colony` = survivors standing at the colony. */
export function valueOfEffects(nodes: unknown, depth = 0, colony = 8): number {
  if (!Array.isArray(nodes) || depth > 4) return 0
  let t = 0
  for (const raw of nodes) {
    const n = raw as Rec
    if (typeof n['code'] === 'string') { t += valueOfCode(n, depth, colony); continue }
    const count = num(n['count'], 1)
    const scopeWho = (n['scope'] as Rec | undefined)?.['who']
    const wide = scopeWho === 'allSeats' || scopeWho === 'atLocation' ? 2 : 1
    switch (n['op']) {
      case 'morale': t += num(n['value'], 0); break
      case 'food': t += 0.25 * num(n['value'], 0); break
      case 'starvation': t -= 0.8 * num(n['value'], 0); break
      case 'addZombies': t -= 0.18 * num(n['value'], count); break
      case 'killZombies': t += 0.12 * count; break
      case 'addBarricade': t += 0.1 * count; break
      case 'removeBarricade': t -= 0.1 * count; break
      case 'addNoise': t -= 0.12 * count; break
      case 'wound': t -= (n['kind'] === 'frostbite' ? 0.3 : 0.2) * count * wide; break
      case 'heal': t += 0.2 * count; break
      case 'exposure': t -= 0.15 * wide; break
      case 'killSurvivor': t -= OVERRUN_COST * count; break
      case 'removeSurvivor': t -= 0.5 * count; break
      case 'addSurvivor': t += 0.4 * count; break
      case 'addHelpless': t -= 0.3 * count; break
      case 'draw': case 'drawFromDeck': t += 0.3 * count; break
      case 'discard': case 'removeCard': t -= 0.3 * count; break
      case 'forbid': t -= 0.3; break
      case 'grant': t += 0.15; break
      case 'choose': t += Math.max(...((n['options'] as Rec[] | undefined) ?? [{}]).map((o) => valueOfEffects(o['effect'], depth + 1, colony))); break
      default: break
    }
  }
  return t
}

const atColony = (v: SeatView): number => Object.values(v.survivors).filter((s) => s.status === 'alive' && s.location === 'colony').length

export function crossroadsValue(v: SeatView, cardId: string | undefined, optionId: string, rec: (id: string) => Rec | undefined): number {
  const card = cardId ? rec(cardId) : undefined
  const opt = (card?.['options'] as Rec[] | undefined)?.find((o) => o['id'] === optionId)
  const nodes = opt?.['effect'] as Rec[] | undefined
  // an option that is a vote is worth what the table is likely to choose: the better of its two outcomes, shaded toward the worse
  const vote = nodes?.find((x) => x['op'] === 'vote')
  if (vote) {
    const [yes, no] = voteSides(vote, v)
    return 0.4 * Math.max(yes, no) + 0.6 * Math.min(yes, no)
  }
  return valueOfEffects(nodes, 0, atColony(v))
}

/** The values of a vote effect's two outcomes (first option = the vote passes). */
export function voteSides(vote: Rec, v: SeatView): [number, number] {
  const opts = (vote['options'] as Rec[] | undefined) ?? []
  const col = atColony(v)
  return [valueOfEffects(opts[0]?.['effect'], 0, col), valueOfEffects(opts[1]?.['effect'], 0, col)]
}

/** For an effect vote raised by the open Crossroads card: how much better the passing outcome is than the failing one (null when not found). */
export function effectVoteEdge(v: SeatView, rec: (id: string) => Rec | undefined): number | null {
  const card = v.crossroads.active ? rec(v.crossroads.active.cardId) : undefined
  if (!card) return null
  const find = (nodes: unknown): Rec | undefined => {
    if (!Array.isArray(nodes)) return undefined
    for (const x of nodes as Rec[]) if (x['op'] === 'vote') return x
    return undefined
  }
  for (const o of (card['options'] as Rec[] | undefined) ?? []) {
    const vote = find(o['effect'])
    if (vote) { const [yes, no] = voteSides(vote, v); return yes - no }
  }
  return null
}

const GOOD = /\b(gain|heal|draw|food|morale up|raise|barricade|kill|safe|free|bonus|extra|add a survivor|new survivor)\b/i
const BAD = /\b(lose|loses|wound|wounded|die|dies|dead|killed|noise|discard|zombie|zombies|bite|frostbite|starve|sacrifice|exile)\b/i
/** Rough score of an option from its label alone (generic effect/objective choices). */
export function labelScore(label: string): number {
  const good = (label.match(new RegExp(GOOD, 'gi')) ?? []).length
  const bad = (label.match(new RegExp(BAD, 'gi')) ?? []).length
  return good * 0.5 - bad * 0.6
}

export function optionOf(a: Action): string | undefined {
  const x = a as unknown as { optionId?: string }
  return x.optionId
}
