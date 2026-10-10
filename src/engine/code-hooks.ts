// The code escape hatch (spec 21 §11): `{ "code": "<source>.<slug>.<what>" }` nodes that no op can express.
// Each hook gets the HookContext and the node's params, returns a boolean (conditions), a HookResult (effects) or an
// objective report. Keep each under 40 lines; add a golden test per hook (60). Other modules add hooks with registerCodeHook.
import type { CodeConditionHook, CodeEffectHook, CodeHookRegistry, CodeObjectiveHook, HookContext, HookResult } from './hooks'
import { nextFloat } from './rng'
import type { GameState, ItemSymbol, LocationId, SeatId, SurvivorId, SurvivorState } from './types'
import { addLasting, defOf, mkAcc, recOf, symbolsOf } from './effects'

const hasCode = (nodes: unknown, code: string): boolean => JSON.stringify(nodes ?? null).includes(`"${code}"`)

/** Sparky (and a survivor wearing Rotten Flesh): a spreading bite passes over him (the bite chain asks this before it offers him the choice). */
export function skipsBiteSpread(state: GameState, survivorId: SurvivorId): boolean {
  const sv = state.survivors[survivorId]
  if (!sv || sv.status !== 'alive') return false
  if (hasCode(recOf(state, survivorId)?.ability?.effect, 'survivor.sparky.skipBiteSpread')) return true
  return sv.equipped.some((c) => hasCode(defOf(state, c)?.equipped, 'item.rotten-flesh.skipBiteSpread'))
}

// ---------- objective helpers (the `rule.*` hooks below read plain state; `seat` null = no seat of its own) ----------
const num = (params: Record<string, unknown> | undefined, key: string, dflt: number): number => {
  const v = Number(params?.[key])
  return Number.isFinite(v) ? v : dflt
}
const liveSeats = (state: GameState): SeatId[] => state.seatOrder.filter((s) => !state.seats[s]!.seat.eliminated)
const aliveOf = (state: GameState, seat: SeatId | null): SurvivorState[] =>
  seat ? (state.seats[seat]?.survivors ?? []).map((id) => state.survivors[id]!).filter((s) => s && s.status === 'alive') : []
const equippedWith = (state: GameState, seat: SeatId | null, symbol: ItemSymbol): number =>
  aliveOf(state, seat).reduce((n, s) => n + s.equipped.filter((c) => symbolsOf(defOf(state, c)).includes(symbol)).length, 0)
const barricadesAt = (state: GameState, loc: LocationId): number => state.locations[loc]?.entrances.reduce((a, e) => a + e.barricades, 0) ?? 0
const wounded = (s: SurvivorState): boolean => s.wounds + s.frostbite > 0
const report = (label: string, have: number, need: number) => ({ complete: have >= need, parts: [{ label, have, need }] })
/** The largest group among the OTHER live seats. */
const bestOther = (state: GameState, seat: SeatId | null, count: (s: SeatId) => number): number =>
  Math.max(0, ...liveSeats(state).filter((s) => s !== seat).map(count))
/** Bev Russel's Crossroads card: she cannot be the overrun victim at the location named by the effect (F 2.2.1). */
export function overrunImmune(state: GameState, location: LocationId): boolean {
  return state.effects.some((e) => e.grants?.includes('overrunImmune') && e.data?.location === location)
}

const noop = (ctx: HookContext): HookResult => ({ state: ctx.state, events: [] })

/** Private peek: EffectApplied carries `ownerSeat`, so redactEvent keeps the card ids inside that seat's feed (events.ts has no peek event). */
function peek(ctx: HookContext, seat: SeatId, ids: string[], name: string, state: GameState): HookResult {
  return { state, events: [{ type: 'EffectApplied', effectId: `peek:${ctx.state.rollSeq}:${name}`, sourceId: 'peek', name, targetIds: ids, expires: null, refreshed: false, ownerSeat: seat }] }
}

const effects: Record<string, CodeEffectHook> = {
  'survivor.sparky.skipBiteSpread': noop, // a marker: the bite chain reads skipsBiteSpread()
  /** Annaleigh Chan: look at one random card from every other seat's hand. */
  'survivor.annaleigh-chan.peekHands': (ctx) => {
    let state = ctx.state
    const seen: string[] = []
    for (const s of state.seatOrder) {
      if (s === ctx.seat) continue
      const hand = state.seats[s]!.hand
      if (!hand.length) continue
      const [f, rng] = nextFloat(state.rng)
      state = { ...state, rng }
      seen.push(hand[Math.min(hand.length - 1, Math.floor(f * hand.length))]!)
    }
    return peek(ctx, ctx.seat, seen, 'peekHands', state)
  },
  /** Talia Jones: look at the top two crisis cards (the reorder is table talk; the order stays as it is). */
  'survivor.talia-jones.reorderTop': (ctx) => peek(ctx, ctx.seat, ctx.state.crisisDeck.slice(0, 2), 'reorderTop', ctx.state),
  /** Bev Russel: for this effect's location she counts as a survivor for zombies but cannot die to an overrun (F 2.2.1). */
  'crossroads.bev-russel.immune': (ctx, params) => {
    const acc = mkAcc(ctx.state)
    const location = (params.location as LocationId | undefined) ?? ctx.location ?? 'loc.school'
    addLasting(acc, { name: 'xr.bev-russel#immune', sourceId: 'xr.bev-russel', sourceKind: 'crossroads', grants: ['overrunImmune'], data: { location }, duration: 'game' })
    return { state: acc.state, events: acc.events }
  },
  /** Rotten Flesh: a marker like Sparky's; the bite chain reads skipsBiteSpread(). */
  'item.rotten-flesh.skipBiteSpread': noop,
}

