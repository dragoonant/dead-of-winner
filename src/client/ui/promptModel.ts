// Groups the legal actions of a `turnAction` decision into what the action list shows (50 §5): one family per (action type, survivor),
// each with its variants (targets). Variants that differ only by die are ONE variant with several actions; the die chips choose among them.
// Pure: the client never invents an action, it only picks among the engine's legalActions.
import type { Action } from '../../engine/index'
import { camelWords } from './promptText'

export interface LabelNames {
  survivor(id: string): string
  loc(id: string): string
  seat(id: string): string
  card(cardId: string): string
}
export interface Variant { key: string; label: string; actions: Action[] }
export interface Family { key: string; type: Action['type']; survivorId: string | null; label: string; variants: Variant[] }

type Loose = Record<string, unknown>
/** The action with the fields that never distinguish one choice from another removed. */
export function variantKey(a: Action, keepDie = false): string {
  const { decisionId: _d, seat: _s, dieId, ...rest } = a as unknown as Loose
  return JSON.stringify(keepDie ? { ...rest, dieId } : rest)
}

function familyOf(a: Action): { key: string; label: string; survivorId: string | null } | null {
  const sid = (a as unknown as Loose)['survivorId'] as string | undefined
  switch (a.type) {
    case 'attack': return { key: `attack-${a.target.kind}:${sid}`, label: a.target.kind === 'zombie' ? 'Attack a zombie' : 'Attack a survivor', survivorId: sid ?? null }
    case 'search': return { key: `search:${sid}`, label: 'Search', survivorId: sid ?? null }
    case 'barricade': return { key: `barricade:${sid}`, label: 'Barricade', survivorId: sid ?? null }
    case 'cleanWaste': return { key: `cleanWaste:${sid}`, label: 'Clean waste', survivorId: sid ?? null }
    case 'attract': return { key: `attract:${sid}`, label: 'Attract zombies', survivorId: sid ?? null }
    case 'move': return { key: `move:${sid}`, label: 'Move', survivorId: sid ?? null }
    case 'useAbility': return { key: `ability:${sid}:${a.abilityId}`, label: `Ability: ${camelWords(a.abilityId)}`, survivorId: sid ?? null }
    case 'playCard': return { key: `card:${a.cardId}`, label: 'Play card', survivorId: null }
    case 'contributeObjective': return { key: 'objective', label: 'Add to objective', survivorId: null }
    case 'spendFood': return { key: 'spendFood', label: 'Spend food', survivorId: null }
    case 'request': return { key: 'request', label: 'Ask for a card', survivorId: null }
    case 'handOff': return { key: 'handOff', label: 'Hand off an item', survivorId: null }
    case 'callVote': return { key: 'callVote', label: 'Call a vote', survivorId: null }
    default: return null // endTurn and contributeCrisis have their own controls
  }
}

function variantLabel(a: Action, N: LabelNames): string {
  switch (a.type) {
    case 'attack': return a.target.kind === 'zombie' ? `Zombie at ${a.target.location === 'colony' ? `gate ${a.target.entrance}` : N.loc(a.target.location)}` : N.survivor(a.target.survivorId)
    case 'search': return 'Search here'
    case 'barricade': return `Gate ${a.entrance}`
    case 'cleanWaste': return 'Clean the waste pile'
    case 'attract': return (a.from.length === 0 ? 'None (0 zombies)' : a.from.map((f) => `${f.count} from ${f.location === 'colony' ? `gate ${f.entrance}` : N.loc(f.location)}`).join(', ')) + (a.to ? ` to ${a.to.map((t) => `gate ${t.entrance}${t.count > 1 ? ` x${t.count}` : ''}`).join(' + ')}` : '')
    case 'move': return N.loc(a.to)
    case 'useAbility': return camelWords(a.abilityId)
    case 'playCard': return a.equipTo ? `Equip on ${N.survivor(a.equipTo)}` : `Play ${N.card(a.cardId)}`
    case 'contributeObjective': return N.card(a.cardId)
    case 'spendFood': return `${a.tokens} food on die ${a.dieId.split(':d')[1] ?? ''}`.trim()
    case 'request': return `${a.to === 'all' ? 'Everyone' : N.seat(a.to)}: ${a.defId ? 'a specific card' : a.symbol ? `a ${a.symbol} card` : 'a card'}`
    case 'handOff': return `${N.card(a.cardId)} to ${N.survivor(a.toSurvivorId)}`
    case 'callVote': return `Exile ${N.seat(a.target)}`
    default: return a.type
  }
}

export function groupTurnActions(legal: readonly Action[], N: LabelNames): Family[] {
  const families = new Map<string, Family>()
  for (const a of legal) {
    const f = familyOf(a)
    if (!f) continue
    let fam = families.get(f.key)
    if (!fam) { fam = { key: f.key, type: a.type, survivorId: f.survivorId, label: f.label, variants: [] }; families.set(f.key, fam) }
    const key = variantKey(a, a.type === 'spendFood')
    let v = fam.variants.find((x) => x.key === key)
    if (!v) { v = { key, label: variantLabel(a, N), actions: [] }; fam.variants.push(v) }
    v.actions.push(a)
  }
  return [...families.values()]
}

/** The die ids a variant can be played with, in the order given. */
export function dieIdsOf(v: Variant): string[] {
  return v.actions.map((a) => (a as unknown as Loose)['dieId']).filter((d): d is string => typeof d === 'string')
}
