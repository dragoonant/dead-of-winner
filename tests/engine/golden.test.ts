// GOLD-001..006: the six worked examples of docs/spec/13-golden-examples.md replayed through the public `step` with forced dice.
// Every value the book prints is asserted; the ASSUMED fixture values follow 13 §0. The colony-step scripts (004..006) reach the
// colony phase through the last seat's `endTurn`, so the whole phase runs after the asserted step (13 §0 harness convention).
import { describe, expect, it } from 'vitest'
import { query, redactEvent, serializeView, step, validate, view, type GameState } from '../../src/engine/index'
import { GAS, LIBRARY, HOSPITAL, POLICE, SCHOOL, act, buildGolden, forceRng, goldenBundle, of, orderOf, reopenLastTurn, types } from './golden-fixture'

const NONE = goldenBundle('none')
const SAMPLES = goldenBundle('samples')
const ascending = (xs: number[]) => xs.every((x, i) => x >= 0 && (i === 0 || x > xs[i - 1]!))

describe('GOLD-001 attacking a zombie (R p9)', () => {
  const build = (bundle = NONE, rng = forceRng([12, 7])) => buildGolden(bundle, {
    seats: 2, rng,
    survivors: [{ id: 'sv.ashley-ross', owner: 's1', location: SCHOOL }, { id: 'sv.mike-cho', owner: 's2', location: 'colony' }],
    dice: { s1: [4, 2], s2: [] }, zombies: { [SCHOOL]: [1] },
  })
  const attack = (s: GameState) => step(s, act(s, { type: 'attack', survivorId: 'sv.ashley-ross', dieId: 's1:d1', target: { kind: 'zombie', location: SCHOOL, entrance: 1 } }) as never)

  it('GOLD-001 a 4 on a 2+ attack kills the zombie and the exposure die shows a wound', () => {
    const s = build()
    const r = attack(s)
    expect(r.rejection).toBeUndefined()
    expect(ascending(orderOf(r.events, ['AttackDeclared', 'DieSpent', 'ZombieKilled', 'ExposureRolled', 'WoundTaken']))).toBe(true)
    expect(of(r.events, 'AttackDeclared')[0]).toMatchObject({ attackerId: 'sv.ashley-ross', need: 2, dieId: 's1:d1' })
    expect(of(r.events, 'DieSpent')[0]).toMatchObject({ value: 4, purpose: 'attack', need: 2 })
    expect(of(r.events, 'ZombieKilled')[0]).toMatchObject({ location: SCHOOL, entrance: 1, by: 'sv.ashley-ross', zombies: 0 })
    expect(of(r.events, 'ExposureRolled')[0]).toMatchObject({ reason: 'zombieKill', raw: 7, face: 'wound' })
    expect(of(r.events, 'WoundTaken')[0]).toMatchObject({ kind: 'wound', wounds: 1, frostbite: 0, source: 'exposure' })
    expect(r.state.locations[SCHOOL]!.entrances[0]!.zombies).toBe(0)
    expect(r.state.survivors['sv.ashley-ross']).toMatchObject({ wounds: 1, frostbite: 0, status: 'alive' })
    expect(r.state.seats['s1']!.dice[0]!.used).toBe(true)
    expect(r.state.seats['s1']!.dice[1]!.used).toBe(false)
    expect(r.state.morale).toBe(6)
    expect(r.pending).toMatchObject({ kind: 'turnAction', seat: 's1' })
    expect(r.state.turn!.actions).toBe(1)
    for (const t of ['SurvivorAttacked', 'CardStolen', 'MoraleChanged']) expect(types(r.events)).not.toContain(t)
  })

  it('GOLD-001b under We Need More Samples a 4 on the sample die adds a sample strictly between the kill and the exposure roll', () => {
    const r = attack(build(SAMPLES, forceRng([6, 4], [12, 7])))
    expect(r.rejection).toBeUndefined()
    expect(ascending(orderOf(r.events, ['ZombieKilled', 'DiceRolled', 'ObjectiveProgress', 'ExposureRolled']))).toBe(true)
    expect(of(r.events, 'DiceRolled').find((e) => e['purpose'] === 'objective')).toMatchObject({ dice: [4] })
    expect(of(r.events, 'ObjectiveProgress')[0]).toMatchObject({ counter: 'samples', delta: 1, after: 1, need: 6 })
    expect(of(r.events, 'ExposureRolled')[0]).toMatchObject({ raw: 7, face: 'wound' })
    expect(r.state.objective.counters['samples']).toBe(1)
    // a 3 on the sample die adds nothing; the exposure roll is then the second roll of the stream
    const miss = attack(build(SAMPLES, forceRng([6, 3], [12, 7])))
    expect(types(miss.events)).not.toContain('ObjectiveProgress')
    expect(of(miss.events, 'ExposureRolled')[0]).toMatchObject({ raw: 7 })
  })
})

