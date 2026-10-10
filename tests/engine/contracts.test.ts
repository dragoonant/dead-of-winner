// CONTRACT-*: the frozen engine contracts (docs/spec/00-architecture.md). These pin rng determinism, the exposure
// die distribution, the view's hidden-information rules and the M0 state of the API.
import { describe, expect, it } from 'vitest'
import {
  ACTION_WINDOWS, EXPOSURE_FACES, EXPOSURE_FACE_COUNT, NotImplementedError, OP_HOOK_POINTS, WINDOW_IDS, createGame, createRandomDecider, createReplayDecider,
  cyrb128, deriveSeed, exposureFaceOf, hiddenIdsFor, nextFloat, nextU32, query, redactEvent, roll, rollD12, rollD6, rollDice,
  rollExposure, rollExposureFace, seatToRight, seedRng, serializeView, shuffle, view,
  type Action, type DataBundle, type ExposureFace, type GameState, type PendingDecision, type RngState,
} from '@/engine/index'

// ---------- a hand-built state fixture (no createGame yet) ----------
function fixture(): GameState {
  const pending: PendingDecision = { id: 'd:1', seat: 's1', kind: 'turnAction', window: 'turn.start', context: {}, canPass: false }
  const seat = (id: string, hand: string[], secret: string) => ({
    seat: { id, kind: id === 's1' ? 'human' as const : 'bot' as const, exiled: false, eliminated: false },
    hand, secretObjectiveId: secret, exiledObjectiveId: null, offered: [], dice: [{ id: `${id}:d1`, value: 4, used: false }],
    survivors: [`sv.${id}`], leaderId: `sv.${id}`, abilityUses: {},
  })
  const loc = (id: string, entrances: number, deck: string[]) => ({
    id, entrances: Array.from({ length: entrances }, (_, i) => ({ index: i + 1, zombies: 0, barricades: 0 })), noise: 0, deck, helpless: 0,
    capacity: { survivors: 6, entranceSpaces: 3, noiseSpaces: 4 },
  })
  const cards: GameState['cards'] = {}
  for (const c of ['c:1', 'c:2', 'c:3', 'c:4', 'c:5', 'c:6', 'c:7', 'c:8', 'c:9']) cards[c] = { id: c, defId: `item.${c}` }
  return {
    seed: 'fixture', rng: seedRng('fixture'), rollSeq: 0, decisionSeq: 1, cardSeq: 9, effectSeq: 0, dataVersion: 'test',
    setup: { seats: [{ id: 's1', kind: 'human' }, { id: 's2', kind: 'bot' }, { id: 's3', kind: 'bot' }], mainObjective: 'obj.main.samples' },
    phase: 'playerTurns', colonyStep: null, roundsLeft: 6, roundNumber: 1, turnCount: 1,
    turn: { seat: 's1', index: 0, actions: 0, voteCalled: false, contributionAsked: false },
    seatOrder: ['s1', 's2', 's3'], firstSeat: 's1', activeSeat: 's1',
    seats: { s1: seat('s1', ['c:1', 'c:2'], 'obj.secret.one'), s2: seat('s2', ['c:3', 'c:4'], 'obj.secret.two'), s3: seat('s3', ['c:5'], 'obj.betrayal.three') },
    survivors: {
      'sv.s1': { id: 'sv.s1', owner: 's1', location: 'colony', status: 'alive', wounds: 0, frostbite: 0, equipped: [], movedThisTurn: false, extraMoves: 0 },
      'sv.s2': { id: 'sv.s2', owner: 's2', location: 'loc.police', status: 'alive', wounds: 1, frostbite: 0, equipped: ['c:9'], movedThisTurn: false, extraMoves: 0 },
      'sv.s3': { id: 'sv.s3', owner: 's3', location: 'colony', status: 'alive', wounds: 0, frostbite: 1, equipped: [], movedThisTurn: false, extraMoves: 0 },
    },
    survivorDeck: ['sv.deck1', 'sv.deck2'],
    locations: { colony: loc('colony', 6, []), 'loc.police': loc('loc.police', 1, ['c:6', 'c:7']) },
    locationOrder: ['colony', 'loc.police'],
    cards, waste: ['c:8'], removed: [], removedHidden: [], cardUses: {}, morale: 6, food: 2, starvation: 0,
    crisisDeck: ['crisis.a', 'crisis.b'], crisis: { cardId: 'crisis.c', contributions: [{ seat: 's2', cardId: 'c:3' }, { seat: 's1', cardId: 'c:2' }], result: null, history: [] },
    crossroads: { deck: ['xr.1', 'xr.2'], held: { cardId: 'xr.held', holder: 's3', forSeat: 's1' }, active: null, log: [{ roundNumber: 1, turnCount: 0, cardId: 'xr.old', holder: 's2', forSeat: 's3', triggered: false }] },
    exiledObjectiveDeck: ['obj.exiled.1'],
    objective: { id: 'obj.main.samples', side: 'normal', counters: { samples: 1 }, cards: [], complete: false },
    effects: [], attack: null,
    search: { seat: 's2', survivorId: 'sv.s2', location: 'loc.police', dieId: 's2:d1', drawn: ['c:7'], noiseAdded: 0 },
    request: null, bite: null, vote: null, exile: null, pending, log: [], result: null,
  }
}

