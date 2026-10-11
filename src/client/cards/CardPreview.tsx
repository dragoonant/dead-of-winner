// CardPreview: the one full-size card overlay shared by every card in the game. A portal on <body>, fixed-positioned beside the cursor (or the
// pressed / hovered element), clamped inside the viewport, and pointer-events: none so it can never take the hover away from what opened it.
import { useEffect, useLayoutEffect, useRef, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { CrisisCard } from './CrisisCard'
import { CrossroadsCard } from './CrossroadsCard'
import { ItemCard } from './ItemCard'
import { MainObjectiveCard, SecretObjectiveCard } from './ObjectiveCards'
import { hidePreview, usePreviewStore } from './preview'
import { placePreview, previewCardSize, type PreviewSpec, type Size } from './previewModel'
import { SurvivorCard } from './SurvivorCard'

function Face({ spec, size }: { spec: PreviewSpec; size: 'lg' | 'xl' }): ReactElement | null {
  switch (spec.kind) {
    case 'survivor': return <SurvivorCard id={spec.id} size={size} preview={false} />
    case 'item': return <ItemCard defId={spec.defId} size={size} preview={false} />
    case 'crisis': return <CrisisCard id={spec.id} size={size} preview={false} />
    case 'main': return <MainObjectiveCard id={spec.id} hardcore={spec.hardcore} size={size} preview={false} />
    case 'note': return <SecretObjectiveCard id={spec.id} kind={spec.note} size={size} preview={false} />
    case 'crossroads': return <CrossroadsCard id={spec.id} size={size} preview={false} />
  }
}

/** Mounted once, at the app root. */
export function CardPreview(): ReactElement | null {
  const { spec, point, box, prefer, size: forced, source } = usePreviewStore()
  const ref = useRef<HTMLDivElement>(null)
  const [measured, setMeasured] = useState<Size>({ w: 0, h: 0 })

  // measure the real card (Crossroads cards have no fixed height) before it paints, so the first frame is already clamped
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const w = el.offsetWidth
    const h = el.offsetHeight
    if (w !== measured.w || h !== measured.h) setMeasured({ w, h })
  })

  // a clicked card can leave the page without a pointerleave; close the preview rather than strand it
  useEffect(() => {
    if (!spec) return
    const t = setInterval(() => { if (source && !source.isConnected) hidePreview() }, 150)
    const off = (): void => hidePreview()
    window.addEventListener('blur', off)
    window.addEventListener('resize', off)
    return () => { clearInterval(t); window.removeEventListener('blur', off); window.removeEventListener('resize', off) }
  }, [spec, source])

  if (!spec || typeof document === 'undefined') return null
  const viewport = { w: window.innerWidth, h: window.innerHeight }
  const size = forced ?? previewCardSize(spec, viewport.h)
  const pos = placePreview({
    ...(point ? { point } : {}), ...(box ? { box } : {}), prefer, size: measured, viewport, topInset: 48,
  })
  return createPortal(
    <div
      ref={ref}
      className="card-preview"
      aria-hidden="true"
      data-testid="card-preview"
      data-preview-kind={spec.kind}
      style={{ left: pos.left, top: pos.top, visibility: measured.w === 0 ? 'hidden' : 'visible' }}
    >
      <Face spec={spec} size={size} />
    </div>,
    document.body,
  )
}
