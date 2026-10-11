// M7 e2e: the client polish. The start screen variants, the settings popover (rails keys, graphics, colours, tips), the feed breakdowns, the effects layer
// (demand frameloop), the recap story, and the prompts the earlier e2e never reached (Crossroads choice and vote, keep-which-card, exile placement,
// a vote, the exiled first player's tie-break ballot). The prompts are reached deterministically: a seed plus an in-page policy (tests/e2e/drive.ts)
// answers the human's decisions through the `?test=1` hook until the wanted prompt opens, then the test clicks the real dock.
// Screenshots (gitignored): e2e-out/m7-start.png, m7-settings.png, m7-feed.png, m7-crisis.png, m7-snow.png, m7-recap.png.
import { expect, test, type Page } from '@playwright/test'
import { driveHuman, waitIdle } from './drive'

const OUT = 'e2e-out'
test.use({ viewport: { width: 1280, height: 760 } })

function watch(page: Page, errors: string[]): void {
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })
}

/** Opens a game straight from the URL with the test hook on. `settings` seeds dow.settings (instant speed and no tips by default). */
async function launch(page: Page, query: string, settings: Record<string, unknown> = { speed: 0, tips: false }): Promise<void> {
  await page.addInitScript((s) => { try { localStorage.setItem('dow.settings', JSON.stringify(s)) } catch { /* private mode */ } }, settings)
  await page.goto(`?${query}&test=1`)
  await expect(page.getByTestId('game-screen')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 })
  await page.waitForFunction(() => !!(window as unknown as { __game?: { pending(): unknown } }).__game?.pending())
}

const pendingOf = (page: Page): Promise<{ id: string; kind: string; seat: string } | null> =>
  page.evaluate(() => { const p = (window as any).__game.pending(); return p ? { id: p.id, kind: p.kind, seat: p.seat } : null }) // eslint-disable-line @typescript-eslint/no-explicit-any

