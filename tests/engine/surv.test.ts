import { describe, expect, it } from 'vitest'
import { patchLocation, patchSeat, patchSurvivor } from '../../src/engine/decks'
import { mkAcc, runEffectNodes, setRoutines, type RunCtx } from '../../src/engine/effects'
import { snowmobileTrail } from '../../src/engine/crossroads-hooks'
import { addZombies as realAddZombies } from '../../src/engine/zombies'
import type { GameEvent } from '../../src/engine/events'
import {
  addHelpless, addSurvivor, applyChooseLeader, applyExiledPlacement, changeMorale, hasFreeSpace, isExiledPlacement, killHelpless, killSurvivor,
  removeSurvivor, validateChooseLeader,
} from '../../src/engine/survivors'
import type { GameState } from '../../src/engine/types'
import { playSetup, setupOf } from './setup-fixture'

const base = (seed = 'surv', variants = {}) => playSetup(setupOf(4, variants), seed).result.state
const ofType = <T extends GameEvent['type']>(events: GameEvent[], type: T) => events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type)
/** Gives `seat` n extra survivors from the deck top, at the colony. */
const grow = (s: GameState, seat: string, n: number): GameState => {
  let cur = s
  for (let i = 0; i < n; i++) cur = addSurvivor(cur, seat, cur.survivorDeck[0]!, 'colony', 'item').state
  return { ...cur, survivorDeck: cur.survivorDeck.slice(n) }
}
const leaderOf = (s: GameState, seat = 's1') => s.seats[seat]!.leaderId!
const followerOf = (s: GameState, seat = 's1') => s.seats[seat]!.survivors.find((x) => x !== leaderOf(s, seat))!

