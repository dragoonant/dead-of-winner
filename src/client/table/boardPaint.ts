// Canvas painters for the 3D table's printed surfaces: the colony board (rulebook p5 layout) and the six location cards. Everything is drawn
// from our own generated textures (public/textures) and icon paths, so the table reads as worn cardstock, slate and blueprint, not flat colour.
// If a texture image is missing the painter falls back to a flat tone, so nothing here can fail a render.
import { NOISE_PATHS, SEARCH_PATHS, SYMBOL_COLOUR, ZOMBIE_PATHS, paintPaths, symbolPaths } from '../cards/iconPaths'
import { hash01, textureUrl } from '../cards/art'
import { COLONY_SIZE, TILE_BANDS, TILE_H, TILE_W, type ColonyLayout, type TileLayout, type Zone } from './layout'

export const TEXTURE_NAMES = [
  'paper-worn', 'cardstock-stained', 'blood-speckle', 'wood-planks', 'blueprint', 'hazard-stripes', 'frost-edge', 'slate', 'snow-flecks', 'table-wood', 'table-felt',
] as const
export type TextureName = (typeof TEXTURE_NAMES)[number]
export type TextureSet = Partial<Record<TextureName, HTMLImageElement>>

function loadImg(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') { resolve(null); return }
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

let setPromise: Promise<TextureSet> | null = null
/** Loads every generated texture once (missing files are simply absent from the set). */
export function loadTextureSet(): Promise<TextureSet> {
  setPromise ??= Promise.all(TEXTURE_NAMES.map(async (n) => [n, await loadImg(textureUrl(`${n}.webp`))] as const)).then((pairs) => {
    const out: TextureSet = {}
    for (const [n, img] of pairs) if (img) out[n] = img
    return out
  })
  return setPromise
}

const HEAD = '"Bebas Neue", "Arial Narrow", Impact, sans-serif'

// ---------- drawing helpers ----------
type Ctx = CanvasRenderingContext2D
function pattern(ctx: Ctx, img: HTMLImageElement | undefined, scale: number): CanvasPattern | null {
  if (!img) return null
  const p = ctx.createPattern(img, 'repeat')
  if (p && scale !== 1) p.setTransform(new DOMMatrix().scale(scale, scale))
  return p
}
function fillWith(ctx: Ctx, img: HTMLImageElement | undefined, fallback: string, scale = 1): void {
  ctx.fillStyle = pattern(ctx, img, scale) ?? fallback
}
function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}
function setLetterSpacing(ctx: Ctx, px: number): void {
  if ('letterSpacing' in ctx) (ctx as Ctx & { letterSpacing: string }).letterSpacing = `${px}px`
}
function text(ctx: Ctx, s: string, x: number, y: number, size: number, opts: { font?: string; colour?: string; align?: CanvasTextAlign; spacing?: number; shadow?: string; maxW?: number; rot?: number } = {}): void {
  ctx.save()
  ctx.translate(x, y)
  if (opts.rot) ctx.rotate(opts.rot)
  let fs = size
  ctx.font = `${fs}px ${opts.font ?? HEAD}`
  setLetterSpacing(ctx, opts.spacing ?? 0)
  if (opts.maxW) {
    const w = ctx.measureText(s).width
    if (w > opts.maxW) { fs = Math.max(6, (size * opts.maxW) / w); ctx.font = `${fs}px ${opts.font ?? HEAD}` }
  }
  ctx.fillStyle = opts.colour ?? '#efe6cf'
  ctx.textAlign = opts.align ?? 'center'
  ctx.textBaseline = 'middle'
  if (opts.shadow) { ctx.shadowColor = opts.shadow; ctx.shadowBlur = size * 0.12; ctx.shadowOffsetY = size * 0.05 }
  ctx.fillText(s, 0, 0)
  ctx.restore()
}
function dashedCircle(ctx: Ctx, x: number, y: number, r: number, colour: string, lw: number, fill?: string): void {
  ctx.save()
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  if (fill) { ctx.fillStyle = fill; ctx.fill() }
  ctx.setLineDash([lw * 2.2, lw * 1.6])
  ctx.lineWidth = lw
  ctx.strokeStyle = colour
  ctx.stroke()
  ctx.restore()
}
function overlay(ctx: Ctx, img: HTMLImageElement | undefined, x: number, y: number, w: number, h: number, alpha: number, blend: GlobalCompositeOperation = 'source-over'): void {
  if (!img) return
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.globalCompositeOperation = blend
  ctx.drawImage(img, x, y, w, h)
  ctx.restore()
}
function hazard(ctx: Ctx, set: TextureSet, x: number, y: number, w: number, h: number): void {
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  fillWith(ctx, set['hazard-stripes'], '#c8a02a', Math.max(0.6, h / 64))
  ctx.fillRect(x, y, w, h)
  ctx.restore()
}
function paper(ctx: Ctx, set: TextureSet, x: number, y: number, w: number, h: number, tint = 'rgba(0,0,0,0)', stained = false): void {
  fillWith(ctx, set[stained ? 'cardstock-stained' : 'paper-worn'], '#d9cba6', 1)
  ctx.fillRect(x, y, w, h)
  if (tint !== 'rgba(0,0,0,0)') { ctx.fillStyle = tint; ctx.fillRect(x, y, w, h) }
}
function chalkBox(ctx: Ctx, z: Zone, S: number, ox: number, oz: number, label: string[], accent = 'rgba(214,226,240,0.72)'): void {
  const x = (z.x - z.w / 2 + ox) * S, y = (z.z - z.d / 2 + oz) * S, w = z.w * S, h = z.d * S
  ctx.save()
  roundRectPath(ctx, x, y, w, h, 0.25 * S)
  ctx.fillStyle = 'rgba(8,14,24,0.5)'
  ctx.fill()
  ctx.setLineDash([0.34 * S, 0.22 * S])
  ctx.lineWidth = 0.07 * S
  ctx.strokeStyle = accent
  ctx.stroke()
  ctx.restore()
  label.forEach((l, i) => text(ctx, l, x + w / 2, y + (0.5 + i * 0.5) * S, 0.46 * S, { colour: accent, spacing: 0.05 * S }))
}

