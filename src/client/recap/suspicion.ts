// The AI's suspicion log, when it offers one: an optional export of src/ai (`suspicionTrajectory(seed?)` returning, for each observer seat, a list of
// { round, scores: { seat: 0..1 } } points). Nothing in src/ai provides it yet; when it does the recap shows it, until then this resolves to null
// and the recap skips the section.
import { parseSuspicion, type SuspicionTrajectory } from './story'

export async function loadSuspicion(seed?: string): Promise<SuspicionTrajectory | null> {
  try {
    const mod = (await import('../../ai/index')) as unknown as Record<string, unknown>
    const fn = mod['suspicionTrajectory'] ?? mod['getSuspicionTrajectory']
    if (typeof fn !== 'function') return null
    return parseSuspicion((fn as (s?: string) => unknown)(seed))
  } catch { return null }
}
