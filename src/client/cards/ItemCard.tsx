// ItemCard: a photo-style panel with the symbol (or item art), a wooden name banner with the symbol icon, the ability text opening with its
// class keyword, and a footer with the deck number and location it is searched from.
import type { ReactElement } from 'react'
import { isStarterItem, itemDeck, itemKindLabel, itemSymbols, itemText, nameOf } from '../data'
import { SymbolIcon } from '../ui/Icons'
import type { CardSize } from './SurvivorCard'

export function ItemCard({ defId, size = 'sm', selected, ticked }: { defId: string | undefined; size?: CardSize; selected?: boolean; ticked?: boolean }): ReactElement {
  const symbols = itemSymbols(defId)
  const name = nameOf(defId)
  const kind = itemKindLabel(defId)
  const text = itemText(defId)
  const deck = itemDeck(defId)
  const starter = isStarterItem(defId)
  const nameSize = name.length > 19 ? 5.6 : name.length > 15 ? 6.6 : name.length > 11 ? 7.8 : 9
  return (
    <div className={`dcard ${size} ${selected || ticked ? 'sel' : ''}`} data-card="item" data-id={defId ?? ''}>
      <div className="dcard-face">
        <div className="it-photo">
          <span className="tape" />
          <div className="pic">{symbols[0] ? <SymbolIcon symbol={symbols[0]} size={64} /> : null}</div>
        </div>
        <div className="it-banner">
          <span className="nm" style={{ fontSize: `${nameSize}cqw` }}>{name}</span>
          {symbols.length > 0 && <span className="sym">{symbols.map((s, i) => <SymbolIcon key={`${s}${i}`} symbol={s} size={20} />)}</span>}
        </div>
        <div className="it-text">
          {text ? <>{kind && <span className="kw">{kind}: </span>}{text}</> : <span className="none">{kind || 'No ability.'}</span>}
        </div>
        <div className="it-foot">
          {deck ? (
            <>
              {deck.number !== null && <span className="num">{String(deck.number).padStart(2, '0')}</span>}
              <span className="loc">{deck.name}</span>
            </>
          ) : <span className="loc starter">{starter ? 'Starting supplies' : 'Supplies'}</span>}
        </div>
      </div>
    </div>
  )
}
