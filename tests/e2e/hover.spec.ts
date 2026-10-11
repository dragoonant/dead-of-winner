// Card hover: the hand fan must not jitter (the hover target is a fixed slot, only the inner card animates), and the shared CardPreview must show
// a survivor's full ability text at the survivor prompt. Screenshots: e2e-out/hover-hand.png, e2e-out/hover-survivor.png.
import { expect, test, type Locator, type Page } from '@playwright/test'

const OUT = 'e2e-out'
const URL = '?seed=e2e&seats=human,bot,bot,bot&objective=samples'

function watch(page: Page, errors: string[]): void {
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })
}

async function open(page: Page): Promise<Locator> {
  await page.addInitScript(() => { try { localStorage.setItem('dow.settings', JSON.stringify({ speed: 8 })) } catch { /* private mode */ } })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto(URL)
  await expect(page.getByTestId('game-screen')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 })
  const dock = page.getByTestId('prompt-dock')
  await expect(dock).toBeVisible({ timeout: 30_000 })
  await expect(dock).toHaveAttribute('data-kind', 'chooseSurvivors')
  return dock
}

test('hovering a survivor in the choose prompt previews the full card with its whole ability text', async ({ page }) => {
  const errors: string[] = []
  watch(page, errors)
  const dock = await open(page)
  const portrait = dock.locator('.portrait').first()
  const small = portrait.locator('.dcard[data-card="survivor"]')
  const id = await small.getAttribute('data-id')
  const smallAbility = (await small.locator('.sv-ab').innerText()).replace(/\s+/g, ' ').trim()
  expect(smallAbility.length).toBeGreaterThan(10)
  const smallBox = (await small.boundingBox())!

  await expect(page.getByTestId('card-preview')).toHaveCount(0)
  await portrait.hover()
  const preview = page.getByTestId('card-preview')
  await expect(preview).toBeVisible()
  await expect(preview).toHaveAttribute('data-preview-kind', 'survivor')
  const card = preview.locator('.dcard[data-card="survivor"]')
  await expect(card).toHaveAttribute('data-id', id!)
  // the whole ability text, on a card that is bigger than the prompt's thumbnail and fully on screen
  const ability = preview.locator('.sv-ab')
  expect((await ability.innerText()).replace(/\s+/g, ' ').trim()).toBe(smallAbility)
  const big = (await card.boundingBox())!
  expect(big.width).toBeGreaterThan(smallBox.width * 1.5)
  const ab = (await ability.boundingBox())!
  expect(ab.y + ab.height).toBeLessThanOrEqual(big.y + big.height + 1)
  expect(big.x).toBeGreaterThanOrEqual(0)
  expect(big.y).toBeGreaterThanOrEqual(0)
  expect(big.x + big.width).toBeLessThanOrEqual(1280)
  expect(big.y + big.height).toBeLessThanOrEqual(760)
  // it never takes the pointer: the portrait under the cursor is still the hover target
  expect(await portrait.evaluate((el) => el.matches(':hover'))).toBe(true)
  await page.waitForTimeout(250)
  await page.screenshot({ path: `${OUT}/hover-survivor.png` })

  // moving off closes it
  await page.mouse.move(5, 300)
  await expect(preview).toHaveCount(0)
  expect(errors, errors.join('\n')).toEqual([])
})

test('the hand fan does not jitter while a card is hovered', async ({ page }) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  watch(page, errors)
  const dock = await open(page)
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

  const fan = page.getByTestId('hand-fan')
  const slot = fan.locator('.fan-slot').first()
  await expect(slot).toBeVisible()
  const inner = slot.locator('.fan-card')
  const restBox = (await inner.boundingBox())!
  const slotBefore = (await slot.boundingBox())!

  // sample the animating card five times over a second: it must hold still, not pop up and drop back
  const sample = async (): Promise<{ x: number; y: number; width: number; height: number }[]> => {
    const out: { x: number; y: number; width: number; height: number }[] = []
    for (let i = 0; i < 5; i++) { out.push((await inner.boundingBox())!); if (i < 4) await page.waitForTimeout(250) }
    return out
  }
  const steady = (xs: { x: number; y: number; width: number; height: number }[]): void => {
    for (const k of ['x', 'y', 'width', 'height'] as const) {
      const vals = xs.map((b) => b[k])
      expect(Math.max(...vals) - Math.min(...vals), `${k}: ${vals.join(', ')}`).toBeLessThanOrEqual(0.5)
    }
  }

  // the cursor positions that used to loop: the middle, the bottom edge, the very top of the slot, the seam to the next card
  const spots: [string, number, number][] = [
    ['centre', slotBefore.x + slotBefore.width / 2, slotBefore.y + slotBefore.height / 2],
    ['bottom edge', slotBefore.x + slotBefore.width / 2, slotBefore.y + slotBefore.height - 1],
    ['top of the slot', slotBefore.x + slotBefore.width / 2, slotBefore.y + 1],
    ['seam with the next card', slotBefore.x + slotBefore.width - 1, slotBefore.y + slotBefore.height / 2],
  ]
  let lifted = restBox
  for (const [name, x, y] of spots) {
    await page.mouse.move(x, y)
    await page.waitForTimeout(450) // the 0.14 s transition has finished
    const xs = await sample()
    steady(xs)
    if (name === 'centre') {
      lifted = xs[0]!
      expect(lifted.y, 'the hovered card is raised').toBeLessThan(restBox.y - 20)
      await expect(page.getByTestId('card-preview')).toBeVisible()
      await expect(page.getByTestId('card-preview')).toHaveAttribute('data-preview-kind', 'item')
      await page.screenshot({ path: `${OUT}/hover-hand.png` })
    }
    // the hit area itself never moves
    const now = (await slot.boundingBox())!
    expect(Math.abs(now.x - slotBefore.x) + Math.abs(now.y - slotBefore.y) + Math.abs(now.width - slotBefore.width) + Math.abs(now.height - slotBefore.height), name).toBeLessThanOrEqual(0.5)
  }

  // sweep across the hand and back: a hover that flickers would change the raised card between two reads of the same spot
  const seq: string[] = []
  const total = (await fan.locator('.fan-slot').count())
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < total; i++) {
      const b = (await fan.locator('.fan-slot').nth(i).boundingBox())!
      await page.mouse.move(b.x + b.width / 2, b.y + b.height - 10, { steps: 4 })
      await page.waitForTimeout(220)
      const up = await fan.locator('.fan-slot').evaluateAll((els) => els.map((e) => e.matches(':hover')))
      expect(up.filter(Boolean).length, `one slot hovered at ${i}`).toBe(1)
      expect(up[i], `slot ${i} is the hovered one`).toBe(true)
      seq.push(`${pass}:${i}`)
    }
  }
  expect(seq.length).toBe(total * 2)

  // leaving drops the card back and closes the preview
  await page.mouse.move(640, 60)
  await expect(page.getByTestId('card-preview')).toHaveCount(0)
  await page.waitForTimeout(400)
  const rest2 = (await inner.boundingBox())!
  expect(Math.abs(rest2.y - restBox.y)).toBeLessThanOrEqual(1)
  expect(errors, errors.join('\n')).toEqual([])
})
