// Seat placement and colours (50 §13): the ONLY file that knows how seats map to table positions and colours.
// Seat i of n sits clockwise from the near edge; the human is index 0. Nothing else reads seat ids as literals.
import { useSettingsStore, type PaletteId } from '../store/settingsStore'

/** The default seat colours (kept as the named export older code and the gallery read). */
export const SEAT_COLOURS = ['#e0a030', '#5fa8d3', '#c0504d', '#7cc36b', '#b07cd8'] as const

/** Seat colour sets. `cbsafe` is the Okabe-Ito palette (distinct under the common colour-vision deficiencies) and also draws a shape beside each seat. */
export const PALETTES: Record<PaletteId, { label: string; colours: readonly string[] }> = {
  default: { label: 'Default', colours: SEAT_COLOURS },
  alt: { label: 'Alternative (bright)', colours: ['#ffb347', '#6ec6ff', '#ff7f7f', '#a6e58a', '#cfa3ff'] },
  cbsafe: { label: 'Colour-blind safe', colours: ['#E69F00', '#56B4E9', '#CC79A7', '#F0E442', '#009E73'] },
}
/** A shape per seat, shown beside the colour in the colour-blind-safe set so colour is never the only cue. */
export const SEAT_MARKS = ['●', '▲', '■', '◆', '★'] as const

export const currentPalette = (): PaletteId => useSettingsStore.getState().palette
/** Components call this so they re-render when the player changes the seat colours. */
export function usePalette(): PaletteId { return useSettingsStore((s) => s.palette) }

export function seatColours(palette: PaletteId = currentPalette()): readonly string[] { return PALETTES[palette].colours }
export function seatColourAt(i: number, palette: PaletteId = currentPalette()): string {
  const c = seatColours(palette)
  return c[(i < 0 ? 0 : i) % c.length]!
}
export function seatColour(seatOrder: readonly string[], seat: string, palette: PaletteId = currentPalette()): string {
  return seatColourAt(seatOrder.indexOf(seat), palette)
}
/** The shape mark for a seat ('' unless the colour-blind-safe set is chosen). */
export function seatMark(seatOrder: readonly string[], seat: string, palette: PaletteId = currentPalette()): string {
  if (palette !== 'cbsafe') return ''
  const i = seatOrder.indexOf(seat)
  return SEAT_MARKS[(i < 0 ? 0 : i) % SEAT_MARKS.length]!
}

/** Angle of seat `i` of `n`, measured from the +x axis in the table plane: the human (i = 0) at the near edge (+z). */
export function seatAngle(i: number, n: number): number {
  return Math.PI / 2 + (2 * Math.PI * i) / Math.max(1, n)
}

/** Position on the table rim for a seat's hand stack (x, z). The near edge is +z. */
export function seatRimPosition(i: number, n: number, rx: number, rz: number): [number, number] {
  const a = seatAngle(i, n)
  return [Math.cos(a) * rx, Math.sin(a) * rz]
}
