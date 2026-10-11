// The start screen shows the selected main objective card (normal or hardcore face), or a face-down back for Random.
import { expect, test } from '@playwright/test'

const OUT = 'e2e-out'

test('picking an objective shows its card; hardcore flips the face; Random shows the back', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('')
  await expect(page.getByTestId('setup-start')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('setup-objective-obj.main.stockpile')).toBeVisible({ timeout: 30_000 }) // the card data has loaded
  const card = page.getByTestId('setup-objective-card')

  // Random: the face-down back and the "one of the N" line
  await expect(card).toHaveAttribute('data-side', 'back')
  await expect(card).toContainText('Random objective — revealed when the game starts')
  await expect(card).toContainText(/One of the 10 main objectives/)

  await page.getByTestId('setup-objective-obj.main.home-sweet-home').click()
  const face = card.locator('[data-card="main-objective"]')
  await expect(face).toHaveAttribute('data-id', 'obj.main.home-sweet-home')
  await expect(face).toContainText('Home Sweet Home')
  await expect(face).toContainText('Set up')
  await expect(face).toContainText('Victory')
  await expect(face).toContainText('Time')
  await expect(card).toHaveAttribute('data-side', 'normal')
  const normalText = await face.innerText()

  await page.getByTestId('setup-variant-hardcore').check()
  await expect(card).toHaveAttribute('data-side', 'hardcore')
  expect(await face.innerText()).not.toBe(normalText)

  await page.getByTestId('setup-objective-obj.main.x-weeks-of-darkness').click()
  await expect(face).toContainText('Ten Weeks of Darkness')
  await page.getByTestId('setup-variant-hardcore').uncheck()
  await expect(face).toContainText('Eight Weeks of Darkness')

  // the Start button stays above the fold at 1280x760
  const box = await page.getByTestId('setup-start').boundingBox()
  expect(box!.y + box!.height).toBeLessThanOrEqual(760)
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/start-objective.png` })

  // click to enlarge, click to close
  await page.getByTestId('setup-objective-card-open').click()
  await expect(page.getByTestId('setup-objective-modal')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('setup-objective-modal')).toHaveCount(0)
  expect(errors, errors.join('\n')).toEqual([])
})

test('at phone width the card sits in a collapsible panel and the page does not scroll sideways', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 })
  await page.goto('')
  await expect(page.getByTestId('setup-start')).toBeVisible({ timeout: 30_000 })
  await page.getByTestId('setup-objective-obj.main.stockpile').click()
  const card = page.getByTestId('setup-objective-card')
  await expect(card).toBeHidden()
  await page.getByTestId('setup-objective-card-toggle').click()
  await expect(card.locator('[data-card="main-objective"]')).toContainText('Stockpile')
  const overflow = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, start: (document.querySelector('.start') as HTMLElement).scrollWidth, w: window.innerWidth }))
  expect(overflow.doc).toBeLessThanOrEqual(overflow.w)
  expect(overflow.start).toBeLessThanOrEqual(overflow.w)
  await page.screenshot({ path: 'e2e-out/start-objective-phone.png', fullPage: true })
})
