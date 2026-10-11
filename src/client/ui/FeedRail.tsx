// Event feed rail (right, ']') (50 §10): lines grouped by round, then by turn or colony-phase step, with the breakdowns
// (crisis reveal, exposure roll, zombie placement, vote) as expandable groups. Every number is the engine's, printed by presentation/feedModel.
import { useEffect, useMemo, useRef, type ReactElement } from 'react'
import { usePresentedStore } from '../presentation/presentedStore'
import { arrangeFeed, type FeedEntry, type FeedItem, type FeedOdds } from '../presentation/feedModel'
import { pct } from './promptText'
import { useSettingsStore } from '../store/settingsStore'
import { RailHead } from './Rails'

const FACES: ['blank' | 'wound' | 'frostbite' | 'bite', string][] = [['blank', 'Blank'], ['wound', 'Wound'], ['frostbite', 'Frostbite'], ['bite', 'Bite']]

/** The four exposure faces as a bar sized by the odds the roll had; the face that came up is outlined. */
export function OddsBar({ odds }: { odds: FeedOdds }): ReactElement {
  return (
    <div className="odds" data-testid="feed-odds" aria-label={`Odds were ${FACES.map(([k, l]) => `${pct(odds[k])} ${l.toLowerCase()}`).join(', ')}; it came up ${odds.face}`}>
      <div className="odds-bar">
        {FACES.map(([k]) => (odds[k] > 0 ? <i key={k} className={`${k} ${odds.face === k ? 'hit' : ''}`} style={{ flexGrow: odds[k] }} /> : null))}
      </div>
      <div className="odds-key">
        {FACES.map(([k, l]) => (odds[k] > 0 ? <span key={k} className={odds.face === k ? 'hit' : ''}>{l} {pct(odds[k])}</span> : null))}
        {odds.pDeath > 0 && <span className="dies">dies on a bite: {pct(odds.pDeath)}</span>}
      </div>
    </div>
  )
}

function Line({ e, child }: { e: FeedEntry; child?: boolean }): ReactElement {
  const r = e.running
  return (
    <div className={`feed-line ${e.tone} ${child ? 'child' : ''}`} data-testid="feed-line">
      {r && <span className={`pm ${r.points > 0 ? 'plus' : 'minus'}`}>{r.points > 0 ? '+1' : '-1'}</span>}
      {e.text}
      {r && r.needed ? (
        <span className="run" data-testid="feed-running" title={`${r.running} of ${r.needed}`}>
          <i style={{ width: `${Math.max(0, Math.min(100, (100 * r.running) / r.needed))}%` }} />
        </span>
      ) : null}
    </div>
  )
}

function Group({ item, open }: { item: FeedItem; open: boolean }): ReactElement {
  const e = item.entry
  return (
    <details className={`feed-box ${e.group} ${e.tone}`} open={open} data-testid="feed-group" data-kind={e.group}>
      <summary>
        <span className="txt">{e.text}</span>
        {e.chip && <span className={`chip ${e.chip.tone}`} data-testid="feed-chip">{e.chip.text}</span>}
      </summary>
      {e.odds && <OddsBar odds={e.odds} />}
      {item.children.map((c) => <Line key={c.seq} e={c} child />)}
    </details>
  )
}

export function FeedRail(): ReactElement {
  const feed = usePresentedStore((s) => s.feed)
  const collapsed = useSettingsStore((s) => s.rightCollapsed)
  const seen = useRef(0)
  const body = useRef<HTMLDivElement>(null)
  const unread = collapsed ? Math.max(0, feed.length - seen.current) : 0
  useEffect(() => {
    if (!collapsed) { seen.current = feed.length; const b = body.current; if (b) b.scrollTop = b.scrollHeight }
  }, [feed.length, collapsed])
  const rounds = useMemo(() => arrangeFeed(feed.slice(-500)), [feed])
  // the three newest breakdowns stay open; older ones fold away so the rail stays short
  const openHeads = useMemo(() => new Set(feed.filter((e) => e.group).slice(-3).map((e) => e.seq)), [feed])
  return (
    <div className={`rail right panel ${collapsed ? 'collapsed' : ''}`} data-testid="feed-rail">
      <RailHead title="Event feed" side="right" badge={unread} />
      <div className="rail-body feed-body" ref={body}>
        {rounds.map((r, ri) => (
          <section className="feed-round" key={`${r.round ?? 'x'}-${ri}`}>
            {r.round !== null && <h3 data-testid="feed-round">Round {r.round}</h3>}
            {r.turns.map((t, ti) => {
              let step: string | undefined
              return (
                <div className="feed-turn" key={`${t.turn}-${ti}`}>
                  <h4 data-testid="feed-turn">{t.turn}</h4>
                  {t.items.map((it) => {
                    const head = it.entry.step !== undefined && it.entry.step !== step ? <h5 key={`s${it.entry.seq}`} data-testid="feed-step">{it.entry.step}</h5> : null
                    step = it.entry.step ?? step
                    return (
                      <div key={it.entry.seq}>
                        {head}
                        {it.entry.group ? <Group item={it} open={openHeads.has(it.entry.seq)} /> : <Line e={it.entry} />}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </section>
        ))}
        {feed.length === 0 && <div className="muted">Nothing has happened yet.</div>}
      </div>
    </div>
  )
}
