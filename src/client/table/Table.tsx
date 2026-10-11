// The 3D table (50 §3, 30 §2): colony board at the origin, six location tiles around it, procedural figures, instanced zombies and tokens.
// Cheap on purpose: demand frameloop, dpr capped at 1.5, shared geometries and materials, instancing for everything that repeats.
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import * as THREE from 'three'
import { ensureFonts, useLocationArt } from '../cards/art'
import { locNumber, locShort, locationSymbolOrder, nameOf } from '../data'
import { GlbSurvivor, ZombieField } from '../figures/GlbBody'
import { useGlbClone } from '../figures/glbLoader'
import { survivorSlug, useGlbManifest, zombieSlugs } from '../figures/glbManifest'
import { useGameStore } from '../store/gameStore'
import { usePresentedView } from '../store/hooks'
import { useSettingsStore } from '../store/settingsStore'
import { ui, useUiStore } from '../store/uiStore'
import { boardCanvasSize, loadTextureSet, paintBoard, paintTile, tileCanvasSize, type TextureSet } from './boardPaint'
import { LabelSprite } from './LabelSprite'
import { CAMERA_PRESETS, COLONY_SIZE, TILE_H, TILE_W, colonyLayout, followPose, type CameraPose, type ColonyLayout, type Pt, type TileLayout } from './layout'
import { G, Instanced, M, ProceduralBody } from './sceneKit'
import { seatColour, seatRimPosition } from './seats'
import { buildTableModel, type FigureModel, type TableModel } from './tableModel'

/** Height of the printed surfaces: everything that stands on the table sits on this. */
const TOP = 0.1

const SLAB = {
  board: new THREE.MeshStandardMaterial({ color: '#2a2f38', roughness: 0.9 }),
  tile: new THREE.MeshStandardMaterial({ color: '#3a342c', roughness: 0.9 }),
}

// ---------- lights ----------
function Lights(): ReactElement {
  return (
    <>
      <hemisphereLight args={['#a9bde6', '#2a2f3c', 1.5]} />
      <directionalLight position={[14, 34, 18]} intensity={1.9} color="#c4d4ff" />
      <pointLight position={[0, 7, 0]} intensity={160} distance={40} decay={1.6} color="#ffb067" />
    </>
  )
}

// ---------- camera ----------
function CameraRig(): ReactElement {
  const preset = useUiStore((s) => s.camera)
  const invalidate = useThree((s) => s.invalidate)
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update(): void } | null
  const goal = useRef<CameraPose | null>(null)
  const v = usePresentedView()
  const model = useMemo(() => (v ? buildTableModel(v) : null), [v])
  const activeLeaderAt = useMemo(() => {
    if (!v || !model) return null
    const seat = v.activeSeat ?? v.seat
    const lead = model.figures.find((f) => f.seat === seat && f.leader) ?? model.figures.find((f) => f.seat === seat)
    return lead?.pos ?? null
  }, [v, model])
  useLayoutEffect(() => {
    goal.current = preset === 4 ? followPose(activeLeaderAt ?? { x: 0, z: 0 }) : CAMERA_PRESETS[preset]
    invalidate()
  }, [preset, activeLeaderAt, invalidate])
  useFrame((_, dt) => {
    const g = goal.current
    if (!g || !controls) return
    const k = Math.min(1, dt * 6)
    const to = new THREE.Vector3(...g.position)
    const tt = new THREE.Vector3(...g.target)
    camera.position.lerp(to, k)
    controls.target.lerp(tt, k)
    controls.update()
    if (camera.position.distanceTo(to) < 0.05 && controls.target.distanceTo(tt) < 0.05) goal.current = null
    else invalidate()
  })
  return (
    <OrbitControls
      makeDefault
      enableDamping={false}
      maxPolarAngle={1.5}
      minDistance={8}
      maxDistance={90}
      mouseButtons={{ LEFT: undefined, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE }}
      touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
      onStart={() => { goal.current = null }}
    />
  )
}