const conditions: Record<string, CodeConditionHook> = {
  /** Riot: the helpless tokens at the colony outnumber the survivors there. */
  'crossroads.riot.helplessOutnumber': (ctx) => {
    const st = ctx.state
    const alive = Object.values(st.survivors).filter((s) => s.status === 'alive' && s.location === 'colony').length
    return (st.locations['colony']?.helpless ?? 0) > alive
  },
}

const objectives: Record<string, CodeObjectiveHook> = {
  /** "Main objective complete" as a node inside secret and exiled objectives (11 O7.6). */
  'rule.objective.mainComplete': (state) => ({ complete: state.objective.complete, parts: [{ label: 'Main objective', have: state.objective.complete ? 1 : 0, need: 1 }] }),
  /** Leader / Cult Leader / New Friends: the seat controls at least `margin` more survivors than any other seat. */
  'rule.group-size.mostSurvivors': (state, seat, params) => {
    const mine = aliveOf(state, seat).length
    const other = bestOther(state, seat, (s) => aliveOf(state, s).length)
    return report('survivors over the next largest group', mine - other, num(params, 'margin', 1))
  },
  /** Revenge / Vengeance / Serial Killers: survivors that left the game (dead or removed; helpless tokens never count). */
  'rule.survivors-removed.atLeast': (state, _seat, params) =>
    report('survivors gone from the game', Object.values(state.survivors).filter((s) => s.status !== 'alive').length, num(params, 'n', 1)),
  /** Trigger Happy: weapon cards equipped across the seat's survivors. */
  'rule.seat-survivors.weaponsEquippedAtLeast': (state, seat, params) => report('weapons equipped', equippedWith(state, seat, 'weapon'), num(params, 'n', 1)),
  /** Barter (betrayer): cards with `symbol` equipped across the seat's survivors. */
  'rule.seat.equippedSymbolAtLeast': (state, seat, params) => {
    const symbol = String(params?.['symbol'] ?? 'education') as ItemSymbol
    return report(`${symbol} cards equipped`, equippedWith(state, seat, symbol), num(params, 'n', 1))
  },
  /** New Friends (betrayer): locations outside the colony whose item deck is empty. */
  'rule.location-deck.emptyAtLeast': (state, _seat, params) =>
    report('emptied item decks', state.locationOrder.filter((l) => l !== 'colony' && state.locations[l]!.deck.length === 0).length, num(params, 'n', 1)),
  /** Shelter: at least `locations` locations (the colony counts) each carrying `barricades` or more barricades. */
  'rule.locations.barricadedAtLeast': (state, _seat, params) => {
    const need = num(params, 'barricades', 2)
    return report(`locations with ${need}+ barricades`, state.locationOrder.filter((l) => barricadesAt(state, l) >= need).length, num(params, 'locations', 3))
  },
  /** Shelter (betrayer): more equipped weapons than any other seat. */
  'rule.seat.mostEquippedWeapons': (state, seat) =>
    report('weapons over the next best seat', equippedWith(state, seat, 'weapon') - bestOther(state, seat, (s) => equippedWith(state, s, 'weapon')), 1),
  /** South (betrayer): alive survivors the seat does not control that carry a wound. */
  'rule.foreign-survivors.woundedAtLeast': (state, seat, params) =>
    report('wounded survivors of other seats', Object.values(state.survivors).filter((s) => s.status === 'alive' && s.owner !== seat && wounded(s)).length, num(params, 'n', 1)),
  /** Germ-a-phobe / The Chosen: the seat has survivors and none carries a wound or frostbite. */
  'rule.seat-survivors.allWoundless': (state, seat) => {
    const mine = aliveOf(state, seat)
    const clean = mine.filter((s) => !wounded(s)).length
    return { complete: mine.length > 0 && clean === mine.length, parts: [{ label: 'survivors without a wound', have: clean, need: Math.max(1, mine.length) }] }
  },
  /** The Chosen (betrayer): barricades on the whole board. */
  'rule.barricades.totalAtLeast': (state, _seat, params) =>
    report('barricades on the board', state.locationOrder.reduce((n, l) => n + barricadesAt(state, l), 0), num(params, 'n', 1)),
  /** Masochist: one of the seat's survivors carries at least `n` wound tokens (frostbite counts as a wound). */
  'rule.seat-survivors.anyWoundsAtLeast': (state, seat, params) =>
    report('wounds on the most wounded survivor', Math.max(0, ...aliveOf(state, seat).map((s) => s.wounds + s.frostbite)), num(params, 'n', 2)),
}

export const CODE_HOOKS: CodeHookRegistry = { conditions, effects, objectives }

export function registerCodeHook(kind: 'conditions', name: string, fn: CodeConditionHook): void
export function registerCodeHook(kind: 'effects', name: string, fn: CodeEffectHook): void
export function registerCodeHook(kind: 'objectives', name: string, fn: CodeObjectiveHook): void
export function registerCodeHook(kind: keyof CodeHookRegistry, name: string, fn: CodeConditionHook | CodeEffectHook | CodeObjectiveHook): void {
  ;(CODE_HOOKS[kind] as Record<string, unknown>)[name] = fn
}
/** Every registered name, for tools/validate-data.ts (V-20). */
export const codeHookNames = (): string[] => [...Object.keys(effects), ...Object.keys(conditions), ...Object.keys(objectives)]
