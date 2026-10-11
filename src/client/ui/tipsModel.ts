// Tutorial tips (50 §14, "replay tutorial tips"): a short note the first time each situation comes up. Pure so the rule is unit tested.
export interface Tip { id: string; title: string; text: string }

export const TIPS: readonly Tip[] = [
  { id: 'turn', title: 'Your turn', text: 'Pick an action chip under a survivor. Each one shows the odds before you confirm, and spends one of your dice. End turn when you are done.' },
  { id: 'search', title: 'Searching', text: 'Keep the card you drew, or make noise to draw another. Each noise token may bring a zombie at the end of the round.' },
  { id: 'exposure', title: 'The exposure die', text: 'Killing a zombie or walking outside rolls the exposure die. The feed shows the odds each roll had and which face came up.' },
  { id: 'crisis', title: 'The crisis', text: 'Add cards face down. Cards with the crisis symbols count for it, any other card counts against it. They are shuffled and revealed one by one at the end of the round.' },
  { id: 'reveal', title: 'The reveal', text: 'The running total is checked against the target as each card is flipped. Reach it to prevent the crisis; go two past it for the bonus.' },
  { id: 'crossroads', title: 'A crossroads', text: 'A story card has come up for you. Read both options and pick one; the card says what each costs.' },
  { id: 'vote', title: 'A vote', text: 'Everyone votes in secret. A majority exiles the seat; the first player breaks ties. Exiled players play for their own gain.' },
  { id: 'exile', title: 'Exiled', text: 'Your survivors leave the colony. Place each at a location outside it; every move rolls the exposure die.' },
  { id: 'keys', title: 'Keys', text: 'Press O for your objectives, [ and ] to fold the rails, 1 to 4 for the camera, Space to skip an animation and ? for the full list.' },
]

export interface TipContext {
  /** The kind of the open decision when it is the human's (otherwise null). */
  humanKind: string | null
  /** Crisis cards flipped so far this reveal. */
  crisisCards: number
  /** An exposure roll has been shown. */
  exposureSeen: boolean
}

/** The tip to show now: the first one whose situation holds and that has not been seen. Null when tips are off or nothing applies. */
export function pickTip(ctx: TipContext, seen: readonly string[], enabled = true): Tip | null {
  if (!enabled) return null
  const wanted: string[] = []
  if (ctx.humanKind === 'turnAction') wanted.push('turn', 'keys')
  if (ctx.humanKind === 'searchKeepOrNoise' || ctx.humanKind === 'searchKeepWhich') wanted.push('search')
  if (ctx.humanKind === 'crisisContribution') wanted.push('crisis')
  if (ctx.humanKind === 'crossroadsOption') wanted.push('crossroads')
  if (ctx.humanKind === 'votes') wanted.push('vote')
  if (ctx.humanKind === 'exilePlacement') wanted.push('exile')
  if (ctx.exposureSeen) wanted.push('exposure')
  if (ctx.crisisCards > 0) wanted.push('reveal')
  const id = wanted.find((w) => !seen.includes(w))
  return TIPS.find((t) => t.id === id) ?? null
}
