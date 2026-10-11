// GLB figures on the table. A survivor GLB stands on a round base tinted to its seat colour (the model is scaled to a fixed height and centred on
// the base, whatever its own origin); zombies are drawn from every listed zombie GLB as instanced meshes (one draw call per mesh per variant),
// and fall back to the procedural capsule while no zombie GLB has loaded.
import { useLayoutEffect, useMemo, useRef, type ReactElement } from 'react'
import * as THREE from 'three'
import { G, Instanced, M, matsFor } from '../table/sceneKit'
import type { Pt } from '../table/layout'
import { flattenMeshes, useGlbs, type LoadedGlb } from './glbLoader'
import { useShadows } from '../vfx/fx'

// Inches on the table. The models are authored at 1.2 in (strict miniature scale), which is unreadable from the default camera, so figures are drawn
// at about twice that and clamped to the slot spacing (1.62 in): a wide pose shrinks rather than overlapping its neighbour.
export const SURVIVOR_HEIGHT = 2.8
export const SURVIVOR_MAX_WIDTH = 1.75
export const ZOMBIE_HEIGHT = 2.5
export const ZOMBIE_MAX_WIDTH = 1.6
/** The default camera looks down steeply, so an upright figure shows little but its head. Figures lean back (top away from the camera, face up
 *  toward it) by this many radians about their feet, like a miniature held up for a photo. Their base stays flat in the slot. */
export const FIGURE_LEAN = 0.42

/** The body of a survivor from its loaded GLB (see `useGlbClone`), on a seat-coloured base. */
export function GlbSurvivor({ clone, colour }: { clone: { object: THREE.Object3D; glb: LoadedGlb }; colour: string }): ReactElement {
  const fit = useMemo(() => { const f = clone.glb.fit(SURVIVOR_HEIGHT, SURVIVOR_MAX_WIDTH); return { scale: f.scale, offset: new THREE.Vector3().setFromMatrixPosition(f.matrix) } }, [clone])
  const shadows = useShadows()
  useLayoutEffect(() => { clone.object.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = shadows }) }, [clone, shadows])
  return (
    <>
      <mesh geometry={G.base} material={matsFor(colour).base} position-y={0.07} castShadow={shadows} />
      <group position-y={0.14} rotation-x={-FIGURE_LEAN}>
        <group position={[fit.offset.x, fit.offset.y, fit.offset.z]} scale={fit.scale}><primitive object={clone.object} /></group>
      </group>
    </>
  )
}

function ZombieVariant({ glb, points, offset }: { glb: LoadedGlb; points: readonly Pt[]; offset: number }): ReactElement {
  const parts = useMemo(() => flattenMeshes(glb), [glb])
  const fit = useMemo(() => glb.fit(ZOMBIE_HEIGHT, ZOMBIE_MAX_WIDTH), [glb])
  const refs = useRef<(THREE.InstancedMesh | null)[]>([])
  const shadows = useShadows()
  useLayoutEffect(() => {
    const place = new THREE.Matrix4()
    const tilt = new THREE.Matrix4().makeRotationX(-FIGURE_LEAN)
    const rot = new THREE.Matrix4()
    const m = new THREE.Matrix4()
    parts.forEach((p, k) => {
      const inst = refs.current[k]
      if (!inst) return
      points.forEach((pt, i) => {
        // face the middle of the table, with a little jitter so a crowd does not march in step
        const yaw = Math.atan2(-pt.x, -pt.z) + (((i + offset) * 2.399) % 1 - 0.5) * 0.7
        place.makeTranslation(pt.x, 0.1, pt.z)
        rot.makeRotationY(yaw)
        m.copy(place).multiply(tilt).multiply(rot).multiply(fit.matrix).multiply(p.matrix)
        inst.setMatrixAt(i, m)
      })
      inst.count = points.length
      inst.instanceMatrix.needsUpdate = true
    })
  }, [parts, points, fit, offset])
  return (
    <>
      {parts.map((p, k) => (
        <instancedMesh key={k} ref={(r) => { refs.current[k] = r }} args={[p.mesh.geometry, p.mesh.material, 200]} frustumCulled={false} castShadow={shadows} />
      ))}
    </>
  )
}

/** Every zombie on the table. `slugs` are the listed zombie models; the points are dealt to the loaded ones in turn. */
export function ZombieField({ points, slugs }: { points: readonly Pt[]; slugs: readonly string[] }): ReactElement {
  const glbs = useGlbs(slugs)
  const ready = glbs.filter((g): g is LoadedGlb => !!g)
  const groups = useMemo(() => {
    const out: Pt[][] = ready.map(() => [])
    points.forEach((p, i) => { if (out.length) out[i % out.length]!.push(p) })
    return out
    // `ready` changes identity every render; its contents are what matter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, ready.length])
  if (ready.length === 0) return <Instanced points={points} max={160} y={0.7} geometry={G.capsule} material={M.zombie} jitter />
  return (
    <>
      {ready.map((g, i) => (groups[i]!.length ? <ZombieVariant key={slugs[glbs.indexOf(g)]} glb={g} points={groups[i]!} offset={i} /> : null))}
    </>
  )
}
