// FROZEN after M0: the hidden-information contract (00 §4). Implemented in M0 because the leak test (B.4) runs on it.
// view(state, seatId) is the ONLY thing a decider (human prompt or bot) ever receives. It hides:
//   other seats' hands (count only), other seats' secret and exiled objectives, the survivors offered to another seat
//   at setup, every face-down crisis contribution (count per seat only; own cards listed), the Crossroads card held
//   by the seat to the right of the active player (unless the viewer holds it), untriggered Crossroads in the log,
//   the cards another seat drew while searching, deck orders (counts only), cards removed unrevealed (count only),
//   other seats' secret-objective effects, the card ids and options inside another seat's pending decision, and the action log.
// At game end the view carries `recap`, which reveals everything (C.4).
import type { GameEvent } from './events'
import type {
  CardId, CardInstance, ColonyStep, Contribution, CrisisHistoryEntry, CrisisResult, CrossroadsLogEntry, CrossroadsState, DecisionContext, Die,
  EffectInstance, GameResult, GameSetup, GameState, Id, LocationId, LocationState, ObjectiveState, PendingDecision, Phase, RequestContext, Seat,
  SeatId, SearchContext, SurvivorId, SurvivorState, TurnContext, VoteState, AttackContext, BiteChain, ExileContext,
} from './types'

// ---------- view shapes ----------
export interface SeatPublicView {
  seat: Seat
  handCount: number
  hasSecretObjective: boolean
  hasExiledObjective: boolean
  dice: Die[]
  survivors: SurvivorId[]
  leaderId: SurvivorId | null
  contributionCount: number // face-down cards this seat put into the crisis
  abilityUses: Record<string, number>
  outcome?: 'won' | 'lost'
}
export interface SeatPrivateView {
  hand: CardId[]
  secretObjectiveId: Id | null
  exiledObjectiveId: Id | null
  offered: SurvivorId[]
  contributions: CardId[] // the viewer's own face-down cards
  crossroadsHeld: Id | null // the card the viewer holds for the active seat
  searchDrawn: CardId[] // cards the viewer has drawn in the open search
}
export interface LocationView extends Omit<LocationState, 'deck'> { deckCount: number }
/** A revealed crisis card: who contributed it stays null until the recap (the contributions were shuffled face down). */
export interface CrisisResultView extends Omit<CrisisResult, 'revealed'> { revealed: { cardId: CardId; points: 1 | -1; seat: SeatId | null }[] }
export interface CrisisView {
  cardId: Id | null
  contributionCount: number
  contributionsBySeat: Record<SeatId, number>
  result: CrisisResultView | null
  history: { roundNumber: number; cardId: Id; result: CrisisResultView }[] // every resolved crisis; contributor seats null until the recap
}
export interface CrossroadsView {
  deckCount: number
  held: { holder: SeatId; forSeat: SeatId } | null
  active: CrossroadsState['active']
  log: (Omit<CrossroadsLogEntry, 'cardId'> & { cardId: Id | null })[] // null = untriggered and still secret
}
export interface SearchView extends Omit<SearchContext, 'drawn'> { drawnCount: number }
/** Everything, revealed at game end: how the human audits that the bots played fair (C.4). */
export interface GameRecap {
  secretObjectives: Record<SeatId, { secret: Id | null; exiled: Id | null; outcome?: 'won' | 'lost' }>
  contributions: { roundNumber: number; crisisId: Id; revealed: CrisisResult['revealed'] }[] // one entry per resolved crisis, from crisis.history
  crossroads: CrossroadsLogEntry[]
  hands: Record<SeatId, CardId[]>
  removedHidden: CardId[] // the cards that left the game unrevealed (F 2.3.1, R p14)
}
export interface SeatView {
  seat: SeatId
  dataVersion: string
  setup: GameSetup
  phase: Phase
  colonyStep: ColonyStep | null
  roundsLeft: number
  roundNumber: number
  turnCount: number
  turn: TurnContext | null
  seatOrder: SeatId[]
  firstSeat: SeatId
  activeSeat: SeatId | null
  seats: Record<SeatId, SeatPublicView>
  me: SeatPrivateView
  survivors: Record<SurvivorId, SurvivorState>
  survivorDeckCount: number
  locations: Record<LocationId, LocationView>
  locationOrder: LocationId[]
  cards: Record<CardId, CardInstance> // only cards in zones the viewer may see
  waste: CardId[]
  removed: CardId[]
  removedHiddenCount: number // cards that left the game unrevealed; their ids appear only in the recap
  cardUses: GameState['cardUses'] // public: uses of equipped items are table knowledge
  morale: number
  food: number
  starvation: number
  crisisDeckCount: number
  crisis: CrisisView
  crossroads: CrossroadsView
  exiledObjectiveDeckCount: number
  objective: ObjectiveState
  effects: EffectInstance[] // public effects plus the viewer's own secret/exiled-objective effects; other seats' are dropped (count in `hiddenEffectCount`)
  hiddenEffectCount: number
  attack: AttackContext | null
  search: SearchView | null
  request: RequestContext | null
  bite: BiteChain | null
  vote: VoteState | null
  exile: ExileContext | null
  pending: PendingDecision // another seat's decision arrives as a public stub (`redacted: true`, no card ids, no options)
  result: GameResult | null
  recap?: GameRecap // present iff phase === 'ended'
}

