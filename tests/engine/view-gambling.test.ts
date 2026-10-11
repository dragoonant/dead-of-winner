// VIEW-022: Gambling played through the engine. Each seat antes hand cards in turn; the suspended continuation records those answers,
// and no seat's view may carry another seat's ante (sim seed 22-45 leaked `c:24` through `context.data.cont` before the scrub).
import { beforeAll, describe, expect, it } from 'vitest'
import { createRandomDecider } from '../../src/ai/random'
import { afterAction } from '../../src/engine/effects'
import { createGame, hiddenIdsFor, legalActions, serializeView, step, view } from '../../src/engine/index'
import type { GameState } from '../../src/engine/types'
import { loadDefaultBundle } from '../../tools/default-bundle'
import { setupFor } from '../../tools/sim-core'

let base: GameState
beforeAll(async () => {
  const decider = createRandomDecider('view-gambling')
  let r = createGame(setupFor(4, 'obj.main.we-need-more-samples'), 'view-gambling', loadDefaultBundle())
  while (r.state.phase === 'setup') {
    const a = await decider.decide(view(r.state, r.pending.seat === 'all' ? 's1' : r.pending.seat), r.pending, legalActions(r.state))
    r = step(r.state, a)
  }
  base = r.state
})

/** Every seat's serialised view against that seat's hidden-id needles. */
function leaks(s: GameState): string[] {
  const out: string[] = []
  for (const seat of s.seatOrder) {
    const text = serializeView(view(s, seat))
    for (const n of hiddenIdsFor(s, seat)) if (text.includes(`"${n}"`)) out.push(`${seat} view contains ${n}`)
  }
  return out
}

describe('VIEW-022 Gambling antes', () => {
  it('VIEW-022 no seat sees another seat’s ante while later seats are still answering', () => {
    const me = base.activeSeat!
    const holder = base.seatOrder[(base.seatOrder.indexOf(me) + base.seatOrder.length - 1) % base.seatOrder.length]!
    // every seat has a survivor in the colony and a hand; the colony is clear; the previous seat holds Gambling for the active seat
    let s: GameState = {
      ...base,
      crossroads: { ...base.crossroads, deck: base.crossroads.deck.filter((c) => c !== 'xr.gambling'), held: { cardId: 'xr.gambling', holder, forSeat: me } },
      survivors: Object.fromEntries(Object.entries(base.survivors).map(([k, v]) => [k, base.seatOrder.some((q) => base.seats[q]!.survivors[0] === k) ? { ...v, location: 'colony', status: 'alive' as const } : v])),
      locations: { ...base.locations, colony: { ...base.locations['colony']!, entrances: base.locations['colony']!.entrances.map((e) => ({ ...e, zombies: 0, barricades: 0 })), helpless: 0 } },
    }
    for (const q of s.seatOrder) expect(s.seats[q]!.hand.length, `${q} has cards to ante`).toBeGreaterThan(0)

    const r = afterAction(s, 'action.search', { seat: me })
    // a lone vote option collapses straight to the ballot
    s = r.pending?.kind === 'crossroadsOption' ? step(r.state, r.pending.options!.find((o) => o.id === 'up')!.action).state : r.state
    expect(s.pending.kind).toBe('votes')

    const anted: { seat: string; card: string }[] = []
    for (let i = 0; i < 40 && s.phase !== 'ended' && s.pending.kind !== 'turnAction'; i++) {
      expect(leaks(s)).toEqual([])
      const pd = s.pending
      if (pd.kind === 'votes') {
        const data = pd.context.data as { eligible: string[]; tiebreakSeat?: string }
        const votes = Object.fromEntries([...data.eligible, ...(data.tiebreakSeat ? [data.tiebreakSeat] : [])].map((q) => [q, true]))
        s = step(s, { type: 'castVotes', decisionId: pd.id, seat: 'all', votes }).state
        continue
      }
      // ante one card (never pass) while the seat still has a slot; that card is now private to the seat that offered it
      const opt = pd.options!.find((o) => o.id !== 'pass') ?? pd.options![0]!
      if (pd.kind === 'effectChoice' && opt.id !== 'pass' && pd.seat !== 'all') anted.push({ seat: pd.seat, card: opt.id })
      const next = step(s, opt.action)
      expect(next.rejection).toBeUndefined()
      s = next.state
    }
    // at least two seats answered, so a later seat was asked while an earlier seat's ante sat in the continuation
    expect(new Set(anted.map((a) => a.seat)).size).toBeGreaterThanOrEqual(2)
  })
})