// ---------- the colony board ----------
export const BOARD_PX_PER_UNIT = 64
export function boardCanvasSize(): { w: number; h: number } { return { w: COLONY_SIZE.w * BOARD_PX_PER_UNIT, h: COLONY_SIZE.d * BOARD_PX_PER_UNIT } }

export function paintBoard(canvas: HTMLCanvasElement, L: ColonyLayout, set: TextureSet, colonyArt: HTMLImageElement | null = null): void {
  const S = BOARD_PX_PER_UNIT
  const { w, h } = boardCanvasSize()
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const ox = COLONY_SIZE.w / 2, oz = COLONY_SIZE.d / 2
  const X = (x: number): number => (x + ox) * S
  const Z = (z: number): number => (z + oz) * S
  const Zn = L.zones

  // slab: slate with a worn wood frame
  fillWith(ctx, set['slate'], '#1f2a3a', 1.1)
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = pattern(ctx, set['wood-planks'], 1) ?? '#4a3a2a'
  ctx.lineWidth = 0.55 * S
  ctx.strokeRect(0.27 * S, 0.27 * S, w - 0.54 * S, h - 0.54 * S)
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'
  ctx.lineWidth = 0.08 * S
  ctx.strokeRect(0.58 * S, 0.58 * S, w - 1.16 * S, h - 1.16 * S)

  // round track (left edge)
  {
    const r = Zn.rounds
    paper(ctx, set, X(r.x - r.w / 2), Z(r.z - r.d / 2), r.w * S, r.d * S, 'rgba(120,100,70,0.18)')
    ctx.strokeStyle = 'rgba(40,30,20,0.7)'; ctx.lineWidth = 0.05 * S
    ctx.strokeRect(X(r.x - r.w / 2), Z(r.z - r.d / 2), r.w * S, r.d * S)
    text(ctx, 'ROUNDS', X(r.x), Z(r.z - r.d / 2 + 0.45), 0.42 * S, { colour: '#7a1d17', spacing: 0.02 * S })
    L.roundTrack.forEach((p, i) => {
      dashedCircle(ctx, X(p.x), Z(p.z), 0.5 * S, 'rgba(60,45,30,0.45)', 0.04 * S)
      text(ctx, String(i), X(p.x), Z(p.z) + 0.03 * S, (i === 10 ? 0.62 : 0.78) * S, { colour: '#2a1f14' })
    })
  }

  // colony name picture
  {
    const n = Zn.name
    const x = X(n.x - n.w / 2), y = Z(n.z - n.d / 2), pw = n.w * S, ph = n.d * S
    ctx.save()
    roundRectPath(ctx, x, y, pw, ph, 0.12 * S)
    ctx.clip()
    const g = ctx.createLinearGradient(0, y, 0, y + ph)
    g.addColorStop(0, '#1b2638'); g.addColorStop(0.55, '#4b5d78'); g.addColorStop(1, '#aab6c6')
    ctx.fillStyle = g
    ctx.fillRect(x, y, pw, ph)
    if (colonyArt) {
      const ir = colonyArt.width / colonyArt.height, pr = pw / ph
      const dw = ir > pr ? ph * ir : pw, dh = ir > pr ? ph : pw / ir
      ctx.drawImage(colonyArt, x + (pw - dw) / 2, y + (ph - dh) / 2, dw, dh)
    }
    if (!colonyArt) {
    // the lodge: a long low roof, lit windows, a chimney
    ctx.fillStyle = '#12161e'
    ctx.beginPath()
    ctx.moveTo(x + pw * 0.08, y + ph * 0.78); ctx.lineTo(x + pw * 0.2, y + ph * 0.42); ctx.lineTo(x + pw * 0.62, y + ph * 0.32); ctx.lineTo(x + pw * 0.9, y + ph * 0.46); ctx.lineTo(x + pw * 0.94, y + ph * 0.8)
    ctx.closePath(); ctx.fill()
    ctx.fillRect(x + pw * 0.52, y + ph * 0.16, pw * 0.05, ph * 0.2)
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 3 === 1 ? 'rgba(255,208,120,0.95)' : 'rgba(255,208,120,0.4)'
      ctx.fillRect(x + pw * (0.25 + i * 0.1), y + ph * 0.56, pw * 0.045, ph * 0.12)
    }
    ctx.fillStyle = '#c9d3df'
    ctx.fillRect(x, y + ph * 0.78, pw, ph * 0.22)
    overlay(ctx, set['snow-flecks'], x, y, pw, ph, 0.85)
    }
    overlay(ctx, set['frost-edge'], x, y, pw, ph, 0.7)
    ctx.restore()
    ctx.strokeStyle = '#e6dcc2'; ctx.lineWidth = 0.1 * S
    roundRectPath(ctx, x, y, pw, ph, 0.12 * S); ctx.stroke()
    // name tag
    paper(ctx, set, x + 0.3 * S, y - 0.1 * S, 3.7 * S, 0.95 * S, 'rgba(0,0,0,0)', true)
    ctx.strokeStyle = '#2a1f14'; ctx.lineWidth = 0.05 * S; ctx.strokeRect(x + 0.3 * S, y - 0.1 * S, 3.7 * S, 0.95 * S)
    text(ctx, 'THE COLONY', x + 2.15 * S, y + 0.38 * S, 0.8 * S, { colour: '#1a130c', spacing: 0.04 * S })
  }

  // chalk zones
  chalkBox(ctx, Zn.objective, S, ox, oz, ['MAIN', 'OBJECTIVE'])
  chalkBox(ctx, Zn.waste, S, ox, oz, ['WASTE PILE'])
  chalkBox(ctx, Zn.crisis, S, ox, oz, ['CRISIS', 'DECK'])
  chalkBox(ctx, Zn.contribution, S, ox, oz, ['CRISIS', 'CONTRIBUTIONS'])
  // chalk pictures: target, bin, card back
  {
    const o = Zn.objective
    ctx.strokeStyle = 'rgba(214,226,240,0.55)'; ctx.lineWidth = 0.1 * S
    for (const r of [1.1, 0.7, 0.3]) { ctx.beginPath(); ctx.arc(X(o.x), Z(o.z + 0.55), r * S, 0, Math.PI * 2); ctx.stroke() }
    const b = Zn.waste
    ctx.strokeRect(X(b.x - 0.7), Z(b.z - 0.2), 1.4 * S, 1.8 * S)
    ctx.strokeRect(X(b.x - 0.85), Z(b.z - 0.5), 1.7 * S, 0.3 * S)
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(X(b.x + i * 0.35), Z(b.z)); ctx.lineTo(X(b.x + i * 0.35), Z(b.z + 1.4)); ctx.stroke() }
    const c = Zn.crisis
    roundRectPath(ctx, X(c.x - 0.8), Z(c.z - 0.3), 1.6 * S, 2.1 * S, 0.15 * S); ctx.stroke()
    paintPaths(ctx, [{ d: 'M12 3l2.2 6h6.2l-5 3.8 1.9 6.2-5.3-3.8-5.3 3.8 1.9-6.2-5-3.8h6.2z', stroke: 'rgba(214,226,240,0.55)', sw: 1.2 }], X(c.x - 0.55), Z(c.z + 0.2), 1.1 * S)
  }

  // blueprint floor plan
  {
    const b = Zn.blueprint
    const x = X(b.x - b.w / 2), y = Z(b.z - b.d / 2), bw = b.w * S, bh = b.d * S
    ctx.save()
    ctx.beginPath(); ctx.rect(x, y, bw, bh); ctx.clip()
    fillWith(ctx, set['blueprint'], '#1f4a82', 1.0)
    ctx.fillRect(x, y, bw, bh)
    ctx.strokeStyle = 'rgba(190,220,255,0.75)'; ctx.lineWidth = 0.09 * S; ctx.lineCap = 'butt'
    const wall = (x1: number, z1: number, x2: number, z2: number): void => { ctx.beginPath(); ctx.moveTo(X(x1), Z(z1)); ctx.lineTo(X(x2), Z(z2)); ctx.stroke() }
    const bx0 = -3.7, bx1 = 10.4, bz0 = -5.7, bz1 = 4.3
    // outer walls with a gap at each door
    const gap = 0.85
    const doorsTop = [-2.1, 6.5], doorsBot = [-2.1, 6.5], doorsLeft = [-3.2, 2.3]
    const segs = (from: number, to: number, doors: number[]): [number, number][] => {
      const out: [number, number][] = []
      let cur = from
      for (const d of [...doors].sort((p, q) => p - q)) { out.push([cur, d - gap]); cur = d + gap }
      out.push([cur, to])
      return out
    }
    for (const [a, c] of segs(bx0, bx1, doorsTop)) wall(a, bz0, c, bz0)
    for (const [a, c] of segs(bx0, bx1, doorsBot)) wall(a, bz1, c, bz1)
    for (const [a, c] of segs(bz0, bz1, doorsLeft)) wall(bx0, a, bx0, c)
    wall(bx1, bz0, bx1, bz1)
    // rooms
    ctx.lineWidth = 0.06 * S
    wall(bx0, -0.8, 1.4, -0.8); wall(4.6, -0.8, bx1, -0.8)
    wall(3.0, bz0, 3.0, -2.7); wall(3.0, 0.9, 3.0, bz1)
    wall(7.0, -0.8, 7.0, -3.0); wall(0.4, bz1, 0.4, 2.2)
    ctx.setLineDash([0.2 * S, 0.16 * S]); ctx.lineWidth = 0.04 * S
    ctx.strokeRect(X(4.0), Z(1.6), 2.4 * S, 1.8 * S); ctx.strokeRect(X(-2.8), Z(-4.8), 2.8 * S, 2.6 * S); ctx.strokeRect(X(7.8), Z(-4.8), 2.0 * S, 3.2 * S)
    ctx.setLineDash([])
    // arrows in from every pad
    ctx.fillStyle = 'rgba(190,220,255,0.7)'
    const arrow = (ax: number, az: number, dx: number, dz: number): void => {
      ctx.save(); ctx.translate(X(ax), Z(az)); ctx.rotate(Math.atan2(dz, dx))
      ctx.beginPath(); ctx.moveTo(0.4 * S, 0); ctx.lineTo(-0.2 * S, -0.3 * S); ctx.lineTo(-0.2 * S, 0.3 * S); ctx.closePath(); ctx.fill(); ctx.restore()
    }
    for (const e of L.entrances) {
      if (e.side === 'north') arrow(e.pad.x, e.pad.z + 1.9, 0, 1)
      else if (e.side === 'south') arrow(e.pad.x, e.pad.z - 1.9, 0, -1)
      else arrow(e.pad.x + 1.9, e.pad.z, 1, 0)
    }
    text(ctx, 'HOLD THE LINE', X(3.4), Z(-1.9), 1.5 * S, { colour: 'rgba(200,225,255,0.5)', spacing: 0.1 * S, rot: -0.07 })
    text(ctx, 'COLONY FLOOR PLAN  -  SHEET 1', X(7.9), Z(6.45), 0.38 * S, { colour: 'rgba(200,225,255,0.5)', spacing: 0.04 * S })
    ctx.restore()
    ctx.strokeStyle = 'rgba(8,16,30,0.8)'; ctx.lineWidth = 0.1 * S; ctx.strokeRect(x, y, bw, bh)
  }

  // entrance pads
  for (const e of L.entrances) {
    const p = e.pad
    const x = X(p.x - p.w / 2), y = Z(p.z - p.d / 2), pw = p.w * S, ph = p.d * S
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 0.25 * S; ctx.shadowOffsetY = 0.08 * S
    ctx.fillStyle = '#222'; ctx.fillRect(x, y, pw, ph)
    ctx.restore()
    hazard(ctx, set, x, y, pw, ph)
    const inset = 0.28 * S
    paper(ctx, set, x + inset, y + inset, pw - inset * 2, ph - inset * 2, 'rgba(70,80,90,0.28)')
    ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.lineWidth = 0.05 * S; ctx.strokeRect(x, y, pw, ph)
    for (const sp of e.spaces) {
      dashedCircle(ctx, X(sp.x), Z(sp.z), 0.62 * S, 'rgba(40,30,20,0.75)', 0.05 * S, 'rgba(255,255,255,0.12)')
      paintPaths(ctx, ZOMBIE_PATHS, X(sp.x) - 0.36 * S, Z(sp.z) - 0.36 * S, 0.72 * S)
      ctx.fillStyle = 'rgba(214,200,170,0.55)'; ctx.beginPath(); ctx.arc(X(sp.x), Z(sp.z), 0.6 * S, 0, Math.PI * 2); ctx.fill()
    }
    // the number badge sits on the outer corner of the pad
    const bxp = e.side === 'west' ? p.x - p.w / 2 + 0.05 : p.x - p.w / 2 + 0.25
    const bzp = e.side === 'north' ? p.z - p.d / 2 + 0.05 : e.side === 'south' ? p.z + p.d / 2 - 0.05 : p.z - p.d / 2 + 0.25
    ctx.beginPath(); ctx.arc(X(bxp), Z(bzp), 0.55 * S, 0, Math.PI * 2)
    ctx.fillStyle = '#a5231a'; ctx.fill(); ctx.lineWidth = 0.07 * S; ctx.strokeStyle = '#f1ead8'; ctx.stroke()
    text(ctx, String(e.index), X(bxp), Z(bzp) + 0.03 * S, 0.8 * S, { colour: '#fff4e0' })
  }

  // colony occupants
  {
    const o = Zn.occupants
    const x = X(o.x - o.w / 2), y = Z(o.z - o.d / 2)
    paper(ctx, set, x, y, o.w * S, o.d * S, 'rgba(120,100,70,0.12)')
    ctx.strokeStyle = 'rgba(40,30,20,0.7)'; ctx.lineWidth = 0.06 * S; ctx.strokeRect(x, y, o.w * S, o.d * S)
    text(ctx, 'COLONY OCCUPANTS', X(o.x), y + 0.42 * S, 0.5 * S, { colour: '#4a3a28', spacing: 0.04 * S })
    for (const p of L.occupants) dashedCircle(ctx, X(p.x), Z(p.z), 0.6 * S, 'rgba(70,56,38,0.6)', 0.045 * S)
  }

  // food supply
  {
    const f = Zn.food
    const x = X(f.x - f.w / 2), y = Z(f.z - f.d / 2)
    paper(ctx, set, x, y, f.w * S, f.d * S, 'rgba(120,100,70,0.12)', true)
    ctx.strokeStyle = 'rgba(40,30,20,0.7)'; ctx.lineWidth = 0.06 * S; ctx.strokeRect(x, y, f.w * S, f.d * S)
    text(ctx, 'FOOD SUPPLY', X(f.x), y + 0.34 * S, 0.5 * S, { colour: '#4a3a28', spacing: 0.04 * S })
    ctx.setLineDash([0.2 * S, 0.14 * S]); ctx.lineWidth = 0.04 * S; ctx.strokeStyle = 'rgba(70,56,38,0.55)'
    roundRectPath(ctx, x + 0.3 * S, y + 0.7 * S, (f.w - 0.6) * S, (f.d - 0.95) * S, 0.15 * S); ctx.stroke(); ctx.setLineDash([])
  }

  // morale track
  {
    const m = Zn.morale
    const x = X(m.x - m.w / 2), y = Z(m.z - m.d / 2)
    paper(ctx, set, x, y, m.w * S, m.d * S, 'rgba(120,100,70,0.2)')
    ctx.strokeStyle = 'rgba(40,30,20,0.7)'; ctx.lineWidth = 0.05 * S; ctx.strokeRect(x, y, m.w * S, m.d * S)
    text(ctx, 'MORALE', x + 0.95 * S, Z(m.z) + 0.02 * S, 0.5 * S, { colour: '#7a1d17', spacing: 0.04 * S })
    L.moraleTrack.forEach((p, i) => {
      text(ctx, String(i), X(p.x), Z(p.z) + 0.03 * S, 0.8 * S, { colour: '#2a1f14' })
      ctx.strokeStyle = 'rgba(40,30,20,0.35)'; ctx.lineWidth = 0.035 * S
      ctx.beginPath(); ctx.moveTo(X(p.x + 0.72), Z(m.z - 0.4)); ctx.lineTo(X(p.x + 0.72), Z(m.z + 0.4)); ctx.stroke()
    })
  }

  // weathering: blood, frost and a soft vignette over everything
  overlay(ctx, set['blood-speckle'], 0, 0, w, h, 0.55, 'multiply')
  overlay(ctx, set['frost-edge'], 0, 0, w, h, 0.5)
  const v = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.62)
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.35)')
  ctx.fillStyle = v; ctx.fillRect(0, 0, w, h)
}

