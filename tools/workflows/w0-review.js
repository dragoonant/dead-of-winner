export const meta = {
  name: 'w0-review',
  description: 'M0 stage 2: adversarial spec review, routed fixes, rulings consolidated',
  phases: [
    { title: 'Review', detail: 'rules fidelity + cross-spec/contract consistency' },
    { title: 'Fix', detail: 'one fix agent per file-owner group' },
  ],
}

const ROOT = '/home/user/dead-of-winner'
const BRIEF = `${ROOT}/docs/DEAD-OF-WINTER-HANDOFF.md`

const COMMON = `Project root: ${ROOT}. Use absolute paths; the cwd resets between commands.
Orient from ${ROOT}/STATUS.md only; specs live in ${ROOT}/docs/spec/. The brief is ${BRIEF} (grep headings, read only named parts).
IP rule: mechanics 1:1 from Dead of Winter; names may match; ALL prose our own words; no publisher art/icons/trade dress.
Frozen-contract rule: src/engine/{types,actions,events,hooks,rng,decider,view,index}.ts may change in M0 only by the contracts owner, with a matching edit to docs/spec/00-architecture.md.
Run long commands in the FOREGROUND. Never run npm install or git commit. Never edit package.json, STATUS.md or HANDOFF.md.
The rulebook PDF is not available here; public rules pages are (e.g. rulespal.com/dead-of-winter/rulebook, orderofgamers.com summary). At most 5 WebFetch/WebSearch calls; cite URLs used.`

const FINDINGS = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          owner: { type: 'string', enum: ['rules', 'data', 'contracts', 'other'] },
          where: { type: 'string' },
          problem: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['owner', 'where', 'problem', 'fix'],
      },
    },
  },
  required: ['ok', 'findings'],
}
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

const OWNERS = {
  rules: 'docs/spec/10-rules-core.md, 11-objectives.md, 12-rules-test-checklist.md, 13-golden-examples.md, and docs/needs-rules-check.md',
  data: 'docs/spec/20-data-schema.md, 21-card-effects-dsl.md, docs/spec/schemas/*, docs/spec/sources/*',
  contracts: 'docs/spec/00-architecture.md, src/engine/*.ts, tests/engine/*.test.ts',
  other: 'docs/spec/30-art.md, 40-ai.md, 41-personas-and-talk.md, 50-client.md, 60-testing.md',
}
const ownerList = Object.entries(OWNERS).map(([k, v]) => `- ${k}: ${v}`).join('\n')

const KNOWN = `Known cross-spec conflicts reported by the writers (verify, decide, and include each as a finding with a concrete fix):
1. Data path: brief C.2 src/data/ (spec 20 chose it) vs data/ in 10.2.5 and content/ in 11 and 41.
2. Exiled betrayer: 10.11.2 says betrayer status becomes public and keeps the betrayal objective; 11 §5.4/§7.1/§7.8 and checklist K-2/K-3 keep it hidden and draw an exiled card. Pick the rulebook/FAQ answer.
3. Crisis threshold with exiled seats: non-exiled players (brief) vs number of players (Order of Gamers).
4. Dice visibility: view.ts shows every seat's dice; 50.6.1 shows others' count only. (Dice are public in the physical game.)
5. Talk log outside engine state: 40.1.5 wants Decider.observeTalk() or a context arg.
6. View exposes count of cards each seat contributed to the crisis (not which): confirm view.ts matches 40.
7. Test-ID prefixes ARCH- (00 §00.11), AI-/AI-FAIR- (40), SIM- (60) are not in 12.
8. Asset manifest schema (30.8.3) has no owner in 20.
9. "Optional/may" effects modeled as itemTarget with skip in 21; decider may need a confirm kind.
10. Event names in 13 and DSL trigger names in 21.5 must match events.ts/actions.ts.
11. First-player token pass direction (10 says right per brief R p13): check a public source.
12. 60.2.6 must reference 12's row format/regex for the checklist-coverage tool.
13. 50.6 numbers the client shows must all be exported by the engine (odds.ts / preview()).`

phase('Review')
const reviews = await parallel([
  () => agent(`${COMMON}
You are an adversarial RULES-FIDELITY reviewer. Do not edit any file.
Read docs/spec/10-rules-core.md, 11-objectives.md, 12-rules-test-checklist.md, 13-golden-examples.md, and the "## Rulings" sections. Compare against brief Part E and up to 5 public rules sources. Hunt for: wrong or missing rules, wrong numbers, wrong step order in the round/colony phase, missing edge cases (helpless survivors, overrun, colony entrance limits, food/starvation, waste, morale, exposure on move, noise, barricades, Crossroads triggers, exile and voting), golden examples that contradict 10, checklist gaps.
${KNOWN}
Route each finding to one owner:
${ownerList}
Return FINDINGS JSON; at most 25 findings, highest-impact first, each field terse.`,
    { effort: 'high', schema: FINDINGS, label: 'review:rules', phase: 'Review' }),
  () => agent(`${COMMON}
You are an adversarial ARCHITECTURE/CONSISTENCY reviewer. Do not edit any file.
Read docs/spec/00-architecture.md, src/engine/*.ts, 20-data-schema.md, 21-card-effects-dsl.md, schemas/*.json, and skim 40-ai.md, 50-client.md, 60-testing.md. Hunt for: contract gaps that would force a change after freeze (decision kinds missing for any rule in 10, PendingDecision with seat 'all' for votes and crisis, legalActions never empty, view() hiding hands, secret objectives, face-down crisis cards and drawn Crossroads), DSL unable to express first-slice cards, schema/DSL/types mismatches, determinism holes (rng use, replay), hidden-info leaks, the AI time budget env var.
${KNOWN}
Route each finding to one owner:
${ownerList}
Return FINDINGS JSON; at most 25 findings, highest-impact first, each field terse.`,
    { effort: 'high', schema: FINDINGS, label: 'review:architecture', phase: 'Review' }),
])

const all = reviews.filter(Boolean).flatMap(r => r.findings)
log(`${all.length} findings: ` + Object.keys(OWNERS).map(o => `${o}=${all.filter(f => f.owner === o).length}`).join(' '))

phase('Fix')
const fixes = await parallel(Object.keys(OWNERS).map(owner => () => {
  const mine = all.filter(f => f.owner === owner)
  const extra = owner === 'rules'
    ? `\nAlso: consolidate every "## Rulings" line from ALL docs/spec/*.md files into ${ROOT}/docs/needs-rules-check.md under "## M0" (keep the existing line, dedupe, keep status words). Leave the per-spec Rulings sections in place.`
    : ''
  const verify = owner === 'contracts'
    ? `\nAfter edits run in the foreground: cd ${ROOT} && npm run typecheck && npm test. Both must pass.`
    : owner === 'data'
      ? `\nAfter edits confirm every schema still parses and the 21 examples still validate with ajv (options {strict:true, strictRequired:false, allowUnionTypes:true}).`
      : ''
  if (!mine.length && !extra) return Promise.resolve({ ok: true, summary: 'no findings', files: [], issues: [] })
  return agent(`${COMMON}
You are the ${owner} fix agent. You own ONLY: ${OWNERS[owner]}.
Apply these review findings (decide sensibly where reviewers conflict; record any rules decision as a RULING line in your spec's "## Rulings" section). If a finding needs a file you do not own, skip it and list it in issues.
${JSON.stringify(mine)}${extra}${verify}
Return JSON {ok, summary, files[], issues[]}; <= 300 tokens.`,
    { effort: 'high', schema: RESULT, label: `fix:${owner}`, phase: 'Fix' })
}))

return { counts: all.length, fixes }
