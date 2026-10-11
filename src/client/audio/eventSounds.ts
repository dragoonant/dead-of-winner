// Engine events -> sounds: the one place that decides what is heard. Pure (no audio calls, no timers) so it is easy to test;
// presentAudio.ts is the only caller that touches the manager.
//   planEvent(event, ctx, memo) -> { sounds, narration, music }
// Events reach this module already redacted for the viewer, so a private event (a search draw, a stolen card id) never sounds
// louder than what the player is allowed to know.
import type { GameEvent, GameState } from '../../engine/index'
import { AUDIO_BY_ID } from './manifest'
import type { MusicScene } from './music'

export interface EventSound { id: string; delayMs?: number; volume?: number }
export interface NarrationLine {
  id: string
  /** The presentation pauses for this line (the beat is held until it ends). Lines without it just play over the next beats. */
  hold: boolean
}
export interface EventPlan { sounds: EventSound[]; narration: NarrationLine[]; music?: MusicScene }

export interface SoundContext {
  /** The seat the human plays; narrator lines speak to this seat. */
  viewer?: string | undefined
  /** State the event is played against (objective, equipment). Optional: without it the generic sound is used. */
  state?: GameState | null | undefined
}

/** Once-per-round and once-per-game flags so a busy colony phase does not babble. Reset on GameCreated. */
export interface SoundMemo { gateRound: number; starveRound: number; moraleLow: boolean }
export const newSoundMemo = (): SoundMemo => ({ gateRound: -1, starveRound: -1, moraleLow: false })

const NONE: EventPlan = { sounds: [], narration: [] }
const has = (id: string): boolean => id in AUDIO_BY_ID

const SEARCH_BY_LOCATION: Record<string, string> = {
  'loc.police-station': 'search-police', 'loc.grocery-store': 'search-grocery', 'loc.school': 'search-school',
  'loc.library': 'search-library', 'loc.hospital': 'search-hospital', 'loc.gas-station': 'search-gas',
}
const GUN_DEF = /pistol|shotgun|rifle|colt|tikka|fn-slp|revolver|carbine/

/** Objective intro line id for a main objective record id ("obj.main.kill-them" -> "nar-obj-kill-them"), or null. */
export function objectiveIntroLine(objectiveId: string | undefined): string | null {
  const id = objectiveId ? `nar-obj-${objectiveId.replace(/^obj\.main\./, '')}` : ''
  return id && has(id) ? id : null
}

/** Crossroads narration line id for a card id ("xr.hunted" -> "vo-xr-hunted"), or null when that card is not voiced. */
export function crossroadsLine(cardId: string | undefined): string | null {
  const id = cardId ? `vo-xr-${cardId.replace(/^xr\./, '')}` : ''
  return id && has(id) ? id : null
}

/** Dice rattle for a roll of `n` dice. */
export function diceSound(n: number): string { return n <= 1 ? 'dice-single' : n === 2 || n === 3 ? 'dice-3' : n === 4 ? 'dice-4' : 'dice-5' }

function attackerHasGun(ctx: SoundContext, attackerId: string): boolean {
  const st = ctx.state
  const sv = st?.survivors?.[attackerId]
  if (!st || !sv) return false
  return sv.equipped.some((cardId) => GUN_DEF.test(st.cards[cardId]?.defId ?? ''))
}

const plan = (sounds: EventSound[], narration: NarrationLine[] = [], music?: MusicScene): EventPlan => ({ sounds, narration, ...(music ? { music } : {}) })
const say = (id: string, hold: boolean): NarrationLine[] => (has(id) ? [{ id, hold }] : [])

