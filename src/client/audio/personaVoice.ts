// Persona voice lines: the bots' table talk is spoken in each persona's own voice, in step with the speech bubble.
// A bubble's text is a bank line with its {slots} filled; the recording reads the same line with the slots spoken generically
// ("that one", "friend", "one of ours"), because the voice cannot know a seat's name. Lines are matched back to their recording by
// the bank text, so editing a bank only un-voices the edited lines; it never plays the wrong clip.
import { AUDIO_ASSETS } from './manifest'
import { audio } from './audio'

interface Entry { id: string; re: RegExp }
let index: Map<string, Entry[]> | null = null

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function build(): Map<string, Entry[]> {
  const m = new Map<string, Entry[]>()
  for (const a of AUDIO_ASSETS) {
    if (a.kind !== 'voice' || !a.persona || !a.key || !a.template) continue
    const re = new RegExp(`^${escapeRe(a.template).replace(/\\\{\w+\\\}/g, '.+?')}$`)
    const k = `${a.persona}|${a.key}`
    m.set(k, [...(m.get(k) ?? []), { id: a.id, re }])
  }
  return m
}

/** The recording for a persona's line, or null when that line has none. `persona` may be "ps.hardcase" or "hardcase". */
export function personaLineId(persona: string | undefined, key: string, text: string): string | null {
  if (!persona) return null
  index ??= build()
  const entries = index.get(`${persona.replace(/^ps\./, '')}|${key}`)
  return entries?.find((e) => e.re.test(text))?.id ?? null
}

/** Speak a bubble's line in its persona's voice (dropped when anyone else is already speaking). */
export function speakPersonaLine(persona: string | undefined, key: string, text: string): void {
  try {
    const id = personaLineId(persona, key, text)
    if (id && audio.canSpeak('voices')) audio.speak(id)
  } catch { /* never let sound break the game */ }
}
