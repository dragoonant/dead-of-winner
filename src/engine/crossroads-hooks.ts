// The Crossroads code hooks of M8 (the 60 cards added to the first 20) and the few engine seams they read (move, attack, upkeep, dice,
// shields). Registered by code-hooks.ts, which spreads XR_EFFECTS / XR_CONDITIONS into the registry. Spec 21 §11: a hook returns the
// state change it makes itself and, where a plain node does the job better (exposure, wounds, kills, the vote), `then` nodes for the
// interpreter to run next. A hook that must ask a player uses `io.ask`: the interpreter re-runs it from the same state with the answer.
import type { CodeConditionHook, CodeEffectHook, EffectNode, HookContext, HookIO, HookResult } from './hooks'
import type { GameEvent } from './events'
import type { Acc } from './effects'
import {
  addLasting, aliveSurvivors, defOf, discardTo, emitEvent, hasSpace, influenceOf, mkAcc, patchState,
  recOf, routines, setSeatState, setSurvivor, survivorsAt, symbolsOf, zombiesAt,
} from './effects'
import { shuffle, roll } from './rng'
import { addSurvivor } from './survivors'
import type { EffectDuration, GameState, ItemSymbol, LocationId, SeatId, SurvivorId } from './types'

type P = Record<string, unknown>
const str = (p: P, k: string, d = ''): string => (typeof p[k] === 'string' ? (p[k] as string) : d)
const num = (p: P, k: string, d: number): number => { const v = Number(p[k]); return Number.isFinite(v) ? v : d }
const nodes = (v: unknown): EffectNode[] => (Array.isArray(v) ? (v as EffectNode[]) : [])
const done = (acc: Acc, then?: EffectNode[]): HookResult => ({ state: acc.state, events: acc.events, ...(acc.pending ? { pending: acc.pending } : {}), ...(then?.length ? { then } : {}) })
const nothing = (ctx: HookContext, then?: EffectNode[]): HookResult => ({ state: ctx.state, events: [], ...(then?.length ? { then } : {}) })
const nameOf = (st: GameState, id: string): string => (recOf(st, id)?.name as string | undefined) ?? id
const cardName = (st: GameState, c: string): string => (defOf(st, c)?.name as string | undefined) ?? c
const live = (st: GameState): SeatId[] => st.seatOrder.filter((s) => !st.seats[s]!.seat.eliminated)
/** The live seats in table order starting at `from`. */
const roundFrom = (st: GameState, from: SeatId): SeatId[] => {
  const order = live(st)
  const i = Math.max(0, order.indexOf(from))
  return order.map((_, k) => order[(i + k) % order.length]!)
}
const hasSym = (st: GameState, c: string, sym: string): boolean => symbolsOf(defOf(st, c)).includes(sym as ItemSymbol)
const exiled = (st: GameState, seat: SeatId | null): boolean => !!seat && !!st.seats[seat]?.seat.exiled
/** Replace every string equal to `from` inside a JSON value (the "$pick" template of pick, rollEach, eachSeatPick). */
const subst = <T,>(v: T, from: string, to: string): T => JSON.parse(JSON.stringify(v).split(JSON.stringify(from)).join(JSON.stringify(to))) as T
/** The Crossroads card that is resolving: the last triggered entry of the log. */
const xrId = (st: GameState, p: P): string => str(p, 'card') || [...st.crossroads.log].reverse().find((l) => l.triggered)?.cardId || 'xr.unknown'
const survivorOf = (ctx: HookContext, key: string): SurvivorId | undefined => (key === 'ctx' ? ctx.survivorId : key === 'target' ? ctx.targetId : key)
const rollD6 = (acc: Acc, seat: SeatId): number => {
  const r = roll(acc.state, { count: 1, purpose: 'crossroads', seat })
  acc.state = r.state; acc.events.push(r.event)
  return r.event.dice[0]!
}

// ---------- the pick template ----------
interface Cand { id: SurvivorId; location: LocationId }
/** Survivors a hook may offer: `who` own | any | other | foreign, `where` colony | nonColony | a location, `zombies` (zombies at its location), `exclude`. */
function candidates(st: GameState, seat: SeatId, p: P): Cand[] {
  const who = str(p, 'who', 'own')
  const where = str(p, 'where')
  const exclude = (p['exclude'] as string[] | undefined) ?? []
  return aliveSurvivors(st).filter((s) => {
    if (exclude.includes(s.id)) return false
    if (who === 'own' && s.owner !== seat) return false
    if (who === 'other' && (s.owner === seat || !s.owner)) return false
    if (where === 'colony' && s.location !== 'colony') return false
    if (where === 'nonColony' && s.location === 'colony') return false
    if (where && where !== 'colony' && where !== 'nonColony' && s.location !== where) return false
    if (p['zombies'] === true && zombiesAt(st, s.location) < 1) return false
    if (p['notExiled'] === true && exiled(st, s.owner)) return false
    return true
  }).map((s) => ({ id: s.id, location: s.location }))
}
const candLabel = (st: GameState, c: Cand): string => `${nameOf(st, c.id)} (${nameOf(st, c.location)})`

// ---------- moving survivors without a move ----------
function placeInto(acc: Acc, id: SurvivorId, to: LocationId): boolean {
  const sv = acc.state.survivors[id]
  if (!sv || sv.status !== 'alive' || sv.location === to || !acc.state.locations[to] || !hasSpace(acc.state, to)) return false
  setSurvivor(acc, id, { location: to })
  emitEvent(acc, { type: 'SurvivorMoved', survivorId: id, from: sv.location, to, kind: 'card' })
  return true
}
/** A survivor changes seats (Prophet, Wavering Loyalties): its cards go with it, the old leader is replaced by the best influence left. */
function transferInto(acc: Acc, id: SurvivorId, to: SeatId): void {
  const sv = acc.state.survivors[id]
  const from = sv?.owner
  if (!sv || !from || from === to) return
  const a = acc.state.seats[from]!
  const rest = a.survivors.filter((x) => x !== id)
  let leader = a.leaderId === id ? null : a.leaderId
  if (!leader && rest.length) leader = rest.reduce((b, x) => (influenceOf(acc.state, x) > influenceOf(acc.state, b) ? x : b), rest[0]!)
  setSeatState(acc, from, { survivors: rest, leaderId: leader })
  setSeatState(acc, to, { survivors: [...acc.state.seats[to]!.survivors, id] })
  setSurvivor(acc, id, { owner: to })
  if (leader && leader !== a.leaderId) emitEvent(acc, { type: 'LeaderChosen', seat: from, survivorId: leader, reason: 'replacement' })
  emitEvent(acc, { type: 'EffectApplied', effectId: `m:${acc.state.rollSeq}:transfer`, sourceId: 'crossroads', name: 'transfer', targetIds: [id, to], expires: null, refreshed: false })
}

/** A private look: only `seat` sees the ids (EffectApplied carries ownerSeat, so redactEvent keeps it inside that seat's feed). */
function peekInto(acc: Acc, seat: SeatId, ids: string[], name: string): void {
  emitEvent(acc, { type: 'EffectApplied', effectId: `peek:${acc.state.rollSeq}:${name}`, sourceId: 'peek', name, targetIds: ids, expires: null, refreshed: false, ownerSeat: seat })
}

// ---------- dice ----------
function spendInto(acc: Acc, seat: SeatId, count: number): number {
  let spent = 0
  for (let i = 0; i < count; i++) {
    const unused = acc.state.seats[seat]!.dice.filter((d) => !d.used).sort((a, b) => a.value - b.value)[0]
    if (!unused) break
    setSeatState(acc, seat, { dice: acc.state.seats[seat]!.dice.map((d) => (d.id === unused.id ? { ...d, used: true } : d)) })
    emitEvent(acc, { type: 'DieSpent', seat, dieId: unused.id, value: unused.value, purpose: 'card' })
    spent++
  }
  return spent
}
const unusedOf = (st: GameState, seat: SeatId): number => st.seats[seat]!.dice.filter((d) => !d.used).length

