import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { COLONY_SIZE, TILE_SIZE, assignSlots, colonyLayout, dist, spaceItems, tileLayout, tileLayouts, type Pt } from '../../src/client/table/layout'
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

  it('the colony has 6 numbered entrances of 3 spaces and 24 occupant slots in an 8 x 3 grid, none overlapping', () => {
    expect(col.entrances.map((e) => e.index)).toEqual([1, 2, 3, 4, 5, 6])
    expect(col.entrances.every((e) => e.spaces.length === 3)).toBe(true)
    expect(col.occupants).toHaveLength(24)
    expect(new Set(col.occupants.map((p) => p.x.toFixed(2))).size).toBe(8)
    expect(new Set(col.occupants.map((p) => p.z.toFixed(2))).size).toBe(3)
    expect(minGap(col.occupants)).toBeGreaterThan(1)
    expect(minGap(col.entrances.flatMap((e) => e.spaces))).toBeGreaterThan(1)
    for (const p of col.occupants) { expect(Math.abs(p.x)).toBeLessThan(COLONY_SIZE.w / 2); expect(Math.abs(p.z)).toBeLessThan(COLONY_SIZE.d / 2) }
  })

  it('entrances run clockwise: 1-3 along the north edge left to right, 4-6 along the south edge right to left', () => {
    const e = (i: number) => col.entrances.find((x) => x.index === i)!
    expect(e(1).side).toBe('north'); expect(e(1).door.x).toBeLessThan(e(3).door.x)
    expect(e(4).side).toBe('south'); expect(e(4).door.x).toBeGreaterThan(e(6).door.x)
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
      expect(minGap([...t.survivors, ...t.entrance, ...t.noise])).toBeGreaterThan(0.85)
      for (const p of [...t.survivors, ...t.entrance, ...t.noise]) expect(Math.max(Math.abs(p.x - t.centre.x), Math.abs(p.z - t.centre.z))).toBeLessThan(TILE_SIZE / 2)
    }
    const centres = Object.values(lay).map((t) => t.centre)
    expect(minGap(centres)).toBeGreaterThan(TILE_SIZE)
  })

  it('every tile faces the colony: its entrance spaces are the slots nearest the colony', () => {
    for (let k = 0; k < 6; k++) {
      const t = tileLayout(k, { survivors: 4, entranceSpaces: 3, noiseSpaces: 4 })
      const near = (p: Pt) => Math.hypot(p.x, p.z)
      const meanEntrance = t.entrance.reduce((a, p) => a + near(p), 0) / t.entrance.length
      const meanSurvivors = t.survivors.reduce((a, p) => a + near(p), 0) / t.survivors.length
      expect(meanEntrance).toBeLessThan(meanSurvivors)
    }
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
