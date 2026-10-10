import { describe, expect, it } from 'vitest'
import { createGameInternal } from '../../src/engine/setup'
import { stepSetup } from '../../src/engine/phases/setup'
import type { GameEvent } from '../../src/engine/events'
import type { DataBundle, GameState } from '../../src/engine/types'
import { BUNDLE, playSetup, seatsOf, setupOf } from './setup-fixture'

const ofType = <T extends GameEvent['type']>(events: GameEvent[], type: T) => events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type)
const zombiesAt = (s: GameState, loc: string) => s.locations[loc]!.entrances.reduce((a, e) => a + e.zombies, 0)
const NON_COLONY = (s: GameState) => s.locationOrder.filter((l) => l !== 'colony')

describe('createGame setup', () => {
  it('SETUP-001 1 or 6 seats and an unflagged 2-seat table are rejected; 2..5 seats are accepted with GameCreated', () => {
    expect(createGameInternal({ seats: seatsOf(1), mainObjective: 'random' }, 'x', BUNDLE).rejection?.code).toBe('E_BAD_SETUP')
    expect(createGameInternal({ seats: seatsOf(6), mainObjective: 'random' }, 'x', BUNDLE).rejection?.code).toBe('E_BAD_SETUP')
    expect(createGameInternal(setupOf(2), 'x', BUNDLE).rejection?.code).toBe('E_BAD_SETUP')
    expect(createGameInternal(setupOf(3, { betrayer: true, coop: true }), 'x', BUNDLE).rejection?.code).toBe('E_BAD_SETUP')
    expect(createGameInternal({ seats: seatsOf(3), mainObjective: 'obj.main.nope' }, 'x', BUNDLE).rejection?.code).toBe('E_BAD_SETUP')
    for (const n of [3, 4, 5]) {
      const r = createGameInternal(setupOf(n), 'x', BUNDLE)
      expect(r.rejection).toBeUndefined()
      expect(r.events[0]!.type).toBe('GameCreated')
      expect(r.pending.kind).toBe('chooseSurvivors')
      expect(r.pending.seat).toBe('s1')
    }
    expect(createGameInternal(setupOf(2, { twoPlayer: true }), 'x', BUNDLE).rejection).toBeUndefined()
  })

  it('SETUP-002 We Need More Samples normal side: morale 6, 6 rounds, 1 zombie outside the colony, empty colony entrances', () => {
    const { state } = createGameInternal(setupOf(4), 'seed-2', BUNDLE)
    expect(state.morale).toBe(6)
    expect(state.roundsLeft).toBe(6)
    expect(state.objective.side).toBe('normal')
    expect(NON_COLONY(state)).toHaveLength(6)
    for (const l of NON_COLONY(state)) expect(zombiesAt(state, l)).toBe(1)
    expect(zombiesAt(state, 'colony')).toBe(0)
    expect(state.locations['colony']!.entrances).toHaveLength(6)
  })

  it('SETUP-003 hardcore side: 5 rounds and 3 zombies per non-colony location, added one event at a time', () => {
    const r = createGameInternal(setupOf(4, { hardcore: true }), 'seed-3', BUNDLE)
    expect(r.state.roundsLeft).toBe(5)
    expect(r.state.objective.side).toBe('hardcore')
    for (const l of NON_COLONY(r.state)) expect(zombiesAt(r.state, l)).toBe(3)
    expect(ofType(r.events, 'ZombieAdded')).toHaveLength(18)
    expect(ofType(r.events, 'ZombiesToAdd').every((e) => e.source === 'setup' && e.count === 3)).toBe(true)
  })

  it('SETUP-004 4 seats: each seat gets one secret objective from an 8 standard + 1 betrayal pool, kind matching the card', () => {
    const r = createGameInternal(setupOf(4), 'seed-4', BUNDLE)
    const dealt = ofType(r.events, 'SecretObjectiveDealt')
    expect(dealt).toHaveLength(4)
    expect(new Set(dealt.map((d) => d.objectiveId)).size).toBe(4)
    for (const d of dealt) {
      expect(r.state.seats[d.seat]!.secretObjectiveId).toBe(d.objectiveId)
      expect(d.kind).toBe(d.objectiveId.startsWith('obj.betrayal.') ? 'betrayal' : 'standard')
    }
    expect(dealt.filter((d) => d.kind === 'betrayal').length).toBeLessThanOrEqual(1)
  })

  const betrayerRate = (variants: { betrayer?: boolean }, games: number) => {
    let hits = 0
    for (let i = 0; i < games; i++) {
      const r = createGameInternal(setupOf(4, variants), `odds-${i}`, BUNDLE)
      if (ofType(r.events, 'SecretObjectiveDealt').some((d) => d.kind === 'betrayal')) hits++
    }
    return hits / games
  }
  it('SETUP-005 a betrayer is dealt in about 4/9 of 4-seat games', () => {
    expect(Math.abs(betrayerRate({}, 1000) - 4 / 9)).toBeLessThan(0.02)
  })
  it('SETUP-006 the betrayer variant deals a betrayer in about 4/5 of games', () => {
    expect(Math.abs(betrayerRate({ betrayer: true }, 1000) - 0.8)).toBeLessThan(0.02)
  })

  it('SETUP-007 each seat is dealt 5 starting items; only dealt starter cards ever exist', () => {
    const { state, events } = createGameInternal(setupOf(3), 'seed-7', BUNDLE)
    expect(ofType(events, 'StartingItemsDealt').map((e) => e.cardIds.length)).toEqual([5, 5, 5])
    for (const id of state.seatOrder) expect(state.seats[id]!.hand).toHaveLength(5)
    const inDecks = Object.values(state.locations).reduce((a, l) => a + l.deck.length, 0)
    expect(Object.keys(state.cards)).toHaveLength(15 + inDecks)
  })

  it('SETUP-008 twoPlayer: 7 starting items each, keep exactly 3 of 4, no secret objectives', () => {
    const { state } = createGameInternal(setupOf(2, { twoPlayer: true }), 'seed-8', BUNDLE)
    expect(state.seats['s1']!.hand).toHaveLength(7)
    expect(state.seats['s2']!.hand).toHaveLength(7)
    expect(state.seats['s1']!.secretObjectiveId).toBeNull()
    const offered = state.seats['s1']!.offered
    const act = (keep: string[]) => stepSetup(state, { type: 'chooseSurvivors', decisionId: state.pending.id, seat: 's1', keep })
    expect(act(offered.slice(0, 2)).rejection?.code).toBe('E_BAD_PAYLOAD')
    const ok = act(offered.slice(0, 3))
    expect(ok.rejection).toBeUndefined()
    expect(ok.state.seats['s1']!.survivors).toHaveLength(3)
  })

  it('SETUP-009 chooseSurvivors with 1 or 3 ids is E_BAD_PAYLOAD; an id not offered is E_NOT_AN_OPTION; rejections keep the same state', () => {
    const { state } = createGameInternal(setupOf(3), 'seed-9', BUNDLE)
    const offered = state.seats['s1']!.offered
    expect(offered).toHaveLength(4)
    const act = (keep: string[]) => stepSetup(state, { type: 'chooseSurvivors', decisionId: state.pending.id, seat: 's1', keep })
    expect(act([offered[0]!]).rejection?.code).toBe('E_BAD_PAYLOAD')
    expect(act(offered.slice(0, 3)).rejection?.code).toBe('E_BAD_PAYLOAD')
    const foreign = state.seats['s2']!.offered[0]!
    const r = act([offered[0]!, foreign])
    expect(r.rejection?.code).toBe('E_NOT_AN_OPTION')
    expect(r.state).toBe(state)
    expect(stepSetup(state, { type: 'chooseSurvivors', decisionId: state.pending.id, seat: 's2', keep: offered.slice(0, 2) }).rejection?.code).toBe('E_NOT_YOUR_DECISION')
  })

  it('SETUP-010 returned survivors go back into the reshuffled deck and not into play', () => {
    const { result, events, created } = playSetup(setupOf(4), 'seed-10')
    const s = result.state
    const inPlay = Object.keys(s.survivors)
    expect(inPlay).toHaveLength(8)
    expect(s.survivorDeck.length).toBe(created.state.survivorDeck.length + 8)
    expect(s.survivorDeck.some((id) => inPlay.includes(id))).toBe(false)
    expect(ofType(events, 'DeckShuffled').filter((e) => e.location === 'survivor' && e.reason === 'returnedSurvivors')).toHaveLength(1)
    expect(ofType(events, 'SurvivorsChosen').every((e) => e.returned === 2)).toBe(true)
  })

  it('SETUP-011 chooseLeader with a survivor the seat did not keep is E_NOT_LEADER_CANDIDATE; a kept one becomes leader', () => {
    let cur = createGameInternal(setupOf(3), 'seed-11', BUNDLE)
    while (cur.pending.kind === 'chooseSurvivors') cur = stepSetup(cur.state, cur.pending.options![0]!.action)
    expect(cur.pending.kind).toBe('chooseLeader')
    const other = cur.state.seats['s2']!.survivors[0]!
    const bad = stepSetup(cur.state, { type: 'chooseLeader', decisionId: cur.pending.id, seat: 's1', survivorId: other })
    expect(bad.rejection?.code).toBe('E_NOT_LEADER_CANDIDATE')
    const mine = cur.state.seats['s1']!.survivors
    const ok = stepSetup(cur.state, { type: 'chooseLeader', decisionId: cur.pending.id, seat: 's1', survivorId: mine[1]! })
    expect(ofType(ok.events, 'LeaderChosen')[0]).toMatchObject({ seat: 's1', survivorId: mine[1], reason: 'setup' })
    expect(ok.state.seats['s1']!.leaderId).toBe(mine[1])
  })

  it('SETUP-012 all kept survivors start alive at the colony with no wounds', () => {
    const { result } = playSetup(setupOf(4), 'seed-12')
    const all = Object.values(result.state.survivors)
    expect(all).toHaveLength(8)
    expect(all.every((s) => s.location === 'colony' && s.status === 'alive' && s.wounds === 0 && s.frostbite === 0)).toBe(true)
  })

  it('SETUP-013 the seat whose leader has the highest influence takes the first-player token', () => {
    const named = ['sv.olivia-brown', 'sv.ashley-ross', 'sv.brian-lee', 'sv.sparky']
    const keepIds = new Set([...named, ...Object.keys(BUNDLE.byId).filter((id) => id.startsWith('sv.extra-')).slice(0, 12)])
    const bundle: DataBundle = { version: 'fixture-16', byId: Object.fromEntries(Object.entries(BUNDLE.byId).filter(([id]) => !id.startsWith('sv.') || keepIds.has(id))) }
    const created = createGameInternal(setupOf(4), 'seed-13', bundle)
    const holder = (sv: string) => created.state.seatOrder.find((s) => created.state.seats[s]!.offered.includes(sv))!
    const keep: Record<string, string[]> = {}
    const leaders: Record<string, string> = {}
    for (const s of created.state.seatOrder) {
      const o = created.state.seats[s]!.offered
      const mine = named.find((n) => o.includes(n))
      keep[s] = mine ? [mine, o.find((x) => x !== mine)!] : o.slice(0, 2)
      leaders[s] = keep[s]![0]!
    }
    const { result, events } = playSetup(setupOf(4), 'seed-13', { bundle, keep, leaders })
    const ids = ['sv.olivia-brown', 'sv.ashley-ross', 'sv.brian-lee', 'sv.sparky']
    expect(ids.every((n) => holder(n))).toBe(true)
    expect(ofType(events, 'FirstSeatSet')[0]).toMatchObject({ seat: holder('sv.brian-lee'), influence: 68 })
    expect(result.state.firstSeat).toBe(holder('sv.brian-lee'))
  })

  it('SETUP-014 coop: no secret objectives, hardcore side, Annaleigh Chan and Gray Beard are not in the survivor deck', () => {
    const { state, events } = createGameInternal(setupOf(3, { coop: true }), 'seed-14', BUNDLE)
    expect(Object.values(state.seats).every((s) => s.secretObjectiveId === null)).toBe(true)
    expect(ofType(events, 'SecretObjectiveDealt')).toHaveLength(0)
    expect(state.objective.side).toBe('hardcore')
    const dealt = state.seatOrder.flatMap((s) => state.seats[s]!.offered)
    const everyone = [...state.survivorDeck, ...dealt]
    expect(everyone).not.toContain('sv.annaleigh-chan')
    expect(everyone).not.toContain('sv.gray-beard')
  })

  it('SETUP-015 removeMature leaves mature Crossroads cards out of the deck', () => {
    const mature = (s: GameState) => s.crossroads.deck.filter((id) => (BUNDLE.byId[id] as { mature?: boolean }).mature)
    expect(mature(createGameInternal(setupOf(3), 'seed-15', BUNDLE).state).length).toBeGreaterThan(0)
    expect(mature(createGameInternal(setupOf(3, { removeMature: true }), 'seed-15', BUNDLE).state)).toHaveLength(0)
  })

  it('SETUP-016 after the last leader is chosen: RoundStarted 1, CrisisRevealed, 3 dice per seat, TurnStarted, CrossroadsDrawn for the seat to the right, turnAction', () => {
    const { result, events } = playSetup(setupOf(4), 'seed-16')
    const s = result.state
    expect(result.pending.kind).toBe('turnAction')
    expect(result.pending.seat).toBe(s.firstSeat)
    expect(ofType(events, 'RoundStarted')[0]!.roundNumber).toBe(1)
    expect(ofType(events, 'CrisisRevealed')).toHaveLength(1)
    const rolled = ofType(events, 'ActionDiceRolled')
    expect(rolled).toHaveLength(4)
    expect(rolled.every((r) => r.dice.length === 3)).toBe(true)
    const i = s.seatOrder.indexOf(s.firstSeat)
    expect(ofType(events, 'CrossroadsDrawn')[0]!.holder).toBe(s.seatOrder[(i + 3) % 4])
  })

  it('SETUP-017 exactly one DeckShuffled(setup) per non-colony location, none for the colony, identical for one seed', () => {
    const shuffles = (seed: string) => ofType(createGameInternal(setupOf(4), seed, BUNDLE).events, 'DeckShuffled').filter((e) => e.reason === 'setup')
    const a = shuffles('seed-17')
    expect(a).toHaveLength(6)
    expect(a.some((e) => e.location === 'colony')).toBe(false)
    const decks = (seed: string) => { const s = createGameInternal(setupOf(4), seed, BUNDLE).state; return s.locationOrder.map((l) => s.locations[l]!.deck.map((c) => s.cards[c]!.defId).join(',')) }
    expect(decks('seed-17')).toEqual(decks('seed-17'))
    expect(decks('seed-17')).not.toEqual(decks('seed-17b'))
  })

  it('SETUP-018 coop and twoPlayer leave non-co-op item cards out of every location deck', () => {
    const nonCoop = (s: GameState) => Object.values(s.locations).flatMap((l) => l.deck).filter((c) => s.cards[c]!.defId === 'it.noncoop').length
    expect(nonCoop(createGameInternal(setupOf(3), 'seed-18', BUNDLE).state)).toBe(6)
    expect(nonCoop(createGameInternal(setupOf(3, { coop: true }), 'seed-18', BUNDLE).state)).toBe(0)
    expect(nonCoop(createGameInternal(setupOf(2, { twoPlayer: true }), 'seed-18', BUNDLE).state)).toBe(0)
    const xr = (s: GameState) => s.crossroads.deck.filter((id) => (BUNDLE.byId[id] as { coop?: boolean }).coop === false).length
    expect(xr(createGameInternal(setupOf(3), 'seed-18', BUNDLE).state)).toBeGreaterThan(0)
    expect(xr(createGameInternal(setupOf(3, { coop: true }), 'seed-18', BUNDLE).state)).toBe(0)
  })

  it('SETUP-019 mainObjective random is drawn on the seeded stream and named by GameCreated', () => {
    const pick = (seed: string) => createGameInternal({ seats: seatsOf(3), mainObjective: 'random' }, seed, BUNDLE)
    const a = pick('rand-1')
    expect(pick('rand-1').state.objective.id).toBe(a.state.objective.id)
    expect(ofType(a.events, 'GameCreated')[0]!.objectiveId).toBe(a.state.objective.id)
    const seen = new Set(Array.from({ length: 20 }, (_, i) => pick(`rand-${i}`).state.objective.id))
    expect([...seen].every((id) => id.startsWith('obj.main.'))).toBe(true)
    expect(seen.size).toBe(2)
  })

  it('SETUP-020 helpless tokens from the main objective setup (Too Many Mouths: seats + 3) land on the colony', () => {
    const { state, events } = createGameInternal(setupOf(4, {}, 'obj.main.too-many-mouths'), 'seed-20', BUNDLE)
    expect(state.locations['colony']!.helpless).toBe(7)
    expect(ofType(events, 'HelplessAdded')[0]).toMatchObject({ count: 7, after: 7 })
    expect(zombiesAt(state, 'colony')).toBe(6)
    expect(state.morale).toBe(7)
  })
})
