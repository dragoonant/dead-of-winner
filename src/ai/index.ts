// The AI entry point (40 §1): createDecider(tier, persona, seed) returns the Decider for one bot seat. Every tier shares the
// hidden-information contract: a decider sees only view(state, seat), the pending decision and the legal actions.
import { createRandomDecider } from './random'
import { createTierDecider, type AiDecider } from './normal'
import type { AiTier, GameEvent } from '../engine/index'
import type { SeatView } from '../engine/view'

export type { AiDecider } from './normal'
export { PERSONAS, PERSONA_IDS, getPersona, personaFor } from './personas'
export { TALK_KEYS, createTalker, leanKey, pickLine, resetTalkMemory } from './talk'
export { AI_TIERS, TIERS } from './tiers'
export { claimsFor, resetTalkBus, suspicionTrajectory } from './normal/suspicion'

/** One decider per bot seat. `random` picks any legal move; `easy`, `normal` and `hard` are the planner at three strengths (src/ai/tiers.ts). */
export function createDecider(tier: AiTier | undefined, persona: string | undefined, seed: string): AiDecider {
  if (tier === 'random') {
    const d = createRandomDecider(seed)
    return { ...d, persona: undefined, stats: { decisions: 0, totalMs: 0, maxMs: 0, degraded: 0 }, observe(_e: readonly GameEvent[], _v: SeatView) { /* the random bot keeps no memory */ } }
  }
  return createTierDecider(tier === 'easy' || tier === 'hard' ? tier : 'normal', seed, persona)
}
