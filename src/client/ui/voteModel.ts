// What a Crossroads group vote asks (the prompt for a `votes` decision that is not an exile vote): the card's own labels for Yes and No, read from
// its record. Pure over a loose record so it is unit tested without the bundle.
type Loose = Record<string, unknown>

export interface EffectVoteLabels { yes: string; no: string }

function findVote(effects: unknown): Loose | null {
  if (!Array.isArray(effects)) return null
  for (const e of effects as Loose[]) {
    if (e && e['op'] === 'vote') return e
    const inner = findVote(e?.['effect']) ?? findVote(e?.['options'] && Array.isArray(e['options']) ? (e['options'] as Loose[]).flatMap((o) => (Array.isArray(o['effect']) ? (o['effect'] as unknown[]) : [])) : null)
    if (inner) return inner
  }
  return null
}

/** The Yes and No labels of the first vote in a Crossroads record (its first listed option wins when several carry one). Falls back to plain Yes and No. */
export function effectVoteLabels(card: Loose | undefined): EffectVoteLabels {
  const options = (card?.['options'] as Loose[] | undefined) ?? []
  for (const o of options) {
    const vote = findVote(o['effect'])
    const opts = vote?.['options'] as { label?: string }[] | undefined
    if (opts && opts.length >= 2) return { yes: opts[0]?.label || 'Yes', no: opts[1]?.label || 'No' }
  }
  return { yes: 'Yes', no: 'No' }
}

/** True for a `votes` decision that came from a card effect rather than a call-vote to exile a seat. */
export function isEffectVote(pd: { kind: string; context: { data?: unknown } }, hasExileVote: boolean): boolean {
  return pd.kind === 'votes' && ((pd.context.data as { code?: string } | undefined)?.code === 'effectVote' || !hasExileVote)
}

/** Walks a plain JSON value (the engine's continuation data on a pending decision) for the first object that satisfies `hit`. Depth-limited. */
function walk(value: unknown, hit: (o: Loose) => boolean, depth = 0): Loose | null {
  if (!value || typeof value !== 'object' || depth > 12) return null
  if (!Array.isArray(value) && hit(value as Loose)) return value as Loose
  for (const v of Array.isArray(value) ? value : Object.values(value as Loose)) {
    const r = walk(v, hit, depth + 1)
    if (r) return r
  }
  return null
}

export interface EffectVoteSource { cardId: string | null; yes: string; no: string }
/** The card and the two answers of an open Crossroads vote, read from the decision itself (its continuation holds the vote node and the card that raised it).
 *  Falls back to the card's record when the continuation is absent. */
export function effectVoteSource(pd: { context: { data?: unknown } }, fallbackCard?: Loose, fallbackCardId?: string | null): EffectVoteSource {
  const cont = (pd.context.data as { cont?: unknown } | undefined)?.cont
  const node = walk(cont, (o) => o['op'] === 'vote' && Array.isArray(o['options']))
  const rc = walk(cont, (o) => typeof o['sourceId'] === 'string' && o['sourceKind'] === 'crossroads')
  const opts = node?.['options'] as { label?: string }[] | undefined
  if (opts && opts.length >= 2) return { cardId: (rc?.['sourceId'] as string | undefined) ?? fallbackCardId ?? null, yes: opts[0]?.label || 'Yes', no: opts[1]?.label || 'No' }
  return { cardId: (rc?.['sourceId'] as string | undefined) ?? fallbackCardId ?? null, ...effectVoteLabels(fallbackCard) }
}
