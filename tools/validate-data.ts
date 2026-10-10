// npm run validate:data [dir ...]: assemble a record folder tree (one JSON per record, spec 20 §1) into a RawBundle, validate it with
// the schemas and the cross-record rules (src/data/index.ts), and check code-hook names against src/engine/code-hooks.ts when that
// file exists (otherwise src/data/hook-names.json). Default dirs: src/data and tests/fixtures/bundle (each only if it holds records).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { DEFAULT_HOOK_NAMES, validateBundle } from '../src/data/index'
import type { DataIssue, HookNames, RawBundle } from '../src/data/types'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** folder name -> key in RawBundle.records */
export const FOLDERS: Record<string, keyof RawBundle['records']> = {
  survivors: 'survivors', items: 'items', decks: 'decks', locations: 'locations', crises: 'crises', crossroads: 'crossroads',
  'main-objectives': 'mainObjectives', 'secret-objectives': 'secretObjectives', personas: 'personas',
}
const KIND_BY_FOLDER: Record<string, string> = {
  survivors: 'survivor', items: 'item', decks: 'deck', locations: 'location', crises: 'crisis', crossroads: 'crossroads',
  'main-objectives': 'mainObjective', 'secret-objectives': 'secretObjective', personas: 'persona',
}

export function slugOfId(id: string): string {
  return id.includes('.') ? id.split('.').slice(1).join('-') : id
}

/** Read `dir` into a RawBundle plus file-level issues (V-01 folder/kind, V-02 file name = slug). */
export function assembleBundleFromDir(dir: string): { raw: RawBundle; issues: DataIssue[] } {
  const issues: DataIssue[] = []
  const records = Object.fromEntries(Object.values(FOLDERS).map((k) => [k, [] as unknown[]])) as Record<string, unknown[]>
  for (const [folder, key] of Object.entries(FOLDERS)) {
    const fdir = path.join(dir, folder)
    if (!fs.existsSync(fdir)) continue
    for (const file of fs.readdirSync(fdir).filter((f) => f.endsWith('.json')).sort()) {
      const full = path.join(fdir, file)
      let rec: { kind?: string; id?: string }
      try { rec = JSON.parse(fs.readFileSync(full, 'utf8')) } catch (e) {
        issues.push({ rule: 'V-01', severity: 'error', where: full, message: `unreadable JSON: ${(e as Error).message}` })
        continue
      }
      if (rec.kind !== KIND_BY_FOLDER[folder]) issues.push({ rule: 'V-01', severity: 'error', where: `${folder}/${file}`, message: `kind '${rec.kind}' does not match folder` })
      if (rec.id && slugOfId(rec.id) + '.json' !== file) issues.push({ rule: 'V-02', severity: 'error', where: `${folder}/${file}`, message: `file name should be ${slugOfId(rec.id)}.json` })
      records[key].push(rec)
    }
  }
  // Array files: objectives/{main,secret,betrayal,exiled}.json hold many records each. Names-only stubs (status 'unknown' / text null) are skipped.
  const odir = path.join(dir, 'objectives')
  if (fs.existsSync(odir)) {
    for (const [file, key] of [['main', 'mainObjectives'], ['secret', 'secretObjectives'], ['betrayal', 'secretObjectives'], ['exiled', 'secretObjectives']] as const) {
      const full = path.join(odir, file + '.json')
      if (!fs.existsSync(full)) continue
      let arr: { kind?: string; status?: string; text?: unknown }[]
      try { arr = JSON.parse(fs.readFileSync(full, 'utf8')) } catch (e) {
        issues.push({ rule: 'V-01', severity: 'error', where: full, message: `unreadable JSON: ${(e as Error).message}` })
        continue
      }
      if (!Array.isArray(arr)) { issues.push({ rule: 'V-01', severity: 'error', where: full, message: 'objectives file must be an array' }); continue }
      for (const rec of arr) {
        if (rec.status === 'unknown' || rec.text == null) continue
        if (rec.kind !== KIND_BY_FOLDER[key === 'mainObjectives' ? 'main-objectives' : 'secret-objectives']) issues.push({ rule: 'V-01', severity: 'error', where: `objectives/${file}.json`, message: `kind '${rec.kind}' does not match file` })
        records[key].push(rec)
      }
    }
  }
  const versionFile = path.join(dir, 'version.json')
  const slicesFile = path.join(dir, 'slices.json')
  const version = fs.existsSync(versionFile) ? (JSON.parse(fs.readFileSync(versionFile, 'utf8')) as { version: string }).version : '0.0.0'
  const slices = fs.existsSync(slicesFile) ? (JSON.parse(fs.readFileSync(slicesFile, 'utf8')) as Record<string, string[]>) : undefined
  const raw = { version, records, ...(slices ? { slices } : {}) } as unknown as RawBundle
  return { raw, issues }
}

