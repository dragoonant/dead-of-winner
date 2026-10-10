// playCard (R7.1): from hand on the own turn; Waste Pile -> waste, Equip -> attached to a survivor, Event -> removed;
// an exiled seat sends every played card to removed (R p14). Effects come from the item's `play` block.
import type { PlayCardAction } from '../actions'
import type { EffectNode } from '../hooks'
import {
  type Acc, type ActionResult, type Job, type RunCtx, afterActionJobs, checkDecision, defOf, detachCard, emitEvent, evalContext, evaluateCondition, hasSpace, isForbidden,
  mkAcc, patchState, playDescriptor, rejection, reject, runJobs, scopesViable, setSeatState, setSurvivor,
} from '../effects'
import type { CardId, GameState, PendingDecision, Rejection, SeatId, SurvivorId, WindowId } from '../types'

const hasOp = (nodes: unknown, op: string): boolean => JSON.stringify(nodes ?? null).includes(`"op":"${op}"`)

/** Can `seat` play this card now? (the card need not be in the seat's hand: a requested card is checked before it is given). */
export function playPrecheck(state: GameState, seat: SeatId, cardId: CardId, equipTo: SurvivorId | undefined, opts: { requireHand: boolean }): Rejection | null {
  const st = state.seats[seat]
  if (!st) return rejection('E_NOT_YOUR_DECISION', 'unknown seat')
  if (isForbidden(state, 'playCard', { seat })) return rejection('E_FORBIDDEN', 'cards cannot be played right now')
  if (opts.requireHand && !st.hand.includes(cardId)) return rejection('E_NOT_IN_HAND', 'that card is not in your hand')
  const def = defOf(state, cardId)
  if (!def) return rejection('E_NOT_IN_HAND', 'unknown card')
  if (def.class === 'none' || (!def.play && def.class !== 'equip')) return rejection('E_CARD_NOT_PLAYABLE', 'that card has nothing to play')
  const exiled = st.seat.exiled
  if (def.class === 'equip' && !exiled && opts.requireHand) {
    if (!equipTo) return rejection('E_BAD_PAYLOAD', 'an equip card needs equipTo')
    const sv = state.survivors[equipTo]
    if (!sv) return rejection('E_BAD_PAYLOAD', 'unknown survivor')
    if (sv.status !== 'alive') return rejection('E_SURVIVOR_DEAD', 'that survivor is gone')
    if (sv.owner !== seat) return rejection('E_NOT_YOUR_SURVIVOR', 'you can only equip your own survivors')
  }
  if (def.class === 'equip' && !exiled && !opts.requireHand && !Object.values(state.survivors).some((s) => s.status === 'alive' && s.owner === seat)) {
    return rejection('E_CARD_NOT_PLAYABLE', 'nobody to equip')
  }
  if (def.play) {
    const sv = equipTo ? state.survivors[equipTo] : undefined
    const rc: RunCtx = { sourceId: def.id, sourceKind: 'item', seat, ownerSeat: seat, survivorId: equipTo, location: sv?.location, cardId, point: 'action', itemPlay: true }
    if (hasOp(def.play.effect, 'addSurvivor') && !exiled && !hasSpace(state, 'colony')) return rejection('E_NO_SPACE', 'the colony has no free survivor space')
    if (!evaluateWhen(state, def.play.when, rc)) return rejection('E_CARD_NOT_PLAYABLE', 'the card cannot be played now')
    if (!scopesViable(state, def.play.effect as EffectNode[], rc)) return rejection('E_TARGET_INVALID', 'the card has no valid target')
    if (isForbidden(state, 'move', { seat }) && def.play.countsAs === 'move') return rejection('E_FORBIDDEN', 'moves are forbidden right now')
  }
  return null
}
function evaluateWhen(state: GameState, when: unknown, rc: RunCtx): boolean {
  return evaluateCondition(evalContext(state, rc), when as never)
}

export function validatePlayCard(state: GameState, a: PlayCardAction): Rejection | null {
  const bad = checkDecision(state, a, ['turnAction'])
  if (bad) return bad
  return playPrecheck(state, a.seat, a.cardId, a.equipTo, { requireHand: true })
}

/**
 * Move the card to its zone and build the jobs: the card's effect, then `card.played` / `card.equipped` triggers,
 * the action window (`action.playCard`, or `action.<countsAs>`, or `action.request` for a given card) and the Crossroads check.
 */
