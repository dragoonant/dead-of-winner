// Builds the audio manifest and its two mirrors. Safe to rerun at any time:
//   - tools/audio-manifest.json   items are MERGED: an existing id is kept exactly as it is (hand edits survive), new ids are added;
//                                 Crossroads and persona voice items are derived from src/data/{crossroads,personas}.
//   - src/client/audio/manifest.ts   runtime mirror (ids, kinds, groups, loop flags, persona line templates), always rewritten.
//   - public/sounds.html          audition page, always rewritten.
// Run: npx tsx tools/audio-build-manifest.ts
import { existsSync } from 'node:fs'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { CROSSROADS_VOICED, MUSIC, NARRATOR, SAMPLE_LINE, SFX, VOICES, spokenLine } from './audio-content'

const root = join(import.meta.dirname, '..')
const MANIFEST = join(root, 'tools', 'audio-manifest.json')
const RUNTIME = join(root, 'src', 'client', 'audio', 'manifest.ts')
const PAGE = join(root, 'public', 'sounds.html')

interface Item {
  id: string; kind: 'sfx' | 'voice' | 'music'; group: string
  prompt?: string; text?: string; durationSeconds?: number; promptInfluence?: number; loop?: boolean
  voice?: string; persona?: string; key?: string; template?: string; card?: string
}

const existing: { items: Item[] } | null = existsSync(MANIFEST) ? JSON.parse(await readFile(MANIFEST, 'utf8')) : null
const byId = new Map<string, Item>((existing?.items ?? []).map((i) => [i.id, i]))
const order: string[] = []
const add = (item: Item): void => {
  order.push(item.id)
  if (!byId.has(item.id)) byId.set(item.id, item)
}

for (const s of SFX) add({ id: s.id, kind: 'sfx', group: s.group, prompt: s.prompt, durationSeconds: s.durationSeconds, promptInfluence: s.promptInfluence, ...(s.loop ? { loop: true } : {}) })
for (const n of NARRATOR) add({ id: n.id, kind: 'voice', group: n.group, voice: 'narrator', text: n.text })
add({ id: 'sample-narrator', kind: 'voice', group: 'narrator audition', voice: 'narrator', text: SAMPLE_LINE })
add({ id: 'sample-alt-josh', kind: 'voice', group: 'narrator audition', voice: 'alt-josh', text: SAMPLE_LINE })
add({ id: 'sample-alt-remmy', kind: 'voice', group: 'narrator audition', voice: 'alt-remmy', text: SAMPLE_LINE })

// Crossroads: the story text of every card present in src/data/crossroads, recorded by card id.
for (const f of (await readdir(join(root, 'src', 'data', 'crossroads'))).filter((x) => x.endsWith('.json')).sort()) {
  const card = JSON.parse(await readFile(join(root, 'src', 'data', 'crossroads', f), 'utf8')) as { id: string; name?: string; text?: { vignette?: string } }
  const vignette = card.text?.vignette?.trim()
  if (!vignette) continue
  if (!process.argv.includes('--all-crossroads') && !CROSSROADS_VOICED.includes(card.id.replace(/^xr\./, ''))) continue
  add({ id: `vo-xr-${card.id.replace(/^xr\./, '')}`, kind: 'voice', group: 'crossroads', voice: 'narrator', card: card.id, text: vignette })
}

// Personas: every line in every bank, keyed by persona, event key and bank position. Lines marked `voiced: false` are text-only until someone prices their recordings (they keep their position, so ids never shift).
for (const f of (await readdir(join(root, 'src', 'data', 'personas'))).filter((x) => x.endsWith('.json')).sort()) {
  const p = JSON.parse(await readFile(join(root, 'src', 'data', 'personas', f), 'utf8')) as { id: string; name: string; lines: Record<string, { text: string; voiced?: boolean }[]> }
  const short = p.id.replace(/^ps\./, '')
  if (!VOICES[short]) { console.warn(`[audio-build-manifest] no voice profile for persona ${p.id}; its lines stay unvoiced`); continue }
  for (const [key, bank] of Object.entries(p.lines)) {
    bank.forEach((line, i) => line.voiced === false ? undefined : add({
      id: `pv-${short}-${key.replace(/\./g, '-')}-${i}`, kind: 'voice', group: `persona: ${p.name}`, voice: short, persona: short, key,
      template: line.text, text: spokenLine(line.text, key),
    }))
  }
}

