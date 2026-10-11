// npm run check:copied [-- --sheet <path>]: no 8 consecutive words of our Crossroads prose (vignettes first, then the trigger and
// option text) may appear in the BGG sheet transcription. docs/sources is gitignored, so this is a local gate: without the sheet it
// prints a notice and exits 0. Words are compared lower-cased with punctuation stripped.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const SHEET = path.join(ROOT, 'docs/sources/bgg/Crossroad_cards_v1.1.xlsx.txt')
export const N = 8

const words = (s: string): string[] => s.toLowerCase().replace(/[^a-z0-9']+/g, ' ').trim().split(' ').filter(Boolean)

export function shingles(text: string, n = N): Set<string> {
  const w = words(text)
  const out = new Set<string>()
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' '))
  return out
}

export interface Hit { card: string; field: string; run: string }
/** Every run of `n` words of `prose` (a map field -> text per card) that the source also contains. */
export function copiedRuns(source: string, cards: { id: string; prose: Record<string, string> }[], n = N): Hit[] {
  const src = shingles(source, n)
  const hits: Hit[] = []
  for (const c of cards) for (const [field, text] of Object.entries(c.prose)) for (const s of shingles(text, n)) if (src.has(s)) hits.push({ card: c.id, field, run: s })
  return hits
}

export function loadCards(dir = path.join(ROOT, 'src/data/crossroads')): { id: string; prose: Record<string, string> }[] {
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => {
    const rec = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as { id: string; text: { vignette: string; trigger?: string; options: Record<string, string> } }
    const prose: Record<string, string> = { vignette: rec.text.vignette }
    if (rec.text.trigger) prose['trigger'] = rec.text.trigger
    for (const [k, v] of Object.entries(rec.text.options)) prose[`option:${k}`] = v
    return { id: rec.id, prose }
  })
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--sheet')
  const sheet = i > 0 ? path.resolve(process.argv[i + 1]!) : SHEET
  if (!fs.existsSync(sheet)) {
    console.log(`check-copied-text: ${sheet} is not here (docs/sources is gitignored); nothing to check`)
    process.exit(0)
  }
  const cards = loadCards()
  const hits = copiedRuns(fs.readFileSync(sheet, 'utf8'), cards)
  for (const h of hits) console.log(`COPIED ${h.card} ${h.field}: "${h.run}"`)
  console.log(`check-copied-text: ${cards.length} cards, ${hits.length} run(s) of ${N}+ words shared with the sheet`)
  process.exit(hits.length ? 1 : 0)
}
