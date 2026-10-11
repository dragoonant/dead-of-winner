// Shared click policy for the e2e games: it plays the human seat through the prompt dock only, clicking legal buttons found by their
// exact text (never window.__game). Deterministic: a tiny seeded RNG picks among the buttons the dock offers.
import type { Locator, Page } from '@playwright/test'

export interface PolicyStats {
  steps: number
  kinds: Record<string, number>
  turnActions: Record<string, number>
  turns: number
}

export interface PolicyHooks {
  /** Called once per dock seen (kind = data-kind), before the policy answers it. */
  onDock?: (kind: string, stats: PolicyStats) => Promise<void>
  /** Called on every loop iteration (screenshots of transient UI such as the crisis strip). */
  onTick?: (stats: PolicyStats) => Promise<void>
}

const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const norm = (s: string | null): string => (s ?? '').replace(/\s+/g, ' ').trim()

/** The button inside `scope` whose whole text is exactly `text`. */
export function buttonByText(scope: Locator | Page, text: string): Locator {
  return scope.locator('button:visible', { hasText: new RegExp(`^\\s*${esc(text)}\\s*$`) }).first()
}

async function texts(scope: Locator, selector: string): Promise<string[]> {
  return (await scope.locator(selector).allTextContents()).map(norm).filter(Boolean)
}

function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

async function clickText(scope: Locator, text: string): Promise<boolean> {
  const b = buttonByText(scope, text)
  if ((await b.count()) === 0 || !(await b.isEnabled())) return false
  await b.click()
  return true
}

