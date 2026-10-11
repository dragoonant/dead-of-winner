// The tiers (40 §12). `random` is the uniform legal-action bot (src/ai/random.ts); the three planner tiers share one decider and differ in
// the knobs below. Persona scalars (41 §1) apply at normal and hard; easy plays them at half strength.
import type { AiTier } from '../engine/index'

export type PlannerTier = 'easy' | 'normal' | 'hard'
export interface TierParams {
  tier: PlannerTier
  /** overrides of the planner constants (`TUNE` in normal/plan.ts) */
  tune: Record<string, number>
  /** relative noise on every action score: easy's "score noise sigma = 15%" */
  noise: number
  /** does the bot keep the full evidence ledger? easy only reads attacks on other seats' survivors */
  ledger: 'attacks' | 'full'
  /** added to the persona's vote and call thresholds (hard: -0.05; easy: never votes without an attack as evidence) */
  voteShift: number
  callShift: number
  /** how many other seats must also look suspicious before a bot calls a vote (estimated from its own ledger x this factor) */
  callEstimate: number
  /** betrayer play: naive = sabotage from round 1, cover = spend a cover budget, patient = also waits for a diffuse shortfall and frames */
  betrayer: 'naive' | 'cover' | 'patient'
  /** the betrayer takes a hidden move iff its evidence cost <= cover x margin (Infinity = always) */
  coverMargin: number
  /** may the bot ask other seats for cards */
  requests: boolean
  /** food tokens per die the bot will spend (easy: 1) */
  foodBoostMax: number
  /** 0.5 = easy plays its persona at half strength */
  personaStrength: number
  /** crisis contribution: P(prevent) the bot wants before it stops adding cards (40 §6.2 tau_crisis) */
  crisisTau: number
  /** hard: track what the other seats can hold and use the distribution, not the mean, for the crisis total */
  handTracking: boolean
  /** hard: once the objective's counters are met, play only to live through the colony phase that checks them */
  finishing: boolean
  /** colony phases the board model looks ahead when it prices a kill or a barricade (easy 1, normal 2, hard 3) */
  horizon: number
}

export const TIERS: Record<PlannerTier, TierParams> = {
  easy: {
    tier: 'easy', tune: { inP: 0.85, laterP: 0.7, cExtra: -0.2, woundW: 0.12, boostMin: 99, medW: 0.05, medBase: 0.1, sampleKill: 0.9 },
    noise: 0.15, ledger: 'attacks', voteShift: 0.25, callShift: 0.25, callEstimate: 0.6, betrayer: 'naive', coverMargin: Infinity, requests: false, foodBoostMax: 1,
    personaStrength: 0.5, crisisTau: 0.5, handTracking: false, finishing: false, horizon: 1,
  },
  normal: {
    tier: 'normal', tune: { sampleKill: 1.15, inP: 0.55, laterP: 0.35, woundW: 0.4 },
    noise: 0, ledger: 'full', voteShift: 0, callShift: 0, callEstimate: 0.85, betrayer: 'cover', coverMargin: 0.8, requests: true, foodBoostMax: 6,
    personaStrength: 1, crisisTau: 0.7, handTracking: false, finishing: false, horizon: 2,
  },
  hard: {
    tier: 'hard', tune: {},
    noise: 0, ledger: 'full', voteShift: -0.05, callShift: -0.05, callEstimate: 0.9, betrayer: 'patient', coverMargin: 0.5, requests: true, foodBoostMax: 6,
    personaStrength: 1, crisisTau: 0.75, handTracking: true, finishing: true, horizon: 2,
  },
}

/** The tiers the start screen offers, easiest first (read by the client through the module's `AI_TIERS` export). */
export const AI_TIERS: readonly AiTier[] = ['easy', 'normal', 'hard', 'random']
export const isPlannerTier = (t: string | undefined): t is PlannerTier => t === 'easy' || t === 'normal' || t === 'hard'
