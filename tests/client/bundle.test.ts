// The browser bundle (src/client/dataBundle.ts assembleRaw) must equal the node loader's bundle (tools/default-bundle.ts).
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadBundle } from '../../src/data/index'
import { DEFAULT_DATA_DIR, loadDefaultBundle } from '../../tools/default-bundle'
import { assembleRaw } from '../../src/client/dataBundle'

function readTree(dir: string): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name)
      if (e.isDirectory()) walk(full)
      else if (e.name.endsWith('.json')) out['../data/' + path.relative(dir, full).split(path.sep).join('/')] = JSON.parse(fs.readFileSync(full, 'utf8'))
    }
  }
  walk(dir)
  return out
}

describe('client data bundle', () => {
  it('matches the node loader (same records, same hash)', () => {
    const client = loadBundle(assembleRaw(readTree(DEFAULT_DATA_DIR)))
    const node = loadDefaultBundle()
    expect(client.hash).toBe(node.hash)
    expect(Object.keys(client.byId).sort()).toEqual(Object.keys(node.byId).sort())
  })
})
