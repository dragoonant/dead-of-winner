// Engine events -> timed beats (50 §4). Durations are the normal-speed milliseconds from the spec table; the director scales them.
// Pure and clock-free so it can be unit tested.
import type { GameEvent, GameEventType } from '../../engine/index'
import type { Names } from './feed'

export interface SeqEvent { seq: number; event: GameEvent }
export type BeatKind = 'banner' | 'roll' | 'move' | 'exposure' | 'card' | 'zombie' | 'tick' | 'vote' | 'crisisCard' | 'instant'
export type BannerKind = 'turn' | 'round' | 'phase' | 'crisis' | 'result' | 'game'
export interface Beat { kind: BeatKind; baseMs: number; events: SeqEvent[]; banner?: { text: string; kind: BannerKind } }

interface Spec { kind: BeatKind; ms: number }
/** Normal-speed duration per event type; types missing here take no time. */
export const BEAT_SPEC: Partial<Record<GameEventType, Spec>> = {
  TurnStarted: { kind: 'banner', ms: 800 }, RoundStarted: { kind: 'banner', ms: 800 }, PhaseChanged: { kind: 'banner', ms: 800 },
  ActionDiceRolled: { kind: 'roll', ms: 700 }, DiceRolled: { kind: 'roll', ms: 700 }, NoiseRolled: { kind: 'roll', ms: 700 }, SurvivorAttacked: { kind: 'roll', ms: 700 },
  SurvivorMoved: { kind: 'move', ms: 500 },
  ExposureRolled: { kind: 'exposure', ms: 900 }, WoundTaken: { kind: 'exposure', ms: 300 }, SurvivorKilled: { kind: 'exposure', ms: 600 },
  SearchDrawn: { kind: 'card', ms: 400 }, SearchKept: { kind: 'card', ms: 400 }, NoiseAdded: { kind: 'card', ms: 400 }, CardContributed: { kind: 'card', ms: 400 },
  CrisisRevealed: { kind: 'banner', ms: 1200 }, CrisisCardRevealed: { kind: 'crisisCard', ms: 500 }, CrisisResolved: { kind: 'banner', ms: 1000 },
  ZombieAdded: { kind: 'zombie', ms: 250 }, BarricadeDestroyed: { kind: 'zombie', ms: 250 }, EntranceOverrun: { kind: 'zombie', ms: 250 },
  FoodPaid: { kind: 'tick', ms: 400 }, Starvation: { kind: 'tick', ms: 400 }, WasteChecked: { kind: 'tick', ms: 400 }, MoraleChanged: { kind: 'tick', ms: 400 },
  RoundTicked: { kind: 'tick', ms: 400 }, FirstSeatPassed: { kind: 'tick', ms: 400 },
  VoteCalled: { kind: 'vote', ms: 1500 }, VotesCast: { kind: 'vote', ms: 900 }, VoteResult: { kind: 'vote', ms: 800 }, SeatExiled: { kind: 'vote', ms: 800 },
  CrossroadsTriggered: { kind: 'banner', ms: 800 }, CrossroadsResolved: { kind: 'banner', ms: 800 },
  GameEnded: { kind: 'banner', ms: 600 },
}

function bannerFor(ev: GameEvent, N: Names): Beat['banner'] | undefined {
  switch (ev.type) {
    case 'TurnStarted': return { text: `${N.seat(ev.seat)}: turn ${ev.turnCount}`, kind: 'turn' }
    case 'RoundStarted': return { text: `Round ${ev.roundNumber}`, kind: 'round' }
    case 'PhaseChanged': return ev.phase === 'colony' && (!ev.step || ev.step === 'payFood') ? { text: 'Colony phase', kind: 'phase' } : undefined
    case 'CrisisRevealed': return { text: `Crisis: ${N.crisis(ev.cardId)}`, kind: 'crisis' }
    case 'CrisisResolved': return { text: ev.prevented ? 'Crisis prevented' : 'Crisis not prevented', kind: 'result' }
    case 'CrossroadsTriggered': return { text: 'Crossroads', kind: 'phase' }
    case 'CrossroadsResolved': return { text: 'Crossroads resolved', kind: 'phase' }
    case 'GameEnded': return { text: 'Game over', kind: 'game' }
    default: return undefined
  }
}

/** One beat per timed event; runs of untimed events collapse into a single zero-length beat so a long step does not spawn hundreds. */
export function buildBeats(events: readonly SeqEvent[], N: Names): Beat[] {
  const beats: Beat[] = []
  for (const se of events) {
    const spec = se.event.type === 'PhaseChanged' && !(se.event.phase === 'colony' && (!se.event.step || se.event.step === 'payFood')) ? undefined : BEAT_SPEC[se.event.type]
    if (!spec) {
      const last = beats[beats.length - 1]
      if (last && last.baseMs === 0 && !last.banner) last.events.push(se)
      else beats.push({ kind: 'instant', baseMs: 0, events: [se] })
      continue
    }
    const banner = bannerFor(se.event, N)
    beats.push({ kind: spec.kind, baseMs: spec.ms, events: [se], ...(banner ? { banner } : {}) })
  }
  return beats
}

/** Total normal-speed milliseconds of a batch (diagnostics and tests). */
export function totalMs(beats: readonly Beat[]): number { return beats.reduce((a, b) => a + b.baseMs, 0) }
