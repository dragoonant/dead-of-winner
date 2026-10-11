import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { COLONY_SIZE, TILE_BANDS, TILE_H, TILE_W, assignSlots, colonyLayout, dist, spaceItems, tileLayout, tileLayouts, type Pt } from '../../src/client/table/layout'
import { seatAngle, seatRimPosition } from '../../src/client/table/seats'

const LOC_DIR = path.resolve(__dirname, '../../src/data/locations')
const locRecords = fs.readdirSync(LOC_DIR).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(LOC_DIR, f), 'utf8')) as {
  id: string; number?: number; spaces: { survivors: number; entrances: number; entranceSpaces: number; noise: number }
})
const minGap = (pts: Pt[]): number => {
  let m = Infinity
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) m = Math.min(m, dist(pts[i]!, pts[j]!))
  return m
}

describe('table layout', () => {
  const colonyRec = locRecords.find((l) => l.id === 'colony')!
  const col = colonyLayout({ survivors: colonyRec.spaces.survivors, entrances: colonyRec.spaces.entrances, entranceSpaces: colonyRec.spaces.entranceSpaces })

  it('the colony has 6 numbered entrances of 3 spaces and 24 occupant slots in a 3 x 8 grid, none overlapping', () => {
    expect(col.entrances.map((e) => e.index)).toEqual([1, 2, 3, 4, 5, 6])
    expect(col.entrances.every((e) => e.spaces.length === 3)).toBe(true)
    expect(col.occupants).toHaveLength(24)
    expect(new Set(col.occupants.map((p) => p.x.toFixed(2))).size).toBe(3)
    expect(new Set(col.occupants.map((p) => p.z.toFixed(2))).size).toBe(8)
    expect(minGap(col.occupants)).toBeGreaterThan(1)
    expect(minGap(col.entrances.flatMap((e) => e.spaces))).toBeGreaterThan(1)
    for (const p of [...col.occupants, ...col.entrances.flatMap((e) => e.spaces)]) { expect(Math.abs(p.x)).toBeLessThan(COLONY_SIZE.w / 2); expect(Math.abs(p.z)).toBeLessThan(COLONY_SIZE.d / 2) }
    const oz = col.zones.occupants
    for (const p of col.occupants) { expect(Math.abs(p.x - oz.x)).toBeLessThan(oz.w / 2); expect(Math.abs(p.z - oz.z)).toBeLessThan(oz.d / 2) }
  })

  it('entrances are numbered as printed: 1 top right, 2 top left, 3 and 4 down the left side, 5 bottom left, 6 bottom right', () => {
    const e = (i: number) => col.entrances.find((x) => x.index === i)!
    expect(e(1).side).toBe('north'); expect(e(2).side).toBe('north'); expect(e(1).door.x).toBeGreaterThan(e(2).door.x)
    expect(e(3).side).toBe('west'); expect(e(4).side).toBe('west'); expect(e(3).door.z).toBeLessThan(e(4).door.z)
    expect(e(5).side).toBe('south'); expect(e(6).side).toBe('south'); expect(e(5).door.x).toBeLessThan(e(6).door.x)
  })

  it('the printed zones do not overlap each other and stay on the board', () => {
    const zs = Object.entries(col.zones).filter(([k]) => k !== 'blueprint')
    const hit = (a: { x: number; z: number; w: number; d: number }, b: typeof a) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 0.01 && Math.abs(a.z - b.z) < (a.d + b.d) / 2 - 0.01
    for (const [k, z] of Object.entries(col.zones)) { expect(Math.abs(z.x) + z.w / 2, k).toBeLessThanOrEqual(COLONY_SIZE.w / 2 + 0.01); expect(Math.abs(z.z) + z.d / 2, k).toBeLessThanOrEqual(COLONY_SIZE.d / 2 + 0.01) }
    for (let i = 0; i < zs.length; i++) for (let j = i + 1; j < zs.length; j++) expect(hit(zs[i]![1], zs[j]![1]), `${zs[i]![0]} vs ${zs[j]![0]}`).toBe(false)
    for (const e of col.entrances) { const b = col.zones.blueprint; expect(Math.abs(e.pad.x - b.x) + e.pad.w / 2).toBeLessThanOrEqual(b.w / 2 + 0.01); expect(Math.abs(e.pad.z - b.z) + e.pad.d / 2).toBeLessThanOrEqual(b.d / 2 + 0.01) }
  })

  it('the morale track runs 10..0 left to right and the round track counts up from the bottom', () => {
    expect(col.moraleTrack[10]!.x).toBeLessThan(col.moraleTrack[0]!.x)
    expect(col.roundTrack[10]!.z).toBeLessThan(col.roundTrack[0]!.z)
  })

  it('tracks hold 0..10 and the six tiles carry the survivor, entrance and noise counts from the location data', () => {
    expect(col.moraleTrack).toHaveLength(11)
    expect(col.roundTrack).toHaveLength(11)
    const tiles = locRecords.filter((l) => l.id !== 'colony')
    expect(tiles).toHaveLength(6)
    const caps = Object.fromEntries(tiles.map((l) => [l.id, { survivors: l.spaces.survivors, entranceSpaces: l.spaces.entranceSpaces, noiseSpaces: l.spaces.noise }]))
    const order = ['colony', ...[...tiles].sort((a, b) => (a.number ?? 0) - (b.number ?? 0)).map((l) => l.id)]
    const lay = tileLayouts(order, caps)
    expect(Object.keys(lay)).toHaveLength(6)
    for (const l of tiles) {
      const t = lay[l.id]!
      expect(t.survivors).toHaveLength(l.spaces.survivors)
      expect(t.entrance).toHaveLength(l.spaces.entranceSpaces)
      expect(t.noise).toHaveLength(4)
      expect(minGap([...t.survivors, ...t.entrance])).toBeGreaterThan(1.2)
      expect(minGap(t.noise)).toBeGreaterThan(0.6)
      for (const p of [...t.survivors, ...t.entrance, ...t.noise]) { expect(Math.abs(p.x - t.centre.x)).toBeLessThan(TILE_W / 2); expect(Math.abs(p.z - t.centre.z)).toBeLessThan(TILE_H / 2) }
    }
    const centres = Object.values(lay).map((t) => t.centre)
    expect(minGap(centres)).toBeGreaterThan(TILE_W)
    for (const c of centres) expect(Math.abs(c.z) - TILE_H / 2).toBeGreaterThan(COLONY_SIZE.d / 2) // tiles clear the colony board
  })

  it('inside a tile the bands read top to bottom: survivors in the art panel, then the entrance strip, then the noise slots in the search panel', () => {
    const t = tileLayout(0, { survivors: 4, entranceSpaces: 3, noiseSpaces: 4 })
    const rel = (p: Pt) => p.z - t.centre.z
    for (const p of t.survivors) { expect(rel(p)).toBeGreaterThan(TILE_BANDS.art.z0); expect(rel(p)).toBeLessThan(TILE_BANDS.art.z1) }
    for (const p of t.entrance) { expect(rel(p)).toBeGreaterThan(TILE_BANDS.strip.z0); expect(rel(p)).toBeLessThan(TILE_BANDS.strip.z1) }
    for (const p of t.noise) { expect(rel(p)).toBeGreaterThan(TILE_BANDS.search.z0); expect(rel(p)).toBeLessThan(TILE_BANDS.search.z1) }
  })

  it('barricades fill an entrance first, then zombies, then it is empty; slots are stable by seat order', () => {
    expect(spaceItems(3, 1, 1)).toEqual(['barricade', 'zombie', 'empty'])
    expect(spaceItems(3, 0, 5)).toEqual(['zombie', 'zombie', 'zombie'])
    expect(assignSlots(['b', 'a', 'c'], (id) => (id === 'c' ? 0 : 1))).toEqual(['c', 'a', 'b'])
  })

  it('seats sit clockwise with the human at the near edge, distinct for 2 to 5 seats', () => {
    for (let n = 2; n <= 5; n++) {
      const pts = Array.from({ length: n }, (_v, i) => { const [x, z] = seatRimPosition(i, n, 20, 20); return { x, z } })
      expect(pts[0]!.z).toBeGreaterThan(19.9)
      expect(Math.abs(pts[0]!.x)).toBeLessThan(0.01)
      expect(minGap(pts)).toBeGreaterThan(5)
      expect(seatAngle(1, n)).toBeGreaterThan(seatAngle(0, n))
    }
  })
})