describe('GOLD-002 attacking a survivor (R p9)', () => {
  const build = (rng = forceRng([6, 1])) => buildGolden(NONE, {
    seats: 2, rng,
    survivors: [{ id: 'sv.ashley-ross', owner: 's1', location: SCHOOL }, { id: 'sv.mike-cho', owner: 's2', location: SCHOOL }],
    hands: { s2: ['it.food-1', 'it.medicine'] }, dice: { s1: [3], s2: [] },
  })
  const attack = (s: GameState) => step(s, act(s, { type: 'attack', survivorId: 'sv.ashley-ross', dieId: 's1:d1', target: { kind: 'survivor', survivorId: 'sv.mike-cho' } }) as never)

  it('GOLD-002 a 1 against attack value 2 wounds Mike and steals a random card; no exposure roll', () => {
    const s = build()
    const [c1, c2] = s.seats['s2']!.hand as [string, string]
    const r = attack(s)
    expect(r.rejection).toBeUndefined()
    expect(ascending(orderOf(r.events, ['AttackDeclared', 'DieSpent', 'DiceRolled', 'SurvivorAttacked', 'WoundTaken', 'CardStolen']))).toBe(true)
    expect(of(r.events, 'AttackDeclared')[0]).toMatchObject({ need: 2, target: { kind: 'survivor' } })
    expect(of(r.events, 'DieSpent')[0]).toMatchObject({ value: 3, purpose: 'attack' })
    expect(of(r.events, 'DiceRolled')[0]).toMatchObject({ purpose: 'attackSurvivor', dice: [1], target: 2 })
    expect(of(r.events, 'SurvivorAttacked')[0]).toMatchObject({ attackerId: 'sv.ashley-ross', targetId: 'sv.mike-cho', roll: 1, targetAttack: 2, hit: true })
    expect(of(r.events, 'WoundTaken')[0]).toMatchObject({ survivorId: 'sv.mike-cho', kind: 'wound', wounds: 1, source: 'attack' })
    const stolen = of<{ from: string; to: string; cardId: string }>(r.events, 'CardStolen')[0]!
    expect(stolen).toMatchObject({ from: 's2', to: 's1' })
    expect([c1, c2]).toContain(stolen.cardId)
    expect(r.state.survivors['sv.mike-cho']).toMatchObject({ wounds: 1, status: 'alive' })
    const h1 = r.state.seats['s1']!.hand, h2 = r.state.seats['s2']!.hand
    expect(h1).toHaveLength(1)
    expect(h2).toHaveLength(1)
    expect([...h1, ...h2].sort()).toEqual([c1, c2].sort())
    expect(types(r.events)).not.toContain('ExposureRolled')
    expect(types(r.events)).not.toContain('ExposureSkipped')
    expect(r.state.morale).toBe(6)
    expect(r.pending).toMatchObject({ kind: 'turnAction', seat: 's1' })
    // VIEW-010: the stolen card is now in s1's hand and hidden from s2; a third seat's feed blanks it
    expect(serializeView(view(r.state, 's2')).includes(`"${stolen.cardId}"`)).toBe(false)
    expect(redactEvent(stolen as never, 's3')).toMatchObject({ cardId: '' })
  })

  it('GOLD-002b a 3 misses: no wound, no theft, hands unchanged', () => {
    const s = build(forceRng([6, 3]))
    const r = attack(s)
    expect(r.rejection).toBeUndefined()
    expect(of(r.events, 'SurvivorAttacked')[0]).toMatchObject({ roll: 3, hit: false })
    for (const t of ['WoundTaken', 'CardStolen', 'ExposureRolled']) expect(types(r.events)).not.toContain(t)
    expect(r.state.seats['s2']!.hand).toEqual(s.seats['s2']!.hand)
    expect(r.state.seats['s1']!.hand).toEqual([])
  })
})

