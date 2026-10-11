import { describe, expect, it } from 'vitest'
import { assembleBundleFromDir, validateDir } from '../../tools/validate-data'
import { DEFAULT_DATA_DIR, loadDefaultBundle } from '../../tools/default-bundle'

describe('default bundle (src/data)', () => {
  it('DATA-M2-001 validates with 0 errors and the M2 card counts', async () => {
    const run = await validateDir(DEFAULT_DATA_DIR)
    expect(run.issues.filter((i) => i.severity === 'error')).toEqual([])
    expect(run.counts).toMatchObject({ survivors: 30, crises: 20, crossroads: 80, mainObjectives: 10 })
  })

  it('DATA-M2-002 names-only objective stubs (status unknown / text null) are never loaded', () => {
    const { raw } = assembleBundleFromDir(DEFAULT_DATA_DIR)
    const loaded = raw.records.secretObjectives as unknown as { status?: string; text: unknown }[]
    expect(loaded.length).toBe(44) // 31 before the card photos (26 in M2 + All I Need Is My Books (owner photo, M3) + Junkie, Hypochondriac, Gluttony, Obsessed (eBay photos); +11 from the bing card photos and the pt-br sheet, Hoarder and Neat Freak became real records from the VASSAL scans
    expect(loaded.every((o) => o.status !== 'unknown' && o.text != null)).toBe(true)
  })

  it('DATA-M2-003 loadDefaultBundle builds an engine bundle', () => {
    const b = loadDefaultBundle()
    expect(b.records.survivors.length).toBe(30)
    expect(b.records.secretObjectives.filter((o) => o.type === 'betrayal').length).toBe(10)
  })

  it('DATA-M2-004 the photo objectives load with working goal parts (Gluttony, Obsessed, Junkie)', () => {
    const b = loadDefaultBundle()
    const byId = (id: string) => b.records.secretObjectives.find((o) => o.id === id) as unknown as { status: string; complete: unknown; sources: Record<string, string> }
    for (const id of ['obj.betrayal.gluttony', 'obj.betrayal.obsessed', 'obj.secret.junkie']) {
      expect(byId(id).status).toBe('verified')
      expect(byId(id).complete).toBeTruthy()
      expect(byId(id).sources['complete']).toMatch(/^(PHOTO ebay |VASSAL v1.1 )/)
    }
  })

  it('DATA-M2-005 VASSAL v1.1 corrections load: Hoarder, Neat Freak, Hypochondriac, Leave It All Behind, Find a Cure, We Need More Samples', () => {
    const b = loadDefaultBundle()
    const rec = (id: string) => b.records.secretObjectives.find((o) => o.id === id) as unknown as { status: string; complete: unknown; sources: Record<string, string> }
    expect(rec('obj.secret.hoarder').complete).toEqual({ code: 'rule.hand.mostCards' })
    expect(rec('obj.secret.neat-freak').complete).toEqual({ code: 'rule.hand.onlySymbol', params: { symbol: 'medicine' } })
    expect(rec('obj.secret.hypochondriac').complete).toMatchObject({ test: 'handHasSymbol', symbol: 'medicine', value: 2 })
    for (const id of ['obj.secret.hoarder', 'obj.secret.neat-freak', 'obj.secret.hypochondriac']) {
      expect(rec(id).status).toBe('verified')
      expect(rec(id).sources['complete']).toMatch(/^VASSAL v1.1 Secret_Objectives_/)
    }
    const main = (id: string) => b.records.mainObjectives.find((o) => o.id === id) as unknown as { sides: Record<string, { counters: Record<string, { perSeatMultiplier: number }>; setup?: { value: number; scope?: { who: string } }[] }> }
    expect(main('obj.main.leave-it-all-behind').sides['hardcore']!.counters['food']!.perSeatMultiplier).toBe(3)
    expect(main('obj.main.leave-it-all-behind').sides['hardcore']!.setup!.find((n) => n.scope?.who === 'nonColonyLocations')!.value).toBe(3)
    expect(main('obj.main.find-a-cure').sides['hardcore']!.counters['medicine']!.perSeatMultiplier).toBe(3)
    expect(main('obj.main.we-need-more-samples').sides['hardcore']!.counters['samples']!.perSeatMultiplier).toBe(4)
  })

  it('DATA-M2-006 every crisis carries its official English name', () => {
    const b = loadDefaultBundle()
    const names = b.records.crises.map((c) => c.name).sort()
    expect(names).toEqual(['Blizzard', 'Despair', "Dead Man's March", 'Exhaustion', 'Food Spoilage', 'Fuel Shortage', 'Hailstorm', 'Horror in the Night', 'Illness', 'Killer Instinct', 'Legions of Death',
      'Overpopulation', 'Raiders', 'Shaking Things Up', 'Starvation', 'Strength of the Dead', "They're Watching Us", 'Unending Hordes', 'Waste Not', 'Zombie Surge'].sort())
  })
})
