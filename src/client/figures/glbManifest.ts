// Which figures render from a GLB (public/assets/models/<slug>.glb) instead of the procedural body. Adapted from the WarMForge figure pipeline:
// the manifest (public/assets/models/manifest.json) lists the slugs that exist on disk; a slug that is not listed is never requested, so a
// missing file can never log a 404 and the figure stays procedural. Survivors map by id (sv.alexis-grey -> alexis-grey), zombies are every
// slug that contains "zombie".
import { useEffect, useState } from 'react'
import { slugOf } from '../cards/art'

export interface GlbEntry { slug: string; url: string }

const BASE = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/'
export const glbUrl = (slug: string): string => `${BASE}assets/models/${slug}.glb`

const entries = new Map<string, GlbEntry>()
let manifestLoad: Promise<void> | undefined
const listeners = new Set<() => void>()

/** Accepts { slugs: [...] }, a bare array, or { models | figures | files: [...] }; items are slugs or { slug | id | name, file | url }. Anything else gives []. Pure (tests). */
export function parseGlbManifest(raw: unknown): GlbEntry[] {
  // Also accepts the pipeline's own shape: a top-level map { slug: { file, heightIn, tris } }.
  const list: unknown = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object'
      ? ((raw as Record<string, unknown>)['slugs'] ?? (raw as Record<string, unknown>)['models'] ?? (raw as Record<string, unknown>)['figures'] ?? (raw as Record<string, unknown>)['files'] ?? raw)
      : undefined
  const out: GlbEntry[] = []
  const add = (slugRaw: unknown, fileRaw?: unknown): void => {
    if (typeof slugRaw !== 'string') return
    const slug = slugRaw.replace(/\.glb$/i, '').replace(/^.*\//, '')
    if (!/^[a-z0-9._-]+$/i.test(slug)) return
    const file = typeof fileRaw === 'string' && /^[\w./-]+\.glb$/i.test(fileRaw) && !fileRaw.includes('..') ? fileRaw : null
    out.push({ slug, url: file ? `${BASE}assets/models/${file.replace(/^.*assets\/models\//, '')}` : glbUrl(slug) })
  }
  if (Array.isArray(list)) {
    for (const it of list) {
      if (typeof it === 'string') add(it)
      else if (it && typeof it === 'object') { const o = it as Record<string, unknown>; add(o['slug'] ?? o['id'] ?? o['name'] ?? o['file'], o['file'] ?? o['url']) }
    }
  } else if (list && typeof list === 'object') {
    for (const [k, v] of Object.entries(list as Record<string, unknown>)) {
      const o = v && typeof v === 'object' ? (v as Record<string, unknown>) : undefined
      add(k, o ? (o['file'] ?? o['url']) : v)
    }
  }
  return out
}

/** Fetch the manifest once (never throws and never logs; a missing or malformed manifest leaves everything procedural). */
export function loadGlbManifest(): Promise<void> {
  if (manifestLoad) return manifestLoad
  manifestLoad = (async () => {
    try {
      if (typeof fetch === 'undefined' || typeof location === 'undefined') return
      const res = await fetch(`${BASE}assets/models/manifest.json`, { cache: 'no-cache' })
      const type = res.headers.get('content-type') ?? ''
      if (res.ok && !type.includes('text/html')) for (const e of parseGlbManifest(await res.json())) entries.set(e.slug, e)
    } catch { /* offline or malformed: everything stays procedural */ }
    listeners.forEach((l) => l())
  })()
  return manifestLoad
}

/** Test hook: set the manifest directly. */
export function setGlbManifestForTest(slugs: readonly string[]): void {
  entries.clear()
  for (const s of slugs) entries.set(s, { slug: s, url: glbUrl(s) })
  manifestLoad = Promise.resolve()
}

/** Re-renders the caller once the manifest has loaded, so a figure picks up a GLB that is listed there. */
export function useGlbManifest(): number {
  const [, tick] = useState(0)
  useEffect(() => {
    const l = (): void => tick((n) => n + 1)
    listeners.add(l)
    void loadGlbManifest().then(l)
    return () => { listeners.delete(l) }
  }, [])
  return entries.size
}

export const glbEntry = (slug: string): GlbEntry | undefined => entries.get(slug)
export const glbSlugs = (): string[] => [...entries.keys()].sort()

/** The manifest slug for a survivor id, or undefined (procedural). */
export function survivorSlug(id: string): string | undefined {
  const s = slugOf(id)
  return [id, s, `sv-${s}`, `sv.${s}`, `survivor-${s}`, `survivor.${s}`].find((c) => entries.has(c) && !isZombieSlug(c))
}
export const isZombieSlug = (slug: string): boolean => /zombie/i.test(slug)
/** Every listed zombie model. */
export const zombieSlugs = (): string[] => glbSlugs().filter(isZombieSlug)