describe('GOLD-003 searching with noise (R p10)', () => {
  const build = (noise = 0) => buildGolden(NONE, {
    seats: 2, survivors: [{ id: 'sv.forest-plum', owner: 's1', location: GAS }, { id: 'sv.mike-cho', owner: 's2', location: 'colony' }],
    decks: { [GAS]: ['it.lighter', 'it.fuel', 'it.fuel', 'it.colt-1911-pistol'] }, noise: { [GAS]: noise }, dice: { s1: [5], s2: [] },
  })

  it('GOLD-003 a 5 on a 5+ search draws the Lighter, noise draws the Fuel, the Fuel is kept and the Lighter goes under the deck', () => {
    const s = build()
    const [lighter, fuel1, fuel2, pistol] = s.locations[GAS]!.deck as [string, string, string, string]
    const r1 = step(s, act(s, { type: 'search', survivorId: 'sv.forest-plum', dieId: 's1:d1' }) as never)
    expect(r1.rejection).toBeUndefined()
    expect(r1.pending).toMatchObject({ kind: 'searchKeepOrNoise', seat: 's1' })
    expect(r1.pending.context.cardIds).toEqual([lighter])
    expect(r1.state.search).toMatchObject({ seat: 's1', drawn: [lighter], noiseAdded: 0 })
    // VIEW-007: the other seat sees a count, never the id
    const v2 = view(r1.state, 's2')
    expect(v2.search?.drawnCount).toBe(1)
    expect(serializeView(v2).includes(`"${lighter}"`)).toBe(false)
    const r2 = step(r1.state, act(r1.state, { type: 'makeNoise' }) as never)
    expect(r2.rejection).toBeUndefined()
    expect(r2.pending).toMatchObject({ kind: 'searchKeepOrNoise', seat: 's1' })
    expect(r2.pending.context.cardIds).toEqual([lighter, fuel1])
    const r3 = step(r2.state, act(r2.state, { type: 'keepCard', cardId: fuel1 }) as never)
    expect(r3.rejection).toBeUndefined()
    const events = [...r1.events, ...r2.events, ...r3.events]
    expect(ascending(orderOf(events, ['SearchStarted', 'SearchDrawn', 'NoiseAdded', 'SearchDrawn', 'SearchKept', 'CardDiscarded']))).toBe(true) // DieSpent may interleave (13 §0)
    expect(of(events, 'SearchStarted')[0]).toMatchObject({ survivorId: 'sv.forest-plum', location: GAS, need: 5 })
    expect(of(events, 'DieSpent')[0]).toMatchObject({ value: 5, purpose: 'search' })
    expect(of(events, 'SearchDrawn')[0]).toMatchObject({ cardId: lighter, defId: 'it.lighter' })
    expect(of(events, 'NoiseAdded')[0]).toMatchObject({ location: GAS, count: 1, after: 1, by: 'search' })
    expect(of(events, 'SearchDrawn')[1]).toMatchObject({ cardId: fuel1, defId: 'it.fuel', symbols: ['fuel'] })
    expect(of(events, 'SearchKept')[0]).toMatchObject({ cardId: fuel1, returned: 1 })
    expect(of(events, 'CardDiscarded')[0]).toMatchObject({ cardId: lighter, to: 'deck', reason: 'searchReturned' })
    expect(r3.state.seats['s1']!.hand).toEqual([fuel1])
    expect(r3.state.locations[GAS]!.deck).toEqual([fuel2, pistol, lighter])
    expect(r3.state.locations[GAS]!.noise).toBe(1)
    expect(r3.state.search).toBeNull()
    expect(r3.pending).toMatchObject({ kind: 'turnAction', seat: 's1' })
  })

  it('GOLD-003b with every noise space taken the only card is kept at once and noise is refused (SRCH-006)', () => {
    const s = build(4)
    const [lighter] = s.locations[GAS]!.deck as [string]
    const r = step(s, act(s, { type: 'search', survivorId: 'sv.forest-plum', dieId: 's1:d1' }) as never)
    expect(r.rejection).toBeUndefined()
    expect(of(r.events, 'DecisionAutoResolved')[0]).toMatchObject({ kind: 'searchKeepWhich' })
    expect(of(r.events, 'SearchKept')[0]).toMatchObject({ cardId: lighter, returned: 0 })
    expect(r.state.seats['s1']!.hand).toEqual([lighter])
    expect(r.pending).toMatchObject({ kind: 'turnAction', seat: 's1' })
    expect(validate(r.state, act(r.state, { type: 'makeNoise' }) as never)).not.toBeNull()
  })
})

