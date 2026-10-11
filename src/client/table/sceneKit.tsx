// Shared 3D pieces: geometries, materials, the instancing helper and the procedural figure body. Used by the table and by the ?gallery view.
import { useLayoutEffect, useRef, type ReactElement } from 'react'
import * as THREE from 'three'
import type { Pt } from './layout'

export const G = {
  disc: new THREE.CircleGeometry(0.55, 20),
  small: new THREE.CircleGeometry(0.3, 14),
  square: new THREE.PlaneGeometry(1.05, 1.05),
  capsule: new THREE.CapsuleGeometry(0.26, 0.62, 4, 8),
  plank: new THREE.BoxGeometry(1.0, 0.55, 0.16),
  token: new THREE.CylinderGeometry(0.3, 0.3, 0.18, 14),
  food: new THREE.CylinderGeometry(0.22, 0.22, 0.12, 12),
  card: new THREE.BoxGeometry(1.5, 0.05, 2.1),
  base: new THREE.CylinderGeometry(0.55, 0.62, 0.14, 20),
  head: new THREE.SphereGeometry(0.2, 12, 10),
  pip: new THREE.SphereGeometry(0.09, 8, 6),
  ring: new THREE.TorusGeometry(0.5, 0.05, 6, 24),
}
export const M = {
  zombie: new THREE.MeshStandardMaterial({ color: '#6f9560', roughness: 0.8 }),
  barricade: new THREE.MeshStandardMaterial({ color: '#8a6a3e', roughness: 0.85 }),
  noise: new THREE.MeshStandardMaterial({ color: '#f0b840', emissive: '#7a4f00', roughness: 0.5 }),
  helpless: new THREE.MeshStandardMaterial({ color: '#d8d2c4', roughness: 0.8 }),
  wound: new THREE.MeshStandardMaterial({ color: '#d03a3a', emissive: '#601010' }),
  frost: new THREE.MeshStandardMaterial({ color: '#8fd2ff', emissive: '#244a66' }),
  gold: new THREE.MeshStandardMaterial({ color: '#c9a227', emissive: '#4a3a08', roughness: 0.4 }),
  ice: new THREE.MeshStandardMaterial({ color: '#7fb2d6', emissive: '#1d3a52', roughness: 0.4 }),
  food: new THREE.MeshStandardMaterial({ color: '#8fc36b', emissive: '#1e3a10', roughness: 0.5 }),
  cardBack: new THREE.MeshStandardMaterial({ color: '#4a3f33', roughness: 0.8 }),
  stack: new THREE.MeshStandardMaterial({ color: '#3b4252', roughness: 0.7 }),
  select: new THREE.MeshBasicMaterial({ color: '#ffe07a', transparent: true, opacity: 0.9 }),
}

const seatMats = new Map<string, { base: THREE.MeshStandardMaterial; body: THREE.MeshStandardMaterial }>()
export function matsFor(colour: string): { base: THREE.MeshStandardMaterial; body: THREE.MeshStandardMaterial } {
  let m = seatMats.get(colour)
  if (!m) {
    m = {
      base: new THREE.MeshStandardMaterial({ color: colour, roughness: 0.6 }),
      body: new THREE.MeshStandardMaterial({ color: new THREE.Color(colour).lerp(new THREE.Color('#d8d4cc'), 0.45), roughness: 0.7 }),
    }
    seatMats.set(colour, m)
  }
  return m
}

/** One instanced mesh for every point of a kind (zombies, barricades, noise, tokens): a single draw call however many there are. */
export function Instanced({ points, max, y, geometry, material, flat = false, scale = 1, jitter = false }: {
  points: readonly Pt[]; max: number; y: number; geometry: THREE.BufferGeometry; material: THREE.Material; flat?: boolean; scale?: number; jitter?: boolean
}): ReactElement {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new THREE.Object3D()
    const n = Math.min(points.length, max)
    for (let i = 0; i < n; i++) {
      o.position.set(points[i]!.x, y, points[i]!.z)
      o.rotation.set(flat ? -Math.PI / 2 : 0, jitter ? ((i * 2.399) % 1 - 0.5) * 0.9 : 0, 0)
      o.scale.setScalar(scale)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    }
    m.count = n
    m.instanceMatrix.needsUpdate = true
  }, [points, max, y, flat, scale, jitter])
  return <instancedMesh ref={ref} args={[geometry, material, max]} frustumCulled={false} />
}

/** The procedural survivor: a round seat-coloured base, a capsule body and a head. */
export function ProceduralBody({ colour }: { colour: string }): ReactElement {
  const mats = matsFor(colour)
  return (
    <>
      <mesh geometry={G.base} material={mats.base} position-y={0.07} />
      <mesh geometry={G.capsule} material={mats.body} position-y={0.78} />
      <mesh geometry={G.head} material={mats.body} position-y={1.42} />
    </>
  )
}
