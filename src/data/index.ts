// Data layer entry (spec 20 §4–§5): validate a RawBundle against docs/spec/schemas, run the cross-record rules, and build the
// DataBundle the engine registers. Browser-safe (no fs); tools/validate-data.ts assembles a bundle from a folder and calls this.
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import bundleSchema from '../../docs/spec/schemas/bundle.json'
import commonSchema from '../../docs/spec/schemas/common.json'
import crisisSchema from '../../docs/spec/schemas/crisis.json'
import crossroadsSchema from '../../docs/spec/schemas/crossroads.json'
import deckSchema from '../../docs/spec/schemas/deck.json'
import itemSchema from '../../docs/spec/schemas/item.json'
import locationSchema from '../../docs/spec/schemas/location.json'
import mainObjectiveSchema from '../../docs/spec/schemas/main-objective.json'
import personaSchema from '../../docs/spec/schemas/persona.json'
import secretObjectiveSchema from '../../docs/spec/schemas/secret-objective.json'
import survivorSchema from '../../docs/spec/schemas/survivor.json'
import hookNamesFile from './hook-names.json'
import type {
  DataBundle, DataIssue, DataRecord, HookNames, IssueSeverity, RawBundle, RecordKind,
} from './types'

export * from './types'

export const SCHEMAS = [
  commonSchema, bundleSchema, crisisSchema, crossroadsSchema, deckSchema, itemSchema, locationSchema, mainObjectiveSchema,
  personaSchema, secretObjectiveSchema, survivorSchema,
] as const

export const DEFAULT_HOOK_NAMES: HookNames = hookNamesFile as HookNames

export class DataValidationError extends Error {
  readonly issues: DataIssue[]
  constructor(issues: DataIssue[]) {
    const errs = issues.filter((i) => i.severity === 'error')
    super(`data bundle invalid: ${errs.length} error(s)\n` + errs.slice(0, 12).map((i) => `  [${i.rule}] ${i.where}: ${i.message}`).join('\n'))
    this.name = 'DataValidationError'
    this.issues = issues
  }
}

// ---------- schema validation ----------
type ValidateFn = ((data: unknown) => boolean) & { errors?: { instancePath: string; message?: string; keyword: string; params: Record<string, unknown> }[] | null }
let cachedValidate: ValidateFn | null = null
function bundleValidator(): ValidateFn {
  if (cachedValidate) return cachedValidate
  const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true })
  ;(addFormats as unknown as (a: unknown) => void)(ajv)
  for (const s of SCHEMAS) ajv.addSchema(s)
  cachedValidate = ajv.getSchema(bundleSchema.$id) as unknown as ValidateFn
  return cachedValidate
}

// ---------- constants ----------
const KIND_BY_KEY = {
  survivors: 'survivor', items: 'item', decks: 'deck', locations: 'location', crises: 'crisis', crossroads: 'crossroads',
  mainObjectives: 'mainObjective', secretObjectives: 'secretObjective', personas: 'persona',
} as const satisfies Record<keyof RawBundle['records'], RecordKind>
type RecordsKey = keyof typeof KIND_BY_KEY
const PREFIX_BY_KIND: Record<RecordKind, RegExp> = {
  survivor: /^sv\./, item: /^it\./, deck: /^deck\./, location: /^(colony|loc\.)/, crisis: /^cr\./, crossroads: /^xr\./,
  mainObjective: /^obj\.main\./, secretObjective: /^obj\.(secret|betrayal|exiled)\./, persona: /^ps\./,
}
const SELF_SCOPED_OPS = new Set(['forbid', 'grant', 'treatFaceAs'])
const NON_LOCATION_WORDS = new Set(['here', 'chosen', 'anywhere', 'nonColony'])