describe('rng', () => {
  it('CONTRACT-001 the same seed gives the same stream', () => {
    const a = seedRng('dead-of-winner'), b = seedRng('dead-of-winner')
    expect(a).toEqual(b)
    expect(rollDice(a, 20)[0]).toEqual(rollDice(b, 20)[0])
    expect(cyrb128('x')).toEqual(cyrb128('x'))
  })
  it('CONTRACT-002 different seeds give different streams and never touch Math.random', () => {
    const a = rollDice(seedRng('seed-1'), 30)[0], b = rollDice(seedRng('seed-2'), 30)[0]
    expect(a).not.toEqual(b)
    const orig = Math.random
    Math.random = () => { throw new Error('Math.random used') }
    try { rollDice(seedRng('z'), 100); shuffle(seedRng('z'), [1, 2, 3, 4]); rollExposureFace(seedRng('z')) } finally { Math.random = orig }
  })
  it('CONTRACT-003 d6 and d12 stay in range and every face appears', () => {
    let s: RngState = seedRng('range')
    const seen6 = new Set<number>(), seen12 = new Set<number>()
    for (let i = 0; i < 2000; i++) {
      const [v, n] = rollD6(s); s = n; expect(v).toBeGreaterThanOrEqual(1); expect(v).toBeLessThanOrEqual(6); seen6.add(v)
      const [w, m] = rollD12(s); s = m; expect(w).toBeGreaterThanOrEqual(1); expect(w).toBeLessThanOrEqual(12); seen12.add(w)
    }
    expect(seen6.size).toBe(6)
    expect(seen12.size).toBe(12)
    const [f] = nextFloat(s); expect(f).toBeGreaterThanOrEqual(0); expect(f).toBeLessThan(1)
    const [u] = nextU32(s); expect(Number.isInteger(u)).toBe(true)
  })
  it('CONTRACT-004 the exposure die shows 6 blank, 3 wound, 2 frostbite, 1 bite over 12k seeded rolls', () => {
    expect(EXPOSURE_FACES).toHaveLength(12)
    expect(EXPOSURE_FACE_COUNT).toEqual({ blank: 6, wound: 3, frostbite: 2, bite: 1 })
    for (let raw = 1; raw <= 12; raw++) expect(EXPOSURE_FACES[raw - 1]).toBe(exposureFaceOf(raw))
    const n = 12000
    const counts: Record<ExposureFace, number> = { blank: 0, wound: 0, frostbite: 0, bite: 0 }
    let s: RngState = seedRng('exposure-12k')
    for (let i = 0; i < n; i++) { const [r, next] = rollExposureFace(s); s = next; counts[r.face]++ }
    // 5σ tolerances: blank σ≈55, wound σ≈47, frostbite σ≈39, bite σ≈30
    expect(Math.abs(counts.blank - 6000)).toBeLessThan(275)
    expect(Math.abs(counts.wound - 3000)).toBeLessThan(235)
    expect(Math.abs(counts.frostbite - 2000)).toBeLessThan(195)
    expect(Math.abs(counts.bite - 1000)).toBeLessThan(150)
    expect(counts.blank + counts.wound + counts.frostbite + counts.bite).toBe(n)
  })
  it('CONTRACT-005 roll() and rollExposure() advance state.rng and rollSeq and emit the event', () => {
    const s0 = fixture()
    const r1 = roll(s0, { count: 3, purpose: 'actionDice', seat: 's1' })
    expect(r1.event.type).toBe('DiceRolled')
    expect(r1.event.rollId).toBe('r:1')
    expect(r1.event.dice).toHaveLength(3)
    expect(r1.event.total).toBe(r1.event.dice.reduce((a, b) => a + b, 0))
    expect(r1.state.rollSeq).toBe(1)
    expect(r1.state.rng).not.toEqual(s0.rng)
    expect(s0.rollSeq).toBe(0) // the input is untouched
    const r2 = rollExposure(r1.state, 'sv.s1', 'move')
    expect(r2.event.type).toBe('ExposureRolled')
    expect(r2.event.rollId).toBe('r:2')
    expect(r2.event.face).toBe(exposureFaceOf(r2.event.raw))
    // replaying from the same state gives the same roll
    expect(rollExposure(r1.state, 'sv.s1', 'move').event).toEqual(r2.event)
  })
  it('CONTRACT-006 shuffle is a seeded permutation', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
    const [p1] = shuffle(seedRng('deck'), items), [p2] = shuffle(seedRng('deck'), items)
    expect(p1).toEqual(p2)
    expect([...p1].sort()).toEqual([...items].sort())
    expect(items).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']) // input untouched
  })
})

