import { describe, expect, it } from 'vitest'
import { AI_TIERS, createDecider, suspicionTrajectory } from '../../src/ai/index'
import { betrayalHoard, betrayalNeeds, betrayalProgress } from '../../src/ai/normal/info'
import { crossroadsValue, effectVoteEdge, victoryPenalty } from '../../src/ai/normal/options'
import { afford, estimateYes, thresholdOf } from '../../src/ai/normal/votes'
import { blendScalars, getPersona } from '../../src/ai/personas'
import { createGame, legalActions, view, type Action, type GameState } from '../../src/engine/index'
import { DEFAULT_OPTIONS, runGame } from '../../tools/sim-core'
import { loadDefaultBundle } from '../../tools/default-bundle'

const bundle = loadDefaultBundle()
const opts = { ...DEFAULT_OPTIONS, seats: 4, objective: 'obj.main.we-need-more-samples' }
const SEATS = ['s1', 's2', 's3', 's4']
const rec = (id: string) => bundle.byId[id] as unknown as Record<string, unknown> | undefined
const fakeView = (over: Record<string, unknown> = {}) => ({
  seat: 's1', seatOrder: SEATS, morale: 6, roundsLeft: 4, roundNumber: 3, survivors: {}, objective: { id: 'obj.main.x', side: 'normal', counters: {}, cards: [], complete: false },
  setup: { seats: SEATS.map((id) => ({ id })) },
  seats: Object.fromEntries(SEATS.map((s) => [s, { seat: { exiled: false, eliminated: false }, dice: [1, 2, 3, 4].map((n) => ({ id: `${s}${n}`, value: n, used: false })) }])),
  ...over,
}) as never

describe('AI-014 the four tiers', () => {
  it('the module lists easy, normal, hard and random for the start screen', () => {
    expect([...AI_TIERS].sort()).toEqual(['easy', 'hard', 'normal', 'random'])
  })

  it('every tier plays whole games the engine accepts: no violations, no leaks, no stalls', async () => {
    for (const tier of ['easy', 'normal', 'hard', 'random'] as const) {
      for (let i = 0; i < 3; i++) {
        const g = await runGame(bundle, `ai14-${tier}-${i}`, i, { ...opts, tier })
        expect(g.ended, `${tier} game ${i} ended`).toBe(true)
        expect(g.violations.map((v) => `${v.kind}: ${v.message}`), tier).toEqual([])
        expect(g.leaks, tier).toEqual([])
      }
    }
  })

  it('hard is deterministic, and the planner tiers differ in what they do', async () => {
    const a = await runGame(bundle, 'ai14-det', 0, { ...opts, tier: 'hard' })
    const b = await runGame(bundle, 'ai14-det', 0, { ...opts, tier: 'hard' })
    expect([a.rounds, a.decisions, a.endReason, a.finalMorale]).toEqual([b.rounds, b.decisions, b.endReason, b.finalMorale])
    const easy = await runGame(bundle, 'ai14-det', 0, { ...opts, tier: 'easy' })
    expect(easy.decisions).not.toBe(a.decisions)
  })

  it('easy never asks another seat for a card and never calls a vote; normal and hard do ask', async () => {
    let easyAsks = 0
    let easyCalls = 0
    let normalAsks = 0
    for (let i = 0; i < 6; i++) {
      const e = await runGame(bundle, `ai14-ask-${i}`, i, { ...opts, tier: 'easy' })
      easyAsks += e.tally['act:request'] ?? 0
      easyCalls += e.tally['act:callVote'] ?? 0
      normalAsks += (await runGame(bundle, `ai14-ask-${i}`, i, { ...opts, tier: 'normal' })).tally['act:request'] ?? 0
    }
    expect(easyAsks).toBe(0)
    expect(easyCalls).toBe(0)
    expect(normalAsks).toBeGreaterThan(0)
  })

  it('easy plays its persona at half strength', () => {
    const s = getPersona('ps.hardcase')!.scalars
    const half = blendScalars(s, 0.5)
    expect(half.paranoia).toBeLessThan(s.paranoia)
    expect(half.paranoia).toBeGreaterThan(1)
    expect(blendScalars(s, 1)).toBe(s)
  })
})

