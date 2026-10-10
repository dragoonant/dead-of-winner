import { describe, expect, it } from 'vitest'
import { applyBiteSpread, exposureOdds, exposureOddsFor, rollExposureFor, BITE_CHAIN_ODDS } from '../../src/engine/exposure'
import { EXPOSURE_FACE_COUNT, exposureFaceOf } from '../../src/engine/rng'
import { SCHOOL, forceRng, makeState, of, types } from './atk-fixture'

const school = (extra: Parameters<typeof makeState>[0]['survivors'] = []) =>
  [{ id: 'sv.ashley', owner: 's1', location: SCHOOL }, ...extra]

describe('exposure and the bite chain', () => {
  it('EXPO-001 raw d12 values map to 6/3/2/1 faces', () => {
    const faces = Array.from({ length: 12 }, (_, i) => exposureFaceOf(i + 1))
    expect(faces.filter((f) => f === 'blank')).toHaveLength(6)
    expect(faces.slice(6, 9)).toEqual(['wound', 'wound', 'wound'])
    expect(faces.slice(9, 11)).toEqual(['frostbite', 'frostbite'])
    expect(faces[11]).toBe('bite')
  })

  it('EXPO-002 a blank roll changes nothing', () => {
    const s = makeState({ survivors: school(), rng: forceRng([12, 3]) })
    const r = rollExposureFor(s, 'sv.ashley', 'zombieKill')
    expect(types(r.events)).toEqual(['ExposureRolled'])
    expect(r.state.survivors['sv.ashley']!.wounds).toBe(0)
  })

  it('EXPO-003 a wound face adds a wound token', () => {
    const s = makeState({ survivors: school(), rng: forceRng([12, 8]) })
    const r = rollExposureFor(s, 'sv.ashley', 'zombieKill')
    expect(of(r.events, 'WoundTaken')[0]).toMatchObject({ kind: 'wound', wounds: 1, frostbite: 0, source: 'exposure' })
  })

  it('EXPO-004 frostbite counts toward the three-wound kill', () => {
    const s = makeState({ survivors: [{ id: 'sv.ashley', owner: 's1', location: SCHOOL, wounds: 2 }, { id: 'sv.extra', owner: 's1', location: 'colony' }], rng: forceRng([12, 10]) })
    const r = rollExposureFor(s, 'sv.ashley', 'zombieKill')
    expect(of(r.events, 'WoundTaken')[0]).toMatchObject({ kind: 'frostbite', frostbite: 1 })
    expect(of(r.events, 'SurvivorKilled')[0]).toMatchObject({ survivorId: 'sv.ashley', cause: 'wounds' })
    const one = rollExposureFor(makeState({ survivors: school(), rng: forceRng([12, 10]) }), 'sv.ashley', 'zombieKill')
    expect(one.state.survivors['sv.ashley']).toMatchObject({ frostbite: 1, status: 'alive' })
  })

  const chainSetup = () => makeState({
    survivors: [
      ...school(), { id: 'sv.mike', owner: 's2', location: SCHOOL }, { id: 'sv.forest', owner: 's2', location: SCHOOL }, { id: 'sv.extra', owner: 's1', location: 'colony' },
    ],
    rng: forceRng([12, 12]),
  })
  const startChain = () => {
    const s = chainSetup()
    const r = rollExposureFor(s, 'sv.ashley', 'zombieKill')
    return { ...r, state: { ...r.state, pending: r.pending! } }
  }
  const spread = (state: ReturnType<typeof startChain>['state'], choice: 'kill' | 'roll', rawRoll?: number) => {
    const withRng = rawRoll ? { ...state, rng: forceRng([12, rawRoll]) } : state
    const out = applyBiteSpread(withRng, { type: 'biteSpread', decisionId: withRng.pending.id, seat: withRng.pending.seat as string, choice })
    return { ...out, state: { ...out.state, pending: out.pending ?? out.state.pending } }
  }

  it('EXPO-005 a bite kills, costs morale, and spreads to the lowest influence at the location', () => {
    const r = startChain()
    expect(of(r.events, 'SurvivorKilled')[0]).toMatchObject({ survivorId: 'sv.ashley', cause: 'bite' })
    expect(of(r.events, 'MoraleChanged')[0]).toMatchObject({ delta: -1 })
    expect(of(r.events, 'BiteSpreadStep')[0]).toMatchObject({ toId: 'sv.forest' })
    expect(r.pending).toMatchObject({ kind: 'biteSpreadOption', seat: 's2' })
    expect(r.pending!.options!.map((o) => o.id)).toEqual(['kill', 'roll'])
  })

  it('EXPO-006 choosing to kill ends the chain at once', () => {
    const o = spread(startChain().state, 'kill')
    expect(types(o.events)).toEqual(['BiteChoiceMade', 'SurvivorKilled', 'MoraleChanged', 'BiteChainEnded'])
    expect(of(o.events, 'BiteChainEnded')[0]).toMatchObject({ reason: 'killChoice', killed: ['sv.forest'] })
    expect(o.state.survivors['sv.mike']!.status).toBe('alive')
    expect(o.state.bite).toBeNull()
  })

  it('EXPO-007 a blank on the chain roll saves the survivor', () => {
    const o = spread(startChain().state, 'roll', 2)
    expect(of(o.events, 'ExposureRolled')[0]).toMatchObject({ reason: 'biteChain', face: 'blank' })
    expect(of(o.events, 'BiteChainEnded')[0]).toMatchObject({ reason: 'blank' })
    expect(o.state.survivors['sv.forest']!.status).toBe('alive')
  })

  it('EXPO-008 any non-blank chain roll kills and the bite moves on', () => {
    const o = spread(startChain().state, 'roll', 8)
    expect(o.state.survivors['sv.forest']!.status).toBe('dead')
    expect(of(o.events, 'SurvivorKilled')[0]).toMatchObject({ cause: 'exposureChain' })
    expect(of(o.events, 'BiteSpreadStep')[0]).toMatchObject({ toId: 'sv.mike' })
    expect(o.pending).toMatchObject({ kind: 'biteSpreadOption', seat: 's2' })
  })

  it('EXPO-009 the chain ends when the last survivor falls', () => {
    const a = spread(startChain().state, 'roll', 8)
    const b = spread(a.state, 'roll', 12)
    expect(of(b.events, 'BiteChainEnded')[0]).toMatchObject({ reason: 'noSurvivors', killed: ['sv.forest', 'sv.mike'] })
    expect(b.state.survivors['sv.ashley']!.status).toBe('dead')
  })

  it('EXPO-010 a bite with nobody else there never asks a question', () => {
    const r = rollExposureFor(makeState({ survivors: [...school(), { id: 'sv.extra', owner: 's1', location: 'colony' }], rng: forceRng([12, 12]) }), 'sv.ashley', 'move')
    expect(r.pending).toBeUndefined()
    expect(of(r.events, 'BiteChainEnded')[0]).toMatchObject({ reason: 'noSurvivors', killed: [] })
  })

  it('EXPO-011 Sparky turns a bite into a wound and is skipped by a spreading bite', () => {
    const w = rollExposureFor(makeState({ survivors: [{ id: 'sv.sparky', owner: 's1', location: SCHOOL }], rng: forceRng([12, 12]) }), 'sv.sparky', 'zombieKill')
    expect(of(w.events, 'ExposureFaceChanged')[0]).toMatchObject({ from: 'bite', to: 'wound' })
    expect(w.state.survivors['sv.sparky']).toMatchObject({ wounds: 1, status: 'alive' })
    const s = makeState({
      survivors: [...school(), { id: 'sv.sparky', owner: 's2', location: SCHOOL }, { id: 'sv.mike', owner: 's2', location: SCHOOL }, { id: 'sv.extra', owner: 's1', location: 'colony' }],
      rng: forceRng([12, 12]),
    })
    expect(of(rollExposureFor(s, 'sv.ashley', 'zombieKill').events, 'BiteSpreadStep')[0]).toMatchObject({ toId: 'sv.mike' })
  })

  it('EXPO-012 Harman Brooks takes frostbite as an ordinary wound', () => {
    const r = rollExposureFor(makeState({ survivors: [{ id: 'sv.harman', owner: 's1', location: SCHOOL }], rng: forceRng([12, 10]) }), 'sv.harman', 'zombieKill')
    expect(of(r.events, 'ExposureFaceChanged')[0]).toMatchObject({ from: 'frostbite', to: 'wound' })
    expect(of(r.events, 'WoundTaken')[0]).toMatchObject({ kind: 'wound' })
  })

  it('EXPO-013 Buddy Davis survives three wounds and dies on the fourth', () => {
    const three = makeState({ survivors: [{ id: 'sv.buddy', owner: 's1', location: SCHOOL, wounds: 2 }], rng: forceRng([12, 8]) })
    expect(rollExposureFor(three, 'sv.buddy', 'zombieKill').state.survivors['sv.buddy']).toMatchObject({ wounds: 3, status: 'alive' })
    const four = makeState({ survivors: [{ id: 'sv.buddy', owner: 's1', location: SCHOOL, wounds: 3 }, { id: 'sv.extra', owner: 's1', location: 'colony' }], rng: forceRng([12, 8]) })
    expect(rollExposureFor(four, 'sv.buddy', 'zombieKill').state.survivors['sv.buddy']!.status).toBe('dead')
  })

  it('EXPO-016 odds: Sparky, Harman, Rod Miller and the death chance', () => {
    const s = makeState({
      survivors: [
        { id: 'sv.sparky', owner: 's1', location: SCHOOL }, { id: 'sv.harman', owner: 's1', location: SCHOOL }, { id: 'sv.rod', owner: 's1', location: SCHOOL },
        { id: 'sv.ashley', owner: 's2', location: SCHOOL, wounds: 2 },
      ],
    })
    expect(exposureOddsFor(s, 'sv.sparky')).toMatchObject({ bite: 0, wound: 4 / 12 })
    expect(exposureOddsFor(s, 'sv.harman')).toMatchObject({ frostbite: 0, wound: 5 / 12 })
    expect(exposureOddsFor(s, 'sv.rod', 'move')).toMatchObject({ wound: 0, frostbite: 0, bite: 0, pDeath: 0 })
    expect(exposureOddsFor(s, 'sv.ashley').pDeath).toBeCloseTo((3 + 2 + 1) / 12)
    expect(exposureOdds({ wounds: 0, frostbite: 0 }).pDeath).toBeCloseTo(1 / 12)
    expect(BITE_CHAIN_ODDS.pDeath).toBeCloseTo(0.5)
    expect(EXPOSURE_FACE_COUNT.blank + EXPOSURE_FACE_COUNT.wound + EXPOSURE_FACE_COUNT.frostbite + EXPOSURE_FACE_COUNT.bite).toBe(12)
  })
})
