// SurvivorChip: the seat rail's miniature survivor card (portrait thumbnail, name plate, influence ring, attack and search). Hovering it
// shows the full card through the shared CardPreview.
import type { ReactElement } from 'react'
import { nameOf, survivorOccupation, survivorStats } from '../data'
import { AttackIcon, SearchIcon } from '../ui/Icons'
import { usePortrait } from './art'
import { previewProps } from './preview'
import { Silhouette } from './SurvivorCard'

export function SurvivorChip({ id, leader, wounds = 0, frostbite = 0 }: { id: string; leader?: boolean; wounds?: number; frostbite?: number }): ReactElement {
  const st = survivorStats(id)
  const art = usePortrait(id)
  return (
    <div className="sv-chip" data-card="survivor-chip" data-id={id} {...previewProps({ kind: 'survivor', id })}>
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
