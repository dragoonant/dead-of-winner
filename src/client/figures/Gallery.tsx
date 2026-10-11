// ?gallery: every figure on a turntable. All survivors (their GLB on a seat-coloured base when the manifest lists one, otherwise the procedural
// body), the procedural zombie, every listed zombie GLB, and any other listed model. Each cell is named with its state. Owner review and screenshots.
import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useRef, useState, type ReactElement } from 'react'
import * as THREE from 'three'
import type { DataBundle } from '../../data/types'
import { nameOf, setClientBundle } from '../data'
import { loadClientBundle } from '../dataLoad'
import { LabelSprite } from '../table/LabelSprite'
import { G, M, ProceduralBody } from '../table/sceneKit'
import { SEAT_COLOURS } from '../table/seats'
import '../ui/hud.css'
import { FigureLights } from './figureLook'
import { FIGURE_LEAN, GlbSurvivor, ZOMBIE_HEIGHT, ZOMBIE_MAX_WIDTH } from './GlbBody'
import { glbStatus, useGlbClone } from './glbLoader'
import { glbSlugs, isZombieSlug, survivorSlug, useGlbManifest } from './glbManifest'

export const galleryRequested = (search = typeof location !== 'undefined' ? location.search : ''): boolean => new URLSearchParams(search).has('gallery')

interface Cell { key: string; label: string; slug?: string; kind: 'survivor' | 'zombie' | 'other'; colour: string; note: string }
// Ten figures a page (5 x 2) so each one is large; the pager steps through them all. `?gallery&page=N` opens page N (1-based).
const COLS = 5
const PAGE = 10
const DX = 3.6
const DZ = 5.4
// A mid-grey backdrop (not the table's near-black) so dark coats and boots still read against it.
const BACKDROP = '#8c96a6'
const FLOOR = '#a3acba'

/** Sways a figure left and right (a full turn would swing its lean away from the camera). */
function Turn({ children, x, z }: { children: ReactElement; x: number; z: number }): ReactElement {
  const g = useRef<THREE.Group>(null)
  useFrame(({ clock }) => { if (g.current) g.current.rotation.y = Math.sin(clock.elapsedTime * 0.8 + x) * 0.6 })
  return <group position={[x, 0, z]}><group ref={g}>{children}</group></group>
}

/** A listed model of any kind: scaled to a standard height on a neutral base. */
function AnyModel({ slug, colour, zombie }: { slug: string; colour: string; zombie: boolean }): ReactElement | null {
  const c = useGlbClone(slug)
  if (!c) return null
  if (!zombie) return <GlbSurvivor clone={c} colour={colour} />
  const f = c.glb.fit(ZOMBIE_HEIGHT, ZOMBIE_MAX_WIDTH)
  const p = new THREE.Vector3().setFromMatrixPosition(f.matrix)
  return <group rotation-x={-FIGURE_LEAN}><group position={[p.x, p.y, p.z]} scale={f.scale}><primitive object={c.object} /></group></group>
}

