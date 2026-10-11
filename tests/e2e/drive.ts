// In-page drivers for the M7 e2e: they answer the human's decisions through the `?test=1` hook (window.__game) so a test can reach a given
// prompt deterministically (a seed plus a fixed policy), then hand over to real UI clicks. Bots keep playing unless a test pauses them.
import type { Page } from '@playwright/test'

export interface DriveOpts {
  /** JS source of `(g, pd, st) => boolean`, tested whenever the table is idle and a decision is open; the drive stops when it holds. */
  until: string
  maxSteps?: number
  /** How the human plays its turns: 'search' walks a survivor to a location and searches; 'safe' only ends turns; 'noise' is 'search' that always makes noise. */
  plan?: 'search' | 'safe' | 'noise'
  /** Max actions per turn before ending it. */
  actions?: number
}
export interface DriveResult { stopped: boolean; kind: string | null; seat: string | null; steps: number; round: number; phase: string; over: boolean }

export async function driveHuman(page: Page, opts: DriveOpts): Promise<DriveResult> {
  return page.evaluate(async ({ until, maxSteps, plan, actions }) => {
    type Any = any // eslint-disable-line @typescript-eslint/no-explicit-any
    const g = (window as Any).__game
    const stop = new Function('g', 'pd', 'st', `return (${until})(g, pd, st)`) as (g: Any, pd: Any, st: Any) => boolean
    const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
    const me = g.seatIds()[0]
    let acts = 0
    let lastTurn = ''
    const out = (stopped: boolean, steps: number): Any => {
      const pd = g.pending()
      const st = g.state()
      return { stopped, kind: pd?.kind ?? null, seat: pd?.seat ?? null, steps, round: st?.roundNumber ?? 0, phase: st?.phase ?? '', over: !pd || pd.kind === 'gameOver' }
    }
    for (let i = 0; i < maxSteps; i++) {
      const pd = g.pending()
      const st = g.state()
      if (!pd || pd.kind === 'gameOver') return out(false, i)
      if (!g.presentedIdle()) { await sleep(15); continue }
      if (stop(g, pd, st)) return out(true, i)
      const eligible = ((pd.context?.data as Any)?.eligible ?? []) as string[]
      const mine = pd.seat === me || (pd.seat === 'all' && (eligible.includes(me) || (pd.context?.data as Any)?.tiebreakSeat === me))
      if (!mine) { await sleep(20); continue }
      const legal = g.legal() as Any[]
      let pick: Any = legal[0]
      if (pd.kind === 'turnAction') {
        const key = `${st.roundNumber}:${st.turnCount}`
        if (key !== lastTurn) { lastTurn = key; acts = 0 }
        const end = legal.find((a) => a.type === 'endTurn') ?? legal[0]
        const search = legal.find((a) => a.type === 'search')
        const move = legal.find((a) => a.type === 'move' && a.to !== 'colony')
        pick = end
        if (acts < actions && plan !== 'safe') {
          const choice = search ?? move
          if (choice) { pick = choice; acts++ }
        }
      } else if (pd.kind === 'searchKeepOrNoise') {
        pick = (plan === 'noise' && legal.find((a) => a.type === 'makeNoise')) || legal.find((a) => a.type === 'keepCard') || legal[0]
      } else if (pd.kind === 'votes') pick = legal[0] // all No
      const rej = g.dispatch(pick)
      if (rej) { const fallback = legal.find((a) => a.type === 'endTurn') ?? legal.find((a) => a.type === 'pass') ?? legal[legal.length - 1]; g.dispatch(fallback) }
      await sleep(5)
    }
    return out(false, maxSteps)
  }, { until: opts.until, maxSteps: opts.maxSteps ?? 1500, plan: opts.plan ?? 'search', actions: opts.actions ?? 2 })
}

/** Waits for the presentation to be idle (the dock only opens then). */
export async function waitIdle(page: Page, timeout = 15_000): Promise<void> {
  await page.waitForFunction(() => (window as unknown as { __game?: { presentedIdle(): boolean } }).__game?.presentedIdle() === true, undefined, { timeout })
}
