// M2: first content slice with verify ON. Workflow({ scriptPath: 'tools/workflows/w2-data.js' })
// Promote the M1 fixture bundle into src/data/ as the shipping first slice (brief Part G.7), with original prose,
// then an adversarial verify (mechanics vs sources, copied text), one fix round, land.
export const meta = {
  name: 'w2-data',
  description: 'Dead of Winner M2: first content slice in src/data with sources, original prose, adversarial verify, fix, commit + push',
  phases: [
    { title: 'Enter', detail: 'survivors+objectives; items+locations; crises+crossroads (prose in our words)' },
    { title: 'Verify', detail: 'mechanics vs source tables, copied-text check, schema + hook validation' },
    { title: 'Land', detail: 'fix, validate:data, sim, STATUS, commit, push' },
  ],
}
const ROOT = 'C:/Users/antho/OneDrive/Documents/Dead-of-winner'
const ATTR = 'Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>'
const RESULT = { type: 'object', properties: { ok: { type: 'boolean' }, summary: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, issues: { type: 'array', items: { type: 'string' } } }, required: ['ok', 'summary', 'files', 'issues'] }
const FINDINGS = { type: 'object', properties: { ok: { type: 'boolean' }, findings: { type: 'array', items: { type: 'object', properties: { owner: { type: 'string' }, where: { type: 'string' }, problem: { type: 'string' }, fix: { type: 'string' } }, required: ['owner', 'where', 'problem', 'fix'] } } }, required: ['ok', 'findings'] }
const COMMON = `Project root: ${ROOT} (git repo, branch main). Windows; absolute paths, the cwd resets; long commands in the FOREGROUND. Orient from STATUS.md, then docs/spec/20-data-schema.md, docs/spec/21-card-effects-dsl.md, docs/spec/schemas/*.json and the source tables docs/spec/sources/*.md (every value you enter must be traceable to a row there; put the row reference in each record's "src" field). The engine's DSL vocabulary and code hooks are in src/engine/effects.ts and src/engine/code-hooks.ts (read, do not edit; if a card needs a verb that does not exist, use {"code": "<hookName>"} and list the missing hook in issues). The M1 fixture bundle tests/fixtures/bundle/ is the starting point: src/data/ replaces it as the shipping bundle (the fixture may then re-export from src/data). IP rule (owner decision, Mallet posture): survivor, item, crisis, Crossroads and objective NAMES may match the real cards; ALL prose (ability text, item text, crisis fail text, Crossroads vignettes and option text, objective text) is in OUR OWN WORDS written from the one-line mechanical summary, never by paraphrasing the original sentence by sentence; Crossroads flavour is a NEW vignette (2-3 sentences, our own scene) that leads to the same two mechanical options. Never copy from the Spanish/Portuguese transcriptions, the wiki or the BGG spreadsheet. 'npm run validate:data' must stay green. Concurrent agents share the tree: touch only files you own; never edit STATUS.md/package.json; never git commit or npm install unless told. Final output is raw JSON.`

phase('Enter')
const ENTER = [
  { key: 'survivors+objectives', own: 'src/data/survivors/*.json, src/data/objectives/{main,secret,betrayal,exiled}.json', task: 'ALL 30 base-game survivors (survivors-sources.md; a 4-5 seat table deals 16-20, so 12 is not enough; stats, ability location, ability as DSL with original text, Thomas Heart with the provisional ability flagged in src; our own one-line occupation blurb), We Need More Samples (both sides) plus every other main objective whose both sides are sourced (objectives-sources.md), every standard secret objective with known text (and the names-only ones as {"text": null, "status": "unknown"} records the engine must skip), the 3 betrayal objectives with known text (+ names-only records), all 10 exiled objectives.' },
  { key: 'items+locations', own: 'src/data/items/{starter,police,grocery,school,gas,library,hospital}.json, src/data/locations/*.json, src/data/core/*.json', task: 'the 25 starter items and all six 20-card location decks with symbol, count, kind (waste/equip/event) and DSL effects, each card text rewritten in our words (items-sources.md + Card Spread rows); the 6 locations with survivor/entrance/noise counts and symbol order (locations-sources.md); core tables (exposure faces, colony board layout: 6 entrances x 3, 24 occupant spaces, morale/round track lengths, token counts).' },
  { key: 'crises+crossroads', own: 'src/data/crisis/*.json, src/data/crossroads/*.json', task: 'ALL 20 crisis cards (crises-sources.md; the three official English names, our own English titles for the other 17 marked "nameStatus": "ours"; prevent symbol rule, fail effect in DSL, optional bonus; our own one-line fail text) and 20 Crossroads cards (Crossroad_cards_v1.1.xlsx.txt rows for: Hunted, Outbreak, Old Divisions, Bev Russell and 16 more whose triggers and options the DSL can express; trigger predicate in the DSL, two options with effects, a NEW vignette in our words, the mature flag where the source marks it). List in issues every Crossroads whose trigger or option needed a code hook.' },
]
const entered = await parallel(ENTER.map(m => () => agent(`${COMMON}
Task: enter ${m.key}. You own ONLY: ${m.own}. Build: ${m.task} Validate your files with 'npx tsx tools/validate-data.ts' (FOREGROUND) and fix until green for your files.
Return JSON: ok, summary (<=80 words), files, issues.`, { label: `enter:${m.key}`, phase: 'Enter', schema: RESULT, model: 'sonnet' })))