// ---------- cards ----------
/**
 * Options that name cards the asked seat may see by name but must not learn by id (other hands, deck contents): the option id is
 * `<seat>|<card definition>`, and `find` hands back the first matching card of the list. Identical cards are offered once.
 */
function cardChoice(st: GameState, items: { seat: string; card: string }[], label: (i: { seat: string; card: string }) => string) {
  const key = (i: { seat: string; card: string }): string => `${i.seat}|${st.cards[i.card]!.defId}`
  const seen = new Set<string>()
  const opts: { id: string; label: string }[] = []
  for (const i of items) if (!seen.has(key(i))) { seen.add(key(i)); opts.push({ id: key(i), label: label(i) }) }
  return { opts, find: (id: string | null) => items.find((i) => key(i) === id) }
}
const removedPool = (st: GameState, p: P): string[] => {
  const sym = str(p, 'symbol')
  const skip = (p['exclude'] as string[] | undefined) ?? []
  let pool = st.removed.filter((c) => (!sym || hasSym(st, c, sym)) && !skip.some((x) => defOf(st, c)?.class === x || hasSym(st, c, x)))
  if (p['last'] === true) pool = pool.slice().reverse()
  return pool
}
const handCount = (st: GameState, sym: string): number => live(st).reduce((a, s) => a + st.seats[s]!.hand.filter((c) => hasSym(st, c, sym)).length, 0)

/** Collective payments ("the players may place 3 fuel cards in the waste pile"): drawn from the active seat first, then clockwise. */
function collect(st: GameState, from: SeatId, sym: string, count: number): { seat: SeatId; card: string }[] {
  const out: { seat: SeatId; card: string }[] = []
  for (const seat of roundFrom(st, from)) for (const card of st.seats[seat]!.hand) if (out.length < count && hasSym(st, card, sym)) out.push({ seat, card })
  return out.length === count ? out : []
}

// ---------- exported seams (read by move, attack, colony phase, dice, exposure, play, objectives) ----------
/** Alexis Grey: "cannot move to the library" (a lasting `noMoveTo` effect names the survivor and the place). */
export function moveBlockedTo(st: GameState, survivorId: SurvivorId, to: LocationId): boolean {
  return st.effects.some((e) => e.grants?.includes('noMoveTo') && e.data?.location === to && !!e.survivorIds?.includes(survivorId))
}
/** Sewer Passage: nobody rolls exposure moving between the colony and the hospital. */
export function sewerRoute(st: GameState, from: LocationId, to: LocationId): boolean {
  return st.effects.some((e) => e.data?.['sewer'] === true) && ((from === 'colony' && to === 'loc.hospital') || (from === 'loc.hospital' && to === 'colony'))
}
/** The Arctic King: after the move, noise at both ends (a zombie at the colony instead) and a wound on the snowmobile; four wounds and it is gone. */
export function snowmobileTrail(acc: Acc, survivorId: SurvivorId, from: LocationId, to: LocationId): void {
  const e = acc.state.effects.find((x) => x.data?.['snowmobile'] !== undefined && x.survivorIds?.includes(survivorId))
  if (!e) return
  for (const loc of [from, to]) {
    if (loc === 'colony') { const r = routines.addZombies(acc.state, 'colony', 1, 'crossroads'); acc.state = r.state; acc.events.push(...r.events) }
    else {
      const l = acc.state.locations[loc]!
      const n = Math.min(1, l.capacity.noiseSpaces - l.noise)
      if (n > 0) { acc.state = { ...acc.state, locations: { ...acc.state.locations, [loc]: { ...l, noise: l.noise + 1 } } }; emitEvent(acc, { type: 'NoiseAdded', location: loc, count: 1, after: l.noise + 1, by: e.sourceId }) }
    }
  }
  const wounds = Number((e.data!['snowmobile'] as { wounds?: number }).wounds ?? 0) + 1
  patchState(acc, { effects: wounds >= 4 ? acc.state.effects.filter((x) => x !== e) : acc.state.effects.map((x) => (x === e ? { ...x, data: { ...x.data, snowmobile: { wounds } } } : x)) })
  emitEvent(acc, { type: 'EffectApplied', effectId: e.id, sourceId: e.sourceId, name: wounds >= 4 ? 'snowmobile wrecked' : 'snowmobile worn', targetIds: [survivorId], expires: null, refreshed: true })
}
/** Ashley Ross' walkways (colony entrance 1) and the once-a-round attack of Gray Beard / Welcome Home: an attack that rolls no exposure. */
export function attackExposureSkip(st: GameState, survivorId: SurvivorId, location: LocationId, entrance: number): { state: GameState; sourceId: string } | null {
  for (const e of st.effects) {
    const a = e.data?.['attackSkip'] as { location?: string; entrance?: number; oncePerRound?: boolean; usedRound?: number } | undefined
    if (!a) continue
    if (e.survivorIds && !e.survivorIds.includes(survivorId)) continue
    if (a.location && (a.location !== location || a.entrance !== entrance)) continue
    if (a.oncePerRound) {
      if (a.usedRound === st.roundNumber) continue
      return { sourceId: e.sourceId, state: { ...st, effects: st.effects.map((x) => (x === e ? { ...x, data: { ...x.data, attackSkip: { ...a, usedRound: st.roundNumber } } } : x)) } }
    }
    return { state: st, sourceId: e.sourceId }
  }
  return null
}
/** Horse: one more food at the pay-food step for each horse whose rider is alive and not exiled. */
export function extraFoodUpkeep(st: GameState): number {
  return st.effects.reduce((n, e) => {
    const up = Number(e.data?.['upkeep'] ?? 0)
    const sv = e.survivorIds?.[0] ? st.survivors[e.survivorIds[0]] : undefined
    return up > 0 && sv?.status === 'alive' && sv.owner && !exiled(st, sv.owner) ? n + up : n
  }, 0)
}
/** Ashley Ross' waste storage: morale is lost for every 10 cards in the waste pile, or every 15 once she has built the store. */
export function wasteStep(st: GameState): number {
  return Math.max(10, ...st.effects.map((e) => Number(e.data?.['wasteStep'] ?? 0)))
}
/** Music (+1) and Dynamite (-1): dice a seat rolls beyond one per survivor, from `extraDie` grants. */
export function extraDiceFor(st: GameState, seat: SeatId): number {
  return st.effects.reduce((n, e) => (e.grants?.includes('extraDie') && (!e.seats || e.seats.includes(seat)) ? n + Number(e.data?.['amount'] ?? 1) : n), 0)
}
/** Olivia Brown: while her round-long shield stands, a bite on the exposure die is ignored by discarding a Medicine (the rolling seat's first, then the others). */
export function biteShield(st: GameState, survivorId: SurvivorId): { state: GameState; events: GameEvent[]; sourceId: string } | null {
  const e = st.effects.find((x) => x.grants?.includes('biteShield'))
  if (!e) return null
  const owner = st.survivors[survivorId]?.owner ?? st.firstSeat
  for (const seat of roundFrom(st, owner)) {
    const card = st.seats[seat]!.hand.find((c) => hasSym(st, c, 'medicine'))
    if (!card) continue
    const acc = mkAcc(st)
    discardTo(acc, seat, card, st.seats[seat]!.seat.exiled ? 'removed' : 'waste', 'shield')
    return { state: acc.state, events: acc.events, sourceId: e.sourceId }
  }
  return null
}
/** Voyeur: a taken card cannot be played before the round it names. */
export function cardLocked(st: GameState, cardId: string): boolean {
  return Number(st.cardUses[cardId]?.['$lockUntil'] ?? 0) > st.roundNumber
}
/** Army, The Deputy: victory conditions added to the main objective by lasting effects. */
export function extraVictory(st: GameState): unknown[] {
  return st.effects.flatMap((e) => (e.data?.['condition'] ? [e.data['condition']] : []))
}