describe('AI-015 vote rules (40 §8.4)', () => {
  it('the colony affords an exile only with morale 3+ and no more than a third of the table dice lost, unless the end is near or the objective nearly done', () => {
    expect(afford(fakeView({ morale: 2 }), 's2')).toBe(false)
    expect(afford(fakeView(), 's2')).toBe(true) // four equal seats: a quarter of the dice
    const heavy = fakeView({ seats: Object.fromEntries(SEATS.map((s) => [s, { seat: { exiled: false, eliminated: false }, dice: Array.from({ length: s === 's2' ? 8 : 2 }, (_x, i) => ({ id: `${s}${i}`, value: 3, used: false })) }])) })
    expect(afford(heavy, 's2')).toBe(false) // 8 of 14 dice
    expect(afford({ ...(heavy as object), roundsLeft: 1 } as never, 's2')).toBe(true)
    expect(afford(fakeView({ roundsLeft: 1 }), 's2')).toBe(true)
  })

  it('a call needs the estimated yes votes to reach a majority: the seats whose threshold the shared evidence clears', () => {
    const v = fakeView()
    const strong = estimateYes(v, 's1', 's2', 0.95, 0.85)
    const weak = estimateYes(v, 's1', 's2', 0.5, 0.85)
    expect(strong.yes).toBeGreaterThanOrEqual(strong.needed)
    expect(weak.yes).toBeLessThan(weak.needed)
    expect(thresholdOf(fakeView({ setup: { seats: [{ id: 's2', persona: 'ps.hardcase' }] } }), 's2')).toBeCloseTo(0.48)
  })

  it('an exiled first player is asked for the tie-break through the extra ballot key, and the bot answers for it', async () => {
    const st = createGame({ seats: SEATS.map((id) => ({ id, kind: 'bot' as const })), mainObjective: opts.objective }, 'ai15', bundle).state
    const d = createDecider('normal', undefined, 'ai15')
    const ballot = (votes: Record<string, boolean>): Action => ({ type: 'castVotes', decisionId: 'd:vote', seat: 'all', votes })
    const legal: Action[] = []
    for (let m = 0; m < 16; m++) legal.push(ballot({ s2: !!(m & 1), s3: !!(m & 2), s4: !!(m & 4), s1: !!(m & 8) }))
    const pending = { id: 'd:vote', seat: 'all', kind: 'votes', window: 'turn.action', canPass: false, context: { data: { target: 's3', eligible: ['s2', 's3', 's4'], tiebreakSeat: 's1' } } } as never
    const pick = await d.decide(view(st as GameState, 's1'), pending, legal)
    expect(pick.type).toBe('castVotes')
    expect(legal).toContain(pick)
    expect('s1' in (pick as Extract<Action, { type: 'castVotes' }>).votes).toBe(true)
  })

  it('a vote raised by a Crossroads card is read from its two outcomes: Army tribute beats the ambush, and the Deputy deal is refused', () => {
    const v = fakeView({ crossroads: { active: { cardId: 'xr.army' } }, survivors: Object.fromEntries(Array.from({ length: 9 }, (_x, i) => [`sv.${i}`, { status: 'alive', location: 'colony' }])) })
    const edge = effectVoteEdge(v, rec)
    expect(edge).not.toBeNull()
    expect(edge!).toBeGreaterThan(0)
    const take = crossroadsValue(fakeView(), 'xr.the-deputy', 'take-the-deal', rec)
    const refuse = crossroadsValue(fakeView(), 'xr.the-deputy', 'keep-your-guns', rec)
    expect(take).toBeLessThan(refuse)
    expect(victoryPenalty({ test: 'foodAtLeast', value: 5 })).toBeGreaterThan(0)
  })
})

describe('AI-016 the betrayal card is read from the bundle', () => {
  const betrayerView = (objective: string) => {
    const st = createGame({ seats: SEATS.map((id) => ({ id, kind: 'bot' as const })), mainObjective: opts.objective }, 'ai16', bundle).state
    const patched: GameState = { ...st, seats: { ...st.seats, s1: { ...st.seats['s1']!, secretObjectiveId: objective } } }
    return view(patched, 's1')
  }

  it('Gluttony wants six food cards beyond the starting ones; a loyal seat has no needs', () => {
    const needs = betrayalNeeds(betrayerView('obj.betrayal.gluttony'))
    expect(needs?.hand).toEqual({ food: 6 })
    expect(needs?.excludeStarter).toBe(true)
    expect(betrayalNeeds(betrayerView('obj.secret.hoarder'))).toBeNull()
    expect(betrayalProgress(betrayerView('obj.betrayal.gluttony'))).toBe(0) // starter food does not count
    expect(betrayalHoard(betrayerView('obj.betrayal.gluttony')).size).toBe(0)
  })

  it('Trigger Happy wants four weapons carried, Mad Scientist two medicine and two tools with two survivors', () => {
    expect(betrayalNeeds(betrayerView('obj.betrayal.trigger-happy'))?.weapons).toBe(4)
    const mad = betrayalNeeds(betrayerView('obj.betrayal.mad-scientist'))
    expect(mad?.hand).toEqual({ medicine: 2, tool: 2 })
    expect(mad?.aliveMin).toBe(2)
  })
})

describe('AI-017 the suspicion log the recap reads', () => {
  it('suspicionTrajectory(seed) lists, per observer seat, the score of every other seat after each crisis', async () => {
    const seed = 'ai17-0'
    const g = await runGame(bundle, seed, 0, { ...opts, tier: 'normal' })
    expect(g.ended).toBe(true)
    const t = suspicionTrajectory(`${seed}`)
    expect(Object.keys(t).length).toBeGreaterThan(0)
    for (const [observer, points] of Object.entries(t)) {
      expect(points.length).toBeGreaterThan(0)
      for (const p of points) {
        expect(p.round).toBeGreaterThanOrEqual(1)
        expect(observer in p.scores).toBe(false)
        for (const x of Object.values(p.scores)) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(1) }
      }
    }
  })
})

describe('AI-018 the engine still accepts what a hard bot answers on the first decisions', () => {
  it('chooseSurvivors and chooseLeader answers are legal', async () => {
    const st = createGame({ seats: SEATS.map((id) => ({ id, kind: 'bot' as const })), mainObjective: opts.objective }, 'ai18', bundle).state
    const d = createDecider('hard', 'ps.kid', 'ai18')
    const legal = legalActions(st)
    const pick = await d.decide(view(st, st.pending.seat as string), st.pending, legal)
    expect(legal).toContain(pick)
  })
})
