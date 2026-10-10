// M3 e2e: a whole game through the UI as the human against three Random bots, on the production build (vite preview under
// /dead-of-winner/). The human only clicks buttons the prompt dock offers (tests/e2e/policy.ts). Screenshots go to e2e-out/.
import { expect, test, type Page } from '@playwright/test'
import { buttonByText, playUntilRecap } from './policy'

const URL = '?seed=e2e&seats=human,bot,bot,bot&objective=samples'
const OUT = 'e2e-out'

async function boot(page: Page, errors: string[]): Promise<void> {
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })
  // fast animations: the settings live in localStorage (dow.settings); the game itself is untouched
  await page.addInitScript(() => {
    try { localStorage.setItem('dow.settings', JSON.stringify({ speed: 8 })) } catch { /* private mode */ }
  })
  await page.goto(URL)
  await expect(page.getByTestId('game-screen')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 })
  await expect(page.locator('canvas')).toBeVisible()
}

test('a full game vs three Random bots, through UI clicks only', async ({ page }) => {
  test.setTimeout(15 * 60_000)
  const errors: string[] = []
  await boot(page, errors)
  await expect(page.getByTestId('prompt-dock')).toBeVisible({ timeout: 30_000 })
  await page.screenshot({ path: `${OUT}/m3-start.png` })

  let turnShot = false
  let crisisShot = false
  const stats = await playUntilRecap(page, {
    seed: 11,
    hooks: {
      onDock: async (kind) => {
        if (kind === 'turnAction' && !turnShot) {
          turnShot = true
          // the dock must not cover the dice tray
          const dock = await page.getByTestId('prompt-dock').boundingBox()
          const dice = await page.getByTestId('dice-tray').boundingBox()
          expect(dice, 'dice tray visible on the human turn').not.toBeNull()
          if (dock && dice) {
            const overlap = !(dock.x + dock.width <= dice.x || dice.x + dice.width <= dock.x || dock.y + dock.height <= dice.y || dice.y + dice.height <= dock.y)
            expect(overlap, `dock ${JSON.stringify(dock)} overlaps dice ${JSON.stringify(dice)}`).toBe(false)
          }
          await page.screenshot({ path: `${OUT}/m3-turn.png` })
        }
      },
      onTick: async () => {
        if (!crisisShot && (await page.getByTestId('crisis-reveal').isVisible().catch(() => false))) {
          crisisShot = true
          await page.screenshot({ path: `${OUT}/m3-crisis.png` })
        }
      },
    },
  })
  console.log('policy stats', JSON.stringify(stats))
  await expect(page.getByTestId('game-over')).toBeVisible()
  await expect(page.getByTestId('recap-seat-s1')).toBeVisible()
  await page.screenshot({ path: `${OUT}/m3-recap.png` })
  expect(turnShot, 'saw a human turn').toBe(true)
  if (!crisisShot) {
    // the strip can be brief at high speed; fall back to the recap's crisis table so the screenshot exists
    await page.getByTestId('recap-contributions').scrollIntoViewIfNeeded()
    await page.screenshot({ path: `${OUT}/m3-crisis.png` })
  }
  expect(stats.turns, 'the human ended at least one turn').toBeGreaterThan(0)
  expect(errors, errors.join('\n')).toEqual([])
})

test('the Objectives panel and How to play open from the top bar', async ({ page }) => {
  const errors: string[] = []
  await boot(page, errors)
  await buttonByText(page, 'Objectives').click()
  const obj = page.getByTestId('objective-panel')
  await expect(obj).toBeVisible()
  await expect(obj).toContainText('Main objective: We Need More Samples')
  await expect(obj).toContainText('Your secret objective')
  await buttonByText(obj, 'Close').click()
  await expect(obj).toBeHidden()
  await buttonByText(page, 'How to play').click()
  const how = page.getByTestId('howto-panel')
  await expect(how).toBeVisible()
  await expect(how).toContainText('A round')
  await buttonByText(how, 'Close').click()
  await expect(how).toBeHidden()
  expect(errors, errors.join('\n')).toEqual([])
})