describe('GOLD-004 resolving a crisis with a wrong-symbol card (R p12)', () => {
  const build = (contributions: { seat: string; defId: string }[]) => buildGolden(NONE, {
    seats: 3, active: 's3', crisis: 'cr.fuel-shortage', contributions, morale: 6,
    survivors: [{ id: 'sv.ashley-ross', owner: 's1', location: SCHOOL }, { id: 'sv.mike-cho', owner: 's2', location: LIBRARY }, { id: 'sv.forest-plum', owner: 's3', location: GAS }],
  })
  const endTurn = (s: GameState) => step(s, act(s, { type: 'endTurn' }) as never)

  it('GOLD-004 three Fuel and a Lighter total 2 of the 3 needed: the fail effect costs 2 morale', () => {
    const s = build([{ seat: 's1', defId: 'it.fuel' }, { seat: 's1', defId: 'it.fuel' }, { seat: 's2', defId: 'it.fuel' }, { seat: 's3', defId: 'it.lighter' }])
    const ids = s.crisis.contributions.map((c) => c.cardId)
    const r = endTurn(s)
    expect(r.rejection).toBeUndefined()
    const reveals = of<{ cardId: string; defId: string; points: number; runningTotal: number; seat?: string }>(r.events, 'CrisisCardRevealed')
    expect(reveals).toHaveLength(4)
    expect(reveals.map((e) => e.points).sort()).toEqual([-1, 1, 1, 1])
    expect(reveals[3]!.runningTotal).toBe(2)
    expect(reveals.find((e) => e.defId === 'it.lighter')).toMatchObject({ points: -1 })
    for (const e of reveals) expect(e.seat).toBeUndefined()
    expect(ascending(orderOf(r.events, ['CrisisCardRevealed', 'CrisisResolved', 'CrisisEffectApplied', 'MoraleChanged']))).toBe(true)
    expect(of(r.events, 'CrisisResolved')[0]).toMatchObject({ cardId: 'cr.fuel-shortage', total: 2, needed: 3, prevented: false, bonus: false, cards: 4 })
    expect(of(r.events, 'CrisisEffectApplied')[0]).toMatchObject({ kind: 'fail' })
    expect(of(r.events, 'MoraleChanged')[0]).toMatchObject({ delta: -2, after: 4, reason: 'crisisFailed', sourceId: 'cr.fuel-shortage' })
    const discards = of<{ cardId: string; to: string }>(r.events, 'CardDiscarded').filter((e) => e.to === 'removed')
    expect(discards.map((e) => e.cardId).sort()).toEqual([...ids].sort())
    expect(r.state.morale).toBe(4)
    for (const id of ids) expect(r.state.removed).toContain(id)
    expect(r.state.waste).toEqual([])
    expect(r.state.crisis.contributions).toEqual([])
    const h = r.state.crisis.history[0]!
    expect(h.result).toMatchObject({ total: 2, needed: 3, prevented: false, bonus: false, moraleDelta: -2 })
    expect(h.result.revealed.every((x) => typeof x.seat === 'string')).toBe(true)
    // CRIS-011: a seat sees only its own contributor name until the recap
    const seen = view(r.state, 's2').crisis.history[0]!.result.revealed
    expect(seen.find((x) => x.cardId === ids[2])!.seat).toBe('s2')
    expect(seen.filter((x) => x.cardId !== ids[2]).every((x) => x.seat === null)).toBe(true)
    expect(of<{ phase: string; step?: string }>(r.events, 'PhaseChanged').map((e) => e.step)).toContain('addZombies')
  })

  it('GOLD-004b four Fuel prevent it without a bonus; GOLD-004c five Fuel add the bonus morale', () => {
    const four = endTurn(build([{ seat: 's1', defId: 'it.fuel' }, { seat: 's1', defId: 'it.fuel' }, { seat: 's2', defId: 'it.fuel' }, { seat: 's3', defId: 'it.fuel' }]))
    expect(of(four.events, 'CrisisResolved')[0]).toMatchObject({ total: 4, prevented: true, bonus: false })
    expect(four.state.morale).toBe(6)
    const five = endTurn(build([{ seat: 's1', defId: 'it.fuel' }, { seat: 's1', defId: 'it.fuel' }, { seat: 's2', defId: 'it.fuel' }, { seat: 's3', defId: 'it.fuel' }, { seat: 's3', defId: 'it.fuel' }]))
    expect(of(five.events, 'CrisisResolved')[0]).toMatchObject({ total: 5, prevented: true, bonus: true })
    expect(of(five.events, 'MoraleChanged')[0]).toMatchObject({ delta: 1, reason: 'crisisBonus' })
    expect(five.state.morale).toBe(7)
  })
})

