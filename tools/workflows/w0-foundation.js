export const meta = {
  name: 'w0-foundation',
  description: 'M0 stage 1: write specs 00-60 and the frozen engine contracts (lean)',
  phases: [
    { title: 'Specs', detail: 'rules, objectives, golden examples, art/client/testing, AI' },
    { title: 'Contracts', detail: 'data schema + DSL draft, rules checklist, architecture + frozen contracts' },
  ],
}

const ROOT = '/home/user/dead-of-winner'
const BRIEF = `${ROOT}/docs/DEAD-OF-WINTER-HANDOFF.md`

const COMMON = `Project root: ${ROOT}. Use absolute paths; the cwd resets between commands.
Orient from ${ROOT}/STATUS.md only, then read ONLY the brief sections named below (${BRIEF}); grep its headings with \`grep -n '^#' ${BRIEF}\` and read ranges with sed -n.
IP rule: mechanics 1:1 from Dead of Winter; card/survivor/objective names may match; ALL prose is our own words written from one-line mechanical summaries; no publisher art, icons or trade dress.
Frozen-contract rule: src/engine/{types,actions,events,hooks,rng,decider,view,index}.ts are being frozen in this stage; only the agent that owns them edits them.
Run long commands in the FOREGROUND. Never run npm install or git commit. Never edit package.json, STATUS.md or HANDOFF.md.
The official rulebook PDF is NOT available in this container. Rules come from the brief Part E (which cites rulebook pages as R pN and FAQ as F x.y). You may use at most 4 WebFetch/WebSearch calls on public pages (rules summaries, wikis) to settle a doubt; cite every URL you use in the spec.
Rules ambiguities never block: record each as a line \`RULING: <rule> | <what we did> | <why + status word: Confirmed/Corrected/Unsourced/Fan-source>\` in a "## Rulings" section at the end of YOUR OWN spec file (do not edit docs/needs-rules-check.md).
Specs are terse, numbered, implementation-ready markdown (rules as numbered clauses with source refs), no filler.
Return JSON {ok, summary, files[], issues[]}; summary <= 60 words; total <= 300 tokens.`

const RESULT = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    summary: { type: 'string' },
    files: { type: 'array', items: { type: 'string' } },
    issues: { type: 'array', items: { type: 'string' } },
  },
  required: ['ok', 'summary', 'files', 'issues'],
}

const HIGH = { effort: 'high', schema: RESULT }

phase('Specs')
const specJobs = [
  {
    label: 'spec:10-rules-core',
    prompt: `${COMMON}
Brief sections: Part E (all of E.1-E.13), Part C.4, Part C.6.
Write ${ROOT}/docs/spec/10-rules-core.md: the complete rules of Dead of Winter as the engine implements them. Sections: components and quantities, board, setup, round order (player turn, colony phase steps in order), every action (die and no-die), exposure and the bite chain, zombies and overrun, survivors/leaders/helpless, Crossroads timing, exile, voting, ending and winning, variants (flag as later). Give every rule a stable clause number (e.g. 10.5.3) and a source ref. Name the single generic mechanisms explicitly: killSurvivor, addZombies (one at a time, overrun resolution), rollExposure (bite chain).
You own ONLY: docs/spec/10-rules-core.md`,
  },
  {
    label: 'spec:11-objectives+13-golden',
    prompt: `${COMMON}
Brief sections: Part E.12, E.14, Part G (first release content), E.11 (exile; objectives change on exile).
Write ${ROOT}/docs/spec/11-objectives.md: main objectives (structure; We Need More Samples in full mechanical detail), secret objectives, betrayal objectives, exiled objectives, how and when each is checked, scoring/winning conditions, morale/round-track end. Mechanical summaries only, own words.
Write ${ROOT}/docs/spec/13-golden-examples.md: the worked examples from E.14 as step-by-step golden scenarios (initial state, actions, expected state after each step, expected events), each with id GOLD-01.. and a source ref, precise enough to become Vitest cases.
You own ONLY: docs/spec/11-objectives.md, docs/spec/13-golden-examples.md`,
  },
  {
    label: 'spec:30-art+50-client+60-testing',
    prompt: `${COMMON}
Brief sections: Part C.1, C.2, C.5, C.6, Part D (all), Part B.4, Part J.
Write ${ROOT}/docs/spec/30-art.md (look, figure prompt rules, 3D pipeline, icon and card face rules, asset manifest format; Windows-PC-only steps flagged).
Write ${ROOT}/docs/spec/50-client.md (3D table layout in world units: 1 unit = 1 inch, y up, colony board at origin, six locations in rulebook arrangement, human seat near edge; hands, dice tray, prompts that explain themselves, feed, seat rail, secret objective panel, recap; the store; test hooks ?test=1 ?seats= ?gallery ?fps; the client renders only engine-supplied numbers).
Write ${ROOT}/docs/spec/60-testing.md (typecheck/test/validate:data/sim/bench:ai/e2e; checklist-ID naming; leak test inside sim; Playwright on the Pages sub-path; sim decision cap + stall detector; AI time budgets behind env vars; Part J lessons as test rules).
You own ONLY those three files.`,
  },
  {
    label: 'spec:40-ai+41-personas',
    prompt: `${COMMON}
Brief sections: Part H (all), Part C.4.
Write ${ROOT}/docs/spec/40-ai.md: bot architecture behind the Decider interface (bots get only view(state, seat)), turn planner, dice knapsack, crisis contribution, suspicion model, votes, requests, betrayer play, social actions toward the human, difficulty tiers (Random/Easy/Normal/Hard or as the brief says), fairness rules, per-decision time budget env var, bench:ai metrics and pass thresholds.
Write ${ROOT}/docs/spec/41-personas-and-talk.md: 4-6 personas (our own characters' table personalities, not card text), their parameter knobs, table-talk triggers and rate limits, line templates in our own words (a few examples per trigger, no copied text).
You own ONLY those two files.`,
  },
]
const specs = await parallel(specJobs.map(j => () => agent(j.prompt, { ...HIGH, label: j.label, phase: 'Specs' })))

