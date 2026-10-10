import { describe, expect, it } from 'vitest'
import { createGame, legalActions, query, step, view, type Action, type GameState } from '../../src/engine/index'
import { createRandomDecider } from '../../src/ai/random'
import { groupTurnActions, dieIdsOf, variantKey, type LabelNames } from '../../src/client/ui/promptModel'
import * as T from '../../src/client/ui/promptText'
import { PROMPT_FORM_KINDS } from '../../src/client/ui/PromptDock'
import { loadFixtureBundle } from '../fixtures/loadFixtureBundle'
import { setupFor } from '../../tools/sim-core'

const N: LabelNames = { survivor: (id) => id, loc: (id) => id, seat: (id) => id, card: (id) => id }

async function playTo(seed: string, until: (s: GameState) => boolean, max = 400): Promise<GameState> {
  let r = createGame(setupFor(3, 'random'), seed, loadFixtureBundle())
  const dec = createRandomDecider(seed)
  for (let i = 0; i < max && r.state.phase !== 'ended' && !until(r.state); i++) {
    const pd = r.state.pending
    const seat = pd.seat === 'all' ? r.state.seatOrder[0]! : pd.seat
    r = step(r.state, await dec.decide(view(r.state, seat), pd, legalActions(r.state)))
  }
  return r.state
}

describe('prompt text (the wording is the contract)', () => {
  const exp = { blank: 0.5, wound: 0.25, frostbite: 1 / 6, bite: 1 / 12, pDeath: 1 / 12 }
  it('formats exposure odds as percentages from the engine numbers', () => {
    expect(T.exposureLine(exp)).toBe('25% wound, 17% frostbite, 8% bite')
    expect(T.pct(0.499)).toBe('50%')
    expect(T.pct(2)).toBe('100%')
  })
  it('search, attack and move prompts name the actor, the target and the numbers', () => {
    const dice = [{ value: 4, ok: true, foodToReach: 0 }, { value: 5, ok: true, foodToReach: 0 }, { value: 2, ok: false, foodToReach: 2 }]
    expect(T.searchText({ who: 'Olivia Brown', where: 'Hospital', need: 4, dice })).toBe('Search the Hospital with Olivia Brown? Needs a 4+: you have 4, 5 (the 2 needs 2 food).')
    expect(T.attackZombieText({ who: 'Daniel Smith', at: 'gate 3', need: 2, dice: dice.slice(0, 2), exposure: exp }))
      .toBe('Attack the zombie at gate 3 with Daniel Smith? Needs a 2+: you have 4, 5. Then exposure: 25% wound, 17% frostbite, 8% bite (dies 8%).')
    expect(T.moveText({ who: 'Forest Plum', to: 'Library', emptySpaces: 2, zombies: 1, exposure: exp }))
      .toBe('Move Forest Plum to the Library? 2 empty spaces, 1 zombie there. Exposure after the move: 25% wound, 17% frostbite, 8% bite.')
  })
  it('keep-or-noise, bite and vote prompts carry their numbers', () => {
    expect(T.keepOrNoiseText({ card: 'Medicine', spacesLeft: 2, spaces: 4, pZombie: 0.5 })).toContain('Noise spaces left: 2 of 4. Each noise token has a 50% chance')
    expect(T.biteSpreadText({ survivor: 'Sparky', next: 'Olivia', blank: 0.5, pDeath: 0.5 })).toBe('The bite has reached Sparky. Let it kill Sparky now, or roll the exposure die: 50% blank and safe, 50% Sparky dies and the bite spreads to Olivia.')
    expect(T.votesText({ target: 'Rook', eligible: 4, needed: 3, tiebreak: 'Wren' })).toBe('Exile Rook? Yes or No. Eligible: 4; needed: 3; Wren breaks ties.')
    expect(T.callVoteText({ target: 'Rook', eligible: 4, needed: 3, tiebreak: 'You' })).toBe('Call a vote to exile Rook? 4 can vote, 3 yes needed; You breaks ties.')
  })
  it('no die qualifying is said plainly, and an any-die action says so', () => {
    expect(T.diceLine(5, [{ value: 2, ok: false, foodToReach: 3 }])).toBe('Needs a 5+: no die qualifies (the 2 needs 3 food).')
    expect(T.diceLine(null, [{ value: 3, ok: true, foodToReach: 0 }])).toBe('Any die works: you have 3.')
  })
  it('every engine decision kind has a prompt form (dedicated or the generic option list)', () => {
    const kinds = ['chooseSurvivors', 'chooseLeader', 'turnAction', 'searchKeepOrNoise', 'searchKeepWhich', 'crisisContribution', 'requestResponse', 'crossroadsOption', 'biteSpreadOption', 'newLeader', 'exilePlacement', 'votes', 'objectiveChoice', 'itemTarget', 'effectChoice']
    for (const k of kinds) expect(PROMPT_FORM_KINDS as readonly string[]).toContain(k)
  })
})

describe('turn action grouping and engine numbers on a real game', () => {
  it('groups every legal turn action into a family and variant, collapsing dice into chips', async () => {
    const s = await playTo('grp1', (st) => st.pending.kind === 'turnAction' && st.pending.seat !== undefined && st.turnCount >= 3)
    const legal = legalActions(s)
    const fams = groupTurnActions(legal, N)
    const grouped = fams.flatMap((f) => f.variants.flatMap((v) => v.actions))
    const handled = legal.filter((a) => a.type !== 'endTurn' && a.type !== 'contributeCrisis')
    expect(grouped).toHaveLength(handled.length)
    expect(fams.every((f) => f.variants.length > 0)).toBe(true)
    for (const f of fams) for (const v of f.variants) {
      expect(new Set(v.actions.map((a) => variantKey(a, f.type === 'spendFood'))).size).toBe(1)
      expect(dieIdsOf(v).length === 0 || dieIdsOf(v).length === v.actions.length).toBe(true)
    }
    expect(fams.some((f) => f.type === 'endTurn' as Action['type'])).toBe(false)
  })

  it('dieRequirement and exposure odds come from the engine, never the client', async () => {
    const s = await playTo('grp2', (st) => st.pending.kind === 'turnAction' && st.turnCount >= 2)
    const seat = s.pending.seat as string
    const v = view(s, seat)
    const sid = v.seats[seat]!.survivors[0]!
    const req = query.dieRequirement(v, sid, 'search')
    expect(req.dice.length).toBe(v.seats[seat]!.dice.length)
    const o = query.exposureOdds(v, sid)
    expect(o.blank + o.wound + o.frostbite + o.bite).toBeCloseTo(1, 5)
  })
})