describe('deciders', () => {
  it('CONTRACT-007 the random decider is seeded by (seed, seat, decision) and never uses state.rng', async () => {
    const legal: Action[] = [
      { type: 'endTurn', decisionId: 'd:9', seat: 's2' },
      { type: 'callVote', decisionId: 'd:9', seat: 's2', target: 's1' },
      { type: 'callVote', decisionId: 'd:9', seat: 's2', target: 's3' },
      { type: 'move', decisionId: 'd:9', seat: 's2', survivorId: 'sv.s2', to: 'colony' },
      { type: 'spendFood', decisionId: 'd:9', seat: 's2', dieId: 's2:d1', tokens: 1 },
      { type: 'contributeCrisis', decisionId: 'd:9', seat: 's2', cardIds: [] },
      { type: 'request', decisionId: 'd:9', seat: 's2', to: 's1', symbol: 'fuel' },
    ]
    const pending: PendingDecision = { id: 'd:9', seat: 's2', kind: 'turnAction', window: 'turn.start', context: {}, canPass: false }
    const v = view(fixture(), 's2')
    const a = await createRandomDecider('seed', 's2').decide(v, pending, legal)
    const b = await createRandomDecider('seed', 's2').decide(v, pending, legal)
    expect(a).toBe(b)
    expect(deriveSeed('seed', 's2', 'd:9')).toEqual(deriveSeed('seed', 's2', 'd:9'))
    await expect(createRandomDecider('seed', 's2').decide(v, pending, [])).rejects.toThrow(/no legal actions/)
  })
  it('CONTRACT-008 the replay decider answers in order and refuses a mismatched decision id', async () => {
    const log: Action[] = [{ type: 'endTurn', decisionId: 'd:1', seat: 's1' }, { type: 'endTurn', decisionId: 'd:2', seat: 's2' }]
    const d = createReplayDecider(log)
    const v = view(fixture(), 's1')
    const p = (id: string): PendingDecision => ({ id, seat: 's1', kind: 'turnAction', window: 'turn.start', context: {}, canPass: false })
    expect(await d.decide(v, p('d:1'), [])).toBe(log[0])
    await expect(d.decide(v, p('d:7'), [])).rejects.toThrow(/expected d:7/)
    await expect(d.decide(v, p('d:3'), [])).rejects.toThrow(/exhausted/)
  })
})

