// npm run bench:ai -- --games 40 --seed 1 --tier random|easy|normal|hard [--seats 4] [--objective samples|random|<id>]  (default samples, the spec 40 §13 reference objective) [--json]
// Bots-only games on the default bundle (personas in sheet order: Vera, Teddy, Ruth, Jojo) with every seat on the same tier, through the same loop as `npm run sim` (invariants, leak
// test, save/load and replay checks included). Prints the 40 §13 metrics that the slim AI reports: objective rate, rounds, endings,
// betrayer presence and win rate, exiles (correct / innocent), decision time, rejected actions and stalls.
import type { AiTier } from '../src/engine/index'
import { loadDefaultBundle } from './default-bundle'
import { DEFAULT_OPTIONS, runGame, type GameSummary, type SimOptions } from './sim-core'

interface BenchArgs extends SimOptions { json: boolean }
const OBJECTIVES: Record<string, string> = { samples: 'obj.main.we-need-more-samples', random: 'random' }

function parse(argv: string[]): BenchArgs {
  const o: BenchArgs = { ...DEFAULT_OPTIONS, games: 40, seed: '1', tier: 'normal', objective: OBJECTIVES['samples']!, json: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    const next = () => argv[++i] ?? ''
    if (a === '--games') o.games = Math.max(1, Number(next()) || 40)
    else if (a === '--seed') o.seed = next()
    else if (a === '--tier') o.tier = (next() as AiTier) || 'normal'
    else if (a === '--seats') o.seats = Math.min(5, Math.max(2, Number(next()) || 4))
    else if (a === '--objective') { const v = next(); o.objective = OBJECTIVES[v] ?? v }
    else if (a === '--json') o.json = true
    else if (a.startsWith('--')) console.error(`bench: unknown option ${a}`)
  }
  return o
}

const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const pct = (n: number, d: number): string => (d ? `${Math.round((100 * n) / d)}% (${n}/${d})` : 'n/a')
const r1 = (x: number): number => Math.round(x * 10) / 10
const r2 = (x: number): number => Math.round(x * 100) / 100

export interface BenchReport {
  tier: string; games: number; seats: number; objective: string; seed: string
  objectiveRate: number; meanRounds: number; endedBy: Record<string, number>; meanFinalMorale: number
  betrayerPresent: number; betrayerWon: number; loyalWonWhenBetrayer: number
  exiles: number; exilesCorrect: number; exilesInnocent: number
  meanDecisionMs: number; p95DecisionMs: number; maxDecisionMs: number
  rejected: number; stalls: number; otherViolations: number; leaks: number; unfinished: number
}

export function summarizeBench(o: SimOptions, games: GameSummary[]): BenchReport {
  const endedBy: Record<string, number> = {}
  for (const g of games) { const k = g.endReason ?? 'unfinished'; endedBy[k] = (endedBy[k] ?? 0) + 1 }
  const ms = games.flatMap((g) => g.decisionMs).sort((a, b) => a - b)
  const viol = games.flatMap((g) => g.violations)
  const exiles = games.flatMap((g) => g.exiles)
  const withBetrayer = games.filter((g) => g.betrayerPresent)
  return {
    tier: o.tier ?? 'random', games: games.length, seats: o.seats, objective: o.objective, seed: o.seed,
    objectiveRate: games.filter((g) => g.objectiveComplete).length / games.length,
    meanRounds: r2(mean(games.filter((g) => g.ended).map((g) => g.rounds))),
    endedBy, meanFinalMorale: r2(mean(games.map((g) => g.finalMorale))),
    betrayerPresent: withBetrayer.length, betrayerWon: withBetrayer.filter((g) => g.betrayerWon).length,
    loyalWonWhenBetrayer: withBetrayer.filter((g) => g.winners.length > 0 && !g.betrayerWon).length,
    exiles: exiles.length, exilesCorrect: exiles.filter((e) => e.betrayer).length, exilesInnocent: exiles.filter((e) => !e.betrayer).length,
    meanDecisionMs: r2(mean(ms)), p95DecisionMs: r2(ms[Math.floor(ms.length * 0.95)] ?? 0), maxDecisionMs: r2(ms[ms.length - 1] ?? 0),
    rejected: viol.filter((x) => x.kind === 'rejected').length,
    stalls: viol.filter((x) => x.kind === 'stall' || x.kind === 'cap').length,
    otherViolations: viol.filter((x) => !['rejected', 'stall', 'cap'].includes(x.kind)).length,
    leaks: games.reduce((n, g) => n + g.leaks.length, 0),
    unfinished: games.filter((g) => !g.ended).length,
  }
}

async function main(): Promise<void> {
  const o = parseArgs()
  const bundle = loadDefaultBundle()
  const games: GameSummary[] = []
  for (let i = 0; i < o.games; i++) games.push(await runGame(bundle, `${o.seed}-${i}`, i, o))
  const r = summarizeBench(o, games)
  if (o.json) { console.log(JSON.stringify(r, null, 2)); return }
  const lost: Record<string, number> = {}
  const tally: Record<string, number> = {}
  for (const g of games) { for (const [k, v] of Object.entries(g.moraleLost)) lost[k] = (lost[k] ?? 0) + v; for (const [k, v] of Object.entries(g.tally)) tally[k] = (tally[k] ?? 0) + v }
  const rows: [string, string][] = [
    ['tier / games / seats', `${r.tier} / ${r.games} / ${r.seats} (seed ${r.seed}, objective ${r.objective})`],
    ['colony objective completed', pct(games.filter((g) => g.objectiveComplete).length, r.games)],
    ['mean rounds (games ended)', String(r.meanRounds)],
    ['ended by', Object.entries(r.endedBy).map(([k, v]) => `${k} ${v}`).join(', ')],
    ['mean final morale', String(r.meanFinalMorale)],
    ['morale lost by (per game)', Object.entries(lost).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${r2(v / r.games)}`).join(', ')],
    ['tally (per game)', Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${r2(v / r.games)}`).join(', ')],
    ['betrayer present / betrayer won', `${r.betrayerPresent} games / ${pct(r.betrayerWon, r.betrayerPresent)}`],
    ['exiles (correct / innocent)', `${r.exiles} (${r.exilesCorrect} / ${r.exilesInnocent})`],
    ['decision ms mean / p95 / max', `${r.meanDecisionMs} / ${r.p95DecisionMs} / ${r.maxDecisionMs}`],
    ['rejected actions / stalls', `${r.rejected} / ${r.stalls}`],
    ['other violations / leaks / unfinished', `${r.otherViolations} / ${r.leaks} / ${r.unfinished}`],
  ]
  const w = Math.max(...rows.map(([k]) => k.length))
  for (const [k, val] of rows) console.log(`${k.padEnd(w)}  ${val}`)
  process.exit(r.rejected || r.stalls || r.otherViolations || r.leaks || r.unfinished ? 1 : 0)
}

function parseArgs(): BenchArgs { return parse(process.argv.slice(2)) }
void main()
