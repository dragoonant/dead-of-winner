// Crisis contribution picker (50 §6): tick cards from the hand or equipped slots, see the crisis line from query.crisis, confirm.
// Used for the `crisisContribution` decision and from the turn action list. The Confirm is checked with the engine's own validate().
import { useEffect, useMemo, type ReactElement } from 'react'
import { query, type PendingDecision, type SeatView } from '../../engine/index'
import { itemSymbols, itemText, nameOf, seatNameOf } from '../data'
import { dispatch, useGameStore, validateAction } from '../store/gameStore'
import { ui, useUiStore } from '../store/uiStore'
import { SymbolChips } from './Icons'
import { contributeText } from './promptText'

export function ContributePicker({ pd, v, endsTurn, onBack }: { pd: PendingDecision; v: SeatView; endsTurn: boolean; onBack?: () => void }): ReactElement {
  const sel = useUiStore((s) => s.contribSel)
  const lastRej = useGameStore((s) => s.lastRejection)
  useEffect(() => {
    ui.set({ contribOpen: true, contribSel: [] })
    return () => ui.set({ contribOpen: false, contribSel: [] })
  }, [])
  const crisis = useMemo(() => query.crisis(v), [v])
  const equipped = useMemo(() => (v.seats[v.seat]?.survivors ?? []).flatMap((sid) => v.survivors[sid]?.equipped ?? []), [v])
  const cards = [...v.me.hand, ...equipped]
  const action = useMemo(() => ({ type: 'contributeCrisis' as const, decisionId: pd.id, seat: v.seat, cardIds: sel }), [pd.id, v.seat, sel])
  const rejection = useMemo(() => validateAction(action), [action])
  const bySeat = v.seatOrder.filter((s) => (crisis.cardsBySeat[s] ?? 0) > 0).map((s) => `${seatNameOf(v.setup, s)} ${crisis.cardsBySeat[s]}`)
  const text = contributeText({
    crisis: nameOf(crisis.cardId), prevent: crisis.prevent.map((p) => p), needed: crisis.needed, bonusAt: crisis.bonusAt, cardsIn: crisis.cardsIn,
    mine: crisis.cardsBySeat[v.seat] ?? 0, bySeat, endsTurn,
  })
  return (
    <>
      <div className="dock-head"><h3>Crisis: {nameOf(crisis.cardId)}</h3></div>
      <div className="dock-body">
        <div className="dock-text" data-testid="prompt-text">{text}</div>
        <div className="muted">Cards that prevent it are marked. Click cards here or in your hand to tick them.</div>
        <div className="opt-list">
          {cards.length === 0 && <div className="muted">You have no cards to add.</div>}
          {cards.map((c) => {
            const defId = v.cards[c]?.defId
            const syms = itemSymbols(defId)
            const match = syms.some((s) => crisis.prevent.includes(s))
            return (
              <button key={c} className={`opt ${sel.includes(c) ? 'sel' : ''}`} onClick={() => ui.toggleContrib(c)} data-testid={`contrib-${c}`}>
                <SymbolChips symbols={syms} /> <b>{nameOf(defId)}</b> {match && <span className="tag gold">prevents</span>}
                <div className="muted" style={{ fontSize: 11 }}>{itemText(defId)}</div>
              </button>
            )
          })}
        </div>
      </div>
      {lastRej && lastRej.action?.decisionId === pd.id && <div className="err">{lastRej.text}</div>}
      <div className="dock-foot">
        {onBack && <button className="btn" onClick={onBack}>Back</button>}
        <button className="btn" data-testid="prompt-contribute-none" onClick={() => dispatch({ ...action, cardIds: [] }, 'human')}>Add nothing</button>
        <span className="spacer" />
        {rejection && sel.length > 0 && <span className="muted" style={{ fontSize: 11 }}>{rejection.message}</span>}
        <button className="btn primary" data-primary data-testid="prompt-confirm" disabled={sel.length === 0 || !!rejection} onClick={() => dispatch(action, 'human')}>
          Add {sel.length} card{sel.length === 1 ? '' : 's'}
        </button>
      </div>
    </>
  )
}
