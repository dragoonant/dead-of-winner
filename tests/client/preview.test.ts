import { describe, expect, it } from 'vitest'
import { placePreview, previewCardSize, previewKey, type Size } from '../../src/client/cards/previewModel'

const VP: Size = { w: 1280, h: 760 }
const CARD: Size = { w: 300, h: 420 }
const inside = (p: { left: number; top: number }, s: Size, vp: Size, m = 8): boolean =>
  p.left >= m && p.top >= m && p.left + s.w <= vp.w - m && p.top + s.h <= vp.h - m

describe('card preview placement', () => {
  it('sits to the right of the cursor, vertically centred on it', () => {
    const p = placePreview({ point: { x: 400, y: 380 }, size: CARD, viewport: VP })
    expect(p.left).toBe(416)
    expect(p.top).toBe(380 - 210)
  })

  it('flips to the left of the cursor near the right edge', () => {
    const p = placePreview({ point: { x: 1200, y: 380 }, size: CARD, viewport: VP })
    expect(p.left).toBe(1200 - 16 - 300)
    expect(inside(p, CARD, VP)).toBe(true)
  })

  it('clamps inside the viewport at every corner and edge', () => {
    for (const x of [0, 3, 640, 1277, 1280]) {
      for (const y of [0, 5, 380, 755, 760]) {
        const p = placePreview({ point: { x, y }, size: CARD, viewport: VP })
        expect(inside(p, CARD, VP), `${x},${y} -> ${p.left},${p.top}`).toBe(true)
      }
    }
  })

  it('never lands under the cursor when there is room on either side', () => {
    for (const x of [10, 200, 640, 1000, 1270]) {
      const p = placePreview({ point: { x, y: 300 }, size: CARD, viewport: VP })
      const covers = x >= p.left && x <= p.left + CARD.w
      expect(covers, `x=${x} left=${p.left}`).toBe(false)
    }
  })

  it('pins to the margin when the card is larger than the viewport', () => {
    const p = placePreview({ point: { x: 100, y: 100 }, size: { w: 300, h: 900 }, viewport: { w: 1280, h: 600 } })
    expect(p.top).toBe(8)
  })

  describe('anchored to a box (touch long-press, the hand fan)', () => {
    const box = { left: 600, top: 600, width: 78, height: 124 }

    it('prefers above the box, centred on it', () => {
      const p = placePreview({ box, prefer: 'above', size: { w: 220, h: 308 }, viewport: VP, topInset: 48 })
      expect(p.top).toBe(600 - 16 - 308)
      expect(p.left).toBe(600 + 39 - 110)
    })

    it('falls back to beside the box when there is no room above', () => {
      const low = { left: 600, top: 270, width: 78, height: 124 }
      const p = placePreview({ box: low, prefer: 'above', size: { w: 220, h: 308 }, viewport: { w: 1280, h: 400 }, topInset: 48 })
      expect(p.left).toBe(600 + 78 + 16)
      expect(inside(p, { w: 220, h: 308 }, { w: 1280, h: 400 })).toBe(true)
    })

    it('goes beside the box, on the side with room', () => {
      const right = placePreview({ box: { left: 100, top: 300, width: 100, height: 100 }, size: CARD, viewport: VP })
      expect(right.left).toBe(216)
      const left = placePreview({ box: { left: 1100, top: 300, width: 100, height: 100 }, size: CARD, viewport: VP })
      expect(left.left).toBe(1100 - 16 - 300)
      expect(inside(left, CARD, VP)).toBe(true)
    })

    it('keeps a box in the corner on screen', () => {
      const p = placePreview({ box: { left: 1250, top: 740, width: 20, height: 20 }, size: CARD, viewport: VP })
      expect(inside(p, CARD, VP)).toBe(true)
    })
  })

  it('a point wins over a box', () => {
    const p = placePreview({ point: { x: 400, y: 380 }, box: { left: 900, top: 100, width: 50, height: 50 }, size: CARD, viewport: VP })
    expect(p.left).toBe(416)
  })
})

describe('preview keys and sizes', () => {
  it('keys distinguish cards and sides but not object identity', () => {
    expect(previewKey({ kind: 'survivor', id: 'a' })).toBe(previewKey({ kind: 'survivor', id: 'a' }))
    expect(previewKey({ kind: 'survivor', id: 'a' })).not.toBe(previewKey({ kind: 'survivor', id: 'b' }))
    expect(previewKey({ kind: 'main', id: 'm', hardcore: true })).not.toBe(previewKey({ kind: 'main', id: 'm' }))
    expect(previewKey({ kind: 'item', defId: undefined })).toBe('item:')
  })

  it('portrait cards drop to large in a short viewport; the rest stay extra large', () => {
    expect(previewCardSize({ kind: 'survivor', id: 'a' }, 760)).toBe('xl')
    expect(previewCardSize({ kind: 'survivor', id: 'a' }, 420)).toBe('lg')
    expect(previewCardSize({ kind: 'crossroads', id: 'c' }, 420)).toBe('xl')
  })
})
