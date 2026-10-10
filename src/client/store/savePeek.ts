// Reads the autosave header without loading the engine, so the title screen can offer Continue while staying light.
import { readJson } from './storage'

export const AUTOSAVE_KEY = 'dow.save.auto'
export interface SavePeek { round: number; savedAt: string; seats: number }

export function peekAutosave(): SavePeek | null {
  const d = readJson<{ kind?: string; round?: number; file?: { meta?: { savedAt?: string }; setup?: { seats?: unknown[] }; actions?: unknown[] } }>(AUTOSAVE_KEY)
  if (!d || d.kind !== 'dow-save' || !d.file) return null
  return { round: d.round ?? 0, savedAt: d.file.meta?.savedAt ?? '', seats: d.file.setup?.seats?.length ?? 0 }
}