// ---------------------------------------------------------------------------------------------------------------------------------------
test('the start screen: variants with validation, mature Crossroads on by default, persona and difficulty per bot', async ({ page }) => {
  test.setTimeout(90_000) // many steps; under the full parallel run the 3D pages starve it past the 30 s default
  const errors: string[] = []
  watch(page, errors)
  const tiersModule = '../../src/ai/tiers' // read at run time: the list is the AI's to define
  const aiTiers = await import(tiersModule).then((m: { AI_TIERS?: string[] }) => (Array.isArray(m.AI_TIERS) ? m.AI_TIERS : null), () => null)
  await page.goto('?test=1')
  await expect(page.getByTestId('setup-persona-1')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('setup-objectives').getByRole('button', { name: /We Need More Samples/ })).toBeVisible({ timeout: 30_000 })

  // every variant the engine supports is on the screen; the mature toggle defaults to ON with a clear label
  for (const id of ['coop', 'twoPlayer', 'hardcore', 'betrayer', 'elimination', 'mature']) await expect(page.getByTestId(`setup-variant-${id}`), id).toBeVisible()
  await expect(page.getByTestId('setup-variant-mature')).toBeChecked()
  await expect(page.getByText('Mature Crossroads cards', { exact: true })).toBeVisible()
  await expect(page.getByText(/all 80 Crossroads cards, as in the original game/)).toBeVisible()
  for (const id of ['coop', 'twoPlayer', 'hardcore', 'betrayer', 'elimination']) await expect(page.getByTestId(`setup-variant-${id}`), id).not.toBeChecked()

  // per bot: a persona and a difficulty (Normal and Random always; Easy and Hard when src/ai offers them)
  for (const i of [1, 2, 3]) {
    await expect(page.getByTestId(`setup-persona-${i}`)).toBeVisible()
    const tiers = await page.getByTestId(`setup-tier-${i}`).locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value))
    expect(tiers).toContain('normal')
    expect(tiers).toContain('random')
    expect(tiers).toEqual(aiTiers ?? ['normal', 'random']) // the list src/ai exports (AI_TIERS), or the fallback pair when it exports none
    await expect(page.getByTestId(`setup-blurb-${i}`)).not.toBeEmpty()
  }

  // validation: co-op greys the betrayer variant and the hardcore side (co-op always plays hardcore)
  await page.getByTestId('setup-variant-betrayer').check()
  await page.getByTestId('setup-variant-coop').check()
  await expect(page.getByTestId('setup-variant-betrayer')).toBeDisabled()
  await expect(page.getByTestId('setup-variant-betrayer')).not.toBeChecked()
  await expect(page.getByTestId('setup-variant-hardcore')).toBeDisabled()
  await expect(page.getByTestId('setup-variant-hardcore')).toBeChecked()
  await expect(page.getByTestId('setup-note').first()).toContainText('Co-op')
  await expect(page.getByTestId('setup-start')).toBeEnabled()
  await page.getByTestId('setup-variant-coop').uncheck()
  await expect(page.getByTestId('setup-variant-betrayer')).toBeEnabled()

  // two-player forces exactly two seats (you and one bot), and un-ticking it seats a second bot again
  await page.getByTestId('setup-variant-twoPlayer').check()
  await expect(page.getByTestId('setup-seat-1')).toBeVisible()
  await expect(page.getByTestId('setup-seat-2')).toHaveCount(0)
  await expect(page.getByTestId('setup-variant-betrayer')).toBeDisabled()
  await expect(page.getByTestId('setup-note').first()).toContainText('two-player')
  await page.getByTestId('setup-variant-twoPlayer').uncheck()
  await expect(page.getByTestId('setup-seat-2')).toBeVisible()
  await page.getByTestId('setup-add-bot').click()
  await expect(page.getByTestId('setup-seat-3')).toBeVisible()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/m7-start.png` })

  // start a betrayer game with player elimination and the mature cards removed: the engine receives exactly those flags and the per-bot tiers
  await page.getByTestId('setup-variant-betrayer').check()
  await page.getByTestId('setup-variant-elimination').check()
  await page.getByTestId('setup-variant-mature').uncheck()
  await page.getByTestId('setup-tier-2').selectOption('random')
  await page.getByTestId('setup-objectives').getByRole('button', { name: /We Need More Samples/ }).click()
  await page.getByTestId('setup-seed').fill('m7-variants')
  await page.getByTestId('setup-start').click()
  await expect(page.getByTestId('game-screen')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 })
  const setup = await page.evaluate(() => (window as any).__game.state().setup) // eslint-disable-line @typescript-eslint/no-explicit-any
  expect(setup.variants).toEqual({ betrayer: true, playerElimination: true, removeMature: true })
  expect(setup.seats).toHaveLength(4)
  expect(setup.seats[2].tier).toBe('random')
  expect(setup.seats[1].tier).toBe('normal')
  expect(errors, errors.join('\n')).toEqual([])
})

test('variants from the URL reach the engine (co-op plays the hardcore side with no secret objectives)', async ({ page }) => {
  const errors: string[] = []
  watch(page, errors)
  await launch(page, 'seed=m7-coop&seats=human,bot,bot&objective=samples&variants=coop,elimination&mature=0')
  const s = await page.evaluate(() => { const st = (window as any).__game.state(); return { variants: st.setup.variants, side: st.objective.side, secrets: Object.values(st.seats).map((x: any) => x.secretObjectiveId) } }) // eslint-disable-line @typescript-eslint/no-explicit-any
  expect(s.variants).toEqual({ coop: true, playerElimination: true, removeMature: true })
  expect(s.side).toBe('hardcore')
  expect(s.secrets.every((x: unknown) => x === null)).toBe(true)
  expect(errors, errors.join('\n')).toEqual([])
})

// ---------------------------------------------------------------------------------------------------------------------------------------
test('settings: speed, graphics, colours (with a colour-blind-safe set), rails on [ and ], sound, replay tutorial tips; Low graphics leaves the canvas idle', async ({ page }) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  watch(page, errors)
  await launch(page, 'seed=b&seats=human,bot,bot,bot&objective=samples', { speed: 8 }) // tips stay on (the default)
  const first = await driveHuman(page, { until: `(g, pd) => pd.kind === 'turnAction' && pd.seat === 's1'`, plan: 'safe' })
  expect(first.stopped, JSON.stringify(first)).toBe(true)
  await expect(page.getByTestId('prompt-dock')).toBeVisible({ timeout: 30_000 })

  // a tutorial tip shows at the first prompt; "Got it" marks it seen and "Replay tutorial tips" brings it back
  const tip = page.getByTestId('tip')
  await expect(tip).toBeVisible()
  const tipId = await tip.getAttribute('data-tip')
  expect(tipId).toBeTruthy()
  await page.getByTestId('tip-dismiss').click()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dow.settings') ?? '{}').tipsSeen)).toContain(tipId)

  // the settings popover
  await page.getByTestId('topbar-settings').click()
  const panel = page.getByTestId('settings-panel')
  await expect(panel).toBeVisible()
  for (const id of ['settings-speed', 'settings-graphics', 'settings-palette', 'settings-narration', 'settings-left-rail', 'settings-right-rail', 'settings-tips', 'settings-replay-tips', 'sound-master', 'sound-effects', 'sound-music']) {
    await expect(page.getByTestId(id), id).toBeVisible()
  }
  await page.getByTestId('settings-palette').selectOption('cbsafe')
  await expect(page.getByTestId('swatches-cbsafe')).toBeVisible()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/m7-settings.png` })
  await expect(page.getByTestId('seat-rail').locator('.mark').first()).toBeVisible() // colour is never the only cue
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dow.settings') ?? '{}').palette)).toBe('cbsafe')
  await page.getByTestId('settings-palette').selectOption('default')
  await expect(page.getByTestId('seat-rail').locator('.mark')).toHaveCount(0)

  // replay tutorial tips: the seen list is cleared and the first tip comes back
  await page.getByTestId('settings-replay-tips').click()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dow.settings') ?? '{}').tipsSeen)).toEqual([])
  await page.getByRole('button', { name: 'Close', exact: true }).last().click()
  await expect(page.getByTestId('tip')).toBeVisible()

  // rails: [ folds the seat rail and ] folds the feed rail, and each toggles back; the state is remembered
  const left = page.getByTestId('seat-rail')
  const right = page.getByTestId('feed-rail')
  await page.locator('body').click({ position: { x: 640, y: 4 } })
  await page.keyboard.press('[')
  await expect(left).toHaveClass(/collapsed/)
  await page.keyboard.press(']')
  await expect(right).toHaveClass(/collapsed/)
  expect(await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('dow.settings') ?? '{}'); return [s.leftCollapsed, s.rightCollapsed] })).toEqual([true, true])
  await page.getByTestId('topbar-settings').click()
  await expect(page.getByTestId('settings-left-rail')).not.toBeChecked()
  await expect(page.getByTestId('settings-right-rail')).not.toBeChecked()
  await page.getByTestId('settings-left-rail').check()
  await expect(left).not.toHaveClass(/collapsed/)
  await page.getByTestId('settings-right-rail').check()
  await expect(right).not.toHaveClass(/collapsed/)
  await page.getByTestId('settings-panel').getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.getByTestId('settings-panel')).toBeHidden()

  // graphics: High redraws the canvas at the effects' throttled rate (snow, firelight); Low renders nothing while the table is still
  const frames = (): Promise<number> => page.evaluate(() => (window as any).__game.frames()) // eslint-disable-line @typescript-eslint/no-explicit-any
  await waitIdle(page)
  await page.waitForTimeout(600)
  const h0 = await frames()
  await page.waitForTimeout(1000)
  const high = (await frames()) - h0
  expect(high, 'High graphics animates the snow (a busy machine renders fewer than the 24 a second asked for)').toBeGreaterThan(2)
  expect(high, 'ambient effects are throttled, not run at the display rate').toBeLessThan(40)
  await page.getByTestId('topbar-settings').click()
  await page.getByTestId('settings-graphics').selectOption('low')
  await page.getByTestId('settings-panel').getByRole('button', { name: 'Close', exact: true }).click()
  await page.waitForTimeout(900)
  const l0 = await frames()
  await page.waitForTimeout(1200)
  expect((await frames()) - l0, 'Low graphics: no particles, no flicker, the demand loop stays idle').toBeLessThanOrEqual(1)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dow.settings') ?? '{}').graphics)).toBe('low')
  expect(errors, errors.join('\n')).toEqual([])
})