// ---------- a location card ----------
export const TILE_PX_PER_UNIT = 76
export function tileCanvasSize(): { w: number; h: number } { return { w: Math.round(TILE_W * TILE_PX_PER_UNIT), h: Math.round(TILE_H * TILE_PX_PER_UNIT) } }

export interface TileInfo { id: string; name: string; number: number | null; symbols: readonly string[]; art: HTMLImageElement | null }

export function paintTile(canvas: HTMLCanvasElement, t: TileLayout, info: TileInfo, set: TextureSet): void {
  const S = TILE_PX_PER_UNIT
  const { w, h } = tileCanvasSize()
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const X = (x: number): number => (x + TILE_W / 2) * S
  const Z = (z: number): number => (z + TILE_H / 2) * S
  const hue = Math.round(190 + hash01(info.id) * 50)

  // card body
  roundRectPath(ctx, 0, 0, w, h, 0.4 * S)
  ctx.save()
  ctx.clip()
  paper(ctx, set, 0, 0, w, h, 'rgba(0,0,0,0)', true)

  // title plate with the number tab and the symbol row
  const ty0 = Z(TILE_BANDS.title.z0), tyh = (TILE_BANDS.title.z1 - TILE_BANDS.title.z0) * S
  fillWith(ctx, set['slate'], '#1f2a3a', 0.9)
  ctx.fillRect(0, ty0, w, tyh)
  ctx.fillStyle = 'rgba(10,14,22,0.35)'; ctx.fillRect(0, ty0, w, tyh)
  const tab = tyh
  paper(ctx, set, 0, ty0, tab, tyh, 'rgba(0,0,0,0)', true)
  ctx.strokeStyle = '#14100c'; ctx.lineWidth = 0.05 * S; ctx.strokeRect(0, ty0, tab, tyh)
  if (info.number !== null) text(ctx, String(info.number).padStart(2, '0'), tab / 2, ty0 + tyh / 2 + 0.02 * S, 0.82 * S, { colour: '#1a130c' })
  const symSize = 0.62 * S, symGap = 0.7 * S
  const symW = info.symbols.length * symGap
  text(ctx, info.name, tab + 0.25 * S, ty0 + tyh / 2 + 0.03 * S, 0.8 * S, { colour: '#f1ead8', align: 'left', spacing: 0.03 * S, maxW: w - tab - symW - 0.7 * S })
  info.symbols.forEach((s, i) => {
    const cx = w - 0.25 * S - symW + i * symGap
    ctx.beginPath(); ctx.arc(cx + symSize / 2, ty0 + tyh / 2, symSize * 0.62, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(8,12,20,0.78)'; ctx.fill()
    paintPaths(ctx, symbolPaths(s, SYMBOL_COLOUR[s]), cx, ty0 + tyh / 2 - symSize / 2, symSize)
  })

  // art panel: the location picture when we have it, otherwise a painted winter scene
  const ay0 = Z(TILE_BANDS.art.z0), ah = (TILE_BANDS.art.z1 - TILE_BANDS.art.z0) * S
  ctx.save()
  ctx.beginPath(); ctx.rect(0, ay0, w, ah); ctx.clip()
  if (info.art) {
    const ir = info.art.width / info.art.height, pr = w / ah
    const dw = ir > pr ? ah * ir : w, dh = ir > pr ? ah : w / ir
    ctx.drawImage(info.art, (w - dw) / 2, ay0 + (ah - dh) / 2, dw, dh)
  } else {
    const g = ctx.createLinearGradient(0, ay0, 0, ay0 + ah)
    g.addColorStop(0, `hsl(${hue} 32% 18%)`); g.addColorStop(0.6, `hsl(${hue + 8} 22% 46%)`); g.addColorStop(1, `hsl(${hue} 14% 78%)`)
    ctx.fillStyle = g; ctx.fillRect(0, ay0, w, ah)
    // a skyline of low buildings with a few lit windows, seeded by the location id
    ctx.fillStyle = `hsl(${hue} 30% 8%)`
    let bx = -0.2 * S
    let k = 0
    while (bx < w) {
      const bw = (0.9 + hash01(`${info.id}b${k}`) * 1.5) * S
      const bh = (0.7 + hash01(`${info.id}h${k}`) * 1.5) * S
      ctx.fillRect(bx, ay0 + ah * 0.75 - bh, bw, bh + ah * 0.3)
      for (let wy = 0; wy < 2; wy++) for (let wx = 0; wx < Math.floor(bw / (0.45 * S)); wx++) {
        if (hash01(`${info.id}w${k}${wx}${wy}`) > 0.62) { ctx.fillStyle = 'rgba(255,205,120,0.85)'; ctx.fillRect(bx + (0.15 + wx * 0.42) * S, ay0 + ah * 0.75 - bh + (0.2 + wy * 0.4) * S, 0.2 * S, 0.22 * S); ctx.fillStyle = `hsl(${hue} 30% 8%)` }
      }
      bx += bw + 0.08 * S; k++
    }
    ctx.fillStyle = 'rgba(214,224,236,0.9)'; ctx.fillRect(0, ay0 + ah * 0.78, w, ah)
    overlay(ctx, set['snow-flecks'], 0, ay0, w, ah, 0.8)
  }
  overlay(ctx, set['frost-edge'], 0, ay0, w, ah, 0.55)
  // the survivor circles
  for (const p of t.survivors) dashedCircle(ctx, X(p.x - t.centre.x), Z(p.z - t.centre.z), 0.62 * S, 'rgba(244,238,220,0.85)', 0.05 * S, 'rgba(10,14,22,0.28)')
  ctx.restore()
  ctx.strokeStyle = '#14100c'; ctx.lineWidth = 0.05 * S; ctx.beginPath(); ctx.moveTo(0, ay0); ctx.lineTo(w, ay0); ctx.moveTo(0, ay0 + ah); ctx.lineTo(w, ay0 + ah); ctx.stroke()

  // entrance strip: hazard stripes carrying the zombie / barricade spaces
  const sy0 = Z(TILE_BANDS.strip.z0), sh = (TILE_BANDS.strip.z1 - TILE_BANDS.strip.z0) * S
  hazard(ctx, set, 0, sy0, w, sh)
  for (const p of t.entrance) {
    const cx = X(p.x - t.centre.x), cy = Z(p.z - t.centre.z)
    ctx.fillStyle = 'rgba(224,214,188,0.95)'; roundRectPath(ctx, cx - 0.55 * S, cy - 0.55 * S, 1.1 * S, 1.1 * S, 0.12 * S); ctx.fill()
    ctx.setLineDash([0.12 * S, 0.1 * S]); ctx.lineWidth = 0.04 * S; ctx.strokeStyle = 'rgba(40,30,20,0.8)'; ctx.stroke(); ctx.setLineDash([])
    paintPaths(ctx, ZOMBIE_PATHS, cx - 0.3 * S, cy - 0.3 * S, 0.6 * S)
    ctx.fillStyle = 'rgba(224,214,188,0.55)'; ctx.fillRect(cx - 0.5 * S, cy - 0.5 * S, 1.0 * S, 1.0 * S)
  }
  ctx.strokeStyle = '#14100c'; ctx.lineWidth = 0.05 * S; ctx.strokeRect(0, sy0, w, sh)

  // search panel: dark, with a big magnifier and four noise slots down the right edge
  const py0 = Z(TILE_BANDS.search.z0), ph = (TILE_BANDS.search.z1 - TILE_BANDS.search.z0) * S
  fillWith(ctx, set['slate'], '#16202e', 0.9)
  ctx.fillRect(0.35 * S, py0, w - 0.7 * S, ph)
  ctx.fillStyle = 'rgba(6,10,18,0.5)'; ctx.fillRect(0.35 * S, py0, w - 0.7 * S, ph)
  ctx.strokeStyle = '#14100c'; ctx.lineWidth = 0.05 * S; ctx.strokeRect(0.35 * S, py0, w - 0.7 * S, ph)
  ctx.save(); ctx.globalAlpha = 0.28
  paintPaths(ctx, SEARCH_PATHS, X(-2.6), py0 + 0.1 * S, 2.4 * S)
  ctx.restore()
  text(ctx, 'SEARCH', X(0.1), py0 + 0.5 * S, 0.5 * S, { colour: 'rgba(214,226,240,0.6)', spacing: 0.08 * S })
  for (const p of t.noise) {
    const cx = X(p.x - t.centre.x), cy = Z(p.z - t.centre.z)
    dashedCircle(ctx, cx, cy, 0.27 * S, 'rgba(240,184,64,0.75)', 0.035 * S, 'rgba(0,0,0,0.35)')
    ctx.save(); ctx.globalAlpha = 0.5; paintPaths(ctx, NOISE_PATHS, cx - 0.2 * S, cy - 0.2 * S, 0.4 * S); ctx.restore()
  }

  // weathering and the edge of the card
  overlay(ctx, set['blood-speckle'], 0, 0, w, h, 0.45, 'multiply')
  overlay(ctx, set['frost-edge'], 0, 0, w, h, 0.55)
  ctx.restore()
  ctx.strokeStyle = '#120e0a'; ctx.lineWidth = 0.1 * S
  roundRectPath(ctx, 0.05 * S, 0.05 * S, w - 0.1 * S, h - 0.1 * S, 0.4 * S); ctx.stroke()
}