describe('survivors', () => {
  it('SURV-001 a killed survivor is dead, ownerless, off its seat list, and costs 1 morale', () => {
    const s = base()
    const id = followerOf(s)
    const r = killSurvivor(s, id, 'wounds')
    expect(ofType(r.events, 'SurvivorKilled')[0]).toMatchObject({ survivorId: id, cause: 'wounds', wasLeader: false, moraleLoss: true, location: 'colony' })
    expect(ofType(r.events, 'MoraleChanged')[0]).toMatchObject({ delta: -1, reason: 'survivorKilled' })
    expect(r.state.survivors[id]).toMatchObject({ status: 'dead', owner: null })
    expect(r.state.seats['s1']!.survivors).not.toContain(id)
    expect(r.state.morale).toBe(s.morale - 1)
    expect(r.decision).toBeNull()
  })

  it('SURV-002 a leader killed with 2 followers left raises newLeader; a follower is accepted, a dead or foreign survivor is E_NOT_LEADER_CANDIDATE', () => {
    const s = grow(base(), 's1', 1)
    const lead = leaderOf(s)
    const r = killSurvivor(s, lead, 'overrun')
    expect(r.decision).toMatchObject({ kind: 'newLeader', seat: 's1' })
    expect(r.pending).toBe(r.decision)
    expect(r.decision!.options).toHaveLength(2)
    expect(r.state.pending).toBe(r.decision)
    expect(validateChooseLeader(r.state, 's1', lead)?.code).toBe('E_NOT_LEADER_CANDIDATE')
    expect(validateChooseLeader(r.state, 's1', r.state.seats['s2']!.survivors[0]!)?.code).toBe('E_NOT_LEADER_CANDIDATE')
    const pick = r.state.seats['s1']!.survivors[0]!
    expect(validateChooseLeader(r.state, 's1', pick)).toBeNull()
    const done = applyChooseLeader(r.state, 's1', pick, 'replacement')
    expect(ofType(done.events, 'LeaderChosen')[0]).toMatchObject({ reason: 'replacement', survivorId: pick })
    expect(done.state.seats['s1']!.leaderId).toBe(pick)
  })

  it('SURV-003 a leader killed with exactly 1 follower auto-resolves the new leader', () => {
    const s = base()
    const follower = followerOf(s)
    const r = killSurvivor(s, leaderOf(s), 'bite')
    expect(r.decision).toBeNull()
    expect(ofType(r.events, 'DecisionAutoResolved')[0]).toMatchObject({ kind: 'newLeader', seat: 's1' })
    expect(ofType(r.events, 'LeaderChosen')[0]).toMatchObject({ survivorId: follower, reason: 'replacement' })
    expect(r.state.seats['s1']!.leaderId).toBe(follower)
  })

  it('SURV-004 the last survivor lost discards the hand unrevealed and draws the top survivor as the new leader at the colony', () => {
    let s = base()
    const [a, b] = s.seats['s1']!.survivors
    s = killSurvivor(s, b!, 'wounds').state
    const hand = [...s.seats['s1']!.hand]
    const top = s.survivorDeck[0]!
    const r = killSurvivor(s, a!, 'wounds')
    expect(ofType(r.events, 'HandDiscarded')[0]).toMatchObject({ seat: 's1', count: hand.length, reason: 'lastSurvivor' })
    expect(ofType(r.events, 'CardDiscarded')).toHaveLength(hand.length)
    expect(ofType(r.events, 'SurvivorAdded')[0]).toMatchObject({ survivorId: top, source: 'lastSurvivor', location: 'colony' })
    expect(ofType(r.events, 'LeaderChosen')[0]).toMatchObject({ survivorId: top, reason: 'newSurvivor' })
    expect(r.state.seats['s1']!.hand).toEqual([])
    expect(r.state.removedHidden).toEqual(expect.arrayContaining(hand))
    expect(r.state.seats['s1']!.leaderId).toBe(top)
    expect(r.state.survivorDeck).not.toContain(top)
  })

  it('SURV-005 with playerElimination the seat is out instead of drawing a new survivor', () => {
    let s = base('surv-5', { playerElimination: true })
    const [a, b] = s.seats['s1']!.survivors
    s = killSurvivor(s, b!, 'wounds').state
    const r = killSurvivor(s, a!, 'wounds')
    expect(ofType(r.events, 'SeatEliminated')).toHaveLength(1)
    expect(ofType(r.events, 'SurvivorAdded')).toHaveLength(0)
    expect(r.state.seats['s1']!.seat.eliminated).toBe(true)
    expect(r.state.seats['s1']!.survivors).toEqual([])
  })

  it('SURV-006 a survivor added on a seat\'s turn is alive at the colony at once and keeps its owner', () => {
    const s = base('surv-6')
    const id = s.survivorDeck[0]!
    const r = addSurvivor(s, 's1', id, 'colony', 'item')
    expect(r.state.survivors[id]).toMatchObject({ owner: 's1', status: 'alive', location: 'colony', wounds: 0, movedThisTurn: false })
    expect(r.state.seats['s1']!.survivors).toContain(id)
    expect(ofType(r.events, 'SurvivorAdded')[0]).toMatchObject({ source: 'item' })
  })

  it('SURV-007 a card that removes a survivor emits SurvivorRemoved and no morale loss', () => {
    const s = base('surv-7')
    const id = followerOf(s)
    const r = removeSurvivor(s, id, 'sv.forest-plum')
    expect(ofType(r.events, 'SurvivorRemoved')[0]).toMatchObject({ survivorId: id, sourceId: 'sv.forest-plum' })
    expect(ofType(r.events, 'MoraleChanged')).toHaveLength(0)
    expect(r.state.survivors[id]!.status).toBe('removed')
    expect(r.state.morale).toBe(s.morale)
    expect(removeSurvivor(s, id, 'x', { moraleLoss: true }).state.morale).toBe(s.morale - 1)
  })

  it('SURV-009 helpless tokens: HelplessAdded reports the new total, killing one costs 1 morale each', () => {
    const s = base('surv-9')
    const a = addHelpless(s, 3, 'cr.test')
    expect(ofType(a.events, 'HelplessAdded')[0]).toMatchObject({ count: 3, after: 3 })
    const b = addHelpless(a.state, 2, 'cr.test')
    expect(b.state.locations['colony']!.helpless).toBe(5)
    const k = killHelpless(b.state, 2, 'overrun')
    expect(k.killed).toBe(2)
    expect(k.state.locations['colony']!.helpless).toBe(3)
    expect(k.state.morale).toBe(s.morale - 2)
    expect(ofType(k.events, 'HelplessKilled')[0]).toMatchObject({ count: 2, after: 3, moraleLoss: true })
  })

  it('SURV-010 a helpless token cannot be added when the colony survivor spaces are full', () => {
    let s = base('surv-10')
    const used = Object.values(s.survivors).filter((v) => v.location === 'colony').length
    s = patchLocation(s, 'colony', { capacity: { ...s.locations['colony']!.capacity, survivors: used + 1 } })
    expect(hasFreeSpace(s, 'colony')).toBe(true)
    const r = addHelpless(s, 3, 'x')
    expect(r.added).toBe(1)
    expect(hasFreeSpace(r.state, 'colony')).toBe(false)
    expect(addHelpless(r.state, 1, 'x')).toMatchObject({ added: 0, events: [] })
  })

  it('SURV-011 an exiled seat adds no helpless tokens', () => {
    const s = base('surv-11')
    expect(addHelpless(s, 2, 'x', { byExiledSeat: true })).toMatchObject({ added: 0, events: [] })
  })

  it('SURV-012 the last survivor lost with an empty survivor deck eliminates the seat even without the variant', () => {
    let s = { ...base('surv-12'), survivorDeck: [] as string[] }
    const [a, b] = s.seats['s1']!.survivors
    s = killSurvivor(s, b!, 'wounds').state
    const r = killSurvivor(s, a!, 'wounds')
    expect(ofType(r.events, 'HandDiscarded')).toHaveLength(1)
    expect(ofType(r.events, 'SeatEliminated')).toHaveLength(1)
    expect(ofType(r.events, 'SurvivorAdded')).toHaveLength(0)
  })

  it('SURV-013 an exiled owner\'s death costs no morale; the last one raises a placement choice at a non-colony location', () => {
    let s = base('surv-13')
    s = patchSeat(s, 's1', { seat: { ...s.seats['s1']!.seat, exiled: true } })
    const [a, b] = s.seats['s1']!.survivors
    const k1 = killSurvivor(s, b!, 'wounds')
    expect(k1.state.morale).toBe(s.morale)
    expect(ofType(k1.events, 'SurvivorKilled')[0]!.moraleLoss).toBe(false)
    const k2 = killSurvivor(k1.state, a!, 'wounds')
    expect(k2.decision).not.toBeNull()
    expect(isExiledPlacement(k2.decision!)).toBe(true)
    expect(k2.decision!.options!.every((o) => o.id !== 'colony')).toBe(true)
    const loc = k2.decision!.options![0]!.id
    const placed = applyExiledPlacement(k2.state, 's1', k2.decision!.context.survivorId!, loc)
    expect(placed.state.survivors[k2.decision!.context.survivorId!]).toMatchObject({ location: loc, owner: 's1' })
    expect(placed.state.seats['s1']!.leaderId).toBe(k2.decision!.context.survivorId)
  })

  it('SURV-014 equipped cards go back to the owner\'s hand at the colony, or are shuffled into the location deck elsewhere', () => {
    let s = base('surv-14')
    const [a, b] = s.seats['s1']!.survivors
    const hand = s.seats['s1']!.hand
    s = patchSurvivor(s, a!, { equipped: [hand[0]!] })
    s = patchSeat(s, 's1', { hand: hand.slice(1) })
    const atColony = killSurvivor(s, a!, 'wounds')
    expect(ofType(atColony.events, 'EquippedReturned')[0]).toMatchObject({ to: 'hand', cardIds: [hand[0]] })
    expect(atColony.state.seats['s1']!.hand).toContain(hand[0])
    // elsewhere
    const loc = s.locationOrder[1]!
    const card = hand[1]!
    let t = patchSurvivor(s, b!, { location: loc, equipped: [card] })
    t = patchSeat(t, 's1', { hand: hand.filter((c) => c !== hand[0] && c !== card) })
    const before = t.locations[loc]!.deck.length
    const away = killSurvivor(t, b!, 'overrun')
    expect(ofType(away.events, 'EquippedReturned')[0]).toMatchObject({ to: 'deck', location: loc })
    expect(ofType(away.events, 'DeckShuffled')[0]).toMatchObject({ location: loc, reason: 'equippedReturned' })
    expect(away.state.locations[loc]!.deck).toHaveLength(before + 1)
    expect(away.state.locations[loc]!.deck).toContain(card)
  })

  it('SURV-015 morale is clamped to 0..10, flags zero, and a no-op change emits nothing', () => {
    const s = base('surv-15')
    expect(changeMorale({ ...s, morale: 10 }, 2, 'crisisBonus').events).toHaveLength(0)
    const z = changeMorale({ ...s, morale: 1 }, -5, 'crisis')
    expect(z.moraleZero).toBe(true)
    expect(z.state.morale).toBe(0)
    expect(z.events[0]).toMatchObject({ delta: -1, after: 0 })
  })

  it('SURV-016 killing a dead survivor changes nothing', () => {
    const s = base('surv-16')
    const id = followerOf(s)
    const once = killSurvivor(s, id, 'wounds').state
    const twice = killSurvivor(once, id, 'wounds')
    expect(twice.events).toEqual([])
    expect(twice.state).toBe(once)
  })

  // One effect (a failed crisis wounding a whole location) can kill the leader and then more of the same seat's survivors: the newLeader
  // decision minted for the first death must not offer the ones that died after it (seed 35, game 59, two seats).
  const killAt = (s: GameState, loc: string) => runEffectNodes(s, [{ op: 'killSurvivor', scope: { who: 'atLocation', location: loc } }], { sourceId: 'cr.test', sourceKind: 'crisis', seat: 's1', point: 'colony.crisis' } as RunCtx)
  it('SURV-017 a multi-kill that takes the leader and another survivor re-reads the newLeader options (auto-resolves when one is left)', () => {
    let s = grow(base('surv-17'), 's1', 1) // three survivors: leader + two followers
    const [a, b, c] = [leaderOf(s), ...s.seats['s1']!.survivors.filter((x) => x !== leaderOf(s))] as [string, string, string]
    const loc = s.locationOrder[1]!
    s = patchSurvivor(patchSurvivor(s, a, { location: loc }), b, { location: loc })
    const r = killAt(s, loc)
    expect(ofType(r.events, 'SurvivorKilled').map((e) => e.survivorId).sort()).toEqual([a, b].sort())
    expect(r.pending).toBeUndefined()
    expect(r.state.seats['s1']!.leaderId).toBe(c)
    expect(ofType(r.events, 'DecisionAutoResolved')).toHaveLength(1)
    expect(ofType(r.events, 'LeaderChosen').at(-1)).toMatchObject({ seat: 's1', survivorId: c })
  })

  it('SURV-018 a multi-kill that leaves two or more candidates offers exactly the survivors still alive, under the same decision id', () => {
    let s = grow(base('surv-18'), 's1', 2) // leader + three followers
    const [a, b, c, d] = [leaderOf(s), ...s.seats['s1']!.survivors.filter((x) => x !== leaderOf(s))] as [string, string, string, string]
    const loc = s.locationOrder[1]!
    s = patchSurvivor(patchSurvivor(s, a, { location: loc }), b, { location: loc })
    const r = killAt(s, loc)
    expect(r.pending).toMatchObject({ kind: 'newLeader', seat: 's1' })
    expect(r.pending!.options!.map((o) => o.id).sort()).toEqual([`leader:${c}`, `leader:${d}`].sort())
    expect(r.state.pending).toBe(r.pending)
    for (const o of r.pending!.options!) expect(validateChooseLeader(r.state, 's1', (o.action as { survivorId: string }).survivorId)).toBeNull()
  })

  it('SURV-019 a Snowmobile trail that adds a zombie at the colony keeps the newLeader decision an overrun raises', () => {
    const s0 = grow(base('surv-19'), 's1', 1)
    const lead = leaderOf(s0)
    const marked: GameState = { ...s0, effects: [{ id: 'e:1', sourceId: 'xr.the-arctic-king', sourceKind: 'crossroads', name: 'snowmobile', data: { snowmobile: { wounds: 0 } }, survivorIds: [followerOf(s0)], duration: 'game', expires: null }] as never }
    const killed = killSurvivor(marked, lead, 'overrun')
    setRoutines({ addZombies: (st) => ({ state: killed.state, events: killed.events, pending: killed.decision! }) })
    try {
      const acc = mkAcc(marked)
      snowmobileTrail(acc, followerOf(marked), 'colony', 'colony')
      expect(acc.pending).toMatchObject({ kind: 'newLeader', seat: 's1' })
      expect(acc.events.filter((e) => e.type === 'SurvivorKilled')).toHaveLength(1) // it stopped at the first decision
    } finally { setRoutines({ addZombies: realAddZombies }) }
  })
})