// ---------------------------------------------------------------------------------------------------------------------------------------
test('the feed groups by round and turn, breaks down the crisis reveal, exposure rolls and zombie placement; the crisis strip shows the running total against the target', async ({ page }) => {
  test.setTimeout(240_000)
  const errors: string[] = []
  watch(page, errors)
  await launch(page, 'seed=b&seats=human,bot,bot,bot&objective=samples', { speed: 1, tips: false })
  const run = driveHuman(page, { until: `(g, pd, st) => st.roundNumber >= 3 && pd.kind === 'turnAction' && pd.seat === 's1'`, plan: 'search', actions: 2, maxSteps: 4000 })

  // the crisis reveal, card by card, while it plays
  const strip = page.getByTestId('crisis-reveal')
  await expect(strip).toBeVisible({ timeout: 150_000 })
  await expect(page.getByTestId('crisis-card').first()).toBeVisible()
  await expect(page.getByTestId('crisis-total')).toContainText(/Total -?\d+ of \d+/)
  await expect(page.getByTestId('crisis-verdict')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('crisis-verdict')).toHaveText(/PREVENTED|NOT PREVENTED/)
  await page.screenshot({ path: `${OUT}/m7-crisis.png` })

  const result = await run
  expect(result.stopped, JSON.stringify(result)).toBe(true)
  await waitIdle(page)

  const rail = page.getByTestId('feed-rail')
  // readable: the older breakdowns are folded, the newest are open
  const open = await rail.locator('[data-testid="feed-group"][open]').count()
  const all = await rail.locator('[data-testid="feed-group"]').count()
  expect(open).toBeLessThanOrEqual(3)
  expect(all).toBeGreaterThan(open)
  // grouped by round, then by turn or colony step
  await expect(rail.getByTestId('feed-round').first()).toHaveText('Round 1')
  expect(await rail.getByTestId('feed-round').allTextContents()).toEqual(expect.arrayContaining(['Round 1', 'Round 2', 'Round 3']))
  const turns = await rail.getByTestId('feed-turn').allTextContents()
  expect(turns.some((t) => /'s turn$/.test(t))).toBe(true)
  expect(turns).toContain('Colony phase')
  expect(await rail.getByTestId('feed-step').allTextContents()).toEqual(expect.arrayContaining(['Step 3: the crisis resolves', 'Step 4: zombies arrive']))

  // the crisis reveal: a group with each card, its +1 or -1, the running total of the target, and the verdict chip
  const crisis = rail.locator('[data-testid="feed-group"][data-kind="crisis"]').first()
  await crisis.evaluate((el) => { (el as HTMLDetailsElement).open = true })
  await expect(crisis.locator('summary')).toContainText('the crisis cards are revealed')
  await expect(crisis.getByTestId('feed-chip')).toHaveText(/PREVENTED|NOT PREVENTED/)
  const cards = crisis.getByTestId('feed-line').filter({ hasText: /^(\+1|-1)?Card \d+:/ })
  expect(await cards.count()).toBeGreaterThan(0)
  await expect(cards.first()).toContainText(/Running total -?\d+ of \d+/)
  await expect(crisis.getByTestId('feed-line').last()).toContainText(/Morale|total \d+ of \d+ needed/)

  // every exposure roll shows the face with the odds it had
  const roll = rail.locator('[data-testid="feed-group"][data-kind="exposure"]').first()
  await roll.evaluate((el) => { (el as HTMLDetailsElement).open = true })
  await expect(roll.locator('summary')).toContainText(/rolls the exposure die \(.+\): (BLANK|WOUND|FROSTBITE|BITE)\./)
  await expect(roll.getByTestId('feed-odds')).toContainText(/Blank \d+%/)
  await expect(roll.getByTestId('feed-odds')).toContainText(/Bite \d+%/)
  await expect(roll.getByTestId('feed-chip')).toHaveText(/BLANK|WOUND|FROSTBITE|BITE/)
  await expect(page.getByTestId('tray-odds').or(page.getByTestId('tray-roll'))).toBeVisible()

  // zombies placed step by step: the entrance number, and anything it broke
  const zombies = rail.locator('[data-testid="feed-group"][data-kind="zombies"]')
  expect(await zombies.count()).toBeGreaterThan(0)
  expect(await rail.getByTestId('feed-line').filter({ hasText: /^Gate \d: a zombie takes a space/ }).count()).toBeGreaterThan(0)

  await crisis.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/m7-feed.png` })

  // the effects layer on High graphics: snowfall over the table and the frost vignette (morale is healthy here, so it is faint)
  await expect(page.getByTestId('frost-vignette')).toBeAttached()
  await page.addStyleTag({ content: '.dock,.rail,.tray,.topbar,.tip,.fan,.crisis-reveal{visibility:hidden !important}' }) // the table alone, so the snow and the firelight show
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${OUT}/m7-snow.png` })
  expect(errors, errors.join('\n')).toEqual([])
})

