// Prompt text builders (50 §5): every sentence the dock shows, from plain inputs the forms read off the engine (query.*, pending.context,
// pending.options[].odds). Pure and engine-free so the wording is unit tested. Nothing here computes a rules number.

export interface ExposureLike { blank: number; wound: number; frostbite: number; bite: number; pDeath: number }
export interface DieInfo { value: number; ok: boolean; foodToReach: number }

export const clamp01 = (p: number): number => Math.max(0, Math.min(1, p))
export const pct = (p: number): string => `${Math.round(clamp01(p) * 100)}%`
export const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`
export const list = (items: readonly string[], joiner = 'and'): string =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} ${joiner} ${items[items.length - 1]}`
export const camelWords = (s: string): string => s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_.]/g, ' ').replace(/^./, (c) => c.toUpperCase())
export const the = (place: string): string => (/^the /i.test(place) ? place : `the ${place}`)

/** "25% wound, 17% frostbite, 8% bite" (the exposure faces other than blank). */
export function exposureLine(o: ExposureLike): string {
  return `${pct(o.wound)} wound, ${pct(o.frostbite)} frostbite, ${pct(o.bite)} bite`
}
export const hasExposure = (o: ExposureLike): boolean => o.wound + o.frostbite + o.bite > 0

/** "Needs a 4+: you have 4, 5 (the 2 needs 2 food)." or "Any die works: you have 4, 5." */
export function diceLine(need: number | null, dice: readonly DieInfo[]): string {
  const ok = dice.filter((d) => d.ok).map((d) => d.value)
  const lead = need === null ? 'Any die works' : `Needs a ${need}+`
  const have = ok.length ? `you have ${ok.join(', ')}` : 'no die qualifies'
  const boost = dice.filter((d) => !d.ok && d.foodToReach > 0).map((d) => `the ${d.value} needs ${plural(d.foodToReach, 'food', 'food')}`)
  return `${lead}: ${have}${boost.length ? ` (${list(boost)})` : ''}.`
}

export function searchText(i: { who: string; where: string; need: number | null; dice: readonly DieInfo[]; likely?: { symbol: string; p: number } | null }): string {
  return `Search ${the(i.where)} with ${i.who}? ${diceLine(i.need, i.dice)}${i.likely ? ` Best chance next card: ${pct(i.likely.p)} ${i.likely.symbol}.` : ''}`
}

export function attackZombieText(i: { who: string; at: string; need: number | null; dice: readonly DieInfo[]; exposure: ExposureLike | null }): string {
  const exp = i.exposure && hasExposure(i.exposure) ? ` Then exposure: ${exposureLine(i.exposure)} (dies ${pct(i.exposure.pDeath)}).` : ' No exposure roll follows.'
  return `Attack the zombie at ${i.at} with ${i.who}? ${diceLine(i.need, i.dice)}${exp}`
}

export function attackSurvivorText(i: { who: string; target: string; die: number | null; targetAttack: number; pHit: number; pKill: number; stealsCard: boolean }): string {
  return `Attack ${i.target} with ${i.who}? Spend ${i.die === null ? 'a die' : `the ${i.die}`}; a hit needs a roll of ${i.targetAttack} or less: ${pct(i.pHit)}. No exposure roll.`
    + `${i.pKill > 0 ? ` A hit could kill them (${pct(i.pKill)}).` : ' A hit wounds them.'}${i.stealsCard ? ' A hit also steals a random card.' : ''}`
}

export function moveText(i: { who: string; to: string; emptySpaces: number; zombies: number; exposure: ExposureLike | null }): string {
  const exp = i.exposure && hasExposure(i.exposure) ? ` Exposure after the move: ${exposureLine(i.exposure)}.` : ' No exposure roll after this move.'
  return `Move ${i.who} to ${the(i.to)}? ${plural(i.emptySpaces, 'empty space')}, ${plural(i.zombies, 'zombie')} there.${exp}`
}

