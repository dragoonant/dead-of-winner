// The data-bundle registry behind index.ts `registerBundle` / `bundleFor` (00 §2). A leaf module so the rules modules
// (effects, exposure, crisis, objectives) can read records without importing index.ts, which imports them: no runtime cycle.
// step(state, action) takes no bundle (frozen signature), so the engine keeps every bundle it has seen, keyed by version.
import type { DataBundle } from './types'
import { EngineInvariantError } from './types'
import { registerDataBundle } from './decks'

const BUNDLES = new Map<string, DataBundle>()

/** Make a bundle available to step()/validate()/legalActions()/query for states and views built from it. */
export function registerBundle(bundle: DataBundle): void {
  BUNDLES.set(bundle.version, bundle)
  registerDataBundle(bundle) // the setup modules keep their own registry (decks.ts); keep both in step
}

export function bundleFor(stateOrView: { dataVersion: string }): DataBundle {
  const hit = BUNDLES.get(stateOrView.dataVersion)
  if (!hit) throw new EngineInvariantError(`no data bundle registered for version ${stateOrView.dataVersion}`)
  return hit
}
