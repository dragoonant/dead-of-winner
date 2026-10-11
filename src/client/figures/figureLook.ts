// How a painted-miniature GLB is lit. The Hunyuan models carry a baked colour texture and nothing else, and the table's lights (tuned for the
// board) leave that texture nearly black. So every figure material is swapped for a standard material that (a) reads the texture as sRGB,
// (b) is matte, (c) gets a figure-local "room" environment (soft hemisphere-like light that the board never sees) and (d) lifts the baked colour
// with a small emissive copy of the same texture, which is the "blend toward unlit" the painted look needs whatever the table lights do.
import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { Color, Material, Mesh, MeshStandardMaterial, PMREMGenerator, SRGBColorSpace, type Object3D, type Texture } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

export const FIGURE_LOOK = {
  roughness: 0.8,
  metalness: 0,
  /** strength of the figure-local environment light */
  envMapIntensity: 1.1,
  /** how much of the baked colour is added unlit (0 = fully lit by the scene, 1 = fully unlit) */
  glow: 0.42,
}

const painted = new Set<MeshStandardMaterial>()
const bySource = new WeakMap<Material, MeshStandardMaterial>()
let env: Texture | null = null

/** A figure material for a loaded GLB material: the same texture, repainted with the shared look. Cached per source material. */
export function paintedMaterial(src: Material): Material {
  const s = src as MeshStandardMaterial
  let m = bySource.get(src)
  if (m) return m
  const map = s.map ?? null
  if (map) { map.colorSpace = SRGBColorSpace; map.anisotropy = 4 }
  m = new MeshStandardMaterial({
    map,
    color: s.color ? s.color.clone() : new Color('#ffffff'),
    roughness: FIGURE_LOOK.roughness,
    metalness: FIGURE_LOOK.metalness,
    envMap: env,
    envMapIntensity: FIGURE_LOOK.envMapIntensity,
    emissive: new Color(FIGURE_LOOK.glow, FIGURE_LOOK.glow, FIGURE_LOOK.glow),
    emissiveMap: map,
    side: s.side,
  })
  m.name = s.name
  bySource.set(src, m)
  painted.add(m)
  return m
}

/** Swap every mesh material under `root` for its painted version. */
export function paintFigure(root: Object3D): void {
  root.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(paintedMaterial) : paintedMaterial(mesh.material)
  })
}

/** Mount once inside every Canvas that draws figures: builds the figure-local environment from the renderer and hands it to every figure material. */
export function FigureLights(): null {
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const tex = pmrem.fromScene(room, 0.04).texture
    env = tex
    for (const m of painted) { m.envMap = tex; m.needsUpdate = true }
    invalidate()
    return () => {
      for (const m of painted) { m.envMap = null; m.needsUpdate = true }
      if (env === tex) env = null
      tex.dispose()
      room.dispose()
      pmrem.dispose()
    }
  }, [gl, invalidate])
  return null
}
