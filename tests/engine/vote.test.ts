import { describe, expect, it } from 'vitest'
import type { Action } from '../../src/engine/actions'
import { voteForecastFor } from '../../src/engine/actions/vote'
import { view } from '../../src/engine/index'
import { legalPlayerTurnsActions, stepPlayerTurns } from '../../src/engine/phases/player-turns'
import type { GameState, StepResult } from '../../src/engine/types'
import { addCard, makeState, setSeat, types } from './effect-fixture'

/** Four seats: s1 (Ashley + Spare One), s2 (Mike + Sparky), s3 (Forest), s4 (Spare Two); s1 holds the first-player token and the turn. */
function fourSeats(over: Partial<GameState> = {}): GameState {
  let s = makeState(over)
  s = {
    ...s,
    setup: { ...s.setup, seats: [...s.setup.seats, { id: 's4', kind: 'human' as const }] },
    seatOrder: ['s1', 's2', 's3', 's4'],
    survivors: { ...s.survivors, 'sv.spare2': { ...s.survivors['sv.spare']!, id: 'sv.spare2', owner: 's4' } },
    seats: { ...s.seats, s4: { ...s.seats['s3']!, seat: { id: 's4', kind: 'human', exiled: false, eliminated: false }, survivors: ['sv.spare2'], leaderId: 'sv.spare2' } },
    exiledObjectiveDeck: ['obj.exiled.a', 'obj.exiled.b'],
  }
  return s
}
const act = (s: GameState, body: Record<string, unknown>): Action => ({ decisionId: s.pending.id, seat: s.pending.seat as string, ...body }) as unknown as Action
const call = (s: GameState, target: string): StepResult => stepPlayerTurns(s, act(s, { type: 'callVote', target }))
const cast = (s: GameState, votes: Record<string, boolean>): StepResult => stepPlayerTurns(s, { type: 'castVotes', decisionId: s.pending.id, seat: 'all', votes })
const exile = (s: GameState, seat: string): GameState => setSeat(s, seat, { seat: { ...s.seats[seat]!.seat, exiled: true } })
const result = (r: StepResult) => r.events.find((e) => e.type === 'VoteResult') as { yes: number; no: number; exiled: boolean; tiebreakBy: string | null }

