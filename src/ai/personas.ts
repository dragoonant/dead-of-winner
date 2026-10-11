// The six personas (41 §1): scalars that tilt the heuristics and the line banks the table talk draws from.
// The same JSON files are records in the data bundle (src/data/personas); the AI imports them directly so a decider needs no bundle.
import doctor from '../data/personas/doctor.json'
import drifter from '../data/personas/drifter.json'
import hardcase from '../data/personas/hardcase.json'
import kid from '../data/personas/kid.json'
import optimist from '../data/personas/optimist.json'
import quartermaster from '../data/personas/quartermaster.json'

export interface PersonaScalars {
  generosity: number; risk: number; paranoia: number; trust: number; chattiness: number; bluffing: number; voteThreshold: number; callThreshold: number
}
export interface PersonaLine { text: string; voiced?: boolean }
export interface Persona { id: string; name: string; blurb: string; scalars: PersonaScalars; lines: Record<string, PersonaLine[]> }

/** Sheet order (41 §1): the table hands out distinct personas in this order. */
export const PERSONAS: Persona[] = [quartermaster, optimist, hardcase, kid, doctor, drifter] as unknown as Persona[]
export const PERSONA_IDS: string[] = PERSONAS.map((p) => p.id)
export const DEFAULT_SCALARS: PersonaScalars = { generosity: 0.5, risk: 0.5, paranoia: 1, trust: 0.6, chattiness: 0.5, bluffing: 0.15, voteThreshold: 0.65, callThreshold: 0.78 }

/** Resolve "ps.optimist" or "optimist"; undefined for anything unknown. */
export function getPersona(id: string | undefined): Persona | undefined {
  if (!id) return undefined
  const full = id.startsWith('ps.') ? id : `ps.${id}`
  return PERSONAS.find((p) => p.id === full)
}
export function personaFor(index: number): Persona { return PERSONAS[((index % PERSONAS.length) + PERSONAS.length) % PERSONAS.length]! }

/** Easy plays its persona at half strength (40 §12): every scalar moves halfway to the neutral default. */
export function blendScalars(s: PersonaScalars, strength: number): PersonaScalars {
  if (strength >= 1) return s
  const mix = (a: number, d: number): number => d + (a - d) * strength
  const d = DEFAULT_SCALARS
  return {
    generosity: mix(s.generosity, d.generosity), risk: mix(s.risk, d.risk), paranoia: mix(s.paranoia, d.paranoia), trust: mix(s.trust, d.trust),
    chattiness: s.chattiness, bluffing: mix(s.bluffing, d.bluffing), voteThreshold: mix(s.voteThreshold, d.voteThreshold), callThreshold: mix(s.callThreshold, d.callThreshold),
  }
}
