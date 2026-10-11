// The human's hand as a fan of DOM card faces (50 §7): name, symbols, kind and the card's own text from the data.
// Click = open its play prompt (or tick it while the crisis picker is open). Hover lifts the card and shows the full text.
import { useMemo, type ReactElement } from 'react'
import { itemSymbols, nameOf } from '../data'
import { isHumanDecision, useGameStore } from '../store/gameStore'
import { usePresentedView } from '../store/hooks'
import { ui, useUiStore } from '../store/uiStore'
import { ItemCard } from './ItemCard'

const SYMBOL_ORDER = ['weapon', 'medicine', 'food', 'fuel', 'tool', 'education', 'survivor']

/** Cards sorted by symbol (then name); the order is per-viewer only. */
export function sortHand(cardIds: readonly string[], defOf: (id: string) => string | undefined): string[] {
  const key = (id: string): number => { const s = itemSymbols(defOf(id))[0]; const i = s ? SYMBOL_ORDER.indexOf(s) : -1; return i < 0 ? 99 : i }
  return [...cardIds].sort((a, b) => key(a) - key(b) || nameOf(defOf(a)).localeCompare(nameOf(defOf(b))))
}

export function HandFan(): ReactElement | null {
  const v = usePresentedView()
  const contribOpen = useUiStore((s) => s.contribOpen)
  const sel = useUiStore((s) => s.contribSel)
  const selected = useUiStore((s) => s.selectedCard)
  const pending = useGameStore((s) => s.pending)
  const human = useGameStore((s) => isHumanDecision(s))
  const hand = useMemo(() => (v ? sortHand(v.me.hand, (id) => v.cards[id]?.defId) : []), [v])
  if (!v) return null
  const n = hand.length
  const canPlay = human && pending?.kind === 'turnAction'
  return (
    <div className="fan" data-testid="hand-fan" aria-label="Your hand">
      {hand.map((id, i) => {
        const defId = v.cards[id]?.defId
        const rot = n > 1 ? (i - (n - 1) / 2) * Math.min(5, 36 / n) : 0
        const ticked = sel.includes(id)
        return (
          <button
            key={id}
            className={`fan-card ${selected === id || ticked ? 'sel' : ''} ${!canPlay && !contribOpen ? 'dim' : ''}`}
            style={{ ['--rot' as string]: `${rot}deg` }}
            data-testid={`hand-card-${id}`}
            onClick={() => (contribOpen ? ui.toggleContrib(id) : canPlay ? ui.set({ selectedCard: id }) : undefined)}
            onMouseEnter={() => ui.set({ hoverCard: id })}
            onMouseLeave={() => ui.set({ hoverCard: null })}
          >
            {ticked && <span className="ticked">ticked</span>}
            <ItemCard defId={defId} size="sm" ticked={ticked} />
          </button>
        )
      })}
      {n === 0 && <div className="panel" style={{ padding: '6px 12px', pointerEvents: 'auto', marginBottom: 8, color: 'var(--muted)' }}>Your hand is empty. Search a location to find items.</div>}
    </div>
  )
}
