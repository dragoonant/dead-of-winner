// Screen-space effects (DOM, no per-frame work): the frost vignette that grows as morale falls and the short hit flashes. Both are pure CSS
// transitions and animations, so they cost nothing while the table is still.
import { useEffect, useState, type CSSProperties, type ReactElement } from 'react'
import { usePresentedStore, type Flash, type FlashKind } from '../presentation/presentedStore'
import { usePresentedView } from '../store/hooks'
import { useSettingsStore } from '../store/settingsStore'
import { frostStrength } from './overlayMath'

/** Frost creeping in from the screen edges: nothing while morale is healthy, a hard white-blue rim near zero. */
export function FrostVignette(): ReactElement | null {
  const v = usePresentedView()
  const speed = useSettingsStore((s) => s.speed)
  if (!v) return null
  const k = frostStrength(v.morale)
  const style = { ['--frost' as string]: k.toFixed(3), transition: speed <= 0 ? 'none' : undefined } as CSSProperties
  return <div className="frost-vignette" data-testid="frost-vignette" data-strength={k.toFixed(2)} style={style} aria-hidden="true" />
}

const FLASH_MS = 520
const FLASH_LABEL: Record<FlashKind, string> = { kill: 'Zombie killed', wound: 'Wound', frostbite: 'Frostbite', bite: 'Bite', death: 'Survivor lost' }

/** A short edge flash per hit: white for a kill, red for a wound or bite, blue for frostbite, dark red for a death. Replays only for a new flash id. */
export function HitFlash(): ReactElement | null {
  const flash = usePresentedStore((s) => s.flash)
  const [shown, setShown] = useState<Flash | null>(null)
  useEffect(() => {
    if (!flash) return
    setShown(flash)
    const t = setTimeout(() => setShown((s) => (s?.id === flash.id ? null : s)), FLASH_MS + 60)
    return () => clearTimeout(t)
  }, [flash])
  if (!shown) return null
  return <div key={shown.id} className={`hit-flash ${shown.kind}`} data-testid="hit-flash" data-kind={shown.kind} role="presentation" title={FLASH_LABEL[shown.kind]} />
}
