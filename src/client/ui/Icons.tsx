// Item symbol icons (original, simple SVG): one per ItemSymbol, plus a few HUD glyphs. Colours are fixed per symbol so a card reads at a glance.
import type { ReactElement } from 'react'

export const SYMBOL_COLOUR: Record<string, string> = {
  weapon: '#d6604d', fuel: '#e0a030', education: '#7fb2d6', food: '#8fc36b', medicine: '#e86a8a', tool: '#b0b6c0', survivor: '#c9a227',
}
export const SYMBOL_NAME: Record<string, string> = {
  weapon: 'Weapon', fuel: 'Fuel', education: 'Education', food: 'Food', medicine: 'Medicine', tool: 'Tool', survivor: 'Survivor',
}

export function SymbolIcon({ symbol, size = 18 }: { symbol: string; size?: number }): ReactElement {
  const c = SYMBOL_COLOUR[symbol] ?? '#999'
  const common = { width: size, height: size, viewBox: '0 0 24 24', role: 'img' as const, 'aria-label': SYMBOL_NAME[symbol] ?? symbol }
  switch (symbol) {
    case 'weapon': return (
      <svg {...common}><path d="M4 20 L18 6 M15 5 L19 9 M3 17 L7 21" stroke={c} strokeWidth="2.4" strokeLinecap="round" fill="none" /><path d="M20 20 L6 6 M5 9 L9 5" stroke={c} strokeWidth="2.4" strokeLinecap="round" fill="none" opacity=".55" /></svg>
    )
    case 'fuel': return (
      <svg {...common}><path d="M6 8h11v13H6z M9 8V5h5l2 3" fill={c} opacity=".9" /><rect x="9" y="12" width="5" height="5" rx="1" fill="#14161a" opacity=".45" /></svg>
    )
    case 'education': return (
      <svg {...common}><path d="M3 5c3-1 6-1 9 1 3-2 6-2 9-1v14c-3-1-6-1-9 1-3-2-6-2-9-1z" fill={c} opacity=".9" /><path d="M12 6v14" stroke="#14161a" strokeWidth="1.4" opacity=".5" /></svg>
    )
    case 'food': return (
      <svg {...common}><ellipse cx="12" cy="6" rx="6" ry="2.4" fill={c} /><path d="M6 6v12c0 1.4 2.7 2.4 6 2.4s6-1 6-2.4V6" fill={c} opacity=".8" /><path d="M6 11c0 1.4 2.7 2.4 6 2.4s6-1 6-2.4" stroke="#14161a" strokeWidth="1.2" fill="none" opacity=".45" /></svg>
    )
    case 'medicine': return (
      <svg {...common}><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" fill={c} opacity=".92" /></svg>
    )
    case 'tool': return (
      <svg {...common}><path d="M15 3a5 5 0 0 0-4.6 6.9L3 17.3 6.7 21l7.4-7.4A5 5 0 0 0 21 9l-3.2 3.2-3-.9-.9-3L17.1 5A5 5 0 0 0 15 3z" fill={c} opacity=".92" /></svg>
    )
    case 'survivor': return (
      <svg {...common}><circle cx="12" cy="7" r="3.6" fill={c} /><path d="M4.5 21c.6-5 3.4-8 7.5-8s6.9 3 7.5 8z" fill={c} opacity=".85" /></svg>
    )
    default: return <svg {...common}><circle cx="12" cy="12" r="8" fill={c} opacity=".6" /></svg>
  }
}

export function SymbolChips({ symbols, size = 16 }: { symbols: readonly string[]; size?: number }): ReactElement {
  return <span className="sym-chips">{symbols.map((s, i) => <SymbolIcon key={`${s}${i}`} symbol={s} size={size} />)}</span>
}

export function MoraleIcon({ size = 16 }: { size?: number }): ReactElement {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z" fill="#c9a227" /></svg>
}
export function ZombieIcon({ size = 16 }: { size?: number }): ReactElement {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="4" fill="#7ca66a" /><path d="M5 22c0-6 3-9 7-9s7 3 7 9z" fill="#7ca66a" opacity=".8" /><circle cx="10.5" cy="6.5" r=".9" fill="#14161a" /><circle cx="13.7" cy="6.5" r=".9" fill="#14161a" /></svg>
}
export function SnowIcon({ size = 16 }: { size?: number }): ReactElement {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7" stroke="#7fb2d6" strokeWidth="1.8" strokeLinecap="round" /></svg>
}
