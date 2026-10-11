// The card components render the anatomy of each printed card from the data, and the asset helpers fall back instead of failing.
// Components are rendered to static HTML in node (no DOM): the text they print is what the tests read.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeAll, describe, expect, it } from 'vitest'
import { loadDefaultBundle } from '../../tools/default-bundle'
import { CrisisCard } from '../../src/client/cards/CrisisCard'
import { CrossroadsCard } from '../../src/client/cards/CrossroadsCard'
import { ItemCard } from '../../src/client/cards/ItemCard'
import { BetrayalCard, ExiledCard, MainObjectiveCard, SecretObjectiveCard } from '../../src/client/cards/ObjectiveCards'
import { SurvivorCard } from '../../src/client/cards/SurvivorCard'
import { hash01, portraitCandidates, locationCandidates, slugOf } from '../../src/client/cards/art'
import { crisisInfo, itemDeck, setClientBundle, survivorAbilityKeyword } from '../../src/client/data'

const html = (el: Parameters<typeof renderToStaticMarkup>[0]): string => renderToStaticMarkup(el)
const text = (s: string): string => s.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ')

beforeAll(() => { setClientBundle(loadDefaultBundle()) })

describe('card faces', () => {
  it('SurvivorCard prints the name plate with the occupation, influence, attack and search, and the ability opening with its location keyword', () => {
    const h = html(createElement(SurvivorCard, { id: 'sv.alexis-grey' }))
    const t = text(h)
    expect(t).toContain('Alexis Grey')
    expect(t).toContain('Librarian')
    expect(h).toMatch(/class="sv-inf"[^>]*><b>46<\/b>/)
    expect(t).toContain('5+')
    expect(t).toContain('4+')
    expect(t).toContain('Library:')
    expect(h).toContain('data-card="survivor"')
    expect(survivorAbilityKeyword('sv.alexis-grey')).toBe('Library')
  })

  it('every survivor renders without a portrait file (a silhouette stands in)', () => {
    const b = loadDefaultBundle()
    for (const s of b.records.survivors) {
      const h = html(createElement(SurvivorCard, { id: s.id }))
      expect(h, s.id).toContain('class="sil"')
      expect(text(h)).toContain(s.name)
    }
  })

  it('ItemCard prints the name, class keyword, ability and the deck number with its location', () => {
    const h = html(createElement(ItemCard, { defId: 'it.survivors-cookbook' }))
    const t = text(h)
    expect(t).toContain("Survivor's Cookbook")
    expect(t).toContain('Equip:')
    expect(t).toContain('04')
    expect(t).toContain('Library')
    expect(itemDeck('it.survivors-cookbook')).toEqual({ number: 4, name: 'Library' })
    expect(text(html(createElement(ItemCard, { defId: 'it.medicine' })))).toContain('One use:')
  })

  it('CrisisCard prints the prevent line, FAIL and Optional text', () => {
    const t = text(html(createElement(CrisisCard, { id: 'cr.blizzard' })))
    expect(t).toContain('Blizzard')
    expect(t).toContain('= number of non-exiled players')
    expect(t).toContain('Fail:')
    expect(t).toContain('Optional:')
    expect(crisisInfo('cr.blizzard')?.prevent).toEqual(['fuel'])
  })

  it('the main objective shows SET UP, VICTORY and TIME; secret, betrayal and exiled cards carry their marks', () => {
    const main = text(html(createElement(MainObjectiveCard, { id: 'obj.main.home-sweet-home' })))
    expect(main).toContain('Home Sweet Home')
    for (const w of ['Set up', 'Victory', 'Time', 'Medium']) expect(main).toContain(w)
    const b = loadDefaultBundle()
    const secret = b.records.secretObjectives.find((o) => o.type === 'secret')!
    const betrayal = b.records.secretObjectives.find((o) => o.type === 'betrayal')!
    const exiled = b.records.secretObjectives.find((o) => o.type === 'exiled')!
    expect(html(createElement(SecretObjectiveCard, { id: secret.id }))).toContain('note-clip')
    expect(html(createElement(SecretObjectiveCard, { id: secret.id }))).not.toContain('class="stamp"')
    expect(text(html(createElement(BetrayalCard, { id: betrayal.id })))).toContain('Betrayal!')
    expect(text(html(createElement(ExiledCard, { id: exiled.id })))).toContain('Exiled')
  })

  it('CrossroadsCard prints the title, the italic trigger, the story and two options', () => {
    const h = html(createElement(CrossroadsCard, { id: 'xr.heads-up' }))
    const t = text(h)
    expect(t).toContain('Heads Up')
    expect(t).toContain('A survivor finishes a search at the Police Station.')
    expect(t).toContain('Option 1')
    expect(t).toContain('Option 2')
    expect(h).toContain('class="trig"')
  })
})

describe('art helpers', () => {
  it('portrait and location art are looked up by id and by slug, never as a hard dependency', () => {
    expect(slugOf('sv.alexis-grey')).toBe('alexis-grey')
    expect(portraitCandidates('sv.alexis-grey').map((u) => u.replace(/^.*assets\//, ''))).toEqual(['portraits/alexis-grey.webp', 'portraits/sv.alexis-grey.webp'])
    expect(locationCandidates('loc.library').map((u) => u.replace(/^.*assets\//, ''))).toEqual(['locations/library.webp', 'locations/loc.library.webp'])
    expect(hash01('x')).toBe(hash01('x'))
    expect(hash01('x')).toBeGreaterThanOrEqual(0)
    expect(hash01('x')).toBeLessThan(1)
  })
})
