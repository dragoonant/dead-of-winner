// M5 e2e: the original-look restyle. Screenshots (e2e-out/m5-*.png) of the start screen, the 3D table, the card sheet and (in play.spec) the recap,
// plus checks that the cards render their anatomy inside the real prompts and that missing art / models fall back without console errors.
import { expect, test, type Page } from '@playwright/test'

const OUT = 'e2e-out'
const URL = '?seed=e2e&seats=human,bot,bot,bot&objective=samples'

function watch(page: Page, errors: string[]): void {
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })
}

test('the start screen shows a title backdrop (the generated texture or title.webp)', async ({ page }) => {
  const errors: string[] = []
  watch(page, errors)
  await page.goto('')
  await expect(page.getByTestId('setup-start')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('start-screen')).toHaveAttribute('data-title-art', /asset|generated/)
  await page.waitForTimeout(500) // fonts and the backdrop
  await page.screenshot({ path: `${OUT}/m5-start.png` })
  expect(errors, errors.join('\n')).toEqual([])
})

test('the table: survivor cards in the prompt, the textured board, the item cards in the hand', async ({ page }) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  watch(page, errors)
  await page.addInitScript(() => { try { localStorage.setItem('dow.settings', JSON.stringify({ speed: 8 })) } catch { /* private mode */ } })
  await page.goto(URL)
  await expect(page.getByTestId('game-screen')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 })
  const dock = page.getByTestId('prompt-dock')
  await expect(dock).toBeVisible({ timeout: 30_000 })

  // pick survivors from SurvivorCards, then a leader
  await expect(dock).toHaveAttribute('data-kind', 'chooseSurvivors')
  const cards = dock.locator('.portrait .dcard[data-card="survivor"]')
  expect(await cards.count()).toBeGreaterThanOrEqual(2)
  await expect(dock.locator('.portrait .sv-inf').first()).toBeVisible()
  await expect(dock.locator('.portrait .sv-ab').first()).toBeVisible()
  await dock.locator('.portrait').nth(0).click()
  await dock.locator('.portrait').nth(1).click()
  await dock.getByTestId('prompt-confirm').click()
  for (let i = 0; i < 60; i++) {
    const kind = await dock.getAttribute('data-kind').catch(() => null)
    if (kind === 'turnAction') break
    if (kind === 'chooseLeader') { await dock.locator('.portrait').first().click(); await dock.getByText('Confirm leader').click() }
    await page.waitForTimeout(250)
  }
  await expect(dock).toHaveAttribute('data-kind', 'turnAction', { timeout: 30_000 })

  // the hand is a fan of ItemCards
  const hand = page.getByTestId('hand-fan').locator('.dcard[data-card="item"]')
  expect(await hand.count()).toBeGreaterThan(0)
  await expect(page.getByTestId('hand-fan').locator('.it-banner .nm').first()).toBeVisible()

  // the table itself, with the HUD panels hidden so the board is visible
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${OUT}/m5-turn-ui.png` })
  await page.addStyleTag({ content: '.dock,.rail,.tray,.topbar{visibility:hidden !important}' })
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/m5-table.png` })
  expect(errors, errors.join('\n')).toEqual([])
})

test('the card sheet lists every card type', async ({ page }) => {
  const errors: string[] = []
  watch(page, errors)
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto('?cards')
  const sheet = page.getByTestId('card-sheet')
  await expect(sheet.locator('.dcard[data-card="survivor"]').first()).toBeVisible({ timeout: 30_000 })
  for (const kind of ['survivor', 'item', 'crisis', 'main-objective', 'secret-objective', 'betrayal', 'exiled', 'crossroads']) {
    await expect(sheet.locator(`.dcard[data-card="${kind}"]`).first(), kind).toBeAttached()
  }
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}/m5-cards.png` })
  expect(errors, errors.join('\n')).toEqual([])
})

test('the ?gallery view lists every figure (procedural where no model is listed)', async ({ page }) => {
  const errors: string[] = []
  watch(page, errors)
  await page.goto('?gallery')
  const g = page.getByTestId('figure-gallery')
  await expect(g).toBeVisible({ timeout: 30_000 })
  await expect.poll(async () => Number(await g.getAttribute('data-count')), { timeout: 30_000 }).toBeGreaterThan(30)
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/m5-gallery.png` })
  expect(errors, errors.join('\n')).toEqual([])
})

