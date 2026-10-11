// Table talk (41): pickLine draws a line from a persona's bank for an event key, without repeating a line until the key's bank is
// used up. createTalker adds the pacing of 41 §4: one ambient/action/social/claim line, one reaction and one opinion per bot per turn,
// P(speak) = chattiness x relevance, a key silent for two turns after it fires (reactions excepted). Lines are ours and carry only
// public slots (seat names, survivor names, numbers); nothing here reads game state, so a line cannot reveal hidden cards.
// Audio is the client's business and only ever plays when a recording exists for the exact line (src/client/audio/personaVoice.ts).
import { deriveSeed, nextFloat } from '../engine/rng'
import { getPersona, type Persona } from './personas'

export type SymbolKey = 'weapon' | 'fuel' | 'education' | 'food' | 'medicine' | 'tool' | 'survivor'
/** The event keys of 41 §3, plus the two M4 keys the first client wiring used (`turn.start`, `vote.called`). */
export type TalkKey =
  | 'round.start' | 'crisis.revealed' | 'crisis.contributed' | 'crisis.prevented' | 'crisis.bonus' | 'crisis.failed' | 'crisis.shortfall'
  | 'vote.called.me' | 'vote.called.other' | 'vote.lean.yes' | 'vote.lean.no' | 'vote.lean.silent' | 'vote.passed' | 'vote.failed'
  | 'exiled.me' | 'exiled.other' | 'request.made' | 'request.give' | 'request.decline' | 'request.refused.me'
  | `search.found.${SymbolKey}` | 'search.noise' | 'move.out' | 'zombie.killed' | 'barricade.built'
  | 'exposure.wound' | 'exposure.bite' | 'bite.chain.kill' | 'survivor.lost.other' | 'overrun' | 'food.short' | 'morale.low'
  | 'objective.progress' | 'crossroads.me' | 'accused.me' | 'accused.other' | 'game.won' | 'game.lost' | 'idle'
  | 'vote.called' | 'turn.start'
export type Fills = Record<string, string | number | undefined>

export const TALK_KEYS: readonly string[] = [
  'round.start', 'crisis.revealed', 'crisis.contributed', 'crisis.prevented', 'crisis.bonus', 'crisis.failed', 'crisis.shortfall',
  'vote.called.me', 'vote.called.other', 'vote.lean.yes', 'vote.lean.no', 'vote.lean.silent', 'vote.passed', 'vote.failed',
  'exiled.me', 'exiled.other', 'request.made', 'request.give', 'request.decline', 'request.refused.me',
  'search.found.weapon', 'search.found.fuel', 'search.found.education', 'search.found.food', 'search.found.medicine', 'search.found.tool', 'search.found.survivor',
  'search.noise', 'move.out', 'zombie.killed', 'barricade.built', 'exposure.wound', 'exposure.bite', 'bite.chain.kill', 'survivor.lost.other', 'overrun',
  'food.short', 'morale.low', 'objective.progress', 'crossroads.me', 'accused.me', 'accused.other', 'game.won', 'game.lost', 'idle',
]

/** A persona with no bank for the first key tries these in order (the first client wiring asked for `turn.start` and `vote.called`). */
const ALIASES: Record<string, string[]> = {
  'turn.start': ['round.start', 'idle'],
  'vote.called': ['vote.called.other'],
}

const played = new Map<string, Set<number>>() // "<persona>|<key>" -> indices already used in the current cycle
export function resetTalkMemory(): void { played.clear() }

const SLOT = /\{(\w+)\}/g
const slotsOf = (text: string): string[] => [...text.matchAll(SLOT)].map((m) => m[1]!)

/** The banks a persona has for `key`: its own, then the aliases. */
function banksFor(p: Persona, key: string): { key: string; bank: Persona['lines'][string] }[] {
  const out: { key: string; bank: Persona['lines'][string] }[] = []
  for (const k of [key, ...(ALIASES[key] ?? [])]) { const bank = p.lines[k]; if (bank && bank.length > 0) out.push({ key: k, bank }) }
  return out
}

/** A line for `key` with `{slots}` filled, or null when the persona has none (or none whose slots can be filled). */
export function pickLine(persona: Persona | string | undefined, key: string, fills: Fills, seed: string): string | null {
  const p = typeof persona === 'string' ? getPersona(persona) : persona
  if (!p) return null
  for (const found of banksFor(p, key)) {
    const ok = found.bank.map((l, i) => ({ i, text: l.text })).filter((l) => slotsOf(l.text).every((s) => fills[s] !== undefined))
    if (ok.length === 0) continue
    const memKey = `${p.id}|${found.key}`
    let used = played.get(memKey)
    if (!used) { used = new Set(); played.set(memKey, used) }
    let fresh = ok.filter((l) => !used!.has(l.i))
    if (fresh.length === 0) { for (const l of ok) used.delete(l.i); fresh = ok }
    const [f] = nextFloat(deriveSeed(seed, p.id, found.key, used.size))
    const pick = fresh[Math.min(fresh.length - 1, Math.floor(f * fresh.length))]!
    used.add(pick.i)
    return pick.text.replace(SLOT, (_m, s: string) => String(fills[s]))
  }
  return null
}

