// SurvivorChip: the seat rail's miniature survivor card (portrait thumbnail, name plate, influence ring, attack and search), plus the
// floating full card that appears while a survivor is hovered in the rail or on the table.
import type { ReactElement } from 'react'
import { nameOf, survivorOccupation, survivorStats } from '../data'
import { useUiStore } from '../store/uiStore'
import { AttackIcon, SearchIcon } from '../ui/Icons'
import { usePortrait } from './art'
import { Silhouette, SurvivorCard } from './SurvivorCard'

export function SurvivorChip({ id, leader, wounds = 0, frostbite = 0 }: { id: string; leader?: boolean; wounds?: number; frostbite?: number }): ReactElement {
  const st = survivorStats(id)
  const art = usePortrait(id)
  return (
    <div className="sv-chip" data-card="survivor-chip" data-id={id}>
      <span className="thumb">{art ? <img src={art} alt="" draggable={false} /> : <Silhouette id={id} />}</span>
      <span className="info">
        <span className="nm">{leader ? '★ ' : ''}{nameOf(id)}</span>
        <span className="oc">{survivorOccupation(id)}{wounds > 0 || frostbite > 0 ? <span className="hurt"> {wounds > 0 ? `${wounds}w ` : ''}{frostbite > 0 ? `${frostbite}f` : ''}</span> : null}</span>
      </span>
      {st && (
        <span className="nums" title={`Influence ${st.influence}, attack ${st.attack}+, search ${st.search}+`}>
          <b className="inf">{st.influence}</b>
          <span><AttackIcon size={12} />{st.attack}+</span>
          <span><SearchIcon size={12} />{st.search}+</span>
        </span>
      )}
    </div>
  )
}

/** The big card for whichever survivor is hovered (rail row or figure on the table). Never takes pointer events. */
export function HoverSurvivorCard(): ReactElement | null {
  const id = useUiStore((s) => s.hoverSurvivor)
  if (!id) return null
  return <div className="hover-card" aria-hidden="true"><SurvivorCard id={id} size="lg" /></div>
}
