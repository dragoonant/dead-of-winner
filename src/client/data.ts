// Synchronous lookups over the loaded bundle (names, symbols, card text). Everything the client prints about a card comes from here.
import type { DataBundle } from '../data/types'
import type { GameSetup, ItemSymbol, SeatId } from '../engine/index'

let bundle: DataBundle | null = null
export function setClientBundle(b: DataBundle | null): void { bundle = b }
export function getClientBundle(): DataBundle | null { return bundle }

type Rec = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
export const rec = (id: string | null | undefined): Rec | undefined => (id && bundle ? (bundle.byId[id] as unknown as Rec | undefined) : undefined)

const titleCase = (s: string): string => s.replace(/(^|[\s-])([a-z])/g, (_m, a: string, b: string) => a + b.toUpperCase())
/** A readable name for any record id, falling back to the id's slug. */
export function nameOf(id: string | null | undefined): string {
  if (!id) return 'nothing'
  const r = rec(id)
  if (r && typeof r['name'] === 'string') return r['name'] as string
  return titleCase(id.replace(/^[a-z]+\./, '').replace(/\./g, ' ').replace(/-/g, ' '))
}

export function locName(id: string): string { return id === 'colony' ? 'the Colony' : nameOf(id) }
export function locShort(id: string): string { return id === 'colony' ? 'Colony' : nameOf(id) }
export function locNumber(id: string): number | null { const n = rec(id)?.['number']; return typeof n === 'number' ? n : null }

export function itemSymbols(defId: string | undefined): ItemSymbol[] {
  const r = rec(defId)
  if (!r) return []
  const many = r['symbols'] as ItemSymbol[] | undefined
  return many ?? (r['symbol'] ? [r['symbol'] as ItemSymbol] : [])
}
export function itemText(defId: string | undefined): string { return (rec(defId)?.['text']?.['ability'] as string | undefined) ?? '' }
export function itemKindLabel(defId: string | undefined): string {
  const c = rec(defId)?.['class'] as string | undefined
  return c === 'equip' ? 'Equip' : c === 'event' ? 'Event' : c === 'wastePile' ? 'One use' : ''
}
export function survivorStats(id: string): { influence: number; attack: number; search: number } | null { return (rec(id)?.['stats'] as { influence: number; attack: number; search: number } | undefined) ?? null }
export function survivorAbility(id: string): string { return (rec(id)?.['text']?.['ability'] as string | undefined) ?? '' }
export function survivorOccupation(id: string): string { return (rec(id)?.['occupation'] as string | undefined) ?? '' }

export const BOT_NAMES = ['Rook', 'Sparrow', 'Wren', 'Ash', 'Moss']
export function seatNameOf(setup: GameSetup, seat: SeatId): string {
  const i = setup.seats.findIndex((s) => s.id === seat)
  const s = setup.seats[i]
  if (!s) return seat
  return s.name ?? (s.kind === 'human' ? 'Player' : BOT_NAMES[i % BOT_NAMES.length]!)
}

export interface MainObjectiveInfo { id: string; name: string; time: string; blurb: string }
export function mainObjectives(b: DataBundle | null = bundle): MainObjectiveInfo[] {
  if (!b) return []
  return b.records.mainObjectives.map((o) => ({ id: o.id, name: o.name, time: o.time, blurb: o.text?.normal?.victory ?? o.text?.story ?? '' }))
}

import type { Names } from './presentation/feed'
/** The name lookups the feed, beats and prompts share. */
export function makeNames(setup: GameSetup): Names {
  return {
    seat: (id) => seatNameOf(setup, id),
    survivor: (id) => nameOf(id),
    loc: (id) => locName(id),
    item: (defId) => nameOf(defId),
    crisis: (id) => nameOf(id),
    objective: (id) => nameOf(id),
  }
}

/** A readable objective-progress label: the engine's generic labels ("hand has symbol fuel") become plain words. */
export function partLabel(label: string): string {
  const m = /^hand has symbol (\w+)$/.exec(label)
  if (m) return `${m[1]} cards in your hand`
  const plain: Record<string, string> = {
    'hand at least': 'cards in your hand', 'hand at most': 'cards in your hand (at most)', 'survivors at least': 'survivors in your group',
    'survivors at most': 'survivors in your group (at most)', 'morale at most': 'morale (at most)', 'morale at least': 'morale',
    'food at least': 'food in the supply', 'barricades at least': 'barricades', 'zombies at least': 'zombies',
  }
  return plain[label] ?? label
}
