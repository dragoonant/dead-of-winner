export const meta = {
  name: 'w0-sync',
  description: 'M0 stage 3: apply cross-owner leftovers from the spec review',
  phases: [{ title: 'Sync', detail: 'one Sonnet agent per owner group' }],
}

const ROOT = '/home/user/dead-of-winner'
const COMMON = `Project root: ${ROOT}. Use absolute paths; the cwd resets between commands.
Orient from ${ROOT}/STATUS.md only; specs live in ${ROOT}/docs/spec/. The frozen contracts in src/engine/*.ts are the source of truth for names (read only the parts you need with grep).
IP rule: all prose our own words. Run long commands in the FOREGROUND. Never run npm install or git commit. Never edit package.json, STATUS.md, HANDOFF.md or src/engine/*.
Make minimal, surgical edits (Edit tool), no rewrites.
Return JSON {ok, summary, files[], issues[]}; <= 200 tokens.`

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

const JOBS = [
  {
    owner: 'rules',
    files: 'docs/spec/10-rules-core.md, 11-objectives.md, 12-rules-test-checklist.md, 13-golden-examples.md',
    todo: `1. 13 GOLD-04 uses CrisisResolved.needed and CardsRemovedFromGame; replace with event names/fields that exist in src/engine/events.ts.
2. 12: add checklist rows VIEW-019 and VIEW-020 (read their it() names in tests/engine/contracts.test.ts), an XRD row for a Crossroads card with no eligible option, a SIM row for exile placement overCapacity (exilePlacement in src/engine). Register UI- and E2E- (and GOLD-) as non-rules prefixes in the prefix registry. Update the coverage table counts.
3. 10.12 vote encoding: make sure the card-vote and exile-vote text matches the generic vote contract (purpose exile|card, option-id ballots, VoteRecord) in types.ts.`,
  },
  {
    owner: 'data',
    files: 'docs/spec/20-data-schema.md, 21-card-effects-dsl.md, docs/spec/schemas/*',
    todo: `1. crisis.schema.json: prevent becomes an array of 1-2 PreventSymbol values (match types.ts); fix 20/21 examples to match and re-validate all 21 examples with ajv ({strict:true, strictRequired:false, allowUnionTypes:true}).
2. 21.7 vote encoding and 21.10.2 hook signature must match types.ts/hooks.ts (EffectHookInput; only run gets rng). 21.5 binding text must reference DSL_EVENT_BINDINGS in events.ts.
3. DSL/schema: forbid "optional" on secret/betrayal objective hooks.
4. 20: rename persona.json reference to persona.schema.json; remove the D-PATHS aliases now that 10 and 11 use src/data.`,
  },
  {
    owner: 'other',
    files: 'docs/spec/00-architecture.md, 30-art.md, 40-ai.md',
    todo: `1. 00.4.3: mirror the confirm encoding (itemTarget purpose 'confirm', candidates ['yes'], min 1, max 1, canSkip) and peek encodings (purpose 'peekOrder'; objectiveChoice top/bottom) from 21. Close the A-DICE ruling note (spec 50 is aligned). Note in 00 that the trigger dispatcher applies the 21.5 filters (ColonyStepStarted only for step payFood; SurvivorKilled only where survivor is non-null).
2. 30.8.3: asset id derives from the record id (Ruling D-ARTID in 20; also icon.<symbol>, location.<id>); drop the survivor "art" field.
3. 40-ai.md Rulings (~line 454): requested cards are never contributed to the crisis EXCEPT Outsiders (R-REQUEST in 10); 40.1 driver passes deriveSeed only to bots.`,
  },
]

phase('Sync')
const results = await parallel(JOBS.map(j => () => agent(`${COMMON}
You own ONLY: ${j.files}. Apply:
${j.todo}`, { model: 'sonnet', schema: RESULT, label: `sync:${j.owner}`, phase: 'Sync' })))
return results
