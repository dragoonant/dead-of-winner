// Seat rail (left, '[') (50 §3, §9); the feed rail (right, ']') lives in FeedRail.tsx and shares RailHead.
import type { ReactElement } from 'react'
import { previewProps } from '../cards/preview'
import { SurvivorChip } from '../cards/SurvivorChip'
import { nameOf } from '../data'
import { seatNameOf } from '../data'
import { useGameStore } from '../store/gameStore'
import { usePresentedView } from '../store/hooks'
import { useSettingsStore } from '../store/settingsStore'
import { ui, useUiStore } from '../store/uiStore'
import { seatColour, seatMark, usePalette } from '../table/seats'
import { useTalkStore } from '../bot/talk'

export function RailHead({ title, side, badge }: { title: string; side: 'left' | 'right'; badge?: number }): ReactElement {
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

function Bubble({ seat }: { seat: string }): ReactElement | null {
  const b = useTalkStore((s) => s.bubbles[seat])
  return b ? <div className="bubble" role="status" data-testid={`bubble-${seat}`}>{b.text}</div> : null
}

export function SeatRail(): ReactElement | null {
  const v = usePresentedView()
  const collapsed = useSettingsStore((s) => s.leftCollapsed)
  const viewer = useGameStore((s) => s.viewer)
  const hover = useUiStore((s) => s.hoverSurvivor)
  const palette = usePalette()
  if (!v) return null
  // clockwise from the viewer
  const i0 = Math.max(0, v.seatOrder.indexOf(viewer))
  const order = [...v.seatOrder.slice(i0), ...v.seatOrder.slice(0, i0)]
  return (
    <div className={`rail left panel ${collapsed ? 'collapsed' : ''}`} data-testid="seat-rail">
      <RailHead title="Seats" side="left" />
      <div className="rail-body">
        {order.map((id) => {
          const s = v.seats[id]!
          const leader = s.leaderId
          const followers = s.survivors.filter((x) => x !== leader)
          const diceLeft = s.dice.filter((d) => !d.used).length
          const you = id === viewer
          return (
            <div key={id} className={`seat-card ${v.activeSeat === id ? 'active' : ''}`} style={{ borderLeftColor: seatColour(v.seatOrder, id, palette) }} data-testid={`seat-${id}`} data-hand={you ? v.me.hand.length : s.handCount} data-dice-left={diceLeft} data-exiled={s.seat.exiled}>
              <div className="row">
                <span className="name">{seatMark(v.seatOrder, id, palette) && <span className="mark" style={{ color: seatColour(v.seatOrder, id, palette) }} aria-hidden="true">{seatMark(v.seatOrder, id, palette)} </span>}{seatNameOf(v.setup, id)}{you ? ' (you)' : ''}</span>
                {v.firstSeat === id && <span className="tag gold" title="First player token">first</span>}
                {s.seat.exiled && <span className="tag bad">exiled</span>}
                {s.seat.eliminated && <span className="tag bad">out</span>}
                {s.outcome && <span className={`tag ${s.outcome === 'won' ? 'gold' : 'bad'}`}>{s.outcome}</span>}
              </div>
              <Bubble seat={id} />
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
  const sv = v?.survivors[id]
  const equipped = sv?.equipped.map((c) => ({ c, defId: v?.cards[c]?.defId })) ?? []
  return (
    <div
      className={`surv ${hover ? 'hover' : ''}`}
      onMouseEnter={() => ui.set({ hoverSurvivor: id })}
      onMouseLeave={() => ui.set({ hoverSurvivor: null })}
      onClick={() => ui.set({ selectedSurvivor: id })}
      style={{ cursor: 'pointer' }}
    >
      <SurvivorChip id={id} leader={lead} wounds={sv?.wounds ?? 0} frostbite={sv?.frostbite ?? 0} />
      {equipped.length > 0 && (
        <div className="muted" style={{ fontSize: 11 }} data-testid="equipped">
          {equipped.map((e, i) => <span key={e.c}>{i > 0 ? ', ' : ''}<span className="equip" data-testid={`equipped-${e.c}`} {...previewProps({ kind: 'item', defId: e.defId })}>{nameOf(e.defId)}</span></span>)}
        </div>
      )}
    </div>
  )
}