describe('view', () => {
  it('CONTRACT-009 a seat view hides the other seats’ hands, objectives, contributions, search draws, the held Crossroads card and deck orders', () => {
    const s = fixture()
    const v1 = view(s, 's1')
    expect(v1.me.hand).toEqual(['c:1', 'c:2'])
    expect(v1.seats['s2']!.handCount).toBe(2)
    expect(v1.seats['s2']!.hasSecretObjective).toBe(true)
    expect(v1.me.secretObjectiveId).toBe('obj.secret.one')
    expect(v1.me.contributions).toEqual(['c:2'])
    expect(v1.crisis.contributionCount).toBe(2)
    expect(v1.crisis.contributionsBySeat).toEqual({ s1: 1, s2: 1, s3: 0 })
    expect(v1.crossroads.held).toEqual({ holder: 's3', forSeat: 's1' })
    expect(v1.me.crossroadsHeld).toBeNull()
    expect(v1.crossroads.log[0]!.cardId).toBeNull()
    expect(v1.crossroads.deckCount).toBe(2)
    expect(v1.locations['loc.police']!.deckCount).toBe(2)
    expect(v1.search?.drawnCount).toBe(1)
    expect(v1.me.searchDrawn).toEqual([])
    expect(Object.keys(v1.cards).sort()).toEqual(['c:1', 'c:2', 'c:8', 'c:9']) // own hand, own contribution, waste, equipped
    expect(v1.recap).toBeUndefined()
    expect((v1 as unknown as Record<string, unknown>)['log']).toBeUndefined()
    const text = serializeView(v1)
    for (const needle of hiddenIdsFor(s, 's1')) expect(text.includes(`"${needle}"`)).toBe(false)
    expect(hiddenIdsFor(s, 's1')).toEqual(expect.arrayContaining(['c:3', 'c:4', 'c:5', 'obj.secret.two', 'obj.betrayal.three', 'xr.held', 'c:7']))
    // the holder sees its own Crossroads card; the searcher sees its draws
    expect(view(s, 's3').me.crossroadsHeld).toBe('xr.held')
    expect(view(s, 's2').me.searchDrawn).toEqual(['c:7'])
    expect(seatToRight(s.seatOrder, 's1')).toBe('s3')
    expect(seatToRight(s.seatOrder, 's2')).toBe('s1')
  })
  it('CONTRACT-010 the recap at game end reveals everything', () => {
    const s: GameState = { ...fixture(), phase: 'ended', result: { reason: 'moraleZero', objectiveComplete: false, winners: [] } }
    const v = view(s, 's1')
    expect(v.recap?.secretObjectives['s2']?.secret).toBe('obj.secret.two')
    expect(v.recap?.hands['s3']).toEqual(['c:5'])
    expect(v.recap?.crossroads[0]?.cardId).toBe('xr.old')
    expect(v.crossroads.log[0]!.cardId).toBe('xr.old')
    expect(hiddenIdsFor(s, 's1')).toEqual([])
  })
  it('CONTRACT-014 (VIEW-018) another seat’s pending decision is a public stub: no drawn card ids, no options', () => {
    const s = fixture()
    s.pending = {
      id: 'd:2', seat: 's2', kind: 'searchKeepOrNoise', window: 'search.drawn',
      context: { survivorId: 'sv.s2', location: 'loc.police', cardId: 'c:7', cardIds: ['c:7'], need: 3 },
      options: [
        { id: 'keep', label: 'keep it', action: { type: 'keepCard', decisionId: 'd:2', seat: 's2', cardId: 'c:7' } },
        { id: 'noise', label: 'make noise', action: { type: 'makeNoise', decisionId: 'd:2', seat: 's2' } },
      ],
      canPass: false,
    }
    const v1 = view(s, 's1')
    expect(v1.pending).toEqual({ id: 'd:2', seat: 's2', kind: 'searchKeepOrNoise', window: 'search.drawn', context: { survivorId: 'sv.s2', location: 'loc.police', need: 3 }, canPass: false, redacted: true })
    expect(serializeView(v1).includes('"c:7"')).toBe(false)
    expect(hiddenIdsFor(s, 's1')).toContain('c:7')
    const v2 = view(s, 's2')
    expect(v2.pending).toBe(s.pending)
    expect(v2.pending.options).toHaveLength(2)
    // a 'all' decision (votes) is carried unchanged for every seat
    s.pending = { id: 'd:3', seat: 'all', kind: 'votes', window: 'action.vote', context: { seatId: 's3' }, canPass: false }
    expect(view(s, 's1').pending).toBe(s.pending)
    expect(view(s, 's3').pending).toBe(s.pending)
  })
  it('CONTRACT-015 (VIEW-019) secret-objective effects and unrevealed removals stay private until the recap', () => {
    const s = fixture()
    s.effects = [
      { id: 'e:1', sourceId: 'rule.blizzard', sourceKind: 'rule', name: 'blizzard', duration: 'round', expires: null },
      { id: 'e:2', sourceId: 'obj.secret.two', sourceKind: 'secretObjective', ownerSeat: 's2', name: 'count', data: { zombiesKilled: 2 }, duration: 'game', expires: null },
    ]
    s.removedHidden = ['c:6']
    s.crisis.history = [{ roundNumber: 1, cardId: 'crisis.z', result: { total: 2, needed: 2, prevented: true, bonus: false, revealed: [{ cardId: 'c:9', seat: 's2', points: 1 }], moraleDelta: 0 } }]
    const v1 = view(s, 's1')
    expect(v1.effects.map((e) => e.id)).toEqual(['e:1'])
    expect(v1.hiddenEffectCount).toBe(1)
    expect(view(s, 's2').effects.map((e) => e.id)).toEqual(['e:1', 'e:2'])
    expect(v1.removedHiddenCount).toBe(1)
    expect(v1.cards['c:6']).toBeUndefined()
    expect(v1.crisis.history[0]!.result.revealed[0]!.seat).toBeNull()
    const text = serializeView(v1)
    for (const needle of hiddenIdsFor(s, 's1')) expect(text.includes(`"${needle}"`)).toBe(false)
    expect(hiddenIdsFor(s, 's1')).toEqual(expect.arrayContaining(['c:6', 'e:2']))
    expect(redactEvent({ type: 'EffectApplied', effectId: 'e:2', sourceId: 'obj.secret.two', name: 'count', targetIds: [], expires: null, refreshed: false, ownerSeat: 's2' }, 's1')).toBeNull()
    expect(redactEvent({ type: 'EffectApplied', effectId: 'e:1', sourceId: 'rule.blizzard', name: 'blizzard', targetIds: [], expires: null, refreshed: false }, 's1')).not.toBeNull()
    expect(redactEvent({ type: 'CardDiscarded', seat: 's2', cardId: 'c:6', to: 'removed', reason: 'oldDivisions', revealed: false }, 's1')).toMatchObject({ cardId: '' })
    expect(redactEvent({ type: 'CardDiscarded', seat: 's2', cardId: 'c:6', to: 'removed', reason: 'oldDivisions', revealed: false }, 's2')).toMatchObject({ cardId: 'c:6' })
    // the recap reveals the removed cards and every crisis in the history with its contributors
    const ended: GameState = { ...s, phase: 'ended', result: { reason: 'concession', objectiveComplete: false, winners: [] } }
    const r = view(ended, 's1')
    expect(r.recap?.removedHidden).toEqual(['c:6'])
    expect(r.recap?.contributions).toEqual([{ roundNumber: 1, crisisId: 'crisis.z', revealed: [{ cardId: 'c:9', seat: 's2', points: 1 }] }])
    expect(r.crisis.history[0]!.result.revealed[0]!.seat).toBe('s2')
    expect(r.effects).toHaveLength(2)
  })
  it('CONTRACT-011 redactEvent blanks hidden fields for other seats', () => {
    expect(redactEvent({ type: 'SearchDrawn', seat: 's2', location: 'loc.police', cardId: 'c:7', defId: 'item.c:7', symbols: ['food'] }, 's1')).toBeNull()
    expect(redactEvent({ type: 'SearchDrawn', seat: 's2', location: 'loc.police', cardId: 'c:7', defId: 'item.c:7', symbols: ['food'] }, 's2')).not.toBeNull()
    expect(redactEvent({ type: 'CardContributed', seat: 's2', cardId: 'c:3', from: 'hand' }, 's1')).toMatchObject({ cardId: '' })
    expect(redactEvent({ type: 'CrossroadsDrawn', holder: 's3', forSeat: 's1', cardId: 'xr.held' }, 's1')).toMatchObject({ cardId: '' })
    expect(redactEvent({ type: 'CrossroadsDrawn', holder: 's3', forSeat: 's1', cardId: 'xr.held' }, 's3')).toMatchObject({ cardId: 'xr.held' })
    expect(redactEvent({ type: 'MoraleChanged', delta: -1, after: 5, reason: 'survivorKilled' }, 's1')).toMatchObject({ after: 5 })
    expect(redactEvent({ type: 'SecretObjectiveDealt', seat: 's2', objectiveId: 'obj.secret.two', kind: 'standard' }, 's1')).toBeNull()
  })
})

