// The code escape hatch (spec 21 §11): `{ "code": "<source>.<slug>.<what>" }` nodes that no op can express.
// Each hook gets the HookContext and the node's params, returns a boolean (conditions), a HookResult (effects) or an
// objective report. Keep each under 40 lines; add a golden test per hook (60). Other modules add hooks with registerCodeHook.
import type { CodeConditionHook, CodeEffectHook, CodeHookRegistry, CodeObjectiveHook, HookContext, HookResult } from './hooks'
import { nextFloat } from './rng'
import type { GameState, ItemSymbol, LocationId, SeatId, SurvivorId, SurvivorState } from './types'
import { addLasting, defOf, influenceOf, mkAcc, nonExiledSeats, objectiveNeed, recOf, routines, symbolsOf } from './effects'
import type { Acc } from './effects'
import { roll } from './rng'
import { addWoundInto } from './exposure'
import { applyExiledPlacement, applyChooseLeader, isExiledPlacement, killSurvivor } from './survivors'
import { aliveOf as aliveIdsOf } from './decks'

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

// ---------- M2 helpers: hooks run inside the effect interpreter, which cannot suspend for a choice, so they pick for the player (RULINGs in docs/needs-rules-check.md) ----------
/** A kill/wound inside a hook may raise newLeader or an exiled placement; answer it on the spot (best-influence leader, first free place) and restore the earlier pending. */
function settle(acc: Acc, before: GameState['pending']): void {
  while (acc.pending) {
    const p = acc.pending
    acc.pending = undefined
    if (p.kind === 'newLeader') {
      const seat = p.seat as SeatId
      const best = aliveIdsOf(acc.state, seat).reduce<SurvivorId | null>((b, id) => (b === null || influenceOf(acc.state, id) > influenceOf(acc.state, b) ? id : b), null)
      if (!best) break
      const r = applyChooseLeader(acc.state, seat, best, 'replacement')
      acc.state = r.state; acc.events.push(...r.events)
    } else if (isExiledPlacement(p) && p.context.survivorId && p.options?.[0]) {
      const r = applyExiledPlacement(acc.state, p.seat as SeatId, p.context.survivorId, p.options[0].id)
      acc.state = r.state; acc.events.push(...r.events)
    } else break
  }
  if (acc.state.phase !== 'ended') acc.state = { ...acc.state, pending: before }
}
const done = (acc: Acc): HookResult => ({ state: acc.state, events: acc.events })
/** Alive survivors of the non-exiled seats, in seat order. */
const nonExiledSurvivors = (state: GameState): SurvivorState[] =>
  nonExiledSeats(state).flatMap((s) => aliveIdsOf(state, s).map((id) => state.survivors[id]!))
/** Stable sort by influence: dir 1 = highest first, -1 = lowest first. */
const byInfluence = (state: GameState, list: SurvivorState[], dir: 1 | -1): SurvivorState[] =>
  list.map((s, i) => ({ s, i })).sort((a, b) => dir * (influenceOf(state, b.s.id) - influenceOf(state, a.s.id)) || a.i - b.i).map((x) => x.s)