// ---------- the projection ----------
/** The seat to the right of `seat` in clockwise order (the one that draws its Crossroads card, E.4). */
export function seatToRight(seatOrder: readonly SeatId[], seat: SeatId): SeatId {
  const i = seatOrder.indexOf(seat)
  return seatOrder[(i - 1 + seatOrder.length) % seatOrder.length] ?? seat
}

function contributionsBySeat(contributions: readonly Contribution[], seatOrder: readonly SeatId[]): Record<SeatId, number> {
  const out: Record<SeatId, number> = {}
  for (const s of seatOrder) out[s] = 0
  for (const c of contributions) out[c.seat] = (out[c.seat] ?? 0) + 1
  return out
}

/** An effect whose data (secret-objective counters) belongs to one seat and is hidden from the others. */
export function isPrivateEffect(e: EffectInstance): boolean {
  return (e.sourceKind === 'secretObjective' || e.sourceKind === 'exiledObjective') && e.ownerSeat !== undefined
}

/** The public stub of another seat's decision: what it is and who answers, never the card ids or the enumerated options. */
export function redactPending(pd: PendingDecision): PendingDecision {
  const c = pd.context
  const context: DecisionContext = {}
  if (c.survivorId !== undefined) context.survivorId = c.survivorId
  if (c.targetId !== undefined) context.targetId = c.targetId
  if (c.seatId !== undefined) context.seatId = c.seatId
  if (c.location !== undefined) context.location = c.location
  if (c.symbol !== undefined) context.symbol = c.symbol
  if (c.need !== undefined) context.need = c.need
  if (c.data?.code !== undefined) context.data = { code: c.data.code }
  return { id: pd.id, seat: pd.seat, kind: pd.kind, window: pd.window, context, canPass: pd.canPass, redacted: true }
}

/**
 * The suspended-effect continuation (`context.data.cont`) records the answers given so far, in every seat's turn (Gambling antes: each
 * seat's offered hand cards). The addressee needs the nodes (the vote model reads them) but never the engine's recorded answers, which
 * can name another seat's hidden cards (VIEW-021).
 */
function scrubCont(pd: PendingDecision): PendingDecision {
  const data = pd.context.data as { cont?: { jobs?: unknown[] } } | undefined
  if (!data?.cont?.jobs) return pd
  const jobs = data.cont.jobs.map((j) => {
    const job = j as { t?: string; work?: { answers?: string[] }[]; answers?: string[] }
    if (job.t === 'run' && Array.isArray(job.work)) return { ...job, work: job.work.map((w) => ({ ...w, answers: [] })) }
    if (job.t === 'fire') return { ...job, answers: [] }
    return job
  })
  return { ...pd, context: { ...pd.context, data: { ...data, cont: { ...data.cont, jobs } } } } as PendingDecision
}

