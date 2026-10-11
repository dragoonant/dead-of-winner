// GameRunner (50 §1, §4): the true engine state and THE ONLY CALLER OF engine.step in the client.
// Every answer (human click, bot, test hook) goes through dispatch(); events are numbered, kept in a ring buffer and handed to the
// presentation director as one batch per step. Components read the presented store for what is on screen and this store for the
// open decision.
import { create } from 'zustand'
import {
  EngineInvariantError, createGame, legalActions, load as engineLoad, save as engineSave, step, validate,
  type Action, type DataBundle, type GameEvent, type GameSetup, type GameState, type PendingDecision, type Rejection, type SaveFile, type SeatId,
} from '../../engine/index'
import { loadClientBundle } from '../dataLoad'
import { setClientBundle, mainObjectives } from '../data'
import { buildSetup, resolveObjective, type LaunchRequest } from '../launch'
import { enqueueBatch, resetPresentation } from '../presentation/director'
import type { SeqEvent } from '../presentation/beats'
import { getStorage, readJson, writeJson } from './storage'
import { ui } from './uiStore'

export const EVENT_LOG_LIMIT = 2000
import { AUTOSAVE_KEY } from './savePeek'
export { AUTOSAVE_KEY }

export interface ClientRejection { code: Rejection['code'] | 'E_CLIENT'; text: string; action: Action | null; at: number; id: number }
export type DispatchSource = 'human' | 'bot' | 'test' | 'watchdog'

export interface GameStoreState {
  /** True engine state (NOT what the screen shows: render from the presented store). */
  state: GameState | null
  pending: PendingDecision | null
  /** The seat the human plays (the first human seat; the first seat when nobody is human, a spectator). */
  viewer: SeatId
  events: SeqEvent[]
  eventSeq: number
  lastRejection: ClientRejection | null
  /** Set when the engine threw (an engine bug); the game stops accepting answers until a new game or load. */
  fatal: string | null
  version: number
  /** Bot ballots collected privately for the open vote (the human's is added when they answer). */
  botVotes: Record<SeatId, boolean>
  /** The human's answer to the open vote, held until the bots' ballots are in: a yes/no from an eligible voter, or the tie-break answer of an exiled first player. */
  humanBallot: { id: string; yes: boolean } | null
  /** Decision ids the 5 s watchdog force-answered. */
  watchdog: string[]
  seed: string
}

const INITIAL: GameStoreState = {
  state: null, pending: null, viewer: 's1', events: [], eventSeq: 0, lastRejection: null, fatal: null, version: 0, botVotes: {}, humanBallot: null, watchdog: [], seed: '',
}
export const useGameStore = create<GameStoreState>(() => ({ ...INITIAL }))

// ---------- helpers ----------
export function viewerOf(state: GameState): SeatId {
  return state.seatOrder.find((s) => state.seats[s]?.seat.kind === 'human') ?? state.seatOrder[0]!
}
export const isBotSeat = (state: GameState, seat: SeatId): boolean => state.seats[seat]?.seat.kind === 'bot'

const legalCache = new WeakMap<GameState, Action[]>()
/** Legal answers to the state's open decision (cached per state object; the engine validates every one). */
export function legalFor(state: GameState | null): Action[] {
  if (!state) return []
  const hit = legalCache.get(state)
  if (hit) return hit
  let out: Action[] = []
  try { out = legalActions(state) } catch { out = [] }
  legalCache.set(state, out)
  return out
}

/** The engine's own check of an action (read-only); null = it would be accepted. */
export function validateAction(action: Action): Rejection | null {
  const s = useGameStore.getState().state
  if (!s) return { code: 'E_BAD_PAYLOAD', message: 'no game' }
  try { return validate(s, action) } catch { return { code: 'E_BAD_PAYLOAD', message: 'could not check that move' } }
}

let rejectionSeq = 0
function reject(code: ClientRejection['code'], text: string, action: Action | null): ClientRejection {
  const r: ClientRejection = { code, text, action, at: Date.now(), id: ++rejectionSeq }
  useGameStore.setState({ lastRejection: r })
  return r
}
export function clearRejection(): void { if (useGameStore.getState().lastRejection) useGameStore.setState({ lastRejection: null }) }

