// M8: the 60 added Crossroads cards, one scenario each (trigger fires, each option does what the card says) on a game built from the
// default bundle (src/data), plus the engine seams they rely on (every action window reaches the held card, action.any, vote ties,
// decider, three options, lasting abilities and rules).
import { beforeAll, describe, expect, it } from 'vitest'
import { createRandomDecider } from '../../src/ai/random'
import type { Action } from '../../src/engine/actions'
import {
  CODE_HOOKS, attackExposureSkip, biteShield, cardLocked, extraDiceFor, extraFoodUpkeep, extraVictory, sewerRoute, snowmobileTrail, wasteStep,
} from '../../src/engine/code-hooks'
import { afterAction, resumeEffects, type WindowCtx } from '../../src/engine/effects'
import type { GameEvent } from '../../src/engine/events'
import { createGame, legalActions, step, view } from '../../src/engine/index'
import type { GameState, PendingDecision, WindowId } from '../../src/engine/types'
import { loadDefaultBundle } from '../../tools/default-bundle'
import { setupFor } from '../../tools/sim-core'

let base: GameState
beforeAll(async () => {
  const decider = createRandomDecider('xrd-m8')
  let r = createGame(setupFor(4, 'obj.main.stockpile'), 'xrd-m8', loadDefaultBundle())
  while (r.state.phase === 'setup') {
    const a = await decider.decide(view(r.state, r.pending.seat === 'all' ? 's1' : r.pending.seat), r.pending, legalActions(r.state))
    r = step(r.state, a)
  }
  base = r.state
})

// ---------- state helpers ----------
const types = (evs: GameEvent[]): string[] => evs.map((e) => e.type)
const active = (s: GameState): string => s.activeSeat!
const SV = (name: string): string => `sv.${name}`
type Prep = (s: GameState) => GameState
const pipe = (...f: Prep[]): Prep => (s) => f.reduce((a, g) => g(a), s)
const patchSv = (id: string, p: object): Prep => (s) => ({ ...s, survivors: { ...s.survivors, [id]: { ...s.survivors[id]!, ...p } } })
/** Put the survivor in play for `seat` at `loc` (leaving the deck or any other seat). */
const give = (id: string, seat: string, loc = 'colony', wounds = 0): Prep => (s) => {
  const sv = { id, owner: seat, location: loc, status: 'alive' as const, wounds, frostbite: 0, equipped: [], movedThisTurn: false, extraMoves: 0 }
  const seats = { ...s.seats }
  for (const k of s.seatOrder) seats[k] = { ...seats[k]!, survivors: seats[k]!.survivors.filter((x) => x !== id) }
  seats[seat] = { ...seats[seat]!, survivors: [...seats[seat]!.survivors, id], leaderId: seats[seat]!.leaderId ?? id }
  return { ...s, survivorDeck: s.survivorDeck.filter((x) => x !== id), survivors: { ...s.survivors, [id]: sv }, seats }
}
/** The survivor card goes back to the top of the survivor deck (and out of every seat). */
const inDeck = (id: string): Prep => (s) => {
  const seats = { ...s.seats }
  for (const k of s.seatOrder) seats[k] = { ...seats[k]!, survivors: seats[k]!.survivors.filter((x) => x !== id) }
  const survivors = { ...s.survivors }
  delete survivors[id]
  return { ...s, seats, survivors, survivorDeck: [id, ...s.survivorDeck.filter((x) => x !== id)] }
}
const colonyRoom: Prep = (s) => {
  let st = s
  for (const sv of Object.values(s.survivors)) if (sv.status === 'alive' && sv.location === 'colony' && Object.values(st.survivors).filter((x) => x.status === 'alive' && x.location === 'colony').length + (st.locations['colony']!.helpless) > 5) st = patchSv(sv.id, { location: 'loc.school' })(st)
  return st
}
const setLoc = (loc: string, p: object): Prep => (s) => ({ ...s, locations: { ...s.locations, [loc]: { ...s.locations[loc]!, ...p } } })
/** Zombies and barricades on the nth entrance (0-based) of a location. */
const setZombies = (loc: string, nth: number, zombies: number, barricades = 0): Prep => (s) =>
  setLoc(loc, { entrances: s.locations[loc]!.entrances.map((e, i) => (i === nth ? { ...e, zombies, barricades } : e)) })(s)
/** Every colony entrance fully barricaded, so zombies added there tear down barricades instead of overrunning survivors. */
const fortify: Prep = (s) => setLoc('colony', { entrances: s.locations['colony']!.entrances.map((e) => ({ ...e, zombies: 0, barricades: 3 })) })(s)
const clearColony: Prep = (s) => setLoc('colony', { entrances: s.locations['colony']!.entrances.map((e) => ({ ...e, zombies: 0, barricades: 0 })), helpless: 0 })(s)
const zombiesAt = (s: GameState, loc: string): number => s.locations[loc]!.entrances.reduce((a, e) => a + e.zombies, 0)
const barricadesAt = (s: GameState, loc: string): number => s.locations[loc]!.entrances.reduce((a, e) => a + e.barricades, 0)
const handOf = (s: GameState, seat: string): string[] => s.seats[seat]!.hand.map((c) => s.cards[c]!.defId)
/** A card of that kind (from a location deck, the hands or the waste) goes to the seat's hand. */
const hand = (defId: string, seat: string, n = 1): Prep => (s) => {
  let st = s
  for (let k = 0; k < n; k++) {
    const id = Object.keys(st.cards).find((c) => st.cards[c]!.defId === defId && !st.seats[seat]!.hand.includes(c) && !st.removed.includes(c) && !st.removedHidden.includes(c))!
    const seats = { ...st.seats }
    for (const q of st.seatOrder) seats[q] = { ...seats[q]!, hand: seats[q]!.hand.filter((c) => c !== id) }
    seats[seat] = { ...seats[seat]!, hand: [...seats[seat]!.hand, id] }
    st = {
      ...st, seats, waste: st.waste.filter((c) => c !== id),
      locations: Object.fromEntries(st.locationOrder.map((l) => [l, { ...st.locations[l]!, deck: st.locations[l]!.deck.filter((c) => c !== id) }])),
      survivors: Object.fromEntries(Object.entries(st.survivors).map(([k, v]) => [k, { ...v, equipped: v.equipped.filter((c) => c !== id) }])),
    }
  }
  return st
}
const noHand = (seat: string): Prep => (s) => ({ ...s, waste: [...s.seats[seat]!.hand, ...s.waste], seats: { ...s.seats, [seat]: { ...s.seats[seat]!, hand: [] } } })
const removedCards = (defId: string, n: number): Prep => (s) => {
  const ids = Object.keys(s.cards).filter((c) => s.cards[c]!.defId === defId && !s.removed.includes(c) && !s.seatOrder.some((q) => s.seats[q]!.hand.includes(c))).slice(0, n)
  return {
    ...s, removed: [...s.removed, ...ids],
    locations: Object.fromEntries(s.locationOrder.map((l) => [l, { ...s.locations[l]!, deck: s.locations[l]!.deck.filter((c) => !ids.includes(c)) }])),
    waste: s.waste.filter((c) => !ids.includes(c)),
  }
}
const exile = (seat: string): Prep => (s) => ({ ...s, seats: { ...s.seats, [seat]: { ...s.seats[seat]!, seat: { ...s.seats[seat]!.seat, exiled: true } } } })
const food = (n: number): Prep => (s) => ({ ...s, food: n })
const withDice = (seat: string, vals: number[]): Prep => (s) => ({ ...s, seats: { ...s.seats, [seat]: { ...s.seats[seat]!, dice: vals.map((v, i) => ({ id: `${seat}:d${i + 1}`, value: v, used: false })) } } })
const held = (cardId: string): Prep => (s) => ({ ...s, crossroads: { ...s.crossroads, deck: s.crossroads.deck.filter((c) => c !== cardId), held: { cardId, holder: s.seatOrder[(s.seatOrder.indexOf(s.activeSeat!) + s.seatOrder.length - 1) % s.seatOrder.length]!, forSeat: s.activeSeat! } } })
const unusedDice = (s: GameState, seat: string): number => s.seats[seat]!.dice.filter((d) => !d.used).length

