/**
 * Engine-owned numbers the UI and bots show (C.3; 10.0.8; 00.8). Pure functions, no state access.
 * Not a frozen file, but every export is re-exported from index.ts and its signature is frozen.
 */
import { D12_FACES } from './rng'
import type { ExposureReason, Face } from './types'

export type FaceOdds = Record<Face, number>

export interface ExposureMods {
  /** Reasons for which the survivor skips the roll (exposureSkip). */
  skip?: readonly ExposureReason[]
  /** Face replacements (exposureFaceReplace), applied once per roll in order. */
  replace?: readonly { from: Face; to: Face }[]
}

/** Probability of each resulting face for one exposure roll (10.7.1). A skipped roll is 100% blank. */
export function exposureOdds(reason: ExposureReason, mods: ExposureMods = {}): FaceOdds {
  const out: FaceOdds = { blank: 0, wound: 0, frostbite: 0, bitten: 0 }
  if (mods.skip?.includes(reason)) return { ...out, blank: 1 }
  for (const rolled of D12_FACES) {
    let face = rolled
    const rep = mods.replace?.find((r) => r.from === rolled)
    if (rep) face = rep.to
    out[face] += 1 / 12
  }
  return out
}

/** P(one d6 >= min). min is clamped to 1..7 (7 = impossible). */
export function dieAtLeastOdds(min: number): number {
  const m = Math.min(7, Math.max(1, Math.ceil(min)))
  return (7 - m) / 6
}

/** Attack on a survivor (10.5.2): the re-rolled die hits on <= the target's attack value. */
export function attackSurvivorHitOdds(targetAttack: number): number {
  return Math.min(6, Math.max(0, Math.floor(targetAttack))) / 6
}

/** Pay food (10.4.7): survivors and helpless tokens at the colony, halved, rounded up. */
export function foodNeeded(colonySurvivors: number, delta = 0): number {
  return Math.max(0, Math.ceil(colonySurvivors / 2) + delta)
}

/** Check waste (10.4.8): morale lost for a waste pile of `waste` cards. */
export function wasteMoraleLoss(waste: number, step = 10): number {
  return Math.floor(waste / step)
}

/** Crisis outcome thresholds (10.4.15): `players` = non-exiled seats. */
export function crisisThresholds(players: number): { prevent: number; bonus: number } {
  return { prevent: players, bonus: players + 2 }
}

export function crisisOutcome(total: number, players: number): 'failed' | 'prevented' | 'bonus' {
  const t = crisisThresholds(players)
  return total >= t.bonus ? 'bonus' : total >= t.prevent ? 'prevented' : 'failed'
}

/** Colony Add Zombies (10.8.6.1): zombies added at the colony. */
export function colonyZombiesIncoming(colonySurvivors: number): number {
  return Math.ceil(colonySurvivors / 2)
}

/** Noise (10.8.6.3): expected zombies from `tokens` noise tokens (each d6 <= 3 adds one). */
export function noiseExpectedZombies(tokens: number): number {
  return tokens / 2
}
