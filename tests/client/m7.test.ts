// M7 client polish: the structured feed, the recap story, variants and tiers on the start screen, tips, palettes, effects maths, votes.
import { describe, expect, it } from 'vitest'
import {
  createGame, legalActions, redactEvent, step, view, type Action, type GameEvent, type GameSetup,
} from '../../src/engine/index'
import { createRandomDecider } from '../../src/ai/random'
import { FeedBuilder, applyFeedPatches, arrangeFeed, headingOf, joinsGroup, type FeedEntry } from '../../src/client/presentation/feedModel'
import { COLONY_STEP_TITLE, feedLine, type Names } from '../../src/client/presentation/feed'
import { flashFor, oddsLine } from '../../src/client/presentation/director'
import { buildStory, parseSuspicion, suspicionAbout, type StoryInput } from '../../src/client/recap/story'
import {
  DEFAULT_VARIANT_CHOICE, TIER_INFO, buildSetup, checkVariants, choiceFromVariants, parseUrl, parseVariants, tiersFromModule,
} from '../../src/client/launch'
import { TIPS, pickTip } from '../../src/client/ui/tipsModel'
import { effectVoteLabels, effectVoteSource, isEffectVote } from '../../src/client/ui/voteModel'
import { PALETTES, SEAT_COLOURS, SEAT_MARKS, seatColour, seatMark } from '../../src/client/table/seats'
import { DEFAULT_SETTINGS, PALETTE_IDS, sanitizeSettings } from '../../src/client/store/settingsStore'
import { ambientFxOn, flakeAt, flicker, shadowsOn, FX_FPS } from '../../src/client/vfx/fx'
import { frostStrength } from '../../src/client/vfx/overlayMath'
import { rollRemaining } from '../../src/client/dice/RollingDie'
import { ballotAction, isHumanDecision, isHumanTieBreaker, tiebreakSeatOf, useGameStore } from '../../src/client/store/gameStore'
import { loadFixtureBundle } from '../fixtures/loadFixtureBundle'
import { loadDefaultBundle } from '../../tools/default-bundle'
import { setupFor } from '../../tools/sim-core'

const N: Names = {
  seat: (s) => `seat ${s}`, survivor: (s) => s.replace('sv.', ''), loc: (s) => s.replace('loc.', ''), item: (s) => s.replace('it.', ''), crisis: (s) => s.replace('cr.', ''),
  objective: (s) => s.replace('obj.main.', ''), option: (_c, o) => `option text ${o}`,
}
const POST = { phase: 'colony', roundNumber: 2, activeSeat: 's1', colonyStep: 'resolveCrisis' } as const

async function collectEvents(seed: string, setup: GameSetup, max = 900): Promise<GameEvent[]> {
  let r = createGame(setup, seed, loadFixtureBundle())
  const out: GameEvent[] = [...r.events]
  const dec = createRandomDecider(seed)
  for (let i = 0; i < max && r.state.phase !== 'ended'; i++) {
    const pd = r.state.pending
    const seat = pd.seat === 'all' ? r.state.seatOrder[0]! : pd.seat
    const a: Action = await dec.decide(view(r.state, seat), pd, legalActions(r.state))
    r = step(r.state, a)
    out.push(...r.events)
  }
  return out
}

function feedOf(events: GameEvent[], ctxFor: (e: GameEvent) => object = () => ({})): { entries: FeedEntry[] } {
  const b = new FeedBuilder()
  let entries: FeedEntry[] = []
  events.forEach((ev, i) => {
    const red = redactEvent(ev, 's1')
    if (!red) return
    const r = b.add(red, i + 1, POST, N, ctxFor(red))
    entries = applyFeedPatches([...entries, ...r.entries], r.patches)
  })
  return { entries }
}

describe('feed headings', () => {
  it('groups by round, then turn, and starts a header per colony step', () => {
    expect(headingOf({ phase: 'setup', roundNumber: 0, activeSeat: null, colonyStep: null }, N)).toMatchObject({ round: null, turn: 'Setup' })
    expect(headingOf({ phase: 'playerTurns', roundNumber: 3, activeSeat: 's2', colonyStep: null }, N)).toMatchObject({ round: 3, turn: "seat s2's turn", key: "Round 3: seat s2's turn" })
    expect(headingOf(POST, N)).toMatchObject({ round: 2, turn: 'Colony phase', step: 'Step 3: the crisis resolves' })
    for (const step of ['payFood', 'checkWaste', 'resolveCrisis', 'addZombies', 'checkObjective', 'roundTick', 'passToken']) expect(COLONY_STEP_TITLE[step], step).toMatch(/^Step \d/)
    expect(headingOf({ phase: 'ended', roundNumber: 5, activeSeat: null, colonyStep: null }, N).round).toBeNull()
  })
})