// ---------- conditions ----------
const cond = (name: string, fn: CodeConditionHook): [string, CodeConditionHook] => [name, fn]
const survivorCond: CodeConditionHook = (ctx, p) => {
  const id = str(p, 'id')
  const rel = str(p, 'rel', 'inPlay')
  if (rel === 'inDeck') return ctx.state.survivorDeck.includes(id)
  const sv = ctx.state.survivors[id]
  if (!sv || sv.status !== 'alive' || !sv.owner) return false
  if (rel === 'controlled' && sv.owner !== ctx.seat) return false
  if (p['notExiled'] === true && exiled(ctx.state, sv.owner)) return false
  if (p['at'] === 'colony' && sv.location !== 'colony') return false
  if (p['startedTurnThere'] === true && sv.movedThisTurn) return false
  return true
}
const seatsPair = (st: GameState, seat: SeatId, test: (mine: { id: string; location: string }, other: { id: string; owner: SeatId; location: string }) => boolean): boolean => {
  const all = aliveSurvivors(st)
  return all.some((a) => a.owner === seat && all.some((b) => !!b.owner && b.location === a.location && b.id !== a.id && test(a, { id: b.id, owner: b.owner, location: b.location })))
}

export const XR_CONDITIONS: Record<string, CodeConditionHook> = Object.fromEntries([
  cond('crossroads.rule.survivor', survivorCond),
  /** Car Crash (used) / Horde (not used): a Fuel card was played for this survivor's move. */
  cond('crossroads.rule.fuelMove', (ctx, p) => {
    const used = ctx.state.effects.some((e) => e.sourceId === 'it.fuel' && e.grants?.includes('noExposureOnMove') && (!e.survivorIds || (!!ctx.survivorId && e.survivorIds.includes(ctx.survivorId))))
    return p['used'] === false ? !used : used
  }),
  /** The action was a survivor or item ability (not the playing of a card). */
  cond('crossroads.rule.abilityUse', (ctx) => ctx.params?.['fromAbility'] === true),
  /** Addiction: the Medicine just played healed a survivor. */
  cond('crossroads.rule.playHealed', (ctx) => !!ctx.targetId && ctx.state.survivors[ctx.targetId]?.status === 'alive'),
  /** requires: the hands of every seat hold `count` cards of the symbol between them. */
  cond('crossroads.rule.handsHave', (ctx, p) => handCount(ctx.state, str(p, 'symbol')) >= num(p, 'count', 1)),
  /** requires: `count` cards of the symbol are out of the game. */
  cond('crossroads.rule.removedHas', (ctx, p) => removedPool(ctx.state, p).length >= num(p, 'count', 1)),
  /** Hunger: a male survivor and a helpless token were both added by the action. */
  cond('crossroads.rule.hunger', (ctx, p) => {
    const added = (ctx.params?.['addedSurvivors'] as string[] | undefined) ?? []
    return Number(ctx.params?.['addedHelpless'] ?? 0) >= 1 && added.some((id) => ((p['male'] as string[] | undefined) ?? []).includes(id))
  }),
  /** Mugging: a non-exiled survivor of the seat shares a location with an exiled seat's survivor. */
  cond('crossroads.rule.mugging', (ctx) => seatsPair(ctx.state, ctx.seat, (a, b) => !exiled(ctx.state, ctx.seat) && exiled(ctx.state, b.owner))),
  /** Prophet: the exiled seat's survivor stands with a non-exiled seat's survivor. */
  cond('crossroads.rule.prophet', (ctx) => exiled(ctx.state, ctx.seat) && seatsPair(ctx.state, ctx.seat, (a, b) => !exiled(ctx.state, b.owner))),
  /** Voyeur: a survivor of the seat and one of another seat are the only two survivors at their location. */
  cond('crossroads.rule.pair', (ctx) => seatsPair(ctx.state, ctx.seat, (a, b) => b.owner !== ctx.seat && survivorsAt(ctx.state, a.location).length === 2)),
  /** Wavering Loyalties: the seat has more survivors than some other live seat. */
  cond('crossroads.rule.outranks', (ctx) => {
    const mine = ctx.state.seats[ctx.seat]!.survivors.length
    return live(ctx.state).some((s) => s !== ctx.seat && ctx.state.seats[s]!.survivors.length < mine)
  }),
  /** Gabriel Diaz, The Deputy, Mike Cho: a survivor of the seat stands outside the colony (optionally not exiled, optionally with zombies there). */
  cond('crossroads.rule.seatAt', (ctx, p) => candidates(ctx.state, ctx.seat, { who: 'own', where: 'nonColony', zombies: p['zombies'], notExiled: p['notExiled'] }).length > 0),
  /** Sleep: the source trigger is a yawn at the table; we stand in for it with a long turn (four actions or more). */
  cond('crossroads.rule.yawn', (ctx) => (ctx.state.turn?.actions ?? 0) >= 4),
])

// ---------- effects ----------
const eff = (name: string, fn: CodeEffectHook): [string, CodeEffectHook] => [name, fn]
const noopHook: CodeEffectHook = (ctx) => nothing(ctx)

/** Thomas Heart: he deals out four wounds among the survivors who share his location (his controller picks each). */
function rage(ctx: HookContext, io: HookIO): HookResult {
  const st = ctx.state
  const t = st.survivors['sv.thomas-heart']
  if (!t || t.status !== 'alive') return nothing(ctx)
  const others = survivorsAt(st, t.location).filter((s) => s.id !== t.id)
  if (!others.length) return nothing(ctx)
  const out: EffectNode[] = []
  for (let i = 0; i < 4; i++) {
    const pick = io.ask(ctx.seat, others.map((s) => ({ id: s.id, label: nameOf(st, s.id) })))
    if (!pick) break
    out.push({ op: 'wound', count: 1, scope: { who: 'allSurvivors', filter: { test: 'survivorIs', subject: 'survivor', value: pick } } })
  }
  return nothing(ctx, out)
}