// ---------- helpers ----------
function* deepObjects(x: unknown, path = ''): Generator<{ node: Record<string, unknown>; path: string }> {
  if (Array.isArray(x)) {
    for (let i = 0; i < x.length; i++) yield* deepObjects(x[i], `${path}[${i}]`)
  } else if (x && typeof x === 'object') {
    const node = x as Record<string, unknown>
    yield { node, path }
    for (const [k, v] of Object.entries(node)) yield* deepObjects(v, path ? `${path}.${k}` : k)
  }
}
function hasPath(rec: unknown, dotPath: string): boolean {
  let cur: unknown = rec
  for (const raw of dotPath.split('.')) {
    const m = /^([^[\]]+)((?:\[\d+\])*)$/.exec(raw)
    if (!m || cur === null || typeof cur !== 'object') return false
    cur = (cur as Record<string, unknown>)[m[1]]
    if (cur === undefined) return false
    for (const idx of m[2].matchAll(/\[(\d+)\]/g)) {
      if (!Array.isArray(cur)) return false
      cur = cur[Number(idx[1])]
      if (cur === undefined) return false
    }
  }
  return true
}
function stableStringify(x: unknown): string {
  if (Array.isArray(x)) return '[' + x.map(stableStringify).join(',') + ']'
  if (x && typeof x === 'object') {
    const o = x as Record<string, unknown>
    return '{' + Object.keys(o).sort().map((k) => JSON.stringify(k) + ':' + stableStringify(o[k])).join(',') + '}'
  }
  return JSON.stringify(x)
}
/** cyrb53: small, fast, sync string hash (not cryptographic; it only stamps content identity). */
export function hashString(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0')
}
/** Content hash of a raw bundle (records + slices; the semver is excluded so a pure version bump keeps the hash). */
export function hashBundle(raw: Pick<RawBundle, 'records' | 'slices'>): string {
  return hashString(stableStringify({ records: raw.records, slices: raw.slices ?? {} }))
}

function allRecords(raw: RawBundle): { rec: DataRecord; key: RecordsKey }[] {
  const out: { rec: DataRecord; key: RecordsKey }[] = []
  for (const key of Object.keys(KIND_BY_KEY) as RecordsKey[]) for (const rec of (raw.records[key] ?? []) as DataRecord[]) out.push({ rec, key })
  return out
}

// ---------- validation ----------
export interface ValidateOptions { hookNames?: HookNames }