export function startPlay(state: GameState, seat: SeatId, cardId: CardId, o: { equipTo?: SurvivorId; given?: boolean } = {}): ActionResult {
  const acc = mkAcc(state)
  const def = defOf(state, cardId)!
  const exiled = state.seats[seat]!.seat.exiled
  const cls: string = def.class
  const to: 'waste' | 'equipped' | 'removed' = exiled ? 'removed' : cls === 'equip' ? 'equipped' : cls === 'event' ? 'removed' : 'waste'
  detachCard(acc, cardId)
  if (to === 'waste') patchState(acc, { waste: [cardId, ...acc.state.waste] })
  else if (to === 'removed') patchState(acc, { removed: [...acc.state.removed, cardId] })
  const attachNow = to === 'equipped' && !!o.equipTo && !o.given
  if (attachNow) setSurvivor(acc, o.equipTo!, { equipped: [...acc.state.survivors[o.equipTo!]!.equipped, cardId] })
  else if (to === 'equipped' && o.given) {
    // a given equip card is revealed by CardPlayed, so it must sit on a survivor (not in a hand, not in limbo) while the bearer choice is open; the equip job moves it
    const temp = acc.state.seats[seat]!.survivors[0]
    if (temp) setSurvivor(acc, temp, { equipped: [...acc.state.survivors[temp]!.equipped, cardId] })
  }
  emitEvent(acc, { type: 'CardPlayed', seat, cardId, defId: def.id, ...(o.equipTo ? { survivorId: o.equipTo } : {}), to })
  if (attachNow) emitEvent(acc, { type: 'CardEquipped', seat, cardId, survivorId: o.equipTo! })
  const countsAs: string | undefined = def.play?.countsAs
  const point = (countsAs ? `action.${countsAs}` : o.given ? 'action.request' : 'action.playCard') as WindowId
  const sv = o.equipTo ? acc.state.survivors[o.equipTo] : undefined
  const rc: RunCtx = { sourceId: def.id, sourceKind: 'item', seat, ownerSeat: seat, survivorId: o.equipTo, location: sv?.location, cardId, point: 'action', itemPlay: true, countsAs }
  const jobs: Job[] = []
  if (to === 'equipped' && o.given) {
    jobs.push({ t: 'run', work: [{ node: { op: 'equip', value: 'self', scope: { who: 'seatSurvivors', count: 1, chooser: 'owner' } }, idx: 0, answers: [] }], rc, later: [] })
  } else if (def.play && cls !== 'equip') {
    if (exiled && def.food) jobs.push({ t: 'run', work: [{ node: exiledFoodNode(acc, seat, def.play.effect), idx: 0, answers: [] }], rc, later: [] })
    else jobs.push({ t: 'fire', desc: playDescriptor(acc.state, cardId, seat, o.equipTo)!, rc, answers: [], activated: true })
  }
  const extra: WindowId[] = ['card.played', ...(to === 'equipped' ? (['card.equipped'] as WindowId[]) : [])]
  jobs.push(...afterActionJobs(point, { seat, survivorId: o.equipTo, cardId, location: sv?.location }, extra))
  const pending = runJobs(acc, jobs)
  return { state: acc.state, events: acc.events, ...(pending ? { pending } : {}) }
}

/** Exiled seats choose per food card: the printed effect or +1 on an unused die (R15.4, ruling R20.12). */
function exiledFoodNode(acc: Acc, seat: SeatId, effect: EffectNode[]): EffectNode {
  const canBoost = acc.state.seats[seat]!.dice.some((d) => !d.used && d.value < 6)
  const options = [{ id: 'effect', label: 'Add the food', effect }]
  if (canBoost) options.push({ id: 'die', label: 'Raise a die by 1', effect: [{ op: 'modDie', value: 1, count: 1, scope: { who: 'seat' } }] })
  return { op: 'choose', scope: { who: 'seat', chooser: 'owner' }, options }
}

export function playCard(state: GameState, a: PlayCardAction): ActionResult {
  const bad = validatePlayCard(state, a)
  if (bad) return { state, events: [], rejection: bad }
  return startPlay(state, a.seat, a.cardId, { equipTo: a.equipTo })
}

/** Every `playCard` the seat could send now (for legalActions): one per playable card, one per bearer for equip cards. */
export function playCardCandidates(state: GameState): PlayCardAction[] {
  const pd: PendingDecision = state.pending
  if (pd.kind !== 'turnAction' || pd.seat === 'all') return []
  const seat = pd.seat
  const out: PlayCardAction[] = []
  for (const cardId of state.seats[seat]!.hand) {
    const def = defOf(state, cardId)
    if (def?.class === 'equip' && !state.seats[seat]!.seat.exiled) {
      for (const sid of state.seats[seat]!.survivors) {
        const a: PlayCardAction = { type: 'playCard', decisionId: pd.id, seat, cardId, equipTo: sid }
        if (!validatePlayCard(state, a)) out.push(a)
      }
    } else {
      const a: PlayCardAction = { type: 'playCard', decisionId: pd.id, seat, cardId }
      if (!validatePlayCard(state, a)) out.push(a)
    }
  }
  return out
}

export { reject }
