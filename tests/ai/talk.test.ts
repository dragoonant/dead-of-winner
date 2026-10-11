import { describe, expect, it } from 'vitest'
import { PERSONAS, getPersona } from '../../src/ai/personas'
import { TALK_KEYS, classOf, createTalker, leanKey, pickLine, resetTalkMemory } from '../../src/ai/talk'
import { personaLineId } from '../../src/client/audio/personaVoice'
import { DEFAULT_PERSONAS, buildSetup } from '../../src/client/launch'

const SLOTS = new Set(['seat', 'survivor', 'location', 'symbol', 'n', 'entrance', 'crisis', 'objective'])
/** 41 §3: how many lines each key carries per persona (the table's "Lines / persona" column; the three M4 personas also keep their two legacy keys). */
const LINES_PER_KEY: Record<string, number> = {
  'round.start': 2, 'crisis.revealed': 2, 'crisis.contributed': 2, 'crisis.prevented': 2, 'crisis.bonus': 1, 'crisis.failed': 2, 'crisis.shortfall': 2,
  'vote.called.me': 2, 'vote.called.other': 1, 'vote.lean.yes': 2, 'vote.lean.no': 2, 'vote.lean.silent': 1, 'vote.passed': 1, 'vote.failed': 1,
  'exiled.me': 2, 'exiled.other': 1, 'request.made': 2, 'request.give': 2, 'request.decline': 2, 'request.refused.me': 1,
  'search.noise': 1, 'move.out': 1, 'zombie.killed': 1, 'barricade.built': 1, 'exposure.wound': 1, 'exposure.bite': 2, 'bite.chain.kill': 1,
  'survivor.lost.other': 1, 'overrun': 1, 'food.short': 2, 'morale.low': 1, 'objective.progress': 1, 'crossroads.me': 1, 'accused.me': 3, 'accused.other': 1,
  'game.won': 1, 'game.lost': 1, 'idle': 1,
}

describe('AI-010 personas', () => {
  it('six personas in sheet order, every 41 key at its line count, scalars in range, original names', () => {
    expect(PERSONAS.map((p) => p.id)).toEqual(['ps.quartermaster', 'ps.optimist', 'ps.hardcase', 'ps.kid', 'ps.doctor', 'ps.drifter'])
    expect(PERSONAS.map((p) => p.name)).toEqual(['Vera Lindqvist', 'Teddy Marchbanks', 'Ruth Castellano', 'Jojo Pruitt', 'Dr. Anand Rao', 'Silas Crane'])
    for (const p of PERSONAS) {
      for (const [k, n] of Object.entries(LINES_PER_KEY)) expect(p.lines[k]?.length ?? 0, `${p.id} ${k}`).toBeGreaterThanOrEqual(n)
      for (const sym of ['weapon', 'fuel', 'education', 'food', 'medicine', 'tool', 'survivor']) expect(p.lines[`search.found.${sym}`]?.length, `${p.id} search.found.${sym}`).toBeGreaterThanOrEqual(1)
      const all = Object.values(p.lines).flat()
      expect(all.length, p.id).toBeGreaterThanOrEqual(55)
      expect(all.length, p.id).toBeLessThanOrEqual(75)
      for (const l of all) {
        expect(l.text.length).toBeLessThanOrEqual(90)
        for (const m of l.text.matchAll(/\{(\w+)\}/g)) expect(SLOTS.has(m[1]!), `${p.id}: slot ${m[1]}`).toBe(true)
      }
      const s = p.scalars
      for (const x of [s.generosity, s.risk, s.trust, s.chattiness, s.bluffing, s.voteThreshold, s.callThreshold]) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(1) }
      expect(s.paranoia).toBeGreaterThanOrEqual(0.5)
      expect(s.paranoia).toBeLessThanOrEqual(1.6)
    }
  })

  it('the scalars are the 41 sheet, so the personas tilt play differently', () => {
    const by = Object.fromEntries(PERSONAS.map((p) => [p.id.replace('ps.', ''), p.scalars]))
    expect(by['hardcase']!.paranoia).toBeGreaterThan(by['optimist']!.paranoia)
    expect(by['hardcase']!.voteThreshold).toBeLessThan(by['drifter']!.voteThreshold)
    expect(by['kid']!.risk).toBeGreaterThan(by['doctor']!.risk)
    expect(by['optimist']!.generosity).toBeGreaterThan(by['drifter']!.generosity)
    expect(by['drifter']!.bluffing).toBeGreaterThan(by['optimist']!.bluffing)
    expect(by['kid']!.chattiness).toBeGreaterThan(by['drifter']!.chattiness)
  })

  it('lines never name hidden state: no card ids, objectives, roles or hand talk', () => {
    const banned = /\b(c:\d+|secret|betray|traitor|objective|my hand|in my hand|crossroads card|cards?)\b/i
    for (const p of PERSONAS) for (const l of Object.values(p.lines).flat()) expect(banned.test(l.text), `${p.id}: ${l.text}`).toBe(false)
  })

  it('no two personas share a line, and none copies a line from the rulebook-style phrasing of another bank', () => {
    const seen = new Map<string, string>()
    for (const p of PERSONAS) for (const l of Object.values(p.lines).flat()) {
      if (l.text === '…') continue
      expect(seen.get(l.text), `${p.id}: "${l.text}" also in ${seen.get(l.text)}`).toBeUndefined()
      seen.set(l.text, p.id)
    }
  })

  it('the launch defaults mirror the persona data and hand out distinct personas in seat order', () => {
    expect(DEFAULT_PERSONAS.map((p) => [p.id, p.name])).toEqual(PERSONAS.map((p) => [p.id, p.name]))
    const setup = buildSetup({ seats: ['human', 'bot', 'bot', 'bot'] }, 'random')
    const bots = setup.seats.filter((s) => s.kind === 'bot')
    expect(new Set(bots.map((b) => b.persona)).size).toBe(3)
    expect(bots.every((b) => b.tier === 'normal')).toBe(true)
    const custom = buildSetup({ seats: ['human', 'bot'], bots: [{ persona: 'ps.hardcase', tier: 'random' }] }, 'random')
    expect(custom.seats[1]).toMatchObject({ persona: 'ps.hardcase', tier: 'random', name: 'Ruth Castellano' })
  })
})