/** Schema pass plus the cross-record rules of spec 20 §5 (V-01 .. V-21). Never throws. */
export function validateBundle(rawIn: unknown, opts: ValidateOptions = {}): DataIssue[] {
  const issues: DataIssue[] = []
  const push = (rule: string, severity: IssueSeverity, where: string, message: string) => issues.push({ rule, severity, where, message })

  const validate = bundleValidator()
  if (!validate(rawIn)) {
    for (const e of validate.errors ?? []) push('V-01', 'error', e.instancePath || '/', `${e.message ?? e.keyword} ${JSON.stringify(e.params)}`)
    return issues // structural errors stop the run (spec 20 §5)
  }
  const raw = rawIn as RawBundle
  const hooks = opts.hookNames ?? DEFAULT_HOOK_NAMES
  const hookSet = new Set([...hooks.conditions, ...hooks.effects, ...hooks.objectives])
  const recs = allRecords(raw)

  // V-01 kind matches its array; V-02 ids unique, prefix matches kind
  const byId = new Map<string, DataRecord>()
  for (const { rec, key } of recs) {
    if (rec.kind !== KIND_BY_KEY[key]) push('V-01', 'error', rec.id, `kind '${rec.kind}' sits in records.${key}`)
    if (!PREFIX_BY_KIND[rec.kind].test(rec.id)) push('V-02', 'error', rec.id, `id prefix does not match kind ${rec.kind}`)
    if (byId.has(rec.id)) push('V-02', 'error', rec.id, 'duplicate id')
    byId.set(rec.id, rec)
  }
  const has = (id: unknown, kind?: RecordKind) => typeof id === 'string' && byId.has(id) && (!kind || byId.get(id)!.kind === kind)
  const live = (id: string) => byId.get(id)?.status !== 'placeholder'

  // V-03 references
  for (const d of raw.records.decks) for (const c of d.cards) if (!has(c.item, 'item')) push('V-03', 'error', d.id, `card item '${c.item}' not found`)
  for (const l of raw.records.locations) if (l.deck !== null && !has(l.deck, 'deck')) push('V-03', 'error', l.id, `deck '${l.deck}' not found`)
  for (const s of raw.records.survivors) if (s.crossroads && !has(s.crossroads, 'crossroads')) push('V-03', 'error', s.id, `crossroads '${s.crossroads}' not found`)
  for (const x of raw.records.crossroads) if (x.survivor && !has(x.survivor, 'survivor')) push('V-03', 'error', x.id, `survivor '${x.survivor}' not found`)
  for (const { rec } of recs) {
    for (const { node, path } of deepObjects(rec)) {
      const loc = node.location
      if (typeof loc === 'string' && !NON_LOCATION_WORDS.has(loc) && !has(loc, 'location')) push('V-03', 'error', `${rec.id}.${path}`, `location '${loc}' not found`)
      if (node.test === 'survivorIs' && !has(node.value, 'survivor')) push('V-03', 'error', `${rec.id}.${path}`, `survivor '${String(node.value)}' not found`)
    }
  }
  for (const [name, ids] of Object.entries(raw.slices ?? {})) for (const id of ids) {
    if (!has(id)) push('V-03', 'error', `slices.${name}`, `id '${id}' not found`)
    else if (!live(id)) push('V-15', 'error', `slices.${name}`, `placeholder record '${id}' is in a slice`)
  }

  // V-04 decks
  for (const d of raw.records.decks) {
    const sum = d.cards.reduce((n, c) => n + c.count, 0)
    if (sum !== d.size) push('V-04', 'error', d.id, `size ${d.size} but counts sum to ${sum}`)
    const want = d.id === 'deck.starter' ? 25 : 20
    if (d.size !== want) push('V-04', 'error', d.id, `a ${d.id === 'deck.starter' ? 'starter' : 'location'} deck holds ${want} cards, found ${d.size}`)
  }
  if (raw.records.decks.length !== 7) push('V-04', 'error', 'records.decks', `expected 7 decks (starter + 6), found ${raw.records.decks.length}`)

  // V-05 symbolOrder == symbols in the deck
  const itemById = new Map(raw.records.items.map((i) => [i.id, i]))
  for (const l of raw.records.locations) {
    if (l.deck === null) continue
    const deck = raw.records.decks.find((d) => d.id === l.deck)
    if (!deck) continue
    const present = new Set<string>()
    for (const c of deck.cards) { const it = itemById.get(c.item); if (it) for (const s of it.symbols ?? [it.symbol]) present.add(s) }
    const order = new Set(l.symbolOrder)
    if (order.size !== l.symbolOrder.length || [...present].some((s) => !order.has(s as never)) || [...order].some((s) => !present.has(s)))
      push('V-05', 'error', l.id, `symbolOrder [${l.symbolOrder.join(',')}] != deck symbols [${[...present].join(',')}]`)
  }

  // V-06 colony + 6 numbered locations
  const colony = raw.records.locations.find((l) => l.id === 'colony')
  if (!colony) push('V-06', 'error', 'records.locations', 'no colony record')
  else if (colony.spaces.entrances !== 6 || colony.deck !== null) push('V-06', 'error', 'colony', 'the colony needs 6 entrances and no deck')
  const nums = raw.records.locations.filter((l) => l.id !== 'colony').map((l) => l.number)
  if (nums.length !== 6 || [1, 2, 3, 4, 5, 6].some((n) => !nums.includes(n))) push('V-06', 'error', 'records.locations', `need exactly six locations numbered 1-6, found [${nums.join(',')}]`)

  // V-07 survivors
  const infl = new Map<number, string>()
  for (const s of raw.records.survivors) {
    const prev = infl.get(s.stats.influence)
    if (prev) push('V-07', 'error', s.id, `influence ${s.stats.influence} also on ${prev}`)
    infl.set(s.stats.influence, s.id)
  }
  if (raw.records.survivors.length !== 30) push('V-07', 'warn', 'records.survivors', `${raw.records.survivors.length} of 30 base survivors`)
  // V-08 survivor ability.location
  for (const s of raw.records.survivors) {
    const loc = 'unknown' in s.ability ? undefined : s.ability.location
    if (loc && !['anywhere', 'colony', 'nonColony'].includes(loc) && !has(loc, 'location')) push('V-08', 'error', s.id, `ability.location '${loc}' not found`)
  }

  // V-09 Crossroads
  for (const x of raw.records.crossroads) {
    const ids = x.options.map((o) => o.id)
    if (ids[0] === ids[1]) push('V-09', 'error', x.id, 'options need distinct ids')
    const textKeys = Object.keys(x.text.options)
    if (textKeys.length !== 2 || ids.some((i) => !textKeys.includes(i))) push('V-09', 'error', x.id, `text.options keys [${textKeys}] != option ids [${ids}]`)
    for (const o of x.options) if (o.vote) {
      const first = o.effect[0] as { op?: string } | undefined
      if (first?.op !== 'vote') push('V-09', 'error', `${x.id}.${o.id}`, 'vote:true needs the first effect to be op vote')
    }
    if (!x.trigger.point.startsWith('action.')) push('V-09', 'error', x.id, `trigger.point '${x.trigger.point}' is not an action.* window`)
    if (x.survivor) {
      const t = JSON.stringify(x.trigger.when)
      if (!(t.includes('"survivorIs"') || t.includes('"atLocation"'))) push('V-09', 'warn', x.id, 'survivor-named card whose trigger tests neither survivorIs nor atLocation')
    }
  }

  // V-10 effect trees, V-20 code names
  for (const { rec } of recs) {
    for (const { node, path } of deepObjects(rec)) {
      const where = `${rec.id}.${path}`
      if (typeof node.code === 'string' && node.code.includes('.') && Object.keys(node).every((k) => k === 'code' || k === 'params')) {
        if (!hookSet.has(node.code)) push('V-20', 'error', where, `code hook '${node.code}' is not registered`)
      }
      if (typeof node.op !== 'string') continue
      const op = node.op
      if ('duration' in node && !SELF_SCOPED_OPS.has(op)) push('V-10', 'error', where, `op ${op} must not carry a duration`)
      if (SELF_SCOPED_OPS.has(op) && !('duration' in node)) push('V-10', 'error', where, `op ${op} needs a duration`)
      const options = node.options as { id: string }[] | undefined
      if (op === 'choose' && (!options || options.length < 1)) push('V-10', 'error', where, 'choose needs at least one option')
      if (op === 'vote') {
        if (!options || options.length !== 2 || options[0].id !== 'yes' || options[1].id !== 'no') push('V-10', 'error', where, "vote needs exactly two options with ids 'yes' and 'no'")
      }
      if ('onRoll' in node && ['choose', 'vote', 'forbid', 'grant'].includes(op)) push('V-10', 'error', where, `onRoll is not allowed on ${op}`)
      if (op === 'killZombies' && node.value !== undefined && !['noExposure', 'exposureOnce'].includes(String(node.value))) push('V-10', 'error', where, `killZombies.value '${String(node.value)}'`)
      if (op === 'moveSurvivor' && node.value !== undefined && node.value !== 'noExposure') push('V-10', 'error', where, `moveSurvivor.value '${String(node.value)}'`)
      if (op === 'vote' && rec.kind === 'crossroads') { /* ok: options carry vote:true, checked in V-09 */ }
    }
  }
  for (const s of raw.records.survivors) if (!('unknown' in s.ability) && s.ability.kind === 'passive' && s.ability.countsAs) push('V-10', 'error', s.id, 'countsAs on a passive')
  for (const it of raw.records.items) for (const a of it.equipped ?? []) if (a.kind === 'passive' && a.countsAs) push('V-10', 'error', it.id, 'countsAs on a passive')
  for (const s of raw.records.survivors) {
    if ('unknown' in s.ability) continue
    if (s.ability.kind === 'triggered' && !s.ability.trigger) push('V-10', 'error', s.id, 'triggered ability without trigger')
  }

  // V-11 objective counters declared
  const counterRefs = (name: string, owner: string, declared: Set<string>, tree: unknown) => {
    for (const { node, path } of deepObjects(tree)) {
      if (node.op === 'objectiveCounter' && typeof node.value === 'string' && !declared.has(node.value)) push('V-11', 'error', `${owner}.${path}`, `counter '${node.value}' is not declared on ${name}`)
      if (node.test === 'objectiveCounterAtLeast') {
        const v = node.value
        const nm = typeof v === 'string' ? v : (v as { counter?: string } | undefined)?.counter
        if (nm && !declared.has(nm)) push('V-11', 'error', `${owner}.${path}`, `counter '${nm}' is not declared on ${name}`)
      }
    }
  }
  for (const m of raw.records.mainObjectives) for (const side of ['normal', 'hardcore'] as const) counterRefs(`${m.id}.${side}`, `${m.id}.sides.${side}`, new Set(Object.keys(m.sides[side].counters ?? {})), m.sides[side])
  for (const o of raw.records.secretObjectives) counterRefs(o.id, o.id, new Set(Object.keys(o.counters ?? {})), { complete: o.complete, triggers: o.triggers, setup: o.setup, betrayer: o.betrayer })

  // V-12 main objectives
  const codes = new Set<string>()
  for (const m of raw.records.mainObjectives) { if (codes.has(m.code)) push('V-12', 'error', m.id, `duplicate code ${m.code}`); codes.add(m.code) }
  // V-13 secret counts
  const cnt = (t: string) => raw.records.secretObjectives.filter((o) => o.type === t).length
  for (const [t, n] of [['secret', 24], ['betrayal', 10], ['exiled', 10]] as const) if (cnt(t) !== n) push('V-13', 'warn', 'records.secretObjectives', `${cnt(t)} of ${n} ${t} objectives`)

  // V-14 verified
  const MECH: Partial<Record<RecordKind, string[]>> = {
    survivor: ['stats.influence', 'stats.attack', 'stats.search', 'ability'], item: ['symbol', 'class'], deck: ['cards'], location: ['spaces.survivors', 'symbolOrder'],
    crisis: ['prevent', 'fail'], crossroads: ['trigger', 'options'], mainObjective: ['sides.normal', 'sides.hardcore'], secretObjective: ['complete'],
  }
  for (const { rec } of recs) {
    if (rec.status !== 'verified') continue
    for (const f of MECH[rec.kind] ?? []) {
      const cite = rec.sources[f] ?? rec.sources[f.split('.')[0]]
      if (!cite) push('V-14', 'error', rec.id, `verified record lacks a cite for ${f}`)
      else if (cite.includes('(verify)')) push('V-14', 'error', rec.id, `verified record has a (verify) cite on ${f}`)
    }
  }
  // V-15 unknown ability => placeholder (also schema)
  for (const s of raw.records.survivors) if ('unknown' in s.ability && s.status !== 'placeholder') push('V-15', 'error', s.id, 'unknown ability needs status placeholder')
  // V-16 sources paths exist
  for (const { rec } of recs) for (const p of Object.keys(rec.sources)) if (!hasPath(rec, p)) push('V-16', 'error', rec.id, `sources key '${p}' is not a field of the record`)
  // V-17 prose present
  for (const { rec } of recs) {
    if (rec.status === 'placeholder') continue
    if (rec.kind === 'item' && rec.class !== 'none' && !rec.text.ability) push('V-17', 'error', rec.id, 'item with an effect needs text.ability')
    if (rec.kind === 'secretObjective' && !rec.text.goal) push('V-17', 'error', rec.id, 'text.goal is empty')
  }
  // V-21 betrayal / exiled shape
  for (const o of raw.records.secretObjectives) {
    if (o.type === 'betrayal') {
      const all = (o.complete as { all?: unknown[] }).all
      if (!Array.isArray(all) || all.length < 2) push('V-21', 'error', o.id, 'betrayal complete must be an all-node with >= 2 children')
      if (!o.ai?.lever) push('V-10', 'warn', o.id, 'betrayal record without ai.lever')
    }
    if (o.type === 'exiled' && (!o.betrayer?.firstCondition || !o.text.betrayer)) push('V-21', 'error', o.id, 'exiled record needs betrayer.firstCondition and text.betrayer')
    if (o.type !== 'exiled' && (o.betrayer || o.text.betrayer)) push('V-21', 'error', o.id, 'betrayer fields only belong on exiled records')
  }
  return issues
}

