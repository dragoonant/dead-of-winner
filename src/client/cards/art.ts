// Optional art: portraits (public/assets/portraits/<slug>.webp, or <full id>.webp), location art (public/assets/locations/<id>.webp) and the title image
// (public/assets/ui/title.webp). Files are produced separately and may not exist yet, so every lookup is a probe that falls back to a
// stylised silhouette / texture. Each URL is probed at most once per session; nothing here ever throws.
import { useEffect, useState } from 'react'

const BASE = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/'
export const assetUrl = (path: string): string => `${BASE}${path.replace(/^\//, '')}`
export const textureUrl = (name: string): string => assetUrl(`textures/${name}`)

/** 'sv.alexis-grey' -> 'alexis-grey' */
export const slugOf = (id: string): string => id.replace(/^[a-z]+\./, '')

const result = new Map<string, string | null>() // url -> url when it loaded, null when it did not
const pending = new Map<string, Promise<string | null>>()

function probeOne(url: string): Promise<string | null> {
  if (result.has(url)) return Promise.resolve(result.get(url) ?? null)
  let p = pending.get(url)
  if (!p) {
    p = new Promise<string | null>((resolve) => {
      if (typeof Image === 'undefined') { resolve(null); return }
      const img = new Image()
      img.onload = () => { result.set(url, url); resolve(url) }
      img.onerror = () => { result.set(url, null); resolve(null) }
      img.src = url
    }).finally(() => pending.delete(url))
    pending.set(url, p)
  }
  return p
}

/** Resolve to the first candidate that loads as an image, or null. */
export async function probeArt(urls: readonly string[]): Promise<string | null> {
  for (const u of urls) {
    const hit = await probeOne(u)
    if (hit) return hit
  }
  return null
}

function knownSync(urls: readonly string[]): string | null | undefined {
  for (const u of urls) {
    const r = result.get(u)
    if (r) return r
    if (r === undefined) return undefined // not all candidates are known yet
  }
  return null
}

/** The first candidate that loads, or null while loading and when none exists. Re-renders once when the answer is known. */
export function useArt(urls: readonly string[]): string | null {
  const key = urls.join('|')
  const [url, setUrl] = useState<string | null>(() => knownSync(urls) ?? null)
  useEffect(() => {
    let alive = true
    const k = knownSync(urls)
    if (k !== undefined) { setUrl(k); return }
    void probeArt(urls).then((u) => { if (alive) setUrl(u) })
    return () => { alive = false }
    // the key stands for the list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return url
}

export const portraitCandidates = (survivorId: string): string[] => [
  assetUrl(`assets/portraits/${slugOf(survivorId)}.webp`), assetUrl(`assets/portraits/${survivorId}.webp`),
]
export const locationCandidates = (locationId: string): string[] => [
  assetUrl(`assets/locations/${slugOf(locationId)}.webp`), assetUrl(`assets/locations/${locationId}.webp`),
]
export const titleCandidates = (): string[] => [assetUrl('assets/ui/title.webp')]

export const usePortrait = (survivorId: string): string | null => useArt(portraitCandidates(survivorId))
export const useLocationArt = (locationId: string): string | null => useArt(locationCandidates(locationId))

/** A stable 0..1 hash of a string, for per-card tints. */
export function hash01(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return ((h >>> 0) % 10007) / 10007
}

// ---------- fonts ----------
let fontsPromise: Promise<void> | null = null
/** Resolves once the two card fonts are usable (or after a short timeout): canvas text must wait for them. */
export function ensureFonts(): Promise<void> {
  if (fontsPromise) return fontsPromise
  fontsPromise = (async () => {
    if (typeof document === 'undefined' || !document.fonts) return
    const loads = Promise.all([
      document.fonts.load('40px "Bebas Neue"'), document.fonts.load('20px "Crimson Text"'),
      document.fonts.load('italic 20px "Crimson Text"'), document.fonts.load('600 20px "Crimson Text"'),
    ]).then(() => undefined, () => undefined)
    await Promise.race([loads, new Promise<void>((r) => setTimeout(r, 2500))])
  })()
  return fontsPromise
}
