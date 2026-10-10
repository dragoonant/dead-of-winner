// Loads the fixture bundle (tests/fixtures/bundle/**) for engine, AI and client tests. Node only (reads the folder tree).
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadBundle } from '../../src/data/index'
import type { DataBundle, RawBundle } from '../../src/data/types'
import { assembleBundleFromDir } from '../../tools/validate-data'

export const FIXTURE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'bundle')

/** The unvalidated RawBundle assembled from the folder tree (tests mutate copies of it to prove the validator rejects bad data). */
export function loadFixtureRaw(): RawBundle {
  return assembleBundleFromDir(FIXTURE_DIR).raw
}

let cached: DataBundle | undefined
/** Validated, hashed DataBundle of the fixture (cached; treat as read-only). */
export function loadFixtureBundle(): DataBundle {
  return (cached ??= loadBundle(loadFixtureRaw()))
}
