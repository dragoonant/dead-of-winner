// GLB figures on the table. A survivor GLB stands on a round base tinted to its seat colour (the model is scaled to a fixed height and centred on
// the base, whatever its own origin); zombies are drawn from every listed zombie GLB as instanced meshes (one draw call per mesh per variant),
// and fall back to the procedural capsule while no zombie GLB has loaded.
import { useLayoutEffect, useMemo, useRef, type ReactElement } from 'react'
import * as THREE from 'three'
import { G, Instanced, M, matsFor } from '../table/sceneKit'
import type { Pt } from '../table/layout'
import { flattenMeshes, useGlbs, type LoadedGlb } from './glbLoader'

export const SURVIVOR_HEIGHT = 2.5
export const SURVIVOR_MAX_WIDTH = 1.5
export const ZOMBIE_HEIGHT = 2.3

/** The body of a survivor from its loaded GLB (see `useGlbClone`), on a seat-coloured base. */
export function GlbSurvivor({ clone, colour }: { clone: { object: THREE.Object3D; glb: LoadedGlb }; colour: string }): ReactElement {
  const fit = useMemo(() => { const f = clone.glb.fit(SURVIVOR_HEIGHT, SURVIVOR_MAX_WIDTH); return { scale: f.scale, offset: new THREE.Vector3().setFromMatrixPosition(f.matrix) } }, [clone])
  return (
    <>
      <mesh geometry={G.base} material={matsFor(colour).base} position-y={0.07} />
      <group position={[fit.offset.x, 0.14 + fit.offset.y, fit.offset.z]} scale={fit.scale}><primitive object={clone.object} /></group>
    </>
  )
}

function ZombieVariant({ glb, points, offset }: { glb: LoadedGlb; points: readonly Pt[]; offset: number }): ReactElement {
  const parts = useMemo(() => flattenMeshes(glb), [glb])
  const fit = useMemo(() => glb.fit(ZOMBIE_HEIGHT, 1.7), [glb])
  const refs = useRef<(THREE.InstancedMesh | null)[]>([])
  useLayoutEffect(() => {
    const place = new THREE.Matrix4()
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
        m.copy(place).multiply(rot).multiply(fit.matrix).multiply(p.matrix)
        inst.setMatrixAt(i, m)
      })
      inst.count = points.length
      inst.instanceMatrix.needsUpdate = true
    })
  }, [parts, points, fit, offset])
  return (
    <>
      {parts.map((p, k) => (
        <instancedMesh key={k} ref={(r) => { refs.current[k] = r }} args={[p.mesh.geometry, p.mesh.material, 200]} frustumCulled={false} />
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
