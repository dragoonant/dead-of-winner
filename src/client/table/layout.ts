// Table layout (30 §2, 50 §13): pure geometry for the colony board, the six location tiles and everything that sits on them.
// Units are table inches on the x/z plane (x right, z toward the near edge). No three.js, no engine: unit tested.

export interface Pt { x: number; z: number }
export const pt = (x: number, z: number): Pt => ({ x, z })
export const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.z - b.z)

/** Positions of `count` slots in a centred grid with `cols` columns (row-major), `spacing` apart, centre at `at`. */
export function gridPositions(count: number, cols: number, spacing: number, at: Pt = pt(0, 0)): Pt[] {
  const out: Pt[] = []
  const rows = Math.ceil(count / Math.max(1, cols))
  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / cols)
    const c = i % cols
    const inRow = r === rows - 1 ? count - r * cols : cols
    out.push(pt(at.x + (c - (inRow - 1) / 2) * spacing, at.z + (r - (rows - 1) / 2) * spacing))
  }
  return out
}

// ---------- the colony board ----------
// Laid out like the printed board (rulebook p5), 2:1: the round track runs down the left edge, the colony name picture sits top left over the main
// objective and waste pile boxes and the crisis deck and crisis contributions boxes, a blueprint floor plan fills the centre ringed by six entrance
// pads (1 top right, 2 top left, 3 and 4 down the left side, 5 bottom left, 6 bottom right: counter-clockwise), the colony occupants (3 x 8) stand on
// the right above the food supply box, and the morale track runs along the bottom.
export const COLONY_SIZE = { w: 36, d: 18 } as const
/** A rectangle given by its centre and size, in table inches. */
export interface Zone { x: number; z: number; w: number; d: number }
export const zone = (x: number, z: number, w: number, d: number): Zone => ({ x, z, w, d })

export interface ColonyCapacity { survivors: number; entrances: number; entranceSpaces: number }
export interface EntranceLayout { index: number; door: Pt; spaces: Pt[]; side: 'north' | 'south' | 'west'; pad: Zone }
export interface ColonyLayout {
  size: { w: number; d: number }
  occupants: Pt[]
  entrances: EntranceLayout[]
  moraleTrack: Pt[]
  roundTrack: Pt[]
  food: Pt
  waste: Pt
  crisis: Pt
  contribution: Pt
  objective: Pt
  /** Printed regions, for painting the board texture and placing tokens. */
  zones: { rounds: Zone; name: Zone; objective: Zone; waste: Zone; crisis: Zone; contribution: Zone; blueprint: Zone; occupants: Zone; food: Zone; morale: Zone }
}

const PAD_LEN = 5
const PAD_DEPTH = 2.1
const SPACE_GAP = 1.55
/** Entrance pad centres in the order 1..6, with the side of the blueprint they sit on. */
const PADS: { at: Pt; side: EntranceLayout['side'] }[] = [
  { at: pt(6.5, -7.5), side: 'north' }, // 1 top right
  { at: pt(-2.1, -7.5), side: 'north' }, // 2 top left
  { at: pt(-5.4, -3.2), side: 'west' }, // 3 left, upper
  { at: pt(-5.4, 2.3), side: 'west' }, // 4 left, lower
  { at: pt(-2.1, 6.0), side: 'south' }, // 5 bottom left
  { at: pt(6.5, 6.0), side: 'south' }, // 6 bottom right
]

export function colonyLayout(cap: ColonyCapacity, moraleMax = 10, roundMax = 10): ColonyLayout {
  const { w, d } = COLONY_SIZE
  const entrances: EntranceLayout[] = []
  for (let k = 0; k < cap.entrances; k++) {
    const p = PADS[k % PADS.length]!
    const vertical = p.side === 'west'
    const spaces = gridPositions(cap.entranceSpaces, vertical ? 1 : cap.entranceSpaces, SPACE_GAP, p.at)
    const door = p.side === 'north' ? pt(p.at.x, p.at.z + PAD_DEPTH / 2) : p.side === 'south' ? pt(p.at.x, p.at.z - PAD_DEPTH / 2) : pt(p.at.x + PAD_DEPTH / 2, p.at.z)
    entrances.push({ index: k + 1, door, spaces, side: p.side, pad: vertical ? zone(p.at.x, p.at.z, PAD_DEPTH, PAD_LEN) : zone(p.at.x, p.at.z, PAD_LEN, PAD_DEPTH) })
  }
  const zones = {
    rounds: zone(-17.2, 0, 1.5, 17.6),
    name: zone(-11.9, -6.2, 8.0, 4.8),
    objective: zone(-13.9, -0.9, 3.9, 4.8),
    waste: zone(-9.7, -0.9, 3.9, 4.8),
    crisis: zone(-14.1, 4.7, 3.5, 4.9),
    contribution: zone(-9.5, 4.7, 5.0, 4.9),
    blueprint: zone(2.2, -0.7, 17.6, 15.8),
    occupants: zone(14.5, -1.85, 5.8, 13.5),
    food: zone(14.5, 7.0, 5.8, 3.2),
    morale: zone(2.2, 8.15, 17.6, 1.1),
  }
  const cols = Math.min(3, Math.max(1, cap.survivors))
  const rt = zones.rounds
  const roundStep = (rt.d - 2.6) / roundMax
  const moraleStart = -4.4
  const moraleStep = 1.45
  return {
    size: { w, d },
    occupants: gridPositions(cap.survivors, cols, 1.62, pt(zones.occupants.x, zones.occupants.z + 0.45)),
    entrances,
    // value i sits at index i: the round track counts up from the bottom, the morale track runs 10..0 left to right
    moraleTrack: Array.from({ length: moraleMax + 1 }, (_v, i) => pt(moraleStart + (moraleMax - i) * moraleStep, zones.morale.z)),
    roundTrack: Array.from({ length: roundMax + 1 }, (_v, i) => pt(rt.x, rt.z + rt.d / 2 - 0.7 - i * roundStep)),
    food: pt(zones.food.x, zones.food.z),
    waste: pt(zones.waste.x, zones.waste.z),
    crisis: pt(zones.crisis.x, zones.crisis.z),
    contribution: pt(zones.contribution.x, zones.contribution.z),
    objective: pt(zones.objective.x, zones.objective.z),
    zones,
  }
}