describe('feed breakdowns', () => {
  const crisisEvents: GameEvent[] = [
    { type: 'CrisisRevealed', cardId: 'cr.blizzard', prevent: ['fuel'], roundNumber: 2 },
    { type: 'CrisisCardRevealed', cardId: 'c:1', defId: 'it.fuel', points: 1, runningTotal: 1 },
    { type: 'CrisisCardRevealed', cardId: 'c:2', defId: 'it.junk', points: -1, runningTotal: 0 },
    { type: 'CrisisCardRevealed', cardId: 'c:3', defId: 'it.fuel', points: 1, runningTotal: 1 },
    { type: 'CrisisResolved', cardId: 'cr.blizzard', total: 1, needed: 3, prevented: false, bonus: false, cards: 3 },
    { type: 'CrisisEffectApplied', cardId: 'cr.blizzard', kind: 'fail' } as GameEvent,
    { type: 'MoraleChanged', delta: -1, after: 5, reason: 'crisisFailed' },
    { type: 'FirstSeatPassed', from: 's1', to: 's2' },
  ]
  it('a crisis reveal lists each card with the running total against the target, then the verdict and the morale change', () => {
    const { entries } = feedOf(crisisEvents, (e) => (e.type === 'CrisisCardRevealed' ? { crisisNeeded: 3, crisisName: 'Blizzard' } : e.type === 'CrisisResolved' ? { crisisNeeded: 3, crisisName: 'Blizzard' } : {}))
    const head = entries.find((e) => e.group === 'crisis')!
    expect(head.text).toBe('Blizzard: the crisis cards are revealed (the colony needs 3 points).')
    expect(head.chip).toEqual({ text: 'NOT PREVENTED', tone: 'bad' })
    const kids = entries.filter((e) => e.parent === head.seq)
    expect(kids.map((k) => k.text)).toEqual([
      'Card 1: fuel +1. Running total 1 of 3.', 'Card 2: junk -1. Running total 0 of 3.', 'Card 3: fuel +1. Running total 1 of 3.',
      'cr.blizzard: total 1 of 3 needed from 3 cards - NOT prevented.'.replace('cr.blizzard', 'blizzard'), 'blizzard: the failure effect applies.', 'Morale -1 to 5 (the crisis was not prevented).',
    ])
    expect(kids[0]!.running).toMatchObject({ running: 1, needed: 3, points: 1, index: 1 })
    // the next unrelated line is not part of the group
    expect(entries[entries.length - 1]!.parent).toBeUndefined()
  })
  it('an exposure roll shows the face with the odds it had; a death updates the head', () => {
    const odds = { blank: 0.5, wound: 0.25, frostbite: 1 / 6, bite: 1 / 12, pDeath: 1 / 12 }
    const events: GameEvent[] = [
      { type: 'ExposureRolled', rollId: 'r:1', survivorId: 'sv.sparky', reason: 'zombieKill', raw: 12, face: 'bite' },
      { type: 'SurvivorKilled', survivorId: 'sv.sparky', owner: 's1', location: 'loc.library', cause: 'bite', moraleLoss: true, wasLeader: false },
      { type: 'MoraleChanged', delta: -1, after: 4, reason: 'survivorKilled' },
    ]
    const { entries } = feedOf(events, (e) => (e.type === 'ExposureRolled' ? { exposure: odds } : {}))
    const head = entries[0]!
    expect(head.group).toBe('exposure')
    expect(head.text).toBe('sparky rolls the exposure die (killing a zombie): BITE.')
    expect(head.odds).toMatchObject({ blank: 0.5, wound: 0.25, bite: 1 / 12, face: 'bite', raw: 12 })
    expect(head.chip).toEqual({ text: 'sparky DIES', tone: 'bad' })
    expect(entries.slice(1).every((e) => e.parent === head.seq)).toBe(true)
    expect(oddsLine(odds)).toBe('50% blank, 25% wound, 17% frostbite, 8% bite')
  })
  it('zombie placement is shown step by step with the entrance, the barricade broken and the overrun victim', () => {
    const events: GameEvent[] = [
      { type: 'ZombiesToAdd', location: 'colony', count: 3, source: 'colonyStep', survivors: 5 },
      { type: 'ZombieAdded', location: 'colony', entrance: 2, source: 'colonyStep', zombies: 1 },
      { type: 'BarricadeDestroyed', location: 'colony', entrance: 3, barricades: 0 },
      { type: 'EntranceOverrun', location: 'colony', entrance: 4, killed: 'sv.rook' },
      { type: 'SurvivorKilled', survivorId: 'sv.rook', owner: 's2', location: 'colony', cause: 'overrun', moraleLoss: true, wasLeader: false },
    ]
    const { entries } = feedOf(events)
    expect(entries[0]).toMatchObject({ group: 'zombies', text: '3 zombies to place at the Colony (5 survivors there).'.replace('the Colony', 'colony') })
    const kids = entries.filter((e) => e.parent === entries[0]!.seq).map((k) => k.text)
    expect(kids[0]).toBe('Gate 2: a zombie takes a space (1 there).')
    expect(kids[1]).toBe('Gate 3: a barricade is broken (0 left).')
    expect(kids[2]).toBe('Gate 4 is overrun: rook dies.')
    expect(entries[0]!.chip).toEqual({ text: '1 placed, 1 barricade broken, 1 overrun', tone: 'bad' })
  })
  it('a vote groups its ballots and result under the call', () => {
    const { entries } = feedOf([
      { type: 'VoteCalled', caller: 's1', target: 's2' }, { type: 'VotesCast', target: 's2', votes: { s1: true, s3: false } },
      { type: 'VoteResult', target: 's2', yes: 1, no: 1, exiled: true, tiebreakBy: 's1' }, { type: 'SeatExiled', seat: 's2', objectiveId: 'obj.ex.a' },
    ])
    expect(entries[0]!.group).toBe('vote')
    expect(entries[0]!.chip?.text).toBe('EXILED')
    expect(entries.slice(1).every((e) => e.parent === entries[0]!.seq)).toBe(true)
    expect(joinsGroup('vote', { type: 'TurnStarted', seat: 's1', turnCount: 1, roundNumber: 1 } as GameEvent)).toBe(false)
  })
  it('arrangeFeed nests children under their head and keeps table talk (no round or turn) with the group before it', () => {
    const { entries } = feedOf([
      { type: 'ZombiesToAdd', location: 'colony', count: 1, source: 'colonyStep', survivors: 2 },
      { type: 'ZombieAdded', location: 'colony', entrance: 1, source: 'colonyStep', zombies: 1 },
    ])
    const talk: FeedEntry = { seq: 1_000_001, text: 'Rook: "grim"', turnKey: entries[0]!.turnKey, tone: 'normal' }
    const more = feedOf([{ type: 'ZombieAdded', location: 'colony', entrance: 2, source: 'colonyStep', zombies: 1 }]).entries
    const rounds = arrangeFeed([entries[0]!, talk, { ...entries[1]!, seq: 5 }, ...more.map((e) => ({ ...e, seq: 6 }))])
    expect(rounds).toHaveLength(1)
    expect(rounds[0]!.turns).toHaveLength(1)
    const items = rounds[0]!.turns[0]!.items
    expect(items[0]!.entry.group).toBe('zombies')
    expect(items.find((i) => i.entry.seq === 1_000_001)).toBeDefined()
  })
  it('the real games the fixture plays produce well-formed groups: every child has a head, no undefined text', async () => {
    for (const seed of ['m7a', 'm7b']) {
      const events = await collectEvents(seed, setupFor(3, 'random'))
      const { entries } = feedOf(events)
      const heads = new Set(entries.filter((e) => e.group).map((e) => e.seq))
      for (const e of entries) {
        expect(e.text, `${e.seq}`).not.toMatch(/undefined|NaN|\[object/)
        if (e.parent !== undefined) expect(heads.has(e.parent), `${e.seq} parent`).toBe(true)
      }
      expect(arrangeFeed(entries).length).toBeGreaterThan(0)
      // every ExposureRolled that is not part of a bite chain opens its own group
      const rolls = events.filter((e) => e.type === 'ExposureRolled' && e.reason !== 'biteChain' && redactEvent(e, 's1')).length
      expect(entries.filter((e) => e.group === 'exposure').length).toBe(rolls)
    }
  })
  it('crossroads lines name the card and the option taken', () => {
    expect(feedLine({ type: 'CrossroadsTriggered', cardId: 'xr.hunted', holder: 's2', forSeat: 's1', window: 'action.move' }, N)).toBe('Crossroads: xr.hunted comes up for seat s1.')
    expect(feedLine({ type: 'CrossroadsResolved', cardId: 'xr.hunted', forSeat: 's1', optionId: 'up', forced: false }, N)).toBe('seat s1 chooses: "option text up".')
    expect(feedLine({ type: 'CrossroadsResolved', cardId: 'xr.hunted', forSeat: 's1', optionId: '', forced: true }, N)).toBe('seat s1 has only one way out: nothing can happen.')
  })
  it('hit flashes: kills, wounds, frostbite, bites and deaths', () => {
    expect(flashFor({ type: 'ZombieKilled', location: 'colony', entrance: 1, zombies: 0 } as GameEvent)).toBe('kill')
    expect(flashFor({ type: 'WoundTaken', survivorId: 'sv.a', kind: 'wound', wounds: 1, frostbite: 0, source: 'exposure' })).toBe('wound')
    expect(flashFor({ type: 'WoundTaken', survivorId: 'sv.a', kind: 'frostbite', wounds: 0, frostbite: 1, source: 'exposure' })).toBe('frostbite')
    expect(flashFor({ type: 'ExposureRolled', rollId: 'r', survivorId: 'sv.a', reason: 'move', raw: 12, face: 'bite' })).toBe('bite')
    expect(flashFor({ type: 'ExposureRolled', rollId: 'r', survivorId: 'sv.a', reason: 'move', raw: 1, face: 'blank' })).toBeNull()
    expect(flashFor({ type: 'SurvivorKilled', survivorId: 'sv.a', owner: 's1', location: 'colony', cause: 'bite', moraleLoss: true, wasLeader: false })).toBe('death')
  })
})

describe('recap story', () => {
  const input = (over: Partial<StoryInput> = {}): StoryInput => ({
    seatOrder: ['s1', 's2'],
    seatName: (s) => (s === 's1' ? 'You' : 'Rook'),
    secret: (s) => (s === 's1' ? { id: 'obj.sec.a', exiledId: null, outcome: 'won' } : { id: 'obj.bet.b', exiledId: null, outcome: 'lost' }),
    objective: (id) => (id === 'obj.sec.a'
      ? { id, name: 'Medic', kind: 'secret', complete: true, requiresMain: true, parts: [{ label: 'medicine cards in your hand', have: 3, need: 3 }], goal: 'Hold 3 medicine.' }
      : { id, name: 'Saboteur', kind: 'betrayal', complete: false, requiresMain: false, parts: [], goal: 'Ruin it.' }),
    contributions: [
      { roundNumber: 1, crisisId: 'cr.x', crisisName: 'Blizzard', result: { total: 2, needed: 2, prevented: true, bonus: false }, revealed: [{ seat: 's1', points: 1, cardName: 'Fuel' }, { seat: 's2', points: -1, cardName: 'Junk' }] },
      { roundNumber: 2, crisisId: 'cr.y', crisisName: 'Raiders', result: { total: 0, needed: 2, prevented: false, bonus: false }, revealed: [{ seat: 's2', points: -1, cardName: 'Junk' }, { seat: 's2', points: -1, cardName: 'Junk' }] },
    ],
    crossroads: [{ roundNumber: 2, cardName: 'Hunted', forSeat: 's2', holder: 's1', triggered: true, optionId: 'up', optionText: 'Take the gun.' }, { roundNumber: 3, cardName: 'Quiet', forSeat: 's1', holder: 's2', triggered: false, optionId: null, optionText: '' }],
    exiledSeats: [], mainComplete: true, suspicion: null, ...over,
  })
  it('tells each seat what they were really doing', () => {
    const [you, rook] = buildStory(input())
    expect(you!.lines[0]).toBe('You was secretly after Medic. The goal was met.')
    expect(you!.helped).toBe(1)
    expect(you!.hurt).toBe(0)
    expect(rook!.betrayer).toBe(true)
    expect(rook!.lines[0]).toBe('Rook was the betrayer. Secret goal: Saboteur. The betrayal did not succeed.')
    expect(rook!.hurt).toBe(3)
    expect(rook!.crisis.map((c) => `${c.crisis}: ${c.verdict}`)).toEqual(['Blizzard: prevented', 'Raiders: not prevented'])
    expect(rook!.crossroads).toEqual([{ round: 2, card: 'Hunted', text: 'Take the gun.' }])
    expect(you!.crossroads).toEqual([]) // an untriggered card is not a choice
  })
  it("words another seat's progress as theirs, not yours", () => {
    const [you, rook] = buildStory(input({
      viewer: 's1', objective: (id) => ({ id, name: 'X', kind: 'secret', complete: false, requiresMain: false, parts: [{ label: 'fuel cards in your hand', have: 1, need: 2 }], goal: '' }),
      secret: () => ({ id: 'obj.sec.a', exiledId: null }),
    }))
    expect(you!.lines[1]).toBe('fuel cards in your hand: 1 of 2.')
    expect(rook!.lines[1]).toBe('fuel cards in their hand: 1 of 2.')
  })
  it('says when a secret goal only counts with the main objective, and skips suspicion when the AI exposes none', () => {
    const [you] = buildStory(input({ mainComplete: false, secret: () => ({ id: 'obj.sec.a', exiledId: null }) }))
    expect(you!.lines[0]).toContain('only counts with the main objective, which was not completed')
    expect(you!.suspicion).toEqual([])
  })
  it('shows the suspicion trajectory when it is present', () => {
    const t = parseSuspicion({ s1: [{ round: 1, scores: { s2: 0.2 } }, { round: 2, scores: { s2: 0.6 } }], s2: [{ round: 1, scores: { s2: 0.9 } }] })!
    expect(suspicionAbout('s2', t)).toEqual([{ round: 1, average: 0.2 }, { round: 2, average: 0.6 }]) // the seat's own view of itself is left out
    const [, rook] = buildStory(input({ suspicion: t }))
    expect(rook!.lines.at(-1)).toBe('By round 2 the table suspected Rook at 60%.')
  })
  it('drops an off-shape suspicion log', () => {
    expect(parseSuspicion(null)).toBeNull()
    expect(parseSuspicion({ s1: 'nope' })).toBeNull()
    expect(parseSuspicion({ s1: [{ round: 'x', scores: {} }] })).toBeNull()
    expect(parseSuspicion({ s1: [{ round: 1, scores: { s2: 7 } }] })!['s1']![0]!.scores['s2']).toBe(1)
  })
})

describe('start screen variants and tiers', () => {
  it('co-op, two-player, hardcore, betrayer, elimination and the mature toggle map to the engine flags; mature is ON by default', () => {
    expect(DEFAULT_VARIANT_CHOICE.includeMature).toBe(true)
    expect(checkVariants(3, DEFAULT_VARIANT_CHOICE).variants).toEqual({}) // nothing removed: all 80 Crossroads cards
    expect(checkVariants(3, { ...DEFAULT_VARIANT_CHOICE, includeMature: false }).variants).toEqual({ removeMature: true })
    expect(checkVariants(3, { ...DEFAULT_VARIANT_CHOICE, hardcore: true, betrayer: true, playerElimination: true }).variants).toEqual({ hardcore: true, betrayer: true, playerElimination: true })
    expect(checkVariants(3, { ...DEFAULT_VARIANT_CHOICE, coop: true }).variants).toEqual({ coop: true })
  })
  it('two seats are the two-player game; the betrayer variant cannot join co-op or two-player', () => {
    const two = checkVariants(1, { ...DEFAULT_VARIANT_CHOICE, hardcore: true })
    expect(two.variants).toEqual({ twoPlayer: true })
    expect(two.errors).toEqual([])
    expect(two.notes.join(' ')).toContain('two-player co-op game')
    expect(checkVariants(1, { ...DEFAULT_VARIANT_CHOICE, betrayer: true }).errors[0]).toContain('betrayer variant')
    expect(checkVariants(3, { ...DEFAULT_VARIANT_CHOICE, coop: true, betrayer: true }).errors).toHaveLength(1)
    expect(checkVariants(5, DEFAULT_VARIANT_CHOICE).errors[0]).toContain('2 to 5')
    expect(checkVariants(0, DEFAULT_VARIANT_CHOICE).errors).toHaveLength(1)
  })
  it('the setup the client builds passes the engine own validation for every offered combination', () => {
    const bundle = loadDefaultBundle()
    for (const bots of [1, 2, 3, 4]) {
      for (const choice of [DEFAULT_VARIANT_CHOICE, { ...DEFAULT_VARIANT_CHOICE, betrayer: true }, { ...DEFAULT_VARIANT_CHOICE, coop: true }, { ...DEFAULT_VARIANT_CHOICE, hardcore: true, playerElimination: true, includeMature: false }]) {
        const check = checkVariants(bots, choice)
        if (check.errors.length) continue
        const setup = buildSetup({ seats: ['human', ...Array.from({ length: bots }, () => 'bot' as const)], variants: check.variants }, 'random')
        const r = createGame(setup, 'v1', bundle)
        expect(r.rejection, JSON.stringify(check.variants)).toBeUndefined()
      }
    }
  })
  it('reads variants and tiers from the URL, and the variant choice round-trips', () => {
    expect(parseVariants('coop,hardcore,elimination,bogus', '0')).toEqual({ coop: true, hardcore: true, playerElimination: true, removeMature: true })
    expect(parseVariants(null, null)).toBeUndefined()
    expect(parseUrl('?seats=human,bot,bot&variants=betrayer&tier=hard').variants).toEqual({ betrayer: true })
    expect(parseUrl('?seats=human,bot,bot&tier=hard').tier).toBe('hard')
    expect(choiceFromVariants({ removeMature: true, betrayer: true })).toMatchObject({ includeMature: false, betrayer: true, coop: false })
  })
  it('lists the tiers an AI module exports and falls back to Normal and Random without one', () => {
    expect(tiersFromModule({}).map((t) => t.id)).toEqual(['normal', 'random'])
    expect(tiersFromModule(null).map((t) => t.id)).toEqual(['normal', 'random'])
    expect(tiersFromModule({ AI_TIERS: ['hard', 'easy', 'normal', 'random'] }).map((t) => t.id)).toEqual(['easy', 'normal', 'hard', 'random'])
    expect(tiersFromModule({ TIERS: [{ id: 'easy' }, { id: 'normal' }, { id: 'bogus' }] }).map((t) => t.id)).toEqual(['easy', 'normal'])
    expect(tiersFromModule({ AI_TIERS: ['hard'] }).map((t) => t.id)).toEqual(['normal', 'hard']) // Normal is always offered
    for (const t of Object.values(TIER_INFO)) expect(t.blurb.length).toBeGreaterThan(10)
  })
})

describe('tutorial tips', () => {
  it('shows the first unseen tip for the situation and none when tips are off or all are seen', () => {
    expect(pickTip({ humanKind: 'turnAction', crisisCards: 0, exposureSeen: false }, [])?.id).toBe('turn')
    expect(pickTip({ humanKind: 'turnAction', crisisCards: 0, exposureSeen: false }, ['turn'])?.id).toBe('keys')
    expect(pickTip({ humanKind: 'turnAction', crisisCards: 0, exposureSeen: false }, ['turn', 'keys'])).toBeNull()
    expect(pickTip({ humanKind: 'turnAction', crisisCards: 0, exposureSeen: false }, [], false)).toBeNull()
    expect(pickTip({ humanKind: null, crisisCards: 0, exposureSeen: false }, [])).toBeNull()
    expect(pickTip({ humanKind: null, crisisCards: 2, exposureSeen: true }, [])?.id).toBe('exposure')
    expect(pickTip({ humanKind: 'votes', crisisCards: 0, exposureSeen: false }, [])?.id).toBe('vote')
    expect(new Set(TIPS.map((t) => t.id)).size).toBe(TIPS.length)
  })
  it('"replay tutorial tips" is clearing the seen list: settings keep and sanitise it', () => {
    expect(sanitizeSettings({ tipsSeen: ['turn', 5 as never] }).tipsSeen).toEqual(['turn'])
    expect(sanitizeSettings({ tipsSeen: [] }).tipsSeen).toEqual([])
    expect(DEFAULT_SETTINGS.tips).toBe(true)
  })
})

describe('settings, palettes and effects', () => {
  it('seat colours: three sets, five colours each, the colour-blind-safe set carries a shape mark', () => {
    expect([...PALETTE_IDS]).toEqual(['default', 'alt', 'cbsafe'])
    for (const id of PALETTE_IDS) { expect(PALETTES[id].colours).toHaveLength(5); expect(new Set(PALETTES[id].colours).size).toBe(5) }
    expect(PALETTES.default.colours).toEqual([...SEAT_COLOURS])
    expect(seatColour(['a', 'b'], 'b', 'cbsafe')).toBe(PALETTES.cbsafe.colours[1])
    expect(seatMark(['a', 'b'], 'b', 'cbsafe')).toBe(SEAT_MARKS[1])
    expect(seatMark(['a', 'b'], 'b', 'default')).toBe('')
    expect(new Set(SEAT_MARKS).size).toBe(5)
    expect(sanitizeSettings({ palette: 'cbsafe' }).palette).toBe('cbsafe')
    expect(sanitizeSettings({ palette: 'neon' as never }).palette).toBe('default')
  })
  it('Low graphics turns off the particles and the shadows; reduced motion turns off the ambient effects', () => {
    expect(ambientFxOn('high', false)).toBe(true)
    expect(ambientFxOn('low', false)).toBe(false)
    expect(ambientFxOn('high', true)).toBe(false)
    expect(shadowsOn('high')).toBe(true)
    expect(shadowsOn('low')).toBe(false)
    expect(FX_FPS).toBeLessThanOrEqual(30) // ambient effects ask for frames at a throttled rate, never at the display rate
  })
  it('snowflakes fall, wrap and sway; the firelight stays in range and varies', () => {
    const seed = { x: 3, y: 10, z: -4, speed: 3, sway: 1, phase: 0.5 }
    expect(flakeAt(seed, 0, 40).y).toBeCloseTo(10)
    expect(flakeAt(seed, 1, 40).y).toBeCloseTo(7)
    expect(flakeAt(seed, 4, 40).y).toBeCloseTo(38) // wrapped to the top
    const vals = Array.from({ length: 200 }, (_, i) => flicker(i * 0.05))
    expect(Math.min(...vals)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...vals)).toBeLessThanOrEqual(1)
    expect(new Set(vals.map((v) => v.toFixed(2))).size).toBeGreaterThan(20)
  })
  it('the frost vignette grows as morale falls', () => {
    expect(frostStrength(10)).toBe(0)
    expect(frostStrength(7)).toBe(0)
    expect(frostStrength(6)).toBeGreaterThan(0)
    expect(frostStrength(3)).toBeGreaterThan(frostStrength(5))
    expect(frostStrength(0)).toBe(1)
    expect(frostStrength(Number.NaN)).toBe(0)
  })
  it('a roll animates for its beat length and is over after it', () => {
    expect(rollRemaining(1000, 700, 1200)).toBe(500)
    expect(rollRemaining(1000, 700, 1800)).toBe(0)
    expect(rollRemaining(1000, 0, 1000)).toBe(0) // instant speed: no animation
  })
})

