// The GLB manifest: parsing tolerates every shape the art pipeline might write, and slugs map to survivors and zombies.
import { afterEach, describe, expect, it } from 'vitest'
import { glbSlugs, isZombieSlug, parseGlbManifest, setGlbManifestForTest, survivorSlug, zombieSlugs } from '../../src/client/figures/glbManifest'

afterEach(() => setGlbManifestForTest([]))

describe('glb manifest', () => {
  it('parses { slugs }, a bare array, objects with a file, and ignores junk', () => {
    expect(parseGlbManifest({ slugs: ['alexis-grey', 'zombie-1'] }).map((e) => e.slug)).toEqual(['alexis-grey', 'zombie-1'])
    expect(parseGlbManifest(['a', 'b.glb']).map((e) => e.slug)).toEqual(['a', 'b'])
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
