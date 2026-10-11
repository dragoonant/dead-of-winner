// Generates the audio assets listed in tools/audio-manifest.json via the ElevenLabs API.
// SFX and voice go to public/audio/<id>.mp3, music to public/audio/music/<id>.mp3.
// Idempotent: a file that already exists on disk is skipped, so reruns never re-spend credits.
//
//   export ELEVENLABS_API_KEY="$(python -I -c "s=open('tokens.txt.txt',encoding='utf-8-sig').read().strip(); print(s.split('=',1)[1].strip())")"
//   npx tsx tools/gen-audio.ts [options]
//
// Options:
//   --kind=sfx,voice      kinds to generate (default sfx,voice; music costs far more, so it is opt-in)
//   --only=prefix         only ids starting with this prefix
//   --max-credits=N       per-run credit ceiling: stop before a call whose estimate would take this run past N (default 3000)
//   --ceiling=N           account ceiling: character_count must never be taken past N (default: none)
//   --dry                 list what would be generated, no key and no spend
//
// The key is read from the environment only and is never printed or written.
// A 5xx is still charged by ElevenLabs, so only 429 is retried; three failures in a row stop the run.

import { mkdir, readFile, writeFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

const REPO_ROOT = join(import.meta.dirname, '..')
const MANIFEST_PATH = join(REPO_ROOT, 'tools', 'audio-manifest.json')
const OUT_DIR = join(REPO_ROOT, 'public', 'audio')
const MUSIC_DIR = join(OUT_DIR, 'music')

type Kind = 'sfx' | 'voice' | 'music'
interface Item {
  id: string; kind: Kind; group: string
  prompt?: string; text?: string; durationSeconds?: number; promptInfluence?: number; loop?: boolean; voice?: string
}
interface VoiceProfile { name: string; voiceId: string; settings: Record<string, number> }
interface Manifest {
  voices: Record<string, VoiceProfile>
  voiceModelId: string
  music: { endpoint: string; modelId: string; forceInstrumental: boolean; outputFormat: string }
  items: Item[]
}
interface Subscription { character_count: number; character_limit: number }

const args = process.argv.slice(2)
const flag = (name: string): string | undefined => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const dry = args.includes('--dry')
const kinds = new Set((flag('kind') ?? 'sfx,voice').split(','))
const only = flag('only') ?? ''
const MAX_CREDITS = Number(flag('max-credits') ?? 3000)
const ACCOUNT_CEILING = flag('ceiling') ? Number(flag('ceiling')) : Infinity

function apiKey(): string {
  const key = process.env['ELEVENLABS_API_KEY']
  if (!key) throw new Error('ELEVENLABS_API_KEY is not set. Load it from the token file inside the same shell command.')
  return key
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

async function withRetry<T>(label: string, fn: () => Promise<T>, maxAttempts = 5): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const rateLimited = err instanceof Error && err.message.includes(' 429')
      if (!rateLimited || attempt >= maxAttempts) throw err
      const backoffMs = 1000 * 2 ** (attempt - 1)
      console.log(`[gen-audio] ${label} rate-limited, retrying in ${backoffMs}ms (attempt ${attempt}/${maxAttempts})`)
      await sleep(backoffMs)
    }
  }
}

async function fetchSubscription(key: string): Promise<Subscription> {
  return withRetry('subscription check', async () => {
    const res = await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': key } })
    if (!res.ok) throw new Error(`GET /v1/user/subscription failed: ${res.status}`)
    return (await res.json()) as Subscription
  })
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path)
    return s.isFile() && s.size > 0
  } catch {
    return false
  }
}

const outPathFor = (item: Item): string => join(item.kind === 'music' ? MUSIC_DIR : OUT_DIR, `${item.id}.mp3`)

async function post(label: string, url: string, key: string, body: unknown): Promise<Buffer> {
  return withRetry(label, async () => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`${label} failed: ${res.status} ${(await res.text()).slice(0, 300)}`)
    return Buffer.from(await res.arrayBuffer())
  })
}

const generateSfx = (key: string, item: Item) =>
  post(`sound-generation "${item.id}"`, 'https://api.elevenlabs.io/v1/sound-generation', key, {
    text: item.prompt,
    duration_seconds: item.durationSeconds,
    prompt_influence: item.promptInfluence,
    ...(item.loop ? { loop: true } : {}),
  })

function generateVoice(key: string, m: Manifest, item: Item): Promise<Buffer> {
  const v = m.voices[item.voice ?? 'narrator']
  if (!v) throw new Error(`no voice profile "${item.voice}" for ${item.id}`)
  return post(`text-to-speech "${item.id}"`, `https://api.elevenlabs.io/v1/text-to-speech/${v.voiceId}?output_format=mp3_44100_64`, key, {
    text: item.text,
    model_id: m.voiceModelId,
    voice_settings: v.settings,
  })
}

// ElevenLabs Music: POST /v1/music?output_format=..., body {prompt, music_length_ms (3000-600000), model_id, force_instrumental}.
const generateMusic = (key: string, m: Manifest, item: Item) =>
  post(`music "${item.id}"`, `https://api.elevenlabs.io${m.music.endpoint}?output_format=${m.music.outputFormat}`, key, {
    prompt: item.prompt,
    music_length_ms: Math.round((item.durationSeconds ?? 30) * 1000),
    model_id: m.music.modelId,
    force_instrumental: m.music.forceInstrumental,
  })