describe('api', () => {
  it('CONTRACT-012 the unbuilt bodies throw NotImplementedError (M0) and the windows list is frozen', () => {
    const bundle: DataBundle = { version: 'test', byId: {} }
    expect(() => createGame({ seats: [{ id: 's1', kind: 'human' }], mainObjective: 'random' }, 'seed', bundle)).toThrow(NotImplementedError)
    expect(() => query.crisis(view(fixture(), 's1'))).toThrow(NotImplementedError)
    expect(new Set(WINDOW_IDS).size).toBe(WINDOW_IDS.length)
    expect(WINDOW_IDS).toContain('action.move')
    expect(WINDOW_IDS).toContain('exposure.rolled')
    // a Crossroads vote option may bind to any resolved-action window
    expect(ACTION_WINDOWS).toEqual(WINDOW_IDS.filter((w) => w.startsWith('action.')))
    expect(OP_HOOK_POINTS.vote).toEqual(expect.arrayContaining([...ACTION_WINDOWS, 'crisis.resolved', 'action']))
    const concede: Action = { type: 'concede', decisionId: 'd:1', seat: 's1' }
    expect(concede.type).toBe('concede')
  })
  it('CONTRACT-013 the implemented queries read only the view: food needed and zombies to add', () => {
    const v = view(fixture(), 's1')
    const food = query.foodNeeded(v)
    expect(food).toMatchObject({ survivorsAtColony: 2, helpless: 0, needed: 1, supply: 2, shortfall: 0, moraleLossIfShort: 0 })
    const z = query.zombiesToAdd(v)
    expect(z.perLocation).toEqual([{ location: 'colony', survivors: 2, zombies: 1 }, { location: 'loc.police', survivors: 1, zombies: 1 }])
    expect(z.colonyEmptySpaces).toBe(18)
    expect(query.exposureBase()).toEqual({ blank: 0.5, wound: 0.25, frostbite: 1 / 6, bite: 1 / 12, pDeath: 1 / 12 })
  })
})