// ---------- running a card ----------
interface Run { before: GameState; after: GameState; events: GameEvent[]; triggered: boolean; pendings: PendingDecision[] }
/** Answer every open effect decision: the first offered option, or (votes) the ballot `yes`. */
function settle(s: GameState, pd: PendingDecision | undefined, opts: { yes?: boolean; pick?: (pd: PendingDecision) => number } = {}): { state: GameState; events: GameEvent[]; pendings: PendingDecision[] } {
  let state = s
  const events: GameEvent[] = []
  const pendings: PendingDecision[] = []
  for (let i = 0; i < 40 && state.phase !== 'ended' && state.pending.kind !== 'turnAction'; i++) {
    const cur = state.pending
    pendings.push(cur)
    let action: Action
    if (cur.kind === 'turnAction') break
    if (cur.kind === 'votes') {
      const data = cur.context.data as { eligible: string[]; tiebreakSeat?: string }
      const votes: Record<string, boolean> = {}
      for (const q of [...data.eligible, ...(data.tiebreakSeat ? [data.tiebreakSeat] : [])]) votes[q] = opts.yes ?? true
      action = { type: 'castVotes', decisionId: cur.id, seat: 'all', votes }
    } else action = cur.options![opts.pick ? opts.pick(cur) : 0]!.action
    const r = step(state, action)
    expect(r.rejection, JSON.stringify(r.rejection)).toBeUndefined()
    state = r.state; events.push(...r.events)
  }
  void pd
  return { state, events, pendings }
}
function run(cardId: string, point: WindowId, ctx: WindowCtx, prep: Prep, optionId?: string, opts: { yes?: boolean; pick?: (pd: PendingDecision) => number } = {}): Run {
  const before = held(cardId)(prep(base))
  const r = afterAction(before, point, { seat: active(before), ...ctx })
  const triggered = types(r.events).includes('CrossroadsTriggered')
  let state = r.state
  const events = [...r.events]
  if (r.pending?.kind === 'crossroadsOption') {
    const opt = optionId ? r.pending.options!.find((o) => o.id === optionId) : r.pending.options![0]
    expect(opt, `${optionId ?? 'first option'} offered`).toBeTruthy()
    const c = step(state, opt!.action)
    expect(c.rejection).toBeUndefined()
    state = c.state; events.push(...c.events)
  }
  const s = settle(state, undefined, opts)
  return { before, after: s.state, events: [...events, ...s.events], triggered, pendings: s.pendings }
}
const fires = (cardId: string, point: WindowId, ctx: WindowCtx, prep: Prep): boolean => run(cardId, point, ctx, prep, undefined).triggered
/** The option ids the card offers once triggered (a collapsed vote shows one). */
const offered = (cardId: string, point: WindowId, ctx: WindowCtx, prep: Prep): string[] => {
  const before = held(cardId)(prep(base))
  const r = afterAction(before, point, { seat: active(before), ...ctx })
  return r.pending?.kind === 'crossroadsOption' ? r.pending.options!.map((o) => o.id) : []
}

const me = (s: GameState): string => s.seats[active(s)]!.survivors[0]!
const other = (s: GameState): string => s.seatOrder.find((q) => q !== active(s))!
const STAND: Prep = (s) => s
const alive = (s: GameState, id: string): boolean => s.survivors[id]?.status === 'alive'
const woundsOf = (s: GameState, id: string): number => (s.survivors[id]?.wounds ?? 0) + (s.survivors[id]?.frostbite ?? 0)
const effectNamed = (s: GameState, name: string) => s.effects.find((e) => e.name === name)

describe('M8 engine seams', () => {
  it('XRD-M8-001 every die action window reaches the held Crossroads card (a move triggers Fuel Tanker)', () => {
    const s = held('xr.fuel-tanker')(base)
    const sv = s.seats[active(s)]!.survivors[0]!
    const dest = Object.keys(s.locations).find((l) => l !== 'colony' && s.survivors[sv]!.location !== l)!
    const dice = withDice(active(s), [3, 3])(s)
    const mv = legalActions(dice).find((a) => a.type === 'move' && a.survivorId === sv && a.to === dest)
    if (!mv) return
    const r = step(dice, mv)
    expect(types(r.events)).toContain('CrossroadsTriggered')
    expect(r.pending.kind).toBe('crossroadsOption')
  })
  it('XRD-M8-002 action.any fires after any action; a vote card with both thumbs runs the vote at once; a third option is offered', () => {
    expect(fires('xr.helpless', 'action.barricade', {}, STAND)).toBe(true)
    const r = run('xr.helpless', 'action.search', {}, STAND)
    expect(r.after.pending.kind === 'votes' || r.pendings.some((p) => p.kind === 'votes')).toBe(true)
    expect(offered('xr.army', 'action.move', {}, pipe(give(SV('thomas-heart'), active(base), 'colony')))).toEqual(['up', 'call-the-bluff'])
    expect(offered('xr.riot', 'action.search', {}, pipe(clearColony, setLoc('colony', { helpless: 4 }), (s) => ({ ...s, survivors: Object.fromEntries(Object.entries(s.survivors).map(([k, v]) => [k, v.location === 'colony' ? { ...v, location: 'loc.school' } : v])) }), give(SV('forest-plum'), active(base), 'colony')))).toEqual(['empty-the-pantry', 'let-it-turn-ugly', 'make-an-example'])
  })
  it('XRD-M8-003 an effect vote that ties goes to the first player even when exiled; the extra ballot key carries its answer', () => {
    // seats s1..s4, first player s2: exile s2 and s3, so s1 and s4 vote and a 1-1 split is a tie that only the exiled first player can break
    const prep = pipe(exile(base.firstSeat), exile('s3'), setLoc('colony', { helpless: 1 }))
    const before = held('xr.helpless')(prep(base))
    const r = afterAction(before, 'action.search', { seat: active(before) })
    expect(r.pending!.kind).toBe('votes')
    const data = r.pending!.context.data as { eligible: string[]; tiebreakSeat?: string }
    expect(data.tiebreakSeat).toBe(base.firstSeat)
    expect(data.eligible).toEqual(['s1', 's4'])
    const ballot = (first: boolean) => resumeEffects(r.state, { type: 'castVotes', decisionId: r.pending!.id, seat: 'all', votes: { s1: true, s4: false, [base.firstSeat]: first } })
    const yes = ballot(true)
    const no = ballot(false)
    expect(yes.rejection).toBeUndefined()
    expect(yes.events.find((e) => e.type === 'VoteResult')).toMatchObject({ yes: 1, no: 1, tiebreakBy: base.firstSeat })
    expect(yes.state.locations['colony']!.helpless).toBe(0) // the first player said yes: the thumbs-up side wins
    expect(no.state.locations['colony']!.helpless).toBe(1)
  })
  it('XRD-M8-004 a card whose decider is a survivor asks that survivor\'s controller (Dynamite, Thomas Heart)', () => {
    const owner = other(base)
    const prep = pipe(give(SV('edward-white'), owner, 'colony'), give(SV('john-price'), active(base), 'colony'))
    const before = held('xr.dynamite')(prep(base))
    const r = afterAction(before, 'action.search', { seat: active(before) })
    expect(r.pending).toMatchObject({ kind: 'crossroadsOption', seat: owner })
  })
  it('XRD-M8-005 the new hooks are all registered and the schema accepts three options', () => {
    for (const n of ['crossroads.rule.survivor', 'crossroads.rule.attach', 'crossroads.rule.pick', 'crossroads.rule.searchDeck', 'crossroads.rule.recruit', 'crossroads.airplane.fly', 'crossroads.dynamite.blast']) {
      expect(CODE_HOOKS.effects[n] ?? CODE_HOOKS.conditions[n], n).toBeTypeOf('function')
    }
  })
})