// ---------------------------------------------------------------------------------------------------------------------------------------
test('the dice tray rolls and lands on the engine numbers; hits flash; the frost vignette follows morale', async ({ page }) => {
  test.setTimeout(180_000)
  const errors: string[] = []
  watch(page, errors)
  await launch(page, 'seed=b&seats=human,bot,bot,bot&objective=samples', { speed: 1, tips: false })
  // a rolling die tumbles while the beat plays, then settles on the value
  const run = driveHuman(page, { until: `(g, pd, st) => st.roundNumber >= 2 && pd.kind === 'turnAction' && pd.seat === 's1'`, plan: 'search', actions: 2, maxSteps: 4000 })
  await expect(page.locator('[data-testid="dice-tray"] .die.rolling').first()).toBeVisible({ timeout: 120_000 })
  const sawFlash = page.getByTestId('hit-flash').first().waitFor({ state: 'attached', timeout: 120_000 }).then(() => true, () => false)
  await run
  await waitIdle(page)
  await expect(page.locator('[data-testid="dice-tray"] .die.rolling')).toHaveCount(0)
  expect(await page.getByTestId('tray-exposure-die').getAttribute('data-rolling')).toBe('false')
  expect(await page.getByTestId('tray-exposure-die').getAttribute('data-value')).toMatch(/^\d+$/) // the last exposure roll, from the engine
  expect(await sawFlash, 'a kill, wound, frostbite or bite flashed').toBe(true)
  // the vignette strength is the engine's morale through a fixed curve: lower morale, stronger frost
  const k = async (): Promise<number> => Number(await page.getByTestId('frost-vignette').getAttribute('data-strength'))
  const morale = Number((await page.getByTestId('topbar-morale').locator('b').textContent()) ?? '0')
  const strength = await k()
  if (morale >= 7) expect(strength).toBe(0)
  else expect(strength).toBeGreaterThan(0)
  expect(errors, errors.join('\n')).toEqual([])
})

