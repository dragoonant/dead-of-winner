// The recap story (50 §15): per seat, "what they were really doing". Built from what the engine reveals at game end (the recap block of the
// view: secret objectives, who put which card into which crisis, the Crossroads log) and, when the AI exposes it, the table's suspicion
// of each seat round by round. Pure: the caller hands in plain data, nothing here reads a store, a bundle or the engine.

export type Id = string
export interface PartReport { label: string; have: number; need: number }
export interface ObjectiveInfo { id: Id; name: string; kind: 'secret' | 'betrayal' | 'exiled'; complete: boolean | null; requiresMain: boolean; parts: PartReport[]; goal: string }
export interface ContributionInfo {
  roundNumber: number
  crisisId: Id
  crisisName: string
  /** The verdict the engine gave this crisis, when it is on record. */
  result: { total: number; needed: number; prevented: boolean; bonus: boolean } | null
  revealed: { seat: Id | null; points: 1 | -1; cardName: string }[]
}
export interface CrossroadsInfo { roundNumber: number; cardName: string; forSeat: Id; holder: Id; triggered: boolean; optionId: string | null; optionText: string }
/** What the AI may expose: for each observer seat, per round, how likely it thought each seat was the betrayer (0..1). */
export interface SuspicionPoint { round: number; scores: Record<Id, number> }
export type SuspicionTrajectory = Record<Id, SuspicionPoint[]>

export interface StoryInput {
  /** The seat the human plays: the other seats' progress labels say "their" where the engine's say "your". */
  viewer?: Id
  seatOrder: Id[]
  seatName(id: Id): string
  secret(seat: Id): { id: Id | null; exiledId: Id | null; outcome?: 'won' | 'lost' }
  objective(id: Id): ObjectiveInfo | null
  contributions: ContributionInfo[]
  crossroads: CrossroadsInfo[]
  exiledSeats: Id[]
  mainComplete: boolean
  suspicion?: SuspicionTrajectory | null
}

export interface CrisisLine { round: number; crisis: string; verdict: string; cards: { name: string; points: 1 | -1 }[] }
export interface SuspicionLine { round: number; average: number }
export interface SeatStory {
  seat: Id
  name: string
  outcome: 'won' | 'lost' | null
  objective: ObjectiveInfo | null
  exiledObjective: ObjectiveInfo | null
  betrayer: boolean
  exiled: boolean
  /** Plain sentences, in reading order. */
  lines: string[]
  crisis: CrisisLine[]
  helped: number
  hurt: number
  crossroads: { round: number; card: string; text: string }[]
  suspicion: SuspicionLine[]
}

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`

function verdictOf(c: ContributionInfo): string {
  const r = c.result
  if (!r) return 'resolved'
  return r.prevented ? (r.bonus ? 'prevented, with the bonus' : 'prevented') : 'not prevented'
}

/** The table's average suspicion of `seat` per round, from the AI's own trajectories (observers other than the seat itself). */
export function suspicionAbout(seat: Id, t: SuspicionTrajectory | null | undefined): SuspicionLine[] {
  if (!t) return []
  const byRound = new Map<number, number[]>()
  for (const [observer, points] of Object.entries(t)) {
    if (observer === seat) continue
    for (const p of points) {
      const v = p.scores[seat]
      if (typeof v === 'number' && Number.isFinite(v)) byRound.set(p.round, [...(byRound.get(p.round) ?? []), v])
    }
  }
  return [...byRound.entries()].sort((a, b) => a[0] - b[0]).map(([round, vs]) => ({ round, average: vs.reduce((a, b) => a + b, 0) / vs.length }))
}

/** Validates what an AI module returned for its suspicion log; anything off-shape is dropped (the recap then skips that section). */
export function parseSuspicion(raw: unknown): SuspicionTrajectory | null {
  if (!raw || typeof raw !== 'object') return null
  const out: SuspicionTrajectory = {}
  for (const [observer, points] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(points)) continue
    const good: SuspicionPoint[] = []
    for (const p of points as { round?: unknown; scores?: unknown }[]) {
      if (typeof p?.round !== 'number' || !p.scores || typeof p.scores !== 'object') continue
      const scores: Record<Id, number> = {}
      for (const [k, v] of Object.entries(p.scores as Record<string, unknown>)) if (typeof v === 'number' && Number.isFinite(v)) scores[k] = Math.max(0, Math.min(1, v))
      good.push({ round: p.round, scores })
    }
    if (good.length) out[observer] = good
  }
  return Object.keys(out).length ? out : null
}

export function buildStory(input: StoryInput): SeatStory[] {
  return input.seatOrder.map((seat) => {
    const name = input.seatName(seat)
    const s = input.secret(seat)
    const objective = s.id ? input.objective(s.id) : null
    const exiledObjective = s.exiledId ? input.objective(s.exiledId) : null
    const betrayer = objective?.kind === 'betrayal'
    const exiled = input.exiledSeats.includes(seat)
    const lines: string[] = []

    // the secret objective and whether it was met
    if (objective) {
      const met = s.outcome === 'won' || objective.complete === true
      const counts = objective.requiresMain && !input.mainComplete && objective.complete
      if (betrayer) lines.push(`${name} was the betrayer. Secret goal: ${objective.name}. ${met && s.outcome === 'won' ? 'The betrayal succeeded.' : 'The betrayal did not succeed.'}`)
      else lines.push(`${name} was secretly after ${objective.name}. ${s.outcome === 'won' ? 'The goal was met.' : objective.complete && counts ? 'The goal was reached but only counts with the main objective, which was not completed.' : objective.complete ? 'The goal was reached.' : 'The goal was not met.'}`)
      const owner = (label: string): string => (input.viewer === undefined || seat === input.viewer ? label : label.replace(/\byour\b/g, 'their'))
      const parts = objective.parts.filter((p) => p.need > 0)
      if (parts.length) lines.push(parts.map((p) => `${owner(p.label)}: ${p.have} of ${p.need}`).join('; ') + '.')
    } else lines.push(`${name} had no secret objective.`)
    if (exiled) lines.push(exiledObjective ? `${name} was exiled and played for their exile goal, ${exiledObjective.name}${exiledObjective.complete ? ' (met)' : ' (not met)'}.` : `${name} was exiled.`)

    // hidden crisis contributions, crisis by crisis
    const crisis: CrisisLine[] = []
    let helped = 0
    let hurt = 0
    for (const c of input.contributions) {
      const mine = c.revealed.filter((r) => r.seat === seat)
      if (!mine.length) continue
      for (const r of mine) { if (r.points > 0) helped++; else hurt++ }
      crisis.push({ round: c.roundNumber, crisis: c.crisisName, verdict: verdictOf(c), cards: mine.map((r) => ({ name: r.cardName, points: r.points })) })
    }
    if (crisis.length) lines.push(`Into the crises ${name} put ${plural(helped, 'helpful card')} and ${plural(hurt, 'harmful card')}.`)
    else lines.push(`${name} never put a card into a crisis.`)

    // notable Crossroads choices
    const crossroads = input.crossroads
      .filter((x) => x.triggered && x.forSeat === seat)
      .map((x) => ({ round: x.roundNumber, card: x.cardName, text: x.optionText }))

    const suspicion = suspicionAbout(seat, input.suspicion)
    if (suspicion.length) {
      const last = suspicion[suspicion.length - 1]!
      lines.push(`By round ${last.round} the table suspected ${name} at ${Math.round(last.average * 100)}%.`)
    }
    return { seat, name, outcome: s.outcome ?? null, objective, exiledObjective, betrayer, exiled, lines, crisis, helped, hurt, crossroads, suspicion }
  })
}