export const XR_EFFECTS: Record<string, CodeEffectHook> = Object.fromEntries([
  /** Spend unused dice: `who` active | all, `count` n | all (the lowest dice go first). */
  eff('crossroads.rule.spendDice', (ctx, p) => {
    const acc = mkAcc(ctx.state)
    const seats = str(p, 'who', 'active') === 'all' ? live(acc.state) : [ctx.seat]
    for (const seat of seats) spendInto(acc, seat, p['count'] === 'all' ? 99 : num(p, 'count', 1))
    return done(acc)
  }),
  /** "Place (this does not count as a move)": the survivor goes to `location` if there is room; `location: "from"` = where the move began. */
  eff('crossroads.rule.place', (ctx, p) => {
    const acc = mkAcc(ctx.state)
    const id = survivorOf(ctx, str(p, 'survivor', 'ctx'))
    const to = str(p, 'location') === 'from' ? String(ctx.params?.['from'] ?? '') : str(p, 'location')
    if (id) placeInto(acc, id, to)
    return done(acc)
  }),
  /** Alexis Grey: `stay` = cannot move away from `location`; `neverTo` = cannot move to it. */
  eff('crossroads.rule.lockMove', (ctx, p) => {
    const acc = mkAcc(ctx.state)
    const id = survivorOf(ctx, str(p, 'survivor'))
    const loc = str(p, 'location')
    if (!id) return done(acc)
    const card = xrId(acc.state, p)
    if (str(p, 'mode') === 'stay') addLasting(acc, { name: `${card}#stay`, sourceId: card, sourceKind: 'crossroads', forbid: ['move'], survivorIds: [id], locations: [loc], duration: 'game' })
    else addLasting(acc, { name: `${card}#neverTo`, sourceId: card, sourceKind: 'crossroads', grants: ['noMoveTo'], survivorIds: [id], data: { location: loc }, duration: 'game' })
    return done(acc)
  }),
  /** A lasting effect tied to a survivor, to every seat (`global`) or to the table: abilities, upkeep, attack skips, victory conditions ... */
  eff('crossroads.rule.attach', (ctx, p) => {
    const acc = mkAcc(ctx.state)
    const card = xrId(acc.state, p)
    const id = p['survivor'] === undefined ? undefined : survivorOf(ctx, str(p, 'survivor'))
    const data: P = {}
    for (const k of ['ability', 'global', 'forEvery', 'upkeep', 'attackSkip', 'snowmobile', 'wasteStep', 'condition', 'boundSurvivor', 'sewer', ...Object.keys((p['data'] as P | undefined) ?? {})]) {
      const v = p[k] !== undefined ? p[k] : (p['data'] as P | undefined)?.[k]
      if (v !== undefined) data[k] = v
    }
    if (p['survivor'] !== undefined && !id) return done(acc)
    addLasting(acc, {
      name: `${card}#${str(p, 'name', 'attached')}`, sourceId: card, sourceKind: 'crossroads', duration: str(p, 'duration', 'game') as EffectDuration,
      ...(id ? { survivorIds: [id] } : {}), ...(p['seatOnly'] === true ? { seats: [ctx.seat] } : {}),
      ...(Array.isArray(p['forbid']) ? { forbid: p['forbid'] as string[] } : {}), ...(Array.isArray(p['grants']) ? { grants: p['grants'] as string[] } : {}), data,
    })
    return done(acc)
  }),
  /** Run `then` only when the named survivor ("ctx", "target" or an id) is still alive. */
  eff('crossroads.rule.ifAlive', (ctx, p) => {
    const id = survivorOf(ctx, str(p, 'survivor', 'ctx'))
    return nothing(ctx, id && ctx.state.survivors[id]?.status === 'alive' ? nodes(p['then']) : nodes(p['else']))
  }),
  /** Run `then` only when the named survivor is in play. */
  eff('crossroads.rule.ifInPlay', (ctx, p) => nothing(ctx, ctx.state.survivors[str(p, 'survivor')]?.status === 'alive' ? nodes(p['then']) : nodes(p['else']))),
  /** The seat picks one survivor ("$pick" in `then` becomes its id, "$pickLoc" its location). */
  eff('crossroads.rule.pick', (ctx, p, io) => {
    const c = candidates(ctx.state, ctx.seat, p)
    if (!c.length) return nothing(ctx, nodes(p['else']))
    const id = io!.ask(ctx.seat, c.map((x) => ({ id: x.id, label: candLabel(ctx.state, x) })))
    const pick = c.find((x) => x.id === id)
    if (!pick) return nothing(ctx)
    return nothing(ctx, subst(subst(nodes(p['then']), '$pick', pick.id), '$pickLoc', pick.location))
  }),
  /** Every seat in turn picks one of its own survivors (`where`) and `then` runs for each pick. */
  eff('crossroads.rule.eachSeatPick', (ctx, p, io) => {
    const out: EffectNode[] = []
    for (const seat of roundFrom(ctx.state, ctx.seat)) {
      const c = candidates(ctx.state, seat, { ...p, who: 'own' })
      if (!c.length) continue
      const id = io!.ask(seat, c.map((x) => ({ id: x.id, label: candLabel(ctx.state, x) })))
      if (id) out.push(...subst(nodes(p['then']), '$pick', id))
    }
    return nothing(ctx, out)
  }),
  /** A d6 for each survivor at `where`; the ones in range get `then` (Army's ambush, Loretta's poisoning). */
  eff('crossroads.rule.rollEach', (ctx, p) => {
    const acc = mkAcc(ctx.state)
    const out: EffectNode[] = []
    for (const c of candidates(acc.state, ctx.seat, { who: 'any', where: str(p, 'where', 'colony') })) {
      const r = rollD6(acc, ctx.seat)
      if (r <= num(p, 'atMost', 6) && r >= num(p, 'atLeast', 1)) out.push(...subst(nodes(p['then']), '$pick', c.id))
    }
    return done(acc, out)
  }),
  /** One d6; the first range it falls in decides which `then` runs. */
  eff('crossroads.rule.rollThen', (ctx, p) => {
    const acc = mkAcc(ctx.state)
    const r = rollD6(acc, ctx.seat)
    const hit = ((p['ranges'] as { atLeast?: number; atMost?: number; then?: unknown }[] | undefined) ?? []).find((x) => r >= (x.atLeast ?? 1) && r <= (x.atMost ?? 6))
    return done(acc, nodes(hit?.then))
  }),
  /** Cards out of the game come back (`to` waste | hand): by symbol, the most recent first with `last`, never the `exclude` classes or symbols. */
  eff('crossroads.rule.recoverRemoved', (ctx, p) => {
    const acc = mkAcc(ctx.state)
    const pool = removedPool(acc.state, p)
    const take = pool.slice(0, p['count'] === 'all' ? pool.length : num(p, 'count', 1))
    for (const c of take) {
      patchState(acc, { removed: acc.state.removed.filter((x) => x !== c) })
      if (str(p, 'to', 'waste') === 'hand') {
        setSeatState(acc, ctx.seat, { hand: [...acc.state.seats[ctx.seat]!.hand, c] })
        emitEvent(acc, { type: 'CardDrawn', seat: ctx.seat, from: 'colony', cardId: c, sourceId: 'crossroads' })
      } else {
        patchState(acc, { waste: [c, ...acc.state.waste] })
        emitEvent(acc, { type: 'CardDiscarded', seat: null, cardId: c, to: 'waste', reason: 'crossroads' })
      }
    }
    return done(acc)
  }),
  /** Search a location deck: `mode` pick (the seat chooses) | first (the first matches) | top | all; `to` hand | removed; `shuffle` afterwards. `location: "choose"` asks which deck. */
  eff('crossroads.rule.searchDeck', (ctx, p, io) => {
    const st = ctx.state
    let loc = str(p, 'location')
    if (loc === 'choose') {
      const open = st.locationOrder.filter((l) => l !== 'colony' && st.locations[l]!.deck.length > 0)
      const pick = io!.ask(ctx.seat, open.map((l) => ({ id: l, label: nameOf(st, l) })))
      if (!pick) return nothing(ctx)
      loc = pick
    }
    const deck = st.locations[loc]?.deck ?? []
    const sym = str(p, 'symbol')
    const pool = deck.filter((c) => !sym || hasSym(st, c, sym))
    const want = p['count'] === 'all' ? Infinity : num(p, 'count', 1)
    const mode = str(p, 'mode', 'pick')
    let take: string[] = []
    if (mode === 'top') take = deck.slice(0, want)
    else if (mode === 'first' || mode === 'all') take = pool.slice(0, want)
    else {
      const left = pool.map((c) => ({ seat: loc, card: c }))
      for (let i = 0; i < want && left.length; i++) {
        const ch = cardChoice(st, left, (x) => cardName(st, x.card))
        const got = ch.find(io!.ask(ctx.seat, ch.opts))
        if (!got) break
        take.push(got.card); left.splice(left.indexOf(got), 1)
      }
    }
    const acc = mkAcc(st)
    for (const c of take) {
      patchState(acc, { locations: { ...acc.state.locations, [loc]: { ...acc.state.locations[loc]!, deck: acc.state.locations[loc]!.deck.filter((x) => x !== c) } } })
      if (str(p, 'to', 'hand') === 'hand') {
        setSeatState(acc, ctx.seat, { hand: [...acc.state.seats[ctx.seat]!.hand, c] })
        emitEvent(acc, { type: 'CardDrawn', seat: ctx.seat, from: loc, cardId: c, sourceId: 'crossroads' })
      } else {
        patchState(acc, { removed: [...acc.state.removed, c] })
        emitEvent(acc, { type: 'CardDiscarded', seat: null, cardId: c, to: 'removed', reason: 'crossroads' })
      }
    }
    if (p['shuffle'] === true && loc && acc.state.locations[loc]) {
      const [deck2, rng] = shuffle(acc.state.rng, acc.state.locations[loc]!.deck)
      patchState(acc, { rng, locations: { ...acc.state.locations, [loc]: { ...acc.state.locations[loc]!, deck: deck2 } } })
      emitEvent(acc, { type: 'DeckShuffled', location: loc, reason: 'card' })
    }
    return done(acc)
  }),
  /** Search the survivor deck for `survivor` (or the top card with "random") and add it to the seat's following at the colony; `wounds`, `exposure` rolls and `leader` follow. */
  eff('crossroads.rule.recruit', (ctx, p, io) => {
    const st = ctx.state
    const want = str(p, 'survivor', 'random')
    const id = want === 'random' ? st.survivorDeck[0] : st.survivorDeck.includes(want) ? want : undefined
    if (!id) return nothing(ctx)
    let loc: LocationId = 'colony'
    if (exiled(st, ctx.seat)) {
      const spaces = st.locationOrder.filter((l) => l !== 'colony' && hasSpace(st, l))
      const pick = io!.ask(ctx.seat, spaces.map((l) => ({ id: l, label: nameOf(st, l) })))
      if (!pick) return nothing(ctx)
      loc = pick
    } else if (!hasSpace(st, 'colony')) return nothing(ctx)
    const acc = mkAcc({ ...st, survivorDeck: st.survivorDeck.filter((x) => x !== id) })
    const r = addSurvivor(acc.state, ctx.seat, id, loc, 'crossroads')
    acc.state = r.state; acc.events.push(...r.events)
    if (p['leader'] === true) { setSeatState(acc, ctx.seat, { leaderId: id }); emitEvent(acc, { type: 'LeaderChosen', seat: ctx.seat, survivorId: id, reason: 'replacement' }) }
    const only = { who: 'allSurvivors', filter: { test: 'survivorIs', subject: 'survivor', value: id } } as const
    const then: EffectNode[] = []
    if (num(p, 'wounds', 0) > 0) then.push({ op: 'wound', count: num(p, 'wounds', 0), scope: only })
    if (num(p, 'exposure', 0) > 0) then.push({ op: 'exposure', count: num(p, 'exposure', 0), value: 'card', scope: only })
    return done(acc, then)
  }),
  /** The survivor card leaves the survivor deck for good. */
  eff('crossroads.rule.removeFromDeck', (ctx, p) => {
    const id = str(p, 'survivor')
    if (!ctx.state.survivorDeck.includes(id)) return nothing(ctx)
    // the card is kept as a removed survivor so every survivor card stays accounted for (deck + survivors record = the roster)
    const gone = { id, owner: null, location: 'colony', status: 'removed' as const, wounds: 0, frostbite: 0, equipped: [], movedThisTurn: false, extraMoves: 0 }
    const acc = mkAcc({ ...ctx.state, survivorDeck: ctx.state.survivorDeck.filter((x) => x !== id), survivors: { ...ctx.state.survivors, [id]: gone } })
    emitEvent(acc, { type: 'SurvivorRemoved', survivorId: id, owner: null, sourceId: xrId(ctx.state, {}) })
    return done(acc)
  }),
  /** Forest Plum: wounds on the survivor with the lowest (or highest) influence, not counting `exclude`. */
  eff('crossroads.rule.woundByInfluence', (ctx, p) => {
    const mode = str(p, 'mode', 'lowest')
    const pool = aliveSurvivors(ctx.state).filter((s) => s.id !== str(p, 'exclude')).sort((a, b) => (mode === 'lowest' ? 1 : -1) * (influenceOf(ctx.state, a.id) - influenceOf(ctx.state, b.id)))
    const pick = pool[0]
    return nothing(ctx, pick ? [{ op: 'wound', count: num(p, 'count', 1), scope: { who: 'allSurvivors', filter: { test: 'survivorIs', subject: 'survivor', value: pick.id } } }] : [])
  }),
  /** Collective payment: `count` cards of `symbol` from the hands (the active seat's first) go to the waste pile; then `then` runs. */
  eff('crossroads.rule.collectiveDiscard', (ctx, p) => {
    const acc = mkAcc(ctx.state)
    const paid = collect(acc.state, ctx.seat, str(p, 'symbol'), num(p, 'count', 3))
    if (!paid.length) return done(acc)
    for (const x of paid) discardTo(acc, x.seat, x.card, exiled(acc.state, x.seat) ? 'removed' : 'waste', 'crossroads')
    return done(acc, nodes(p['then']))
  }),
  /** No Ammo: the weapon whose ability was just used goes to the waste pile. */
  eff('crossroads.rule.wasteCard', (ctx) => {
    const acc = mkAcc(ctx.state)
    if (ctx.cardId && ctx.state.cards[ctx.cardId]) discardTo(acc, ctx.seat, ctx.cardId, exiled(acc.state, ctx.seat) ? 'removed' : 'waste', 'crossroads')
    return done(acc)
  }),
  /** Gabriel Diaz: the seat removes `count` cards of its own choice from its hand. */
  eff('crossroads.rule.removeFromHand', (ctx, p, io) => {
    const acc = mkAcc(ctx.state)
    const left = [...acc.state.seats[ctx.seat]!.hand]
    for (let i = 0; i < num(p, 'count', 1) && left.length; i++) {
      const pick = io!.ask(ctx.seat, left.map((c) => ({ id: c, label: cardName(acc.state, c) })))
      if (!pick) break
      left.splice(left.indexOf(pick), 1)
      discardTo(acc, ctx.seat, pick, 'removed', 'crossroads')
    }
    return done(acc)
  }),
  /** Daniel Smith: the chosen survivor's equipped cards go back to its controller's hand. */
  eff('crossroads.rule.unequip', (ctx, p) => {
    const acc = mkAcc(ctx.state)
    const sv = acc.state.survivors[str(p, 'survivor')]
    if (!sv?.owner || !sv.equipped.length) return done(acc)
    const cards = sv.equipped
    setSurvivor(acc, sv.id, { equipped: [] })
    setSeatState(acc, sv.owner, { hand: [...acc.state.seats[sv.owner]!.hand, ...cards] })
    emitEvent(acc, { type: 'EquippedReturned', survivorId: sv.id, cardIds: cards, to: 'hand', location: sv.location })
    return done(acc)
  }),
  /** Helpless: every helpless token at the colony leaves the game; morale falls by half their number, rounded up. */
  eff('crossroads.rule.purgeHelpless', (ctx) => {
    const n = ctx.state.locations['colony']?.helpless ?? 0
    return nothing(ctx, n > 0 ? [{ op: 'removeHelpless', count: n, location: 'colony', value: 'noMorale' }, { op: 'morale', value: -Math.ceil(n / 2) }] : [])
  }),
  /** Airplane: a Tool and a Fuel card (from any hands) and Sophie Robinson leave the game for 1 morale. */
  eff('crossroads.airplane.fly', (ctx) => {
    const acc = mkAcc(ctx.state)
    const tool = collect(acc.state, ctx.seat, 'tool', 1)[0]
    const fuel = collect(acc.state, ctx.seat, 'fuel', 1)[0]
    const sophie = acc.state.survivors['sv.sophie-robinson']
    if (!tool || !fuel || sophie?.status !== 'alive') return done(acc)
    for (const x of [tool, fuel]) discardTo(acc, x.seat, x.card, 'removed', 'crossroads')
    const r = routines.removeSurvivor(acc.state, sophie.id, 'xr.airplane')
    acc.state = r.state; acc.events.push(...r.events)
    if (r.pending) acc.pending = r.pending
    return done(acc, [{ op: 'morale', value: 1 }])
  }),
  /** Dynamite: a 1 kills Edward White and John Price; otherwise a second die removes that many zombies from the colony and rubble barricades take their place. */
  eff('crossroads.dynamite.blast', (ctx) => {
    const acc = mkAcc(ctx.state)
    if (rollD6(acc, ctx.seat) === 1) {
      const is = (value: string) => ({ test: 'survivorIs', subject: 'survivor', value }) as const
      return done(acc, [{ op: 'killSurvivor', scope: { who: 'allSurvivors', filter: { any: [is('sv.edward-white'), is('sv.john-price')] } } }])
    }
    const k = Math.min(rollD6(acc, ctx.seat), zombiesAt(acc.state, 'colony'))
    return done(acc, k > 0 ? [{ op: 'killZombies', count: k, location: 'colony' }, { op: 'addBarricade', count: k, location: 'colony' }] : [])
  }),
  /** Spoiled: the food is spent but the die does not rise (the boost of the food just spent is taken back). */
  eff('crossroads.spoiled.spoil', (ctx) => {
    const acc = mkAcc(ctx.state)
    const tokens = Number(ctx.params?.['tokens'] ?? 1)
    const die = ctx.dieId ? acc.state.seats[ctx.seat]?.dice.find((d) => d.id === ctx.dieId) : undefined
    if (!die) return done(acc)
    const to = Math.max(1, die.value - tokens)
    setSeatState(acc, ctx.seat, { dice: acc.state.seats[ctx.seat]!.dice.map((d) => (d.id === die.id ? { ...d, value: to } : d)) })
    if (to !== die.value) emitEvent(acc, { type: 'DieBoosted', seat: ctx.seat, dieId: die.id, from: die.value, to, source: 'ability' })
    return done(acc)
  }),
  /** Radio Signal: the seats pledge dice in turn; with 3 spent between them a helpless survivor arrives and morale rises, otherwise it falls. */
  eff('crossroads.radio-signal.answer', (ctx, _p, io) => {
    const acc = mkAcc(ctx.state)
    const pledges: [SeatId, number][] = []
    let total = 0
    for (const seat of roundFrom(acc.state, ctx.seat)) {
      const room = Math.min(unusedOf(acc.state, seat), 3 - total)
      if (room <= 0) continue
      const pick = io!.ask(seat, Array.from({ length: room + 1 }, (_, i) => ({ id: String(i), label: i === 0 ? 'Spend no dice' : `Spend ${i} ${i === 1 ? 'die' : 'dice'}` })))
      const k = Number(pick ?? 0)
      if (k > 0) { pledges.push([seat, k]); total += k }
    }
    if (total < 3) return done(acc, [{ op: 'morale', value: -1 }])
    for (const [seat, k] of pledges) spendInto(acc, seat, k)
    return done(acc, [{ op: 'addHelpless', count: 1, location: 'colony' }, { op: 'morale', value: 1 }])
  }),
  /** Gambling: each seat antes up to one hand card per survivor it has at the colony; the highest die takes the pot (ties roll again). */
  eff('crossroads.gambling.ante', (ctx, _p, io) => {
    const acc = mkAcc(ctx.state)
    const ante = new Map<SeatId, string[]>()
    for (const seat of roundFrom(acc.state, ctx.seat)) {
      const slots = aliveSurvivors(acc.state).filter((s) => s.owner === seat && s.location === 'colony').length
      const left = [...acc.state.seats[seat]!.hand]
      const put: string[] = []
      for (let i = 0; i < slots && left.length; i++) {
        const pick = io!.ask(seat, [{ id: 'pass', label: 'Keep the rest' }, ...left.map((c) => ({ id: c, label: cardName(acc.state, c) }))])
        if (!pick || pick === 'pass') break
        put.push(pick); left.splice(left.indexOf(pick), 1)
      }
      if (put.length) ante.set(seat, put)
    }
    let alive = [...ante.keys()]
    while (alive.length > 1) {
      const best = new Map<SeatId, number>()
      for (const seat of alive) { let top = 0; for (let i = 0; i < (ante.get(seat) ?? []).length; i++) top = Math.max(top, rollD6(acc, seat)); best.set(seat, top) }
      const high = Math.max(...best.values())
      alive = alive.filter((s) => best.get(s) === high)
    }
    const winner = alive[0]
    if (!winner) return done(acc)
    for (const [seat, cards] of ante) {
      if (seat === winner) continue
      for (const c of cards) {
        setSeatState(acc, seat, { hand: acc.state.seats[seat]!.hand.filter((x) => x !== c) })
        setSeatState(acc, winner, { hand: [...acc.state.seats[winner]!.hand, c] })
        emitEvent(acc, { type: 'CardStolen', from: seat, to: winner, cardId: c })
      }
    }
    return done(acc)
  }),
  /** James Meyers: the seat looks at every hand, then may take 3 Medicine cards out of the game for 1 morale. */
  eff('crossroads.james-meyers.audit', (ctx, _p, io) => {
    const acc = mkAcc(ctx.state)
    peekInto(acc, ctx.seat, live(acc.state).flatMap((s) => acc.state.seats[s]!.hand), 'audit')
    const meds = live(acc.state).flatMap((s) => acc.state.seats[s]!.hand.filter((c) => hasSym(acc.state, c, 'medicine')).map((c) => ({ seat: s, card: c })))
    if (meds.length < 3) return done(acc)
    const left = [...meds]
    for (let i = 0; i < 3; i++) {
      const ch = cardChoice(acc.state, left, (x) => `${cardName(acc.state, x.card)} (${acc.state.seats[x.seat]!.seat.name ?? x.seat})`)
      const m = ch.find(io!.ask(ctx.seat, ch.opts)) as { seat: SeatId; card: string } | undefined
      if (!m) return done(acc)
      left.splice(left.indexOf(m), 1)
      discardTo(acc, m.seat, m.card, 'removed', 'crossroads')
    }
    return done(acc, [{ op: 'morale', value: 1 }])
  }),
  /** James Meyers: the seat reads another player's secret objective (private to it). */
  eff('crossroads.james-meyers.readObjective', (ctx, _p, io) => {
    const acc = mkAcc(ctx.state)
    const seats = live(acc.state).filter((s) => s !== ctx.seat && acc.state.seats[s]!.secretObjectiveId)
    const pick = io!.ask(ctx.seat, seats.map((s) => ({ id: s, label: acc.state.seats[s]!.seat.name ?? s })))
    if (pick) peekInto(acc, ctx.seat, [acc.state.seats[pick]!.secretObjectiveId!], 'readObjective')
    return done(acc)
  }),
  /** Voyeur: the seat looks at the hand of the other survivor's controller. */
  eff('crossroads.voyeur.peek', (ctx, _p, io) => {
    const acc = mkAcc(ctx.state)
    const other = voyeurTarget(acc.state, ctx.seat, io!)
    if (other) peekInto(acc, ctx.seat, acc.state.seats[other]!.hand, 'voyeur')
    return done(acc)
  }),
  /** Voyeur: take a card of your choice from that hand; it cannot be played before next round. */
  eff('crossroads.voyeur.take', (ctx, _p, io) => {
    const acc = mkAcc(ctx.state)
    const other = voyeurTarget(acc.state, ctx.seat, io!)
    if (!other) return done(acc)
    const hand = acc.state.seats[other]!.hand
    const ch = cardChoice(acc.state, hand.map((c) => ({ seat: other, card: c })), (x) => cardName(acc.state, x.card))
    const pick = hand.length ? ch.find(io!.ask(ctx.seat, ch.opts))?.card : undefined
    if (!pick) return done(acc)
    setSeatState(acc, other, { hand: hand.filter((c) => c !== pick) })
    setSeatState(acc, ctx.seat, { hand: [...acc.state.seats[ctx.seat]!.hand, pick] })
    patchState(acc, { cardUses: { ...acc.state.cardUses, [pick]: { ...(acc.state.cardUses[pick] ?? {}), $lockUntil: acc.state.roundNumber + 1 } } })
    emitEvent(acc, { type: 'CardStolen', from: other, to: ctx.seat, cardId: pick })
    return done(acc)
  }),
  /** Voyeur: the hand is shown to the whole table (the card types, not the card ids). */
  eff('crossroads.voyeur.expose', (ctx, _p, io) => {
    const acc = mkAcc(ctx.state)
    const other = voyeurTarget(acc.state, ctx.seat, io!)
    if (other) emitEvent(acc, { type: 'EffectApplied', effectId: `m:${acc.state.rollSeq}:shown`, sourceId: 'xr.voyeur', name: 'handShown', targetIds: acc.state.seats[other]!.hand.map((c) => acc.state.cards[c]!.defId), expires: null, refreshed: false })
    return done(acc)
  }),
  /** Mugging: all but 1 of the seat's hand cards (its choice) go to the exiled survivor's controller. */
  eff('crossroads.mugging.hand', (ctx, _p, io) => {
    const acc = mkAcc(ctx.state)
    const thief = muggingThief(acc.state, ctx.seat, io!)
    if (!thief) return done(acc)
    const hand = [...acc.state.seats[ctx.seat]!.hand]
    if (hand.length <= 1) return done(acc)
    const keep = io!.ask(ctx.seat, hand.map((c) => ({ id: c, label: cardName(acc.state, c) })))
    for (const c of hand.filter((x) => x !== keep)) {
      setSeatState(acc, ctx.seat, { hand: acc.state.seats[ctx.seat]!.hand.filter((x) => x !== c) })
      setSeatState(acc, thief.owner, { hand: [...acc.state.seats[thief.owner]!.hand, c] })
      emitEvent(acc, { type: 'CardStolen', from: ctx.seat, to: thief.owner, cardId: c })
    }
    return done(acc)
  }),
  /** Mugging: fight back. A survivor of the seat that shares a location with the exiled one takes 2 wounds; with a weapon it may kill the attacker and take only 1. */
  eff('crossroads.mugging.fight', (ctx, _p, io) => {
    const st = ctx.state
    const thief = muggingThief(st, ctx.seat, io!)
    if (!thief) return nothing(ctx)
    const mine = aliveSurvivors(st).filter((s) => s.owner === ctx.seat && s.location === thief.location)
    const pick = io!.ask(ctx.seat, mine.map((s) => ({ id: s.id, label: nameOf(st, s.id) })))
    if (!pick) return nothing(ctx)
    const armed = st.seats[ctx.seat]!.hand.some((c) => hasSym(st, c, 'weapon')) || aliveSurvivors(st).some((s) => s.owner === ctx.seat && s.equipped.some((c) => hasSym(st, c, 'weapon')))
    const kill = armed ? io!.ask(ctx.seat, [{ id: 'wounds', label: 'Take 2 wounds' }, { id: 'kill', label: 'Kill the attacker and take 1 wound' }]) === 'kill' : false
    const only = (value: string) => ({ who: 'allSurvivors', filter: { test: 'survivorIs', subject: 'survivor', value } }) as const
    return nothing(ctx, kill ? [{ op: 'wound', count: 1, scope: only(pick) }, { op: 'killSurvivor', scope: only(thief.id) }] : [{ op: 'wound', count: 2, scope: only(pick) }])
  }),
  /** Prophet: the exiled seat takes a non-exiled survivor standing with one of its own into its following. */
  eff('crossroads.prophet.convert', (ctx, _p, io) => {
    const acc = mkAcc(ctx.state)
    const st = acc.state
    const mineAt = new Set(aliveSurvivors(st).filter((s) => s.owner === ctx.seat).map((s) => s.location))
    const c = aliveSurvivors(st).filter((s) => s.owner && s.owner !== ctx.seat && !exiled(st, s.owner) && mineAt.has(s.location) && st.seats[s.owner]!.survivors.length > 1)
    const pick = io!.ask(ctx.seat, c.map((s) => ({ id: s.id, label: nameOf(st, s.id) })))
    if (pick) transferInto(acc, pick, ctx.seat)
    return done(acc)
  }),
  /** Wavering Loyalties: a survivor of the seat's following moves to a seat that has fewer survivors. */
  eff('crossroads.wavering.give', (ctx, _p, io) => {
    const acc = mkAcc(ctx.state)
    const st = acc.state
    const mine = st.seats[ctx.seat]!.survivors.filter((id) => st.survivors[id]?.status === 'alive')
    const to = live(st).filter((s) => s !== ctx.seat && st.seats[s]!.survivors.length < mine.length)
    if (!to.length) return done(acc)
    const who = io!.ask(ctx.seat, mine.map((id) => ({ id, label: nameOf(st, id) })))
    const seat = who ? io!.ask(ctx.seat, to.map((s) => ({ id: s, label: st.seats[s]!.seat.name ?? s }))) : null
    if (who && seat) transferInto(acc, who, seat)
    return done(acc)
  }),
  /** Rod Miller: two survivors the seat chooses and Rod are carried to the hospital (room is made by sending its occupants to the colony), then each rolls exposure twice. */
  eff('crossroads.rod-miller.carry', (ctx, _p, io) => {
    const acc = mkAcc(ctx.state)
    const rod = acc.state.survivors['sv.rod-miller']
    if (!rod || rod.status !== 'alive') return done(acc)
    const group: SurvivorId[] = [rod.id]
    const own = aliveSurvivors(acc.state).filter((s) => s.owner === ctx.seat && s.id !== rod.id)
    const left = [...own]
    for (let i = 0; i < 2 && left.length; i++) {
      const pick = io!.ask(ctx.seat, left.map((s) => ({ id: s.id, label: `${nameOf(acc.state, s.id)} (${nameOf(acc.state, s.location)})` })))
      if (!pick) break
      group.push(pick); left.splice(left.findIndex((s) => s.id === pick), 1)
    }
    const hospital = 'loc.hospital'
    const need = group.filter((id) => acc.state.survivors[id]!.location !== hospital).length
    const free = (): number => acc.state.locations[hospital]!.capacity.survivors - survivorsAt(acc.state, hospital).length - acc.state.locations[hospital]!.helpless
    let guard = 0
    while (free() < need && guard++ < 6) {
      const there = survivorsAt(acc.state, hospital).filter((s) => !group.includes(s.id))
      if (!there.length || !hasSpace(acc.state, 'colony')) break
      const pick = there.length === 1 ? there[0]!.id : io!.ask(ctx.seat, there.map((s) => ({ id: s.id, label: `Send ${nameOf(acc.state, s.id)} to the colony` })))
      if (!pick) break
      placeInto(acc, pick, 'colony')
    }
    const placed = group.filter((id) => placeInto(acc, id, hospital) || acc.state.survivors[id]!.location === hospital)
    const then: EffectNode[] = placed.map((id) => ({ op: 'exposure', count: 2, value: 'card', scope: { who: 'allSurvivors', filter: { test: 'survivorIs', subject: 'survivor', value: id } } }))
    return done(acc, then)
  }),
  /** Sewer Passage: the survivor the seat picks at the library rolls exposure as often as a die says; if it lives, the sewer opens for good. */
  eff('crossroads.sewer-passage.dig', (ctx, _p, io) => {
    const acc = mkAcc(ctx.state)
    const c = candidates(acc.state, ctx.seat, { who: 'own', where: 'loc.library' })
    const id = io!.ask(ctx.seat, c.map((x) => ({ id: x.id, label: nameOf(acc.state, x.id) })))
    if (!id) return done(acc)
    const k = rollD6(acc, ctx.seat)
    return done(acc, [
      { op: 'exposure', count: k, value: 'card', scope: { who: 'allSurvivors', filter: { test: 'survivorIs', subject: 'survivor', value: id } } },
      { code: 'crossroads.rule.ifAlive', params: { survivor: id, then: [{ code: 'crossroads.rule.attach', params: { name: 'sewer', sewer: true } }] } },
    ])
  }),
  /** Mike Cho: the survivor (and so the location) is the seat's choice among its own survivors outside the colony with zombies. */
  eff('crossroads.mike-cho.where', (ctx, p, io) => {
    const c = candidates(ctx.state, ctx.seat, { who: 'own', where: 'nonColony', zombies: true })
    if (!c.length) return nothing(ctx)
    const id = io!.ask(ctx.seat, c.map((x) => ({ id: x.id, label: candLabel(ctx.state, x) })))
    const pick = c.find((x) => x.id === id)
    return nothing(ctx, pick ? subst(subst(nodes(p['then']), '$pick', pick.id), '$pickLoc', pick.location) : [])
  }),
  /** Missing Child: for this and the next round every search is noted; at the end of the next round the colony is rewarded or punished. */
  eff('crossroads.missing-child.watch', (ctx) => {
    const acc = mkAcc(ctx.state)
    const track = { id: 'track', kind: 'triggered', trigger: 'action.search', effect: [{ code: 'crossroads.missing-child.note' }] }
    const settle = { id: 'settle', kind: 'triggered', trigger: 'colony.roundTick', effect: [{ code: 'crossroads.missing-child.settle' }] }
    addLasting(acc, { name: 'xr.missing-child#watch', sourceId: 'xr.missing-child', sourceKind: 'crossroads', duration: 'game', data: { global: [track, settle], searched: [], untilRound: acc.state.roundNumber + 1 } })
    return done(acc)
  }),
  eff('crossroads.missing-child.note', (ctx) => {
    const e = ctx.state.effects.find((x) => x.name === 'xr.missing-child#watch')
    if (!e || !ctx.location || (e.data?.['searched'] as string[]).includes(ctx.location)) return nothing(ctx)
    const acc = mkAcc(ctx.state)
    patchState(acc, { effects: acc.state.effects.map((x) => (x === e ? { ...x, data: { ...x.data, searched: [...(x.data!['searched'] as string[]), ctx.location!] } } : x)) })
    return done(acc)
  }),
  eff('crossroads.missing-child.settle', (ctx) => {
    const e = ctx.state.effects.find((x) => x.name === 'xr.missing-child#watch')
    if (!e || ctx.state.roundNumber < Number(e.data?.['untilRound'])) return nothing(ctx)
    const acc = mkAcc({ ...ctx.state, effects: ctx.state.effects.filter((x) => x !== e) })
    const outside = acc.state.locationOrder.filter((l) => l !== 'colony')
    const all = outside.every((l) => (e.data!['searched'] as string[]).includes(l))
    return done(acc, all ? [{ op: 'morale', value: 1 }] : [{ op: 'morale', value: -1 }, { op: 'removeHelpless', count: 1, location: 'colony', value: 'noMorale' }])
  }),
  /** Talia Jones: the next crisis to be revealed is removed from the game and its step skipped. */
  eff('crossroads.talia-jones.foresee', (ctx) => {
    const e = ctx.state.effects.find((x) => x.name === 'xr.talia-jones#foresee')
    if (!ctx.state.crisis.cardId || !e) return nothing(ctx)
    // the card is kept in the crisis history as a crisis that never happened (so every crisis card stays accounted for), and nobody adds cards to it
    const stub = { total: 0, needed: 0, prevented: true, bonus: false, revealed: [], moraleDelta: 0 }
    const history = [...ctx.state.crisis.history, { roundNumber: ctx.state.roundNumber, cardId: ctx.state.crisis.cardId, result: stub }]
    const acc = mkAcc({ ...ctx.state, effects: ctx.state.effects.filter((x) => x !== e), crisis: { ...ctx.state.crisis, cardId: null, history } })
    emitEvent(acc, { type: 'EffectApplied', effectId: e.id, sourceId: 'xr.talia-jones', name: 'crisisForeseen', targetIds: [ctx.state.crisis.cardId], expires: null, refreshed: false })
    addLasting(acc, { name: 'xr.talia-jones#quiet', sourceId: 'xr.talia-jones', sourceKind: 'crossroads', forbid: ['contribute'], duration: 'round' })
    return done(acc)
  }),
  /** Olivia Brown: a blank experiment shields the colony from bites this round (Medicine cards are discarded to ignore them). */
  eff('crossroads.olivia-brown.shield', (ctx) => {
    const acc = mkAcc(ctx.state)
    addLasting(acc, { name: 'xr.olivia-brown#shield', sourceId: 'xr.olivia-brown', sourceKind: 'crossroads', grants: ['biteShield'], duration: 'round' })
    return done(acc)
  }),
  /** Thomas Heart: rage, and the medics' alternative (two Medicine cards out of the game, else the rage). */
  eff('crossroads.thomas-heart.rage', (ctx, _p, io) => rage(ctx, io!)),
  eff('crossroads.thomas-heart.medics', (ctx, _p, io) => {
    const acc = mkAcc(ctx.state)
    if (handCount(acc.state, 'medicine') < 2) return rage(ctx, io!)
    const left = live(acc.state).flatMap((s) => acc.state.seats[s]!.hand.filter((c) => hasSym(acc.state, c, 'medicine')).map((c) => ({ seat: s, card: c })))
    for (let i = 0; i < 2; i++) {
      const ch = cardChoice(acc.state, left, (x) => `${cardName(acc.state, x.card)} (${acc.state.seats[x.seat]!.seat.name ?? x.seat})`)
      const m = ch.find(io!.ask(ctx.seat, ch.opts)) as { seat: SeatId; card: string } | undefined
      if (!m) break
      left.splice(left.indexOf(m), 1)
      discardTo(acc, m.seat, m.card, 'removed', 'crossroads')
    }
    return done(acc)
  }),
  eff('crossroads.rule.noop', noopHook),
])

