// Turns a seat view into table positions: where every figure, zombie, barricade, noise token and helpless token stands.
// Pure (no three.js): the 3D scene only draws what this returns, and the DOM test proxies read it too.
import type { SeatView } from '../../engine/index'
import {
  assignSlots, colonyLayout, slotPoint, spaceItems, tileLayouts,
  type ColonyLayout, type Pt, type TileCapacity, type TileLayout,
} from './layout'

export interface FigureModel {
  id: string
  pos: Pt
  seat: string
  seatIndex: number
  leader: boolean
  location: string
  slot: number
  wounds: number
  frostbite: number
}
export interface EntranceModel { location: string; entrance: number; zombies: Pt[]; barricades: Pt[]; count: number; barricadeCount: number }
export interface TableModel {
  colony: ColonyLayout
  tiles: Record<string, TileLayout>
  figures: FigureModel[]
  zombies: Pt[]
  barricades: Pt[]
  noise: Pt[]
  helpless: Pt[]
  entrances: EntranceModel[]
  moraleAt: Pt
  roundAt: Pt
}

export function buildTableModel(v: SeatView): TableModel {
  const col = v.locations['colony']
  const caps: Record<string, TileCapacity> = {}
  for (const id of v.locationOrder) {
    const l = v.locations[id]
    if (l && id !== 'colony') caps[id] = { survivors: l.capacity.survivors, entranceSpaces: l.capacity.entranceSpaces, noiseSpaces: l.capacity.noiseSpaces }
  }
  const colony = colonyLayout({
    survivors: col?.capacity.survivors ?? 24, entrances: col?.entrances.length ?? 6, entranceSpaces: col?.capacity.entranceSpaces ?? 3,
  })
  const tiles = tileLayouts(v.locationOrder, caps)

  const seatIndex = (seat: string): number => Math.max(0, v.seatOrder.indexOf(seat))
  const alive = Object.values(v.survivors).filter((s) => s.status === 'alive')
  const figures: FigureModel[] = []
  const helpless: Pt[] = []
  for (const id of v.locationOrder) {
    const here = alive.filter((s) => s.location === id)
    const owner = new Map(here.map((s) => [s.id, s.owner ?? '']))
    const order = assignSlots(here.map((s) => s.id), (sid) => seatIndex(owner.get(sid) ?? ''))
    const slots = id === 'colony' ? colony.occupants : tiles[id]?.survivors ?? []
    order.forEach((sid, i) => {
      const s = v.survivors[sid]!
      const leader = !!s.owner && v.seats[s.owner]?.leaderId === sid
      figures.push({
        id: sid, pos: slotPoint(slots, i), seat: s.owner ?? '', seatIndex: seatIndex(s.owner ?? ''), leader, location: id, slot: i,
        wounds: s.wounds, frostbite: s.frostbite,
      })
    })
    const loc = v.locations[id]
    for (let k = 0; k < (loc?.helpless ?? 0); k++) helpless.push(slotPoint(slots, order.length + k))
  }

  const zombies: Pt[] = []
  const barricades: Pt[] = []
  const noise: Pt[] = []
  const entrances: EntranceModel[] = []
  for (const id of v.locationOrder) {
    const loc = v.locations[id]
    if (!loc) continue
    for (const e of loc.entrances) {
      const spaces = id === 'colony' ? colony.entrances.find((x) => x.index === e.index)?.spaces ?? [] : tiles[id]?.entrance ?? []
      const items = spaceItems(spaces.length, e.barricades, e.zombies)
      const z: Pt[] = []
      const b: Pt[] = []
      items.forEach((it, i) => { if (it === 'zombie') z.push(spaces[i]!); else if (it === 'barricade') b.push(spaces[i]!) })
      zombies.push(...z)
      barricades.push(...b)
      entrances.push({ location: id, entrance: e.index, zombies: z, barricades: b, count: e.zombies, barricadeCount: e.barricades })
    }
    const nSlots = tiles[id]?.noise ?? []
    for (let k = 0; k < Math.min(loc.noise, nSlots.length); k++) noise.push(nSlots[k]!)
  }

  return {
    colony, tiles, figures, zombies, barricades, noise, helpless, entrances,
    moraleAt: colony.moraleTrack[Math.max(0, Math.min(colony.moraleTrack.length - 1, v.morale))] ?? colony.moraleTrack[0]!,
    roundAt: colony.roundTrack[Math.max(0, Math.min(colony.roundTrack.length - 1, v.roundsLeft))] ?? colony.roundTrack[0]!,
  }
}
