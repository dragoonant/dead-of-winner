// A text tag drawn into the 3D scene: a pill on a canvas texture shown as a camera-facing sprite. No fonts or network needed.
import { useMemo, type ReactElement } from 'react'
import * as THREE from 'three'

const PX = 2 // canvas pixels per CSS pixel, for crisp text
const CACHE = new Map<string, { tex: THREE.CanvasTexture; aspect: number }>()

function labelTexture(text: string, border: string, fontPx: number, bare: boolean): { tex: THREE.CanvasTexture; aspect: number } {
  const key = `${text}|${border}|${fontPx}|${bare}`
  const hit = CACHE.get(key)
  if (hit) return hit
  const font = `700 ${fontPx * PX}px system-ui, sans-serif`
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')!
  ctx.font = font
  const padX = fontPx * 0.8 * PX
  const padY = fontPx * 0.45 * PX
  const line = 2 * PX
  const w = Math.ceil(ctx.measureText(text).width + padX * 2 + line * 2)
  const h = Math.ceil(fontPx * PX + padY * 2 + line * 2)
  c.width = w
  c.height = h
  ctx.font = font
  if (!bare) {
    ctx.beginPath()
    ctx.roundRect(line, line, w - line * 2, h - line * 2, h / 2 - line)
    ctx.fillStyle = 'rgba(16,18,22,0.82)'
    ctx.fill()
    ctx.lineWidth = line
    ctx.strokeStyle = border
    ctx.stroke()
  }
  ctx.fillStyle = '#f2efe8'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = '#000'
  ctx.shadowBlur = 3 * PX
  ctx.fillText(text, w / 2, h / 2 + PX)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  const out = { tex, aspect: w / h }
  CACHE.set(key, out)
  return out
}

/** `height` is the label height in world units; the sprite keeps its aspect ratio and faces the camera. */
export function LabelSprite({ text, border = '#c9a227', position, height = 0.9, fontPx = 14, bare = false }: {
  text: string; border?: string; position: [number, number, number]; height?: number; fontPx?: number; bare?: boolean
}): ReactElement {
  const { tex, aspect } = useMemo(() => labelTexture(text, border, fontPx, bare), [text, border, fontPx, bare])
  const mat = useMemo(() => new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }), [tex])
  return <sprite material={mat} position={position} scale={[height * aspect, height, 1]} renderOrder={20} />
}