async function main(): Promise<void> {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8')) as Manifest
  const todo: Item[] = []
  let skipped = 0
  for (const item of manifest.items) {
    if (!kinds.has(item.kind) || !item.id.startsWith(only)) continue
    if (await fileExists(outPathFor(item))) skipped++
    else todo.push(item)
  }

  if (dry) {
    for (const item of todo) console.log(`[gen-audio] would generate ${item.kind} ${item.id}`)
    console.log(`[gen-audio] dry run: ${todo.length} to generate, ${skipped} already present`)
    return
  }

  const key = apiKey()
  await mkdir(OUT_DIR, { recursive: true })
  await mkdir(MUSIC_DIR, { recursive: true })

  const before = await fetchSubscription(key)
  console.log(`[gen-audio] account credits before: ${before.character_count}/${before.character_limit}; run budget ${MAX_CREDITS}${Number.isFinite(ACCOUNT_CEILING) ? `; account ceiling ${ACCOUNT_CEILING}` : ''}`)

  // Cost model. The usage counter lags a call by a few seconds and the endpoint rate-limits, so it is read once per batch of
  // calls (not per call): in between, the budget is gated on the running local estimate (sfx per call, voice per character,
  // music per second), and each batch re-learns the rate from the real counter delta.
  const rate = { sfx: 40, voice: 1, music: 12.5 }
  const estimate = (item: Item): number =>
    item.kind === 'sfx' ? rate.sfx : item.kind === 'voice' ? Math.ceil((item.text?.length ?? 0) * rate.voice) : Math.ceil((item.durationSeconds ?? 30) * rate.music)

  let spent = 0
  let count = before.character_count
  let generated = 0
  let failures = 0
  let stopped = ''
  let batch: Item[] = []
  let batchEst = 0
  const BATCH = flag('batch') ? Number(flag('batch')) : 6

  const sync = async (final = false): Promise<void> => {
    if (batch.length === 0) return
    await sleep(5000)
    const after = await fetchSubscription(key)
    const delta = Math.max(0, after.character_count - count)
    if (delta === 0 && batch.length > 0 && !final) { console.log('[gen-audio] counter has not moved yet; keeping the batch pending'); return }
    // learn the rate when the batch is a single kind
    const kind = batch[0]!.kind
    if (batch.every((i) => i.kind === kind) && delta > 0) {
      if (kind === 'sfx') rate.sfx = Math.max(10, Math.ceil((delta / batch.length) * 1.25))
      else if (kind === 'voice') rate.voice = (delta / batch.reduce((n, i) => n + (i.text?.length ?? 0), 0)) * 1.25
      else rate.music = (delta / batch.reduce((n, i) => n + (i.durationSeconds ?? 0), 0)) * 1.1
    }
    spent += delta
    count = after.character_count
    console.log(`[gen-audio] synced: +${delta} credits for ${batch.length} calls, ${spent} spent this run, account at ${count} (rates: sfx ${rate.sfx}/call, voice ${rate.voice.toFixed(2)}/char, music ${rate.music.toFixed(1)}/s)`)
    batch = []
    batchEst = 0
  }

  for (const item of todo) {
    const est = estimate(item)
    if (count + batchEst + est > ACCOUNT_CEILING) { stopped = `account ceiling ${ACCOUNT_CEILING} (at ${count}+${batchEst}, next ${item.id} estimated ${est})`; break }
    if (spent + batchEst + est > MAX_CREDITS) { stopped = `run budget ${MAX_CREDITS} (spent ${spent}+${batchEst}, next ${item.id} estimated ${est})`; break }
    try {
      const audio =
        item.kind === 'sfx' ? await generateSfx(key, item)
        : item.kind === 'voice' ? await generateVoice(key, manifest, item)
        : await generateMusic(key, manifest, item)
      await writeFile(outPathFor(item), audio)
      generated++
      failures = 0
      batch.push(item)
      batchEst += est
      console.log(`[gen-audio] generated ${item.id}.mp3 (${item.kind}, est ${est})`)
      if (batch.length >= BATCH || item.kind === 'music') await sync()
      else await sleep(400)
    } catch (err) {
      failures++
      console.error(`[gen-audio] FAILED "${item.id}": ${err instanceof Error ? err.message : String(err)}`)
      // a 5xx may still have been charged: count the estimate as spent
      batch.push(item)
      batchEst += est
      if (failures >= 3) { stopped = '3 failures in a row'; break }
      await sleep(1500)
    }
  }
  await sync(true)

  const end = await fetchSubscription(key)
  console.log(`[gen-audio] account credits after: ${end.character_count}/${end.character_limit}`)
  console.log(`[gen-audio] done: ${generated} generated, ${skipped} already present, ${spent} credits spent${stopped ? `; stopped early: ${stopped}` : ''}`)
}

main().catch((err) => {
  console.error('[gen-audio] fatal:', err instanceof Error ? err.message : err)
  process.exitCode = 1
})