/** True when the open decision is the human's to answer (a vote needs the human to be an eligible voter). */
export function isHumanDecision(s: GameStoreState = useGameStore.getState()): boolean {
  const pd = s.pending
  const st = s.state
  if (!pd || !st || pd.kind === 'gameOver') return false
  if (pd.seat === 'all') {
    if (s.humanBallot?.id === pd.id) return false // already answered; the table is waiting for the bots' ballots
    return (voteEligible(pd).includes(s.viewer) || tiebreakSeatOf(pd) === s.viewer) && st.seats[s.viewer]?.seat.kind === 'human'
  }
  return st.seats[pd.seat]?.seat.kind === 'human'
}
/** True when the human is the exiled first player who answers a vote tie through the ballot's extra `tiebreakSeat` key (and does not vote otherwise). */
export function isHumanTieBreaker(s: GameStoreState = useGameStore.getState()): boolean {
  const pd = s.pending
  return !!pd && pd.kind === 'votes' && tiebreakSeatOf(pd) === s.viewer && !voteEligible(pd).includes(s.viewer)
}
export function tiebreakSeatOf(pd: PendingDecision): SeatId | null {
  return ((pd.context.data as { tiebreakSeat?: SeatId } | undefined)?.tiebreakSeat ?? null) as SeatId | null
}
export function isBotDecision(s: GameStoreState = useGameStore.getState()): boolean {
  const pd = s.pending
  const st = s.state
  if (!pd || !st || pd.kind === 'gameOver') return false
  if (pd.seat === 'all') return ballotSeats(pd).some((x) => isBotSeat(st, x) && s.botVotes[x] === undefined) || voteEligible(pd).every((x) => isBotSeat(st, x))
  return isBotSeat(st, pd.seat)
}
export function voteEligible(pd: PendingDecision): SeatId[] {
  return ((pd.context.data as { eligible?: SeatId[] } | undefined)?.eligible ?? []) as SeatId[]
}
/** Every seat that gives a ballot answer: the eligible voters, then the exiled first player's tie-break key when there is one. */
export function ballotSeats(pd: PendingDecision): SeatId[] {
  const tie = tiebreakSeatOf(pd)
  const el = voteEligible(pd)
  return tie && !el.includes(tie) ? [...el, tie] : el
}

function pushEvents(events: readonly GameEvent[]): { seqEvents: SeqEvent[]; first: number; last: number } {
  const s = useGameStore.getState()
  let seq = s.eventSeq
  const seqEvents = events.map((event) => ({ seq: ++seq, event }))
  return { seqEvents, first: s.eventSeq + 1, last: seq }
}

function commitStep(before: GameState, after: GameState, events: readonly GameEvent[], extra: Partial<GameStoreState> = {}): void {
  const { seqEvents, first, last } = pushEvents(events)
  const s = useGameStore.getState()
  const samePending = before.pending.id === after.pending.id
  useGameStore.setState({
    ...extra,
    state: after,
    pending: after.pending,
    events: seqEvents.length ? [...s.events, ...seqEvents].slice(-EVENT_LOG_LIMIT) : s.events,
    eventSeq: last,
    version: s.version + 1,
    ...(samePending ? {} : { botVotes: {}, humanBallot: null }),
  })
  enqueueBatch({ firstSeq: first, lastSeq: last, before, after, events: seqEvents, viewer: useGameStore.getState().viewer })
}

function startFrom(state: GameState, events: readonly GameEvent[], animate: boolean): void {
  const viewer = viewerOf(state)
  useGameStore.setState({ ...INITIAL, viewer, seed: state.seed, version: useGameStore.getState().version + 1 })
  ui.reset()
  if (animate) {
    resetPresentation(state, 0)
    commitStep(state, state, events)
  } else {
    const { seqEvents, last } = pushEvents(events)
    useGameStore.setState({ state, pending: state.pending, events: seqEvents.slice(-EVENT_LOG_LIMIT), eventSeq: last })
    resetPresentation(state, last)
  }
}

