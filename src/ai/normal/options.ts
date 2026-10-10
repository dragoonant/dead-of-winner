// Static valuation of effect lists and option labels (40 §10, slimmed): Crossroads options, objective/effect/item choices.
// A view has no `step`, so each option's effect list from the public data bundle is folded into morale-equivalent points.
import type { Action } from '../../engine/index'
import type { SeatView } from '../../engine/view'
import { OVERRUN_COST, type Rec } from './info'

const num = (x: unknown, d = 1): number => (typeof x === 'number' ? x : d)

/** Value of an effect list to the colony, in morale points (positive is good). Unknown ops count 0. */
export function valueOfEffects(nodes: unknown, depth = 0): number {
  if (!Array.isArray(nodes) || depth > 4) return 0
  let t = 0
  for (const raw of nodes) {
    const n = raw as Rec
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
      case 'choose': t += Math.max(...((n['options'] as Rec[] | undefined) ?? [{}]).map((o) => valueOfEffects(o['effect'], depth + 1))); break
      default: break
    }
  }
  return t
}

export function crossroadsValue(v: SeatView, cardId: string | undefined, optionId: string, rec: (id: string) => Rec | undefined): number {
  const card = cardId ? rec(cardId) : undefined
  const opt = (card?.['options'] as Rec[] | undefined)?.find((o) => o['id'] === optionId)
  return valueOfEffects(opt?.['effect'])
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