export function recap(state: GameState): GameRecap {
  const secretObjectives: GameRecap['secretObjectives'] = {}
  const hands: GameRecap['hands'] = {}
  for (const id of state.seatOrder) {
    const s = state.seats[id]!
    secretObjectives[id] = { secret: s.secretObjectiveId, exiled: s.exiledObjectiveId, outcome: s.outcome }
    hands[id] = [...s.hand]
  }
  const contributions: GameRecap['contributions'] = state.crisis.history.map((h) => ({ roundNumber: h.roundNumber, crisisId: h.cardId, revealed: h.result.revealed }))
  return { secretObjectives, contributions, crossroads: [...state.crossroads.log], hands, removedHidden: [...state.removedHidden] }
}

export function view(state: GameState, seatId: SeatId): SeatView {
  const ended = state.phase === 'ended'
  const me = state.seats[seatId]
  if (!me) throw new Error(`view: unknown seat ${seatId}`)
  const projectResult = (r: CrisisResult): CrisisResultView => ({ ...r, revealed: r.revealed.map((x) => ({ cardId: x.cardId, points: x.points, seat: ended || x.seat === seatId ? x.seat : null })) })
  const projectHistory = (h: CrisisHistoryEntry) => ({ roundNumber: h.roundNumber, cardId: h.cardId, result: projectResult(h.result) })
  const seats: Record<SeatId, SeatPublicView> = {}
  const bySeat = contributionsBySeat(state.crisis.contributions, state.seatOrder)
  for (const id of state.seatOrder) {
    const s = state.seats[id]!
    seats[id] = {
      seat: s.seat, handCount: s.hand.length, hasSecretObjective: s.secretObjectiveId !== null, hasExiledObjective: s.exiledObjectiveId !== null,
      dice: s.dice, survivors: s.survivors, leaderId: s.leaderId, contributionCount: bySeat[id] ?? 0, abilityUses: s.abilityUses,
      ...(s.outcome ? { outcome: s.outcome } : {}),
    }
  }
  const locations: Record<LocationId, LocationView> = {}
  for (const id of state.locationOrder) {
    const { deck, ...rest } = state.locations[id]!
    locations[id] = { ...rest, deckCount: deck.length }
  }
  // visible card instances: own hand, every equipped card, waste, removed, objective cards, own contributions, own search draws
  const visible = new Set<CardId>(me.hand)
  for (const sv of Object.values(state.survivors)) for (const c of sv.equipped) visible.add(c)
  for (const c of state.waste) visible.add(c)
  for (const c of state.removed) visible.add(c)
  for (const c of state.objective.cards) visible.add(c)
  for (const c of state.crisis.contributions) if (c.seat === seatId || ended) visible.add(c.cardId)
  if (state.crisis.result) for (const r of state.crisis.result.revealed) visible.add(r.cardId)
  for (const h of state.crisis.history) for (const r of h.result.revealed) visible.add(r.cardId)
  if (state.search && (state.search.seat === seatId || ended)) for (const c of state.search.drawn) visible.add(c)
  if (ended) {
    for (const s of state.seatOrder) for (const c of state.seats[s]!.hand) visible.add(c)
    for (const c of state.removedHidden) visible.add(c)
  }
  const cards: Record<CardId, CardInstance> = {}
  for (const c of visible) { const inst = state.cards[c]; if (inst) cards[c] = inst }
  // item uses are keyed by card instance: only the instances the viewer may see (an item back in another hand after its bearer died would name itself)
  const cardUses: GameState['cardUses'] = {}
  for (const [c, uses] of Object.entries(state.cardUses)) if (visible.has(c)) cardUses[c] = uses
  // effects: public ones plus the viewer's own private (secret/exiled objective) ones
  const effects = ended ? state.effects : state.effects.filter((e) => !isPrivateEffect(e) || e.ownerSeat === seatId)
  // the pending decision: full for its addressee (or 'all'); a public stub for everyone else
  const pending = ended ? state.pending : state.pending.seat === 'all' || state.pending.seat === seatId ? scrubCont(state.pending) : redactPending(state.pending)

  const held = state.crossroads.held
  const crossroads: CrossroadsView = {
    deckCount: state.crossroads.deck.length,
    held: held ? { holder: held.holder, forSeat: held.forSeat } : null,
    active: state.crossroads.active,
    log: state.crossroads.log.map((e) => ({ ...e, cardId: e.triggered || ended ? e.cardId : null })),
  }
  const search: SearchView | null = state.search ? (({ drawn, ...rest }) => ({ ...rest, drawnCount: drawn.length }))(state.search) : null
  // a `votes` decision is simultaneous: the view carries it unchanged (its options are the same for every seat)
  const out: SeatView = {
    seat: seatId, dataVersion: state.dataVersion, setup: state.setup, phase: state.phase, colonyStep: state.colonyStep,
    roundsLeft: state.roundsLeft, roundNumber: state.roundNumber, turnCount: state.turnCount, turn: state.turn,
    seatOrder: state.seatOrder, firstSeat: state.firstSeat, activeSeat: state.activeSeat, seats,
    me: {
      hand: me.hand, secretObjectiveId: me.secretObjectiveId, exiledObjectiveId: me.exiledObjectiveId, offered: me.offered,
      contributions: state.crisis.contributions.filter((c) => c.seat === seatId).map((c) => c.cardId),
      crossroadsHeld: held && held.holder === seatId ? held.cardId : null,
      searchDrawn: state.search && state.search.seat === seatId ? state.search.drawn : [],
    },
    survivors: state.survivors, survivorDeckCount: state.survivorDeck.length, locations, locationOrder: state.locationOrder, cards,
    waste: state.waste, removed: state.removed, removedHiddenCount: state.removedHidden.length, cardUses,
    morale: state.morale, food: state.food, starvation: state.starvation,
    crisisDeckCount: state.crisisDeck.length,
    crisis: {
      cardId: state.crisis.cardId, contributionCount: state.crisis.contributions.length, contributionsBySeat: bySeat,
      result: state.crisis.result ? projectResult(state.crisis.result) : null,
      history: state.crisis.history.map(projectHistory),
    },
    crossroads, exiledObjectiveDeckCount: state.exiledObjectiveDeck.length, objective: state.objective,
    effects, hiddenEffectCount: state.effects.length - effects.length,
    attack: state.attack, search, request: state.request, bite: state.bite, vote: state.vote, exile: state.exile,
    pending, result: state.result,
  }
  if (ended) out.recap = recap(state)
  return out
}