// ---------- public actions ----------
/** Start a new game from a launch request. Resolves to an error message (the old game stays) or null. */
export async function startGame(req: LaunchRequest): Promise<string | null> {
  let bundle: DataBundle
  try { bundle = (await loadClientBundle()) as unknown as DataBundle } catch (e) { return `The game data could not be loaded: ${(e as Error).message}` }
  setClientBundle(bundle as never)
  const objective = resolveObjective(req.objective, mainObjectives(bundle as never))
  if (!objective) return `Unknown main objective "${req.objective}".`
  return startWithSetup(buildSetup(req, objective), req.seed, bundle)
}

export function startWithSetup(setup: GameSetup, seed: string, bundle: DataBundle): string | null {
  let r
  try { r = createGame(setup, seed, bundle) } catch (e) { return (e as Error).message }
  if (r.rejection) return r.rejection.message
  startFrom(r.state, r.events, true)
  return null
}

/** Answer the open decision. `source` 'human' is refused when the decision belongs to a bot. Returns null when accepted. */
export function dispatch(action: Action, source: DispatchSource = 'human'): ClientRejection | null {
  const s = useGameStore.getState()
  if (!s.state) return reject('E_CLIENT', 'Start a game first.', action)
  if (s.fatal) return reject('E_CLIENT', 'The game hit an internal error; load a save or start again.', action)
  if (source === 'human' && !isHumanDecision(s)) return reject('E_NOT_YOUR_DECISION', 'It is not your decision to make.', action)
  let r
  try {
    r = step(s.state, action)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (e instanceof EngineInvariantError) useGameStore.setState({ fatal: msg })
    return reject('E_CLIENT', `The game hit an internal error: ${msg}`, action)
  }
  if (r.rejection) return reject(r.rejection.code, r.rejection.message, action)
  if (r.state === s.state && !r.events.length) return null
  commitStep(s.state, r.state, r.events, s.lastRejection ? { lastRejection: null } : {})
  if (source === 'watchdog') useGameStore.setState((x) => ({ watchdog: [...x.watchdog, s.state!.pending.id] }))
  return null
}

/** True when every bot that must vote on the open ballot has answered. */
function botBallotsIn(s: GameStoreState): boolean {
  const pd = s.pending
  const st = s.state
  if (!pd || !st) return false
  return ballotSeats(pd).every((x) => !isBotSeat(st, x) || s.botVotes[x] !== undefined)
}

/** Record one bot's private ballot for the open vote. When the human has already answered and still has to be sent with them, the ballot goes in now. */
export function setBotVote(decisionId: string, seat: SeatId, yes: boolean): void {
  const s = useGameStore.getState()
  if (s.pending?.id !== decisionId) return
  useGameStore.setState({ botVotes: { ...s.botVotes, [seat]: yes } })
  const now = useGameStore.getState()
  // a human voter's ballot waits for the bots; the bot driver sends the ballot itself when only bots vote (the human then only answers a tie)
  if (now.humanBallot?.id === decisionId && voteEligible(now.pending!).includes(now.viewer) && botBallotsIn(now)) {
    const a = ballotAction()
    if (a) dispatch(a, 'bot')
  }
}

/** Combine the collected ballots (and the human's, when they vote or break a tie) into the single castVotes action. Null while the human's answer is still missing. */
export function ballotAction(human?: boolean): Action | null {
  const s = useGameStore.getState()
  const pd = s.pending
  if (!pd || pd.kind !== 'votes' || !s.state) return null
  const mine = human ?? (s.humanBallot?.id === pd.id ? s.humanBallot.yes : undefined)
  const votes: Record<SeatId, boolean> = {}
  for (const seat of voteEligible(pd)) {
    const v = isBotSeat(s.state, seat) ? s.botVotes[seat] : seat === s.viewer ? mine : undefined
    votes[seat] = v ?? false
  }
  const tie = tiebreakSeatOf(pd)
  if (tie) {
    // the exiled first player's answer, used only when the vote is tied; a human who has not answered yet holds the ballot back
    if (tie === s.viewer && s.state.seats[tie]?.seat.kind === 'human') {
      if (mine === undefined) return null
      votes[tie] = mine
    } else votes[tie] = s.botVotes[tie] ?? false // a bot first player's answer is asked of its decider by the bot driver (setBotVote), like any ballot
  }
  return { type: 'castVotes', decisionId: pd.id, seat: 'all', votes }
}

