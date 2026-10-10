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
export const COLONY_SIZE = { w: 18, d: 12 } as const
export interface ColonyCapacity { survivors: number; entrances: number; entranceSpaces: number }
export interface EntranceLayout { index: number; door: Pt; spaces: Pt[]; side: 'north' | 'south' }
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
}

/**
 * Entrances 1..n run clockwise from the top-left: the first half along the north edge left to right, the rest along the south edge
 * right to left. Each entrance owns `entranceSpaces` spaces in a row just outside its door. Occupants fill 8 across, 3 deep (24).
 */
export function colonyLayout(cap: ColonyCapacity, moraleMax = 10, roundMax = 10): ColonyLayout {
  const { w, d } = COLONY_SIZE
  const north = Math.ceil(cap.entrances / 2)
  const south = cap.entrances - north
  const entrances: EntranceLayout[] = []
  const doorsAt = (n: number, z: number, side: 'north' | 'south', first: number, reverse: boolean): void => {
    for (let k = 0; k < n; k++) {
      const x = ((k + 0.5) / n - 0.5) * (w - 2.4)
      const index = first + (reverse ? n - 1 - k : k)
      const outward = side === 'north' ? -0.95 : 0.95
      const spaces = gridPositions(cap.entranceSpaces, cap.entranceSpaces, 1.25, pt(x, z + outward))
      entrances.push({ index, door: pt(x, z), spaces, side })
    }
  }
  doorsAt(north, -d / 2, 'north', 1, false)
  doorsAt(south, d / 2, 'south', north + 1, true)
  entrances.sort((a, b) => a.index - b.index)
  const cols = Math.min(8, Math.max(1, cap.survivors))
  const track = (n: number, z: number): Pt[] => Array.from({ length: n + 1 }, (_v, i) => pt((i - n / 2) * 1.35, z))
  return {
    size: { w, d },
    occupants: gridPositions(cap.survivors, cols, 1.55, pt(0, 0)),
    entrances,
    moraleTrack: track(moraleMax, -d / 2 + 1.5),
    roundTrack: track(roundMax, d / 2 - 1.5),
    food: pt(-w / 2 - 2.6, -2.2),
    waste: pt(-w / 2 - 2.6, 2.2),
    crisis: pt(w / 2 + 2.6, -2.2),
    contribution: pt(w / 2 + 2.6, 2.2),
  }
}

// ---------- the six location tiles ----------
export type Facing = 'N' | 'S' | 'E' | 'W'
export const TILE_SIZE = 8
/** Where tile k (0..5, in the rulebook's number order) sits and which edge faces the colony. */
export const TILE_PLACEMENTS: { at: Pt; facing: Facing }[] = [
  { at: pt(-9, -15), facing: 'S' }, // 01 top left
  { at: pt(9, -15), facing: 'S' }, // 02 top right
  { at: pt(18, 0), facing: 'W' }, // 03 right
  { at: pt(9, 15), facing: 'N' }, // 04 bottom right
  { at: pt(-9, 15), facing: 'N' }, // 05 bottom left
  { at: pt(-18, 0), facing: 'E' }, // 06 left
]
const FORWARD: Record<Facing, Pt> = { S: pt(0, 1), N: pt(0, -1), E: pt(1, 0), W: pt(-1, 0) }

export interface TileCapacity { survivors: number; entranceSpaces: number; noiseSpaces: number }
export interface TileLayout {
  centre: Pt
  size: number
  facing: Facing
  title: Pt
  survivors: Pt[]
  entrance: Pt[]
  noise: Pt[]
}

/** Local frame: +z points at the colony. Content is laid out facing +z then rotated to the tile's facing. */
function toWorld(centre: Pt, facing: Facing, x: number, z: number): Pt {
  const f = FORWARD[facing]
  return pt(centre.x + x * f.z + z * f.x, centre.z + x * -f.x + z * f.z)
}

export function tileLayout(index: number, cap: TileCapacity): TileLayout {
  const place = TILE_PLACEMENTS[index % TILE_PLACEMENTS.length]!
  const h = TILE_SIZE / 2
  const local = (x: number, z: number): Pt => toWorld(place.at, place.facing, x, z)
  const surv = gridPositions(cap.survivors, Math.min(4, Math.max(1, cap.survivors)), 1.5, pt(0, -1.3))
  const ent = gridPositions(cap.entranceSpaces, Math.min(cap.entranceSpaces, 5), 1.25, pt(0, h - 0.9))
  const noise = gridPositions(cap.noiseSpaces, Math.max(1, cap.noiseSpaces), 0.9, pt(0, 0.9))
  return {
    centre: place.at, size: TILE_SIZE, facing: place.facing,
    title: local(0, -h + 0.7),
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
  1: { position: [0, 38, 31], target: [0, 0, 6] }, // seat view
  2: { position: [0, 54, 13], target: [0, 0, 3] }, // top down
  3: { position: [0, 17, 17], target: [0, 0, 3] }, // colony close
}
export function followPose(at: Pt): CameraPose {
  return { position: [at.x, 13, at.z + 12], target: [at.x, 0, at.z] }
}