describe('GOLD-005 adding seven zombies with an overrun at entrance 3 (R p13)', () => {
  const colonyCrowd = [
    { id: 'sv.brian-lee', owner: 's1', location: 'colony' }, { id: 'sv.olivia-brown', owner: 's1', location: 'colony' },
    { id: 'sv.ashley-ross', owner: 's2', location: 'colony' }, { id: 'sv.mike-cho', owner: 's2', location: 'colony' },
    { id: 'sv.forest-plum', owner: 's3', location: 'colony', leader: true }, { id: 'sv.sparky', owner: 's3', location: 'colony' },
    { id: 'sv.daniel-smith', owner: 's4', location: LIBRARY },
  ]
  const build = (o: { zombies?: number[]; barricades?: number[]; survivors?: typeof colonyCrowd; helpless?: number }) => buildGolden(NONE, {
    seats: 4, active: 's4', morale: 6, food: 7, helpless: o.helpless ?? 8,
    survivors: o.survivors ?? colonyCrowd,
    zombies: { colony: o.zombies ?? [0, 0, 3, 0, 0, 0] }, barricades: { colony: o.barricades ?? [0, 0, 0, 0, 0, 0] },
  })
  const endTurn = (s: GameState) => step(s, act(s, { type: 'endTurn' }) as never)

  it('GOLD-005 fourteen at the colony add seven; the full entrance 3 kills Sparky and placement wraps to 1', () => {
    const r = endTurn(build({}))
    expect(r.rejection).toBeUndefined()
    const seq = ['ZombiesToAdd', 'ZombieAdded', 'ZombieAdded', 'EntranceOverrun', 'SurvivorKilled', 'MoraleChanged', 'ZombieAdded', 'ZombieAdded', 'ZombieAdded', 'ZombieAdded', 'ZombiesToAdd', 'ZombieAdded']
    const idx = orderOf(r.events, seq)
    expect(ascending(idx)).toBe(true)
    const at = (i: number) => r.events[idx[i]!] as unknown as Record<string, unknown>
    expect(at(0)).toMatchObject({ location: 'colony', count: 7, source: 'colonyStep', survivors: 14 })
    expect(at(1)).toMatchObject({ entrance: 1, zombies: 1 })
    expect(at(2)).toMatchObject({ entrance: 2, zombies: 1 })
    expect(at(3)).toMatchObject({ entrance: 3, killed: 'sv.sparky' })
    expect(at(4)).toMatchObject({ survivorId: 'sv.sparky', owner: 's3', cause: 'overrun', moraleLoss: true, wasLeader: false })
    expect(at(5)).toMatchObject({ delta: -1, after: 5, reason: 'survivorKilled' })
    expect(at(6)).toMatchObject({ entrance: 4, zombies: 1 })
    expect(at(7)).toMatchObject({ entrance: 5, zombies: 1 })
    expect(at(8)).toMatchObject({ entrance: 6, zombies: 1 })
    expect(at(9)).toMatchObject({ entrance: 1, zombies: 2 })
    expect(at(10)).toMatchObject({ location: LIBRARY, count: 1, source: 'locationStep' })
    expect(at(11)).toMatchObject({ location: LIBRARY, entrance: 1 })
    expect(r.state.locations['colony']!.entrances.map((e) => e.zombies)).toEqual([2, 1, 3, 1, 1, 1])
    expect(r.state.locations['colony']!.entrances.every((e) => e.barricades === 0)).toBe(true)
    expect(r.state.survivors['sv.sparky']).toMatchObject({ status: 'dead', owner: null })
    expect(r.state.seats['s3']!.survivors).toEqual(['sv.forest-plum'])
    expect(r.state.seats['s3']!.leaderId).toBe('sv.forest-plum')
    expect(r.state.morale).toBe(5)
    expect(r.state.locations['colony']!.helpless).toBe(8)
    expect(types(r.events)).not.toContain('newLeader')
  })

  it('GOLD-005b a barricade on entrance 3 breaks instead of a death', () => {
    const r = endTurn(build({ zombies: [0, 0, 2, 0, 0, 0], barricades: [0, 0, 1, 0, 0, 0] }))
    expect(r.rejection).toBeUndefined()
    expect(of(r.events, 'BarricadeDestroyed')[0]).toMatchObject({ location: 'colony', entrance: 3, barricades: 0 })
    expect(types(r.events)).not.toContain('SurvivorKilled')
    expect(r.state.morale).toBe(6)
    expect(r.state.locations['colony']!.entrances[2]).toMatchObject({ zombies: 2, barricades: 0 })
  })

  it('GOLD-005c with only helpless tokens at the colony the overrun kills a token; GOLD-005d an empty colony adds nothing', () => {
    const away = [
      { id: 'sv.brian-lee', owner: 's1', location: SCHOOL }, { id: 'sv.olivia-brown', owner: 's1', location: SCHOOL },
      { id: 'sv.ashley-ross', owner: 's2', location: HOSPITAL }, { id: 'sv.mike-cho', owner: 's2', location: HOSPITAL },
      { id: 'sv.forest-plum', owner: 's3', location: POLICE, leader: true }, { id: 'sv.sparky', owner: 's3', location: POLICE },
      { id: 'sv.daniel-smith', owner: 's4', location: LIBRARY },
    ]
    const r = endTurn(build({ survivors: away, helpless: 14 }))
    expect(r.rejection).toBeUndefined()
    expect(ascending(orderOf(r.events, ['EntranceOverrun', 'HelplessKilled', 'MoraleChanged']))).toBe(true)
    expect(of(r.events, 'EntranceOverrun')[0]).toMatchObject({ entrance: 3, killed: 'helpless' })
    expect(of(r.events, 'HelplessKilled')[0]).toMatchObject({ count: 1, after: 13, moraleLoss: true })
    expect(of(r.events, 'MoraleChanged')[0]).toMatchObject({ delta: -1 })
    const empty = endTurn(buildGolden(NONE, { seats: 4, active: 's4', morale: 6, survivors: away, helpless: 0, zombies: { colony: [0, 0, 3, 0, 0, 0] } }))
    expect(empty.rejection).toBeUndefined()
    expect(of<{ location: string; count: number }>(empty.events, 'ZombiesToAdd').filter((e) => e.location === 'colony' && e.count > 0)).toEqual([])
    expect(of<{ location: string }>(empty.events, 'ZombieAdded').filter((e) => e.location === 'colony')).toEqual([])
    expect(empty.state.locations['colony']!.entrances.map((e) => e.zombies)).toEqual([0, 0, 3, 0, 0, 0])
  })
})

