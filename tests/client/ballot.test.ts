// An exiled BOT first player's tie-break ballot key is asked of that bot's decider like any other ballot (tools/sim-core.ts does the same).
import { beforeEach, describe, expect, it, vi } from 'vitest'

const asked: string[] = []
const stepped: unknown[] = []
vi.mock('../../src/engine/index', async (orig) => ({
  ...(await orig<typeof import('../../src/engine/index')>()),
  view: () => ({}),
  step: (_s: unknown, a: unknown) => { stepped.push(a); return { state: _s, events: [], rejection: { code: 'E_TEST', message: 'captured' } } },
}))
vi.mock('../../src/client/bot/deciders', () => ({
  getDecider: (seat: string) => ({ decide: async () => { asked.push(seat); return { type: 'castVotes', decisionId: 'd:9', seat: 'all', votes: { [seat]: true } } } }),
}))

import { createBotDriver } from '../../src/client/bot/botDriver'
import { ballotAction, ballotSeats, isBotDecision, useGameStore } from '../../src/client/store/gameStore'

const setStore = (data: object): void => {
  useGameStore.setState({
    state: { seats: { s1: { seat: { kind: 'human' } }, s2: { seat: { kind: 'bot' } }, s3: { seat: { kind: 'bot' } } } } as never,
    pending: { id: 'd:9', seat: 'all', kind: 'votes', window: 'action.callVote', context: { seatId: 's2', data }, canPass: false } as never,
    viewer: 's1', botVotes: {}, humanBallot: null, fatal: null,
  })
}

describe('a bot exiled first player breaks a tie through its decider', () => {
  beforeEach(() => { asked.length = 0; stepped.length = 0 })
  it('the tie-break seat is a ballot seat and keeps the bot decision open until it answers', () => {
    setStore({ eligible: ['s1', 's3'], tiebreakSeat: 's2' })
    expect(ballotSeats(useGameStore.getState().pending!)).toEqual(['s1', 's3', 's2'])
    useGameStore.setState({ botVotes: { s3: false } })
    expect(isBotDecision()).toBe(true) // s2's tie-break answer is still missing
    useGameStore.setState({ botVotes: { s3: false, s2: true } })
    expect((ballotAction(false) as { votes: Record<string, boolean> }).votes).toEqual({ s1: false, s3: false, s2: true })
  })
  it('the bot driver asks the tie-break bot and sends its answer, not a default no', async () => {
    setStore({ eligible: ['s3'], tiebreakSeat: 's2' }) // every voter is a bot, so the driver sends the ballot
    await createBotDriver().answerNow()
    expect(asked.sort()).toEqual(['s2', 's3'])
    expect(useGameStore.getState().botVotes).toEqual({ s3: true, s2: true })
    expect(stepped).toHaveLength(1)
    expect((stepped[0] as { votes: Record<string, boolean> }).votes).toEqual({ s3: true, s2: true })
  })
})