describe('M8 cards A', () => {
  it('Abandoned: a clean at a colony with a helpless token; thumbs up keeps the baby, thumbs down costs dice', () => {
    const prep = pipe(clearColony, fortify, setLoc('colony', { helpless: 1 }))
    expect(fires('xr.abandoned', 'action.cleanWaste', {}, STAND)).toBe(false)
    const up = run('xr.abandoned', 'action.cleanWaste', {}, prep, undefined, { yes: true })
    expect(up.triggered).toBe(true)
    expect(up.after.locations['colony']!.helpless).toBe(2)
    expect(types(up.events).filter((t) => t === 'ZombieAdded' || t === 'BarricadeDestroyed').length).toBeGreaterThanOrEqual(1)
    const down = run('xr.abandoned', 'action.cleanWaste', {}, prep, undefined, { yes: false })
    expect(down.after.locations['colony']!.helpless).toBe(1)
    for (const q of down.before.seatOrder) expect(unusedDice(down.after, q)).toBeLessThanOrEqual(Math.max(0, unusedDice(down.before, q) - 1))
  })

  it('Addiction: a Medicine play that heals; kill the survivor with no morale loss, or attach the craving', () => {
    const seat = active(base)
    const target = base.seats[seat]!.survivors[0]!
    const prep = pipe(patchSv(target, { wounds: 1 }), hand('it.medicine', seat))
    const med = prep(base).seats[seat]!.hand.find((c) => prep(base).cards[c]!.defId === 'it.medicine')!
    const play = (optionId: string) => {
      const before = held('xr.addiction')(prep(base))
      const act: Action = { type: 'playCard', decisionId: before.pending.id, seat, cardId: med }
      const first = step(before, act)
      expect(types(first.events)).toContain('CrossroadsTriggered')
      let state = first.state
      let evs = first.events
      if (first.pending.kind === 'itemTarget' || first.pending.kind === 'effectChoice') throw new Error('target choice should resolve with one wounded survivor')
      const pick = first.pending.options!.find((o) => o.id === optionId)!
      const r = step(state, pick.action)
      state = r.state; evs = [...evs, ...r.events]
      return { before, state, evs }
    }
    const kill = play('swallow-the-rest')
    expect(alive(kill.state, target)).toBe(false)
    expect(kill.state.morale).toBe(kill.before.morale)
    const keep = play('keep-the-habit')
    expect(keep.state.effects.some((e) => (e.data?.['ability'] as { id?: string } | undefined)?.id === 'craving' && e.survivorIds?.includes(target))).toBe(true)
    expect(fires('xr.addiction', 'action.playCard', { cardId: prep(base).seats[seat]!.hand.find((c) => prep(base).cards[c]!.defId === 'it.food-1') ?? med }, prep)).toBe(false)
  })

  it('Airplane: Sophie in play; the vote spends a Tool, a Fuel and Sophie for morale', () => {
    const seat = active(base)
    const prep = pipe(give(SV('sophie-robinson'), other(base), 'colony'), hand('it.fuel', seat), hand('it.wrench', seat), clearColony)
    expect(fires('xr.airplane', 'action.move', {}, STAND)).toBe(false)
    const lowMorale = pipe(prep, (s) => ({ ...s, morale: 5 }))
    const up = run('xr.airplane', 'action.move', {}, lowMorale, undefined, { yes: true })
    expect(up.triggered).toBe(true)
    expect(up.after.morale).toBe(6)
    expect(up.after.survivors[SV('sophie-robinson')]!.status).toBe('removed')
    expect(up.after.removed.length).toBe(up.before.removed.length + 2)
    const no = run('xr.airplane', 'action.move', {}, lowMorale, undefined, { yes: false })
    expect(no.after.morale).toBe(5)
    const poor = run('xr.airplane', 'action.move', {}, pipe(give(SV('sophie-robinson'), other(base), 'colony'), noHand(seat), noHand(other(base)), noHand(base.seatOrder[2]!), noHand(base.seatOrder[3]!)), undefined, { yes: true })
    expect(poor.after.survivors[SV('sophie-robinson')]!.status).toBe('alive')
  })

  it('Alexis Grey: stays at the library for good, or goes home and can never go back', () => {
    const seat = active(base)
    const prep = give(SV('alexis-grey'), seat, 'colony')
    expect(fires('xr.alexis-grey', 'action.search', {}, give(SV('alexis-grey'), other(base), 'colony'))).toBe(false)
    const stay = run('xr.alexis-grey', 'action.search', {}, prep, 'stay-and-read')
    expect(stay.after.survivors[SV('alexis-grey')]!.location).toBe('loc.library')
    expect(stay.after.effects.some((e) => e.forbid?.includes('move') && e.survivorIds?.includes(SV('alexis-grey')))).toBe(true)
    const away = run('xr.alexis-grey', 'action.search', {}, pipe(prep, patchSv(SV('alexis-grey'), { location: 'loc.library' })), 'walk-away')
    expect(away.after.survivors[SV('alexis-grey')]!.location).toBe('colony')
    const dice = withDice(seat, [4, 4])(away.after)
    const goes = legalActions(dice).filter((a) => a.type === 'move' && a.survivorId === SV('alexis-grey') && a.to === 'loc.library')
    expect(goes).toHaveLength(0)
  })

  it('Andrew Evans: a greenhouse action (+2 food, once a round) or +1 morale; he is placed at the Grocery Store either way', () => {
    const seat = active(base)
    const prep = pipe(give(SV('andrew-evans'), seat, 'colony'), food(3), withDice(seat, [2, 2]), (s) => ({ ...s, morale: 4 }))
    const g = run('xr.andrew-evans', 'action.search', {}, prep, 'build-a-greenhouse')
    expect(g.after.survivors[SV('andrew-evans')]!.location).toBe('loc.grocery-store')
    const atColony = patchSv(SV('andrew-evans'), { location: 'colony' })(g.after)
    const ab = legalActions(atColony).find((a) => a.type === 'useAbility' && a.abilityId === 'greenhouse')
    expect(ab).toBeTruthy()
    expect(step(atColony, ab!).state.food).toBe(5)
    const m = run('xr.andrew-evans', 'action.search', {}, prep, 'insulate-the-colony')
    expect(m.after.morale).toBe(5)
  })

  it('Army: tribute adds the 5-food victory condition; the ambush wounds on 1-3 rolls; Thomas Heart at the colony offers a bluff call', () => {
    const seat = active(base)
    const prep = pipe(give(SV('thomas-heart'), seat, 'colony'))
    const up = run('xr.army', 'action.search', {}, prep, undefined, { yes: true })
    expect(up.after.effects.some((e) => (e.data?.['condition'] as { test?: string } | undefined)?.test === 'foodAtLeast')).toBe(true)
    const down = run('xr.army', 'action.search', {}, prep, undefined, { yes: false })
    expect(types(down.events).filter((t) => t === 'DiceRolled').length).toBeGreaterThanOrEqual(1)
    const call = run('xr.army', 'action.search', {}, prep, 'call-the-bluff')
    expect(call.after.morale).toBe(call.before.morale)
  })

  it('Ashley Ross: walkways skip exposure at colony entrance 1; the waste pit moves the threshold to 15', () => {
    const seat = active(base)
    const prep = give(SV('ashley-ross'), seat, 'colony')
    const w = run('xr.ashley-ross', 'action.search', {}, prep, 'raise-walkways')
    expect(w.after.effects.some((e) => (e.data?.['attackSkip'] as { entrance?: number } | undefined)?.entrance === 1)).toBe(true)
    expect(types(w.events).filter((t) => t === 'ExposureRolled').length).toBe(2)
    const p = run('xr.ashley-ross', 'action.search', {}, prep, 'dig-a-waste-pit')
    expect(p.after.effects.some((e) => e.data?.['wasteStep'] === 15)).toBe(true)
  })
})

describe('M8 cards B-D', () => {
  it('Brandon Kane: wound and home, or the last 10 removed item cards go to the waste pile', () => {
    const seat = other(base)
    const prep = pipe(give(SV('brandon-kane'), seat, 'colony'), removedCards('it.food-1', 3), removedCards('it.fuel', 3), removedCards('it.outsiders-1', 1), clearColony)
    const a = run('xr.brandon-kane', 'action.search', {}, prep, 'make-him-clean-up')
    expect(a.after.survivors[SV('brandon-kane')]!.wounds).toBe(1)
    expect(a.after.survivors[SV('brandon-kane')]!.location).toBe('colony')
    const b = run('xr.brandon-kane', 'action.search', {}, prep, 'bury-the-mess')
    expect(b.after.waste.length).toBe(b.before.waste.length + 6)
    expect(b.after.survivors[SV('brandon-kane')]!.location).toBe('loc.grocery-store')
  })

  it('Buddy Davis: needs him at the colony and not moved; the workouts add a food-for-die rule', () => {
    const seat = active(base)
    const prep = give(SV('buddy-davis'), seat, 'colony')
    expect(fires('xr.buddy-davis', 'action.search', {}, pipe(prep, patchSv(SV('buddy-davis'), { movedThisTurn: true })))).toBe(false)
    const w = run('xr.buddy-davis', 'action.search', {}, prep, 'run-the-workouts')
    expect(w.after.effects.some((e) => Array.isArray(e.data?.['global']))).toBe(true)
    const m = run('xr.buddy-davis', 'action.search', {}, prep, 'take-the-joke')
    expect(m.after.morale).toBe(Math.min(10, m.before.morale + 1))
  })

  it('Car Crash: a fuel move; frostbite and home, or three exposure rolls', () => {
    const seat = active(base)
    const sv = base.seats[seat]!.survivors[0]!
    const fuel: Prep = (s) => ({ ...s, effects: [...s.effects, { id: 'e:fuel', sourceId: 'it.fuel', sourceKind: 'item', name: 'it.fuel#0', grants: ['noExposureOnMove'], survivorIds: [sv], duration: 'turn', expires: null }] })
    expect(fires('xr.car-crash', 'action.move', { survivorId: sv, location: 'loc.school' }, STAND)).toBe(false)
    const home = run('xr.car-crash', 'action.move', { survivorId: sv, location: 'loc.school' }, pipe(clearColony, patchSv(sv, { location: 'loc.school' }), fuel), 'wait-for-rescue')
    expect(home.after.survivors[sv]!.frostbite).toBeGreaterThanOrEqual(1)
    expect(home.after.survivors[sv]!.location).toBe('colony')
    const on = run('xr.car-crash', 'action.move', { survivorId: sv, location: 'loc.school' }, pipe(patchSv(sv, { location: 'loc.school' }), fuel), 'press-on')
    expect(types(on.events).filter((t) => t === 'ExposureRolled' || t === 'ExposureSkipped').length).toBeGreaterThanOrEqual(1)
  })

  it('Collapsing Barriers: each seat with a colony survivor rolls exposure on its pick; or all barricades go', () => {
    const prep = pipe(clearColony, setZombies('colony', 0, 2, 0), setZombies('colony', 1, 0, 1))
    const seats = base.seatOrder.filter((q) => base.seats[q]!.survivors.some((id) => base.survivors[id]!.location === 'colony'))
    const up = run('xr.collapsing-barriers', 'action.search', {}, prep, undefined, { yes: true })
    expect(up.triggered).toBe(true)
    expect(types(up.events).filter((t) => t === 'ExposureRolled' || t === 'ExposureSkipped').length).toBeGreaterThanOrEqual(Math.min(1, seats.length))
    const down = run('xr.collapsing-barriers', 'action.search', {}, prep, undefined, { yes: false })
    expect(barricadesAt(down.after, 'colony')).toBe(0)
  })

  it('Creature Comforts: three fuel cards between the hands for morale; impossible without them', () => {
    const seat = active(base)
    const prep = pipe(hand('it.fuel', seat, 2), hand('it.fuel', other(base), 1), (s) => ({ ...s, morale: 5 }))
    const ok = run('xr.creature-comforts', 'action.search', {}, prep, 'burn-the-fuel')
    expect(ok.after.morale).toBe(6)
    expect(ok.after.waste.length).toBe(ok.before.waste.length + 3)
    const poor = pipe(base.seatOrder.map((q) => noHand(q)).reduce((a, b) => pipe(a, b), STAND))
    expect(offered('xr.creature-comforts', 'action.search', {}, poor)).toEqual([]) // only the decline is possible: it resolves at once
  })

  it('Daniel Smith: a helpless survivor goes; an investigation jails a chosen survivor, or morale falls', () => {
    const seat = active(base)
    const prep = pipe(give(SV('daniel-smith'), seat, 'colony'), setLoc('colony', { helpless: 1 }), withDice(seat, [3]))
    const victim = other(base)
    const vid = base.seats[victim]!.survivors[0]!
    const a = run('xr.daniel-smith', 'action.search', {}, prep, 'open-an-investigation', { pick: (pd) => Math.max(0, pd.options!.findIndex((o) => o.id === vid)) })
    expect(a.after.locations['colony']!.helpless).toBe(0)
    expect(unusedDice(a.after, seat)).toBe(0)
    expect(a.after.survivors[vid]!.location).toBe('loc.police-station')
    expect(a.after.effects.filter((e) => e.forbid && e.survivorIds?.includes(vid)).length).toBeGreaterThanOrEqual(4)
    const b = run('xr.daniel-smith', 'action.search', {}, prep, 'look-away')
    expect(b.after.locations['colony']!.helpless).toBe(0)
    expect(b.after.morale).toBe(b.before.morale - 1)
  })

  it('Dynamite: Edward White decides; a 1 kills both, otherwise rubble replaces zombies; the beer costs a die next round', () => {
    const owner = other(base)
    const prep = pipe(give(SV('edward-white'), owner, 'colony'), give(SV('john-price'), active(base), 'colony'), clearColony, setZombies('colony', 1, 4, 0))
    const before = held('xr.dynamite')(prep(base))
    const r = afterAction(before, 'action.search', { seat: active(before) })
    expect(r.pending!.seat).toBe(owner)
    const blast = step(r.state, r.pending!.options!.find((o) => o.id === 'light-the-fuse')!.action)
    const s = settle(blast.state, undefined)
    const dead = !alive(s.state, SV('edward-white'))
    if (dead) expect(alive(s.state, SV('john-price'))).toBe(false)
    else expect(zombiesAt(s.state, 'colony')).toBeLessThan(4)
    const brew = step(r.state, r.pending!.options!.find((o) => o.id === 'brew-a-batch')!.action)
    expect(brew.state.effects.some((e) => e.grants?.includes('extraDie') && e.data?.['amount'] === -1)).toBe(true)
    expect(brew.state.morale).toBe(Math.min(10, before.morale + 1))
  })
})

