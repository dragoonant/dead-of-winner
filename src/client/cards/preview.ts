// The shared card-preview state and the event wiring every card uses. `previewProps(spec)` returns the handlers to spread on any element
// that stands for a card: the mouse shows the full card beside the cursor, a touch long-press shows it anchored to the element, and a tap
// elsewhere closes it. The overlay itself (CardPreview.tsx) never takes pointer events, so showing it cannot change what is under the cursor.
import type { MouseEvent, PointerEvent } from 'react'
import { create } from 'zustand'
import { previewKey, type Box, type Pt, type PreviewSpec } from './previewModel'

export interface PreviewOpts {
  /** Where a box-anchored preview (touch, or `anchor: 'box'`) goes relative to the element. */
  prefer?: 'above' | 'side'
  /** Mouse: anchor to the element's box instead of following the cursor (the hand fan, whose slot never moves). */
  anchor?: 'cursor' | 'box'
  /** Render size override. */
  size?: 'lg' | 'xl'
}

interface PreviewState {
  spec: PreviewSpec | null
  key: string
  point: Pt | null
  box: Box | null
  prefer: 'above' | 'side'
  size: 'lg' | 'xl' | null
  /** The element the preview came from: if it leaves the page (a clicked card is removed) the preview closes. */
  source: Element | null
  touch: boolean
}

const EMPTY: PreviewState = { spec: null, key: '', point: null, box: null, prefer: 'side', size: null, source: null, touch: false }
export const usePreviewStore = create<PreviewState>(() => ({ ...EMPTY }))

export function hidePreview(key?: string): void {
  const s = usePreviewStore.getState()
  if (!s.spec || (key !== undefined && s.key !== key)) return
  usePreviewStore.setState({ ...EMPTY })
}

const boxOf = (el: Element): Box => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height } }

/** Show (or move) the preview for a pointer at `point`. Safe to call on every pointermove. */
export function showPreviewAt(spec: PreviewSpec, point: Pt, source: Element | null, opts: PreviewOpts = {}): void {
  const key = previewKey(spec)
  const s = usePreviewStore.getState()
  if (s.key === key && !s.touch) {
    if (!s.box) usePreviewStore.setState({ point })
    return
  }
  const box = opts.anchor === 'box' && source ? boxOf(source) : null
  usePreviewStore.setState({ spec, key, point: box ? null : point, box, prefer: opts.prefer ?? 'side', size: opts.size ?? null, source, touch: false })
}

function showPreviewBox(spec: PreviewSpec, source: Element, opts: PreviewOpts): void {
  usePreviewStore.setState({ spec, key: previewKey(spec), point: null, box: boxOf(source), prefer: opts.prefer ?? 'side', size: opts.size ?? null, source, touch: true })
}

// ---- touch: long-press shows, a tap anywhere closes ----
const LONG_PRESS_MS = 450
const SLOP_PX = 10
let pressTimer: ReturnType<typeof setTimeout> | undefined
let pressStart: Pt | null = null
let suppressClick = false

const clearPress = (): void => { if (pressTimer !== undefined) clearTimeout(pressTimer); pressTimer = undefined; pressStart = null }

function armTapAway(): void {
  const off = (): void => {
    window.removeEventListener('pointerdown', off, true)
    window.removeEventListener('scroll', off, true)
    suppressClick = false
    hidePreview()
  }
  // the long-press's own pointerdown has already fired; the next one (a tap elsewhere, or on the card again) closes the preview
  window.addEventListener('pointerdown', off, true)
  window.addEventListener('scroll', off, true)
}

export interface PreviewHandlers {
  onPointerEnter: (e: PointerEvent<Element>) => void
  onPointerMove: (e: PointerEvent<Element>) => void
  onPointerLeave: (e: PointerEvent<Element>) => void
  onPointerDown: (e: PointerEvent<Element>) => void
  onPointerUp: () => void
  onPointerCancel: () => void
  onClickCapture: (e: MouseEvent<Element>) => void
  onContextMenu: (e: MouseEvent<Element>) => void
}

/** Spread on any element that is, or stands for, a card. Nested previewables are fine: the innermost under the cursor wins. */
export function previewProps(spec: PreviewSpec, opts: PreviewOpts = {}): PreviewHandlers {
  const key = previewKey(spec)
  const mouseShow = (e: PointerEvent<Element>): void => {
    if (e.pointerType === 'touch') return
    e.stopPropagation()
    showPreviewAt(spec, { x: e.clientX, y: e.clientY }, e.currentTarget, opts)
  }
  return {
    onPointerEnter: mouseShow,
    onPointerMove: (e) => {
      if (e.pointerType === 'touch') {
        if (pressStart && Math.hypot(e.clientX - pressStart.x, e.clientY - pressStart.y) > SLOP_PX) clearPress()
        return
      }
      mouseShow(e)
    },
    onPointerLeave: (e) => { if (e.pointerType !== 'touch') hidePreview(key) },
    onPointerDown: (e) => {
      if (e.pointerType !== 'touch') return
      clearPress()
      suppressClick = false
      const el = e.currentTarget
      pressStart = { x: e.clientX, y: e.clientY }
      pressTimer = setTimeout(() => {
        pressTimer = undefined
        pressStart = null
        suppressClick = true
        showPreviewBox(spec, el, opts)
        armTapAway()
      }, LONG_PRESS_MS)
    },
    onPointerUp: clearPress,
    onPointerCancel: clearPress,
    // the click that ends a long-press must not also select / play the card
    onClickCapture: (e) => { if (suppressClick) { suppressClick = false; e.preventDefault(); e.stopPropagation() } },
    // browsers open a context menu on a long touch; block it only for the press we are handling
    onContextMenu: (e) => { if (pressTimer !== undefined || suppressClick || usePreviewStore.getState().touch) e.preventDefault() },
  }
}