export function barricadeText(i: { who: string; gate: string; need: number | null; dice: readonly DieInfo[] }): string {
  return `Barricade ${i.gate} with ${i.who}? ${diceLine(i.need, i.dice)}`
}
export function cleanWasteText(i: { who: string; waste: number }): string {
  return `Clean waste with ${i.who}? The waste pile holds ${plural(i.waste, 'card')}; cleaning takes the top ones out of the game.`
}
export function attractText(i: { who: string; where: string; total: number; from: readonly string[]; to?: readonly string[] }): string {
  if (i.total === 0) return `Attract no zombies with ${i.who}? The die is spent and nothing moves.`
  return `Attract ${plural(i.total, 'zombie')} to ${the(i.where)} with ${i.who}? From: ${i.from.join(', ')}.${i.to && i.to.length ? ` Placed at ${i.to.join(' and ')}.` : ''} Only into empty spaces.`
}
export function abilityText(i: { who: string; ability: string }): string {
  return `Use ${i.who}'s ability? ${i.ability || 'See the survivor card.'}`
}
export function spendFoodText(i: { dieValue: number | null; tokens: number; food: number; needed: number }): string {
  return `Spend ${plural(i.tokens, 'food', 'food')} on ${i.dieValue === null ? 'this die' : `the ${i.dieValue}`}? You have ${i.food} food; the colony needs ${i.needed} next phase.`
}
export function playCardText(i: { card: string; text: string; equipTo?: string | null }): string {
  return `${i.equipTo ? `Equip ${i.card} on ${i.equipTo}` : `Play ${i.card}`}?${i.text ? ` ${i.text}` : ''}`
}
export function objectiveCardText(i: { card: string; objective: string; have: string }): string {
  return `Add ${i.card} to the main objective (${i.objective})?${i.have ? ` Progress so far: ${i.have}.` : ''} The card stays there for good, so it cannot be used for anything else.`
}
export function requestText(i: { to: string; want: string; handCount: number }): string {
  return `Ask ${i.to} for ${i.want}? They have ${plural(i.handCount, 'card')}.`
}
export function handOffText(i: { card: string; from: string; to: string }): string {
  return `Hand ${i.card} from ${i.from} to ${i.to} (same location)?`
}
export function callVoteText(i: { target: string; eligible: number; needed: number; tiebreak: string }): string {
  return `Call a vote to exile ${i.target}? ${i.eligible} can vote, ${i.needed} yes needed; ${i.tiebreak} breaks ties.`
}
export function endTurnText(i: { diceLeft: number }): string {
  return i.diceLeft > 0 ? `End your turn? You still have ${plural(i.diceLeft, 'unused die', 'unused dice')}.` : 'End your turn? You have used all your dice.'
}

export function contributeText(i: { crisis: string; prevent: readonly string[]; needed: number; bonusAt: number; cardsIn: number; mine: number; bySeat: readonly string[]; endsTurn?: boolean }): string {
  return `Add cards to the crisis (${i.crisis}${i.prevent.length ? ` needs ${list(i.prevent, 'or')}` : ''})? Prevent at ${i.needed}, bonus at ${i.bonusAt}. `
    + `In so far: ${plural(i.cardsIn, 'card')}${i.bySeat.length ? ` (${i.bySeat.join(', ')})` : ''}; yours so far: ${i.mine}.${i.endsTurn ? ' This ends your turn.' : ''}`
}

export function keepOrNoiseText(i: { card: string; spacesLeft: number; spaces: number; pZombie: number }): string {
  return `Keep ${i.card} or make noise for another? Noise spaces left: ${i.spacesLeft} of ${i.spaces}. Each noise token has a ${pct(i.pZombie)} chance of bringing a zombie next phase.`
}
export function keepWhichText(i: { cards: readonly string[] }): string {
  return `Keep one: ${list(i.cards, 'or')}. The others go under the deck.`
}
export function requestResponseText(i: { from: string; want: string }): string {
  return `${i.from} asks you for ${i.want}. Give a card or decline.`
}
export function biteSpreadText(i: { survivor: string; next: string | null; blank: number; pDeath: number }): string {
  return `The bite has reached ${i.survivor}. Let it kill ${i.survivor} now, or roll the exposure die: ${pct(i.blank)} blank and safe, ${pct(i.pDeath)} ${i.survivor} dies${i.next ? ` and the bite spreads to ${i.next}` : ''}.`
}
export function votesText(i: { target: string; eligible: number; needed: number; tiebreak: string }): string {
  return `Exile ${i.target}? Yes or No. Eligible: ${i.eligible}; needed: ${i.needed}; ${i.tiebreak} breaks ties.`
}
export function exileText(i: { names: readonly string[] }): string {
  return `Exiled. Place ${list(i.names)} at non-colony locations (exposure after each move). A full location bumps someone back to the colony.`
}
export function chooseSurvivorsText(i: { keep: number; offered: number }): string { return `Pick ${i.keep} of ${i.offered} survivors to keep.` }
export function leaderText(): string { return 'Pick the leader of your group. The leader sets your influence for the first-player token.' }

/** An exiled first player still breaks ties (R p4, R p11), so the ballot asks them up front what they would vote if the table splits evenly. */
export function tieBreakText(i: { target: string; eligible: number }): string {
  return `You are exiled and cannot vote, but as first player you break ties. The table is voting on whether to exile ${i.target} (${i.eligible} ${i.eligible === 1 ? 'voter' : 'voters'}). If the vote ends in a tie, should ${i.target} be exiled?`
}
/** A table vote raised by a Crossroads card: the two answers are the card's own labels. */
export function effectVoteText(i: { card: string; eligible: number; yes: string; no: string }): string {
  return `${i.card}: the table votes. ${i.eligible} ${i.eligible === 1 ? 'player votes' : 'players vote'}; the majority decides and the first player breaks a tie. Yes means "${i.yes}"; No means "${i.no}".`
}