describe('callVote and castVotes', () => {
  it('VOTE-001 callVote raises one simultaneous `votes` decision for every eligible seat and spends the turn\'s vote', () => {
    const r = call(fourSeats(), 's3')
    expect(r.rejection).toBeUndefined()
    expect(r.events.find((e) => e.type === 'VoteCalled')).toEqual({ type: 'VoteCalled', caller: 's1', target: 's3' })
    expect(r.pending).toMatchObject({ kind: 'votes', seat: 'all' })
    expect((r.pending.context.data as { eligible: string[] }).eligible).toEqual(['s1', 's2', 's3', 's4'])
    expect(r.state.turn!.voteCalled).toBe(true)
    expect(r.state.vote).toMatchObject({ caller: 's1', target: 's3', votes: null })
  })

  it('VOTE-002 a second callVote in the same turn is E_VOTE_USED, a vote against yourself E_SELF_TARGET', () => {
    const s = fourSeats()
    expect(call(s, 's1').rejection?.code).toBe('E_SELF_TARGET')
    // the vote fails, the turn goes on, and the second call is refused
    const failed = cast(call(s, 's3').state, { s1: false, s2: false, s3: false, s4: false })
    expect(failed.pending).toMatchObject({ kind: 'turnAction', seat: 's1' })
    expect(call(failed.state, 's2').rejection?.code).toBe('E_VOTE_USED')
  })

  it('VOTE-003 a ballot needs exactly one yes/no per eligible seat, the target included', () => {
    const open = call(fourSeats(), 's3').state
    expect(cast(open, { s1: true, s2: true, s3: true }).rejection?.code).toBe('E_BAD_PAYLOAD') // s4 missing
    expect(cast(open, { s1: true, s2: true, s3: true, s4: true, s5: true }).rejection?.code).toBe('E_BAD_PAYLOAD') // s5 does not exist
    expect(cast(open, { s1: true, s2: true, s3: true, s4: 'yes' as unknown as boolean }).rejection?.code).toBe('E_BAD_PAYLOAD')
    const wrongSeat = stepPlayerTurns(open, { type: 'castVotes', decisionId: open.pending.id, seat: 's1' as unknown as 'all', votes: { s1: true, s2: true, s3: true, s4: true } })
    expect(wrongSeat.rejection?.code).toBe('E_NOT_YOUR_DECISION')
    expect(open.vote!.votes).toBeNull() // a rejected ballot changes nothing
  })

  it('VOTE-004 a 2-2 tie is decided by the first seat\'s vote: yes exiles', () => {
    const r = cast(call(fourSeats(), 's3').state, { s1: true, s2: true, s3: false, s4: false })
    expect(result(r)).toEqual({ type: 'VoteResult', target: 's3', yes: 2, no: 2, exiled: true, tiebreakBy: 's1' })
    expect(r.state.seats['s3']!.seat.exiled).toBe(true)
  })

  it('VOTE-005 the first seat voting no keeps the tie a failure; a clear majority has no tie-breaker', () => {
    const no = cast(call(fourSeats(), 's3').state, { s1: false, s2: true, s3: true, s4: false })
    expect(result(no)).toMatchObject({ yes: 2, no: 2, exiled: false, tiebreakBy: 's1' })
    expect(no.state.seats['s3']!.seat.exiled).toBe(false)
    expect(no.pending).toMatchObject({ kind: 'turnAction', seat: 's1' })
    const clear = cast(call(fourSeats(), 's3').state, { s1: true, s2: true, s3: false, s4: true })
    expect(result(clear)).toMatchObject({ yes: 3, no: 1, exiled: true, tiebreakBy: null })
  })

  it('VOTE-006 an exiled seat does not vote: 2 yes of 3 eligible exiles, 1 yes does not', () => {
    const s = exile(fourSeats(), 's4')
    const open = call(s, 's3').state
    expect((open.pending.context.data as { eligible: string[] }).eligible).toEqual(['s1', 's2', 's3'])
    expect(cast(open, { s1: true, s2: true, s3: false, s4: true }).rejection?.code).toBe('E_BAD_PAYLOAD') // the exiled seat's ballot
    expect(result(cast(open, { s1: true, s2: true, s3: false })).exiled).toBe(true)
    expect(result(cast(open, { s1: true, s2: false, s3: false })).exiled).toBe(false)
  })

  it('VOTE-007 a tie with the first seat unable to vote is broken by the next eligible seat clockwise (10 R16.4 over the checklist line)', () => {
    let s = exile(fourSeats(), 's1') // s1 holds the token but is exiled; it may still call the vote
    const open = call(s, 's3').state
    expect((open.pending.context.data as { eligible: string[] }).eligible).toEqual(['s2', 's3', 's4'])
    // 3 eligible seats cannot tie; drop one more voter by exiling s4 as well for a 2-voter table
    s = exile(exile(fourSeats(), 's1'), 's4')
    const two = call(s, 's3').state
    const r = cast(two, { s2: true, s3: false })
    expect(result(r)).toMatchObject({ yes: 1, no: 1, tiebreakBy: 's2', exiled: true })
  })

  it('VOTE-008 ballots stay secret until cast: no view carries them, VotesCast then shows everyone\'s answer', () => {
    const open = call(fourSeats(), 's3')
    expect(view(open.state, 's2').vote?.votes ?? null).toBeNull()
    const r = cast(open.state, { s1: true, s2: false, s3: false, s4: true })
    expect(r.events.find((e) => e.type === 'VotesCast')).toEqual({ type: 'VotesCast', target: 's3', votes: { s1: true, s2: false, s3: false, s4: true } })
    expect(r.state.vote).toBeNull()
  })

  it('VOTE-009 the forecast helper reports voters, the yes count that carries the vote and the tie-breaker', () => {
    expect(voteForecastFor(fourSeats(), 's3')).toEqual({ target: 's3', eligible: ['s1', 's2', 's3', 's4'], needed: 3, tiebreakBy: 's1' })
  })

  it('VOTE-001 legalActions offers a callVote per valid target and, on the vote, every ballot with the all-no one first', () => {
    const s = fourSeats()
    const calls = legalPlayerTurnsActions(s).filter((a) => a.type === 'callVote')
    expect(calls.map((a) => (a as { target: string }).target)).toEqual(['s2', 's3', 's4'])
    const open = call(s, 's2').state
    const ballots = legalPlayerTurnsActions(open)
    expect(ballots).toHaveLength(16)
    expect(ballots[0]).toMatchObject({ type: 'castVotes', votes: { s1: false, s2: false, s3: false, s4: false } })
    for (const b of ballots) expect(stepPlayerTurns(open, b).rejection).toBeUndefined()
  })

  it('XRD-010 a Crossroads vote option raises `votes` for the non-exiled seats and its result is applied through the same router', () => {
    let s = exile(fourSeats(), 's4')
    s = { ...s, crossroads: { deck: [], held: { cardId: 'xr.outbreak', holder: 's4', forSeat: 's1' }, active: null, log: [] } }
    s = setSeat(addCard(s, 'it.food-1', 'hand:s1').state, 's1', { dice: [{ id: 's1:d1', value: 3, used: false }] })
    const card = s.seats['s1']!.hand[0]!
    const played = stepPlayerTurns(s, act(s, { type: 'playCard', cardId: card }))
    expect(played.pending).toMatchObject({ kind: 'crossroadsOption', seat: 's1' })
    const voteOpt = stepPlayerTurns(played.state, played.pending.options!.find((o) => o.id === 'vote')!.action)
    expect(voteOpt.pending).toMatchObject({ kind: 'votes', seat: 'all' })
    expect((voteOpt.pending.context.data as { eligible: string[] }).eligible).toEqual(['s1', 's2', 's3'])
    const morale = voteOpt.state.morale
    const done = cast(voteOpt.state, { s1: true, s2: true, s3: false })
    expect(done.rejection).toBeUndefined()
    expect(done.state.morale).toBe(morale + 1) // the "yes" branch of the card's vote
    expect(types(done.events)).toContain('VotesCast')
    expect(done.pending).toMatchObject({ kind: 'turnAction', seat: 's1' })
  })
})