// ---------- event redaction (what a seat's feed may show; the engine's events stay complete) ----------
const PRIVATE_AUTO_KINDS: ReadonlySet<string> = new Set(['searchKeepWhich', 'searchKeepOrNoise', 'effectChoice', 'itemTarget', 'requestResponse', 'chooseSurvivors'])
/** null = the seat must not see the event at all; otherwise the event with hidden fields blanked. */
export function redactEvent(ev: GameEvent, seatId: SeatId): GameEvent | null {
  switch (ev.type) {
    case 'SurvivorsDealt': return ev.seat === seatId ? ev : { ...ev, survivorIds: [] }
    case 'StartingItemsDealt': return ev.seat === seatId ? ev : { ...ev, cardIds: [] }
    case 'SecretObjectiveDealt': return ev.seat === seatId ? ev : null
    case 'CardStolen': return ev.from === seatId || ev.to === seatId ? ev : { ...ev, cardId: '' }
    case 'SearchDrawn': return ev.seat === seatId ? ev : null
    case 'SearchKept': return ev.seat === seatId ? ev : { ...ev, cardId: '' }
    case 'CardDrawn': return ev.seat === seatId ? ev : { ...ev, cardId: '' }
    case 'CardContributed': return ev.seat === seatId ? ev : { ...ev, cardId: '' }
    case 'CardDiscarded': return ev.revealed === false && ev.seat !== seatId ? { ...ev, cardId: '' } : ev
    case 'EffectApplied': return ev.ownerSeat === undefined || ev.ownerSeat === seatId ? ev : null
    case 'EffectExpired': return ev.ownerSeat === undefined || ev.ownerSeat === seatId ? ev : null
    case 'CrossroadsDrawn': return ev.holder === seatId ? ev : { ...ev, cardId: '' }
    case 'CrossroadsReturned': return ev.holder === seatId ? ev : { ...ev, cardId: '' }
    case 'SeatExiled': return ev.seat === seatId ? ev : { ...ev, objectiveId: '' }
    case 'ObjectiveProgress': return ev.seat === null || ev.seat === seatId ? ev : null
    case 'ObjectiveComplete': return ev.seat === null || ev.seat === seatId ? ev : null
    case 'ActionRejected': return ev.action.seat === seatId || ev.action.seat === 'all' ? ev : null
    // VIEW-018: an auto-kept card or a one-option private choice names a card another seat must not see; `newLeader` and the rest stay
    case 'DecisionAutoResolved': return ev.seat !== seatId && PRIVATE_AUTO_KINDS.has(ev.kind) ? { ...ev, optionId: '' } : ev
    default: return ev
  }
}