for (const m of MUSIC) add({ id: m.id, kind: 'music', group: m.group, prompt: m.prompt, durationSeconds: m.durationSeconds, ...(m.loop ? { loop: true } : {}) })

// keep hand-added items that are not part of the authored lists, after the authored ones
for (const id of byId.keys()) if (!order.includes(id)) order.push(id)
const items = order.map((id) => byId.get(id)!).filter((i) => i.group !== 'crossroads' || process.argv.includes('--all-crossroads') || CROSSROADS_VOICED.includes(i.id.replace(/^vo-xr-/, '')))

const manifest = {
  _comment: 'Owned by the audio task. All prompts and lines are original wording. `npx tsx tools/audio-build-manifest.ts` merges new items in (never overwrites existing ones); `npx tsx tools/gen-audio.ts` generates missing files into public/audio/<id>.mp3 (music into public/audio/music/<id>.mp3). Mirrored by src/client/audio/manifest.ts.',
  voices: VOICES,
  voiceModelId: 'eleven_flash_v2_5',
  music: { endpoint: '/v1/music', modelId: 'music_v1', forceInstrumental: true, outputFormat: 'mp3_44100_128' },
  items,
}
await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n')

// ---------- runtime mirror ----------
const rt = items.map((i) => {
  const o: Record<string, unknown> = { id: i.id, kind: i.kind, group: i.group }
  if (i.loop) o['loop'] = true
  if (i.kind === 'voice') o['bus'] = i.persona ? 'voices' : 'narrator'
  if (i.persona) { o['persona'] = i.persona; o['key'] = i.key; o['template'] = i.template }
  if (i.card) o['card'] = i.card
  return o
})
const header = `// GENERATED by tools/audio-build-manifest.ts from tools/audio-manifest.json: do not edit by hand.
// Runtime mirror of the manifest (ids, kinds, groups, loop flags, persona line templates). Prompts stay in the tools file.
// SFX and voice live at audio/<id>.mp3, music at audio/music/<id>.mp3 (relative to the site base).
export type AudioKind = 'sfx' | 'voice' | 'music'
export type VoiceBus = 'narrator' | 'voices'

export interface AudioAsset {
  id: string
  kind: AudioKind
  group: string
  loop?: boolean
  /** Voice only: the narrator bus (narration, Crossroads, objective intros) or the persona voices bus. */
  bus?: VoiceBus
  /** Persona line: persona short id, event key and the bank text with {slots}. */
  persona?: string
  key?: string
  template?: string
  /** Crossroads narration: the card id it reads. */
  card?: string
}

export const AUDIO_ASSETS: readonly AudioAsset[] = [
${rt.map((o) => `  { ${Object.entries(o).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')} },`).join('\n')}
]

export const AUDIO_BY_ID: Record<string, AudioAsset> = Object.fromEntries(AUDIO_ASSETS.map((a) => [a.id, a]))

/** Path of an asset's file relative to the site base. */
export function audioPath(a: Pick<AudioAsset, 'id' | 'kind'>): string {
  return a.kind === 'music' ? \`audio/music/\${a.id}.mp3\` : \`audio/\${a.id}.mp3\`
}
`
await writeFile(RUNTIME, header)

// ---------- audition page ----------
const page = items.map((i) => ({
  id: i.id, kind: i.kind, group: i.group, note: i.kind === 'voice' ? `${VOICES[i.voice ?? 'narrator']?.name ?? ''}: ${i.text}` : i.prompt, dur: i.durationSeconds ?? 0, loop: !!i.loop,
}))
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dead of Winner sounds</title>
<style>
:root{--bg:#10151b;--fg:#dde6ee;--mut:#8b99a6;--card:#18202a;--line:#2b3744;--acc:#8fc4e8}
@media (prefers-color-scheme:light){:root{--bg:#eef2f6;--fg:#17202a;--mut:#5a6772;--card:#fff;--line:#cdd7e0;--acc:#1d6a9b}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.4 system-ui,sans-serif;padding:16px;max-width:900px;margin-inline:auto}
h1{font-size:20px;margin:0 0 4px}h2{font-size:16px;margin:24px 0 8px;color:var(--acc);border-bottom:1px solid var(--line);padding-bottom:4px}
h3{font-size:13px;margin:14px 0 4px;color:var(--mut);text-transform:uppercase;letter-spacing:.06em}
p.n{color:var(--mut);margin:0 0 8px}
.row{display:flex;align-items:center;gap:10px;background:var(--card);border:1px solid var(--line);border-radius:6px;padding:6px 10px;margin:4px 0}
.row button{flex:none;width:34px;height:34px;border-radius:50%;border:1px solid var(--acc);background:none;color:var(--acc);cursor:pointer;font-size:14px}
.row.playing button{background:var(--acc);color:var(--bg)}
.row .t{min-width:0;flex:1}.row b{display:block;font-weight:600;overflow-wrap:anywhere}.row small{color:var(--mut);display:block}
.row.missing{opacity:.5}.row.missing button{cursor:not-allowed}
.tag{flex:none;font-size:11px;color:var(--mut)}
</style></head><body>
<h1>Dead of Winner sound audition</h1>
<p class="n">One clip plays at a time. Faded rows are not generated yet. Tell me the ids to redo. Narrator: ${VOICES['narrator']!.name} is in the game; the audition group lets you compare ${VOICES['alt-josh']!.name} and ${VOICES['alt-remmy']!.name} on the same line.</p>
<div id="root"></div>
<script>
var ITEMS=${JSON.stringify(page)};
// Relative to this page, so it works under /dead-of-winner/ on Pages and at / in dev.
var cur=null,curRow=null;
function path(i){return i.kind==='music'?'audio/music/'+i.id+'.mp3':'audio/'+i.id+'.mp3'}
function stop(){if(cur){cur.pause();cur.currentTime=0}if(curRow)curRow.classList.remove('playing');cur=null;curRow=null}
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!==undefined)e.textContent=x;return e}
var root=document.getElementById('root');
[['sfx','Sound effects'],['voice','Voices'],['music','Music']].forEach(function(s){
  root.appendChild(el('h2','',s[1]));var last='';
  ITEMS.filter(function(i){return i.kind===s[0]}).forEach(function(i){
    if(i.group!==last){root.appendChild(el('h3','',i.group));last=i.group}
    var row=el('div','row'),b=el('button','','\\u25B6'),t=el('div','t'),n=el('b','',i.id),d=el('small','',i.note||'');
    t.appendChild(n);t.appendChild(d);row.appendChild(b);row.appendChild(t);
    if(i.dur)row.appendChild(el('span','tag',i.dur+' s'+(i.loop?' loop':'')));
    var a=new Audio();a.preload='none';a.loop=false;a.src=path(i);
    a.onerror=function(){row.classList.add('missing');if(cur===a)stop()};
    a.onended=function(){if(cur===a)stop()};
    b.onclick=function(){if(cur===a){stop();return}stop();cur=a;curRow=row;row.classList.add('playing');a.currentTime=0;a.play().catch(function(){row.classList.add('missing');stop()})};
    root.appendChild(row);
  });
});
</script></body></html>
`
await writeFile(PAGE, html)

const count = (k: string): number => items.filter((i) => i.kind === k).length
console.log(`[audio-build-manifest] ${items.length} items (${count('sfx')} sfx, ${count('voice')} voice, ${count('music')} music; ${items.length - (existing?.items.length ?? 0)} new)`)