describe('M8 cards E-H', () => {
  it('Edward White: 1 food for a removed Medicine card, repeatable this turn; or nothing', () => {
    const seat = active(base)
    const prep = pipe(give(SV('edward-white'), seat, 'colony'), food(4), removedCards('it.medicine', 2))
    const a = run('xr.edward-white', 'action.search', {}, prep, 'culture-the-penicillin')
    expect(a.after.food).toBe(3)
    expect(handOf(a.after, seat).filter((d) => d === 'it.medicine').length).toBe(handOf(a.before, seat).filter((d) => d === 'it.medicine').length + 1)
    const again = legalActions(a.after).find((x) => x.type === 'useAbility' && x.abilityId === 'penicillin')
    expect(again).toBeTruthy()
    const r2 = step(a.after, again!)
    expect(r2.state.food).toBe(2)
    expect(offered('xr.edward-white', 'action.search', {}, pipe(give(SV('edward-white'), seat, 'colony'), food(0), removedCards('it.medicine', 1)))).toEqual([])
  })

  it('Flier: a flavour card, both options do nothing', () => {
    const a = run('xr.flier', 'action.search', {}, STAND, 'read-it')
    expect(a.triggered).toBe(true)
    expect(a.after.morale).toBe(a.before.morale)
  })

  it('Forest Plum: the bottle sends him to the Grocery Store with 4 noise; or the weakest survivor takes a wound', () => {
    const prep = pipe(give(SV('forest-plum'), other(base), 'colony'), setLoc('loc.grocery-store', { noise: 0 }))
    const a = run('xr.forest-plum', 'action.search', {}, prep, 'give-him-the-bottle')
    expect(a.after.survivors[SV('forest-plum')]!.location).toBe('loc.grocery-store')
    expect(a.after.locations['loc.grocery-store']!.noise).toBe(4)
    const b = run('xr.forest-plum', 'action.search', {}, prep, 'tell-him-no')
    const w = (s: GameState) => Object.values(s.survivors).filter((v) => v.status === 'alive' && v.id !== SV('forest-plum')).reduce((n, v) => n + v.wounds, 0)
    expect(w(b.after)).toBe(w(b.before) + 1)
  })

  it('Fuel Tanker: six zombies at the colony and up to four removed Fuel cards in hand; or nothing', () => {
    const seat = active(base)
    const prep = pipe(removedCards('it.fuel', 3), clearColony, fortify)
    const a = run('xr.fuel-tanker', 'action.move', {}, prep, 'drive-it-home')
    expect(handOf(a.after, seat).filter((d) => d === 'it.fuel').length).toBe(handOf(a.before, seat).filter((d) => d === 'it.fuel').length + 3)
    expect(types(a.events).filter((t) => t === 'ZombieAdded' || t === 'BarricadeDestroyed').length).toBeGreaterThanOrEqual(1)
    expect(fires('xr.fuel-tanker', 'action.move', {}, exile(seat))).toBe(false)
  })

  it('Gabriel Diaz: he joins you with 3 helpless tokens; or one hand card leaves the game', () => {
    const seat = active(base)
    const prep = pipe(inDeck(SV('gabriel-diaz')), patchSv(base.seats[seat]!.survivors[0]!, { location: 'loc.school' }), clearColony, colonyRoom)
    const a = run('xr.gabriel-diaz', 'action.search', {}, prep, 'show-them-the-way')
    expect(a.after.survivors[SV('gabriel-diaz')]!.owner).toBe(seat)
    expect(a.after.locations['colony']!.helpless).toBeGreaterThanOrEqual(1)
    const b = run('xr.gabriel-diaz', 'action.search', {}, prep, 'repay-them')
    expect(b.after.seats[seat]!.hand.length).toBe(b.before.seats[seat]!.hand.length - 1)
    expect(b.after.removed.length).toBe(b.before.removed.length + 1)
    expect(fires('xr.gabriel-diaz', 'action.search', {}, pipe(prep, patchSv(base.seats[seat]!.survivors[0]!, { location: 'colony' }), (s) => ({ ...s, seats: { ...s.seats, [seat]: { ...s.seats[seat]!, survivors: [s.seats[seat]!.survivors[0]!] } } })))).toBe(false)
  })

  it('Gambling: the vote deals the cards; the highest die takes the pot', () => {
    const prep = pipe(clearColony)
    const a = run('xr.gambling', 'action.search', {}, prep, undefined, { yes: true })
    expect(a.triggered).toBe(true)
    const total = (s: GameState) => s.seatOrder.reduce((n, q) => n + s.seats[q]!.hand.length, 0)
    expect(total(a.after)).toBe(total(a.before))
    const b = run('xr.gambling', 'action.search', {}, prep, undefined, { yes: false })
    expect(total(b.after)).toBe(total(b.before))
  })

  it('Gray Beard: a random card out of the game, or he leads your group with a crisis ban and a once-a-round attack', () => {
    const seat = active(base)
    const prep = pipe(inDeck(SV('gray-beard')), clearColony, colonyRoom)
    const a = run('xr.gray-beard', 'action.move', {}, prep, 'hand-over-a-card')
    expect(a.after.seats[seat]!.hand.length).toBe(a.before.seats[seat]!.hand.length - 1)
    const b = run('xr.gray-beard', 'action.move', {}, prep, 'follow-his-rules')
    expect(b.after.seats[seat]!.leaderId).toBe(SV('gray-beard'))
    expect(b.after.effects.some((e) => e.forbid?.includes('contribute') && e.data?.['boundSurvivor'] === SV('gray-beard'))).toBe(true)
    expect(b.after.effects.some((e) => (e.data?.['attackSkip'] as { oncePerRound?: boolean } | undefined)?.oncePerRound)).toBe(true)
  })

  it('Harman Brooks: 3 food; or heal up to three wounded survivors', () => {
    const seat = active(base)
    const ids = base.seats[seat]!.survivors
    const prep = pipe(give(SV('harman-brooks'), other(base), 'colony'), patchSv(ids[0]!, { wounds: 2 }))
    expect(run('xr.harman-brooks', 'action.search', {}, prep, 'set-a-snare').after.food).toBe(base.food + 3)
    const b = run('xr.harman-brooks', 'action.search', {}, prep, 'gather-herbs')
    expect(woundsOf(b.after, ids[0]!)).toBe(1)
  })
})