phase('Contracts')
const schemaAndChecklist = await parallel([
  () => agent(`${COMMON}
Brief sections: Part C.3, C.4, Part E.1, Part G. Also read ${ROOT}/docs/spec/10-rules-core.md and ${ROOT}/docs/spec/11-objectives.md (written in the previous phase).
Write ${ROOT}/docs/spec/20-data-schema.md: JSON data files (survivors, items/starting decks, location decks, crises, Crossroads, objectives, locations), file layout under data/, ids, per-value source convention (every value cites docs/spec/sources/<x>-sources.md).
Write ${ROOT}/docs/spec/21-card-effects-dsl.md: the declarative card-effects DSL (triggers, conditions, effects, targets/scopes, durations, choices, {"code": "<hook>"} escape hatch), marked DRAFT: it freezes only after the M2 dry run encodes every first-slice card. Include 10+ example encodings of first-slice cards (mechanics only).
Write JSON Schemas (draft 2020-12, for ajv) in ${ROOT}/docs/spec/schemas/: survivor.schema.json, card.schema.json, crisis.schema.json, crossroads.schema.json, objective.schema.json, location.schema.json, effect.schema.json. Validate they parse: node -e "for (const f of require('fs').readdirSync('${ROOT}/docs/spec/schemas')) JSON.parse(require('fs').readFileSync('${ROOT}/docs/spec/schemas/'+f,'utf8'))".
Write ${ROOT}/docs/spec/sources/README.md describing the per-value source file format.
You own ONLY: docs/spec/20-data-schema.md, docs/spec/21-card-effects-dsl.md, docs/spec/schemas/*, docs/spec/sources/README.md`,
    { ...HIGH, label: 'spec:20-schema+21-dsl', phase: 'Contracts' }),
  () => agent(`${COMMON}
Brief sections: Part B.4, Part I (M0 checklist prefixes). Read ${ROOT}/docs/spec/10-rules-core.md, 11-objectives.md and 13-golden-examples.md (written in the previous phase).
Write ${ROOT}/docs/spec/12-rules-test-checklist.md: a checklist of testable rule assertions with ids under the prefixes SETUP-, DICE-, ACT-, ATK-, SRCH-, MOVE-, EXPO-, CARD-, XRD-, CRIS-, COL-, ZOM-, SURV-, OBJ-, EXIL-, VOTE-, END-, VIEW- (e.g. EXPO-004). One line each: id, assertion, spec clause ref (10.x.y / 11.x). Cover every numbered clause in 10 and 11; VIEW- covers hidden information (hands, secret objectives, face-down crisis contributions, drawn Crossroads cards). Add a coverage table at the end (prefix -> count).
You own ONLY: docs/spec/12-rules-test-checklist.md`,
    { ...HIGH, label: 'spec:12-checklist', phase: 'Contracts' }),
])

const contracts = await agent(`${COMMON}
Brief sections: Part C.2, C.3, C.4, C.6, Part J. Read ${ROOT}/docs/spec/10-rules-core.md, 20-data-schema.md and 21-card-effects-dsl.md, and skim 40-ai.md section headings.
Write ${ROOT}/docs/spec/00-architecture.md: layers (engine pure TS, no DOM; data JSON; ai; client R3F; tools), the frozen contracts and what each file exports, state shape, the single PendingDecision with seat (incl. 'all') and the decision kinds, legalActions never empty for an open decision, view(state, seatId) hidden-information rules, events stream, hooks for DSL escape hatches, seeded rng, engine-exported odds (exposure, kill, crisis totals, food needed), N-seat generic, AI time budget env var.
Then write the FROZEN contracts as compiling TypeScript (types and signatures; function bodies may throw 'not implemented' or be minimal): ${ROOT}/src/engine/types.ts, actions.ts, events.ts, hooks.ts, rng.ts (a real seeded PRNG, implemented), decider.ts, view.ts, index.ts. DSL types may live in types.ts mirroring 21 (DRAFT).
Add ${ROOT}/tests/engine/contracts.test.ts with ~5 focused tests (rng determinism, rng distribution sanity, module exports exist). Run in the foreground: cd ${ROOT} && npm run typecheck && npm test. If node_modules is missing, wait/retry once with ls ${ROOT}/node_modules/.bin/tsc (an install is running); do not install yourself.
You own ONLY: docs/spec/00-architecture.md, src/engine/*.ts, tests/engine/contracts.test.ts`,
  { ...HIGH, label: 'contracts:00+engine', phase: 'Contracts' })

return { specs, schemaAndChecklist, contracts }
