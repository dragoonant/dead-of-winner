// npm run sim -- --games N --seed S [--seats 4] [--objective samples|random|<id>] [--cap 3000] [--stall 200] [--json]
// Bots-only games on the default bundle (src/data) through the public engine API; see tools/sim-core.ts.
// Exit code 1 when any game failed to end or any invariant, leak, cap or stall fired.
import { loadDefaultBundle } from './default-bundle'
import type { AiTier } from '../src/engine/index'
import { DEFAULT_OPTIONS, runSim, type SimOptions } from './sim-core'

const OBJECTIVES: Record<string, string> = { samples: 'obj.main.we-need-more-samples', random: 'random' }

function parseArgs(argv: string[]): SimOptions & { json: boolean; seatsGiven: boolean; verbose: boolean } {
  const o: SimOptions & { json: boolean; seatsGiven: boolean; verbose: boolean } = { ...DEFAULT_OPTIONS, json: false, seatsGiven: false, verbose: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    const next = () => argv[++i] ?? ''
    switch (a) {
      case '--games': o.games = Math.max(1, Number(next()) || 1); break
      case '--seed': o.seed = next(); break
      case '--seats': o.seats = Math.min(5, Math.max(2, Number(next()) || 4)); o.seatsGiven = true; break
      case '--objective': { const v = next(); o.objective = OBJECTIVES[v] ?? v; break }
      case '--cap': o.cap = Number(next()) || o.cap; break
      case '--stall': o.stall = Number(next()) || o.stall; break
      case '--tier': o.tier = (next() as AiTier) || 'random'; break
      case '--validate': o.validateSample = Number(next()) || 0; break
      case '--json': o.json = true; break
      case '--verbose': o.verbose = true; break
      default: if (a.startsWith('--')) console.error(`sim: unknown option ${a}`)
    }
  }
  return o
}

async function main(): Promise<void> {
  const o = parseArgs(process.argv.slice(2))
  const bundle = loadDefaultBundle()
  // a table needs 4 offered survivors per seat (R3.7): without --seats, the largest table the bundle can deal, up to 4
  if (!o.seatsGiven) o.seats = Math.max(2, Math.min(4, Math.floor(bundle.records.survivors.length / 4)))
  const report = await runSim(bundle, o, (g) => {
    if (o.json) return
    const flags = [...g.violations.map((v) => v.kind), ...(g.leaks.length ? ['leak'] : [])]
    console.log(`game ${g.index} seed ${g.seed}: ${g.ended ? g.endReason : 'UNFINISHED'} after ${g.rounds} rounds, ${g.decisions} decisions, winners [${g.winners.join(' ')}]${g.betrayerPresent ? ' betrayer' : ''}${flags.length ? ` FLAGS ${flags.join(',')}` : ''} (${g.ms} ms)`)
  })
  if (o.json) { console.log(JSON.stringify(report, null, 2)); process.exit(report.violations.length || report.leaks.length || report.finished < report.games ? 1 : 0) }
  console.log('')
  console.log(`sim: ${report.games} games, ${report.finished} ended, seats ${o.seats}, seed ${o.seed}, objective ${o.objective}, ${report.ms} ms`)
  console.log(`  ended by: ${Object.entries(report.endedBy).map(([k, v]) => `${k} ${v}`).join(', ')}`)
  console.log(`  mean rounds ${report.meanRounds}, mean decisions ${report.meanDecisions}`)
  console.log(`  bot wins: ${report.botWins} winning seats in ${report.gamesWithWinner} games`)
  console.log(`  betrayer present in ${report.betrayerPresent} games, won ${report.betrayerWon}`)
  console.log(`  tally: ${Object.entries(report.tally).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`)
  console.log(`  morale lost by: ${Object.entries(report.moraleLostBy).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`)
  console.log(`  violations: ${report.violations.length}, leaks: ${report.leaks.length}`)
  const show = (list: { seed: string; index: number; decision: number; kind: string; message: string; detail?: string }[], label: string) => {
    const seen = new Set<string>()
    for (const v of list) {
      const key = `${v.seed}|${v.kind}|${v.message.slice(0, 80)}`
      if (seen.has(key)) continue
      seen.add(key)
      console.log(`  ${label} game ${v.index} seed ${v.seed} decision ${v.decision} [${v.kind}] ${v.message}`)
      if (o.verbose && v.detail) console.log(`    ${v.detail}`)
      if (seen.size >= 40) { console.log('  ...'); break }
    }
  }
  show(report.violations, 'VIOLATION')
  show(report.leaks, 'LEAK')
  process.exit(report.violations.length || report.leaks.length || report.finished < report.games ? 1 : 0)
}

void main()
