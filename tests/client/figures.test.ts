// The GLB manifest: parsing tolerates every shape the art pipeline might write, and slugs map to survivors and zombies.
import { afterEach, describe, expect, it } from 'vitest'
import { glbSlugs, isZombieSlug, parseGlbManifest, setGlbManifestForTest, survivorSlug, zombieSlugs } from '../../src/client/figures/glbManifest'

afterEach(() => setGlbManifestForTest([]))

describe('glb manifest', () => {
  it('parses { slugs }, a bare array, objects with a file, and ignores junk', () => {
    expect(parseGlbManifest({ slugs: ['alexis-grey', 'zombie-1'] }).map((e) => e.slug)).toEqual(['alexis-grey', 'zombie-1'])
    expect(parseGlbManifest(['a', 'b.glb']).map((e) => e.slug)).toEqual(['a', 'b'])
    // the Hunyuan pipeline's shape: a top-level map of slug -> { file, heightIn, tris }
    const piped = parseGlbManifest({ 'alexis-grey': { file: 'alexis-grey.glb', heightIn: 1.2, tris: 6155 }, 'zombie-crawler': { file: 'zombie-crawler.glb' } })
    expect(piped.map((e) => e.slug)).toEqual(['alexis-grey', 'zombie-crawler'])
    expect(piped[0].url.endsWith('assets/models/alexis-grey.glb')).toBe(true)
    expect(parseGlbManifest({ models: [{ slug: 'x', file: 'x.glb' }] })[0]?.url).toMatch(/assets\/models\/x\.glb$/)
    expect(parseGlbManifest({ models: { 'zombie-a': 'zombie-a.glb' } }).map((e) => e.slug)).toEqual(['zombie-a'])
    expect(parseGlbManifest(null)).toEqual([])
    expect(parseGlbManifest({ slugs: [1, 'has space', 'a/b/../c d'] })).toEqual([])
    expect(parseGlbManifest({ slugs: ['../evil'] }).map((e) => e.url)).toEqual(['/assets/models/evil.glb']) // only a bare file name is ever requested
    expect(parseGlbManifest({ models: [{ slug: 'x', file: '../../etc/passwd.glb' }] })[0]?.url).toMatch(/assets\/models\/x\.glb$/)
  })

  it('maps survivor ids to listed slugs and keeps procedural otherwise; zombies are every listed zombie model', () => {
    setGlbManifestForTest(['alexis-grey', 'zombie-walker', 'zombie-runner', 'wolf'])
    expect(survivorSlug('sv.alexis-grey')).toBe('alexis-grey')
    expect(survivorSlug('sv.bev-russell')).toBeUndefined()
    expect(zombieSlugs()).toEqual(['zombie-runner', 'zombie-walker'])
    expect(isZombieSlug('zombie-walker')).toBe(true)
    expect(glbSlugs()).toHaveLength(4)
  })

  it('an empty manifest leaves everything procedural', () => {
    setGlbManifestForTest([])
    expect(survivorSlug('sv.alexis-grey')).toBeUndefined()
    expect(zombieSlugs()).toEqual([])
  })
})

describe('figure look and model budget', () => {
  it('repaints a baked texture as an sRGB, matte, lifted standard material (cached per source material)', async () => {
    const THREE = await import('three')
    const { FIGURE_LOOK, paintedMaterial } = await import('../../src/client/figures/figureLook')
    const tex = new THREE.Texture()
    const src = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.2, metalness: 1 })
    const m = paintedMaterial(src) as import('three').MeshStandardMaterial
    expect(m.map).toBe(tex)
    expect(tex.colorSpace).toBe(THREE.SRGBColorSpace)
    expect(m.roughness).toBeCloseTo(FIGURE_LOOK.roughness)
    expect(m.metalness).toBe(0)
    expect(m.emissiveMap).toBe(tex)
    expect(m.emissive.r).toBeGreaterThan(0)
    expect(paintedMaterial(src)).toBe(m)
  })

  it('the optimised GLBs stay under the 8 MB load budget and are listed in the manifest', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs')
    const dir = 'public/assets/models'
    const glbs = readdirSync(dir).filter((f) => f.endsWith('.glb'))
    const total = glbs.reduce((n, f) => n + statSync(`${dir}/${f}`).size, 0)
    expect(total).toBeLessThan(8 * 1024 * 1024)
    const listed = Object.keys(JSON.parse(readFileSync(`${dir}/manifest.json`, 'utf8')) as Record<string, unknown>)
    expect(glbs.map((f) => f.replace(/\.glb$/, '')).sort()).toEqual(listed.sort())
  })
})