const marker = (acc: Acc, sourceId: string, name: string, targetIds: string[]): void => {
  acc.events.push({ type: 'EffectApplied', effectId: `m:${acc.state.rollSeq}:${name}`, sourceId, name, targetIds, expires: null, refreshed: false })
}
/** Bev Russel's School: a survivor that moves in takes a wound (applyMove asks this after the exposure). */
export function woundOnMoveInto(state: GameState, location: LocationId): boolean {
  return state.effects.some((e) => e.grants?.includes('woundOnMoveTo') && e.data?.location === location)
}
/** Bev Russel's School: the survivor named by the immune effect cannot be the overrun victim at `location`. */
export function overrunImmuneSurvivor(state: GameState, survivorId: SurvivorId, location: LocationId): boolean {
  return state.effects.some((e) => e.grants?.includes('overrunImmune') && e.data?.location === location && (!e.survivorIds || e.survivorIds.includes(survivorId)))
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
    addLasting(acc, { name: 'xr.bev-russel#immune', sourceId: 'xr.bev-russel', sourceKind: 'crossroads', grants: ['overrunImmune'], survivorIds: [ctx.survivorId ?? 'sv.bev-russell'], data: { location }, duration: 'game' })
    return { state: acc.state, events: acc.events }
  },

  /** Bev Russel: from now on any survivor that moves to the School takes a wound. */
  'crossroads.bev-russel.schoolWound': (ctx, params) => {
    const acc = mkAcc(ctx.state)
    addLasting(acc, { name: 'xr.bev-russel#schoolWound', sourceId: 'xr.bev-russel', sourceKind: 'crossroads', grants: ['woundOnMoveTo'], data: { location: (params.location as LocationId | undefined) ?? 'loc.school' }, duration: 'game' })
    return done(acc)
  },
  /** Bev Russel (walk away): every item card at the School leaves the game (the zombies are plain DSL). */
  'crossroads.bev-russel.clearSchool': (ctx, params) => {
    const acc = mkAcc(ctx.state)
    const loc = (params.location as LocationId | undefined) ?? 'loc.school'
    const deck = acc.state.locations[loc]?.deck ?? []
    if (!deck.length) return done(acc)
    acc.state = { ...acc.state, removed: [...acc.state.removed, ...deck], locations: { ...acc.state.locations, [loc]: { ...acc.state.locations[loc]!, deck: [] } } }
    for (const cardId of deck) acc.events.push({ type: 'CardDiscarded', seat: null, cardId, to: 'removed', reason: 'crossroads' })
    return done(acc)
  },
  /** Old Divisions: this round's crisis goes under its deck and is not resolved (the contributions were removed by plain DSL). */
  'crossroads.old-divisions.skipCrisis': (ctx) => {
    const acc = mkAcc(ctx.state)
    const id = acc.state.crisis.cardId
    if (!id) return done(acc)
    acc.state = { ...acc.state, crisisDeck: [...acc.state.crisisDeck, id], crisis: { ...acc.state.crisis, cardId: null } }
    marker(acc, 'xr.old-divisions', 'skipCrisis', [id])
    return done(acc)
  },
  /** Exhaustion: frostbite on the five non-exiled survivors with the highest influence. */
  'crisis.exhaustion.frostbiteTopFive': (ctx) => {
    const acc = mkAcc(ctx.state)
    const top = byInfluence(acc.state, nonExiledSurvivors(acc.state), 1).slice(0, 5).map((s) => s.id)
    for (const id of top) { addWoundInto(acc, id, 'frostbite', 'crisis'); settle(acc, ctx.state.pending); if (acc.state.phase === 'ended') break }
    return done(acc)
  },
  /** Hailstorm: each non-exiled seat rolls a d6; on 4 or less one of its survivors (the least wounded, lowest influence first) gets frostbite. */
  'crisis.hailstorm.frostbiteRolls': (ctx) => {
    const acc = mkAcc(ctx.state)
    for (const seat of nonExiledSeats(acc.state)) {
      if (acc.state.phase === 'ended') break
      const r = roll(acc.state, { count: 1, purpose: 'crisis', seat })
      acc.state = r.state; acc.events.push(r.event)
      if (r.event.dice[0]! > 4) continue
      const mine = aliveIdsOf(acc.state, seat).map((id) => acc.state.survivors[id]!)
      const pick = byInfluence(acc.state, mine, -1).reduce<SurvivorState | null>((b, s) => (b === null || s.wounds + s.frostbite < b.wounds + b.frostbite ? s : b), null)
      if (!pick) continue
      addWoundInto(acc, pick.id, 'frostbite', 'crisis'); settle(acc, ctx.state.pending)
    }
    return done(acc)
  },
  /** No Waste: every Food card out of the game goes to the waste pile instead. */
  'crisis.no-waste.foodToWaste': (ctx) => {
    const acc = mkAcc(ctx.state)
    const food = acc.state.removed.filter((c) => symbolsOf(defOf(acc.state, c)).includes('food'))
    if (!food.length) return done(acc)
    acc.state = { ...acc.state, removed: acc.state.removed.filter((c) => !food.includes(c)), waste: [...food, ...acc.state.waste] }
    for (const cardId of food) acc.events.push({ type: 'CardDiscarded', seat: null, cardId, to: 'waste', reason: 'crisis' })
    return done(acc)
  },
  /** Overpopulation: the two lowest-influence non-exiled survivors die, with no morale loss. */
  'crisis.overpopulation.killLowestTwo': (ctx) => {
    const acc = mkAcc(ctx.state)
    const low = byInfluence(acc.state, nonExiledSurvivors(acc.state), -1).slice(0, 2).map((s) => s.id)
    for (const id of low) {
      if (acc.state.survivors[id]?.status !== 'alive' || acc.state.phase === 'ended') continue
      const r = killSurvivor(acc.state, id, 'crisis', { noMorale: true })
      acc.state = r.state; acc.events.push(...r.events); acc.pending = r.pending
      settle(acc, ctx.state.pending)
    }
    return done(acc)
  },
  /** Reorganization: every non-exiled seat hands one survivor (its lowest-influence non-leader) to the next seat clockwise, all at once. */
  'crisis.reorganization.passSurvivors': (ctx) => {
    const acc = mkAcc(ctx.state)
    const seats = nonExiledSeats(acc.state)
    if (seats.length < 2) return done(acc)
    const gives = new Map<SeatId, SurvivorId>()
    for (const seat of seats) {
      const mine = aliveIdsOf(acc.state, seat).map((id) => acc.state.survivors[id]!)
      const pool = mine.length > 1 ? mine.filter((s) => s.id !== acc.state.seats[seat]!.leaderId) : mine
      const pick = byInfluence(acc.state, pool, -1)[0]
      if (pick) gives.set(seat, pick.id)
    }
    const received = new Map<SeatId, SurvivorId>()
    seats.forEach((seat, i) => { const id = gives.get(seat); if (id) received.set(seats[(i + 1) % seats.length]!, id) })
    const seatsNext = { ...acc.state.seats }
    const survivorsNext = { ...acc.state.survivors }
    for (const seat of seats) {
      const st = seatsNext[seat]!
      const gave = gives.get(seat)
      const got = received.get(seat)
      const list = [...st.survivors.filter((id) => id !== gave), ...(got ? [got] : [])]
      let leaderId = st.leaderId && list.includes(st.leaderId) ? st.leaderId : null
      if (!leaderId && list.length) leaderId = list.reduce((b, id) => (influenceOf(acc.state, id) > influenceOf(acc.state, b) ? id : b), list[0]!)
      seatsNext[seat] = { ...st, survivors: list, leaderId }
      if (got) survivorsNext[got] = { ...survivorsNext[got]!, owner: seat }
      if (leaderId && leaderId !== st.leaderId) acc.events.push({ type: 'LeaderChosen', seat, survivorId: leaderId, reason: 'replacement' })
    }
    acc.state = { ...acc.state, seats: seatsNext, survivors: survivorsNext }
    marker(acc, 'cr.reorganization', 'passSurvivors', [...received.values()])
    return done(acc)
  },
  /** Kill Them: nobody is exiled here. The seat that was just exiled loses every survivor and its hand, and leaves the game. */
  'objective.kill-them.removeExiledSeat': (ctx) => {
    const acc = mkAcc(ctx.state)
    const seat = ctx.seat
    const st = acc.state.seats[seat]
    if (!st || !st.seat.exiled) return done(acc)
    const gone = [...st.survivors]
    const cards = [...st.hand, ...gone.flatMap((id) => acc.state.survivors[id]!.equipped)]
    const survivors = { ...acc.state.survivors }
    for (const id of gone) {
      survivors[id] = { ...survivors[id]!, status: 'removed', owner: null, equipped: [], movedThisTurn: false }
      acc.events.push({ type: 'SurvivorRemoved', survivorId: id, owner: seat, sourceId: 'obj.main.kill-them' })
    }
    for (const cardId of cards) acc.events.push({ type: 'CardDiscarded', seat, cardId, to: 'removed', reason: 'exiled', revealed: false })
    acc.state = {
      ...acc.state, survivors, removedHidden: [...acc.state.removedHidden, ...cards],
      seats: { ...acc.state.seats, [seat]: { ...st, survivors: [], hand: [], leaderId: null, seat: { ...st.seat, eliminated: true } } },
    }
    acc.events.push({ type: 'SeatEliminated', seat })
    return done(acc)
  },
  /** Winter Has Come: at the start of each colony phase some player adds a fuel card to the objective, or the game ends with the objective failed. */
  'objective.winter-has-come.fuelOrEnd': (ctx) => {
    const acc = mkAcc(ctx.state)
    const st = acc.state
    const live = st.seatOrder.filter((s) => !st.seats[s]!.seat.eliminated)
    const order = [...live.filter((s) => !st.seats[s]!.seat.exiled), ...live.filter((s) => st.seats[s]!.seat.exiled)]
    for (const seat of order) {
      const card = st.seats[seat]!.hand.find((c) => symbolsOf(defOf(st, c)).includes('fuel'))
      if (!card) continue
      const after = (st.objective.counters['fuel'] ?? 0) + 1
      acc.state = {
        ...st,
        seats: { ...st.seats, [seat]: { ...st.seats[seat]!, hand: st.seats[seat]!.hand.filter((c) => c !== card) } },
        objective: { ...st.objective, cards: [...st.objective.cards, card], counters: { ...st.objective.counters, fuel: after } },
      }
      acc.events.push({ type: 'CardContributed', seat, cardId: card, from: 'hand' })
      acc.events.push({ type: 'ObjectiveProgress', objectiveId: st.objective.id, seat: null, counter: 'fuel', delta: 1, after, need: objectiveNeed(st, 'fuel') })
      return done(acc)
    }
    const r = routines.endGame(acc.state, 'roundsOut')
    return { state: r.state, events: r.events }
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
  /** All I Need Is My Books: the most `symbol` cards equipped to any one survivor the seat controls (M3 data, owner photo). */
  'rule.single-survivor.equippedSymbolAtLeast': (state, seat, params) => {
    const symbol = String(params?.['symbol'] ?? 'education') as ItemSymbol
    const best = Math.max(0, ...aliveOf(state, seat).map((s) => s.equipped.filter((c) => symbolsOf(defOf(state, c)).includes(symbol)).length))
    return report(`${symbol} cards on one survivor`, best, num(params, 'n', 2))
  },
  /** New Friends (betrayer): locations outside the colony whose item deck is empty. */
  'rule.location-deck.emptyAtLeast': (state, _seat, params) =>
    report('emptied item decks', state.locationOrder.filter((l) => l !== 'colony' && state.locations[l]!.deck.length === 0).length, num(params, 'n', 1)),
  /** Shelter / Take Over: at least `locations` locations (the colony counts unless `excludeColony`) each carrying `barricades` or more barricades. */
  'rule.locations.barricadedAtLeast': (state, _seat, params) => {
    const need = num(params, 'barricades', 2)
    const from = params?.['excludeColony'] === true ? state.locationOrder.filter((l) => l !== 'colony') : state.locationOrder
    return report(`locations with ${need}+ barricades`, from.filter((l) => barricadesAt(state, l) >= need).length, num(params, 'locations', 3))
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

  /** Gluttony / Obsessed: cards in the seat's hand per symbol, `params.symbols` = {symbol: n}; starter-deck cards are left out when `excludeStarter` (photo cards). */
  'rule.hand.symbolsAtLeast': (state, seat, params) => {
    const need = (params?.['symbols'] ?? {}) as Record<string, number>
    const hand = (seat ? state.seats[seat]?.hand ?? [] : []).filter((c) => !(params?.['excludeStarter'] === true && state.cards[c]?.starter))
    const parts = Object.entries(need).map(([sym, n]) => ({
      label: `${sym} cards in hand`, have: hand.filter((c) => symbolsOf(defOf(state, c)).includes(sym as ItemSymbol)).length, need: n,
    }))
    return { complete: parts.every((p) => p.have >= p.need), parts }
  },
  /** Neat Freak: the hand holds at least one card and every card in it has `params.symbol` (Medicine). */
  'rule.hand.onlySymbol': (state, seat, params) => {
    const symbol = String(params?.['symbol'] ?? 'medicine') as ItemSymbol
    const hand = seat ? state.seats[seat]?.hand ?? [] : []
    const match = hand.filter((c) => symbolsOf(defOf(state, c)).includes(symbol)).length
    return { complete: hand.length > 0 && match === hand.length, parts: [{ label: `hand holds only ${symbol} cards`, have: hand.length > 0 && match === hand.length ? 1 : 0, need: 1 }] }
  },
  /** Obsessed: every survivor the seat controls carries at least `n` equipped cards with `params.symbol` (Weapon). */
  'rule.seat-survivors.eachEquippedSymbolAtLeast': (state, seat, params) => {
    const symbol = String(params?.['symbol'] ?? 'weapon') as ItemSymbol
    const n = num(params, 'n', 1)
    const mine = aliveOf(state, seat)
    const ok = mine.filter((s) => s.equipped.filter((c) => symbolsOf(defOf(state, c)).includes(symbol)).length >= n).length
    return { complete: mine.length > 0 && ok === mine.length, parts: [{ label: `survivors carrying ${n}+ ${symbol}`, have: ok, need: Math.max(1, mine.length) }] }
  },

  /** Kill Them: at most `n` zombies stand across every location but the colony. */
  'rule.zombies-outside-colony.atMost': (state, _seat, params) => {
    const n = num(params, 'n', 3)
    const have = state.locationOrder.filter((l) => l !== 'colony').reduce((t, l) => t + state.locations[l]!.entrances.reduce((a, e) => a + e.zombies, 0), 0)
    return { complete: have <= n, parts: [{ label: `zombies outside the colony (at most ${n})`, have, need: n }] }
  },
  /** Leave It All Behind: every non-exiled seat has at least one equipped weapon on a survivor it controls (one per player, not one per survivor). */
  'rule.non-exiled-seats.weaponEach': (state) => {
    const seats = nonExiledSeats(state)
    return report('players with an equipped weapon', seats.filter((s) => equippedWith(state, s, 'weapon') >= 1).length, seats.length)
  },
  /** Hoarder: the seat holds strictly more cards in hand than any other live seat. */
  'rule.hand.mostCards': (state, seat) => {
    const mine = seat ? state.seats[seat]?.hand.length ?? 0 : 0
    return report('cards in hand over the next largest hand', mine - bestOther(state, seat, (s) => state.seats[s]?.hand.length ?? 0), 1)
  },
  /** Stockpile: the food supply holds `perSeat` tokens for every non-exiled seat. */
  'rule.food.perNonExiledSeatAtLeast': (state, _seat, params) =>
    report('food in the supply', state.food, num(params, 'perSeat', 3) * nonExiledSeats(state).length),
  /** Stockpile: every colony entrance holds at least one barricade. */
  'rule.colony.everyEntranceBarricaded': (state) => {
    const es = state.locations['colony']?.entrances ?? []
    return report('colony entrances barricaded', es.filter((e) => e.barricades > 0).length, es.length)
  },
  /** Experienced: the seat controls at least one survivor and every one of them carries an equipped item card. */
  'rule.seat-survivors.allEquipped': (state, seat) => {
    const mine = aliveOf(state, seat)
    const armed = mine.filter((s) => s.equipped.length > 0).length
    return { complete: mine.length > 0 && armed === mine.length, parts: [{ label: 'survivors carrying an item', have: armed, need: Math.max(1, mine.length) }] }
  },
  /** Repopulate: survivors of every seat plus helpless tokens on the whole board. */
  'rule.board.survivorsAtLeast': (state, _seat, params) =>
    report('survivors on the board', Object.values(state.survivors).filter((s) => s.status === 'alive').length + state.locationOrder.reduce((n, l) => n + state.locations[l]!.helpless, 0), num(params, 'n', 12)),
  /** Hope: helpless survivor tokens on the whole board. */
  'rule.board.helplessAtLeast': (state, _seat, params) =>
    report('helpless survivor tokens', state.locationOrder.reduce((n, l) => n + state.locations[l]!.helpless, 0), num(params, 'n', 2)),
  /** Justice: every seat holding a betrayal card is exiled (true when the table has no traitor). */
  'rule.traitors.allExiled': (state) => {
    const traitors = state.seatOrder.filter((s) => (state.seats[s]!.secretObjectiveId ?? '').startsWith('obj.betrayal.'))
    const out = traitors.filter((s) => state.seats[s]!.seat.exiled).length
    return { complete: out === traitors.length, parts: [{ label: 'traitors exiled', have: out, need: traitors.length }] }
  },
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
