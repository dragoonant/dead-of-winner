import { beforeEach, describe, expect, it } from 'vitest'
import {
  createGame, legalActions, redactEvent, step, view, type Action, type GameEvent, type GameEventType, type GameSetup, type RollPurpose,
} from '../../src/engine/index'
import { createRandomDecider } from '../../src/ai/random'
import { BEAT_SPEC, buildBeats, totalMs } from '../../src/client/presentation/beats'
import { rollFromEvent } from '../../src/client/presentation/director'
import { ROLL_PURPOSE_LABEL, SILENT_EVENT_TYPES, feedLine, rollPurposeLabel, type Names } from '../../src/client/presentation/feed'
import { sanitizeSettings, scaled } from '../../src/client/store/settingsStore'
import { buildSetup, parseUrl, requestFromUrl, resolveObjective } from '../../src/client/launch'
import { loadFixtureBundle } from '../fixtures/loadFixtureBundle'
import { setupFor } from '../../tools/sim-core'

const N: Names = { seat: (s) => `seat ${s}`, survivor: (s) => s.replace('sv.', ''), loc: (s) => s.replace('loc.', ''), item: (s) => s.replace('it.', ''), crisis: (s) => s.replace('cr.', ''), objective: (s) => s.replace('obj.main.', '') }

async function collectEvents(seed: string, setup: GameSetup, max = 500): Promise<GameEvent[]> {
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

describe('event feed', () => {
  it('has a line for every event type of real games (or the type is deliberately silent), with no holes in the text', async () => {
    const lines = new Map<GameEventType, (string | null)[]>()
    for (const seed of ['f1', 'f2', 'f3', 'f4']) for (const ev of await collectEvents(seed, setupFor(3, 'random'))) lines.set(ev.type, [...(lines.get(ev.type) ?? []), feedLine(ev, N)])
    expect(lines.size).toBeGreaterThan(25)
    for (const [type, ls] of lines) {
      if (SILENT_EVENT_TYPES.includes(type)) { expect(ls.every((l) => l === null), type).toBe(true); continue }
      expect(ls.some((l) => typeof l === 'string'), type).toBe(true)
      for (const l of ls) if (l !== null) expect(l, type).not.toMatch(/undefined|NaN|\[object/)
    }
  })

  it('crisis reveals carry the running total, exposure rolls name the face, zombies are placed one by one', () => {
    expect(feedLine({ type: 'CrisisCardRevealed', cardId: 'c:1', defId: 'it.fuel', points: 1, runningTotal: 2 }, N)).toBe('Crisis card: fuel (+1), running total 2.')
    expect(feedLine({ type: 'ExposureRolled', rollId: 'r:1', survivorId: 'sv.sparky', reason: 'move', raw: 7, face: 'frostbite' }, N)).toBe('Exposure roll for sparky: FROSTBITE (move).')
    expect(feedLine({ type: 'ZombieAdded', location: 'colony', entrance: 3, source: 'colonyStep', zombies: 2 }, N)).toBe('A zombie arrives at the Colony, gate 3 (2 there).')
  })

  it('redaction hides what the viewer must not see before a line is made', async () => {
    const evs = await collectEvents('f5', setupFor(3, 'random'), 60)
    const secret = evs.find((e) => e.type === 'SecretObjectiveDealt' && e.seat === 's2')
    expect(secret).toBeDefined()
    expect(redactEvent(secret!, 's1')).toBeNull()
  })
})

describe('beats', () => {
  const seq = (events: GameEvent[]) => events.map((event, i) => ({ seq: i + 1, event }))
  it('timed events take the spec durations and untimed runs collapse into one instant beat', () => {
    const beats = buildBeats(seq([
      { type: 'DeckShuffled', location: 'colony', reason: 'setup' }, { type: 'EffectExpired', effectId: 'e:1', reason: 'duration' },
      { type: 'CrisisRevealed', cardId: 'cr.blizzard', prevent: ['fuel'], roundNumber: 1 },
      { type: 'CrisisCardRevealed', cardId: 'c:1', defId: 'it.fuel', points: 1, runningTotal: 1 },
      { type: 'CrisisCardRevealed', cardId: 'c:2', defId: 'it.junk', points: -1, runningTotal: 0 },
      { type: 'CrisisResolved', cardId: 'cr.blizzard', total: 0, needed: 3, prevented: false, bonus: false, cards: 2 },
    ]), N)
    expect(beats.map((b) => b.kind)).toEqual(['instant', 'banner', 'crisisCard', 'crisisCard', 'banner'])
    expect(beats.map((b) => b.baseMs)).toEqual([0, 1200, 500, 500, 1000])
    expect(beats[1]!.banner?.text).toBe('Crisis: blizzard')
    expect(totalMs(beats)).toBe(3200)
    expect(BEAT_SPEC.ZombieAdded?.ms).toBe(250)
  })
  it('the animation speed scales a duration and instant is zero', () => {
    expect(scaled(800, 2)).toBe(400)
    expect(scaled(800, 0.5)).toBe(1600)
    expect(scaled(800, 0)).toBe(0)
  })
})

describe('dice tray', () => {
  it('every RollPurpose has a label and an unknown one renders generically', () => {
    const purposes: RollPurpose[] = ['actionDice', 'exposure', 'attackSurvivor', 'noise', 'objective', 'crisis', 'crossroads', 'item', 'ability', 'other']
    for (const p of purposes) expect(ROLL_PURPOSE_LABEL[p], p).toBeTruthy()
    expect(rollPurposeLabel('somethingNew')).toBe('Roll')
  })
  it('roll events become tray rolls with the engine verdict word', () => {
    const r = rollFromEvent({ type: 'ExposureRolled', rollId: 'r:1', survivorId: 'sv.sparky', reason: 'zombieKill', raw: 9, face: 'bite' }, N, 1, 0, 900)
    expect(r?.verdict).toBe('BITE')
    expect(rollFromEvent({ type: 'NoiseRolled', location: 'loc.library', rollId: 'r:2', die: 2, zombie: true }, N, 2, 0, 700)?.verdict).toBe('ZOMBIE')
    expect(rollFromEvent({ type: 'DiceRolled', rollId: 'r:3', purpose: 'objective', seat: 's1', dice: [4], total: 4, target: 5 }, N, 3, 0, 700)).toMatchObject({ dice: [4], target: 5, purpose: 'objective' })
    expect(rollFromEvent({ type: 'TurnEnded', seat: 's1', turnCount: 1 }, N, 4, 0, 0)).toBeNull()
  })
})

describe('launch options and settings', () => {
  beforeEach(() => undefined)
  it('parses the URL parameters and builds a setup with one human first', () => {
    const o = parseUrl('?seed=abc&seats=human,bot,bot,bot&objective=samples&test=1&fps&speed=0')
    expect(o).toMatchObject({ seed: 'abc', seats: ['human', 'bot', 'bot', 'bot'], objective: 'samples', test: true, fps: true, speed: 0 })
    expect(parseUrl('?seats=human').seats).toBeUndefined()
    expect(requestFromUrl(o, () => 'x')).toMatchObject({ seed: 'abc', objective: 'samples' })
    const setup = buildSetup({ seats: o.seats! }, 'obj.main.x')
    expect(setup.seats.map((s) => s.id)).toEqual(['s1', 's2', 's3', 's4'])
    expect(setup.seats.map((s) => s.kind)).toEqual(['human', 'bot', 'bot', 'bot'])
    expect(buildSetup({ seats: ['human', 'bot'] }, 'x').variants?.twoPlayer).toBe(true)
  })
  it('resolves an objective by id or a word of its name and sanitises stored settings', () => {
    const list = [{ id: 'obj.main.we-need-more-samples', name: 'We Need More Samples' }]
    expect(resolveObjective('samples', list)).toBe('obj.main.we-need-more-samples')
    expect(resolveObjective('nonsense', list)).toBeNull()
    expect(sanitizeSettings({ speed: 99, graphics: 'ultra' as never })).toMatchObject({ speed: 1, graphics: 'high' })
    expect(sanitizeSettings({ speed: 0, leftCollapsed: true })).toMatchObject({ speed: 0, leftCollapsed: true })
  })
})