describe('M8 cards H-L', () => {
  it('Helpless: the vote removes every helpless token for half that many morale; or nothing', () => {
    const prep = pipe(setLoc('colony', { helpless: 3 }), (s) => ({ ...s, morale: 6 }))
    const a = run('xr.helpless', 'action.search', {}, prep, undefined, { yes: true })
    expect(a.after.locations['colony']!.helpless).toBe(0)
    expect(a.after.morale).toBe(4)
    const b = run('xr.helpless', 'action.search', {}, prep, undefined, { yes: false })
    expect(b.after.locations['colony']!.helpless).toBe(3)
  })

  it('Horde: three more exposure rolls, or back to where the move began and no more moves this turn', () => {
    const seat = active(base)
    const sv = base.seats[seat]!.survivors[0]!
    const ctx: WindowCtx = { survivorId: sv, location: 'loc.school', params: { reason: 'move', from: 'loc.library' } }
    const prep = pipe(patchSv(sv, { location: 'loc.school' }))
    const a = run('xr.horde', 'action.move', ctx, prep, 'push-through')
    expect(types(a.events).filter((t) => t === 'ExposureRolled' || t === 'ExposureSkipped').length).toBeGreaterThanOrEqual(1)
    const b = run('xr.horde', 'action.move', ctx, prep, 'turn-back')
    expect(b.after.survivors[sv]!.location).toBe('loc.library')
    expect(b.after.effects.some((e) => e.forbid?.includes('move') && e.survivorIds?.includes(sv))).toBe(true)
  })

  it('Horse: no more exposure on that survivor\'s moves and 1 food a round; or 3 food', () => {
    const seat = active(base)
    const sv = base.seats[seat]!.survivors[0]!
    const a = run('xr.horse', 'action.move', { survivorId: sv, location: 'loc.school' }, STAND, 'keep-the-horse')
    expect(a.after.effects.some((e) => e.grants?.includes('noExposureOnMove') && e.survivorIds?.includes(sv))).toBe(true)
    expect(a.after.effects.some((e) => e.data?.['upkeep'] === 1)).toBe(true)
    expect(run('xr.horse', 'action.move', { survivorId: sv }, STAND, 'butcher-the-horse').after.food).toBe(base.food + 3)
  })

  it('Hunger: an Outsiders card that adds a male survivor and a helpless token; all food, or 5 food and 1 morale', () => {
    const seat = active(base)
    const ctx: WindowCtx = { params: { addedSurvivors: [SV('daniel-smith')], addedHelpless: 1 } }
    expect(fires('xr.hunger', 'action.playCard', { params: { addedSurvivors: [SV('janet-taylor')], addedHelpless: 1 } }, STAND)).toBe(false)
    const a = run('xr.hunger', 'action.playCard', ctx, food(6), 'let-him-eat')
    expect(a.triggered).toBe(true)
    expect(a.after.food).toBe(0)
    const b = run('xr.hunger', 'action.playCard', ctx, pipe(food(2), (s) => ({ ...s, morale: 5 })), 'share-the-strange-meat')
    expect(b.after.food).toBe(7)
    expect(b.after.morale).toBe(4)
    void seat
  })

  it('James Meyers: look at every hand and remove three Medicine for morale; or read a secret objective', () => {
    const seat = active(base)
    const prep = pipe(give(SV('james-meyers'), seat, 'colony'), hand('it.medicine', seat, 2), hand('it.medicine', other(base), 1), (s) => ({ ...s, morale: 5 }))
    const a = run('xr.james-meyers', 'action.search', {}, prep, 'audit-the-medicine')
    expect(a.after.morale).toBe(6)
    expect(types(a.events)).toContain('EffectApplied')
    const b = run('xr.james-meyers', 'action.search', {}, prep, 'read-a-secret')
    const peek = b.events.find((e) => e.type === 'EffectApplied' && (e as { name: string }).name === 'readObjective') as { ownerSeat?: string } | undefined
    expect(peek?.ownerSeat).toBe(seat)
  })

  it('Janet Taylor: opens a clinic every seat can use while she is at the colony', () => {
    const seat = active(base)
    const victim = base.seats[seat]!.survivors[0]!
    const prep = pipe(give(SV('janet-taylor'), other(base), 'colony'), give(SV('janet-taylor'), seat, 'colony'), patchSv(victim, { wounds: 1, location: 'colony' }))
    const a = run('xr.janet-taylor', 'action.search', {}, prep, 'open-the-clinic')
    expect(a.after.effects.some((e) => e.data?.['forEvery'] === true)).toBe(true)
    const use = legalActions(withDice(seat, [2])(a.after)).find((x) => x.type === 'useAbility' && x.abilityId === 'clinic')
    expect(use).toBeTruthy()
    let st = step(withDice(seat, [2])(a.after), use!)
    for (let i = 0; i < 6 && st.state.pending.kind !== 'turnAction' && st.state.phase !== 'ended'; i++) st = step(st.state, legalActions(st.state)[0]!)
    expect(woundsOf(st.state, victim)).toBe(0)
  })

  it('John Price: opens the door (he joins, 2 zombies at the School) or raids (2 food, he is gone)', () => {
    const prep = pipe(inDeck(SV('john-price')), clearColony, colonyRoom)
    expect(fires('xr.john-price', 'action.search', { location: 'loc.library' }, prep)).toBe(false)
    const a = run('xr.john-price', 'action.search', { location: 'loc.school' }, pipe(prep, setZombies('loc.school', 0, 0)), 'open-the-door')
    expect(a.after.survivors[SV('john-price')]!.owner).toBe(active(base))
    expect(zombiesAt(a.after, 'loc.school')).toBeGreaterThanOrEqual(zombiesAt(a.before, 'loc.school'))
    const b = run('xr.john-price', 'action.search', { location: 'loc.school' }, pipe(prep, food(1)), 'raid-the-cafeteria')
    expect(b.after.food).toBe(3)
    expect(b.after.survivors[SV('john-price')]!.status).toBe('removed')
    expect(b.after.survivorDeck).not.toContain(SV('john-price'))
  })

  it('Lighthouse: one die spent removes a zombie from every location', () => {
    const seat = active(base)
    const prep = pipe(withDice(seat, [3]), setZombies('colony', 0, 2), setZombies('loc.school', 0, 1), setZombies('loc.hospital', 0, 3))
    const a = run('xr.lighthouse', 'action.search', {}, prep, 'light-the-lamp')
    expect(unusedDice(a.after, seat)).toBe(0)
    expect(zombiesAt(a.after, 'colony')).toBe(zombiesAt(a.before, 'colony') - 1)
    expect(zombiesAt(a.after, 'loc.school')).toBe(0)
    expect(zombiesAt(a.after, 'loc.hospital')).toBe(2)
    expect(offered('xr.lighthouse', 'action.search', {}, withDice(seat, []))).toEqual([])
  })

  it('Loretta Clay: the cook rolls three ways; or 1 food is lost', () => {
    const seat = active(base)
    const prep = give(SV('loretta-clay'), seat, 'colony')
    const a = run('xr.loretta-clay', 'action.search', {}, prep, 'cook-it-anyway')
    expect(types(a.events)).toContain('DiceRolled')
    expect(run('xr.loretta-clay', 'action.search', {}, pipe(prep, food(5)), 'throw-it-out').after.food).toBe(4)
  })
})

