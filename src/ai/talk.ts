// Table talk (41): pickLine draws a line from a persona's bank for an event key, without repeating a line until the key's bank is
// used up. createTalker adds the pacing: about one line per bot per turn, scaled by the persona's chattiness. Lines are ours and
// carry only public slots (seat names, survivor names, numbers); nothing here reads game state, so a line cannot reveal hidden cards.
import { deriveSeed, nextFloat } from '../engine/rng'
import { getPersona, type Persona } from './personas'

export type TalkKey =
  | 'crisis.prevented' | 'crisis.failed' | 'vote.called' | 'vote.lean.yes' | 'vote.lean.no' | 'request.give' | 'request.decline'
  | 'exposure.bite' | 'morale.low' | 'game.won' | 'game.lost' | 'turn.start'
export type Fills = Record<string, string | number | undefined>

const played = new Map<string, Set<number>>() // "<persona>|<key>" -> indices already used in the current cycle
export function resetTalkMemory(): void { played.clear() }

const SLOT = /\{(\w+)\}/g
const slotsOf = (text: string): string[] => [...text.matchAll(SLOT)].map((m) => m[1]!)

/** A line for `key` with `{slots}` filled, or null when the persona has none (or none whose slots can be filled). */
export function pickLine(persona: Persona | string | undefined, key: string, fills: Fills, seed: string): string | null {
  const p = typeof persona === 'string' ? getPersona(persona) : persona
  const bank = p?.lines[key]
  if (!p || !bank || bank.length === 0) return null
  const ok = bank.map((l, i) => ({ i, text: l.text })).filter((l) => slotsOf(l.text).every((s) => fills[s] !== undefined))
  if (ok.length === 0) return null
  const memKey = `${p.id}|${key}`
  let used = played.get(memKey)
  if (!used) { used = new Set(); played.set(memKey, used) }
  let fresh = ok.filter((l) => !used!.has(l.i))
  if (fresh.length === 0) { for (const l of ok) used.delete(l.i); fresh = ok }
  const [f] = nextFloat(deriveSeed(seed, p.id, key, used.size))
  const pick = fresh[Math.min(fresh.length - 1, Math.floor(f * fresh.length))]!
  used.add(pick.i)
  return pick.text.replace(SLOT, (_m, s: string) => String(fills[s]))
}

export interface TalkLine { seat: string; persona: string; key: string; text: string }
export interface Talker {
  /** Say a line for `key` if this bot has not spoken this turn (always when `force`). Returns the text or null. */
  say(key: TalkKey, fills: Fills, turn: number, opts?: { force?: boolean; always?: boolean }): string | null
}

/** Pacing for one bot: at most one line per turn, and P(speak) = chattiness, except votes/endings which always speak. */
export function createTalker(persona: Persona | undefined, seed: string, seat: string): Talker {
  let lastTurn = -1
  let n = 0
  return {
    say(key, fills, turn, opts) {
      if (!persona) return null
      if (!opts?.force && turn === lastTurn) return null
      const [f] = nextFloat(deriveSeed(seed, seat, 'talk', n++))
      if (!opts?.always && !opts?.force && f > persona.scalars.chattiness) return null
      const text = pickLine(persona, key, fills, `${seed}|${seat}|${n}`)
      if (text) lastTurn = turn
      return text
    },
  }
}