/** The seat Voyeur looks at: the controller of the one other survivor that shares a location with one of the active seat's two-survivor pairs. */
function voyeurTarget(st: GameState, seat: SeatId, io: HookIO): SeatId | null {
  const all = aliveSurvivors(st)
  const others = new Set<SeatId>()
  for (const a of all.filter((s) => s.owner === seat)) {
    const here = all.filter((s) => s.location === a.location)
    if (here.length === 2) for (const b of here) if (b.owner && b.owner !== seat) others.add(b.owner)
  }
  const list = [...others]
  if (list.length <= 1) return list[0] ?? null
  return io.ask(seat, list.map((s) => ({ id: s, label: st.seats[s]!.seat.name ?? s })))
}
/** The exiled survivor that mugs the seat's survivor (asked when several stand with it). */
function muggingThief(st: GameState, seat: SeatId, io: HookIO): { id: SurvivorId; owner: SeatId; location: LocationId } | null {
  const all = aliveSurvivors(st)
  const mineAt = new Set(all.filter((s) => s.owner === seat).map((s) => s.location))
  const t = all.filter((s) => s.owner && exiled(st, s.owner) && mineAt.has(s.location)).map((s) => ({ id: s.id, owner: s.owner!, location: s.location }))
  if (t.length <= 1) return t[0] ?? null
  const pick = io.ask(seat, t.map((x) => ({ id: x.id, label: nameOf(st, x.id) })))
  return t.find((x) => x.id === pick) ?? null
}