// ---------- painted surfaces ----------
/** Paints a canvas once the fonts and generated textures have loaded, and hands back a texture of it. Repaints when `key` changes. */
function usePainted(key: string, size: { w: number; h: number }, paint: (c: HTMLCanvasElement, set: TextureSet) => void): THREE.CanvasTexture | null {
  const invalidate = useThree((s) => s.invalidate)
  const [tex, setTex] = useState<THREE.CanvasTexture | null>(null)
  const paintRef = useRef(paint)
  paintRef.current = paint
  useEffect(() => {
    let alive = true
    void Promise.all([ensureFonts(), loadTextureSet()]).then(([, set]) => {
      if (!alive) return
      const c = document.createElement('canvas')
      c.width = size.w
      c.height = size.h
      paintRef.current(c, set)
      const t = new THREE.CanvasTexture(c)
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 8
      setTex((old) => { old?.dispose(); return t })
      invalidate()
    })
    return () => { alive = false }
    // the key stands for everything the painting depends on
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, invalidate])
  return tex
}

/** The loaded art image for a URL, or null. */
function useHtmlImage(url: string | null): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    if (!url) { setImg(null); return }
    let alive = true
    const i = new Image()
    i.onload = () => { if (alive) setImg(i) }
    i.onerror = () => { if (alive) setImg(null) }
    i.src = url
    return () => { alive = false }
  }, [url])
  return img
}

/** A printed slab: a dark body with the painted canvas laid on its top face (canvas top = north). */
function Slab({ w, d, h = 0.2, body, tex }: { w: number; d: number; h?: number; body: THREE.Material; tex: THREE.Texture | null }): ReactElement {
  const mat = useMemo(() => (tex ? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.88, metalness: 0 }) : null), [tex])
  return (
    <group>
      <mesh position-y={TOP - h / 2} material={body}><boxGeometry args={[w, h, d]} /></mesh>
      {mat && <mesh rotation-x={-Math.PI / 2} position-y={TOP + 0.002} material={mat}><planeGeometry args={[w, d]} /></mesh>}
    </group>
  )
}

function ColonyBoard({ layout }: { layout: ColonyLayout }): ReactElement {
  const artUrl = useLocationArt('colony')
  const art = useHtmlImage(artUrl)
  const tex = usePainted(`board|${layout.occupants.length}|${layout.entrances.length}|${art ? artUrl : ''}`, boardCanvasSize(), (c, set) => paintBoard(c, layout, set, art))
  return <Slab w={COLONY_SIZE.w} d={COLONY_SIZE.d} h={0.3} body={SLAB.board} tex={tex} />
}

function LocationTile({ id, t }: { id: string; t: TileLayout }): ReactElement {
  const artUrl = useLocationArt(id)
  const art = useHtmlImage(artUrl)
  const symbols = locationSymbolOrder(id)
  const name = locShort(id)
  const number = locNumber(id)
  const key = `${id}|${name}|${number}|${symbols.join(',')}|${t.survivors.length}|${t.entrance.length}|${t.noise.length}|${art ? artUrl : ''}`
  const tex = usePainted(key, tileCanvasSize(), (c, set) => paintTile(c, t, { id, name, number, symbols, art }, set))
  return (
    <group position={[t.centre.x, 0, t.centre.z]}>
      <Slab w={TILE_W} d={TILE_H} body={SLAB.tile} tex={tex} />
    </group>
  )
}

