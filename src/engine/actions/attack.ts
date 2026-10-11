// attack (R6.1 a zombie, R6.2 a survivor). A zombie attack never misses and costs an exposure roll;
// a survivor attack re-rolls a fresh d6 against the TARGET's attack value, wounds, steals, and never exposes.
import type { Action, AttackAction } from '../actions'
import {
  addWoundInto, aliveAt, deathThreshold, exposureInto, exposureOddsFor, fireInto, grantFor, halted, isOver, startOut, statsOf, svc, type Out,
} from '../exposure'
import { attackExposureSkip } from '../code-hooks'
import { rollDie, roll } from '../rng'
import type { ExposureOdds, GameState, Rejection, SeatId, SurvivorId } from '../types'
import { entranceAt, killZombieInto } from '../zombies'
import { checkActor, checkDecision, checkDie, finish, lowestDie, needFor, rej, rejected, spendDieInto, turnContext } from './die-common'

export function validateAttack(state: GameState, a: AttackAction): Rejection | null {
  const r0 = checkDecision(state, a) ?? checkActor(state, a.seat, a.survivorId)
  if (r0) return r0
  const sv = state.survivors[a.survivorId]!
  const need = needFor(state, a.survivorId, 'attack')
  if (a.target.kind === 'zombie') {
    const t = a.target
    if (!state.locations[t.location]) return rej('E_TARGET_INVALID', 'no such location')
    if (sv.location !== t.location) return rej('E_WRONG_LOCATION', 'the attacker is not at that location')
    const e = entranceAt(state, t.location, t.entrance)
    if (!e) return rej('E_TARGET_INVALID', 'no such entrance')
    if (e.zombies <= 0) return rej('E_NO_ZOMBIE', 'no zombie at that entrance')
    if (svc().forbidden(state, 'attack', { survivorId: a.survivorId, seat: a.seat, location: sv.location })) return rej('E_FORBIDDEN', 'attacking is forbidden right now')
  } else {
    const target = state.survivors[a.target.survivorId]
    if (!target) return rej(/^helpless/i.test(a.target.survivorId) ? 'E_HELPLESS_TARGET' : 'E_TARGET_INVALID', 'that is not a survivor you can attack')
    if (target.status !== 'alive') return rej('E_SURVIVOR_DEAD', 'that survivor is not in play')
    if (target.owner === a.seat) return rej('E_OWN_SURVIVOR', 'you cannot attack your own survivor')
    if (target.location !== sv.location) return rej('E_WRONG_LOCATION', 'the target is not at the attacker\'s location')
    if (svc().forbidden(state, 'attackSurvivor', { survivorId: a.survivorId, seat: a.seat, location: sv.location })) return rej('E_FORBIDDEN', 'attacking survivors is forbidden right now')
  }
  return checkDie(state, a.seat, a.dieId, need)
}

/** Take one random card from `from`'s hand into `to`'s (the draw uses the seeded stream; no event but CardStolen). */
function stealInto(acc: Out, from: SeatId, to: SeatId): void {
  const hand = acc.state.seats[from]?.hand ?? []
  if (hand.length === 0) return
  const [pick, rng] = rollDie(acc.state.rng, hand.length)
  const cardId = hand[pick - 1]!
  const fs = acc.state.seats[from]!
  const ts = acc.state.seats[to]!
  acc.state = {
    ...acc.state, rng,
    seats: { ...acc.state.seats, [from]: { ...fs, hand: fs.hand.filter((c) => c !== cardId) }, [to]: { ...ts, hand: [...ts.hand, cardId] } },
  }
  acc.events.push({ type: 'CardStolen', from, to, cardId })
}