/** What one (already redacted) event sounds like. `memo` is mutated for the once-per-round flags. */
export function planEvent(ev: GameEvent, ctx: SoundContext, memo: SoundMemo): EventPlan {
  const viewerWon = (winners: string[]): boolean => !!ctx.viewer && winners.includes(ctx.viewer)
  switch (ev.type) {
    case 'GameCreated': Object.assign(memo, newSoundMemo()); return plan([], [], 'colony')
    case 'RoundStarted': {
      const intro = ev.roundNumber === 1 ? objectiveIntroLine(ctx.state?.objective.id) : null
      const line = intro ?? (ev.roundsLeft <= 1 && ev.roundNumber > 1 ? 'nar-round-last' : ev.roundNumber % 2 === 0 ? 'nar-round-a' : 'nar-round-b')
      return plan([], say(line, true), 'colony')
    }
    case 'RoundTicked': return plan([{ id: 'round-tick' }])

    // ---------- dice ----------
    case 'ActionDiceRolled': return plan([{ id: diceSound(ev.dice.length) }])
    case 'DiceRolled': return plan([{ id: diceSound(ev.dice.length) }])
    case 'NoiseRolled': return plan([{ id: 'dice-single' }, ...(ev.zombie ? [{ id: 'zombie-growl', delayMs: 450, volume: 0.7 }] : [])])
    case 'DieBoosted': return ev.source === 'food' ? plan([{ id: 'food-bump' }]) : NONE
    case 'ExposureRolled':
      return plan([
        { id: 'dice-exposure' },
        ...(ev.face === 'wound' ? [{ id: 'wound-grunt', delayMs: 700 }] : ev.face === 'frostbite' ? [{ id: 'frostbite-shiver', delayMs: 700 }] : ev.face === 'bite' ? [{ id: 'bite-scream', delayMs: 700 }] : []),
      ])

    // ---------- wounds and deaths ----------
    case 'WoundTaken':
      if (ev.source === 'exposure') return NONE // the exposure roll already made its sound
      return plan([{ id: ev.kind === 'frostbite' ? 'frostbite-shiver' : 'wound-grunt' }])
    case 'FrostbiteTicked': return plan([{ id: 'frostbite-shiver', volume: 0.6 }])
    case 'BiteSpreadStep': return plan([{ id: 'heartbeat', volume: 0.8 }])
    case 'SurvivorKilled': return plan([{ id: 'survivor-death' }])
    case 'HelplessKilled': return plan([{ id: 'survivor-death', volume: 0.6 }])

    // ---------- movement, search, cards ----------
    case 'SurvivorMoved': return ev.kind === 'action' ? plan([{ id: 'footsteps-snow', volume: 0.7 }]) : NONE
    case 'SearchStarted': { const id = SEARCH_BY_LOCATION[ev.location]; return id ? plan([{ id }]) : NONE }
    case 'SearchDrawn': return plan([{ id: 'card-draw' }])
    case 'CardDrawn': return plan([{ id: 'card-draw' }])
    case 'CardPlayed': return ev.to === 'waste' ? plan([{ id: 'card-waste' }]) : ev.to === 'removed' ? plan([{ id: 'card-flip' }]) : NONE
    case 'CardEquipped': return plan([{ id: 'card-equip' }])
    case 'CardContributed': return plan([{ id: 'card-slide-crisis' }])
    case 'CardAddedToObjective': return plan([{ id: 'card-flip' }])
    case 'CardGiven': return plan([{ id: 'card-draw' }])
    case 'CardStolen': return plan([{ id: 'card-snatch' }])
    case 'WasteCleaned': return plan([{ id: 'clean-waste' }])
    case 'DeckShuffled': return ev.reason === 'setup' ? NONE : plan([{ id: 'card-shuffle' }])
    case 'RequestMade': return plan([{ id: 'request-knock' }])

    // ---------- the colony's defences ----------
    case 'BarricadeAdded': return plan([{ id: 'barricade' }])
    case 'BarricadeDestroyed': return plan([{ id: 'barricade-break' }])
    case 'EntranceOverrun': return plan([{ id: 'overrun-crash' }])
    case 'NoiseAdded': return ev.by === 'search' ? NONE : plan([{ id: 'attract' }])
    case 'ZombieAdded': {
      if (ev.source === 'setup') return NONE
      if (ev.location !== 'colony') return plan([{ id: 'zombie-growl', volume: 0.5 }])
      const first = memo.gateRound !== (ctx.state?.roundNumber ?? 0)
      memo.gateRound = ctx.state?.roundNumber ?? 0
      return plan([{ id: 'zombies-gate' }], first ? say('nar-gate', false) : [])
    }
    case 'ZombieKilled': return plan([{ id: 'zombie-drop' }])

    // ---------- combat ----------
    case 'AttackDeclared':
      return ev.target.kind === 'zombie' ? plan([{ id: attackerHasGun(ctx, ev.attackerId) ? 'gunshot' : 'melee-thud' }]) : NONE
    case 'SurvivorAttacked': return plan([{ id: 'attack-scuffle' }, ...(ev.hit ? [{ id: 'wound-grunt', delayMs: 450 }] : [])])

    // ---------- the colony phase ----------
    case 'FoodPaid': return NONE
    case 'Starvation': {
      const first = memo.starveRound !== (ctx.state?.roundNumber ?? 0)
      memo.starveRound = ctx.state?.roundNumber ?? 0
      return plan([{ id: 'starvation-growl' }], first ? say('nar-starve', false) : [])
    }
    case 'MoraleChanged': {
      if (ev.delta >= 0) return NONE
      const low = ev.after <= 2 && !memo.moraleLow
      if (low) memo.moraleLow = true
      return plan([{ id: 'morale-drop' }], low ? say('nar-morale-low', false) : [])
    }
    case 'CrisisRevealed': return plan([{ id: 'crisis-bell' }, { id: 'card-shuffle', delayMs: 900, volume: 0.8 }], say(ev.roundNumber % 2 === 0 ? 'nar-crisis-a' : 'nar-crisis-b', true), 'tension')
    case 'CrisisCardRevealed': return plan([{ id: 'card-flip' }])
    case 'CrisisResolved': return plan([], say(ev.prevented ? 'nar-crisis-ok' : 'nar-crisis-fail', true), 'colony')

    // ---------- votes and exile ----------
    case 'VoteCalled': return plan([], say('nar-vote-called', true), 'tension')
    case 'VotesCast':
      return plan([{ id: 'vote-tick' }, { id: 'vote-tick', delayMs: 800 }, { id: 'vote-tick', delayMs: 1600 }, { id: 'thumbs-clack', delayMs: 2200 }], say('nar-vote-count', true))
    case 'VoteResult': return ev.exiled ? NONE : plan([], say('nar-spared', true), 'colony')
    case 'SeatExiled': return plan([{ id: 'exile-door' }], say('nar-exiled', true), 'colony')

    // ---------- objectives, Crossroads, the end ----------
    case 'ObjectiveComplete': return ev.seat === null ? plan([{ id: 'objective-complete' }], say('nar-objective-complete', true)) : NONE
    case 'CrossroadsTriggered': { const id = crossroadsLine(ev.cardId); return id ? plan([{ id: 'card-flip' }], say(id, true)) : plan([{ id: 'card-flip' }]) }
    case 'GameEnded': {
      const won = viewerWon(ev.winners)
      const lines = [...(ev.objectiveComplete ? [] : say('nar-colony-falls', true)), ...say(won ? 'nar-end-win' : 'nar-end-lose', true)]
      return plan([], lines, won ? 'victory' : 'defeat')
    }
    default: return NONE
  }
}

/** Zombies standing at the colony entrances, for the moans ambience. */
export function zombiesAtColony(state: GameState | null | undefined): number {
  const colony = state?.locations['colony']
  return colony ? colony.entrances.reduce((n, e) => n + e.zombies, 0) : 0
}

/** Ambience loop levels (0..1): steady wind, a faint generator and fire, and moans that swell with the dead at the gate. */
export function ambienceLevels(state: GameState | null | undefined): Record<string, number> {
  const z = zombiesAtColony(state)
  return { 'amb-wind-loop': 0.55, 'amb-generator-loop': 0.22, 'amb-fire-loop': 0.3, 'amb-moans-loop': Math.min(1, z / 8) * 0.85 }
}
