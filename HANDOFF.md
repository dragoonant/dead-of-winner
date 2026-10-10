# Handoff

**Current state:** M0 landed. Specs 00-60, JSON Schemas, source tables and the frozen engine contracts
(`src/engine/*`) are committed. Typecheck and 16 tests pass. Nothing is playable yet; the Pages deploy still shows
the placeholder title screen. Rules ambiguities are logged as 164 rulings in `docs/needs-rules-check.md` (92 from M0, 72 from the M0b card research).

## Next
1. M1: implement the engine against the frozen contracts and `docs/spec/12-rules-test-checklist.md`, the six golden
   examples (`13`), and a headless `npm run sim`. Contract changes are additive only, logged in `00` §16.
2. Card data entry from `docs/spec/sources/` into `data/` (validated by the schemas in `docs/spec/schemas/`).
3. AI (40/41), then the client (50) and art (30).

## Owner ask
The BGG and Ludopedia downloads arrived on 2026-10-10 and are folded into `docs/spec/sources/`. Still open:
9-10 standard secret objective texts, 7 betrayal texts and 17 official English crisis names. If you have a physical
copy, check the conflict tables in `docs/spec/sources/*-sources.md` against it (the Fan-source rows and the flagged
numbers) and skim `docs/needs-rules-check.md`, correcting any ruling your copy contradicts.