export function applyAttack(state: GameState, a: AttackAction) {
  const bad = validateAttack(state, a)
  if (bad) return rejected(state, a, bad)
  const acc = startOut(state)
  const need = needFor(state, a.survivorId, 'attack')
  acc.events.push({ type: 'AttackDeclared', attackerId: a.survivorId, target: a.target, dieId: a.dieId, need })
  spendDieInto(acc, a.seat, a.dieId, 'attack', a.survivorId, need)
  const attacker = state.survivors[a.survivorId]!

  if (a.target.kind === 'zombie') {
    const { location, entrance } = a.target
    killZombieInto(acc, location, entrance, a.survivorId)
    if (grantFor(acc.state, 'killTwoPerAttack', a.survivorId) && !halted(acc)) {
      const ents = acc.state.locations[location]!.entrances
      const second = ents.find((e) => e.index === entrance && e.zombies > 0) ?? ents.find((e) => e.zombies > 0)
      if (second) killZombieInto(acc, location, second.index, a.survivorId)
    }
    const walkway = halted(acc) ? null : attackExposureSkip(acc.state, a.survivorId, location, entrance) // Ashley Ross' walkways, Gray Beard, Welcome Home
    if (walkway) { acc.state = walkway.state; acc.events.push({ type: 'ExposureSkipped', survivorId: a.survivorId, reason: 'zombieKill', sourceId: walkway.sourceId }) }
    else exposureInto(acc, a.survivorId, 'zombieKill')
  } else {
    const targetId = a.target.survivorId
    const target = state.survivors[targetId]!
    const ownerSeat = target.owner!
    const targetAttack = statsOf(state, targetId).attack
    const r = roll(acc.state, { count: 1, purpose: 'attackSurvivor', seat: a.seat, target: targetAttack })
    acc.state = r.state
    acc.events.push(r.event)
    const value = r.event.dice[0]!
    const hit = value <= targetAttack
    acc.events.push({ type: 'SurvivorAttacked', attackerId: a.survivorId, targetId, rollId: r.event.rollId, roll: value, targetAttack, hit })
    if (hit) {
      addWoundInto(acc, targetId, 'wound', 'attack')
      if (!isOver(acc.state)) stealInto(acc, ownerSeat, a.seat)
    }
  }
  if (!halted(acc) && acc.state.survivors[attacker.id]?.status === 'alive') fireInto(acc, 'action.attack', { seat: a.seat, survivorId: a.survivorId, location: attacker.location })
  return finish(acc, 'action.attack')
}

// ---------- odds (closed form; query.* wraps these) ----------
export interface AttackSurvivorOdds { targetAttack: number; pHit: number; pKillTarget: number; stealsCard: boolean }
/** Hit iff a d6 shows at most the target's attack value (R6.2); the target dies on a hit when it is one wound from the threshold. */
export function attackSurvivorOdds(p: { targetAttack: number; targetWounds: number; targetFrostbite: number; threshold?: number; targetHandCount: number }): AttackSurvivorOdds {
  const pHit = Math.min(6, Math.max(0, p.targetAttack)) / 6
  const kills = p.targetWounds + p.targetFrostbite + 1 >= (p.threshold ?? 3)
  return { targetAttack: p.targetAttack, pHit, pKillTarget: kills ? pHit : 0, stealsCard: p.targetHandCount > 0 }
}
export function attackSurvivorOddsFor(state: GameState, targetId: SurvivorId): AttackSurvivorOdds {
  const t = state.survivors[targetId]!
  return attackSurvivorOdds({
    targetAttack: statsOf(state, targetId).attack, targetWounds: t.wounds, targetFrostbite: t.frostbite, threshold: deathThreshold(state, targetId),
    targetHandCount: t.owner ? state.seats[t.owner]?.hand.length ?? 0 : 0,
  })
}
/** A zombie attack never misses when a qualifying die exists; the exposure roll is the price. */
export function zombieKillOddsFor(state: GameState, survivorId: SurvivorId): { pKill: number; exposure: ExposureOdds } {
  return { pKill: 1, exposure: exposureOddsFor(state, survivorId, 'zombieKill') }
}

// ---------- candidates for legalActions ----------
export function legalAttacks(state: GameState): Action[] {
  const ctx = turnContext(state)
  if (!ctx) return []
  const out: Action[] = []
  for (const id of ctx.survivors) {
    const sv = state.survivors[id]!
    const die = lowestDie(ctx.dice, needFor(state, id, 'attack'))
    if (!die) continue
    const base = { type: 'attack' as const, decisionId: state.pending.id, seat: ctx.seat, survivorId: id, dieId: die.id }
    for (const e of state.locations[sv.location]!.entrances) {
      if (e.zombies > 0) out.push({ ...base, target: { kind: 'zombie', location: sv.location, entrance: e.index } })
    }
    for (const t of aliveAt(state, sv.location)) if (t.owner && t.owner !== ctx.seat) out.push({ ...base, target: { kind: 'survivor', survivorId: t.id } })
  }
  return out.filter((x) => validateAttack(state, x as AttackAction) === null)
}