// ---------- slices ----------
function referencedIds(rec: DataRecord): string[] {
  const ids: string[] = []
  if (rec.kind === 'survivor' && rec.crossroads) ids.push(rec.crossroads)
  if (rec.kind === 'crossroads' && rec.survivor) ids.push(rec.survivor)
  if (rec.kind === 'location' && rec.deck) ids.push(rec.deck)
  if (rec.kind === 'deck') for (const c of rec.cards) ids.push(c.item)
  for (const { node } of deepObjects(rec)) {
    if (typeof node.location === 'string' && /^loc\./.test(node.location)) ids.push(node.location)
    if (node.test === 'survivorIs' && typeof node.value === 'string') ids.push(node.value)
  }
  return ids
}
function buildSlices(raw: RawBundle, byId: Record<string, DataRecord>): Record<string, string[]> {
  const base = ['deck.starter', ...raw.records.locations.map((l) => l.id)].filter((id) => id in byId)
  const closure = (seed: string[]): string[] => {
    const seen = new Set<string>()
    const stack = [...seed, ...base]
    while (stack.length) {
      const id = stack.pop()!
      if (seen.has(id) || !(id in byId)) continue
      seen.add(id)
      stack.push(...referencedIds(byId[id]))
    }
    return [...seen].sort()
  }
  const slices: Record<string, string[]> = { all: Object.keys(byId).sort() }
  for (const [name, ids] of Object.entries(raw.slices ?? {})) slices[name] = closure(ids.filter((id) => id in byId))
  return slices
}

