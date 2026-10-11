// CrossroadsCard: the title, an italic trigger line, the story, then two options under chevron bands. `renderOption` lets a prompt turn each
// option into a button while the card keeps the printed layout.
import { Fragment, type ReactElement, type ReactNode } from 'react'
import { nameOf, rec } from '../data'
import { previewProps } from './preview'
import type { CardSize } from './SurvivorCard'

export function CrossroadsCard({ id, size = 'xl', renderOption, preview = true }: {
  /** Hover or long-press shows the full card. */
  preview?: boolean
  id: string | undefined
  size?: CardSize
  /** Wraps the option text (return a button); the card passes the option id, its 0-based index and its text. */
  renderOption?: (optionId: string, index: number, text: string) => ReactNode
}): ReactElement {
  const r = rec(id)
  const text = (r?.['text'] ?? {}) as { trigger?: string; vignette?: string; options?: Record<string, string> }
  const optIds = ((r?.['options'] as { id: string }[] | undefined)?.map((o) => o.id)) ?? Object.keys(text.options ?? {})
  const options = optIds.map((oid) => [oid, text.options?.[oid] ?? ''] as const)
  return (
    <div className={`dcard fluid ${size}`} data-card="crossroads" data-id={id ?? ''} {...(preview ? previewProps({ kind: 'crossroads', id }) : {})}>
      <div className="dcard-face xr-face">
        <div className="xr-body">
          <h4>{nameOf(id)}</h4>
          {text.trigger && <p className="trig"><b>{text.trigger}</b></p>}
          <p className="story">{text.vignette ?? ''}</p>
          <div className="xr-opts opt-list">
            {options.map(([oid, t], i) => (
              <Fragment key={oid}>
                <div className={`xr-band ${i === 1 ? 'two' : ''}`}>Option {i + 1}</div>
                {renderOption ? renderOption(oid, i, t) : <p className="xr-opt">{t}</p>}
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
