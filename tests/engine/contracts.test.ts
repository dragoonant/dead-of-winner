import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as engine from '../../src/engine/index'
import {
  ACTION_KINDS, ANSWERS_BY_KIND, DECISION_KINDS, DSL_EVENT_MAP, DSL_EVENT_NAMES, collectBallots,
  createRng, eventForSeat, exposureOdds, faceOfD12, resolveAiBudgetMs, rngFromState,
  scriptRemaining, scriptedRng, type EngineEvent,
} from '../../src/engine/index'

const schema = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../docs/spec/schemas/effect.schema.json', import.meta.url)), 'utf8'),
) as { $defs: Record<string, { enum?: string[] }> }

describe('engine contracts (00-architecture)', () => {
  it('ARCH-001 rng is deterministic per seed and resumes exactly from a snapshot', () => {
    const a = createRng(42)
    const b = createRng(42)
    const seqA = Array.from({ length: 50 }, () => a.d6())
    expect(Array.from({ length: 50 }, () => b.d6())).toEqual(seqA)
    expect(Array.from({ length: 50 }, () => createRng(43).d6())).not.toEqual(seqA)
    expect(createRng('42').float()).not.toBe(createRng(42).float())
    const snap = JSON.parse(JSON.stringify(a.state()))
    const tail = [a.int(1000), a.d12(), a.shuffle([1, 2, 3, 4, 5])]
    const r = rngFromState(snap)
    expect([r.int(1000), r.d12(), r.shuffle([1, 2, 3, 4, 5])]).toEqual(tail)
  })

  it('ARCH-002 rng distribution is sane (d6, d12 faces, shuffle)', () => {
    const rng = createRng('dist')
    const n = 60000
    const d6 = [0, 0, 0, 0, 0, 0]
    const faces = { blank: 0, wound: 0, frostbite: 0, bitten: 0 }
    for (let i = 0; i < n; i++) {
      const v = rng.d6()
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(6)
      d6[v - 1]! += 1
      faces[faceOfD12(rng.d12())] += 1
    }
    for (const c of d6) expect(Math.abs(c - n / 6)).toBeLessThan(n / 6 * 0.05)
    expect(faces.blank / n).toBeCloseTo(6 / 12, 1)
    expect(faces.wound / n).toBeCloseTo(3 / 12, 1)
    expect(faces.frostbite / n).toBeCloseTo(2 / 12, 1)
    expect(faces.bitten / n).toBeCloseTo(1 / 12, 1)
    const firstPos = [0, 0, 0, 0]
    for (let i = 0; i < 8000; i++) firstPos[rng.shuffle([0, 1, 2, 3])[0]!]! += 1
    for (const c of firstPos) expect(Math.abs(c - 2000)).toBeLessThan(200)
  })

  it('ARCH-003 scripted rng replays queues in order and reports leftovers', () => {
    const r = scriptedRng({ d6: [6, 1], d12: ['bitten', 'blank', 8], pick: [2] })
    expect([r.d6(), r.d6()]).toEqual([6, 1])
    expect([r.d12(), r.d12(), r.d12()].map(faceOfD12)).toEqual(['bitten', 'blank', 'wound'])
    expect(scriptRemaining(r.state())).toEqual({ d6: 0, d12: 0, pick: 1 })
    expect(r.pick(['a', 'b', 'c'])).toBe('c')
    expect(() => r.d6()).toThrow(engine.ScriptExhausted)
    const withFallback = scriptedRng({}, 7)
    expect(withFallback.d6()).toBe(createRng(7).d6())
  })

  it('ARCH-004 frozen modules export the API and enums agree with the DSL schema', () => {
    for (const name of ['createEngine', 'stateHash', 'eventsForSeat', 'fallbackAnswer', 'defineHooks', 'canonicalJson', 'sameAnswer'] as const) {
      expect(typeof engine[name]).toBe('function')
    }
    const e = engine.createEngine({ version: 't', hash: 'h', locations: [], survivors: [], items: [], crises: [], crossroads: [], objectives: [], personas: [] })
    for (const m of ['newGame', 'step', 'pending', 'legalActions', 'view', 'eventsFor', 'preview', 'replay', 'save', 'load'] as const) {
      expect(typeof e[m]).toBe('function')
    }
    expect([...ACTION_KINDS].sort()).toEqual([...(schema.$defs.ActionKind!.enum ?? [])].sort())
    expect([...DSL_EVENT_NAMES].sort()).toEqual([...(schema.$defs.EventName!.enum ?? [])].sort())
    expect(Object.keys(DSL_EVENT_MAP).sort()).toEqual([...DSL_EVENT_NAMES].sort())
    expect(Object.keys(ANSWERS_BY_KIND).sort()).toEqual([...DECISION_KINDS].sort())
    expect(ANSWERS_BY_KIND.turnAction).toContain('endTurn')
  })

  it('ARCH-005 event redaction, ballots, AI budget and exposure odds helpers', () => {
    const drawn: EngineEvent = { seq: 1, round: 1, type: 'CardDrawn', seat: 's0', from: 'police', reason: 'search', card: 'item.police.x@1', vis: { redact: ['card'], except: ['s0'] } }
    expect(eventForSeat(drawn, 's0')).toHaveProperty('card', 'item.police.x@1')
    expect(eventForSeat(drawn, 's1')).not.toHaveProperty('card')
    expect(eventForSeat({ ...drawn, vis: { to: ['s0'] } }, 's1')).toBeNull()
    expect(collectBallots(['s0', 's1'], [{ type: 'ballot', seat: 's1', vote: 'no' }, { type: 'ballot', seat: 's0', vote: 'yes' }]))
      .toEqual({ type: 'castVotes', votes: { s0: 'yes', s1: 'no' } })
    expect(() => collectBallots(['s0', 's1'], [{ type: 'ballot', seat: 's0', vote: 'yes' }])).toThrow()
    expect(resolveAiBudgetMs({})).toBe(250)
    expect(resolveAiBudgetMs({ DOW_AI_BUDGET_MS: '0' })).toBe(0)
    expect(resolveAiBudgetMs({ DOW_AI_BUDGET_MS: 'abc' })).toBe(250)
    const plain = exposureOdds('move')
    expect(plain.bitten).toBeCloseTo(1 / 12)
    const sparky = exposureOdds('move', { replace: [{ from: 'bitten', to: 'wound' }] })
    expect(sparky.bitten).toBe(0)
    expect(sparky.wound).toBeCloseTo(4 / 12)
    expect(exposureOdds('kill', { skip: ['kill'] }).blank).toBe(1)
  })
})
