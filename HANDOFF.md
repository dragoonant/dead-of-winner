# Handoff

**Current state:** M1 landed. The rules engine behind the frozen contracts is complete and wired through `src/engine/index.ts`
(`createGame`, `step`, `validate`, `legalActions`, `replay`, `save`/`load`, `view`, `query.*`), the random bot plays whole games,
and `npm run sim -- --games 30 --seed 1` ends every game with zero invariant failures and zero hidden-information leaks.
Typecheck is clean; 289 tests pass in 23 files, the six golden scripts among them. `npm run validate:data` is green on the
fixture bundle. Nothing is playable in the browser yet; the Pages deploy still shows the placeholder title screen. Rules
decisions taken while building are logged under "## M1" in `docs/needs-rules-check.md`.

## Next
1. M2: data verification. Check the fixture slice (`tests/fixtures/bundle/`) card by card against `docs/spec/sources/`, then
   enter the rest of the base game into `src/data/` through the schemas, so the sim can seat 4 and 5 (12 survivors seat 3 today).
   The 13 unregistered-until-M1 code hooks in `src/engine/code-hooks.ts` carry the objective rulings to confirm.
2. M3: the client (`docs/spec/50-client.md`) on `view` + `legalActions` + `query`; the store is the only caller of `step`.
3. AI tiers (40/41) above the random bot, then art (30).

## Owner ask
Still open: 9-10 standard secret objective texts, 7 betrayal texts and 17 official English crisis names. If you have a physical
copy, check the conflict tables in `docs/spec/sources/*-sources.md` against it (the Fan-source rows and the flagged numbers)
and skim `docs/needs-rules-check.md`, including the M1 section, correcting any ruling your copy contradicts.