describe('GOLD-006 three rounds of starvation (F 6.1.1)', () => {
  const build = () => buildGolden(NONE, {
    seats: 3, active: 's3', morale: 6, food: 5, helpless: 8,
    survivors: [
      { id: 'sv.brian-lee', owner: 's1', location: 'colony' }, { id: 'sv.olivia-brown', owner: 's1', location: 'colony' },
      { id: 'sv.ashley-ross', owner: 's2', location: 'colony' }, { id: 'sv.mike-cho', owner: 's2', location: 'colony' },
      { id: 'sv.forest-plum', owner: 's3', location: 'colony' },
    ],
  })
  const endTurn = (s: GameState) => step(s, act(s, { type: 'endTurn' }) as never)

  it('GOLD-006 short, then exactly paid, then short with two tokens', () => {
    const s1 = build()
    expect(query.foodNeeded(view(s1, 's1'))).toMatchObject({ needed: 7, shortfall: 2, moraleLossIfShort: 1 })
    const r1 = endTurn(s1)
    expect(r1.rejection).toBeUndefined()
    expect(of(r1.events, 'Starvation')[0]).toMatchObject({ needed: 7, supply: 5, starvationAfter: 1, moraleLoss: 1 })
    expect(of(r1.events, 'MoraleChanged')[0]).toMatchObject({ delta: -1, after: 5, reason: 'starvation' })
    expect(types(r1.events)).not.toContain('FoodPaid')
    expect(types(r1.events)).not.toContain('FoodChanged')
    expect(r1.state).toMatchObject({ food: 5, starvation: 1, morale: 5 })

    const s2 = reopenLastTurn(r1.state, 's3', { food: 8, helpless: 10 })
    expect(query.foodNeeded(view(s2, 's1'))).toMatchObject({ needed: 8, shortfall: 0, moraleLossIfShort: 0 })
    const r2 = endTurn(s2)
    expect(r2.rejection).toBeUndefined()
    expect(of(r2.events, 'FoodPaid')[0]).toMatchObject({ needed: 8, survivors: 15, foodAfter: 0 })
    expect(of(r2.events, 'FoodChanged')[0]).toMatchObject({ delta: -8, after: 0, reason: 'pay' })
    expect(types(r2.events)).not.toContain('Starvation')
    expect(types(r2.events)).not.toContain('MoraleChanged')
    expect(r2.state).toMatchObject({ food: 0, starvation: 1, morale: 5 })

    const s3 = reopenLastTurn(r2.state, 's3', { food: 2 })
    expect(query.foodNeeded(view(s3, 's1'))).toMatchObject({ needed: 8, shortfall: 6, moraleLossIfShort: 2 })
    const r3 = endTurn(s3)
    expect(r3.rejection).toBeUndefined()
    expect(of(r3.events, 'Starvation')[0]).toMatchObject({ needed: 8, supply: 2, starvationAfter: 2, moraleLoss: 2 })
    expect(of(r3.events, 'MoraleChanged')[0]).toMatchObject({ delta: -2, after: 3, reason: 'starvation' })
    expect(r3.state).toMatchObject({ food: 2, starvation: 2, morale: 3 })
  })

  it('GOLD-006b a token removed by a card: round 3 with no tokens costs one morale again', () => {
    const r1 = endTurn(build())
    const s3 = reopenLastTurn(r1.state, 's3', { food: 0, starvation: 0 })
    const r3 = endTurn(s3)
    expect(r3.rejection).toBeUndefined()
    expect(of(r3.events, 'Starvation')[0]).toMatchObject({ starvationAfter: 1, moraleLoss: 1 })
  })
})