/** The wood table the board lies on. */
function TableTop(): ReactElement {
  const [set, setSet] = useState<TextureSet | null>(null)
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => { let alive = true; void loadTextureSet().then((x) => { if (alive) { setSet(x); invalidate() } }); return () => { alive = false } }, [invalidate])
  const mat = useMemo(() => {
    const img = set?.['table-wood']
    if (!img) return new THREE.MeshStandardMaterial({ color: '#1b2230', roughness: 1 })
    const t = new THREE.Texture(img)
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(8, 6)
    t.anisotropy = 4
    t.needsUpdate = true
    return new THREE.MeshStandardMaterial({ map: t, color: '#9a9a9a', roughness: 0.95 })
  }, [set])
  return <mesh rotation-x={-Math.PI / 2} position-y={-0.2} material={mat}><planeGeometry args={[170, 130]} /></mesh>
}

// ---------- figures ----------
function Figure({ fig, colour, selected, label }: { fig: FigureModel; colour: string; selected: boolean; label: string }): ReactElement {
  const g = useRef<THREE.Group>(null)
  const target = useRef(new THREE.Vector3(fig.pos.x, TOP, fig.pos.z))
  target.current.set(fig.pos.x, TOP, fig.pos.z)
  const invalidate = useThree((s) => s.invalidate)
  useLayoutEffect(() => { g.current?.position.copy(target.current) }, [])
  useFrame((_, dt) => {
    const gr = g.current
    if (!gr) return
    if (gr.position.distanceTo(target.current) > 0.02) { gr.position.lerp(target.current, Math.min(1, dt * 8)); invalidate() } else gr.position.copy(target.current)
  })
  const clone = useGlbClone(survivorSlug(fig.id))
  const pips: [number, THREE.Material][] = []
  for (let i = 0; i < fig.wounds; i++) pips.push([i, M.wound])
  for (let i = 0; i < fig.frostbite; i++) pips.push([fig.wounds + i, M.frost])
  const top = clone ? 2.9 : 1.95
  return (
    <group
      ref={g}
      onClick={(e) => { e.stopPropagation(); ui.set({ selectedSurvivor: selected ? null : fig.id }) }}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; ui.set({ hoverSurvivor: fig.id }) }}
      onPointerOut={() => { document.body.style.cursor = ''; ui.set({ hoverSurvivor: null }) }}
    >
      {clone ? <GlbSurvivor clone={clone} colour={colour} /> : <ProceduralBody colour={colour} />}
      {fig.leader && <mesh geometry={G.ring} material={M.gold} position-y={top - 0.2} rotation-x={Math.PI / 2} scale={0.5} />}
      {selected && <mesh geometry={G.ring} material={M.select} position-y={0.16} rotation-x={Math.PI / 2} scale={1.35} />}
      {pips.map(([i, mat]) => <mesh key={i} geometry={G.pip} material={mat} position={[-0.36 + i * 0.2, top, 0]} />)}
      <LabelSprite text={label} border={colour} position={[0, 0.3, 1.0]} height={0.62} fontPx={12} />
    </group>
  )
}

