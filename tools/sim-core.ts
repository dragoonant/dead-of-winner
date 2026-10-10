// Headless sim core (60 §3-§5): bots-only games on a data bundle through the public engine API, with the engine invariants,
// the hidden-information leak test, a decision cap, a stall detector, a mid-game save/load round trip and replay determinism.
// Pure functions over the engine; tools/sim.ts is the CLI. Nothing here reads a GameState the way a client would: the
// deciders get views, the checks read the state the reducer returned.
import { createDecider, PERSONA_IDS, type AiDecider } from '../src/ai/index'
import {
  createGame, hiddenIdsFor, legalActions, load, redactEvent, replay, save, serializeView, step, validate, view,
  type Action, type AiTier, type DataBundle, type GameEvent, type GameSetup, type GameState, type PendingDecision, type SeatId, type StepResult,
} from '../src/engine/index'

export interface SimOptions {
  games: number
  seed: string
  seats: number
  objective: string // a main objective id or 'random'
  cap: number // decisions per game before the game is failed
  stall: number // consecutive decisions without visible progress before the game is failed
  validateSample: number // legal actions re-validated per decision (0 = none)
  saveAt: number // the decision index at which the save/load round trip runs
  tier?: AiTier // the decider every seat uses (default random)
  onEvents?: (events: GameEvent[], state: GameState, game: number) => void // diagnostics: every step's events
  onFinal?: (s: GameState) => void // diagnostics: the final state of every game
}
export const DEFAULT_OPTIONS: SimOptions = { games: 30, seed: '1', seats: 4, objective: 'random', cap: 3000, stall: 200, validateSample: 12, saveAt: 40 }

export interface Violation { seed: string; index: number; decision: number; kind: string; message: string; detail?: string }
export interface GameSummary {
  seed: string
  index: number
  decisions: number
  steps: number
  rounds: number
  ended: boolean
  endReason: string | null
  objectiveComplete: boolean
  winners: SeatId[]
  betrayerPresent: boolean
  betrayerWon: boolean
  violations: Violation[]
  leaks: Violation[]
  moraleLost: Record<string, number> // morale points lost, by MoraleChanged reason
  tally: Record<string, number> // diagnostic counters: kill:<cause>, crisis:<prevented|failed>, objCards, ...
  decisionMs: number[] // wall time of every decider call
  exiles: { seat: SeatId; betrayer: boolean }[]
  finalMorale: number
  ms: number
}
export interface SimReport {
  games: number
  finished: number
  endedBy: Record<string, number>
  meanRounds: number
  meanDecisions: number
  botWins: number // seats that won, over every game
  gamesWithWinner: number
  betrayerPresent: number
  betrayerWon: number
  moraleLostBy: Record<string, number>
  tally: Record<string, number>
  violations: Violation[]
  leaks: Violation[]
  ms: number
}

// ---------- helpers ----------
const SEAT_IDS = ['s1', 's2', 's3', 's4', 's5']
export function setupFor(seats: number, objective: string): GameSetup {
  return {
    seats: SEAT_IDS.slice(0, seats).map((id) => ({ id, kind: 'bot' as const })),
    mainObjective: objective,
    variants: seats === 2 ? { twoPlayer: true } : {},
  }
}
export const stateHash = (s: GameState): string => JSON.stringify(s)
const hasBadNumber = (x: unknown, path = ''): string | null => {
  if (typeof x === 'number') return Number.isFinite(x) ? null : `${path} is ${String(x)}`
  if (Array.isArray(x)) { for (let i = 0; i < x.length; i++) { const r = hasBadNumber(x[i], `${path}[${i}]`); if (r) return r } return null }
  if (x && typeof x === 'object') { for (const [k, v] of Object.entries(x)) { const r = hasBadNumber(v, path ? `${path}.${k}` : k); if (r) return r } return null }
  return null
}

