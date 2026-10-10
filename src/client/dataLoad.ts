// The one place that turns the data files (src/data) into a DataBundle for the client, in dev and production alike.
// Async so the data (and ajv) stay out of the title chunk.
import type { DataBundle } from '../data/types'

let pending: Promise<DataBundle> | null = null

export function loadClientBundle(): Promise<DataBundle> {
  pending ??= import('./dataBundle').then((mod) => mod.buildBundle())
  return pending
}