// ---------- the scene ----------
function Scene({ m, seatOrder, hands, names, selected }: {
  m: TableModel; seatOrder: string[]; hands: number[]; names: string[]; selected: string | null
}): ReactElement {
  useGlbManifest() // a GLB listed in the manifest swaps in once it is known
  const tileIds = Object.keys(m.tiles)
  const n = seatOrder.length
  const zSlugs = zombieSlugs()
  const waste = m.colony.waste
  const wasteH = Math.min(1.6, m.wasteCards * 0.05)
  const crisisH = Math.min(1.6, m.crisisDeck * 0.05)
  const contribH = Math.min(1.2, m.contributions * 0.06)
  return (
    <group>
      <TableTop />
      <ColonyBoard layout={m.colony} />
      {tileIds.map((id) => <LocationTile key={id} id={id} t={m.tiles[id]!} />)}
      {/* tracks and supplies */}
      <mesh geometry={G.token} material={M.gold} position={[m.moraleAt.x, TOP + 0.09, m.moraleAt.z]} />
      <mesh geometry={G.token} material={M.ice} position={[m.roundAt.x, TOP + 0.09, m.roundAt.z]} />
      <Instanced points={m.foodTokens} max={30} y={TOP + 0.08} geometry={G.food} material={M.food} />
      {wasteH > 0 && <mesh geometry={G.card} material={M.cardBack} position={[waste.x, TOP + wasteH / 2, waste.z]} scale={[0.95, Math.max(1, wasteH / 0.05), 0.95]} />}
      {crisisH > 0 && <mesh geometry={G.card} material={M.cardBack} position={[m.colony.crisis.x, TOP + crisisH / 2, m.colony.crisis.z]} scale={[0.95, Math.max(1, crisisH / 0.05), 0.95]} />}
      {contribH > 0 && <mesh geometry={G.card} material={M.cardBack} position={[m.colony.contribution.x, TOP + contribH / 2, m.colony.contribution.z]} scale={[0.95, Math.max(1, contribH / 0.05), 0.95]} />}
      {/* things on the table */}
      <ZombieField points={m.zombies} slugs={zSlugs} />
      <Instanced points={m.barricades} max={80} y={TOP + 0.32} geometry={G.plank} material={M.barricade} jitter />
      <Instanced points={m.noise} max={40} y={TOP + 0.15} geometry={G.token} material={M.noise} scale={0.8} />
      <Instanced points={m.helpless} max={30} y={TOP + 0.45} geometry={G.capsule} material={M.helpless} scale={0.7} />
      {m.figures.map((f) => (
        <Figure key={f.id} fig={f} colour={seatColour(seatOrder, f.seat)} selected={selected === f.id} label={nameOf(f.id).split(' ')[0]!} />
      ))}
      {/* hand stacks on the rim */}
      {seatOrder.map((seat, i) => {
        const [x, z] = seatRimPosition(i, n, 26, 24.5)
        return (
          <group key={seat} position={[x, 0, z]}>
            <mesh position-y={0.2} material={M.stack}><boxGeometry args={[2.6, Math.min(1.6, 0.2 + (hands[i] ?? 0) * 0.12), 1.8]} /></mesh>
            <mesh position-y={0.01} rotation-x={-Math.PI / 2}><ringGeometry args={[1.9, 2.1, 28]} /><meshBasicMaterial color={seatColour(seatOrder, seat)} /></mesh>
            <LabelSprite text={`${names[i]} - ${hands[i] ?? 0} cards`} border={seatColour(seatOrder, seat)} position={[0, 2.0, 0]} height={0.8} fontPx={13} />
          </group>
        )
      })}
    </group>
  )
}

// ---------- the canvas ----------
export default function Table(): ReactElement {
  const graphics = useSettingsStore((s) => s.graphics)
  const v = usePresentedView()
  const selected = useUiStore((s) => s.selectedSurvivor)
  const viewer = useGameStore((s) => s.viewer)
  const model = useMemo(() => (v ? buildTableModel(v) : null), [v])
  const names = useMemo(() => (v ? v.seatOrder.map((s) => v.setup.seats.find((x) => x.id === s)?.name ?? s) : []), [v])
  const hands = useMemo(() => (v ? v.seatOrder.map((s) => (s === viewer ? v.me.hand.length : v.seats[s]?.handCount ?? 0)) : []), [v, viewer])
  return (
    <Canvas
      frameloop="demand"
      flat
      dpr={graphics === 'low' ? 1 : [1, 1.5]}
      camera={{ position: CAMERA_PRESETS[1].position, fov: 42, near: 0.5, far: 260 }}
      gl={{ antialias: graphics !== 'low', powerPreference: 'high-performance' }}
      onPointerMissed={() => ui.set({ selectedSurvivor: null })}
    >
      <color attach="background" args={['#0b0e14']} />
      <fog attach="fog" args={['#0b0e14', 70, 160]} />
      <Lights />
      <CameraRig />
      {v && model && <Scene m={model} seatOrder={v.seatOrder} hands={hands} names={names} selected={selected} />}
    </Canvas>
  )
}