/** Plays until the recap screen shows. Throws on a stall (the same dock answered too many times without progress). */
export async function playUntilRecap(page: Page, opts: { seed?: number; maxSteps?: number; hooks?: PolicyHooks } = {}): Promise<PolicyStats> {
  const r = rng(opts.seed ?? 7)
  const pick = <T,>(xs: T[]): T => xs[Math.floor(r() * xs.length)]!
  const stats: PolicyStats = { steps: 0, kinds: {}, turnActions: {}, turns: 0 }
  const maxSteps = opts.maxSteps ?? 3000
  let actionsThisTurn = 0
  let contributedThisTurn = false
  let lastSig = ''
  let sameSig = 0
  const over = page.getByTestId('game-over')
  const dock = page.getByTestId('prompt-dock')

  while (stats.steps < maxSteps) {
    if (opts.hooks?.onTick) await opts.hooks.onTick(stats)
    if (await over.isVisible()) return stats
    if (!(await dock.isVisible())) {
      await page.waitForTimeout(50)
      continue
    }
    const kind = (await dock.getAttribute('data-kind')) ?? 'unknown'
    const heading = norm(await dock.locator('.dock-head h3').first().textContent().catch(() => ''))
    const sig = `${kind}|${heading}|${norm(await dock.textContent().catch(() => '')).slice(0, 400)}`
    if (sig === lastSig) {
      if (++sameSig > 40) throw new Error(`policy stalled on dock ${kind}: ${sig.slice(0, 300)}`)
      await page.waitForTimeout(50)
    } else { lastSig = sig; sameSig = 0 }
    if (sameSig > 0 && sameSig % 10 !== 0) continue // give the UI a moment before answering the same dock again
    stats.steps++
    stats.kinds[kind] = (stats.kinds[kind] ?? 0) + 1
    if (opts.hooks?.onDock) await opts.hooks.onDock(kind, stats)
    // a rejection or a stuck level-2 form: step back and end the turn
    const rejected = (await dock.locator('.err').count()) > 0

    switch (kind) {
      case 'chooseSurvivors': {
        const need = Number(/(\d+) of (\d+) picked/.exec(norm(await dock.textContent()))?.[2] ?? 2)
        const names = await texts(dock, '.portrait .nm')
        for (const n of names.slice(0, need)) await dock.locator('.portrait', { has: page.locator('.nm', { hasText: new RegExp(`^${esc(n)}$`) }) }).first().click()
        const confirm = dock.getByTestId('prompt-confirm')
        await clickText(dock, norm(await confirm.textContent()))
        break
      }
      case 'chooseLeader': case 'newLeader': {
        await dock.locator('.portrait').first().click()
        await clickText(dock, 'Confirm leader')
        break
      }
      case 'turnAction': {
        const h = heading
        if (h === 'End turn') { await clickText(dock, 'End turn'); stats.turns++; actionsThisTurn = 0; contributedThisTurn = false; break }
        if (h === 'Your move') {
          const chips = (await texts(dock, '.dock-body .btn.chip')).filter((t) => t !== 'Add to crisis')
          const canAdd = (await buttonByText(dock, 'Add to crisis').count()) > 0
          if (rejected || actionsThisTurn >= 3 || (chips.length === 0 && (!canAdd || contributedThisTurn))) {
            await clickText(dock, 'End turn')
            break
          }
          if (canAdd && !contributedThisTurn && r() < 0.5) { contributedThisTurn = true; actionsThisTurn++; await clickText(dock, 'Add to crisis'); break }
          if (chips.length === 0) { await clickText(dock, 'End turn'); break }
          const idx = Math.floor(r() * chips.length)
          const c = chips[idx]!
          const nth = chips.slice(0, idx).filter((t) => t === c).length // the same label under another survivor
          stats.turnActions[c] = (stats.turnActions[c] ?? 0) + 1
          actionsThisTurn++
          await dock.locator('.dock-body .btn.chip:visible', { hasText: new RegExp(`^\\s*${esc(c)}\\s*$`) }).nth(nth).click()
          break
        }
        if (h.startsWith('Crisis:')) { // the contribution picker opened from the action list
          const cards = await dock.locator('[data-testid^="contrib-"]').count()
          if (cards > 0 && !rejected) {
            await dock.locator('[data-testid^="contrib-"]').first().click()
            if (await clickText(dock, 'Add 1 card')) break
          }
          await clickText(dock, 'Back')
          break
        }
        // level 2 of one action family
        if (rejected) { await clickText(dock, 'Back'); actionsThisTurn = 99; break }
        if (!(await clickText(dock, 'Confirm'))) await clickText(dock, 'Back')
        break
      }
      case 'crisisContribution': {
        const cards = dock.locator('[data-testid^="contrib-"]')
        if ((await cards.count()) > 0 && r() < 0.6 && !rejected) {
          await cards.first().click()
          if (await clickText(dock, 'Add 1 card')) break
        }
        await clickText(dock, 'Add nothing')
        break
      }
      case 'requestResponse': {
        const opts2 = await texts(dock, '.opt-list .opt')
        await clickText(dock, opts2.includes('Decline') ? 'Decline' : opts2[0]!)
        break
      }
      case 'votes': await dock.getByTestId('prompt-option-no').click(); break // the exile vote, a tie-break ballot or a Crossroads group vote: always No
      case 'exilePlacement': await clickText(dock, 'Place them'); break
      default: {
        // searchKeepOrNoise, searchKeepWhich, crossroadsOption, biteSpreadOption and the generic option list
        const opts2 = await texts(dock, '.opt-list > .opt')
        if (opts2.length) {
          const t = pick(opts2)
          const b = dock.locator('.opt-list > .opt', { hasText: t }).filter({ hasText: new RegExp(`^\\s*${esc(t)}\\s*$`) }).first()
          if ((await b.count()) > 0) await b.click()
          else await dock.locator('.opt-list > .opt').first().click()
        } else if (!(await clickText(dock, 'Pass'))) throw new Error(`no way to answer dock ${kind}`)
      }
    }
    await page.waitForTimeout(20)
  }
  throw new Error(`no recap after ${maxSteps} steps: ${JSON.stringify(stats)}`)
}