describe('AI-012 voiced and text-only lines', () => {
  it('the 24 recorded lines of each M4 persona still resolve to their audio ids; every other line plays no clip', () => {
    for (const short of ['quartermaster', 'optimist', 'hardcase']) {
      const p = getPersona(short)!
      let voiced = 0
      for (const [key, bank] of Object.entries(p.lines)) {
        bank.forEach((line, i) => {
          const id = personaLineId(p.id, key, line.text)
          if (line.voiced) {
            voiced++
            expect(id, `${short} ${key}[${i}] keeps its audio id`).toBe(`pv-${short}-${key.replace(/\./g, '-')}-${i}`)
          } else expect(id, `${short} ${key}[${i}] is text-only`).toBeNull()
        })
      }
      expect(voiced).toBe(24)
    }
  })

  it('the new personas have no clips yet: every line is text-only', () => {
    for (const short of ['kid', 'doctor', 'drifter']) {
      const p = getPersona(short)!
      for (const [key, bank] of Object.entries(p.lines)) for (const line of bank) {
        expect(line.voiced, `${short} ${key}`).toBe(false)
        expect(personaLineId(p.id, key, line.text), `${short} ${key}: ${line.text}`).toBeNull()
      }
    }
  })
})

describe('AI-011 pickLine', () => {
  it('fills slots, skips lines whose slots it cannot fill, and does not repeat until the bank is used up', () => {
    resetTalkMemory()
    const p = getPersona('quartermaster')!
    const seen = new Set<string>()
    const n = p.lines['vote.lean.yes']!.length
    for (let i = 0; i < n; i++) {
      const t = pickLine(p, 'vote.lean.yes', { seat: 'Rook' }, 'seed')!
      expect(t).toContain('Rook')
      expect(t).not.toContain('{')
      seen.add(t)
    }
    expect(seen.size).toBe(n)
    expect(pickLine(p, 'vote.lean.yes', {}, 'seed')).toBeNull()
    expect(pickLine(p, 'no.such.key', {}, 'seed')).toBeNull()
  })

  it('is deterministic for the same seed after a reset', () => {
    const p = getPersona('ps.optimist')!
    resetTalkMemory()
    const a = [pickLine(p, 'turn.start', {}, 's'), pickLine(p, 'turn.start', {}, 's')]
    resetTalkMemory()
    const b = [pickLine(p, 'turn.start', {}, 's'), pickLine(p, 'turn.start', {}, 's')]
    expect(a).toEqual(b)
  })

  it('a key the persona has no bank for falls back to its alias (the first client wiring asked for turn.start and vote.called)', () => {
    resetTalkMemory()
    for (const short of ['kid', 'doctor', 'drifter']) {
      expect(pickLine(short, 'turn.start', { n: 3 }, 'x'), short).toBeTruthy()
      expect(pickLine(short, 'vote.called', { seat: 'Ash' }, 'x'), short).toContain('Ash')
    }
  })

  it('every key renders for every persona once its slots are given', () => {
    resetTalkMemory()
    const fills = { seat: 'Ash', survivor: 'Brook', location: 'the School', symbol: 'fuel', n: 3, entrance: 2, crisis: 'Blizzard', objective: 'Samples' }
    for (const p of PERSONAS) for (const k of TALK_KEYS) {
      const t = pickLine(p, k, fills, 'seed')
      expect(t, `${p.id} ${k}`).toBeTruthy()
      expect(t).not.toMatch(/[{}]/)
    }
  })
})

