// The default content bundle: src/data (survivors, items, decks, locations, crises, Crossroads, objectives), assembled from the folder
// tree and validated by loadBundle. Node only. The engine, tools/sim.ts and the data tests use this; unit tests that need tiny
// hand-made cards keep using tests/fixtures/bundle.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadBundle } from '../src/data/index'
import type { DataBundle, RawBundle } from '../src/data/types'
import { assembleBundleFromDir } from './validate-data'

export const DEFAULT_DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data')

export function loadDefaultRaw(): RawBundle {
  return assembleBundleFromDir(DEFAULT_DATA_DIR).raw
}

let cached: DataBundle | undefined
/** Validated, hashed DataBundle of src/data (cached; treat as read-only). */
export function loadDefaultBundle(): DataBundle {
  return (cached ??= loadBundle(loadDefaultRaw()))
}