/** Serialised view text for the leak test (B.4): the sim asserts none of the other seats' hidden ids occur in it. */
export function serializeView(v: SeatView): string { return JSON.stringify(v) }

/** The ids a seat's view must never contain (the leak test's needle list). */
export function hiddenIdsFor(state: GameState, seatId: SeatId): string[] {
  if (state.phase === 'ended') return []
  const ids: string[] = []
  for (const id of state.seatOrder) {
    if (id === seatId) continue
    const s = state.seats[id]!
    ids.push(...s.hand)
    if (s.secretObjectiveId) ids.push(s.secretObjectiveId)
    if (s.exiledObjectiveId) ids.push(s.exiledObjectiveId)
    ids.push(...s.offered)
  }
  for (const c of state.crisis.contributions) if (c.seat !== seatId) ids.push(c.cardId)
  if (state.crossroads.held && state.crossroads.held.holder !== seatId) ids.push(state.crossroads.held.cardId)
  if (state.search && state.search.seat !== seatId) ids.push(...state.search.drawn)
  ids.push(...state.removedHidden)
  for (const e of state.effects) if (isPrivateEffect(e) && e.ownerSeat !== seatId) ids.push(e.id, e.sourceId)
  // another seat's decision: the card ids it carries (drawn cards, offered survivors, the responder's matching hand cards)
  const pd = state.pending
  const privateKinds: readonly string[] = ['searchKeepOrNoise', 'searchKeepWhich', 'requestResponse', 'chooseSurvivors']
  if (pd.seat !== 'all' && pd.seat !== seatId && privateKinds.includes(pd.kind)) {
    if (pd.context.cardIds) ids.push(...pd.context.cardIds)
    if (pd.context.cardId) ids.push(pd.context.cardId)
    for (const o of pd.options ?? []) {
      const a = o.action as unknown as Record<string, unknown>
      if (typeof a['cardId'] === 'string') ids.push(a['cardId'] as string)
      if (typeof a['give'] === 'string') ids.push(a['give'] as string)
      if (Array.isArray(a['keep'])) ids.push(...(a['keep'] as string[]))
    }
  }
  // a card the whole table saw (a revealed crisis contribution) keeps its identity even when a Crossroads card later moves it into a hand (Fuel Tanker, Edward White)
  const known = new Set(state.crisis.history.flatMap((h) => h.result.revealed.map((r) => r.cardId)))
  return known.size ? ids.filter((i) => !known.has(i)) : ids
}