describe('M8 cards M-N', () => {
  it('Maria Lopez: 3 food for three chosen School cards; or every School Food card leaves the game', () => {
    const seat = active(base)
    const prep = pipe(give(SV('maria-lopez'), seat, 'colony'), food(5))
    const a = run('xr.maria-lopez', 'action.search', {}, prep, 'bring-them-food')
    expect(a.after.food).toBe(2)
    expect(a.after.survivors[SV('maria-lopez')]!.location).toBe('loc.school')
    expect(a.after.seats[seat]!.hand.length).toBe(a.before.seats[seat]!.hand.length + 3)
    expect(offered('xr.maria-lopez', 'action.search', {}, pipe(give(SV('maria-lopez'), seat, 'colony'), food(1)))).toEqual([])
    const b = run('xr.maria-lopez', 'action.search', {}, prep, 'open-the-pantry')
    expect(b.after.locations['loc.school']!.deck.filter((c) => b.after.cards[c]!.defId.startsWith('it.food')).length).toBe(0)
  })

  it('Mike Cho: joins wounded and clears a location; or just clears it', () => {
    const seat = active(base)
    const sv = base.seats[seat]!.survivors[0]!
    const prep = pipe(inDeck(SV('mike-cho')), patchSv(sv, { location: 'loc.school' }), setZombies('loc.school', 0, 3), clearColony, colonyRoom)
    const a = run('xr.mike-cho', 'action.search', {}, prep, 'fight-beside-him')
    expect(a.after.survivors[SV('mike-cho')]!.wounds).toBe(1)
    expect(zombiesAt(a.after, 'loc.school')).toBe(0)
    expect(woundsOf(a.after, sv)).toBe(woundsOf(a.before, sv) + 1)
    const b = run('xr.mike-cho', 'action.search', {}, prep, 'slip-away')
    expect(zombiesAt(b.after, 'loc.school')).toBe(0)
    expect(b.after.survivorDeck).toContain(SV('mike-cho'))
  })

  it('Missing Child: the vote starts a watch (every outside location searched by the end of next round) or costs morale and a token', () => {
    const prep = pipe(setLoc('colony', { helpless: 2 }), (s) => ({ ...s, morale: 6 }))
    const a = run('xr.missing-child', 'action.search', {}, prep, undefined, { yes: true })
    expect(effectNamed(a.after, 'xr.missing-child#watch')).toBeTruthy()
    const noted = CODE_HOOKS.effects['crossroads.missing-child.note']!({ state: a.after, point: 'action.search', seat: active(a.after), location: 'loc.school' }, {})
    expect((effectNamed(noted.state, 'xr.missing-child#watch')!.data!['searched'] as string[])).toContain('loc.school')
    const all = (noted.state.locationOrder.filter((l) => l !== 'colony')).reduce((st, l) => CODE_HOOKS.effects['crossroads.missing-child.note']!({ state: st, point: 'action.search', seat: active(st), location: l }, {}).state, noted.state)
    const later = { ...all, roundNumber: all.roundNumber + 1 }
    const done = CODE_HOOKS.effects['crossroads.missing-child.settle']!({ state: later, point: 'colony.roundTick', seat: active(later) }, {})
    expect(done.then?.[0]).toMatchObject({ op: 'morale', value: 1 })
    expect(effectNamed(done.state, 'xr.missing-child#watch')).toBeUndefined()
    const fail = CODE_HOOKS.effects['crossroads.missing-child.settle']!({ state: { ...noted.state, roundNumber: noted.state.roundNumber + 1 }, point: 'colony.roundTick', seat: active(noted.state) }, {})
    expect(fail.then?.[0]).toMatchObject({ op: 'morale', value: -1 })
    const b = run('xr.missing-child', 'action.search', {}, prep, undefined, { yes: false })
    expect(b.after.morale).toBe(5)
    expect(b.after.locations['colony']!.helpless).toBe(1)
  })

  it('Mugging: needs an exiled survivor beside yours; hand cards go to its controller, or a fight', () => {
    const seat = active(base)
    const thief = other(base)
    const sv = base.seats[seat]!.survivors[0]!
    const tv = base.seats[thief]!.survivors[0]!
    const prep = pipe(exile(thief), patchSv(sv, { location: 'loc.school' }), patchSv(tv, { location: 'loc.school' }))
    expect(fires('xr.mugging', 'action.search', {}, STAND)).toBe(false)
    const a = run('xr.mugging', 'action.search', {}, prep, 'hand-it-over')
    expect(a.after.seats[seat]!.hand.length).toBe(Math.min(1, a.before.seats[seat]!.hand.length))
    expect(a.after.seats[thief]!.hand.length).toBe(a.before.seats[thief]!.hand.length + Math.max(0, a.before.seats[seat]!.hand.length - 1))
    const b = run('xr.mugging', 'action.search', {}, prep, 'fight-back')
    expect(woundsOf(b.after, sv)).toBe(woundsOf(b.before, sv) + 2)
  })

  it('Music: morale or an extra die for everyone next round', () => {
    const seat = active(base)
    expect(run('xr.music', 'action.search', {}, STAND, 'play-for-the-evening').after.morale).toBe(Math.min(10, base.morale + 1))
    const b = run('xr.music', 'action.search', {}, STAND, 'play-at-dawn')
    expect(b.after.effects.some((e) => e.grants?.includes('extraDie') && e.data?.['amount'] === 1)).toBe(true)
    expect(fires('xr.music', 'action.search', {}, exile(seat))).toBe(false)
  })

  it('No Ammo: the weapon whose ability was used goes to the waste pile; or every unused die is spent', () => {
    const seat = active(base)
    const prep = pipe(hand('it.colt-1911-pistol', seat))
    const card = prep(base).seats[seat]!.hand.find((c) => prep(base).cards[c]!.defId === 'it.colt-1911-pistol')!
    const ctx: WindowCtx = { cardId: card, params: { fromAbility: true } }
    expect(fires('xr.no-ammo', 'action.attack', { cardId: card }, prep)).toBe(false)
    const a = run('xr.no-ammo', 'action.attack', ctx, prep, 'bin-the-weapon')
    expect(a.after.waste).toContain(card)
    const b = run('xr.no-ammo', 'action.attack', ctx, pipe(prep, withDice(seat, [2, 3, 4])), 'hunt-for-ammunition')
    expect(unusedDice(b.after, seat)).toBe(0)
  })
})

