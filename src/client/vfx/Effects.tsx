// The 3D effects layer: light snowfall and a flickering firelight at the colony. Both are cheap (one Points object, one point light and
// one additive decal) and both ask the demand frameloop for frames only while active (see fx.ts); on Low graphics nothing here renders.
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type ReactElement } from 'react'
import * as THREE from 'three'
import { FX_FPS, flakeAt, flicker, useAmbientFx } from './fx'

const SNOW_COUNT = 800
const SNOW_X = 100
const SNOW_Z = 80
const SNOW_H = 34

function softDot(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 32
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.45, 'rgba(235,244,255,0.75)')
  grad.addColorStop(1, 'rgba(235,244,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 32, 32)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Asks for a frame FX_FPS times a second while `on`, so the otherwise idle demand loop animates the effects and nothing more. */
function Ticker({ on }: { on: boolean }): null {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    if (!on) return
    const id = setInterval(() => invalidate(), 1000 / FX_FPS)
    return () => clearInterval(id)
  }, [on, invalidate])
  return null
}

function Snow(): ReactElement {
  const ref = useRef<THREE.Points>(null)
  const seeds = useMemo(() => {
    // a fixed pseudo-random spread (no Math.random: the same snow every load)
    let a = 0x9e3779b9
    const rnd = (): number => { a = (Math.imul(a ^ (a >>> 15), 2246822507) + 0x6d2b79f5) >>> 0; return a / 4294967296 }
    return Array.from({ length: SNOW_COUNT }, () => ({
      x: (rnd() - 0.5) * SNOW_X, y: rnd() * SNOW_H, z: (rnd() - 0.5) * SNOW_Z, speed: 2.2 + rnd() * 3.2, sway: 0.6 + rnd() * 1.4, phase: rnd() * 6.28,
    }))
  }, [])
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SNOW_COUNT * 3), 3))
    return g
  }, [])
  const material = useMemo(() => new THREE.PointsMaterial({
    size: 1.3, map: softDot(), transparent: true, opacity: 0.9, depthWrite: false, sizeAttenuation: true, color: '#eef5ff', fog: false,
  }), [])
  useEffect(() => () => { geometry.dispose(); material.map?.dispose(); material.dispose() }, [geometry, material])
  useFrame(({ clock }) => {
    const pos = geometry.getAttribute('position') as THREE.BufferAttribute
    const t = clock.getElapsedTime()
    for (let i = 0; i < SNOW_COUNT; i++) {
      const p = flakeAt(seeds[i]!, t, SNOW_H)
      pos.setXYZ(i, p.x, p.y, p.z)
    }
    pos.needsUpdate = true
  })
  return <points ref={ref} geometry={geometry} material={material} frustumCulled={false} renderOrder={5} />
}

function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,170,80,0.9)')
  grad.addColorStop(0.5, 'rgba(255,120,40,0.35)')
  grad.addColorStop(1, 'rgba(255,90,20,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

/** A warm point light over the colony board and a faint glow on the board itself, both flickering. */
function FireLight(): ReactElement {
  const light = useRef<THREE.PointLight>(null)
  const glow = useRef<THREE.MeshBasicMaterial>(null)
  const map = useMemo(glowTexture, [])
  useEffect(() => () => map.dispose(), [map])
  useFrame(({ clock }) => {
    const f = flicker(clock.getElapsedTime())
    if (light.current) light.current.intensity = 30 + 70 * f
    if (glow.current) glow.current.opacity = 0.1 + 0.2 * f
  })
  return (
    <>
      <pointLight ref={light} position={[0, 3.2, 0]} color="#ff8a3c" intensity={60} distance={34} decay={1.7} />
      <mesh rotation-x={-Math.PI / 2} position-y={0.36} renderOrder={2}>
        <planeGeometry args={[34, 17]} />
        <meshBasicMaterial ref={glow} map={map} transparent opacity={0.2} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} />
      </mesh>
    </>
  )
}

export function Effects(): ReactElement | null {
  const on = useAmbientFx()
  if (!on) return null
  return (
    <>
      <Ticker on />
      <Snow />
      <FireLight />
    </>
  )
}
