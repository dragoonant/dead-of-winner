// Our own simple icon artwork as plain path data in a 24 x 24 box. React draws it as inline SVG (Icons.tsx) and the 3D board paints the very same
// paths onto its canvas textures (Path2D), so a symbol looks identical on a card, in the HUD and on a location tile. All original drawings.

export interface IconPath { d: string; fill?: string; stroke?: string; sw?: number; op?: number }

export const SYMBOL_COLOUR: Record<string, string> = {
  weapon: '#d6604d', fuel: '#e0a030', education: '#7fb2d6', food: '#8fc36b', medicine: '#e86a8a', tool: '#b0b6c0', survivor: '#c9a227',
}
export const SYMBOL_NAME: Record<string, string> = {
  weapon: 'Weapon', fuel: 'Fuel', education: 'Education', food: 'Food', medicine: 'Medicine', tool: 'Tool', survivor: 'Survivor',
}
const DARK = '#14161a'

/** The artwork of one item symbol, painted in `c`. */
export function symbolPaths(symbol: string, c: string = SYMBOL_COLOUR[symbol] ?? '#999'): IconPath[] {
  switch (symbol) {
    case 'weapon': return [
      { d: 'M4 20 L18 6 M15 5 L19 9 M3 17 L7 21', stroke: c, sw: 2.4 },
      { d: 'M20 20 L6 6 M5 9 L9 5', stroke: c, sw: 2.4, op: 0.55 },
    ]
    case 'fuel': return [
      { d: 'M6 8h11v13H6z M9 8V5h5l2 3', fill: c, op: 0.92 },
      { d: 'M9 12h5v5H9z', fill: DARK, op: 0.45 },
    ]
    case 'education': return [
      { d: 'M3 5c3-1 6-1 9 1 3-2 6-2 9-1v14c-3-1-6-1-9 1-3-2-6-2-9-1z', fill: c, op: 0.92 },
      { d: 'M12 6v14', stroke: DARK, sw: 1.4, op: 0.5 },
    ]
    case 'food': return [
      { d: 'M6 6a6 2.4 0 1 0 12 0a6 2.4 0 1 0-12 0z', fill: c },
      { d: 'M6 6v12c0 1.4 2.7 2.4 6 2.4s6-1 6-2.4V6', fill: c, op: 0.8 },
      { d: 'M6 11c0 1.4 2.7 2.4 6 2.4s6-1 6-2.4', stroke: DARK, sw: 1.2, op: 0.45 },
    ]
    case 'medicine': return [{ d: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z', fill: c, op: 0.94 }]
    case 'tool': return [{ d: 'M15 3a5 5 0 0 0-4.6 6.9L3 17.3 6.7 21l7.4-7.4A5 5 0 0 0 21 9l-3.2 3.2-3-.9-.9-3L17.1 5A5 5 0 0 0 15 3z', fill: c, op: 0.94 }]
    case 'survivor': return [
      { d: 'M8.4 7a3.6 3.6 0 1 0 7.2 0a3.6 3.6 0 1 0-7.2 0z', fill: c },
      { d: 'M4.5 21c.6-5 3.4-8 7.5-8s6.9 3 7.5 8z', fill: c, op: 0.88 },
    ]
    default: return [{ d: 'M4 12a8 8 0 1 0 16 0a8 8 0 1 0-16 0z', fill: c, op: 0.6 }]
  }
}

// ---------- stat and board glyphs ----------
/** Attack: a jagged impact burst. */
export const ATTACK_PATHS: IconPath[] = [
  { d: 'M12 1.5l2.3 5.6 5.2-3-2 5.8 5.8.4-4.6 3.7 3.7 4.5-5.6-1-.9 5.9-3.9-4.3-3.9 4.3-.9-5.9-5.6 1 3.7-4.5L.7 10.3l5.8-.4-2-5.8 5.2 3z', fill: '#f1ead8' },
  { d: 'M12 8.2a3.8 3.8 0 1 0 0 7.6a3.8 3.8 0 1 0 0-7.6z', fill: '#7a1d17' },
]
/** Search: a magnifying glass. */
export const SEARCH_PATHS: IconPath[] = [
  { d: 'M10 3.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13z', stroke: '#f1ead8', sw: 2.6 },
  { d: 'M14.8 14.8L21 21', stroke: '#f1ead8', sw: 3.4 },
  { d: 'M6.8 8.2a3.6 3.6 0 0 1 3.2-2', stroke: '#f1ead8', sw: 1.2, op: 0.6 },
]
/** Noise: a ringing bell shape with sound arcs. */
export const NOISE_PATHS: IconPath[] = [
  { d: 'M8 17c0-1 1.6-1.4 1.6-4.4a2.4 2.4 0 0 1 4.8 0c0 3 1.6 3.4 1.6 4.4z', fill: '#f0b840' },
  { d: 'M10.6 18.6a1.4 1.4 0 0 0 2.8 0', stroke: '#f0b840', sw: 1.4 },
  { d: 'M4.5 9.5a8 8 0 0 1 2-4 M19.5 9.5a8 8 0 0 0-2-4', stroke: '#f0b840', sw: 1.5, op: 0.8 },
]
/** A generic walking-dead head and shoulders, used for zombie spaces. */
export const ZOMBIE_PATHS: IconPath[] = [
  { d: 'M8 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0z', fill: '#7ca66a' },
  { d: 'M5 22c0-6 3-9 7-9s7 3 7 9z', fill: '#7ca66a', op: 0.8 },
  { d: 'M9.6 6.5a.9.9 0 1 0 1.8 0a.9.9 0 1 0-1.8 0z M12.8 6.5a.9.9 0 1 0 1.8 0a.9.9 0 1 0-1.8 0z', fill: DARK },
]
/** Warning triangle (set up). */
export const WARN_PATHS: IconPath[] = [
  { d: 'M12 2.5L22 20H2z', fill: '#c0392b', stroke: '#7a1d17', sw: 1.2 },
  { d: 'M12 8.5v5.4', stroke: '#fff3df', sw: 2.2 },
  { d: 'M12 16a1.2 1.2 0 1 0 0 .01z', fill: '#fff3df' },
]
/** Paperclip. */
export const CLIP_PATHS: IconPath[] = [
  { d: 'M7 13.5V6a4 4 0 0 1 8 0v11a2.5 2.5 0 0 1-5 0V8', stroke: '#9aa3ad', sw: 1.6 },
]
export const MORALE_PATHS: IconPath[] = [{ d: 'M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z', fill: '#c9a227' }]
export const SNOW_PATHS: IconPath[] = [{ d: 'M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7', stroke: '#7fb2d6', sw: 1.8 }]
export const SKULL_PATHS: IconPath[] = [
  { d: 'M12 3C7.6 3 5 6 5 10c0 2.4 1 3.8 2.4 4.8V18h2.2v-1.6h1.2V18h2.4v-1.6h1.2V18h2.2v-3.2C18 13.8 19 12.4 19 10c0-4-2.6-7-7-7z', fill: '#e6dfcf' },
  { d: 'M7.4 9.6a1.9 1.9 0 1 0 3.8 0a1.9 1.9 0 1 0-3.8 0z M12.8 9.6a1.9 1.9 0 1 0 3.8 0a1.9 1.9 0 1 0-3.8 0z', fill: DARK },
]

/** Paint a path list onto a canvas at (x, y) scaled to `size` px. */
export function paintPaths(ctx: CanvasRenderingContext2D, paths: IconPath[], x: number, y: number, size: number): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(size / 24, size / 24)
  for (const p of paths) {
    const path = new Path2D(p.d)
    ctx.globalAlpha = p.op ?? 1
    if (p.fill) { ctx.fillStyle = p.fill; ctx.fill(path) }
    if (p.stroke) { ctx.strokeStyle = p.stroke; ctx.lineWidth = p.sw ?? 1.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(path) }
  }
  ctx.restore()
}
