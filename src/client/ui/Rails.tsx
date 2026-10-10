// Seat rail (left, '[') and feed rail (right, ']') (50 §3, §9, §10).
import { useEffect, useRef, type ReactElement } from 'react'
import { nameOf, seatNameOf, survivorAbility, survivorOccupation, survivorStats } from '../data'
import { usePresentedStore, type FeedEntry } from '../presentation/presentedStore'
import { useGameStore } from '../store/gameStore'
import { usePresentedView } from '../store/hooks'
import { useSettingsStore } from '../store/settingsStore'
import { ui, useUiStore } from '../store/uiStore'
import { seatColour } from '../table/seats'

function Head({ title, side, badge }: { title: string; side: 'left' | 'right'; badge?: number }): ReactElement {
  const collapsed = useSettingsStore((s) => (side === 'left' ? s.leftCollapsed : s.rightCollapsed))
  const set = useSettingsStore((s) => s.set)
  return (
    <div className="rail-head">
      <span>{title}</span>
      {badge ? <span className="badge" style={{ display: 'inline' }}>{badge}</span> : null}
      <button className="btn chip" aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${title}`} title={side === 'left' ? '[' : ']'} onClick={() => set(side === 'left' ? { leftCollapsed: !collapsed } : { rightCollapsed: !collapsed })}>
        {side === 'left' ? (collapsed ? '>' : '<') : (collapsed ? '<' : '>')}
      </button>
    </div>
  )
}

export function SeatRail(): ReactElement | null {
  const v = usePresentedView()
  const collapsed = useSettingsStore((s) => s.leftCollapsed)
  const viewer = useGameStore((s) => s.viewer)
  const hover = useUiStore((s) => s.hoverSurvivor)
  if (!v) return null
  // clockwise from the viewer
  const i0 = Math.max(0, v.seatOrder.indexOf(viewer))
  const order = [...v.seatOrder.slice(i0), ...v.seatOrder.slice(0, i0)]
  return (
    <div className={`rail left panel ${collapsed ? 'collapsed' : ''}`} data-testid="seat-rail">
      <Head title="Seats" side="left" />
      <div className="rail-body">
        {order.map((id) => {
          const s = v.seats[id]!
          const leader = s.leaderId
          const followers = s.survivors.filter((x) => x !== leader)
          const diceLeft = s.dice.filter((d) => !d.used).length
          const you = id === viewer
          return (
            <div key={id} className={`seat-card ${v.activeSeat === id ? 'active' : ''}`} style={{ borderLeftColor: seatColour(v.seatOrder, id) }} data-testid={`seat-${id}`} data-hand={you ? v.me.hand.length : s.handCount} data-dice-left={diceLeft} data-exiled={s.seat.exiled}>
              <div className="row">
                <span className="name">{seatNameOf(v.setup, id)}{you ? ' (you)' : ''}</span>
                {v.firstSeat === id && <span className="tag gold" title="First player token">first</span>}
                {s.seat.exiled && <span className="tag bad">exiled</span>}
                {s.seat.eliminated && <span className="tag bad">out</span>}
                {s.outcome && <span className={`tag ${s.outcome === 'won' ? 'gold' : 'bad'}`}>{s.outcome}</span>}
              </div>
              {leader && <SurvRow id={leader} lead hover={hover === leader} />}
              {followers.map((f) => <SurvRow key={f} id={f} hover={hover === f} />)}
              {s.survivors.length === 0 && <span className="muted">no survivors</span>}
              <div className="stats">
                <span title="Unused action dice">dice {diceLeft}/{s.dice.length}</span>
                <span title="Cards in hand">hand {you ? v.me.hand.length : s.handCount}</span>
                <span title="Cards put into this round's crisis">crisis {s.contributionCount}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SurvRow({ id, lead, hover }: { id: string; lead?: boolean; hover?: boolean }): ReactElement {
  const v = usePresentedView()
  const st = survivorStats(id)
  const sv = v?.survivors[id]
  const equipped = sv?.equipped.map((c) => nameOf(v?.cards[c]?.defId)) ?? []
  return (
    <div
      className={`surv ${hover ? 'hover' : ''}`}
      title={`${survivorOccupation(id)}. ${survivorAbility(id)}`}
      onMouseEnter={() => ui.set({ hoverSurvivor: id })}
      onMouseLeave={() => ui.set({ hoverSurvivor: null })}
      onClick={() => ui.set({ selectedSurvivor: id })}
      style={{ cursor: 'pointer' }}
    >
      {lead ? '★ ' : ''}{nameOf(id)}{st ? <span className="muted"> inf {st.influence} atk {st.attack} src {st.search}</span> : null}
      {sv && (sv.wounds > 0 || sv.frostbite > 0) ? <span style={{ color: 'var(--bad)' }}> {sv.wounds}w {sv.frostbite}f</span> : null}
      {equipped.length > 0 && <div className="muted" style={{ fontSize: 11 }}>{equipped.join(', ')}</div>}
    </div>
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
  const groups: { key: string; lines: FeedEntry[] }[] = []
  for (const e of feed) {
    const last = groups[groups.length - 1]
    if (last && last.key === e.turnKey) last.lines.push(e)
    else groups.push({ key: e.turnKey, lines: [e] })
  }
  return (
    <div className={`rail right panel ${collapsed ? 'collapsed' : ''}`} data-testid="feed-rail">
      <Head title="Event feed" side="right" badge={unread} />
      <div className="rail-body" ref={body}>
        {groups.slice(-40).map((g, i) => (
          <div className="feed-group" key={`${g.key}-${i}`}>
            <h4>{g.key}</h4>
            {g.lines.map((l) => <div key={l.seq} className={`feed-line ${l.tone}`} data-testid="feed-line">{l.text}</div>)}
          </div>
        ))}
        {feed.length === 0 && <div className="muted">Nothing has happened yet.</div>}
      </div>
    </div>
  )
}
