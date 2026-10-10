// getDecider(seat): the ONE place the client chooses who answers for a bot seat (the AI pass swaps the body, nothing else).
// Today every bot is the sensible random bot from src/ai/random.ts, loaded as its own chunk on first use.
import type { Action, Decider, PendingDecision, SeatId, SeatView } from '../../engine/index'

const cache = new Map<string, Decider>()

async function loadRandom(seed: string): Promise<Decider> {
  const hit = cache.get(seed)
  if (hit) return hit
  const mod = await import('../../ai/random')
  const d = mod.createRandomDecider(seed)
  cache.set(seed, d)
  return d
}

/** The decider for a bot seat. It only ever receives that seat's own view (hidden-information contract, 00 §4). */
export function getDecider(_seat: SeatId, seed: string): Decider {
  return {
    async decide(view: SeatView, pending: PendingDecision, legal: Action[]): Promise<Action> {
      return (await loadRandom(seed)).decide(view, pending, legal)
    },
  }
}