phase('Verify')
const verify = await agent(`${COMMON}
Task: adversarial verify of src/data. You edit NOTHING. For EVERY record in src/data/**: (a) compare each number, symbol, location, count and effect against its "src" row in docs/spec/sources/*.md (and the Card Spread / Crossroads spreadsheet rows for items and Crossroads); (b) check that no sentence of text is copied or near-copied (>= 7 consecutive words) from docs/sources/fan/*.md, docs/sources/fan/fandom/*.txt, docs/sources/bgg/*.txt or the rulebook text (grep for distinctive phrases); (c) check that every DSL effect encodes the mechanic (not a weaker or stronger version); (d) run 'npm run validate:data' and 'npm test' and report failures. Each finding: owner = survivors+objectives | items+locations | crises+crossroads, where (file + id), problem, fix. Cap 60 findings, most serious first.
Return JSON: ok, findings.`, { label: 'verify:data', phase: 'Verify', schema: FINDINGS, effort: 'high' })
const byOwner = {}
for (const f of (verify ? verify.findings : [])) { (byOwner[f.owner] = byOwner[f.owner] || []).push(f) }
log(`verify: ${verify ? verify.findings.length : 0} findings across ${Object.keys(byOwner).join(', ') || 'none'}`)
const OWN = Object.fromEntries(ENTER.map(m => [m.key, m.own]))
const fixes = await parallel(Object.keys(byOwner).filter(o => OWN[o]).map(o => () => agent(`${COMMON}
Task: apply these verify findings to the files you own, and only those. You own ONLY: ${OWN[o]}. If a finding is wrong, say so in issues instead of applying it. 'npx tsx tools/validate-data.ts' must stay green.
Findings: ${JSON.stringify(byOwner[o])}
Return JSON: ok, summary (<=60 words), files, issues.`, { label: `fix:${o}`, phase: 'Verify', schema: RESULT, model: 'sonnet' })))

phase('Land')
const rulings = [...entered, verify, ...fixes].filter(Boolean).flatMap(r => r.issues || []).filter(x => /^RULING/.test(x))
const land = await agent(`${COMMON}
Task: land M2. You may edit any src/data, src/engine (additive hooks only), tests, tools file, STATUS.md, HANDOFF.md, docs/needs-rules-check.md, docs/spec/README.md. 1) Point the engine, sim and tests at src/data as the default bundle (tests/fixtures/bundle may re-export it); register any missing code hooks named in issues with real implementations in src/engine/code-hooks.ts. 2) 'npm run typecheck', 'npm test', 'npm run validate:data', then 'npm run sim -- --games 30 --seed 2' (FOREGROUND): zero violations, zero leaks, all games end; fix minimal issues. 3) Append these RULING lines under "## M2" in docs/needs-rules-check.md: ${JSON.stringify(rulings)}. 4) STATUS.md (What exists: the first slice contents with counts; Known gaps: names-only objectives, 12 crises and 60 Crossroads pending M8) and HANDOFF.md (next: M3 client). 5) git add -A -- . ':(exclude)docs/sources'; confirm no PDFs/*.token*; commit "M2: first content slice with sources and original prose" + blank line + "${ATTR}"; git push origin main (pull --rebase if rejected); 'gh run list --limit 1'.
Return JSON: ok, summary (<=100 words incl. sim stats), files, issues.`, { label: 'land', phase: 'Land', schema: RESULT, model: 'sonnet' })
const s = r => r && { ok: r.ok, summary: r.summary, issues: (r.issues || []).slice(0, 10) }
return { entered: entered.map(s), findings: verify ? verify.findings.length : null, fixes: fixes.map(s), land: s(land) }
