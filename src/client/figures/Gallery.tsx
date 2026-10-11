// ?gallery: every figure on a turntable. All survivors (their GLB on a seat-coloured base when the manifest lists one, otherwise the procedural
// body), the procedural zombie, every listed zombie GLB, and any other listed model. Each cell is named with its state. Owner review and screenshots.
import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useRef, useState, type ReactElement } from 'react'
import * as THREE from 'three'
import type { DataBundle } from '../../data/types'
import { nameOf, setClientBundle } from '../data'
import { loadClientBundle } from '../dataLoad'
import { LabelSprite } from '../table/LabelSprite'
import { G, M, ProceduralBody } from '../table/sceneKit'
import { SEAT_COLOURS } from '../table/seats'
import '../ui/hud.css'
import { GlbSurvivor, ZOMBIE_HEIGHT } from './GlbBody'
import { glbStatus, useGlbClone } from './glbLoader'
import { glbSlugs, isZombieSlug, survivorSlug, useGlbManifest } from './glbManifest'

export const galleryRequested = (search = typeof location !== 'undefined' ? location.search : ''): boolean => new URLSearchParams(search).has('gallery')

interface Cell { key: string; label: string; slug?: string; kind: 'survivor' | 'zombie' | 'other'; colour: string; note: string }
const COLS = 6
const DX = 4.6
const DZ = 5.4

function Turn({ children, x, z }: { children: ReactElement; x: number; z: number }): ReactElement {
  const g = useRef<THREE.Group>(null)
  useFrame((_, dt) => { if (g.current) g.current.rotation.y += dt * 0.6 })
  return <group position={[x, 0, z]}><group ref={g}>{children}</group></group>
}

/** A listed model of any kind: scaled to a standard height on a neutral base. */
function AnyModel({ slug, colour, zombie }: { slug: string; colour: string; zombie: boolean }): ReactElement | null {
  const c = useGlbClone(slug)
  if (!c) return null
  if (!zombie) return <GlbSurvivor clone={c} colour={colour} />
  const f = c.glb.fit(ZOMBIE_HEIGHT, 1.7)
  const p = new THREE.Vector3().setFromMatrixPosition(f.matrix)
  return <group position={[p.x, p.y, p.z]} scale={f.scale}><primitive object={c.object} /></group>
}

function GalleryCell({ cell, x, z }: { cell: Cell; x: number; z: number }): ReactElement {
  const clone = useGlbClone(cell.slug)
  let body: ReactElement
  if (cell.slug && clone) body = <AnyModel slug={cell.slug} colour={cell.colour} zombie={cell.kind === 'zombie'} />
  else if (cell.kind === 'zombie') body = <mesh geometry={G.capsule} material={M.zombie} position-y={0.7} />
  else body = <ProceduralBody colour={cell.colour} />
  return (
    <>
      <Turn x={x} z={z}>{body}</Turn>
      <LabelSprite text={cell.label} position={[x, 3.5, z]} height={0.7} fontPx={12} border={cell.colour} />
      <LabelSprite text={cell.note} position={[x, -0.5, z + 1.4]} height={0.5} fontPx={10} bare />
    </>
  )
}

function buildCells(b: DataBundle | null): Cell[] {
  const cells: Cell[] = []
  const used = new Set<string>()
  b?.records.survivors.forEach((s, i) => {
    const slug = survivorSlug(s.id)
    if (slug) used.add(slug)
    cells.push({ key: s.id, label: nameOf(s.id), kind: 'survivor', colour: SEAT_COLOURS[i % SEAT_COLOURS.length]!, slug, note: slug ? `GLB ${slug} (${glbStatus(slug)})` : 'procedural' })
  })
  const zs = glbSlugs().filter(isZombieSlug)
  cells.push({ key: 'zombie-procedural', label: 'Zombie', kind: 'zombie', colour: '#6f9560', note: 'procedural (fallback)' })
  for (const z of zs) { used.add(z); cells.push({ key: z, label: z, kind: 'zombie', colour: '#6f9560', slug: z, note: `GLB (${glbStatus(z)})` }) }
  for (const s of glbSlugs()) if (!used.has(s)) cells.push({ key: s, label: s, kind: 'other', colour: '#b0b6c0', slug: s, note: `GLB (${glbStatus(s)})` })
  return cells
}

export default function Gallery(): ReactElement {
  const [b, setB] = useState<DataBundle | null>(null)
  const listed = useGlbManifest()
  useEffect(() => { void loadClientBundle().then((x) => { setClientBundle(x); setB(x) }) }, [])
  const cells = buildCells(b)
  const rows = Math.ceil(cells.length / COLS)
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0b0e14' }} data-testid="figure-gallery" data-count={cells.length} data-glb={listed}>
      <div style={{ position: 'absolute', left: 14, top: 10, zIndex: 2, font: '14px system-ui', color: '#cdbb90' }}>
        <b style={{ fontFamily: 'var(--f-head)', fontSize: 24, letterSpacing: '0.06em', color: '#e8c050' }}>FIGURE GALLERY</b>
        <div>{cells.length} figures, {listed} listed in public/assets/models/manifest.json. Procedural bodies stand in for any model that is not listed.</div>
      </div>
      <Canvas frameloop="always" dpr={[1, 1.5]} camera={{ position: [0, 22 + rows * 1.2, rows * DZ * 0.5 + 24], fov: 42, near: 0.5, far: 300 }}>
        <color attach="background" args={['#0b0e14']} />
        <hemisphereLight args={['#a9bde6', '#2a2f3c', 1.6]} />
        <directionalLight position={[10, 30, 20]} intensity={2} />
        <OrbitControls target={[0, 1, (rows - 1) * DZ * 0.5 - 2]} />
        <mesh rotation-x={-Math.PI / 2} position-y={-0.01}><planeGeometry args={[200, 200]} /><meshStandardMaterial color="#1b2230" /></mesh>
        {cells.map((c, i) => <GalleryCell key={c.key} cell={c} x={((i % COLS) - (COLS - 1) / 2) * DX} z={Math.floor(i / COLS) * DZ} />)}
      </Canvas>
    </div>
  )
}
