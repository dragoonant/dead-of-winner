// Pure helpers for the shared card preview: what can be previewed, a stable key for it, and where the overlay goes.
// No React, no DOM: the placement maths is unit-tested (tests/client/preview.test.ts).

export type NoteKind = 'secret' | 'betrayal' | 'exiled'

/** One previewable card. The overlay renders the matching card component at full size. */
export type PreviewSpec =
  | { kind: 'survivor'; id: string }
  | { kind: 'item'; defId: string | undefined }
  | { kind: 'crisis'; id: string | null | undefined }
  | { kind: 'main'; id: string; hardcore?: boolean }
  | { kind: 'note'; id: string; note?: NoteKind }
  | { kind: 'crossroads'; id: string | undefined }

export interface Pt { x: number; y: number }
export interface Box { left: number; top: number; width: number; height: number }
export interface Size { w: number; h: number }

export const previewKey = (s: PreviewSpec): string => {
  switch (s.kind) {
    case 'survivor': return `survivor:${s.id}`
    case 'item': return `item:${s.defId ?? ''}`
    case 'crisis': return `crisis:${s.id ?? ''}`
    case 'main': return `main:${s.id}:${s.hardcore ? 'h' : 'n'}`
    case 'note': return `note:${s.id}:${s.note ?? ''}`
    case 'crossroads': return `crossroads:${s.id ?? ''}`
  }
}

const clamp = (v: number, lo: number, hi: number): number => (hi < lo ? lo : Math.min(Math.max(v, lo), hi))

export interface PlaceInput {
  /** Follow the cursor: the card sits beside this point. */
  point?: Pt
  /** Anchor to an element's box (touch long-press, the hand fan): used when there is no point. */
  box?: Box
  /** With a box: 'above' tries to sit over the box first, 'side' goes beside it. */
  prefer?: 'above' | 'side'
  size: Size
  viewport: Size
  /** Space between the cursor or anchor and the card. */
  gap?: number
  /** Minimum distance kept to every viewport edge. */
  margin?: number
  /** The top edge nothing may cover (the top bar). Only used by the 'above' placement. */
  topInset?: number
}

/** Where the preview's top-left goes. The result always keeps the whole card inside the viewport when it fits. */
export function placePreview(i: PlaceInput): { left: number; top: number } {
  const { size: { w, h }, viewport: { w: vw, h: vh } } = i
  const gap = i.gap ?? 16
  const m = i.margin ?? 8
  const fit = (left: number, top: number): { left: number; top: number } => ({ left: clamp(left, m, vw - w - m), top: clamp(top, m, vh - h - m) })
  if (i.box && !i.point) {
    const b = i.box
    if (i.prefer === 'above') {
      const top = b.top - gap - h
      if (top >= (i.topInset ?? m)) return fit(b.left + b.width / 2 - w / 2, top)
    }
    const right = b.left + b.width + gap
    const left = b.left - gap - w
    const spaceR = vw - m - right
    const spaceL = b.left - gap - m
    const x = w <= spaceR ? right : w <= spaceL ? left : spaceR >= spaceL ? right : left
    return fit(x, b.top + b.height / 2 - h / 2)
  }
  const p = i.point ?? { x: vw / 2, y: vh / 2 }
  const x = p.x + gap + w <= vw - m ? p.x + gap : p.x - gap - w
  return fit(x, p.y - h / 2)
}

/** The size class to render at: portrait cards drop to `lg` when the viewport is too short for `xl`. */
export function previewCardSize(spec: PreviewSpec, viewportH: number): 'lg' | 'xl' {
  const portrait = spec.kind === 'survivor' || spec.kind === 'item' || spec.kind === 'crisis'
  return portrait && viewportH < 470 ? 'lg' : 'xl'
}