/** The counts that must stay fixed over a game (captured right after createGame). */
export interface Totals { cards: number; survivors: number; crises: number; crossroads: number }
const inPlacement = (s: GameState): boolean => {
  const p = s.pending
  const id = p?.context.survivorId
  return (p?.context.data as { code?: string } | undefined)?.code === 'exiledSurvivorPlacement' && !!id && !s.survivors[id]
}
export function totalsOf(s: GameState): Totals {
  return {
    cards: Object.keys(s.cards).length,
    survivors: s.survivorDeck.length + Object.keys(s.survivors).length + s.seatOrder.reduce((n, id) => n + s.seats[id]!.offered.length, 0)
      + (inPlacement(s) ? 1 : 0), // an exiled owner's replacement survivor waits in the placement decision (R10.5) until placed
    crises: s.crisisDeck.length + (s.crisis.cardId && !s.crisis.result ? 1 : 0) + s.crisis.history.length, // a resolved card is counted through the history until the next round flips a new one
    crossroads: s.crossroads.deck.length + (s.crossroads.held ? 1 : 0) + s.crossroads.log.filter((e) => e.triggered).length, // a triggered card is logged the moment it turns face up (active), then leaves the game
  }
}

// ---------- the invariants (60 §3) ----------
export function checkInvariants(s: GameState, pending: PendingDecision, totals: Totals): string[] {
  const out: string[] = []
  const bad = hasBadNumber(s)
  if (bad) out.push(`NaN/Infinity: ${bad}`)
  if (!pending) out.push('no pending decision')
  else {
    if (s.pending.id !== pending.id) out.push(`state.pending ${s.pending.id} != result.pending ${pending.id}`)
    if ((pending.kind === 'gameOver') !== (s.phase === 'ended')) out.push(`pending ${pending.kind} while phase is ${s.phase}`)
    if (pending.seat !== 'all') {
      const seat = s.seats[pending.seat]
      if (!seat) out.push(`pending.seat ${pending.seat} is not a seat`)
      else if (seat.seat.eliminated) out.push(`pending.seat ${pending.seat} is eliminated`)
    }
  }
  if (s.morale < 0 || s.morale > 10) out.push(`morale ${s.morale}`)
  if (s.food < 0) out.push(`food ${s.food}`)
  if (s.roundsLeft < 0) out.push(`roundsLeft ${s.roundsLeft}`)
  if (s.starvation < 0) out.push(`starvation ${s.starvation}`)
  // board counts
  const aliveAt: Record<string, number> = {}
  for (const sv of Object.values(s.survivors)) {
    if (sv.status !== 'alive') { if (sv.owner !== null) out.push(`${sv.id} is ${sv.status} but owned by ${sv.owner}`); if (sv.equipped.length) out.push(`${sv.id} is ${sv.status} with equipment`); continue }
    if (!sv.owner || !s.seats[sv.owner]) out.push(`${sv.id} alive without an owner`)
    else if (!s.seats[sv.owner]!.survivors.includes(sv.id)) out.push(`${sv.id} is not in ${sv.owner}'s list`)
    if (!s.locations[sv.location]) out.push(`${sv.id} at unknown location ${sv.location}`)
    aliveAt[sv.location] = (aliveAt[sv.location] ?? 0) + 1
  }
  for (const id of s.locationOrder) {
    const l = s.locations[id]!
    for (const e of l.entrances) {
      if (e.zombies < 0 || e.barricades < 0) out.push(`${id} entrance ${e.index} negative`)
      if (e.zombies + e.barricades > l.capacity.entranceSpaces) out.push(`${id} entrance ${e.index}: ${e.zombies} zombies + ${e.barricades} barricades > ${l.capacity.entranceSpaces}`)
    }
    if (l.noise < 0 || l.noise > l.capacity.noiseSpaces) out.push(`${id} noise ${l.noise}`)
    if (l.helpless < 0) out.push(`${id} helpless ${l.helpless}`)
    if ((aliveAt[id] ?? 0) + l.helpless > l.capacity.survivors) out.push(`${id}: ${(aliveAt[id] ?? 0)} survivors + ${l.helpless} helpless > ${l.capacity.survivors}`)
  }
  // seats: lists, leaders, dice
  for (const id of s.seatOrder) {
    const st = s.seats[id]!
    for (const sid of st.survivors) {
      const sv = s.survivors[sid]
      if (!sv || sv.status !== 'alive' || sv.owner !== id) out.push(`${id} lists ${sid} which is not its alive survivor`)
    }
    if (st.seat.eliminated) continue
    if (st.survivors.length > 0) {
      const waiting = pending && pending.seat === id && (pending.kind === 'newLeader' || pending.kind === 'effectChoice' || pending.kind === 'chooseLeader')
      // an ended game drops its in-flight decisions (R17.1): a leader slot emptied by a death in the ending step stays empty
      if (!st.leaderId) { if (!waiting && s.phase !== 'setup' && s.phase !== 'ended') out.push(`${id} has survivors but no leader`) }
      else if (!st.survivors.includes(st.leaderId)) out.push(`${id} leader ${st.leaderId} is not one of its survivors`)
    }
    for (const d of st.dice) if (d.value < 1 || d.value > 6) out.push(`${id} die ${d.id} shows ${d.value}`)
  }
  // zones: every card in exactly one
  const zones: [string, string[]][] = [['waste', s.waste], ['removed', s.removed], ['removedHidden', s.removedHidden], ['objective', s.objective.cards], ['crisis', s.crisis.contributions.map((c) => c.cardId)]]
  for (const id of s.seatOrder) zones.push([`hand:${id}`, s.seats[id]!.hand])
  for (const sv of Object.values(s.survivors)) if (sv.equipped.length) zones.push([`equipped:${sv.id}`, sv.equipped])
  for (const id of s.locationOrder) zones.push([`deck:${id}`, s.locations[id]!.deck])
  if (s.search) zones.push(['search', s.search.drawn])
  const seen = new Map<string, string>()
  let placed = 0
  for (const [zone, ids] of zones) for (const c of ids) {
    placed++
    if (!s.cards[c]) out.push(`${zone} holds unknown card ${c}`)
    const prev = seen.get(c)
    if (prev) out.push(`card ${c} in ${prev} and ${zone}`)
    seen.set(c, zone)
  }
  if (placed !== totals.cards || seen.size !== totals.cards) out.push(`cards in zones ${placed} (distinct ${seen.size}) != ${totals.cards} instances`)
  const t = totalsOf(s)
  if (t.survivors !== totals.survivors) out.push(`survivor cards ${t.survivors} != ${totals.survivors}`)
  if (t.crises !== totals.crises) out.push(`crisis cards ${t.crises} != ${totals.crises}`)
  if (t.crossroads !== totals.crossroads) out.push(`crossroads cards ${t.crossroads} != ${totals.crossroads}`)
  // effects never shorten (checked by name on the state alone: expiry in the past is dropped at the next boundary, so only non-negative rounds)
  for (const e of s.effects) if (e.expires && e.expires.roundNumber < s.roundNumber - 1) out.push(`effect ${e.name} expired at round ${e.expires.roundNumber} is still listed at round ${s.roundNumber}`)
  return out
}

