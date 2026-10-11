// SurvivorCard: portrait panel, paper name plate with the occupation, the red-ringed influence number (top right), attack and search values with
// their icons, and the ability box that opens with the location keyword. Without a portrait file it paints a stylised silhouette.
import type { CSSProperties, ReactElement } from 'react'
import { nameOf, survivorAbility, survivorAbilityKeyword, survivorOccupation, survivorStats } from '../data'
import { AttackIcon, SearchIcon } from '../ui/Icons'
import { hash01, textureUrl, usePortrait } from './art'
import { previewProps } from './preview'

export type CardSize = 'sm' | 'pk' | 'md' | 'lg' | 'xl'

/** The stand-in portrait: a snowy dusk panel with a hooded bust, tinted per survivor so a hand of cards is still told apart. */
export function Silhouette({ id }: { id: string }): ReactElement {
  const h = Math.round(185 + hash01(id) * 60)
  const bg: CSSProperties = { background: `radial-gradient(ellipse at 50% 30%, hsl(${h} 22% 46%), hsl(${h + 8} 28% 18%) 80%)` }
  const body = `hsl(${h} 25% 9%)`
  return (
    <div className="sil" style={bg} aria-hidden="true">
      <svg viewBox="0 0 100 140" width="100%" height="100%" preserveAspectRatio="xMidYMax slice">
        <path d="M12 140C14 108 30 92 50 92s36 16 38 48z" fill={body} />
        <ellipse cx="50" cy="64" rx="15" ry="18" fill={body} />
        <path d="M33 66c-2-20 6-31 17-31s19 11 17 31c-3-9-9-13-17-13s-14 4-17 13z" fill={`hsl(${h} 22% 18%)`} />
        <path d="M44 92l6 14 6-14z" fill={`hsl(${h} 16% 30%)`} opacity="0.7" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, background: `url(${textureUrl('snow-flecks.webp')}) center / 50% auto`, opacity: 0.55 }} />
    </div>
  )
}

export function SurvivorCard({ id, size = 'md', selected, mini, preview = true }: { id: string; size?: CardSize; selected?: boolean; mini?: boolean; /** Hover or long-press shows the full card (off inside the preview itself). */ preview?: boolean }): ReactElement {
  const st = survivorStats(id)
  const art = usePortrait(id)
  const name = nameOf(id)
  const kw = survivorAbilityKeyword(id)
  const ability = survivorAbility(id)
  return (
    <div className={`dcard ${size} ${selected ? 'sel' : ''} ${mini ? 'mini' : ''}`} data-card="survivor" data-id={id} {...(preview ? previewProps({ kind: 'survivor', id }) : {})}>
      <div className="dcard-face">
        <div className="sv-art">{art ? <img src={art} alt="" draggable={false} /> : <Silhouette id={id} />}</div>
        <div className="sv-name">
          <div className="nm" style={name.length > 14 ? { fontSize: '7.8cqw' } : undefined}>{name}</div>
          <div className="oc">{survivorOccupation(id)}</div>
        </div>
        {st && (
          <>
            <div className="sv-inf" title="Influence"><b>{st.influence}</b></div>
            <div className="sv-stats">
              <span className="sv-stat" title={`Attack: hits on ${st.attack}+`}><AttackIcon />{st.attack}+</span>
              <span className="sv-stat" title={`Search: finds on ${st.search}+`}><SearchIcon />{st.search}+</span>
            </div>
          </>
        )}
        <div className="sv-ab">
          {ability ? <>{kw && <span className="kw">{kw}: </span>}{ability}</> : <span className="none">No special ability.</span>}
        </div>
      </div>
    </div>
  )
}