function GalleryCell({ cell, x, z }: { cell: Cell; x: number; z: number }): ReactElement {
  const clone = useGlbClone(cell.slug)
  const note = cell.slug ? `GLB ${cell.slug} (${glbStatus(cell.slug)})` : cell.note
  let body: ReactElement
  if (cell.slug && clone) body = <AnyModel slug={cell.slug} colour={cell.colour} zombie={cell.kind === 'zombie'} />
  else if (cell.kind === 'zombie') body = <mesh geometry={G.capsule} material={M.zombie} position-y={0.7} />
  else body = <ProceduralBody colour={cell.colour} />
  return (
    <>
      <Turn x={x} z={z}>{body}</Turn>
      <LabelSprite text={cell.label} position={[x, 0.45, z + 1.35]} height={0.6} fontPx={12} border={cell.colour} />
      <LabelSprite text={note} position={[x, 0.45, z + 2.0]} height={0.38} fontPx={10} border="#5a6270" />
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

/** Puts the camera where the current page of `rows` rows fills the frame, again whenever the page changes. */
function Frame({ rows, page }: { rows: number; page: number }): null {
  const camera = useThree((st) => st.camera)
  const controls = useThree((st) => st.controls) as unknown as { target: THREE.Vector3; update(): void } | null
  useLayoutEffect(() => {
    const midZ = ((rows - 1) * DZ) / 2
    const dist = Math.max(15, COLS * DX * 1.08)
    camera.position.set(0, 1.2 + dist * 0.74, midZ + 1.5 + dist * 0.67)
    if (controls) { controls.target.set(0, 1.2, midZ + 0.9); controls.update() } else camera.lookAt(0, 1.2, midZ + 0.9)
  }, [camera, controls, rows, page])
  return null
}

const pageFromUrl = (): number => {
  const n = typeof location === 'undefined' ? 1 : Number(new URLSearchParams(location.search).get('page') ?? 1)
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) - 1 : 0
}

export default function Gallery(): ReactElement {
  const [b, setB] = useState<DataBundle | null>(null)
  const listed = useGlbManifest()
  const [done, setDone] = useState(0)
  const [pageWanted, setPage] = useState(pageFromUrl)
  useEffect(() => { void loadClientBundle().then((x) => { setClientBundle(x); setB(x) }) }, [])
  const all = buildCells(b)
  const pages = Math.max(1, Math.ceil(all.length / PAGE))
  const page = Math.min(pageWanted, pages - 1)
  const cells = all.slice(page * PAGE, (page + 1) * PAGE)
  const wanted = cells.filter((c) => c.slug).length
  // how many of this page's models have finished loading (the e2e screenshot waits for all of them)
  useEffect(() => {
    const t = setInterval(() => setDone(cells.filter((c) => c.slug && glbStatus(c.slug) === 'ready').length), 400)
    return () => clearInterval(t)
  })
  const rows = Math.max(1, Math.ceil(cells.length / COLS))
  const btn = { font: '600 14px system-ui', padding: '4px 12px', borderRadius: 6, border: '1px solid #3a4352', background: '#1d232e', color: '#f2efe8', cursor: 'pointer' } as const
  return (
    <div style={{ position: 'fixed', inset: 0, background: BACKDROP }} data-testid="figure-gallery" data-count={all.length} data-glb={listed} data-page={page + 1} data-pages={pages} data-wanted={wanted} data-loaded={done}>
      <div style={{ position: 'absolute', left: 14, top: 10, zIndex: 2, font: '14px system-ui', color: '#1d232e' }}>
        <b style={{ fontFamily: 'var(--f-head)', fontSize: 24, letterSpacing: '0.06em', color: '#10151d' }}>FIGURE GALLERY</b>
        <div>{all.length} figures, {listed} listed in public/assets/models/manifest.json. Procedural bodies stand in for any model that is not listed.</div>
      </div>
      <div style={{ position: 'absolute', right: 14, top: 12, zIndex: 2, display: 'flex', gap: 8, alignItems: 'center', font: '600 14px system-ui', color: '#10151d' }}>
        <button type="button" style={btn} data-testid="gallery-prev" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</button>
        <span data-testid="gallery-page">Page {page + 1} of {pages}</span>
        <button type="button" style={btn} data-testid="gallery-next" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button>
      </div>
      <Canvas frameloop="always" flat dpr={[1, 1.5]} camera={{ position: [0, 14, 14], fov: 38, near: 0.5, far: 300 }}>
        <color attach="background" args={[BACKDROP]} />
        <hemisphereLight args={['#dfe8ff', '#8a8f99', 1.8]} />
        <directionalLight position={[10, 30, 20]} intensity={2.2} />
        <FigureLights />
        <OrbitControls makeDefault />
        <Frame rows={rows} page={page} />
        <mesh rotation-x={-Math.PI / 2} position-y={-0.01}><planeGeometry args={[200, 200]} /><meshStandardMaterial color={FLOOR} /></mesh>
        {cells.map((c, i) => <GalleryCell key={c.key} cell={c} x={((i % COLS) - (COLS - 1) / 2) * DX} z={Math.floor(i / COLS) * DZ} />)}
      </Canvas>
    </div>
  )
}