/** The ids an event may carry although they are in `hiddenIdsFor`: public a moment earlier (VIEW-020). */
function allowedInEvent(ev: GameEvent, seat: SeatId): string[] {
  if (ev.type === 'EquippedReturned' && ev.to === 'hand') return ev.cardIds
  if (ev.type === 'CardStolen' && (ev.from === seat || ev.to === seat)) return [ev.cardId]
  if (ev.type === 'CardDiscarded' && ev.revealed === false && ev.seat === seat) return [ev.cardId] // its own hand leaving unrevealed (CONTRACT-015)
  if (ev.type === 'EffectApplied' && ev.ownerSeat === seat) return ev.targetIds // a peek (Annaleigh Chan, Talia Jones) shows its owner hidden ids by design; the view never does
  if (ev.type === 'AbilityUsed' && ev.cardId) return [ev.cardId] // an equipped item's use is table knowledge, even when its bearer dies in the same step and it returns to a hand
  return []
}

/** The leak test (B.4): every seat's serialised view, and every redacted event, against the needles for that seat. */
export function leakCheck(s: GameState, events: GameEvent[]): string[] {
  const out: string[] = []
  for (const seat of s.seatOrder) {
    const needles = hiddenIdsFor(s, seat)
    const v = view(s, seat)
    if ((s.phase === 'ended') !== (v.recap !== undefined)) out.push(`${seat}: recap present=${v.recap !== undefined} while phase is ${s.phase}`)
    const text = serializeView(v)
    for (const n of needles) if (text.includes(`"${n}"`)) out.push(`${seat} view contains ${n}`)
    for (const ev of events) {
      const red = redactEvent(ev, seat)
      if (!red) continue
      const allowed = allowedInEvent(ev, seat)
      const t = JSON.stringify(red)
      for (const n of needles) if (!allowed.includes(n) && t.includes(`"${n}"`)) out.push(`${seat} event ${ev.type} carries ${n}`)
    }
  }
  return out
}

