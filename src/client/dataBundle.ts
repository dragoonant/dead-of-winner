// Builds the validated DataBundle from the per-record JSON under src/data (one record per file in the record folders, plus the
// objectives/*.json array files). Mirrors tools/validate-data.ts assembleBundleFromDir so the browser and the sim load the same bundle
// (same content hash). Loaded as its own chunk: the title screen never pays for it. Browser-safe.
import { loadBundle } from '../data/index'
import type { DataBundle, RawBundle } from '../data/types'

const FOLDERS: Record<string, keyof RawBundle['records']> = {
  survivors: 'survivors', items: 'items', decks: 'decks', locations: 'locations', crises: 'crises', crossroads: 'crossroads',
  'main-objectives': 'mainObjectives', 'secret-objectives': 'secretObjectives', personas: 'personas',
}
const OBJECTIVE_FILES: Record<string, keyof RawBundle['records']> = {
  main: 'mainObjectives', secret: 'secretObjectives', betrayal: 'secretObjectives', exiled: 'secretObjectives',
}

type Json = unknown
const modules = import.meta.glob(['../data/*/*.json', '../data/*.json'], { eager: true, import: 'default' }) as Record<string, Json>

/** Assemble a RawBundle from `{ '<anything>/data/<folder>/<file>.json': json }`. Files are sorted by path so the hash is stable. */
export function assembleRaw(files: Record<string, Json>): RawBundle {
  const records = Object.fromEntries(Object.values(FOLDERS).map((k) => [k, [] as unknown[]])) as Record<string, unknown[]>
  let version = '0.0.0'
  let slices: Record<string, string[]> | undefined
  const byRel = new Map<string, Json>()
  for (const [p, j] of Object.entries(files)) {
    const m = /(?:^|\/)data\/(.+\.json)$/.exec(p)
    if (m) byRel.set(m[1]!, j)
  }
  const rels = [...byRel.keys()].sort()
  for (const [folder, key] of Object.entries(FOLDERS)) {
    for (const rel of rels) {
      const parts = rel.split('/')
      if (parts.length === 2 && parts[0] === folder) records[key]!.push(byRel.get(rel))
    }
  }
  for (const [file, key] of Object.entries(OBJECTIVE_FILES)) {
    const arr = byRel.get(`objectives/${file}.json`)
    if (!Array.isArray(arr)) continue
    for (const rec of arr as { status?: string; text?: unknown }[]) {
      if (rec.status === 'unknown' || rec.text == null) continue // names-only stubs
      records[key]!.push(rec)
    }
  }
  const v = byRel.get('version.json') as { version?: unknown } | undefined
  if (v && typeof v.version === 'string') version = v.version
  const s = byRel.get('slices.json')
  if (s) slices = s as Record<string, string[]>
  return { version, records, ...(slices ? { slices } : {}) } as unknown as RawBundle
}

let cached: DataBundle | null = null
export function buildBundle(): DataBundle {
  cached ??= loadBundle(assembleRaw(modules))
  return cached
}