/** The human answers the open vote (a yes or no from an eligible voter, or the tie-break answer of an exiled first player). The ballot is sent once every bot has answered. */
export function submitHumanVote(yes: boolean): ClientRejection | null {
  const s = useGameStore.getState()
  const pd = s.pending
  if (!pd || pd.kind !== 'votes') return null
  if (!isHumanDecision(s)) return reject('E_NOT_YOUR_DECISION', 'It is not your decision to make.', null)
  if (botBallotsIn(s)) {
    const a = ballotAction(yes)
    return a ? dispatch(a, 'human') : null
  }
  useGameStore.setState({ humanBallot: { id: pd.id, yes } })
  return null
}

// ---------- save / load ----------
export interface ClientSave { kind: 'dow-save'; v: 1; file: SaveFile; round: number; label: string }
export interface SaveSummary { savedAt: string; label: string; round: number; actions: number; seats: number }

export function exportSave(label = ''): ClientSave | null {
  const st = useGameStore.getState().state
  if (!st) return null
  return { kind: 'dow-save', v: 1, file: engineSave(st, label), round: st.roundNumber, label }
}
export function saveGame(label = 'Autosave'): boolean {
  const data = exportSave(label)
  if (!data) return false
  writeJson(AUTOSAVE_KEY, data)
  return true
}
const isClientSave = (x: unknown): x is ClientSave => !!x && typeof x === 'object' && (x as ClientSave).kind === 'dow-save' && !!(x as ClientSave).file
export function autosaveSummary(): SaveSummary | null {
  const d = readJson<ClientSave>(AUTOSAVE_KEY)
  if (!d || !isClientSave(d)) return null
  return { savedAt: d.file.meta.savedAt, label: d.label, round: d.round, actions: d.file.actions.length, seats: d.file.setup.seats.length }
}
export function hasSave(): boolean { return autosaveSummary() !== null }
export function deleteSave(): void { getStorage().removeItem(AUTOSAVE_KEY) }

/** Load a ClientSave or a bare SaveFile (replays it; no animation). Resolves to an error message or null. */
export async function importSave(data: unknown): Promise<string | null> {
  const file = isClientSave(data) ? data.file : data && typeof data === 'object' && Array.isArray((data as SaveFile).actions) ? (data as SaveFile) : null
  if (!file) return 'That is not a save file.'
  let bundle: DataBundle
  try { bundle = (await loadClientBundle()) as unknown as DataBundle } catch (e) { return `The game data could not be loaded: ${(e as Error).message}` }
  setClientBundle(bundle as never)
  let r
  try { r = engineLoad(file, bundle) } catch (e) { return (e as Error).message }
  if (r.rejection) return r.rejection.message
  startFrom(r.state, [], false)
  return null
}
export function continueGame(): Promise<string | null> { return importSave(readJson<unknown>(AUTOSAVE_KEY)) }

/** Autosave at the start of every turn and phase change. Returns an unsubscribe. */
export function installAutosave(): () => void {
  let lastKey = ''
  return useGameStore.subscribe((s) => {
    const st = s.state
    if (!st) return
    const key = `${st.phase}:${st.turnCount}`
    if (key === lastKey) return
    lastKey = key
    if (st.phase === 'ended') deleteSave()
    else if (st.phase !== 'setup') saveGame()
  })
}

/** Tests: forget the current game entirely. */
export function resetGameStore(): void {
  useGameStore.setState({ ...INITIAL })
  resetPresentation(null, 0)
  ui.reset()
}