const progressSignature = (s: GameState): string => {
  const zombies = s.locationOrder.reduce((n, l) => n + s.locations[l]!.entrances.reduce((a, e) => a + e.zombies, 0), 0)
  const wounds = Object.values(s.survivors).reduce((n, v) => n + v.wounds + v.frostbite, 0)
  const decks = s.locationOrder.map((l) => s.locations[l]!.deck.length).join(',')
  const dice = s.seatOrder.map((id) => s.seats[id]!.dice.filter((d) => !d.used).length).join(',')
  return [s.roundNumber, s.turnCount, s.morale, s.food, zombies, wounds, s.waste.length, decks, dice, s.crisis.contributions.length].join('|')
}

const holdsBetrayal = (s: GameState, seat: SeatId): boolean => (s.seats[seat]!.secretObjectiveId ?? '').startsWith('obj.betrayal.')

// ---------- one game ----------
export async function runGame(bundle: DataBundle, seed: string, index: number, o: SimOptions): Promise<GameSummary> {
  const t0 = Date.now()
  const violations: Violation[] = []
  const leaks: Violation[] = []
  let decision = 0
  const viol = (kind: string, message: string) => violations.push({ seed, index, decision, kind, message })
  const setup = setupFor(o.seats, o.objective)
  const tier = o.tier ?? 'random'
  const deciders: Record<SeatId, AiDecider> = {}
  setup.seats.forEach((seat, i) => { deciders[seat.id] = createDecider(tier, PERSONA_IDS[i % PERSONA_IDS.length], seed) })
  const decisionMs: number[] = []
  const exiles: { seat: SeatId; betrayer: boolean }[] = []
  let r: StepResult = createGame(setup, seed, bundle)
  const moraleLost: Record<string, number> = {}
  const tally: Record<string, number> = {}
  const bump = (k: string, n = 1) => { tally[k] = (tally[k] ?? 0) + n }
  if (r.rejection) {
    viol('createGame', `${r.rejection.code}: ${r.rejection.message}`)
    return { seed, index, decisions: 0, steps: 0, rounds: 0, ended: false, endReason: null, objectiveComplete: false, winners: [], betrayerPresent: false, betrayerWon: false, violations, leaks, moraleLost, tally, decisionMs: [], exiles: [], finalMorale: 0, ms: Date.now() - t0 }
  }
  const totals = totalsOf(r.state)
  const betrayerPresent = r.state.seatOrder.some((id) => holdsBetrayal(r.state, id))
  for (const m of checkInvariants(r.state, r.pending, totals)) viol('invariant', m)
  for (const m of leakCheck(r.state, r.events)) leaks.push({ seed, index, decision, kind: 'leak', message: m })
  let steps = 0
  let lastSig = progressSignature(r.state)
  let stalled = 0
  let saveChecked = false
  const recent: Action[] = []

  while (r.state.phase !== 'ended') {
    if (decision >= o.cap) { viol('cap', `decision cap ${o.cap} reached (round ${r.state.roundNumber}, pending ${r.pending.kind} for ${String(r.pending.seat)})`); break }
    const state = r.state
    const pending = r.pending
    const legal = legalActions(state)
    if (legal.length === 0) { viol('legalActions', `no legal action for ${pending.kind} (${pending.id}, seat ${String(pending.seat)})`); break }
    if (o.validateSample > 0) {
      const sample = legal.length <= o.validateSample ? legal : legal.filter((_, i) => i % Math.ceil(legal.length / o.validateSample) === 0)
      for (const a of sample) { const bad = validate(state, a); if (bad) viol('validate', `legal ${a.type} rejected: ${bad.code} ${bad.message}`) }
    }
    let action: Action
    const tD = performance.now()
    try {
      if (pending.seat === 'all' && pending.kind === 'votes') {
        // simultaneous votes: each eligible seat answers privately from its own view, then one ballot goes in (C.4)
        const eligible = ((pending.context.data as { eligible?: SeatId[] } | undefined)?.eligible ?? state.seatOrder) as SeatId[]
        const votes: Record<SeatId, boolean> = {}
        for (const s of eligible) { const pick = await deciders[s]!.decide(view(state, s), pending, legal); votes[s] = pick.type === 'castVotes' && pick.votes[s] === true }
        action = { type: 'castVotes', decisionId: pending.id, seat: 'all', votes }
      } else {
        const seatForView = pending.seat === 'all' ? state.seatOrder[0]! : pending.seat
        action = await deciders[seatForView]!.decide(view(state, seatForView), pending, legal)
      }
    } catch (e) { viol('decider', String((e as Error).message)); break }
    decisionMs.push(performance.now() - tD)
    let next: StepResult
    try { next = step(state, action) } catch (e) { viol('throw', `${action.type}: ${String((e as Error).stack ?? e)}`); break }
    steps++
    if (next.rejection) { viol('rejected', `legal ${action.type} rejected: ${next.rejection.code} ${next.rejection.message} ${JSON.stringify(next.rejection.detail ?? {})}`); break }
    decision++
    o.onEvents?.(next.events, next.state, index)
    if (action.type !== 'pass') bump(`act:${action.type}`)
    if (action.type === 'attack' && action.target.kind === 'survivor') bump('hunt')
    for (const ev of next.events) {
      if (ev.type === 'MoraleChanged' && ev.delta < 0) moraleLost[ev.reason] = (moraleLost[ev.reason] ?? 0) - ev.delta
      if (ev.type === 'SurvivorKilled') bump(`kill:${ev.cause}`)
      else if (ev.type === 'CrisisResolved') { bump(ev.prevented ? 'crisis:prevented' : 'crisis:failed'); bump('crisis:needed', ev.needed); bump('crisis:total', ev.total); bump('crisis:cards', ev.cards) }
      else if (ev.type === 'CardAddedToObjective') bump('objCards')
      else if (ev.type === 'ZombieKilled') { bump('zKill', ev.zombies); bump(`kills:${action.type}`, ev.zombies) }
      else if (ev.type === 'ExposureRolled') bump(`exp:${ev.reason}`)
      else if (ev.type === 'WoundHealed') bump('healed')
      else if (ev.type === 'SurvivorMoved' && ev.kind === 'action') bump('moves')
      else if (ev.type === 'Starvation') bump('starve')
      if (ev.type === 'SeatExiled') exiles.push({ seat: ev.seat, betrayer: holdsBetrayal(next.state, ev.seat) })
    }
    // every bot sees the events its seat is allowed to see, then keeps whatever memory it likes (suspicion ledger)
    for (const s of next.state.seatOrder) {
      const evs = next.events.map((e) => redactEvent(e, s)).filter((e): e is GameEvent => e !== null)
      if (evs.length) deciders[s]!.observe(evs, view(next.state, s))
    }
    recent.push(action); if (recent.length > 20) recent.shift()
    for (const m of checkInvariants(next.state, next.pending, totals)) {
      viol('invariant', m)
      violations[violations.length - 1]!.detail = `action ${JSON.stringify(action)}\n    events ${next.events.map((e) => (/^(Crossroads|Crisis|Card|Deck)/.test(e.type) ? JSON.stringify(e) : e.type)).join('\n      ')}\n    crossroads ${JSON.stringify({ deck: next.state.crossroads.deck.length, held: next.state.crossroads.held, active: next.state.crossroads.active, log: next.state.crossroads.log.slice(-3) })}\n    crisis ${JSON.stringify({ deck: next.state.crisisDeck.length, cardId: next.state.crisis.cardId, result: !!next.state.crisis.result, history: next.state.crisis.history.length })}`
    }
    for (const m of leakCheck(next.state, next.events)) leaks.push({ seed, index, decision, kind: 'leak', message: m })
    if (next.state.log.length !== state.log.length + 1) viol('log', `log grew by ${next.state.log.length - state.log.length}`)
    const sig = progressSignature(next.state)
    if (sig === lastSig) { if (++stalled >= o.stall) { viol('stall', `${o.stall} decisions without progress; last actions: ${recent.map((a) => a.type).join(' ')}`); r = next; break } }
    else { stalled = 0; lastSig = sig }
    if (!saveChecked && decision >= o.saveAt) {
      saveChecked = true
      const file = save(next.state, 'sim')
      const back = load(file, bundle)
      if (back.rejection) viol('load', `${back.rejection.code}: ${back.rejection.message}`)
      else if (stateHash(back.state) !== stateHash(next.state) || back.pending.id !== next.pending.id) viol('load', 'save/load round trip changed the state')
    }
    r = next
  }
  const ended = r.state.phase === 'ended'
  if (ended) {
    const again = replay(setup, seed, bundle, r.state.log)
    if (again.rejection) viol('replay', `${again.rejection.code}: ${again.rejection.message}`)
    else if (stateHash(again.state) !== stateHash(r.state)) viol('replay', 'replay reproduced a different final state')
    const ack = step(r.state, { type: 'ack', decisionId: r.pending.id, seat: r.state.seatOrder[0]! })
    if (ack.rejection) viol('ack', `${ack.rejection.code}`)
  }
  o.onFinal?.(r.state)
  const winners = r.state.result?.winners ?? []
  for (const id of r.state.seatOrder) if (holdsBetrayal(r.state, id)) { const k = r.state.seats[id]!.secretObjectiveId!.replace('obj.betrayal.', ''); bump(`bet:${k}`); if (winners.includes(id)) bump(`bet:${k}:won`) }
  return {
    seed, index, decisions: decision, steps, rounds: r.state.roundNumber, ended, endReason: r.state.result?.reason ?? null,
    objectiveComplete: r.state.objective.complete, winners, betrayerPresent,
    betrayerWon: winners.some((id) => holdsBetrayal(r.state, id)), violations, leaks, moraleLost, tally, decisionMs, exiles, finalMorale: r.state.morale, ms: Date.now() - t0,
  }
}

