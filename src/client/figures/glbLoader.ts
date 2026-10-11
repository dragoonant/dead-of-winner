// Loads each listed figure GLB at most once (module-level cache) WITHOUT suspending: callers get null until it is ready (or forever if it failed)
// and keep drawing the procedural figure meanwhile. Geometry, materials and textures are shared by every instance; only node trees are cloned.
import { useEffect, useMemo, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { Box3, Matrix4, Vector3, type Mesh, type Object3D } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { glbEntry, glbUrl } from './glbManifest'

export interface LoadedGlb {
  scene: Object3D
  /** Scales the model to `height` inches, centres it on x/z and sits its lowest point on y = 0. Computed once per slug. */
  fit(height: number, maxWidth?: number): { matrix: Matrix4; scale: number; width: number }
}
type Entry = { status: 'loading' | 'ready' | 'failed'; glb?: LoadedGlb }
const cache = new Map<string, Entry>()
const listeners = new Set<() => void>()

function makeLoaded(scene: Object3D): LoadedGlb {
  scene.updateMatrixWorld(true)
  const box = new Box3().setFromObject(scene)
  const size = box.getSize(new Vector3())
  const centre = box.getCenter(new Vector3())
  return {
    scene,
    fit(height, maxWidth) {
      let scale = size.y > 1e-6 ? height / size.y : 1
      const widest = Math.max(size.x, size.z)
      if (maxWidth && widest * scale > maxWidth) scale = maxWidth / widest
      const m = new Matrix4().makeScale(scale, scale, scale)
      m.setPosition(-centre.x * scale, -box.min.y * scale, -centre.z * scale)
      return { matrix: m, scale, width: Math.max(size.x, size.z) * scale }
    },
  }
}

export function requestGlb(slug: string): Entry {
  let e = cache.get(slug)
  if (e) return e
  e = { status: 'loading' }
  cache.set(slug, e)
  const entry = e
  try {
    const loader = new GLTFLoader()
    loader.setMeshoptDecoder(MeshoptDecoder)
    loader
      .loadAsync(glbEntry(slug)?.url ?? glbUrl(slug))
      .then((gltf) => { entry.glb = makeLoaded(gltf.scene); entry.status = 'ready' })
      .catch(() => { entry.status = 'failed' })
      .finally(() => listeners.forEach((l) => l()))
  } catch { entry.status = 'failed' }
  return e
}

/** The loaded GLB for a slug (shared scene; clone it with `cloneGlb` before mounting), or null while loading / when unavailable / when slug is undefined. */
export function useGlb(slug: string | undefined): LoadedGlb | null {
  const invalidate = useThree((s) => s.invalidate)
  const [, setTick] = useState(0)
  const entry = slug ? requestGlb(slug) : undefined
  useEffect(() => {
    if (!slug) return
    const l = (): void => { setTick((n) => n + 1); invalidate() }
    listeners.add(l)
    return () => { listeners.delete(l) }
  }, [slug, invalidate])
  return entry?.status === 'ready' ? entry.glb ?? null : null
}

/** Like `useGlb` for a list of slugs that may change length (the zombie variants): one subscription, one entry per slug. */
export function useGlbs(slugs: readonly string[]): (LoadedGlb | null)[] {
  const invalidate = useThree((s) => s.invalidate)
  const [, setTick] = useState(0)
  const entries = slugs.map((s) => requestGlb(s))
  useEffect(() => {
    const l = (): void => { setTick((n) => n + 1); invalidate() }
    listeners.add(l)
    return () => { listeners.delete(l) }
  }, [invalidate])
  return entries.map((e) => (e.status === 'ready' ? e.glb ?? null : null))
}

/** A private node-tree clone (shares geometry and materials). */
export function cloneGlb(glb: LoadedGlb): Object3D { return cloneSkinned(glb.scene) }

/** Every mesh of the scene with its transform relative to the scene root, for instancing. */
export function flattenMeshes(glb: LoadedGlb): { mesh: Mesh; matrix: Matrix4 }[] {
  const out: { mesh: Mesh; matrix: Matrix4 }[] = []
  glb.scene.updateMatrixWorld(true)
  glb.scene.traverse((o) => {
    const m = o as Mesh
    if (m.isMesh) out.push({ mesh: m, matrix: m.matrixWorld.clone() })
  })
  return out
}

/** Load state of a slug ('idle' when never requested); the gallery shows it. */
export const glbStatus = (slug: string): 'idle' | 'loading' | 'ready' | 'failed' => cache.get(slug)?.status ?? 'idle'

export function useGlbClone(slug: string | undefined): { object: Object3D; glb: LoadedGlb } | null {
  const glb = useGlb(slug)
  return useMemo(() => (glb ? { object: cloneGlb(glb), glb } : null), [glb])
}