/** Hook names from src/engine/code-hooks.ts (CODE_HOOKS) when it exists, else the names file. */
export async function loadHookNames(): Promise<{ names: HookNames; source: string }> {
  const file = path.join(ROOT, 'src/engine/code-hooks.ts')
  if (fs.existsSync(file)) {
    try {
      const mod = (await import(pathToFileURL(file).href)) as { CODE_HOOKS?: { conditions: object; effects: object; objectives: object } }
      if (mod.CODE_HOOKS) {
        const h = mod.CODE_HOOKS
        return { names: { conditions: Object.keys(h.conditions), effects: Object.keys(h.effects), objectives: Object.keys(h.objectives) }, source: 'src/engine/code-hooks.ts' }
      }
    } catch (e) {
      console.warn(`validate-data: could not import code-hooks.ts (${(e as Error).message}); using hook-names.json`)
    }
  }
  return { names: DEFAULT_HOOK_NAMES, source: 'src/data/hook-names.json' }
}

// ---------- prose check (V-17, local only: docs/sources is gitignored) ----------
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
function loadSourceCorpus(): string | null {
  const dir = path.join(ROOT, 'docs/sources')
  if (!fs.existsSync(dir)) return null
  const parts: string[] = []
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.(txt|md)$/i.test(e.name)) parts.push(norm(fs.readFileSync(p, 'utf8')))
    }
  }
  walk(dir)
  return ' ' + parts.join(' ') + ' '
}
function proseOf(rec: Record<string, unknown>): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = []
  const walk = (x: unknown, p: string) => {
    if (p.startsWith('sources') || p.startsWith('notes')) return
    if (typeof x === 'string') { if (/^text\./.test(p)) out.push({ path: p, text: x }) }
    else if (Array.isArray(x)) x.forEach((v, i) => walk(v, `${p}[${i}]`))
    else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) walk(v, p ? `${p}.${k}` : k)
  }
  walk(rec, '')
  return out
}
export function proseIssues(raw: RawBundle, corpus: string): DataIssue[] {
  const issues: DataIssue[] = []
  for (const list of Object.values(raw.records)) for (const rec of list as unknown as Record<string, unknown>[]) {
    for (const { path: p, text } of proseOf(rec)) {
      for (const sentence of text.split(/(?<=[.!?])\s+/)) {
        const n = norm(sentence)
        if (n.split(' ').length >= 8 && corpus.includes(' ' + n + ' ')) issues.push({ rule: 'V-17', severity: 'error', where: `${String(rec.id)}.${p}`, message: 'sentence of 8+ words equals a line in docs/sources' })
      }
    }
  }
  return issues
}

export interface ValidateRun { dir: string; issues: DataIssue[]; counts: Record<string, number>; hookSource: string }
export async function validateDir(dir: string, opts: { prose?: boolean } = {}): Promise<ValidateRun> {
  const { raw, issues: fileIssues } = assembleBundleFromDir(dir)
  const { names, source } = await loadHookNames()
  const issues = [...fileIssues, ...validateBundle(raw, { hookNames: names })]
  if (opts.prose !== false) {
    const corpus = loadSourceCorpus()
    if (corpus) issues.push(...proseIssues(raw, corpus))
  }
  const counts = Object.fromEntries(Object.entries(raw.records).map(([k, v]) => [k, (v as unknown[]).length]))
  return { dir, issues, counts, hookSource: source }
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  const dirs = args.length ? args.map((a) => path.resolve(a)) : [path.join(ROOT, 'src/data'), path.join(ROOT, 'tests/fixtures/bundle')]
  let failed = false
  let ran = 0
  for (const dir of dirs) {
    const has = Object.keys(FOLDERS).some((f) => fs.existsSync(path.join(dir, f)))
    if (!has) { console.log(`validate-data: ${path.relative(ROOT, dir) || dir}: no record folders, skipped`); continue }
    ran++
    const run = await validateDir(dir)
    const errors = run.issues.filter((i) => i.severity === 'error')
    const warns = run.issues.filter((i) => i.severity === 'warn')
    console.log(`validate-data: ${path.relative(ROOT, dir)}: ${Object.entries(run.counts).map(([k, v]) => `${v} ${k}`).join(', ')} (hooks from ${run.hookSource})`)
    for (const i of run.issues) console.log(`  ${i.severity === 'error' ? 'ERROR' : 'warn '} [${i.rule}] ${i.where}: ${i.message}`)
    console.log(`  ${errors.length} error(s), ${warns.length} warning(s)`)
    if (errors.length) failed = true
  }
  if (!ran) console.log('validate-data: nothing to validate')
  process.exit(failed ? 1 : 0)
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) void main()
