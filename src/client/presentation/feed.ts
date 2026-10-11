// The event feed (50 §10): one line per event, in our own words, from engine numbers only. A switch over every GameEventType
// (the `never` default makes a new event type a compile error). Pure: names come from the injected `Names`.
import type { ExposureFace, GameEvent, GameEventType, RollPurpose } from '../../engine/index'

export interface Names {
  seat(id: string): string
  survivor(id: string): string
  loc(id: string): string
  item(defId: string): string
  crisis(id: string): string
  objective(id: string): string
  /** The printed text of one Crossroads option, shortened for a feed line (optional: the tests inject plain names). */
  option?(cardId: string, optionId: string): string
}

const plural = (n: number, one: string, many = one + 's'): string => `${n} ${n === 1 ? one : many}`
const gate = (n: number): string => `gate ${n}`
const where = (N: Names, loc: string, entrance?: number): string => (loc === 'colony' && entrance ? `the Colony, ${gate(entrance)}` : N.loc(loc))
const sign = (n: number): string => (n > 0 ? `+${n}` : String(n))

export const FACE_WORD: Record<ExposureFace, string> = { blank: 'BLANK', wound: 'WOUND', frostbite: 'FROSTBITE', bite: 'BITE' }

/** Roll purposes and how the tray names them (a unit test asserts one entry per purpose). */
export const ROLL_PURPOSE_LABEL: Record<RollPurpose, string> = {
  actionDice: 'Action dice', exposure: 'Exposure die', attackSurvivor: 'Attack on a survivor', noise: 'Noise roll', objective: 'Objective roll',
  crisis: 'Crisis roll', crossroads: 'Crossroads roll', item: 'Item roll', ability: 'Ability roll', other: 'Roll',
}
export function rollPurposeLabel(p: string): string { return (ROLL_PURPOSE_LABEL as Record<string, string>)[p] ?? 'Roll' }

const MORALE_REASON: Record<string, string> = {
  survivorKilled: 'a survivor died', helplessKilled: 'a helpless survivor died', starvation: 'the colony went hungry', waste: 'the waste pile overflowed',
  crisisFailed: 'the crisis was not prevented', crisisBonus: 'the crisis bonus', crisis: 'a crisis', crossroads: 'a crossroads', item: 'an item', ability: 'an ability',
  objective: 'the objective', doubleExile: 'a second exile', setup: 'setup',
}
const KILL_CAUSE: Record<string, string> = {
  wounds: 'wounds', bite: 'a bite', biteChoice: 'a bite (chosen)', overrun: 'an overrun entrance', crisis: 'a crisis', crossroads: 'a crossroads',
  item: 'an item', objective: 'the objective', ability: 'an ability', exposureChain: 'a bite chain',
}
/** Headers for the colony-phase steps (the feed starts a sub-section at each one). */
export const COLONY_STEP_TITLE: Record<string, string> = {
  payFood: 'Step 1: the colony eats', checkWaste: 'Step 2: the waste pile', resolveCrisis: 'Step 3: the crisis resolves',
  addZombies: 'Step 4: zombies arrive', checkObjective: 'Step 5: the objective check', roundTick: 'Step 6: the round track', passToken: 'Step 7: the first-player token',
}
/** Why an exposure die was rolled, in a few words. */
export const EXPOSURE_WHY: Record<string, string> = {
  move: 'moving', zombieKill: 'killing a zombie', biteChain: 'the bite spreading', card: 'a card', ability: 'an ability',
}
export const clip = (s: string, n = 110): string => {
  const one = s.replace(/\s+/g, ' ').trim()
  if (one.length <= n) return one
  const cut = one.slice(0, n)
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '))
  return `${(stop > 40 ? cut.slice(0, stop + 1) : cut.replace(/\s+\S*$/, ''))}...`
}
const DISCARD_REASON: Record<string, string> = { crisis: 'spent on the crisis', lastSurvivor: 'their last survivor died', played: 'played' }
const END_REASON: Record<string, string> = { moraleZero: 'morale hit zero', roundsOut: 'the rounds ran out', objectiveComplete: 'the main objective was completed', concession: 'the human conceded' }