test('a listed GLB swaps in for a survivor and for zombies, and a broken one falls back to procedural', async ({ page }) => {
  const errors: string[] = []
  watch(page, errors)
  // a one-triangle-per-face box GLB, built in the test, served as three listed models (two good, one corrupt)
  const glb = boxGlb()
  await page.route('**/assets/models/manifest.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ slugs: ['talia-jones', 'zombie-test', 'broken'] }) }))
  await page.route('**/assets/models/talia-jones.glb', (r) => r.fulfill({ contentType: 'model/gltf-binary', body: glb }))
  await page.route('**/assets/models/zombie-test.glb', (r) => r.fulfill({ contentType: 'model/gltf-binary', body: glb }))
  await page.route('**/assets/models/broken.glb', (r) => r.fulfill({ contentType: 'model/gltf-binary', body: Buffer.from('not a glb') }))
  await page.goto('?gallery')
  const g = page.getByTestId('figure-gallery')
  await expect(g).toBeVisible({ timeout: 30_000 })
  await expect.poll(async () => Number(await g.getAttribute('data-glb')), { timeout: 15_000 }).toBe(3)
  await expect.poll(async () => Number(await g.getAttribute('data-count')), { timeout: 30_000 }).toBeGreaterThan(31)
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${OUT}/m5-gallery-glb.png` })
  // the corrupt file is the only error the loader may surface; it must not throw
  expect(errors.filter((e) => e.startsWith('pageerror')), errors.join('\n')).toEqual([])
})

/** A minimal valid GLB: one 1 x 2 x 1 box with a plain material. */
function boxGlb(): Buffer {
  const hx = 0.5, hy = 1, hz = 0.5
  const faces: [number[], number[]][] = [
    [[0, 0, 1], [-hx, -hy, hz, hx, -hy, hz, hx, hy, hz, -hx, hy, hz]], [[0, 0, -1], [hx, -hy, -hz, -hx, -hy, -hz, -hx, hy, -hz, hx, hy, -hz]],
    [[1, 0, 0], [hx, -hy, hz, hx, -hy, -hz, hx, hy, -hz, hx, hy, hz]], [[-1, 0, 0], [-hx, -hy, -hz, -hx, -hy, hz, -hx, hy, hz, -hx, hy, -hz]],
    [[0, 1, 0], [-hx, hy, hz, hx, hy, hz, hx, hy, -hz, -hx, hy, -hz]], [[0, -1, 0], [-hx, -hy, -hz, hx, -hy, -hz, hx, -hy, hz, -hx, -hy, hz]],
  ]
  const pos: number[] = [], nor: number[] = [], idx: number[] = []
  faces.forEach(([n, v], f) => { pos.push(...v); for (let i = 0; i < 4; i++) nor.push(...n); const b = f * 4; idx.push(b, b + 1, b + 2, b, b + 2, b + 3) })
  const posB = Buffer.from(new Float32Array(pos).buffer), norB = Buffer.from(new Float32Array(nor).buffer), idxB = Buffer.from(new Uint16Array(idx).buffer)
  const bin = Buffer.concat([posB, norB, idxB])
  const json = {
    asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }] }],
    materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.7, 0.75, 0.6, 1], metallicFactor: 0, roughnessFactor: 0.8 } }],
    buffers: [{ byteLength: bin.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: posB.length }, { buffer: 0, byteOffset: posB.length, byteLength: norB.length }, { buffer: 0, byteOffset: posB.length + norB.length, byteLength: idxB.length }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 24, type: 'VEC3', min: [-hx, -hy, -hz], max: [hx, hy, hz] },
      { bufferView: 1, componentType: 5126, count: 24, type: 'VEC3' },
      { bufferView: 2, componentType: 5123, count: 36, type: 'SCALAR' },
    ],
  }
  let jsonB = Buffer.from(JSON.stringify(json))
  jsonB = Buffer.concat([jsonB, Buffer.alloc((4 - (jsonB.length % 4)) % 4, 0x20)])
  const binB = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)])
  const head = Buffer.alloc(12)
  head.write('glTF', 0, 'ascii'); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + jsonB.length + 8 + binB.length, 8)
  const jh = Buffer.alloc(8); jh.writeUInt32LE(jsonB.length, 0); jh.write('JSON', 4, 'ascii')
  const bh = Buffer.alloc(8); bh.writeUInt32LE(binB.length, 0); bh.write('BIN\0', 4, 'ascii')
  return Buffer.concat([head, jh, jsonB, bh, binB])
}
