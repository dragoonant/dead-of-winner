import { describe, expect, it } from 'vitest'
import { assembleBundleFromDir, validateDir } from '../../tools/validate-data'
import { DEFAULT_DATA_DIR, loadDefaultBundle } from '../../tools/default-bundle'

describe('default bundle (src/data)', () => {
  it('DATA-M2-001 validates with 0 errors and the M2 card counts', async () => {
    const run = await validateDir(DEFAULT_DATA_DIR)
    expect(run.issues.filter((i) => i.severity === 'error')).toEqual([])
    expect(run.counts).toMatchObject({ survivors: 30, crises: 20, crossroads: 20, mainObjectives: 10 })
  })

  it('DATA-M2-002 names-only objective stubs (status unknown / text null) are never loaded', () => {
    const { raw } = assembleBundleFromDir(DEFAULT_DATA_DIR)
    const loaded = raw.records.secretObjectives as unknown as { status?: string; text: unknown }[]
    expect(loaded.length).toBe(31) // 26 in M2 + All I Need Is My Books (owner photo, M3) + Junkie, Hypochondriac, Gluttony, Obsessed (eBay photos)
    expect(loaded.every((o) => o.status !== 'unknown' && o.text != null)).toBe(true)
  })

  it('DATA-M2-003 loadDefaultBundle builds an engine bundle', () => {
    const b = loadDefaultBundle()
    expect(b.records.survivors.length).toBe(30)
    expect(b.records.secretObjectives.filter((o) => o.type === 'betrayal').length).toBe(5)
  })

  it('DATA-M2-004 the photo objectives load with working goal parts (Gluttony, Obsessed, Junkie, Hypochondriac)', () => {
    const b = loadDefaultBundle()
    const byId = (id: string) => b.records.secretObjectives.find((o) => o.id === id) as unknown as { status: string; complete: unknown; sources: Record<string, string> }
    for (const id of ['obj.betrayal.gluttony', 'obj.betrayal.obsessed', 'obj.secret.junkie', 'obj.secret.hypochondriac']) {
      expect(byId(id).status).toBe('verified')
      expect(byId(id).complete).toBeTruthy()
      expect(byId(id).sources['complete']).toMatch(/^PHOTO ebay /)
    }
  })
})
