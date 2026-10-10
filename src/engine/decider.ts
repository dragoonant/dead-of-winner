// FROZEN after M0: one interface for the human, the AI colonists, the random bot and replay (00 §13).
// A decider only ever receives its seat's view, never the state (C.4).
import type { Action } from './actions'
import type { PendingDecision, SeatId } from './types'
import type { SeatView } from './view'
import { deriveSeed, nextFloat } from './rng'

export interface Decider {
  decide(view: SeatView, pending: PendingDecision, legal: Action[]): Promise<Action>
}
export type DeciderKind = 'human' | 'ai' | 'random' | 'replay'

/** Random bot: uniform over legalActions, seeded by (seed, seat, decisionId) so runs reproduce. */
export function createRandomDecider(seed: string, seat: SeatId): Decider {
  return {
    async decide(_view, pending, legal) {
      if (legal.length === 0) throw new Error(`random decider: no legal actions for ${pending.id} (seat ${seat})`)
      const [f] = nextFloat(deriveSeed(seed, seat, pending.id))
      return legal[Math.floor(f * legal.length)]!
    },
  }
}

/** Replay: answers from a recorded log in order; throws on a mismatched decision id. */
export function createReplayDecider(actions: readonly Action[]): Decider {
  let i = 0
  return {
    async decide(_view, pending) {
      const next = actions[i++]
      if (!next) throw new Error(`replay decider: log exhausted at ${pending.id}`)
      if (next.decisionId !== pending.id) throw new Error(`replay decider: expected ${pending.id}, log has ${next.decisionId}`)
      return next
    },
  }
}
