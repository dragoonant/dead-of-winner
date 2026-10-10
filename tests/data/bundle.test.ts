import { describe, expect, it } from 'vitest'
import { DataValidationError, hashBundle, loadBundle, sliceIds, validateBundle } from '../../src/data/index'
import type { DataBundle as EngineDataBundle } from '../../src/engine/types'
import type { RawBundle } from '../../src/data/types'
import { assembleBundleFromDir, validateDir } from '../../tools/validate-data'
import { FIXTURE_DIR, loadFixtureBundle, loadFixtureRaw } from '../fixtures/loadFixtureBundle'

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T
const errors = (raw: unknown) => validateBundle(raw).filter((i) => i.severity === 'error')

describe('data bundle (fixture)', () => {
  it('DATA-001 the fixture folder validates clean: schema, cross-record rules, hook names, prose', async () => {
    const run = await validateDir(FIXTURE_DIR)
    expect(run.issues.filter((i) => i.severity === 'error')).toEqual([])
    expect(run.counts).toMatchObject({ survivors: 12, decks: 7, locations: 7, crises: 8, crossroads: 20, mainObjectives: 1 })
  })

  it('DATA-002 the 6 locations carry the sourced space counts and symbol orders; the colony has 6 entrances and no deck', () => {
    const b = loadFixtureBundle()
    const loc = (id: string) => b.records.locations.find((l) => l.id === id)!
    expect(loc('colony').spaces).toEqual({ survivors: 24, entrances: 6, entranceSpaces: 3, noise: 0 })
    expect(loc('colony').deck).toBeNull()
    const sc = (id: string) => { const l = loc(id); return [l.number, l.spaces.survivors, l.spaces.entranceSpaces, l.spaces.noise] }
    expect(sc('loc.police-station')).toEqual([1, 3, 4, 4])
    expect(sc('loc.grocery-store')).toEqual([2, 3, 4, 4])
    expect(sc('loc.school')).toEqual([3, 4, 4, 4])
    expect(sc('loc.library')).toEqual([4, 3, 3, 4])
    expect(sc('loc.hospital')).toEqual([5, 4, 4, 4])
    expect(sc('loc.gas-station')).toEqual([6, 2, 3, 4])
    expect(loc('loc.library').symbolOrder).toEqual(['education', 'fuel', 'food', 'tool', 'survivor'])
    expect(loc('loc.grocery-store').symbolOrder).toEqual(['food', 'medicine', 'tool', 'survivor'])
  })

  it('DATA-003 the starter deck holds 25 cards and each location deck 20, with the sourced symbol counts', () => {
    const b = loadFixtureBundle()
    const symbolCounts = (deckId: string) => {
      const d = b.records.decks.find((x) => x.id === deckId)!
      const counts: Record<string, number> = {}
      for (const c of d.cards) { const it = b.byId[c.item] as { symbol: string }; counts[it.symbol] = (counts[it.symbol] ?? 0) + c.count }
      return { size: d.cards.reduce((n, c) => n + c.count, 0), counts }
    }
    expect(symbolCounts('deck.starter')).toEqual({ size: 25, counts: { food: 10, medicine: 5, fuel: 5, tool: 5 } })
    expect(symbolCounts('deck.police-station')).toEqual({ size: 20, counts: { weapon: 6, fuel: 4, tool: 4, food: 3, survivor: 3 } })
    expect(symbolCounts('deck.library')).toEqual({ size: 20, counts: { education: 7, fuel: 4, food: 4, tool: 2, survivor: 3 } })
    expect(symbolCounts('deck.gas-station')).toEqual({ size: 20, counts: { fuel: 6, weapon: 5, food: 3, medicine: 3, survivor: 3 } })
    for (const d of b.records.decks) expect(symbolCounts(d.id).size).toBe(d.id === 'deck.starter' ? 25 : 20)
  })

  it('DATA-004 the first 12 survivors have real stats, distinct influence and a resolvable ability', () => {
    const b = loadFixtureBundle()
    const s = b.records.survivors
    expect(s.map((x) => x.name)).toEqual(['Alexis Grey', 'Andrew Evans', 'Annaleigh Chan', 'Arthur Thurston', 'Ashley Ross', 'Bev Russell',
      'Brandon Kane', 'Brian Lee', 'Buddy Davis', 'Carla Thompson', 'Daniel Smith', 'David Garcia'])
    expect(new Set(s.map((x) => x.stats.influence)).size).toBe(12)
    expect(s.find((x) => x.id === 'sv.daniel-smith')!.stats).toEqual({ influence: 66, attack: 2, search: 5 })
    expect(s.find((x) => x.id === 'sv.alexis-grey')!.stats.influence).toBe(46)
    expect(s.find((x) => x.id === 'sv.annaleigh-chan')!.coop).toBe(false)
    for (const x of s) expect('unknown' in x.ability).toBe(false)
  })

  it('DATA-005 crises, Crossroads and objectives are all present: 8 crises, 20 cards, We Need More Samples both sides, 13+3+10 secret', () => {
    const b = loadFixtureBundle()
    expect(b.records.crises).toHaveLength(8)
    expect(b.records.crossroads).toHaveLength(20)
    for (const x of b.records.crossroads) { expect(x.options).toHaveLength(2); expect(x.trigger.point.startsWith('action.')).toBe(true) }
    const m = b.records.mainObjectives[0]
    expect(m.id).toBe('obj.main.we-need-more-samples')
    expect(m.sides.normal.rounds).toBe(6)
    expect(m.sides.hardcore.rounds).toBe(5)
    expect(m.sides.normal.counters).toEqual({ samples: { need: 'perSeat', perSeatMultiplier: 3 } })
    const so = b.records.secretObjectives
    expect(so.filter((o) => o.type === 'secret')).toHaveLength(13)
    expect(so.filter((o) => o.type === 'betrayal').map((o) => o.code).sort()).toEqual(['S16', 'S17', 'S18'])
    expect(so.filter((o) => o.type === 'exiled')).toHaveLength(10)
    for (const o of so.filter((x) => x.type === 'betrayal')) expect((o.complete as { all: unknown[] }).all[0]).toEqual({ test: 'moraleAtMost', subject: 'colony', value: 0 })
  })

  it('DATA-006 loadBundle stamps a content hash into version/dataVersion; any mechanical edit changes it, repeated loads match', () => {
    const raw = loadFixtureRaw()
    const a = loadBundle(clone(raw))
    const b = loadBundle(clone(raw))
    expect(a.version).toBe(b.version)
    expect(a.version).toBe(a.dataVersion)
    expect(a.version).toMatch(/^0\.1\.0\+[0-9a-f]{16}$/)
    const edited = clone(raw)
    edited.records.survivors[0].stats.attack = 4
    expect(loadBundle(edited).version).not.toBe(a.version)
    expect(hashBundle(raw)).toBe(a.hash)
  })

  it('DATA-007 byId resolves every record and every id reference; slice "first" pulls in referenced decks, items, survivors and Crossroads', () => {
    const b = loadFixtureBundle()
    const engineView: EngineDataBundle = b // the data bundle is assignable to the engine's DataBundle (registered by version)
    expect(engineView.version).toBe(b.version)
    expect(Object.keys(b.byId)).toHaveLength(12 + 39 + 7 + 7 + 8 + 20 + 1 + 26)
    for (const x of b.records.crossroads) if (x.survivor) expect(b.byId[x.survivor]?.kind).toBe('survivor')
    const first = new Set(sliceIds(b, 'first'))
    expect(first.has('deck.starter') && first.has('it.lighter') && first.has('xr.brian-lee') && first.has('colony')).toBe(true)
    expect(sliceIds(b, 'all')).toHaveLength(Object.keys(b.byId).length)
    expect(() => sliceIds(b, 'nope')).toThrow(/unknown data slice/)
  })

  it('DATA-008 the validator rejects bad data: broken refs, deck sums, duplicate influence, undeclared counters, unknown hooks', () => {
    const raw = loadFixtureRaw()
    const t = (mutate: (r: RawBundle) => void, rule: string) => {
      const r = clone(raw); mutate(r)
      expect(errors(r).map((i) => i.rule), rule).toContain(rule)
    }
    t((r) => { r.records.decks[1].cards[0].item = 'it.nope' }, 'V-03')
    t((r) => { r.records.decks[0].cards[0].count += 1 }, 'V-04')
    t((r) => { r.records.survivors[1].stats.influence = r.records.survivors[0].stats.influence }, 'V-07')
    t((r) => { r.records.mainObjectives[0].sides.normal.counters = {} }, 'V-11')
    t((r) => { r.records.secretObjectives.find((o) => o.type === 'secret')!.complete = { code: 'rule.made.up' } }, 'V-20')
    t((r) => { r.records.locations[1].symbolOrder = ['weapon'] }, 'V-05')
    t((r) => { r.records.crossroads[0].trigger.point = 'turn.start' }, 'V-09')
    t((r) => { r.records.items[0].sources = { nope: 'W' } }, 'V-16')
    t((r) => { (r.records.items[0] as unknown as { stray: number }).stray = 1 }, 'V-01')
    expect(() => loadBundle({ version: '1.0.0', records: {} })).toThrow(DataValidationError)
  })

  it('DATA-009 every card effect keeps to the DSL: lasting ops carry durations, votes are yes/no, and every code hook is registered', () => {
    const raw = loadFixtureRaw()
    const all = JSON.stringify(raw)
    const used = new Set([...all.matchAll(/"code":"((?:survivor|item|crisis|crossroads|objective|rule)\.[a-z0-9-]+\.[A-Za-z0-9]+)"/g)].map((m) => m[1]))
    expect(used.size).toBeGreaterThanOrEqual(10)
    expect(validateBundle(raw).filter((i) => i.rule === 'V-20')).toEqual([])
    expect(validateBundle(raw).filter((i) => i.rule === 'V-10' && i.severity === 'error')).toEqual([])
    const votes = [...all.matchAll(/"op":"vote"/g)].length
    expect(votes).toBeGreaterThanOrEqual(3)
  })

  it('DATA-010 the folder tree matches the id convention: one record per file, file name = id slug, folders match kinds', () => {
    const { raw, issues } = assembleBundleFromDir(FIXTURE_DIR)
    expect(issues).toEqual([])
    const total = Object.values(raw.records).reduce((n, l) => n + l.length, 0)
    expect(total).toBe(120)
  })
})