describe('M8 cards O-S', () => {
  it('Olivia Brown: the vote places her at the colony; the experiments attach an ability and a blank shields bites', () => {
    const seat = active(base)
    const prep = give(SV('olivia-brown'), other(base), 'loc.school')
    const a = run('xr.olivia-brown', 'action.search', {}, prep, undefined, { yes: true })
    expect(a.after.survivors[SV('olivia-brown')]!.location).toBe('colony')
    expect(a.after.effects.some((e) => (e.data?.['ability'] as { id?: string } | undefined)?.id === 'experiment')).toBe(true)
    const b = run('xr.olivia-brown', 'action.search', {}, prep, undefined, { yes: false })
    expect(b.after.survivors[SV('olivia-brown')]!.location).toBe('colony')
    expect(b.after.effects.some((e) => (e.data?.['ability'] as { id?: string } | undefined)?.id === 'experiment')).toBe(false)
    // the shield turns a bite into a blank when a Medicine card can be discarded
    const shielded = CODE_HOOKS.effects['crossroads.olivia-brown.shield']!({ state: hand('it.medicine', seat)(base), point: 'dice.rolled', seat }, {}).state
    const sv = base.seats[seat]!.survivors[0]!
    const r = biteShield(shielded, sv)
    expect(r?.state.waste.length).toBe(shielded.waste.length + 1)
  })

  it('Prophet: an exiled player takes a non-exiled survivor into its following; or morale falls', () => {
    const seat = active(base)
    const victimSeat = other(base)
    const mine = base.seats[seat]!.survivors[0]!
    const v = base.seats[victimSeat]!.survivors[0]!
    const prep = pipe(exile(seat), patchSv(mine, { location: 'loc.school' }), patchSv(v, { location: 'loc.school' }))
    expect(fires('xr.prophet', 'action.search', {}, STAND)).toBe(false)
    const a = run('xr.prophet', 'action.search', {}, prep, 'win-them-over')
    const gained = a.after.seats[seat]!.survivors.length - a.before.seats[seat]!.survivors.length
    expect(gained).toBe(base.seats[victimSeat]!.survivors.length > 1 ? 1 : 0)
    expect(run('xr.prophet', 'action.search', {}, prep, 'leave-a-warning').after.morale).toBe(a.before.morale - 1)
  })

  it('Radio Signal: three dice for a helpless survivor and 1 morale; no thumbs lose 1 morale', () => {
    const seat = active(base)
    const prep = pipe(clearColony, withDice(seat, [2, 3, 4, 5]), (s) => ({ ...s, morale: 5 }))
    const a = run('xr.radio-signal', 'action.search', {}, prep, undefined, { yes: true, pick: (pd) => pd.options!.length - 1 })
    expect(a.after.morale).toBe(6)
    expect(a.after.locations['colony']!.helpless).toBe(1)
    const none = run('xr.radio-signal', 'action.search', {}, prep, undefined, { yes: true, pick: () => 0 })
    expect(none.after.morale).toBe(4)
    const b = run('xr.radio-signal', 'action.search', {}, prep, undefined, { yes: false })
    expect(b.after.morale).toBe(4)
  })

  it('Riot: all food, a wound on each colony survivor, or one helpless dies', () => {
    const seat = active(base)
    const crowd = pipe(clearColony, setLoc('colony', { helpless: 5 }), (s) => ({ ...s, survivors: Object.fromEntries(Object.entries(s.survivors).map(([k, v]) => [k, v.location === 'colony' ? { ...v, location: 'loc.school' } : v])) }), give(SV('forest-plum'), seat, 'colony'))
    expect(fires('xr.riot', 'action.search', {}, STAND)).toBe(false)
    expect(run('xr.riot', 'action.search', {}, pipe(crowd, food(6)), 'empty-the-pantry').after.food).toBe(0)
    const w = run('xr.riot', 'action.search', {}, crowd, 'let-it-turn-ugly')
    expect(w.after.survivors[SV('forest-plum')]!.wounds).toBe(1)
    const k = run('xr.riot', 'action.search', {}, pipe(crowd, (s) => ({ ...s, morale: 6 })), 'make-an-example')
    expect(k.after.locations['colony']!.helpless).toBe(4)
    expect(k.after.morale).toBe(5)
  })

  it('Rod Miller: carried to the Hospital with two of your survivors (exposure twice each); or he dies', () => {
    const seat = active(base)
    const prep = pipe(give(SV('rod-miller'), other(base), 'colony'), clearColony)
    const a = run('xr.rod-miller', 'action.search', {}, prep, 'carry-him-to-the-hospital')
    expect(a.after.survivors[SV('rod-miller')]!.location === 'loc.hospital' || !alive(a.after, SV('rod-miller'))).toBe(true)
    expect(types(a.events).filter((t) => t === 'ExposureRolled' || t === 'ExposureSkipped').length).toBeGreaterThanOrEqual(1)
    const b = run('xr.rod-miller', 'action.search', {}, prep, 'let-him-go')
    expect(alive(b.after, SV('rod-miller'))).toBe(false)
    void seat
  })

  it('Sacrament: two exposure rolls; morale +1 if the survivor lives', () => {
    const seat = active(base)
    const sv = base.seats[seat]!.survivors[0]!
    const a = run('xr.sacrament', 'action.move', { survivorId: sv, location: 'loc.school' }, (s) => ({ ...s, morale: 5 }), 'enter-the-cathedral')
    expect(types(a.events).filter((t) => t === 'ExposureRolled' || t === 'ExposureSkipped').length).toBeGreaterThanOrEqual(1)
    if (alive(a.after, sv)) expect(a.after.morale).toBe(6)
    expect(fires('xr.sacrament', 'action.move', { survivorId: sv }, exile(seat))).toBe(false)
  })

  it('Sewer Passage: the dig exposes the picked survivor; success opens the colony-hospital route', () => {
    const seat = active(base)
    const sv = base.seats[seat]!.survivors[0]!
    const prep = pipe(patchSv(sv, { location: 'loc.library' }))
    expect(fires('xr.sewer-passage', 'action.search', {}, STAND)).toBe(false)
    const a = run('xr.sewer-passage', 'action.search', {}, prep, 'clear-the-tunnel', { pick: (pd) => Math.max(0, pd.options!.findIndex((o) => o.id === sv)) })
    expect(types(a.events)).toContain('DiceRolled')
    if (alive(a.after, sv)) expect(a.after.effects.some((e) => e.data?.['sewer'] === true)).toBe(true)
    expect(sewerRoute({ ...base, effects: [{ id: 'e:1', sourceId: 'x', sourceKind: 'crossroads', name: 'n', data: { sewer: true }, duration: 'game', expires: null }] }, 'colony', 'loc.hospital')).toBe(true)
    expect(sewerRoute(base, 'colony', 'loc.hospital')).toBe(false)
  })

  it('Sleep: a long turn; the rest rule lets a seat spend all dice to heal each of its survivors for the round', () => {
    const seat = active(base)
    const long: Prep = (s) => ({ ...s, turn: { ...s.turn!, actions: 4 } })
    expect(fires('xr.sleep', 'action.search', {}, STAND)).toBe(false)
    const a = run('xr.sleep', 'action.search', {}, long, 'turn-in-early')
    const eff = a.after.effects.find((e) => e.name === 'xr.sleep#rest')
    expect(eff?.duration).toBe('round')
    expect(Array.isArray(eff?.data?.['global'])).toBe(true)
    void seat
  })

  it('Sophie Robinson: pulled free with 2 wounds; or the wreck is stripped and she is gone', () => {
    const seat = active(base)
    const prep = pipe(inDeck(SV('sophie-robinson')), clearColony, colonyRoom)
    const a = run('xr.sophie-robinson', 'action.move', {}, prep, 'pull-her-free')
    expect(a.after.survivors[SV('sophie-robinson')]!.wounds).toBe(2)
    expect(a.after.survivors[SV('sophie-robinson')]!.owner).toBe(seat)
    const b = run('xr.sophie-robinson', 'action.move', {}, prep, 'strip-the-wreck')
    expect(b.after.seats[seat]!.hand.length).toBe(b.before.seats[seat]!.hand.length + 2)
    expect(b.after.survivors[SV('sophie-robinson')]!.status).toBe('removed')
  })

  it('Sparky: eight zombies at the colony or +1 morale', () => {
    const seat = active(base)
    const prep = pipe(give(SV('sparky'), seat, 'colony'), clearColony, setZombies('colony', 0, 3), setZombies('colony', 1, 5), (s) => ({ ...s, morale: 5 }))
    const a = run('xr.sparky', 'action.search', {}, prep, 'pull-the-string')
    expect(zombiesAt(a.after, 'colony')).toBe(0)
    expect(run('xr.sparky', 'action.search', {}, prep, 'show-him-off').after.morale).toBe(6)
  })

  it('Spoiled: a wound on a chosen survivor, or the food is wasted and the die does not rise', () => {
    const seat = active(base)
    const prep = pipe(withDice(seat, [4, 2]))
    const ctx: WindowCtx = { dieId: `${seat}:d1`, params: { tokens: 2 } }
    const a = run('xr.spoiled', 'action.spendFood', ctx, prep, 'eat-it-anyway')
    const total = (s: GameState) => base.seats[seat]!.survivors.reduce((n, id) => n + woundsOf(s, id), 0)
    expect(total(a.after)).toBe(total(a.before) + 1)
    const b = run('xr.spoiled', 'action.spendFood', ctx, prep, 'throw-it-away')
    expect(b.after.seats[seat]!.dice[0]!.value).toBe(2)
  })

  it('Supply Drop: three exposure rolls on a pick; success brings 5 food (+1 morale with Annaleigh in play)', () => {
    const seat = active(base)
    const prep = pipe(give(SV('annaleigh-chan'), other(base), 'colony'), food(0), (s) => ({ ...s, morale: 5 }))
    const a = run('xr.supply-drop', 'action.search', {}, prep, 'chase-the-parachute')
    const picked = a.pendings.length ? a.pendings[0]!.options![0]!.id : base.seats[seat]!.survivors[0]!
    if (alive(a.after, picked)) { expect(a.after.food).toBe(5); expect(a.after.morale).toBe(6) }
    expect(run('xr.supply-drop', 'action.search', {}, prep, 'let-it-drift').after.food).toBe(0)
  })
})