export type LineClass = 'ambient' | 'action' | 'social' | 'claim' | 'reaction' | 'opinion' | 'end'
const CLASS: Record<string, LineClass> = {
  'round.start': 'ambient', 'crisis.revealed': 'ambient', 'idle': 'ambient', 'turn.start': 'ambient',
  'crisis.contributed': 'claim',
  'crisis.shortfall': 'opinion', 'vote.lean.yes': 'opinion', 'vote.lean.no': 'opinion', 'vote.lean.silent': 'opinion', 'accused.other': 'opinion',
  'request.made': 'social', 'request.give': 'social', 'request.decline': 'social',
  'search.noise': 'action', 'move.out': 'action', 'zombie.killed': 'action', 'barricade.built': 'action',
  'game.won': 'end', 'game.lost': 'end',
}
export function classOf(key: string): LineClass {
  if (key.startsWith('search.found.')) return 'action'
  return CLASS[key] ?? 'reaction'
}
const GROUP: Record<LineClass, 'main' | 'reaction' | 'opinion' | 'end'> = { ambient: 'main', action: 'main', social: 'main', claim: 'main', reaction: 'reaction', opinion: 'opinion', end: 'end' }
/** Keys that always get a line when the event concerns the bot (the human needs something to read, 41 §4). */
const ALWAYS = new Set(['vote.lean.yes', 'vote.lean.no', 'vote.lean.silent', 'accused.me'])

export interface TalkLine { seat: string; persona: string; key: string; text: string }
export interface SayOptions {
  /** speak whatever the pacing says (a forced reaction to something addressed to this bot) */
  force?: boolean
  /** skip the chattiness roll but keep the one-line-per-turn cap */
  always?: boolean
  /** 1.0 when the event names this bot or the human, 0.5 otherwise (41 §4) */
  relevance?: number
}
export interface Talker {
  /** Say a line for `key` if the pacing allows. Returns the text or null. */
  say(key: TalkKey, fills: Fills, turn: number, opts?: SayOptions): string | null
}

/**
 * Pacing for one bot (41 §4): one line per class group per turn, P(speak) = chattiness x relevance (leans, accusations and endings always
 * speak), a key silent for two turns after it fires unless it is a reaction. A chatty-less bot states a lean as "..." (vote.lean.silent).
 */
export function createTalker(persona: Persona | undefined, seed: string, seat: string): Talker {
  const lastTurn: Record<string, number> = {}
  const keyTurn: Record<string, number> = {}
  let n = 0
  return {
    say(key, fills, turn, opts) {
      if (!persona) return null
      const cls = classOf(key)
      const group = GROUP[cls]
      const always = ALWAYS.has(key) || cls === 'end' || !!opts?.always
      if (!opts?.force && !always && lastTurn[group] === turn) return null
      if (!opts?.force && cls !== 'reaction' && keyTurn[key] !== undefined && turn - keyTurn[key]! < 2 && !always) return null
      const [f] = nextFloat(deriveSeed(seed, seat, 'talk', n++))
      const p = key === 'crisis.contributed' ? persona.scalars.chattiness : persona.scalars.chattiness * (opts?.relevance ?? 1)
      if (!opts?.force && !always && f > p) return null
      let say: TalkKey = key
      // a quiet persona states its lean as a silent beat about half the time its chattiness is missing
      if ((key === 'vote.lean.yes' || key === 'vote.lean.no') && persona.lines['vote.lean.silent'] && f > 0.35 + persona.scalars.chattiness * 0.65) say = 'vote.lean.silent'
      const text = pickLine(persona, say, fills, `${seed}|${seat}|${n}`)
      if (text) { lastTurn[group] = turn; keyTurn[key] = turn }
      return text
    },
  }
}

/** The key to speak a lean with: the yes/no line, or the silent beat when the persona says little (shared with the client's lean line). */
export function leanKey(persona: Persona | undefined, yes: boolean, roll: number): TalkKey {
  if (persona?.lines['vote.lean.silent'] && roll > 0.35 + persona.scalars.chattiness * 0.65) return 'vote.lean.silent'
  return yes ? 'vote.lean.yes' : 'vote.lean.no'
}