// ---------- many games ----------
export async function runSim(bundle: DataBundle, o: SimOptions, onGame?: (g: GameSummary) => void): Promise<SimReport> {
  const t0 = Date.now()
  const games: GameSummary[] = []
  for (let i = 0; i < o.games; i++) {
    const g = await runGame(bundle, `${o.seed}-${i}`, i, o)
    games.push(g)
    onGame?.(g)
  }
  return summarize(games, Date.now() - t0)
}

export function summarize(games: GameSummary[], ms: number): SimReport {
  const endedBy: Record<string, number> = {}
  for (const g of games) { const k = g.endReason ?? 'unfinished'; endedBy[k] = (endedBy[k] ?? 0) + 1 }
  const finished = games.filter((g) => g.ended)
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
  const moraleLostBy: Record<string, number> = {}
  for (const g of games) for (const [k, v] of Object.entries(g.moraleLost)) moraleLostBy[k] = (moraleLostBy[k] ?? 0) + v
  const tally: Record<string, number> = {}
  for (const g of games) for (const [k, v] of Object.entries(g.tally)) tally[k] = (tally[k] ?? 0) + v
  return {
    games: games.length, finished: finished.length, endedBy,
    meanRounds: Math.round(mean(finished.map((g) => g.rounds)) * 100) / 100,
    meanDecisions: Math.round(mean(games.map((g) => g.decisions))),
    botWins: games.reduce((n, g) => n + g.winners.length, 0),
    gamesWithWinner: games.filter((g) => g.winners.length > 0).length,
    betrayerPresent: games.filter((g) => g.betrayerPresent).length,
    betrayerWon: games.filter((g) => g.betrayerWon).length,
    moraleLostBy, tally,
    violations: games.flatMap((g) => g.violations),
    leaks: games.flatMap((g) => g.leaks),
    ms,
  }
}
