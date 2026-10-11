// CrisisCard: an image panel (a generated cold-weather scene), a wooden name plank, the prevent line "[symbol] = number of non-exiled players",
// the FAIL text and the Optional bonus. The prevent line uses the need numbers from the card data.
import type { CSSProperties, ReactElement } from 'react'
import { crisisInfo, nameOf } from '../data'
import { SymbolIcon } from '../ui/Icons'
import { hash01 } from './art'
import type { CardSize } from './SurvivorCard'

export function CrisisCard({ id, size = 'md', selected }: { id: string | null | undefined; size?: CardSize; selected?: boolean }): ReactElement {
  const info = crisisInfo(id)
  const name = nameOf(id)
  const h = Math.round(196 + hash01(id ?? '') * 44)
  const style = { ['--c1' as string]: `hsl(${h} 34% 20%)`, ['--c2' as string]: `hsl(${h + 6} 22% 64%)` } as CSSProperties
  const need = !info ? '' : info.perSeat === 1 && info.plus === 0 ? 'number of non-exiled players' : `${info.perSeat === 1 ? '' : `${info.perSeat} x `}number of non-exiled players${info.plus ? ` + ${info.plus}` : ''}`
  const lead = info?.prevent[0]
  return (
    <div className={`dcard ${size} ${selected ? 'sel' : ''}`} data-card="crisis" data-id={id ?? ''}>
      <div className="dcard-face">
        <div className="cr-image" style={style}>
          {lead && <span className="glyph"><SymbolIcon symbol={lead} size={96} /></span>}
          <span className="ridge" />
        </div>
        <div className="cr-plank"><i /><span className="nm" style={name.length > 16 ? { fontSize: '8cqw' } : undefined}>{name}</span><i /></div>
        <div className="cr-body">
          {info && (
            <>
              <div className="cr-prevent"><span className="box">{info.prevent.map((s, i) => <SymbolIcon key={`${s}${i}`} symbol={s} size={22} />)}</span><span>= {need}</span></div>
              {info.fail && <p className="cr-line"><span className="kw">Fail: </span>{info.fail}</p>}
              {info.bonus && <p className="cr-line cr-optional"><span className="kw">Optional: </span>{info.bonus}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
