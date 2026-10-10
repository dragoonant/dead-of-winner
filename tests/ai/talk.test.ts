import { describe, expect, it } from 'vitest'
import { PERSONAS, getPersona } from '../../src/ai/personas'
import { createTalker, pickLine, resetTalkMemory } from '../../src/ai/talk'
import { DEFAULT_PERSONAS, buildSetup } from '../../src/client/launch'

const KEYS = ['crisis.prevented', 'crisis.failed', 'vote.called', 'vote.lean.yes', 'vote.lean.no', 'request.give', 'request.decline', 'exposure.bite', 'morale.low', 'game.won', 'game.lost', 'turn.start']
const SLOTS = new Set(['seat', 'survivor', 'location', 'symbol', 'n', 'entrance', 'crisis', 'objective'])

describe('AI-010 personas', () => {
  it('three personas, every required key, about twenty short lines, scalars in range', () => {
    expect(PERSONAS.map((p) => p.id)).toEqual(['ps.quartermaster', 'ps.optimist', 'ps.hardcase'])
    for (const p of PERSONAS) {
      for (const k of KEYS) expect(p.lines[k]?.length, `${p.id} ${k}`).toBeGreaterThanOrEqual(2)
      const all = Object.values(p.lines).flat()
      expect(all.length).toBeGreaterThanOrEqual(20)
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

  it('lines never name hidden state: no card ids, objectives, roles or hand talk', () => {
    const banned = /\b(c:\d+|secret|betray|traitor|objective|my hand|in my hand|crossroads card)\b/i
    for (const p of PERSONAS) for (const l of Object.values(p.lines).flat()) expect(banned.test(l.text), `${p.id}: ${l.text}`).toBe(false)
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

  it('a talker says at most one line per turn unless forced, and a chatty persona speaks often', () => {
    resetTalkMemory()
    const chatty = createTalker(getPersona('ps.optimist'), 'g', 's2')
    let lines = 0
    for (let turn = 1; turn <= 40; turn++) {
      const a = chatty.say('turn.start', {}, turn)
      const b = chatty.say('crisis.failed', { n: 2 }, turn)
      if (a) lines++
      if (b) lines++
      expect(a && b).toBeFalsy()
    }
    expect(lines).toBeLessThanOrEqual(40)
    expect(lines).toBeGreaterThan(15)
    expect(chatty.say('vote.lean.yes', { seat: 'Ash' }, 41, { force: true })).toContain('Ash')
  })
})
