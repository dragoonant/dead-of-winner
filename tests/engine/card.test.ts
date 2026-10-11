import { describe, expect, it } from 'vitest'
import type { ContributeCrisisAction, HandOffAction, PlayCardAction, RequestAction, RespondRequestAction } from '../../src/engine/actions'
import { activateDescriptor, findDescriptor, resetRoundUses, resumeEffects } from '../../src/engine/effects'
import { contributeCrisis } from '../../src/engine/actions/crisis'
import { handOff } from '../../src/engine/actions/handoff'
import { playCard } from '../../src/engine/actions/play'
import { request, respondRequest } from '../../src/engine/actions/request'
import { routines } from '../../src/engine/effects'
import { act, addCard, makeState, setSeat, setSurvivor, types } from './effect-fixture'

const play = (s: ReturnType<typeof makeState>, cardId: string, extra: Record<string, unknown> = {}, seat?: string) =>
  playCard(s, act(s, 'playCard', { cardId, ...extra }, seat) as PlayCardAction)

describe('card actions', () => {
  it('CARD-001 playing a Food card adds food and puts the card on top of the waste pile', () => {
    const { state: s0, id } = addCard(makeState(), 'it.food-1', 'hand:s1')
    const r = play(s0, id)
    expect(r.rejection).toBeUndefined()
    expect(types(r.events)).toEqual(expect.arrayContaining(['CardPlayed', 'FoodChanged']))
    expect(r.events.find((e) => e.type === 'FoodChanged')).toMatchObject({ delta: 1, reason: 'card' })
    expect(r.events.find((e) => e.type === 'CardPlayed')).toMatchObject({ to: 'waste' })
    expect(r.state.food).toBe(5)
    expect(r.state.waste[0]).toBe(id)
    expect(r.state.seats.s1!.hand).toEqual([])
  })

  it('CARD-021 an event card (Outsiders) leaves the game when played: it never reaches the waste pile (2020 printing, R p10)', () => {
    const { state: s0, id } = addCard(makeState(), 'it.outsiders', 'hand:s1')
    const r = play(s0, id)
    expect(r.rejection).toBeUndefined()
    expect(r.events.find((e) => e.type === 'CardPlayed')).toMatchObject({ to: 'removed' })
    expect(r.state.removed).toContain(id)
    expect(r.state.waste).not.toContain(id)
  })

  it('CARD-002 a card not in hand, or played on another seat\'s turn, is rejected without changing state', () => {
    const { state: s0, id } = addCard(makeState(), 'it.food-1', 'hand:s1')
    const other = addCard(s0, 'it.food-1', 'hand:s2')
    expect(play(other.state, 'c:999').rejection?.code).toBe('E_NOT_IN_HAND')
    const wrongTurn = play(other.state, other.id, {}, 's2')
    expect(wrongTurn.rejection?.code).toBe('E_NOT_YOUR_DECISION')
    expect(wrongTurn.state).toBe(other.state)
    expect(id).toBeTruthy()
  })

  it('CARD-003 an Equip card needs equipTo and ends up on the survivor, not in the waste pile', () => {
    const { state: s0, id } = addCard(makeState(), 'it.lighter', 'hand:s1')
    expect(play(s0, id).rejection?.code).toBe('E_BAD_PAYLOAD')
    const r = play(s0, id, { equipTo: 'sv.ashley' })
    expect(types(r.events)).toEqual(expect.arrayContaining(['CardPlayed', 'CardEquipped']))
    expect(r.events.find((e) => e.type === 'CardPlayed')).toMatchObject({ to: 'equipped' })
    expect(r.state.survivors['sv.ashley']!.equipped).toEqual([id])
    expect(r.state.waste).not.toContain(id)
  })

  it('CARD-004 handOff moves an equipped item to a survivor at the same location only', () => {
    let s = makeState()
    const a = addCard(s, 'it.lighter', 'equipped:sv.ashley'); s = a.state
    const hand = addCard(s, 'it.lighter', 'hand:s1'); s = hand.state
    const ho = (cardId: string, to: string) => handOff(s, act(s, 'handOff', { cardId, toSurvivorId: to }) as HandOffAction)
    const ok = ho(a.id, 'sv.mike')
    expect(ok.events.find((e) => e.type === 'CardHandedOff')).toMatchObject({ fromSurvivorId: 'sv.ashley', toSurvivorId: 'sv.mike' })
    expect(ok.state.survivors['sv.mike']!.equipped).toEqual([a.id])
    expect(ho(a.id, 'sv.spare').state.survivors['sv.spare']!.equipped).toEqual([a.id])
    s = setSurvivor(s, 'sv.mike', { location: 'loc.school' })
    expect(ho(a.id, 'sv.mike').rejection?.code).toBe('E_WRONG_LOCATION')
    expect(ho(hand.id, 'sv.spare').rejection?.code).toBe('E_NOT_EQUIPPED')
    const onOther = addCard(s, 'it.lighter', 'equipped:sv.sparky'); s = onOther.state
    expect(ho(onOther.id, 'sv.spare').rejection?.code).toBe('E_NOT_YOUR_SURVIVOR')
  })

  it('CARD-005 the Lighter\'s once-per-round use travels with the card instance', () => {
    let s = makeState()
    const l = addCard(s, 'it.lighter', 'equipped:sv.ashley'); s = l.state
    s = addCard(s, 'it.fuel', 'hand:s1').state
    s = { ...s, locations: { ...s.locations, colony: { ...s.locations.colony!, entrances: s.locations.colony!.entrances.map((e, i) => (i === 0 ? { ...e, zombies: 5 } : e)) } } }
    const d = findDescriptor(s, 'sv.ashley', 'burn')!
    const used = activateDescriptor(s, d)
    expect(used.rejection).toBeUndefined()
    expect(used.events.filter((e) => e.type === 'ZombieKilled')).toHaveLength(4)
    expect(used.events.some((e) => e.type === 'ExposureRolled')).toBe(false) // noExposure
    let after = used.state
    after = handOff(after, act(after, 'handOff', { cardId: l.id, toSurvivorId: 'sv.mike' }) as HandOffAction).state
    const again = activateDescriptor(after, findDescriptor(after, 'sv.mike', 'burn')!)
    expect(again.rejection?.code).toBe('E_ABILITY_USED')
    // the next round resets the count
    const fresh = resetRoundUses(addCard(after, 'it.fuel', 'hand:s2').state)
    expect(activateDescriptor(fresh, findDescriptor(fresh, 'sv.mike', 'burn')!).rejection).toBeUndefined()
  })

  it('CARD-006 a survivor who dies at the colony returns the equipped card to the owner\'s hand', () => {
    let s = makeState()
    const l = addCard(s, 'it.lighter', 'equipped:sv.ashley'); s = l.state
    const r = routines.killSurvivor(s, 'sv.ashley', 'wounds')
    expect(r.events.find((e) => e.type === 'EquippedReturned')).toMatchObject({ to: 'hand' })
    expect(r.state.seats.s1!.hand).toContain(l.id)
  })

  it('CARD-007 a survivor who dies away from the colony shuffles the equipped card into that location\'s deck', () => {
    let s = makeState()
    s = setSurvivor(s, 'sv.ashley', { location: 'loc.gas' })
    const l = addCard(s, 'it.lighter', 'equipped:sv.ashley'); s = l.state
    const r = routines.killSurvivor(s, 'sv.ashley', 'wounds')
    expect(r.events.find((e) => e.type === 'EquippedReturned')).toMatchObject({ to: 'deck' })
    expect(r.events.some((e) => e.type === 'DeckShuffled')).toBe(true)
    expect(r.state.locations['loc.gas']!.deck).toContain(l.id)
  })

  it('CARD-008 a declined request raises requestResponse for the other seat and returns to the requester', () => {
    const s = makeState()
    const r = request(s, act(s, 'request', { to: 's2', symbol: 'medicine' }) as RequestAction)
    expect(types(r.events)).toContain('RequestMade')
    expect(r.pending).toMatchObject({ kind: 'requestResponse', seat: 's2' })
    expect(request(s, act(s, 'request', { to: 's1' }) as RequestAction).rejection?.code).toBe('E_SELF_TARGET')
    const d = respondRequest(r.state, act(r.state, 'respondRequest', { give: null }) as RespondRequestAction)
    expect(d.events.find((e) => e.type === 'RequestAnswered')).toMatchObject({ cardId: null })
    expect(d.pending).toBeUndefined() // the caller raises s1's next turnAction
  })

  it('CARD-020 one request addressed to every other player asks the seats in turn until one gives (R p11)', () => {
    let s = makeState()
    s = setSurvivor(s, 'sv.ashley', { wounds: 1 })
    const m = addCard(s, 'it.medicine', 'hand:s3'); s = m.state
    const r = request(s, act(s, 'request', { to: 'all', symbol: 'medicine' }) as RequestAction)
    expect(r.events.filter((e) => e.type === 'RequestMade')).toHaveLength(1)
    expect(r.pending).toMatchObject({ kind: 'requestResponse', seat: 's2' })
    const d = respondRequest(r.state, act(r.state, 'respondRequest', { give: null }, 's2') as RespondRequestAction)
    expect(d.pending).toMatchObject({ kind: 'requestResponse', seat: 's3' }) // s2 declined: s3 is asked next
    const g = respondRequest(d.state, act(d.state, 'respondRequest', { give: m.id }, 's3') as RespondRequestAction)
    expect(types(g.events)).toEqual(expect.arrayContaining(['CardGiven', 'CardPlayed']))
    expect(g.state.request).toBeNull()
  })

  it('CARD-009 a given card is revealed and played at once for the requester; it never enters their hand', () => {
    let s = makeState()
    s = setSurvivor(s, 'sv.ashley', { wounds: 1 })
    const m = addCard(s, 'it.medicine', 'hand:s2'); s = m.state
    const req = request(s, act(s, 'request', { to: 's2', symbol: 'medicine' }) as RequestAction)
    expect(req.pending!.options!.map((o) => o.id)).toContain(m.id)
    let r = respondRequest(req.state, act(req.state, 'respondRequest', { give: m.id }, 's2') as RespondRequestAction)
    expect(types(r.events)).toEqual(expect.arrayContaining(['RequestAnswered', 'CardGiven', 'CardPlayed']))
    // two wounded survivors would ask for a target; here Ashley is the only one, so it resolved at once
    expect(r.pending).toBeUndefined()
    expect(r.state.survivors['sv.ashley']!.wounds).toBe(0)
    expect(r.state.seats.s1!.hand).not.toContain(m.id)
    expect(r.state.seats.s2!.hand).not.toContain(m.id)
    expect(r.state.waste[0]).toBe(m.id)
    expect(r.rejection).toBeUndefined()
    r = respondRequest(req.state, act(req.state, 'respondRequest', { give: 'c:777' }, 's2') as RespondRequestAction)
    expect(r.rejection?.code).toBe('E_NOT_IN_HAND') // CARD-012
  })

  it('CARD-009 a played Medicine with two wounded survivors raises an itemTarget the requester answers', () => {
    let s = makeState()
    s = setSurvivor(s, 'sv.ashley', { wounds: 1 })
    s = setSurvivor(s, 'sv.spare', { wounds: 2 })
    const m = addCard(s, 'it.medicine', 'hand:s1'); s = m.state
    const r = play(s, m.id)
    expect(r.pending).toMatchObject({ kind: 'itemTarget', seat: 's1' })
    const opt = r.pending!.options!.find((o) => o.id === 'sv.spare')!
    const done = resumeEffects(r.state, opt.action)
    expect(done.rejection).toBeUndefined()
    expect(done.state.survivors['sv.spare']!.wounds).toBe(1)
    expect(types(done.events)).toContain('WoundHealed')
  })

  it('CARD-011 a given card named in contributeCrisis is rejected as already played', () => {
    let s = makeState()
    const m = addCard(s, 'it.food-1', 'hand:s2'); s = m.state
    const req = request(s, act(s, 'request', { to: 's2', symbol: 'food' }) as RequestAction)
    const given = respondRequest(req.state, act(req.state, 'respondRequest', { give: m.id }, 's2') as RespondRequestAction)
    const back = { ...given.state, pending: { ...req.state.pending, id: 'd:9', seat: 's1', kind: 'turnAction' as const, options: undefined } }
    const c = contributeCrisis(back, act(back, 'contributeCrisis', { cardIds: [m.id] }) as ContributeCrisisAction)
    expect(c.rejection?.code).toBe('E_REQUESTED_CARD')
  })

  it('CARD-013 an exiled seat may ask for a card and give one', () => {
    let s = makeState()
    s = setSeat(s, 's1', { seat: { ...s.seats.s1!.seat, exiled: true } })
    const m = addCard(s, 'it.food-1', 'hand:s2'); s = m.state
    const req = request(s, act(s, 'request', { to: 's2', symbol: 'food' }) as RequestAction)
    expect(req.rejection).toBeUndefined()
    const r = respondRequest(req.state, act(req.state, 'respondRequest', { give: m.id }, 's2') as RespondRequestAction)
    expect(r.rejection).toBeUndefined()
    expect(r.state.removed).toContain(m.id) // an exiled requester's played card is removed (CARD-016)
  })

  it('CARD-014 a Survivor item needs a free colony space and then adds a survivor at the colony', () => {
    let s = makeState()
    const o = addCard(s, 'it.outsiders', 'hand:s1'); s = o.state
    const full = { ...s, locations: { ...s.locations, colony: { ...s.locations.colony!, capacity: { ...s.locations.colony!.capacity, survivors: 5 } } } }
    expect(play(full, o.id).rejection?.code).toBe('E_NO_SPACE')
    const ok = play(s, o.id)
    expect(ok.events.find((e) => e.type === 'SurvivorAdded')).toMatchObject({ source: 'item', location: 'colony' })
    expect(ok.state.removed).toContain(o.id)
  })

  it('CARD-015 an exiled seat placing a new survivor answers an effectChoice with code exiledSurvivorPlacement', () => {
    let s = makeState()
    s = setSeat(s, 's1', { seat: { ...s.seats.s1!.seat, exiled: true } })
    const o = addCard(s, 'it.outsiders', 'hand:s1'); s = o.state
    const r = play(s, o.id)
    expect(r.pending).toMatchObject({ kind: 'effectChoice', seat: 's1' })
    expect((r.pending!.context.data as { code: string }).code).toBe('exiledSurvivorPlacement')
    const done = resumeEffects(r.state, r.pending!.options!.find((x) => x.id === 'loc.gas')!.action)
    expect(done.events.find((e) => e.type === 'SurvivorAdded')).toMatchObject({ location: 'loc.gas' })
  })

  it('CARD-016 an exiled seat\'s played card goes to removed, never to the waste pile', () => {
    let s = makeState()
    s = setSeat(s, 's1', { seat: { ...s.seats.s1!.seat, exiled: true } })
    const f = addCard(s, 'it.food-3', 'hand:s1'); s = f.state
    const r = play(s, f.id)
    // R15.4: the exiled seat picks the printed effect or +1 on a die; with no unused die there is only the effect
    expect(r.events.find((e) => e.type === 'CardPlayed')).toMatchObject({ to: 'removed' })
    expect(r.state.waste).not.toContain(f.id)
    expect(r.state.removed).toContain(f.id)
    expect(r.state.food).toBe(7) // CARD-017: Food 3 adds three tokens
  })

  it('CRIS-001 contributing from hand moves the card onto the crisis pile; CRIS-002 equipped cards too', () => {
    let s = makeState()
    const h = addCard(s, 'it.fuel', 'hand:s1'); s = h.state
    const e = addCard(s, 'it.lighter', 'equipped:sv.ashley'); s = e.state
    const r = contributeCrisis(s, act(s, 'contributeCrisis', { cardIds: [h.id, e.id] }) as ContributeCrisisAction)
    expect(r.events.filter((x) => x.type === 'CardContributed').map((x) => (x as { from: string }).from)).toEqual(['hand', 'equipped'])
    expect(r.state.crisis.contributions).toEqual([{ seat: 's1', cardId: h.id }, { seat: 's1', cardId: e.id }])
    expect(r.state.survivors['sv.ashley']!.equipped).toEqual([])
    expect(r.state.seats.s1!.hand).toEqual([])
  })

  it('CRIS-003 an unknown card is E_NOT_IN_HAND and an exiled seat gets E_EXILED', () => {
    let s = makeState()
    expect(contributeCrisis(s, act(s, 'contributeCrisis', { cardIds: ['c:404'] }) as ContributeCrisisAction).rejection?.code).toBe('E_NOT_IN_HAND')
    s = setSeat(s, 's1', { seat: { ...s.seats.s1!.seat, exiled: true } })
    expect(contributeCrisis(s, act(s, 'contributeCrisis', { cardIds: ['c:404'] }) as ContributeCrisisAction).rejection?.code).toBe('E_EXILED')
  })
})