/** The ids a named slice loads (`all` = everything). Throws on an unknown slice name. */
export function sliceIds(bundle: DataBundle, name = 'all'): string[] {
  const ids = bundle.slices[name]
  if (!ids) throw new Error(`unknown data slice '${name}' (have: ${Object.keys(bundle.slices).join(', ')})`)
  return ids
}

// ---------- load ----------
/** Validate (schema + cross-record rules), drop placeholders, stamp the content hash, return the DataBundle. Throws DataValidationError. */
export function loadBundle(rawIn: unknown, opts: ValidateOptions = {}): DataBundle {
  const issues = validateBundle(rawIn, opts)
  if (issues.some((i) => i.severity === 'error')) throw new DataValidationError(issues)
  const raw = rawIn as RawBundle
  const keep = <T extends { status: string }>(xs: T[]) => xs.filter((x) => x.status !== 'placeholder')
  const records: RawBundle['records'] = {
    survivors: keep(raw.records.survivors), items: keep(raw.records.items), decks: keep(raw.records.decks), locations: keep(raw.records.locations),
    crises: keep(raw.records.crises), crossroads: keep(raw.records.crossroads), mainObjectives: keep(raw.records.mainObjectives),
    secretObjectives: keep(raw.records.secretObjectives), personas: keep(raw.records.personas),
  }
  const byId: Record<string, DataRecord> = {}
  for (const key of Object.keys(KIND_BY_KEY) as RecordsKey[]) for (const rec of records[key] as DataRecord[]) byId[rec.id] = rec
  const hash = hashBundle({ records: raw.records, slices: raw.slices })
  const version = `${raw.version}+${hash}`
  return { version, dataVersion: version, semver: raw.version, hash, byId, records, slices: buildSlices(raw, byId) }
}

/** Typed lookup helpers for the engine and the client. */
export function getRecord<K extends RecordKind>(bundle: DataBundle, id: string, kind: K): Extract<DataRecord, { kind: K }> {
  const rec = bundle.byId[id]
  if (!rec || rec.kind !== kind) throw new Error(`data: no ${kind} record '${id}'`)
  return rec as Extract<DataRecord, { kind: K }>
}
