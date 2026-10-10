// Applies the PUBLIC, visible part of an event to a presented state (50 §4): enough that the top bar, tracks, zombies, noise and
// survivor positions move with their beat. The director snaps to the engine's true state at the end of every batch, so anything this
// reducer does not cover is shown one beat late at worst, never wrong at rest.
import type { GameEvent, GameState, LocationId, LocationState } from '../../engine/index'

function withLoc(s: GameState, id: LocationId, f: (l: LocationState) => LocationState): GameState {
  const l = s.locations[id]
  return l ? { ...s, locations: { ...s.locations, [id]: f(l) } } : s
}
const withEntrance = (s: GameState, id: LocationId, index: number, f: (e: LocationState['entrances'][number]) => LocationState['entrances'][number]): GameState =>
  withLoc(s, id, (l) => ({ ...l, entrances: l.entrances.map((e) => (e.index === index ? f(e) : e)) }))

export function applyEvent(s: GameState, ev: GameEvent): GameState {
  switch (ev.type) {
    case 'PhaseChanged': return { ...s, phase: ev.phase, colonyStep: ev.step ?? null }
    case 'RoundStarted': return { ...s, roundNumber: ev.roundNumber, roundsLeft: ev.roundsLeft }
    case 'RoundTicked': return { ...s, roundsLeft: ev.roundsLeft }
    case 'TurnStarted': return { ...s, activeSeat: ev.seat, turnCount: ev.turnCount, roundNumber: ev.roundNumber }
    case 'FirstSeatPassed': return { ...s, firstSeat: ev.to }
    case 'MoraleChanged': return { ...s, morale: ev.after }
    case 'FoodPaid': return { ...s, food: ev.foodAfter }
    case 'FoodChanged': return { ...s, food: ev.after }
    case 'Starvation': return { ...s, starvation: ev.starvationAfter }
    case 'ZombieAdded': return withEntrance(s, ev.location, ev.entrance, (e) => ({ ...e, zombies: ev.zombies }))
    case 'ZombieKilled': return withEntrance(s, ev.location, ev.entrance, (e) => ({ ...e, zombies: ev.zombies }))
    case 'BarricadeAdded': return withEntrance(s, ev.location, ev.entrance, (e) => ({ ...e, barricades: ev.barricades }))
    case 'BarricadeDestroyed': return withEntrance(s, ev.location, ev.entrance, (e) => ({ ...e, barricades: ev.barricades }))
    case 'NoiseAdded': return withLoc(s, ev.location, (l) => ({ ...l, noise: ev.after }))
    case 'NoiseCleared': return withLoc(s, ev.location, (l) => ({ ...l, noise: Math.max(0, l.noise - ev.count) }))
    case 'HelplessAdded': return withLoc(s, ev.location, (l) => ({ ...l, helpless: ev.after }))
    case 'HelplessKilled': return withLoc(s, ev.location, (l) => ({ ...l, helpless: ev.after }))
    case 'SurvivorMoved': {
      const sv = s.survivors[ev.survivorId]
      return sv ? { ...s, survivors: { ...s.survivors, [ev.survivorId]: { ...sv, location: ev.to } } } : s
    }
    case 'WoundTaken': {
      const sv = s.survivors[ev.survivorId]
      return sv ? { ...s, survivors: { ...s.survivors, [ev.survivorId]: { ...sv, wounds: ev.wounds, frostbite: ev.frostbite } } } : s
    }
    case 'SurvivorKilled': {
      const sv = s.survivors[ev.survivorId]
      return sv ? { ...s, survivors: { ...s.survivors, [ev.survivorId]: { ...sv, status: 'dead', owner: null } } } : s
    }
    default: return s
  }
}
