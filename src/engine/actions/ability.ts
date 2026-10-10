// useAbility (10 R5.5, 21 §8): a survivor's action ability, or an action ability of an item equipped on the survivor.
// `(N+)` abilities spend one unused die showing at least N (`cost.die`); an ability that counts as an attack or a search with no
// `cost.die` charges the stat die like that action; every other ability charges no die. Once-per-round and once-per-game use is
// tracked by effects.ts (`abilityUses` for survivors, `cardUses` for items). "At the beginning of your turn" and other triggered
// abilities are never turn actions: naming one here is `E_FORBIDDEN` (R4.4). This module checks and charges; effects.ts runs the effect.
import type { Action, UseAbilityAction } from '../actions'
import type { CardEffectDescriptor } from '../hooks'
import {
  type ActionResult, activateDescriptor, checkDecision, checkDescriptor, collectTriggers, defOf, isForbidden, limitBlocked, recOf, rejection,
} from '../effects'
import { mergeInto, startOut } from '../exposure'
import type { GameState, Rejection, SurvivorState } from '../types'
import { checkActor, checkDie, lowestDie, needFor, spendDieInto, turnContext } from './die-common'

interface Raw { kind?: string; location?: string }
/** The ability record named `abilityId` on the survivor or on an item equipped to it, regardless of kind or location. */
function rawAbility(state: GameState, sv: SurvivorState, abilityId: string): Raw | null {
  const own = (recOf(state, sv.id) as { ability?: { id?: string; kind?: string; location?: string } } | undefined)?.ability
  if (own && own.id === abilityId) return own
  for (const cardId of sv.equipped) {
    const found = (defOf(state, cardId)?.equipped as { id?: string; kind?: string; location?: string }[] | undefined)?.find((x) => x.id === abilityId)
    if (found) return found
  }
  return null
}
function locationOk(sv: SurvivorState, loc: string | undefined): boolean {
  if (!loc || loc === 'anywhere') return true
  if (loc === 'colony') return sv.location === 'colony'
  if (loc === 'nonColony') return sv.location !== 'colony'
  return sv.location === loc
}

/** Action descriptors of `seat` as `useAbility` sees them: the die value to spend (null = no die) is derived from the descriptor. */
const actionDescriptors = (state: GameState, seat: string): CardEffectDescriptor[] =>
  collectTriggers(state, 'action', { seat }).filter((d) => d.survivorId && d.abilityId && d.ownerSeat === seat && d.source !== 'objective')

/** The die an ability charges: `cost.die` when set, else the stat die for attack/search, else none. */
export function dieNeed(state: GameState, d: CardEffectDescriptor): number | null {
  if (d.cost?.die !== undefined) return d.cost.die
  if (d.countsAs === 'attack' || d.countsAs === 'search') return needFor(state, d.survivorId!, d.countsAs)
  return null
}

function findFor(state: GameState, a: UseAbilityAction): { d?: CardEffectDescriptor; rejection?: Rejection } {
  const sv = state.survivors[a.survivorId]!
  const d = collectTriggers(state, 'action', { seat: a.seat, survivorId: a.survivorId }).find((x) => x.abilityId === a.abilityId && x.survivorId === a.survivorId && x.source !== 'objective')
  if (d) return { d }
  const raw = rawAbility(state, sv, a.abilityId)
  if (!raw) return { rejection: rejection('E_BAD_PAYLOAD', 'that survivor has no such ability', { abilityId: a.abilityId }) }
  if (raw.kind !== 'action') return { rejection: rejection('E_FORBIDDEN', 'only an action ability can be used as a turn action (triggered abilities fire by themselves)') }
  if (!locationOk(sv, raw.location)) return { rejection: rejection('E_ABILITY_LOCATION', 'the survivor is not where this ability works') }
  return { rejection: rejection('E_FORBIDDEN', 'that ability cannot be used now') }
}

export function validateUseAbility(state: GameState, a: UseAbilityAction): Rejection | null {
  const r0 = checkDecision(state, a, ['turnAction']) ?? checkActor(state, a.seat, a.survivorId)
  if (r0) return r0
  const f = findFor(state, a)
  if (!f.d) return f.rejection!
  const d = f.d
  if (isForbidden(state, 'useAbility', { seat: a.seat, survivorId: a.survivorId })) return rejection('E_FORBIDDEN', 'abilities are forbidden right now')
  if (d.countsAs && isForbidden(state, d.countsAs, { seat: a.seat, survivorId: a.survivorId })) return rejection('E_FORBIDDEN', `${d.countsAs} is forbidden right now`)
  if (limitBlocked(state, d)) return rejection('E_ABILITY_USED', 'this ability was already used')
  const need = dieNeed(state, d)
  if (need !== null) {
    if (!a.dieId) return rejection('E_NO_DIE', 'this ability needs a die')
    const badDie = checkDie(state, a.seat, a.dieId, need)
    if (badDie) return badDie
  }
  // the effect layer's own preconditions (`when`, food and card costs), so legalActions never offers what activateDescriptor refuses
  return checkDescriptor(state, d, { seat: a.seat, survivorId: a.survivorId, dieId: need !== null ? a.dieId : undefined })
}

export function applyUseAbility(state: GameState, a: UseAbilityAction): ActionResult {
  const bad = validateUseAbility(state, a)
  if (bad) return { state, events: [], rejection: bad }
  const d = findFor(state, a).d!
  const need = dieNeed(state, d)
  const acc = startOut(state)
  if (need !== null) spendDieInto(acc, a.seat, a.dieId!, d.countsAs === 'attack' || d.countsAs === 'search' ? d.countsAs : 'ability', a.survivorId, need)
  else if (acc.state.turn) acc.state = { ...acc.state, turn: { ...acc.state.turn, actions: acc.state.turn.actions + 1 } }
  const r = activateDescriptor(acc.state, d, { seat: a.seat, dieId: need !== null ? a.dieId : undefined, survivorId: a.survivorId })
  if (r.rejection) return { state, events: [], rejection: r.rejection } // nothing is charged when the effect layer refuses
  mergeInto(acc, r)
  return acc
}

/** Candidates for legalActions: each usable action ability with the lowest die that qualifies. */
export function legalAbilities(state: GameState): Action[] {
  const ctx = turnContext(state)
  if (!ctx) return []
  const out: Action[] = []
  for (const d of actionDescriptors(state, ctx.seat)) {
    const need = dieNeed(state, d)
    const base = { type: 'useAbility' as const, decisionId: state.pending.id, seat: ctx.seat, survivorId: d.survivorId!, abilityId: d.abilityId! }
    if (need === null) {
      const a: UseAbilityAction = base
      if (validateUseAbility(state, a) === null) out.push(a)
      continue
    }
    const die = lowestDie(ctx.dice, need)
    if (!die) continue
    const a: UseAbilityAction = { ...base, dieId: die.id }
    if (validateUseAbility(state, a) === null) out.push(a)
  }
  return out
}
