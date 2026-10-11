// State AS OF THE ANIMATION CURSOR (50 §4). Everything on screen renders from here; a number never runs ahead of its animation.
// The director is the only writer. Arrays are replaced, never mutated, so selectors can return them directly.
import { create } from 'zustand'
import type { GameState } from '../../engine/index'
import type { BannerKind, BeatKind } from './beats'
import type { FeedEntry } from './feedModel'

export type { FeedEntry }

export interface ActiveBeat { id: number; kind: BeatKind; startedAt: number; durationMs: number; firstSeq: number; lastSeq: number }
export interface Banner { id: number; text: string; kind: BannerKind }

/** One roll as the tray shows it (the numbers and the verdict word come from the event, never recomputed). */
export interface ShownRoll {
  seq: number
  purpose: string // RollPurpose, or 'attackSurvivor' / 'exposure' / 'noise' for the specialised events
  title: string
  actor: string
  seat: string | null
  dice: number[]
  target?: number
  verdict: string | null
  /** The engine's odds for this roll when it is an exposure roll ("50% blank, 25% wound ..."), shown under the die. */
  note?: string
  startedAt: number
  durationMs: number
}

export interface CrisisRevealCard { name: string; points: 1 | -1; runningTotal: number }
/** The card-by-card crisis reveal: `needed` and `bonusAt` come from query.crisis, `outcome` from CrisisResolved, `moraleDelta` from the MoraleChanged that follows. */
export interface CrisisReveal {
  crisisId: string | null
  cards: CrisisRevealCard[]
  needed: number | null
  bonusAt: number | null
  outcome: { total: number; needed: number; prevented: boolean; bonus: boolean } | null
  moraleDelta: number | null
}
/** A short full-screen hit flash for a zombie kill, a wound, frostbite, a bite or a death. */
export type FlashKind = 'kill' | 'wound' | 'frostbite' | 'bite' | 'death'
export interface Flash { id: number; kind: FlashKind }

export const FEED_LIMIT = 800
export const DICE_LOG_LIMIT = 300

export interface PresentedState {
  state: GameState | null
  cursor: number
  idle: boolean
  paused: boolean
  beat: ActiveBeat | null
  banner: Banner | null
  roll: ShownRoll | null
  diceLog: ShownRoll[]
  feed: FeedEntry[]
  crisisReveal: CrisisReveal | null
  flash: Flash | null
  rev: number
}

export const INITIAL_PRESENTED: PresentedState = {
  state: null, cursor: 0, idle: true, paused: false, beat: null, banner: null, roll: null, diceLog: [], feed: [], crisisReveal: null, flash: null, rev: 0,
}

export const usePresentedStore = create<PresentedState>(() => ({ ...INITIAL_PRESENTED }))
export function isPresentationIdle(): boolean { return usePresentedStore.getState().idle }