// ---------- the six location tiles ----------
/** Each location is a large portrait card: number tab and name plate on top, an art panel holding the survivor circles, a hazard-striped
 *  entrance strip, and a dark search panel with four noise slots. */
export const TILE_W = 8.4
export const TILE_H = 9.4
export const TILE_SIZE = TILE_H
/** Where tile k (0..5, in the rulebook's number order) sits: 01-03 along the top, 04-06 back along the bottom. */
export const TILE_PLACEMENTS: { at: Pt }[] = [
  { at: pt(-11.2, -14.9) }, // 01 top left
  { at: pt(0, -14.9) }, // 02 top middle
  { at: pt(11.2, -14.9) }, // 03 top right
  { at: pt(11.2, 14.9) }, // 04 bottom right
  { at: pt(0, 14.9) }, // 05 bottom middle
  { at: pt(-11.2, 14.9) }, // 06 bottom left
]
/** The printed bands of a tile, as z offsets from its centre (top to bottom). */
export const TILE_BANDS = {
  title: { z0: -4.7, z1: -3.55 },
  art: { z0: -3.45, z1: 0.25 },
  strip: { z0: 0.45, z1: 1.8 },
  search: { z0: 2.05, z1: 4.7 },
} as const

export interface TileCapacity { survivors: number; entranceSpaces: number; noiseSpaces: number }
export interface TileLayout {
  centre: Pt
  size: number
  w: number
  h: number
  title: Pt
  survivors: Pt[]
  entrance: Pt[]
  noise: Pt[]
}

export function tileLayout(index: number, cap: TileCapacity): TileLayout {
  const place = TILE_PLACEMENTS[index % TILE_PLACEMENTS.length]!
  const local = (x: number, z: number): Pt => pt(place.at.x + x, place.at.z + z)
  const surv = gridPositions(cap.survivors, Math.min(4, Math.max(1, cap.survivors)), 1.7, pt(0, -1.35))
  const ent = gridPositions(cap.entranceSpaces, Math.min(cap.entranceSpaces, 5), 1.9, pt(0, 1.12))
  const noise = gridPositions(cap.noiseSpaces, 1, 0.64, pt(TILE_W / 2 - 0.95, 3.4))
  return {
    centre: place.at, size: TILE_SIZE, w: TILE_W, h: TILE_H,
    title: local(0, -4.12),
    survivors: surv.map((p) => local(p.x, p.z)),
    entrance: ent.map((p) => local(p.x, p.z)),
    noise: noise.map((p) => local(p.x, p.z)),
  }
}

/** Layout for every non-colony location, keyed by id, in `locationOrder` (colony first, then 01..06). */
export function tileLayouts(locationOrder: readonly string[], caps: Record<string, TileCapacity>): Record<string, TileLayout> {
  const out: Record<string, TileLayout> = {}
  let k = 0
  for (const id of locationOrder) {
    if (id === 'colony') continue
    const c = caps[id]
    if (c) out[id] = tileLayout(k, c)
    k++
  }
  return out
}

// ---------- what sits in the spaces ----------
export type SpaceItem = 'barricade' | 'zombie' | 'empty'
/** Barricades take the first spaces of an entrance, zombies the next ones, the rest are empty. */
export function spaceItems(spaces: number, barricades: number, zombies: number): SpaceItem[] {
  return Array.from({ length: spaces }, (_v, i) => (i < barricades ? 'barricade' : i < barricades + zombies ? 'zombie' : 'empty'))
}

/** Stable slot order for the survivors standing at one location: by seat order, then id, so nobody jumps when another leaves. */
export function assignSlots(survivorIds: readonly string[], ownerIndex: (id: string) => number): string[] {
  return [...survivorIds].sort((a, b) => ownerIndex(a) - ownerIndex(b) || a.localeCompare(b))
}

/** Position for the i-th occupant of a location; occupants beyond the printed slots stack beside the last one. */
export function slotPoint(slots: readonly Pt[], i: number): Pt {
  if (slots.length === 0) return pt(0, 0)
  if (i < slots.length) return slots[i]!
  const last = slots[slots.length - 1]!
  return pt(last.x + 0.5 * (i - slots.length + 1), last.z + 0.5 * (i - slots.length + 1))
}

// ---------- camera presets ----------
export interface CameraPose { position: [number, number, number]; target: [number, number, number] }
export const CAMERA_PRESETS: Record<1 | 2 | 3, CameraPose> = {
  1: { position: [0, 46, 34], target: [0, 0, 6] }, // seat view
  2: { position: [0, 62, 12], target: [0, 0, 2] }, // top down
  3: { position: [0, 24, 19], target: [0, 0, 1] }, // colony close
}
export function followPose(at: Pt): CameraPose {
  return { position: [at.x, 13, at.z + 12], target: [at.x, 0, at.z] }
}
