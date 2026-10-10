// Seat placement and colours (50 §13): the ONLY file that knows how seats map to table positions and colours.
// Seat i of n sits clockwise from the near edge; the human is index 0. Nothing else reads seat ids as literals.
export const SEAT_COLOURS = ['#e0a030', '#5fa8d3', '#c0504d', '#7cc36b', '#b07cd8'] as const

export function seatColour(seatOrder: readonly string[], seat: string): string {
  const i = seatOrder.indexOf(seat)
  return SEAT_COLOURS[(i < 0 ? 0 : i) % SEAT_COLOURS.length]!
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
