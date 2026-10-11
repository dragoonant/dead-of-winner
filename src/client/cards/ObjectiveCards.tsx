// Objective cards: the main objective on a clipboard (SET UP, VICTORY, TIME), a secret objective as a worn lined note with a paperclip,
// a betrayal note with a red stamp, and the exiled variant with a hazard band. Text comes from the card data.
import type { ReactElement } from 'react'
import { nameOf, rec } from '../data'
import { PathIcon, WarnIcon } from '../ui/Icons'
import { CLIP_PATHS } from './iconPaths'
import type { CardSize } from './SurvivorCard'

const TIME: Record<string, string> = { short: 'Short', medium: 'Medium', long: 'Long' }

function ClipboardClip(): ReactElement {
  return (
    <svg className="mo-clip" viewBox="0 0 64 34" aria-hidden="true">
      <path d="M6 34V14c0-5 4-9 9-9h6c1-3 4-5 11-5s10 2 11 5h6c5 0 9 4 9 9v20z" fill="#8d949c" stroke="#3b4046" strokeWidth="1.6" />
      <rect x="20" y="9" width="24" height="9" rx="2" fill="#585e65" />
      <path d="M12 14h40" stroke="#c9ced3" strokeWidth="1.4" opacity="0.7" />
    </svg>
  )
}

export function MainObjectiveCard({ id, hardcore, size = 'md' }: { id: string; hardcore?: boolean; size?: CardSize }): ReactElement {
  const r = rec(id)
  const side = hardcore ? 'hardcore' : 'normal'
  const t = (r?.['text']?.[side] ?? {}) as { setup?: string; victory?: string }
  const name = hardcore && id.endsWith('x-weeks-of-darkness') ? 'Ten Weeks of Darkness' : nameOf(id)
  const time = TIME[(r?.['time'] as string | undefined) ?? ''] ?? ''
  return (
    <div className={`dcard ${size}`} data-card="main-objective" data-id={id}>
      <div className="dcard-face">
        <div className="mo-board" />
        <ClipboardClip />
        <div className="mo-sheet">
          <h4 style={name.length > 16 ? { fontSize: '9.2cqw' } : undefined}>{name}</h4>
          <div className="mo-sec"><h5><WarnIcon />Set up<WarnIcon /></h5><p className="ital">{t.setup ?? ''}</p></div>
          <div className="mo-sec"><h5>Victory</h5><p>{t.victory ?? ''}</p></div>
          {time && <div className="mo-sec time"><h5>Time</h5><p>{time}</p></div>}
        </div>
      </div>
    </div>
  )
}

type NoteKind = 'secret' | 'betrayal' | 'exiled'

export function SecretObjectiveCard({ id, kind, size = 'md' }: { id: string; kind?: NoteKind; size?: CardSize }): ReactElement {
  const r = rec(id)
  const type = (kind ?? (r?.['type'] as NoteKind | undefined) ?? 'secret') as NoteKind
  const goal = (r?.['text']?.['goal'] as string | undefined) ?? ''
  const betrayer = (r?.['text']?.['betrayer'] as string | undefined) ?? ''
  const main = !!r?.['requiresMain']
  return (
    <div className={`dcard land ${size} ${type === 'exiled' ? 'exiled' : ''}`} data-card={type === 'betrayal' ? 'betrayal' : type === 'exiled' ? 'exiled' : 'secret-objective'} data-id={id}>
      <div className="dcard-face note-face">
        <div className="note-lines" /><div className="note-margin" />
        <PathIcon className="note-clip" paths={CLIP_PATHS.map((p) => ({ ...p, sw: 2.2 }))} size={40} />
        <div className={`note-body ${type === 'betrayal' ? 'has-stamp' : ''}`}>
          <h4>{nameOf(id)}</h4>
          <div className="lbl">{type === 'exiled' ? 'Your exile goal' : 'Your secret goal'}</div>
          <p style={goal.length > 100 ? { fontSize: goal.length > 140 ? '4.9cqw' : '5.3cqw' } : undefined}>{goal}</p>
          {main && type !== 'betrayal' && <p className="sub">Only counts if the main objective is also complete.</p>}
          {type === 'exiled' && betrayer && <p className="sub">{betrayer}</p>}
        </div>
        {type === 'betrayal' && <div className="stamp">Betrayal!</div>}
        {type === 'exiled' && <div className="exile-band">Exiled</div>}
      </div>
    </div>
  )
}
export const BetrayalCard = (p: { id: string; size?: CardSize }): ReactElement => <SecretObjectiveCard {...p} kind="betrayal" />
export const ExiledCard = (p: { id: string; size?: CardSize }): ReactElement => <SecretObjectiveCard {...p} kind="exiled" />