describe('votes', () => {
  const pd = (data: object) => ({ id: 'd:9', seat: 'all', kind: 'votes', window: 'action.callVote', context: { seatId: 's2', data }, canPass: false })
  const setStore = (viewer: string, data: object, over: object = {}): void => {
    useGameStore.setState({
      state: { seats: { s1: { seat: { kind: 'human' } }, s2: { seat: { kind: 'bot' } }, s3: { seat: { kind: 'bot' } } } } as never,
      pending: pd(data) as never, viewer, botVotes: {}, humanBallot: null, ...over,
    })
  }
  it('an exiled first player who must break a tie gets a ballot, and the castVotes carries the tie answer', () => {
    setStore('s1', { eligible: ['s2', 's3'], tiebreakSeat: 's1', caller: 's2', target: 's3' }, { botVotes: { s2: true, s3: false } })
    expect(tiebreakSeatOf(useGameStore.getState().pending!)).toBe('s1')
    expect(isHumanDecision()).toBe(true)
    expect(isHumanTieBreaker()).toBe(true)
    expect(ballotAction()).toBeNull() // the bot driver cannot send the ballot before the human answers
    const yes = ballotAction(true)!
    expect(yes).toMatchObject({ type: 'castVotes', seat: 'all', votes: { s2: true, s3: false, s1: true } })
    expect((ballotAction(false) as { votes: Record<string, boolean> }).votes['s1']).toBe(false)
    // once the answer is held in the store the bot driver's own call sends it
    useGameStore.setState({ humanBallot: { id: 'd:9', yes: true } })
    expect((ballotAction() as { votes: Record<string, boolean> }).votes['s1']).toBe(true)
    expect(isHumanDecision()).toBe(false) // answered: the dock closes while the bots finish
  })
  it('a human voter is asked as before; a bot first player gets no ballot form', () => {
    setStore('s1', { eligible: ['s1', 's2', 's3'] })
    expect(isHumanDecision()).toBe(true)
    expect(isHumanTieBreaker()).toBe(false)
    setStore('s1', { eligible: ['s1', 's3'], tiebreakSeat: 's2' }) // s2 is a bot
    expect(isHumanTieBreaker()).toBe(false)
    expect((ballotAction(true) as { votes: Record<string, boolean> }).votes).toEqual({ s1: true, s3: false, s2: false })
  })
  it('a Crossroads group vote names its card and answers from the decision itself (the vote node and the card that raised it)', () => {
    const pd = { context: { data: { code: 'effectVote', eligible: ['s1', 's2'], cont: { jobs: [{ t: 'run', work: [{ node: { op: 'vote', options: [{ id: 'yes', label: 'Send them out' }, { id: 'no', label: 'Let them stay' }] } }], rc: { sourceId: 'xr.helpless', sourceKind: 'crossroads' } }] } } } }
    expect(effectVoteSource(pd)).toEqual({ cardId: 'xr.helpless', yes: 'Send them out', no: 'Let them stay' })
    // without the continuation it falls back to the card record and the card the log names
    expect(effectVoteSource({ context: { data: { code: 'effectVote' } } }, { options: [{ id: 'a', effect: [{ op: 'vote', options: [{ label: 'Up' }, { label: 'Down' }] }] }] }, 'xr.guess')).toEqual({ cardId: 'xr.guess', yes: 'Up', no: 'Down' })
    expect(effectVoteSource({ context: {} })).toEqual({ cardId: null, yes: 'Yes', no: 'No' })
  })
  it('the feed words a card vote as a table vote (nobody is exiled) and an exile vote as before', () => {
    const card = feedOf([{ type: 'VotesCast', target: 's2', votes: { s1: true, s2: false } }, { type: 'VoteResult', target: 's2', yes: 1, no: 1, exiled: false, tiebreakBy: 's1' }])
    expect(card.entries.map((e) => e.text)).toEqual(['Ballots: seat s1 yes, seat s2 no.', 'The table votes: 1 yes, 1 no (tie broken by seat s1).'])
    expect(card.entries.every((e) => e.group === undefined)).toBe(true)
  })
  it('a Crossroads group vote reads its Yes and No from the card, and is told apart from an exile vote', () => {
    const card = { options: [{ id: 'up', effect: [{ op: 'vote', options: [{ id: 'yes', label: 'Let her fly' }, { id: 'no', label: 'Keep her on the ground' }] }] }, { id: 'down', effect: [] }] }
    expect(effectVoteLabels(card)).toEqual({ yes: 'Let her fly', no: 'Keep her on the ground' })
    expect(effectVoteLabels(undefined)).toEqual({ yes: 'Yes', no: 'No' })
    expect(effectVoteLabels({ options: [{ id: 'a', effect: [{ op: 'choose', options: [{ effect: [{ op: 'vote', options: [{ label: 'A' }, { label: 'B' }] }] }] }] }] })).toEqual({ yes: 'A', no: 'B' })
    expect(isEffectVote({ kind: 'votes', context: { data: { code: 'effectVote' } } }, true)).toBe(true)
    expect(isEffectVote({ kind: 'votes', context: { data: {} } }, true)).toBe(false)
    expect(isEffectVote({ kind: 'votes', context: { data: {} } }, false)).toBe(true)
  })
})