describe('M8 cards T-W', () => {
  it('Talia Jones: four chosen cards from a chosen deck; or the next crisis is removed and its step skipped', () => {
    const seat = active(base)
    const prep = give(SV('talia-jones'), seat, 'colony')
    const a = run('xr.talia-jones', 'action.search', {}, prep, 'find-the-cache')
    expect(a.after.seats[seat]!.hand.length).toBe(a.before.seats[seat]!.hand.length + 4)
    const b = run('xr.talia-jones', 'action.search', {}, prep, 'foresee-the-crisis')
    const e = effectNamed(b.after, 'xr.talia-jones#foresee')!
    expect(e).toBeTruthy()
    const revealed = { ...b.after, crisis: { ...b.after.crisis, cardId: b.after.crisisDeck[0]! } }
    const r = CODE_HOOKS.effects['crossroads.talia-jones.foresee']!({ state: revealed, point: 'crisis.revealed', seat }, {})
    expect(r.state.crisis.cardId).toBeNull()
    expect(r.state.crisis.history.length).toBe(revealed.crisis.history.length + 1)
    expect(effectNamed(r.state, 'xr.talia-jones#foresee')).toBeUndefined()
    expect(r.state.effects.some((x) => x.forbid?.includes('contribute'))).toBe(true)
  })

  it('The Arctic King: a snowmobile (no exposure, noise at both ends, four wounds and it is gone); or two Fuel cards', () => {
    const seat = active(base)
    const sv = base.seats[seat]!.survivors[0]!
    const ctx: WindowCtx = { survivorId: sv, location: 'loc.gas-station' }
    expect(fires('xr.the-arctic-king', 'action.search', { location: 'loc.school' }, STAND)).toBe(false)
    const a = run('xr.the-arctic-king', 'action.search', ctx, STAND, 'take-the-snowmobile')
    const e = a.after.effects.find((x) => x.data?.['snowmobile'] !== undefined)!
    expect(e.survivorIds).toEqual([sv])
    const acc = { state: patchSv(sv, { location: 'loc.school' })(a.after), events: [] as GameEvent[] }
    snowmobileTrail(acc, sv, 'loc.school', 'loc.library')
    expect(acc.state.locations['loc.school']!.noise).toBeGreaterThanOrEqual(a.after.locations['loc.school']!.noise)
    expect(acc.state.effects.find((x) => x.data?.['snowmobile'] !== undefined)!.data!['snowmobile']).toEqual({ wounds: 1 })
    for (let i = 0; i < 3; i++) snowmobileTrail(acc, sv, 'loc.school', 'loc.library')
    expect(acc.state.effects.some((x) => x.data?.['snowmobile'] !== undefined)).toBe(false)
    const b = run('xr.the-arctic-king', 'action.search', ctx, STAND, 'siphon-the-tank')
    expect(handOf(b.after, seat).filter((d) => d === 'it.fuel').length).toBeGreaterThanOrEqual(handOf(b.before, seat).filter((d) => d === 'it.fuel').length)
  })

  it('The Deputy: the weapons of the top 8 Police cards and a new victory condition; or nothing', () => {
    const seat = active(base)
    const sv = base.seats[seat]!.survivors[0]!
    const prep = patchSv(sv, { location: 'loc.school' })
    const a = run('xr.the-deputy', 'action.search', {}, prep, 'take-the-deal')
    expect(a.after.effects.some((e) => Array.isArray((e.data?.['condition'] as { all?: unknown[] } | undefined)?.all))).toBe(true)
    expect(a.after.seats[seat]!.hand.length).toBeGreaterThanOrEqual(a.before.seats[seat]!.hand.length)
    expect(a.after.locations['loc.police-station']!.deck.length + a.after.seats[seat]!.hand.length - a.before.seats[seat]!.hand.length).toBe(a.before.locations['loc.police-station']!.deck.length)
    expect(extraVictory(a.after).length).toBe(1)
    expect(run('xr.the-deputy', 'action.search', {}, prep, 'keep-your-guns').after.morale).toBe(a.before.morale)
  })

  it('The Sunshine State: two helpless leave and morale falls by 1; or nothing', () => {
    const prep = pipe(setLoc('colony', { helpless: 2 }), (s) => ({ ...s, morale: 5 }))
    expect(fires('xr.the-sunshine-state', 'action.search', {}, setLoc('colony', { helpless: 1 }))).toBe(false)
    const a = run('xr.the-sunshine-state', 'action.search', {}, prep, 'open-the-gates')
    expect(a.after.locations['colony']!.helpless).toBe(0)
    expect(a.after.morale).toBe(4)
  })

  it('Thin Ice: a die decides between frostbite and a chosen card; or nothing', () => {
    const seat = active(base)
    const sv = base.seats[seat]!.survivors[0]!
    const a = run('xr.thin-ice', 'action.move', { survivorId: sv, location: 'loc.school' }, STAND, 'cross-the-ice')
    const gotCard = a.after.seats[seat]!.hand.length === a.before.seats[seat]!.hand.length + 1
    const froze = a.after.survivors[sv]!.frostbite === a.before.survivors[sv]!.frostbite + 1
    expect(gotCard || froze || !alive(a.after, sv)).toBe(true)
  })

  it('Thomas Heart: his controller picks; four wounds among his neighbours, two Medicine out of the game, or he dies', () => {
    const owner = other(base)
    const sv = base.seats[active(base)]!.survivors.find((id) => id !== SV('thomas-heart'))!
    const prep = pipe(give(SV('thomas-heart'), owner, 'loc.school'), patchSv(sv, { location: 'loc.school' }), hand('it.colt-1911-pistol', active(base)), hand('it.medicine', owner, 2))
    const card = prep(base).seats[active(base)]!.hand.find((c) => prep(base).cards[c]!.defId === 'it.colt-1911-pistol')!
    const ctx: WindowCtx = { cardId: card, params: { fromAbility: true } }
    const before = held('xr.thomas-heart')(prep(base))
    const r = afterAction(before, 'action.attack', { seat: active(before), ...ctx })
    expect(r.pending).toMatchObject({ kind: 'crossroadsOption', seat: owner })
    expect(r.pending!.options!.map((o) => o.id)).toEqual(['lash-out', 'send-for-medics', 'end-it'])
    const lash = run('xr.thomas-heart', 'action.attack', ctx, prep, 'lash-out')
    expect(!alive(lash.after, sv) || woundsOf(lash.after, sv) >= 1).toBe(true) // four wounds on the one neighbour kill it
    const med = run('xr.thomas-heart', 'action.attack', ctx, prep, 'send-for-medics')
    expect(med.after.removed.length).toBe(med.before.removed.length + 2)
    const kill = run('xr.thomas-heart', 'action.attack', ctx, prep, 'end-it')
    expect(alive(kill.after, SV('thomas-heart'))).toBe(false)
  })

  it('Toxic Waste: frostbite on a colony pick for each seat; or removed Fuel and Medicine return to the waste pile', () => {
    const prep = pipe(clearColony, removedCards('it.fuel', 2), removedCards('it.medicine', 2))
    const up = run('xr.toxic-waste', 'action.search', {}, prep, undefined, { yes: true })
    const frozen = Object.values(up.after.survivors).filter((v) => v.frostbite > 0).length
    expect(frozen).toBeGreaterThanOrEqual(1)
    const down = run('xr.toxic-waste', 'action.search', {}, prep, undefined, { yes: false })
    expect(down.after.waste.length).toBe(down.before.waste.length + 4)
  })

  it('Voyeur: look at the other hand, then take a card (locked until next round) or show it to everyone', () => {
    const seat = active(base)
    const o = other(base)
    const sv = base.seats[seat]!.survivors[0]!
    const ov = base.seats[o]!.survivors[0]!
    const alone = pipe(patchSv(sv, { location: 'loc.school' }), patchSv(ov, { location: 'loc.school' }))
    const prep = (s: GameState): GameState => {
      const t = alone(s)
      return { ...t, survivors: Object.fromEntries(Object.entries(t.survivors).map(([k, v]) => [k, k !== sv && k !== ov && v.location === 'loc.school' ? { ...v, location: 'loc.library' } : v])) }
    }
    const a = run('xr.voyeur', 'action.search', {}, prep, 'blackmail-them')
    expect(a.after.seats[seat]!.hand.length).toBe(a.before.seats[seat]!.hand.length + 1)
    const taken = a.after.seats[seat]!.hand.find((c) => !a.before.seats[seat]!.hand.includes(c))!
    expect(a.after.cardUses[taken]?.['$lockUntil']).toBe(a.after.roundNumber + 1)
    expect(cardLocked(a.after, taken)).toBe(true)
    const b = run('xr.voyeur', 'action.search', {}, prep, 'tell-everyone')
    expect(b.events.some((e) => e.type === 'EffectApplied' && (e as { name: string }).name === 'handShown')).toBe(true)
  })

  it('Wavering Loyalties: give a survivor to a smaller group; or a die decides morale', () => {
    const seat = active(base)
    const prep = pipe(give(SV('forest-plum'), seat, 'colony'), give(SV('sparky'), seat, 'colony'), give(SV('harman-brooks'), seat, 'colony'))
    const a = run('xr.wavering-loyalties', 'action.search', {}, prep, 'let-them-go')
    expect(a.after.seats[seat]!.survivors.length).toBe(a.before.seats[seat]!.survivors.length - 1)
    expect(a.after.seatOrder.reduce((n, q) => n + a.after.seats[q]!.survivors.length, 0)).toBe(a.before.seatOrder.reduce((n, q) => n + a.before.seats[q]!.survivors.length, 0))
    const b = run('xr.wavering-loyalties', 'action.search', {}, pipe(prep, (s) => ({ ...s, morale: 5 })), 'threaten-them')
    expect([4, 5]).toContain(b.after.morale)
  })

  it('Welcome Home: one exposure roll, a lasting once-a-round attack skip if the survivor lives; or nothing', () => {
    const seat = active(base)
    const sv = base.seats[seat]!.survivors[0]!
    const a = run('xr.welcome-home', 'action.move', { survivorId: sv, location: 'loc.school' }, STAND, 'take-the-gun')
    if (alive(a.after, sv)) expect(a.after.effects.some((e) => (e.data?.['attackSkip'] as { oncePerRound?: boolean } | undefined)?.oncePerRound && e.survivorIds?.includes(sv))).toBe(true)
    const withRule = { ...a.after, effects: [{ id: 'e:x', sourceId: 'xr.welcome-home', sourceKind: 'crossroads' as const, name: 'steadyAim', survivorIds: [sv], data: { attackSkip: { oncePerRound: true } }, duration: 'game' as const, expires: null }] }
    const first = attackExposureSkip(withRule, sv, 'colony', 1)
    expect(first).toBeTruthy()
    expect(attackExposureSkip(first!.state, sv, 'colony', 1)).toBeNull()
    expect(attackExposureSkip({ ...first!.state, roundNumber: first!.state.roundNumber + 1 }, sv, 'colony', 1)).toBeTruthy()
  })

  it('Wounded Survivor: the top survivor joins the colony and rolls exposure twice; or nothing', () => {
    const seat = active(base)
    const sv = base.seats[seat]!.survivors[0]!
    const prep = pipe(clearColony, colonyRoom)
    const a = run('xr.wounded-survivor', 'action.search', { survivorId: sv, location: 'loc.school' }, prep, 'take-them-in')
    expect(a.after.seats[seat]!.survivors.length).toBe(a.before.seats[seat]!.survivors.length + 1)
    expect(types(a.events).filter((t) => t === 'ExposureRolled' || t === 'ExposureSkipped').length).toBeGreaterThanOrEqual(1)
  })
})

describe('M8 persistent rules', () => {
  it('Horse upkeep, Ashley\'s waste pit and Music/Dynamite dice read their lasting effects', async () => {
    const seat = active(base)
    const sv = base.seats[seat]!.survivors[0]!
    const mk = (over: object) => ({ id: 'e:t', sourceId: 'xr.t', sourceKind: 'crossroads' as const, name: 'xr.t#x', duration: 'game' as const, expires: null, ...over })
    expect(extraFoodUpkeep({ ...base, effects: [mk({ survivorIds: [sv], data: { upkeep: 1 } })] })).toBe(1)
    expect(extraFoodUpkeep({ ...exile(seat)(base), effects: [mk({ survivorIds: [sv], data: { upkeep: 1 } })] })).toBe(0)
    expect(extraFoodUpkeep({ ...base, effects: [mk({ survivorIds: [sv], data: { upkeep: 1 } })], survivors: { ...base.survivors, [sv]: { ...base.survivors[sv]!, status: 'dead' as const } } })).toBe(0)
    expect(wasteStep(base)).toBe(10)
    expect(wasteStep({ ...base, effects: [mk({ data: { wasteStep: 15 } })] })).toBe(15)
    expect(extraDiceFor({ ...base, effects: [mk({ grants: ['extraDie'], data: { amount: 1 } }), mk({ grants: ['extraDie'], data: { amount: -1 } })] }, seat)).toBe(0)
  })
})
