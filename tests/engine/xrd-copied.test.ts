// M8 IP gate: the Crossroads prose is ours. The BGG sheet is gitignored, so the real comparison runs only where it exists;
// the helper itself is always checked against a planted copy.
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SHEET, copiedRuns, loadCards } from '../../tools/check-copied-text'

describe('Crossroads text is original', () => {
  it('XRD-M8-100 the checker finds a copied run of 8 words and ignores shorter overlaps', () => {
    const source = 'The quick brown fox jumps over the lazy dog near the old river bank.'
    const cards = [{ id: 'xr.t', prose: { vignette: 'We saw the quick brown fox jumps over the lazy dog today.', trigger: 'The quick brown fox jumps over the cat.' } }]
    const hits = copiedRuns(source, cards)
    expect(hits.map((h) => h.field)).toEqual(['vignette', 'vignette'])
  })

  it.skipIf(!fs.existsSync(SHEET))('XRD-M8-101 no 8 consecutive words of any vignette, trigger or option text appear in the BGG sheet', () => {
    const cards = loadCards()
    expect(cards).toHaveLength(80)
    expect(copiedRuns(fs.readFileSync(SHEET, 'utf8'), cards)).toEqual([])
  })

  it('XRD-M8-102 every card has a vignette of 2 to 3 sentences, its own option text, and the mature marks are the ones we flagged', () => {
    const cards = loadCards()
    for (const c of cards) {
      const sentences = c.prose['vignette']!.split(/(?<=[.!?])\s+/).length
      expect(sentences, c.id).toBeGreaterThanOrEqual(2)
      expect(sentences, c.id).toBeLessThanOrEqual(3)
    }
  })
})
