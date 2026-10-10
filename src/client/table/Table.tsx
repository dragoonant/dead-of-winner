// The 3D table (50 §3, 30 §2): colony board at the origin, six location tiles around it, procedural figures, instanced zombies and tokens.
// Cheap on purpose: demand frameloop, dpr capped at 1.5, shared geometries and materials, instancing for everything that repeats.
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useLayoutEffect, useMemo, useRef, type ReactElement } from 'react'
import * as THREE from 'three'
import { locNumber, locShort, nameOf } from '../data'
import { useGameStore } from '../store/gameStore'
import { usePresentedView } from '../store/hooks'
import { useSettingsStore } from '../store/settingsStore'
import { ui, useUiStore } from '../store/uiStore'
import { LabelSprite } from './LabelSprite'
import { CAMERA_PRESETS, COLONY_SIZE, TILE_SIZE, followPose, type CameraPose, type Pt } from './layout'
import { seatColour, seatRimPosition } from './seats'
import { buildTableModel, type FigureModel, type TableModel } from './tableModel'

// ---------- shared geometry and materials ----------
const G = {
  disc: new THREE.CircleGeometry(0.55, 20),
  small: new THREE.CircleGeometry(0.3, 14),
  square: new THREE.PlaneGeometry(1.05, 1.05),
  capsule: new THREE.CapsuleGeometry(0.26, 0.62, 4, 8),
  plank: new THREE.BoxGeometry(1.0, 0.55, 0.16),
  token: new THREE.CylinderGeometry(0.3, 0.3, 0.18, 14),
  base: new THREE.CylinderGeometry(0.55, 0.62, 0.14, 20),
  head: new THREE.SphereGeometry(0.2, 12, 10),
  pip: new THREE.SphereGeometry(0.09, 8, 6),
  ring: new THREE.TorusGeometry(0.5, 0.05, 6, 24),
}
const M = {
  slot: new THREE.MeshStandardMaterial({ color: '#55657f', roughness: 0.9 }),
  space: new THREE.MeshStandardMaterial({ color: '#6d5249', roughness: 0.9 }),
  noiseSlot: new THREE.MeshStandardMaterial({ color: '#76602a', roughness: 0.9 }),
  zombie: new THREE.MeshStandardMaterial({ color: '#6f9560', roughness: 0.8 }),
  barricade: new THREE.MeshStandardMaterial({ color: '#8a6a3e', roughness: 0.85 }),
  noise: new THREE.MeshStandardMaterial({ color: '#f0b840', emissive: '#7a4f00', roughness: 0.5 }),
  helpless: new THREE.MeshStandardMaterial({ color: '#d8d2c4', roughness: 0.8 }),
  wound: new THREE.MeshStandardMaterial({ color: '#d03a3a', emissive: '#601010' }),
  frost: new THREE.MeshStandardMaterial({ color: '#8fd2ff', emissive: '#244a66' }),
  gold: new THREE.MeshStandardMaterial({ color: '#c9a227', emissive: '#4a3a08', roughness: 0.4 }),
  ice: new THREE.MeshStandardMaterial({ color: '#7fb2d6', emissive: '#1d3a52', roughness: 0.4 }),
  cloth: new THREE.MeshStandardMaterial({ color: '#1b2230', roughness: 1 }),
  board: new THREE.MeshStandardMaterial({ color: '#445470', roughness: 0.85 }),
  tile: new THREE.MeshStandardMaterial({ color: '#38465e', roughness: 0.85 }),
  door: new THREE.MeshStandardMaterial({ color: '#8a6a44', roughness: 0.8 }),
  stack: new THREE.MeshStandardMaterial({ color: '#3b4252', roughness: 0.7 }),
  deck: new THREE.MeshStandardMaterial({ color: '#5a4e3a', roughness: 0.8 }),
  select: new THREE.MeshBasicMaterial({ color: '#ffe07a', transparent: true, opacity: 0.9 }),
}
const seatMats = new Map<string, { base: THREE.MeshStandardMaterial; body: THREE.MeshStandardMaterial }>()
function matsFor(colour: string): { base: THREE.MeshStandardMaterial; body: THREE.MeshStandardMaterial } {
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

// ---------- instancing ----------
function Instanced({ points, max, y, geometry, material, flat = false, scale = 1, jitter = false }: {
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

// ---------- figures ----------
function Figure({ fig, colour, selected, label }: { fig: FigureModel; colour: string; selected: boolean; label: string }): ReactElement {
  const g = useRef<THREE.Group>(null)
  const target = useRef(new THREE.Vector3(fig.pos.x, 0, fig.pos.z))
  target.current.set(fig.pos.x, 0, fig.pos.z)
  const invalidate = useThree((s) => s.invalidate)
  useLayoutEffect(() => { g.current?.position.copy(target.current) }, [])
  useFrame((_, dt) => {
    const gr = g.current
    if (!gr) return
    if (gr.position.distanceTo(target.current) > 0.02) { gr.position.lerp(target.current, Math.min(1, dt * 8)); invalidate() } else gr.position.copy(target.current)
  })
  const mats = matsFor(colour)
  const pips: [number, THREE.Material][] = []
  for (let i = 0; i < fig.wounds; i++) pips.push([i, M.wound])
  for (let i = 0; i < fig.frostbite; i++) pips.push([fig.wounds + i, M.frost])
  return (
    <group
      ref={g}
      onClick={(e) => { e.stopPropagation(); ui.set({ selectedSurvivor: selected ? null : fig.id }) }}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; ui.set({ hoverSurvivor: fig.id }) }}
      onPointerOut={() => { document.body.style.cursor = ''; ui.set({ hoverSurvivor: null }) }}
    >
      <mesh geometry={G.base} material={mats.base} position-y={0.07} />
      <mesh geometry={G.capsule} material={mats.body} position-y={0.78} />
      <mesh geometry={G.head} material={mats.body} position-y={1.42} />
      {fig.leader && <mesh geometry={G.ring} material={M.gold} position-y={1.75} rotation-x={Math.PI / 2} scale={0.5} />}
      {selected && <mesh geometry={G.ring} material={M.select} position-y={0.16} rotation-x={Math.PI / 2} scale={1.35} />}
      {pips.map(([i, mat]) => <mesh key={i} geometry={G.pip} material={mat} position={[-0.36 + i * 0.2, 1.95, 0]} />)}
      <LabelSprite text={label} border={colour} position={[0, 2.5, 0]} height={0.62} fontPx={12} />
    </group>
  )
}

// ---------- the scene ----------
function Scene({ m, seatOrder, hands, names, selected }: {
  m: TableModel; seatOrder: string[]; hands: number[]; names: string[]; selected: string | null
}): ReactElement {
  const { w, d } = COLONY_SIZE
  const tileIds = Object.keys(m.tiles)
  const occupantSlots = useMemo(() => m.colony.occupants, [m.colony])
  const survivorSlots = useMemo(() => tileIds.flatMap((id) => m.tiles[id]!.survivors), [m, tileIds])
  const entranceSpaces = useMemo(() => [...m.colony.entrances.flatMap((e) => e.spaces), ...tileIds.flatMap((id) => m.tiles[id]!.entrance)], [m, tileIds])
  const noiseSlots = useMemo(() => tileIds.flatMap((id) => m.tiles[id]!.noise), [m, tileIds])
  const trackCells = useMemo(() => [...m.colony.moraleTrack, ...m.colony.roundTrack], [m.colony])
  const n = seatOrder.length
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.2} material={M.cloth}><planeGeometry args={[170, 130]} /></mesh>
      {/* colony board */}
      <mesh position-y={0.05} material={M.board}><boxGeometry args={[w, 0.2, d]} /></mesh>
      <LabelSprite text="COLONY" position={[0, 0.4, 0.2 - d / 2 + 3.1]} height={0.8} fontPx={13} bare />
      {m.colony.entrances.map((e) => (
        <group key={e.index}>
          <mesh position={[e.door.x, 0.18, e.door.z]} material={M.door}><boxGeometry args={[3.9, 0.3, 0.4]} /></mesh>
          <LabelSprite text={String(e.index)} position={[e.door.x + (e.side === 'north' ? 0 : 0), 0.9, e.door.z + (e.side === 'north' ? 0.6 : -0.6)]} height={0.7} fontPx={14} />
        </group>
      ))}
      <Instanced points={occupantSlots} max={32} y={0.17} geometry={G.disc} material={M.slot} flat />
      <Instanced points={trackCells} max={24} y={0.17} geometry={G.small} material={M.slot} flat />
      {m.colony.moraleTrack.map((p, i) => <LabelSprite key={`m${i}`} text={String(i)} position={[p.x, 0.5, p.z + 0.62]} height={0.42} fontPx={11} bare />)}
      {m.colony.roundTrack.map((p, i) => <LabelSprite key={`r${i}`} text={String(i)} position={[p.x, 0.5, p.z - 0.62]} height={0.42} fontPx={11} bare />)}
      <LabelSprite text="MORALE" border="#c9a227" position={[m.colony.moraleTrack[0]!.x - 2.6, 0.5, m.colony.moraleTrack[0]!.z]} height={0.5} fontPx={11} bare />
      <LabelSprite text="ROUNDS LEFT" border="#7fb2d6" position={[m.colony.roundTrack[0]!.x - 2.9, 0.5, m.colony.roundTrack[0]!.z]} height={0.5} fontPx={11} bare />
      <mesh geometry={G.token} material={M.gold} position={[m.moraleAt.x, 0.36, m.moraleAt.z]} />
      <mesh geometry={G.token} material={M.ice} position={[m.roundAt.x, 0.36, m.roundAt.z]} />
      {/* location tiles */}
      {tileIds.map((id) => {
        const t = m.tiles[id]!
        const num = locNumber(id)
        return (
          <group key={id}>
            <mesh position={[t.centre.x, 0.0, t.centre.z]} material={M.tile}><boxGeometry args={[TILE_SIZE, 0.2, TILE_SIZE]} /></mesh>
            <LabelSprite text={`${num !== null ? String(num).padStart(2, '0') + ' ' : ''}${locShort(id)}`} position={[t.title.x, 0.6, t.title.z]} height={0.8} fontPx={13} />
          </group>
        )
      })}
      <Instanced points={survivorSlots} max={48} y={0.12} geometry={G.disc} material={M.slot} flat />
      <Instanced points={entranceSpaces} max={64} y={0.12} geometry={G.square} material={M.space} flat />
      <Instanced points={noiseSlots} max={32} y={0.12} geometry={G.small} material={M.noiseSlot} flat />
      {/* supplies */}
      <SupplyBox at={m.colony.food} label="FOOD" />
      <SupplyBox at={m.colony.waste} label="WASTE" />
      <SupplyBox at={m.colony.crisis} label="CRISIS" />
      <SupplyBox at={m.colony.contribution} label="IN" />
      {/* things on the table */}
      <Instanced points={m.zombies} max={160} y={0.7} geometry={G.capsule} material={M.zombie} jitter />
      <Instanced points={m.barricades} max={80} y={0.42} geometry={G.plank} material={M.barricade} jitter />
      <Instanced points={m.noise} max={40} y={0.3} geometry={G.token} material={M.noise} />
      <Instanced points={m.helpless} max={30} y={0.55} geometry={G.capsule} material={M.helpless} scale={0.7} />
      {m.figures.map((f) => (
        <Figure key={f.id} fig={f} colour={seatColour(seatOrder, f.seat)} selected={selected === f.id} label={nameOf(f.id).split(' ')[0]!} />
      ))}
      {/* hand stacks on the rim */}
      {seatOrder.map((seat, i) => {
        const [x, z] = seatRimPosition(i, n, 26, 23)
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

function SupplyBox({ at, label }: { at: Pt; label: string }): ReactElement {
  return (
    <group position={[at.x, 0, at.z]}>
      <mesh position-y={0.1} material={M.deck}><boxGeometry args={[2.4, 0.3, 2.4]} /></mesh>
      <LabelSprite text={label} position={[0, 0.9, 0]} height={0.6} fontPx={12} />
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
