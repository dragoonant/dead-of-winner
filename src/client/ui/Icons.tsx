// Item symbol icons and HUD glyphs (original, simple SVG). The artwork lives in cards/iconPaths.ts so the 3D board paints the same drawings.
import type { ReactElement } from 'react'
import {
  ATTACK_PATHS, CLIP_PATHS, MORALE_PATHS, NOISE_PATHS, SEARCH_PATHS, SKULL_PATHS, SNOW_PATHS, SYMBOL_COLOUR, SYMBOL_NAME, WARN_PATHS, ZOMBIE_PATHS,
  symbolPaths, type IconPath,
} from '../cards/iconPaths'

export { SYMBOL_COLOUR, SYMBOL_NAME }

export function PathIcon({ paths, size = 18, label, className, style }: { paths: IconPath[]; size?: number; label?: string; className?: string; style?: React.CSSProperties }): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} focusable="false">
      {paths.map((p, i) => (
        <path key={i} d={p.d} fill={p.fill ?? 'none'} stroke={p.stroke} strokeWidth={p.sw} strokeLinecap="round" strokeLinejoin="round" opacity={p.op} />
      ))}
    </svg>
  )
}

export function SymbolIcon({ symbol, size = 18 }: { symbol: string; size?: number }): ReactElement {
  return <PathIcon paths={symbolPaths(symbol)} size={size} label={SYMBOL_NAME[symbol] ?? symbol} />
}

export function SymbolChips({ symbols, size = 16 }: { symbols: readonly string[]; size?: number }): ReactElement {
  return <span className="sym-chips">{symbols.map((s, i) => <SymbolIcon key={`${s}${i}`} symbol={s} size={size} />)}</span>
}

export const AttackIcon = ({ size = 16 }: { size?: number }): ReactElement => <PathIcon paths={ATTACK_PATHS} size={size} />
export const SearchIcon = ({ size = 16 }: { size?: number }): ReactElement => <PathIcon paths={SEARCH_PATHS} size={size} />
export const NoiseIcon = ({ size = 16 }: { size?: number }): ReactElement => <PathIcon paths={NOISE_PATHS} size={size} />
export const WarnIcon = ({ size = 16 }: { size?: number }): ReactElement => <PathIcon paths={WARN_PATHS} size={size} />
export const PaperclipIcon = ({ size = 16 }: { size?: number }): ReactElement => <PathIcon paths={CLIP_PATHS} size={size} />
export const SkullIcon = ({ size = 16 }: { size?: number }): ReactElement => <PathIcon paths={SKULL_PATHS} size={size} />
export const MoraleIcon = ({ size = 16 }: { size?: number }): ReactElement => <PathIcon paths={MORALE_PATHS} size={size} />
export const ZombieIcon = ({ size = 16 }: { size?: number }): ReactElement => <PathIcon paths={ZOMBIE_PATHS} size={size} />
export const SnowIcon = ({ size = 16 }: { size?: number }): ReactElement => <PathIcon paths={SNOW_PATHS} size={size} />