describe('AI-013 pacing (41 §4)', () => {
  it('a talker allows one main line, one reaction and one opinion per turn, and a chatty persona speaks often', () => {
    resetTalkMemory()
    const chatty = createTalker(getPersona('ps.kid'), 'g', 's2')
    let lines = 0
    for (let turn = 1; turn <= 40; turn++) {
      const main = [chatty.say('idle', {}, turn), chatty.say('zombie.killed', { location: 'the Library' }, turn)]
      expect(main.filter(Boolean).length).toBeLessThanOrEqual(1)
      const react = [chatty.say('crisis.failed', { n: 2 }, turn), chatty.say('crisis.prevented', { n: 4 }, turn)]
      expect(react.filter(Boolean).length).toBeLessThanOrEqual(1)
      lines += main.filter(Boolean).length + react.filter(Boolean).length
    }
    expect(lines / 40).toBeLessThanOrEqual(2) // a main line plus a reaction at most (41 §4); real turns rarely offer both
    expect(lines).toBeGreaterThan(15)
    expect(chatty.say('vote.lean.yes', { seat: 'Ash' }, 41, { force: true })).toBeTruthy()
  })

  it('a quiet persona speaks far less than a chatty one, and a key rests for two turns unless it is a reaction', () => {
    resetTalkMemory()
    const quiet = createTalker(getPersona('ps.drifter'), 'g', 's3')
    const loud = createTalker(getPersona('ps.kid'), 'g', 's2')
    let q = 0
    let l = 0
    for (let turn = 1; turn <= 60; turn++) {
      if (quiet.say('idle', {}, turn)) q++
      if (loud.say('idle', {}, turn)) l++
    }
    expect(l).toBeGreaterThan(q)
    resetTalkMemory()
    const t = createTalker(getPersona('ps.kid'), 'g', 's2')
    let first = -1
    for (let turn = 1; turn < 30 && first < 0; turn++) if (t.say('round.start', { n: 3 }, turn)) first = turn
    expect(first).toBeGreaterThan(0)
    expect(t.say('round.start', { n: 3 }, first + 1)).toBeNull()
  })

  it('leans always speak, and a persona with little to say states some of them as a silent beat', () => {
    resetTalkMemory()
    const drifter = getPersona('ps.drifter')!
    const t = createTalker(drifter, 'g', 's3')
    const said = new Set<string>()
    for (let turn = 1; turn <= 40; turn++) { const x = t.say('vote.lean.yes', { seat: 'Ash' }, turn, { always: true }); expect(x).toBeTruthy(); said.add(x!) }
    expect(said.has('…')).toBe(true)
    expect(leanKey(getPersona('ps.optimist'), true, 0.5)).toBe('vote.lean.yes')
    expect(leanKey(drifter, false, 0.99)).toBe('vote.lean.silent')
    expect(leanKey(drifter, false, 0.05)).toBe('vote.lean.no')
  })

  it('classifies keys', () => {
    expect(classOf('crisis.contributed')).toBe('claim')
    expect(classOf('search.found.fuel')).toBe('action')
    expect(classOf('crisis.failed')).toBe('reaction')
    expect(classOf('vote.lean.no')).toBe('opinion')
    expect(classOf('game.won')).toBe('end')
  })
})