/** The feed line for an event, or null when the event has no line of its own (bookkeeping the table never shows). */
export function feedLine(ev: GameEvent, N: Names): string | null {
  switch (ev.type) {
    case 'GameCreated': return `New game, seed "${ev.seed}". Main objective: ${N.objective(ev.objectiveId)}.`
    case 'ActionRejected': return null
    case 'DecisionAutoResolved': return null
    // the feed's own headers (round, turn, colony step) mark phase changes, so only the end of the game gets a line
    case 'PhaseChanged': return ev.phase === 'ended' ? 'The game is over.' : null
    case 'RoundStarted': return `Round ${ev.roundNumber} begins, ${plural(ev.roundsLeft, 'round')} left.`
    case 'TurnStarted': return `${N.seat(ev.seat)} takes turn ${ev.turnCount}.`
    case 'TurnEnded': return null
    case 'RoundTicked': return `The round track drops to ${ev.roundsLeft}.`
    case 'FirstSeatPassed': return `The first-player token passes from ${N.seat(ev.from)} to ${N.seat(ev.to)}.`
    case 'SurvivorsDealt': return ev.survivorIds.length ? `${N.seat(ev.seat)} is dealt ${ev.survivorIds.map(N.survivor).join(', ')}.` : `${N.seat(ev.seat)} is dealt survivors.`
    case 'SurvivorsChosen': return `${N.seat(ev.seat)} keeps ${ev.kept.map(N.survivor).join(' and ')}.`
    case 'LeaderChosen': return `${N.seat(ev.seat)} picks ${N.survivor(ev.survivorId)} as leader.`
    case 'StartingItemsDealt': return `${N.seat(ev.seat)} draws starting items.`
    case 'SecretObjectiveDealt': return 'You are dealt a secret objective.'
    case 'FirstSeatSet': return `${N.seat(ev.seat)} holds the first-player token (leader ${N.survivor(ev.leaderId)}, influence ${ev.influence}).`
    case 'DiceRolled': return ev.purpose === 'actionDice' ? null : `${rollPurposeLabel(ev.purpose)}${ev.seat ? ` for ${N.seat(ev.seat)}` : ''}: ${ev.dice.join(', ')}${ev.target !== undefined ? ` (target ${ev.target})` : ''}.`
    case 'ActionDiceRolled': return `${N.seat(ev.seat)} rolls action dice: ${ev.dice.map((d) => d.value).join(', ')}.`
    case 'DieSpent': return `${N.seat(ev.seat)} spends a ${ev.value} to ${ev.purpose}${ev.survivorId ? ` with ${N.survivor(ev.survivorId)}` : ''}.`
    case 'DieBoosted': return `${N.seat(ev.seat)} raises a die from ${ev.from} to ${ev.to} (${ev.source}).`
    case 'DieAdded': return `${N.seat(ev.seat)} gains an extra die (${ev.die.value}).`
    case 'ExposureRolled': return `Exposure roll for ${N.survivor(ev.survivorId)}: ${FACE_WORD[ev.face]} (${EXPOSURE_WHY[ev.reason] ?? ev.reason}).`
    case 'ExposureFaceChanged': return `${N.survivor(ev.survivorId)} gets a different exposure result: ${FACE_WORD[ev.from]} becomes ${FACE_WORD[ev.to]}.`
    case 'ExposureSkipped': return `${N.survivor(ev.survivorId)} skips the exposure roll.`
    case 'WoundTaken': return `${N.survivor(ev.survivorId)} takes ${ev.kind === 'frostbite' ? 'frostbite' : 'a wound'} (${plural(ev.wounds, 'wound')}, ${plural(ev.frostbite, 'frostbite token')}).`
    case 'WoundHealed': return `${N.survivor(ev.survivorId)} heals ${ev.kind === 'frostbite' ? 'a frostbite' : 'a wound'}.`
    case 'FrostbiteTicked': return `Frostbite ticks on ${N.survivor(ev.survivorId)}.`
    case 'BiteSpreadStep': return `The bite spreads from ${N.survivor(ev.fromId)} to ${N.survivor(ev.toId)} at ${N.loc(ev.location)}.`
    case 'BiteChoiceMade': return `${N.seat(ev.seat)} chooses to ${ev.choice === 'kill' ? 'let the bite kill' : 'roll for'} ${N.survivor(ev.survivorId)}.`
    case 'BiteChainEnded': return `The bite chain at ${N.loc(ev.location)} ends (${ev.reason === 'killChoice' ? 'a kill was chosen' : ev.reason === 'blank' ? 'a blank was rolled' : 'no one left'}).`
    case 'SurvivorKilled': return `${N.survivor(ev.survivorId)} dies at ${N.loc(ev.location)} from ${KILL_CAUSE[ev.cause] ?? ev.cause}${ev.moraleLoss ? ' (morale -1)' : ''}.`
    case 'SurvivorRemoved': return `${N.survivor(ev.survivorId)} leaves the game.`
    case 'EquippedReturned': return `${plural(ev.cardIds.length, 'equipped item')} go back to ${ev.to === 'hand' ? 'a hand' : 'the deck'}.`
    case 'SurvivorAdded': return `${N.survivor(ev.survivorId)} joins ${N.seat(ev.seat)} at ${N.loc(ev.location)}.`
    case 'HelplessAdded': return `${plural(ev.count, 'helpless survivor')} arrive${ev.count === 1 ? 's' : ''} at ${N.loc(ev.location)} (${ev.after} there).`
    case 'HelplessKilled': return `${plural(ev.count, 'helpless survivor')} die${ev.count === 1 ? 's' : ''} at ${N.loc(ev.location)}.`
    case 'HandDiscarded': return `${N.seat(ev.seat)} discards ${plural(ev.count, 'card')}.`
    case 'SeatEliminated': return `${N.seat(ev.seat)} is out of the game.`
    case 'SurvivorMoved': return `${N.survivor(ev.survivorId)} ${ev.kind === 'exile' ? 'is sent' : 'moves'} from ${N.loc(ev.from)} to ${N.loc(ev.to)}.`
    case 'AttackDeclared': return ev.target.kind === 'zombie'
      ? `${N.survivor(ev.attackerId)} attacks a zombie at ${where(N, ev.target.location, ev.target.entrance)} (needs ${ev.need}+).`
      : `${N.survivor(ev.attackerId)} attacks ${N.survivor(ev.target.survivorId)}.`
    case 'SurvivorAttacked': return `${N.survivor(ev.attackerId)} rolls ${ev.roll} against ${N.survivor(ev.targetId)} (needs ${ev.targetAttack} or less): ${ev.hit ? 'HIT' : 'MISS'}.`
    case 'CardStolen': return `${N.seat(ev.to)} steals a card from ${N.seat(ev.from)}.`
    case 'ZombiesToAdd': return `${plural(ev.count, 'zombie')} to place at ${N.loc(ev.location)}${ev.survivors !== undefined ? ` (${plural(ev.survivors, 'survivor')} there)` : ''}.`
    case 'ZombieAdded': return `A zombie arrives at ${where(N, ev.location, ev.entrance)} (${ev.zombies} there).`
    case 'ZombieKilled': return `A zombie is killed at ${where(N, ev.location, ev.entrance)} (${ev.zombies} left there).`
    case 'ZombieMoved': return `A zombie is drawn from ${N.loc(ev.from.location)} to ${N.loc(ev.to.location)}.`
    case 'BarricadeAdded': return `A barricade goes up at ${where(N, ev.location, ev.entrance)} (${ev.barricades} there).`
    case 'BarricadeDestroyed': return `A barricade falls at ${where(N, ev.location, ev.entrance)}.`
    case 'EntranceOverrun': return `${where(N, ev.location, ev.entrance)} is overrun${ev.killed ? (ev.killed === 'helpless' ? ': a helpless survivor dies' : `: ${N.survivor(ev.killed)} dies`) : ''}.`
    case 'NoiseAdded': return `Noise at ${N.loc(ev.location)} (${ev.after} token${ev.after === 1 ? '' : 's'}).`
    case 'NoiseRolled': return `Noise roll at ${N.loc(ev.location)}: ${ev.die} - ${ev.zombie ? 'a zombie comes' : 'quiet'}.`
    case 'NoiseCleared': return `Noise at ${N.loc(ev.location)} is cleared.`
    case 'SearchStarted': return `${N.survivor(ev.survivorId)} searches ${N.loc(ev.location)} (${ev.need}+).`
    case 'SearchDrawn': return `${N.seat(ev.seat)} draws ${N.item(ev.defId)} at ${N.loc(ev.location)}.`
    case 'SearchKept': return `${N.seat(ev.seat)} keeps a card from ${N.loc(ev.location)}${ev.returned ? ` and puts ${plural(ev.returned, 'card')} back` : ''}.`
    case 'CardDrawn': return `${N.seat(ev.seat)} draws a card.`
    case 'CardPlayed': return `${N.seat(ev.seat)} plays ${N.item(ev.defId)}${ev.to === 'equipped' && ev.survivorId ? ` on ${N.survivor(ev.survivorId)}` : ''}.`
    case 'CardEquipped': return `${N.seat(ev.seat)} equips a card on ${N.survivor(ev.survivorId)}.`
    case 'CardHandedOff': return `${N.survivor(ev.fromSurvivorId)} hands an item to ${N.survivor(ev.toSurvivorId)}.`
    case 'CardContributed': return `${N.seat(ev.seat)} adds a face-down card to the crisis.`
    case 'CardAddedToObjective': return `${N.seat(ev.seat)} adds ${N.item(ev.defId)} to the main objective.`
    case 'CardGiven': return `${N.seat(ev.from)} gives ${N.item(ev.defId)} to ${N.seat(ev.to)}.`
    case 'CardDiscarded': {
      if (ev.to === 'deck' || ev.reason === 'crisis') return null
      const why = DISCARD_REASON[ev.reason] ?? ev.reason.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
      return `${ev.seat ? `${N.seat(ev.seat)}'s card` : 'A card'} ${ev.to === 'removed' ? 'leaves the game' : 'goes to the waste pile'} (${why}).`
    }
    case 'WasteCleaned': return `${N.survivor(ev.by)} cleans ${plural(ev.cardIds.length, 'waste card')}; ${ev.wasteAfter} remain.`
    case 'RequestMade': return `${N.seat(ev.from)} asks ${ev.all ? 'everyone' : N.seat(ev.to)} for ${ev.defId ? N.item(ev.defId) : ev.symbol ? `a ${ev.symbol} card` : 'a card'}.`
    case 'RequestAnswered': return ev.cardId ? `${N.seat(ev.to)} gives ${N.seat(ev.from)} a card.` : `${N.seat(ev.to)} declines.`
    case 'FoodPaid': return `The colony eats: ${ev.needed} food for ${plural(ev.survivors, 'survivor')}; ${ev.foodAfter} left.`
    case 'Starvation': return `Not enough food (needed ${ev.needed}, had ${ev.supply}): starvation ${ev.starvationAfter}, morale -${ev.moraleLoss}.`
    case 'FoodChanged': return `Food ${sign(ev.delta)} (now ${ev.after}).`
    case 'WasteChecked': return ev.moraleLoss > 0 ? `The waste pile holds ${ev.cards} cards: morale -${ev.moraleLoss}.` : `The waste pile holds ${ev.cards} cards: no penalty.`
    case 'MoraleChanged': return `Morale ${sign(ev.delta)} to ${ev.after} (${MORALE_REASON[ev.reason] ?? ev.reason}).`
    case 'CrisisRevealed': return `Crisis: ${N.crisis(ev.cardId)}. Prevent it with ${ev.prevent.join(' or ') || 'nothing'} cards.`
    case 'CrisisCardRevealed': return `Crisis card: ${N.item(ev.defId)} (${ev.points > 0 ? '+1' : '-1'}), running total ${ev.runningTotal}.`
    case 'CrisisResolved': return `${N.crisis(ev.cardId)}: total ${ev.total} of ${ev.needed} needed from ${plural(ev.cards, 'card')} - ${ev.prevented ? (ev.bonus ? 'prevented, with the bonus' : 'prevented') : 'NOT prevented'}.`
    case 'CrisisEffectApplied': return ev.kind === 'bonus' ? `${N.crisis(ev.cardId)}: the bonus applies.` : `${N.crisis(ev.cardId)}: the failure effect applies.`
    case 'ObjectiveChecked': return ev.complete ? 'Objective check: the main objective is complete.' : 'Objective check: not complete yet.'
    case 'CrossroadsDrawn': return null
    case 'CrossroadsTriggered': return `Crossroads: ${N.crisis(ev.cardId)} comes up for ${N.seat(ev.forSeat)}.`
    case 'CrossroadsResolved': {
      const text = (ev.optionId && N.option ? N.option(ev.cardId, ev.optionId) : '').replace(/[\s.!?;:]+$/, '')
      return `${N.seat(ev.forSeat)} ${ev.forced ? 'has only one way out' : 'chooses'}: ${ev.optionId ? (text ? `"${text}"` : `option ${ev.optionId}`) : 'nothing can happen'}.`
    }
    case 'CrossroadsReturned': return null
    case 'CrossroadsDeckShuffled': return null
    case 'VoteCalled': return `${N.seat(ev.caller)} calls a vote to exile ${N.seat(ev.target)}.`
    case 'VotesCast': return `Ballots: ${Object.entries(ev.votes).map(([s, y]) => `${N.seat(s)} ${y ? 'yes' : 'no'}`).join(', ')}.`
    case 'VoteResult': return `Vote on ${N.seat(ev.target)}: ${ev.yes} yes, ${ev.no} no${ev.tiebreakBy ? ` (tie broken by ${N.seat(ev.tiebreakBy)})` : ''} - ${ev.exiled ? 'EXILED' : 'stays'}.`
    case 'SeatExiled': return `${N.seat(ev.seat)} is exiled.`
    case 'ExiledPlaced': return `${N.seat(ev.seat)} places the exiled: ${ev.placements.map((p) => `${N.survivor(p.survivorId)} to ${N.loc(p.to)}`).join(', ')}.`
    case 'SurvivorBumped': return `${N.survivor(ev.survivorId)} is bumped back to the Colony.`
    case 'ObjectiveProgress': return `Objective progress (${ev.counter}): ${ev.after} of ${ev.need}.`
    case 'ObjectiveComplete': return ev.seat === null ? 'The main objective is complete.' : 'Your secret objective is complete.'
    case 'EffectApplied': return null
    case 'EffectExpired': return null
    case 'AbilityUsed': return `${N.survivor(ev.survivorId)} uses an ability.`
    case 'DeckShuffled': return null
    case 'GameEnded': return `Game over: ${END_REASON[ev.reason] ?? ev.reason}. Morale ${ev.morale}, ${plural(ev.roundsLeft, 'round')} left.`
    default: { const _never: never = ev; return _never }
  }
}

/** Event types that deliberately have no feed line (the coverage test checks every other type produces one). */
export const SILENT_EVENT_TYPES: readonly GameEventType[] = [
  'ActionRejected', 'DecisionAutoResolved', 'TurnEnded', 'CrossroadsDrawn', 'CrossroadsReturned', 'CrossroadsDeckShuffled', 'EffectApplied', 'EffectExpired', 'DeckShuffled',
]