// ---------------------------------------------------------------------------------------------------------------------------------------
test('the recap tells each seat\'s story: secret objective and whether it was met, the betrayer, hidden crisis cards, Crossroads choices', async ({ page }) => {
  test.setTimeout(240_000)
  const errors: string[] = []
  watch(page, errors)
  await launch(page, 'seed=m7r&seats=human,bot,bot,bot&objective=samples&variants=betrayer')
  const result = await driveHuman(page, { until: `() => false`, plan: 'search', actions: 2, maxSteps: 6000 })
  expect(result.over, JSON.stringify(result)).toBe(true)
  const over = page.getByTestId('game-over')
  await expect(over).toBeVisible({ timeout: 30_000 })
  const story = page.getByTestId('recap-story')
  await expect(story).toBeVisible()
  for (const seat of ['s1', 's2', 's3', 's4']) {
    const card = page.getByTestId(`recap-seat-${seat}`)
    await expect(card).toBeVisible()
    await expect(card.getByTestId('recap-story-lines').locator('li').first()).toContainText(/secretly after|was the betrayer|had no secret objective/)
    await expect(card.getByTestId('recap-story-lines')).toContainText(/goal was (met|not met|reached)|betrayal (did not )?succeed/)
    await expect(card.getByTestId('recap-story-lines')).toContainText(/put (\d+) helpful cards? and (\d+) harmful|never put a card into a crisis/)
  }
  // the betrayer variant deals a betrayer in most games; the reveal is a tag on exactly the betrayer's card
  const betrayers = await page.locator('[data-testid^="recap-seat-"][data-betrayer="true"]').count()
  expect(betrayers).toBeLessThanOrEqual(1)
  expect(await page.getByTestId('recap-betrayer').count()).toBe(betrayers)
  // the hidden crisis contributions per crisis, by seat
  const rows = await page.getByTestId('recap-contributions').locator('tbody tr').count()
  expect(rows).toBeGreaterThan(0)
  await expect(page.getByTestId('recap-contributions').locator('thead th')).toHaveCount(3 + 4)
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/m7-recap.png` })
  expect(errors, errors.join('\n')).toEqual([])
})

// ---------------------------------------------------------------------------------------------------------------------------------------
test('search: after making noise to fill the location, the keep-which-card prompt lets you pick one of the cards drawn', async ({ page }) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  watch(page, errors)
  await launch(page, 'seed=b&seats=human,bot,bot,bot&objective=samples')
  const r = await driveHuman(page, { until: `(g, pd) => pd.kind === 'searchKeepOrNoise' && pd.seat === 's1'`, plan: 'noise', actions: 3 })
  expect(r.stopped, JSON.stringify(r)).toBe(true)
  const dock = page.getByTestId('prompt-dock')
  await expect(dock).toHaveAttribute('data-kind', 'searchKeepOrNoise')
  await expect(dock.getByTestId('prompt-text')).toContainText(/or make noise/)
  // make noise until the location cannot take more: the prompt turns into "keep one"
  for (let i = 0; i < 6; i++) {
    if ((await dock.getAttribute('data-kind')) === 'searchKeepWhich') break
    await dock.getByTestId('prompt-option-noise').click()
    await waitIdle(page)
    await page.waitForTimeout(80)
  }
  await expect(dock).toHaveAttribute('data-kind', 'searchKeepWhich')
  await expect(dock.getByTestId('prompt-text')).toContainText(/^Keep one: .+, .+\./)
  const options = dock.locator('[data-testid^="prompt-option-"]')
  expect(await options.count()).toBeGreaterThanOrEqual(2)
  expect(await dock.getByTestId('prompt-option-noise').count()).toBe(0)
  const before = await pendingOf(page)
  const handBefore = await page.evaluate(() => (window as any).__game.view().me.hand.length) // eslint-disable-line @typescript-eslint/no-explicit-any
  await options.first().click()
  await expect.poll(async () => (await pendingOf(page))?.id, { timeout: 10_000 }).not.toBe(before!.id)
  expect(await page.evaluate(() => (window as any).__game.view().me.hand.length)).toBe(handBefore + 1) // eslint-disable-line @typescript-eslint/no-explicit-any
  expect(errors, errors.join('\n')).toEqual([])
})

test('a Crossroads card comes up for you: the card, its two options, and the choice lands in the feed', async ({ page }) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  watch(page, errors)
  await launch(page, 'seed=b&seats=human,bot,bot,bot&objective=samples')
  const r = await driveHuman(page, { until: `(g, pd) => pd.kind === 'crossroadsOption' && pd.seat === 's1'`, plan: 'search', actions: 3 })
  expect(r.stopped, JSON.stringify(r)).toBe(true)
  const dock = page.getByTestId('prompt-dock')
  await expect(dock).toHaveAttribute('data-kind', 'crossroadsOption')
  await expect(dock.locator('.dock-head h3')).toContainText(/^Crossroads: /)
  const card = dock.locator('.dcard[data-card="crossroads"]')
  await expect(card).toBeVisible()
  const options = dock.locator('[data-testid^="prompt-option-"]')
  expect(await options.count()).toBeGreaterThanOrEqual(2) // an impossible option is not offered, so two or three
  await page.waitForTimeout(300)
  const before = await pendingOf(page)
  await options.first().click()
  await expect.poll(async () => (await pendingOf(page))?.id, { timeout: 10_000 }).not.toBe(before!.id)
  await expect(page.getByTestId('feed-rail').getByTestId('feed-line').filter({ hasText: /^Crossroads: / }).first()).toBeVisible()
  await expect(page.getByTestId('feed-rail').getByTestId('feed-line').filter({ hasText: /chooses: ".+"\./ }).first()).toBeVisible()
  expect(errors, errors.join('\n')).toEqual([])
})

test('a Crossroads group vote: the card and both answers, then the table vote resolves with the bots', async ({ page }) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  watch(page, errors)
  await launch(page, 'seed=s16&seats=human,bot,bot,bot&objective=samples')
  const r = await driveHuman(page, { until: `(g, pd) => pd.kind === 'votes' && pd.context.data && pd.context.data.code === 'effectVote' && pd.context.data.eligible.indexOf('s1') >= 0`, plan: 'search', actions: 3 })
  expect(r.stopped, JSON.stringify(r)).toBe(true)
  const dock = page.getByTestId('prompt-dock')
  await expect(dock).toHaveAttribute('data-kind', 'votes')
  const heading = await dock.locator('.dock-head h3').textContent()
  expect(heading).toMatch(/^Vote: /)
  expect(heading).not.toMatch(/nothing/i) // the card is named
  const text = (await dock.getByTestId('prompt-text').textContent()) ?? ''
  expect(text).toMatch(/the table votes\. 4 players vote; the majority decides/)
  expect(text).toMatch(/Yes means ".+"; No means ".+"\./)
  expect(text).not.toContain('Yes means "Yes"') // the card's own labels, not a bare Yes and No
  await expect(dock.getByTestId('prompt-option-yes')).toBeVisible()
  await expect(dock.getByTestId('prompt-option-no')).toBeVisible()
  await page.screenshot({ path: `${OUT}/m7-crossroads-vote.png` })
  const before = await pendingOf(page)
  await dock.getByTestId('prompt-option-no').click()
  await expect.poll(async () => (await pendingOf(page))?.id, { timeout: 15_000 }).not.toBe(before!.id)
  await expect(page.getByTestId('feed-rail').getByTestId('feed-line').filter({ hasText: /^The table votes: \d+ yes, \d+ no/ }).first()).toBeVisible()
  expect(errors, errors.join('\n')).toEqual([])
})

test('a vote to exile a bot: the ballot, and the result grouped in the feed (the bots answer privately)', async ({ page }) => {
  test.setTimeout(150_000)
  const errors: string[] = []
  watch(page, errors)
  await launch(page, 'seed=b&seats=human,bot,bot,bot&objective=samples', { speed: 2, tips: false })
  // stop the table the moment Rook (seat 2) has the turn, and have it call a vote against seat 3
  const r = await driveHuman(page, {
    until: `(g, pd) => { if (pd.kind === 'turnAction' && pd.seat === 's2') { g.pauseBots(true); return true } return false }`, plan: 'safe',
  })
  expect(r.stopped, JSON.stringify(r)).toBe(true)
  await page.evaluate(() => {
    const g = (window as any).__game // eslint-disable-line @typescript-eslint/no-explicit-any
    const call = g.legal().find((a: any) => a.type === 'callVote' && a.target === 's3') // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!call || g.dispatch(call)) throw new Error('callVote refused')
    g.pauseBots(false)
  })
  const dock = page.getByTestId('prompt-dock')
  await expect(dock).toHaveAttribute('data-kind', 'votes', { timeout: 20_000 })
  await expect(dock.locator('.dock-head h3')).toContainText(/^Vote: exile /)
  await expect(dock.getByTestId('prompt-text')).toContainText('called this vote')
  await expect(dock.getByTestId('prompt-text')).toContainText(/Eligible: 4; needed: 3/)
  const before = await pendingOf(page)
  await dock.getByTestId('prompt-option-no').click()
  await expect.poll(async () => (await pendingOf(page))?.id, { timeout: 20_000 }).not.toBe(before!.id)
  const group = page.getByTestId('feed-rail').locator('[data-testid="feed-group"][data-kind="vote"]').last()
  await group.evaluate((el) => { (el as HTMLDetailsElement).open = true })
  await expect(group.locator('summary')).toContainText('calls a vote to exile')
  await expect(group.getByTestId('feed-chip')).toHaveText(/EXILED|STAYS/)
  await expect(group.getByTestId('feed-line').filter({ hasText: /^Ballots: / })).toHaveCount(1)
  expect(errors, errors.join('\n')).toEqual([])
})

test('exile placement, then the exiled first player breaks a tie through a ballot of their own', async ({ page }) => {
  test.setTimeout(180_000)
  const errors: string[] = []
  watch(page, errors)
  await launch(page, 'seed=i&seats=human,bot,bot,bot&objective=samples', { speed: 2, tips: false }) // seed i deals you the first-player token
  const stop = await driveHuman(page, {
    until: `(g, pd) => { if (pd.kind === 'turnAction' && pd.seat === 's2') { g.pauseBots(true); return true } return false }`, plan: 'safe',
  })
  expect(stop.stopped, JSON.stringify(stop)).toBe(true)
  expect(await page.evaluate(() => (window as any).__game.state().firstSeat)).toBe('s1') // you hold the first-player token

  // the bots call a vote to exile you; you vote, and (the bots being paused) the test completes the ballot with every seat voting yes
  await page.evaluate(() => {
    const g = (window as any).__game // eslint-disable-line @typescript-eslint/no-explicit-any
    const call = g.legal().find((a: any) => a.type === 'callVote' && a.target === 's1') // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!call || g.dispatch(call)) throw new Error('callVote refused')
  })
  const dock = page.getByTestId('prompt-dock')
  await expect(dock).toHaveAttribute('data-kind', 'votes', { timeout: 20_000 })
  await expect(dock.locator('.dock-head h3')).toContainText(/^Vote: exile Player\?/)
  await dock.getByTestId('prompt-option-no').click() // your own ballot is held until the bots' ballots are in
  await expect(page.getByTestId('bot-wait')).toBeVisible()
  await page.evaluate(() => {
    const g = (window as any).__game // eslint-disable-line @typescript-eslint/no-explicit-any
    const yes = g.legal().find((a: any) => a.type === 'castVotes' && Object.values(a.votes).every(Boolean)) // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!yes || g.dispatch(yes)) throw new Error('ballot refused')
  })

  // exile placement: pick a location for each survivor outside the colony and place them
  await expect(dock).toHaveAttribute('data-kind', 'exilePlacement', { timeout: 20_000 })
  await expect(dock.getByTestId('prompt-text')).toContainText(/^Exiled\. Place .+ at non-colony locations/)
  await page.screenshot({ path: `${OUT}/m7-exile.png` })
  const selects = dock.locator('select[data-testid^="exile-"]')
  const n = await selects.count()
  expect(n).toBeGreaterThanOrEqual(1)
  for (let i = 0; i < n; i++) {
    const values = await selects.nth(i).locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value))
    expect(values).not.toContain('colony')
    await selects.nth(i).selectOption(values[i % values.length]!)
  }
  const placeBefore = await pendingOf(page)
  await dock.getByTestId('prompt-confirm').click()
  await expect.poll(async () => (await pendingOf(page))?.id, { timeout: 15_000 }).not.toBe(placeBefore!.id)
  const exile = await page.evaluate(() => {
    const g = (window as any).__game // eslint-disable-line @typescript-eslint/no-explicit-any
    const st = g.state()
    return { exiled: st.seats.s1.seat.exiled, where: st.seats.s1.survivors.map((id: string) => st.survivors[id].location), objective: st.seats.s1.exiledObjectiveId }
  })
  expect(exile.exiled).toBe(true)
  expect(exile.where.length).toBeGreaterThan(0)
  expect(exile.where.every((l: string) => l !== 'colony')).toBe(true)
  expect(exile.objective).toBeTruthy()

  // now another vote while you are exiled and still the first player: you cannot vote, but you get a ballot for the tie
  await page.evaluate(() => {
    const g = (window as any).__game // eslint-disable-line @typescript-eslint/no-explicit-any
    let guard = 0
    while (guard++ < 12) {
      const pd = g.pending()
      if (pd.kind === 'turnAction' && pd.seat === 's3') break
      const legal = g.legal()
      const next = legal.find((a: any) => a.type === 'endTurn') ?? legal.find((a: any) => a.type === 'pass') ?? legal[0] // eslint-disable-line @typescript-eslint/no-explicit-any
      if (pd.seat === 's1') break
      if (g.dispatch(next)) throw new Error(`could not advance ${pd.kind}`)
    }
    const pd = g.pending()
    if (!(pd.kind === 'turnAction' && pd.seat === 's3')) throw new Error(`stuck at ${pd.kind} ${pd.seat}`)
    const call = g.legal().find((a: any) => a.type === 'callVote' && a.target === 's4') // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!call || g.dispatch(call)) throw new Error('second callVote refused')
  })
  await expect(dock).toHaveAttribute('data-kind', 'votes', { timeout: 20_000 })
  await expect(dock.locator('.dock-head h3')).toContainText(/^Break the tie: exile /)
  await expect(dock.getByTestId('prompt-text')).toContainText(/You are exiled and cannot vote, but as first player you break ties/)
  await page.screenshot({ path: `${OUT}/m7-tiebreak.png` })
  const tieBefore = await pendingOf(page)
  expect((await page.evaluate(() => (window as any).__game.pending().context.data.tiebreakSeat))).toBe('s1')
  await dock.getByTestId('prompt-option-yes').click()
  // the bots answer for themselves; the ballot goes in with your tie-break answer (not the old default of "no")
  await page.evaluate(() => (window as any).__game.pauseBots(false))
  await expect.poll(async () => (await pendingOf(page))?.id, { timeout: 30_000 }).not.toBe(tieBefore!.id)
  const ballot = await page.evaluate(() => {
    const actions = (window as any).__game.save().file.actions as any[] // eslint-disable-line @typescript-eslint/no-explicit-any
    return actions.filter((a) => a.type === 'castVotes').pop()
  })
  expect(ballot.votes.s1, JSON.stringify(ballot)).toBe(true)
  expect(Object.keys(ballot.votes).sort()).toEqual(['s1', 's2', 's3', 's4'])
  expect(errors, errors.join('\n')).toEqual([])
})
