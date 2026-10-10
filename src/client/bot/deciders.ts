// getDecider(seat, state): the ONE place the client chooses who answers for a bot seat. The tier and persona come from the seat's
// setup (Normal by default, Random selectable); the AI loads as its own chunk on first use. Hidden-information contract (00 §4):
// the decider is only ever handed that seat's own view, the pending decision and the legal list, plus the events that seat is
// allowed to see (view.ts redactEvent), which feed its suspicion ledger. It never receives GameState.
import { redactEvent, type Action, type AiTier, type Decider, type GameEvent, type GameState, type PendingDecision, type SeatId, type SeatView } from '../../engine/index'
import { useGameStore } from '../store/gameStore'

type AiDecider = Decider & { observe(events: readonly GameEvent[], view: SeatView): void }
interface Entry { decider: Promise<AiDecider>; lastSeq: number }

// One set of deciders per game: keyed by the game's setup object, which every state of one game shares (a new or loaded game has its own).
let games = new WeakMap<object, Map<SeatId, Entry>>()
export function resetDeciders(): void { games = new WeakMap() }

async function load(tier: AiTier | undefined, persona: string | undefined, seed: string): Promise<AiDecider> {
  const mod = await import('../../ai/index')
  return mod.createDecider(tier, persona, seed)
}

/** The decider for a bot seat, one per (game, seat). It remembers what it has seen, so the same instance answers every decision. */
export function getDecider(seat: SeatId, state: GameState): Decider {
  let seats = games.get(state.setup)
  if (!seats) { seats = new Map(); games.set(state.setup, seats) }
  let entry = seats.get(seat)
  if (!entry) {
    const setup = state.setup.seats.find((s) => s.id === seat)
    entry = { decider: load(setup?.tier, setup?.persona, `${state.seed}|${seat}`), lastSeq: 0 }
    seats.set(seat, entry)
  }
  const e = entry
  return {
    async decide(view: SeatView, pending: PendingDecision, legal: Action[]): Promise<Action> {
      const d = await e.decider
      const fresh = useGameStore.getState().events.filter((x) => x.seq > e.lastSeq)
      if (fresh.length) {
        e.lastSeq = fresh[fresh.length - 1]!.seq
        const seen = fresh.map((x) => redactEvent(x.event, seat)).filter((x): x is GameEvent => x !== null)
        if (seen.length) d.observe(seen, view)
      }
      return d.decide(view, pending, legal)
    },
  }
}
