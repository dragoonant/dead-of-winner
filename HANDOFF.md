# Handoff

**Current state:** M0 landed. Specs 00-60, JSON Schemas, source tables and the frozen engine contracts
(`src/engine/*`) are committed. Typecheck and 16 tests pass. Nothing is playable yet; the Pages deploy still shows
the placeholder title screen. Rules ambiguities are logged as 92 rulings in `docs/needs-rules-check.md`.

## Next
1. M1: implement the engine against the frozen contracts and `docs/spec/12-rules-test-checklist.md`, the six golden
   examples (`13`), and a headless `npm run sim`. Contract changes are additive only, logged in `00` §16.
2. Card data entry from `docs/spec/sources/` into `data/` (validated by the schemas in `docs/spec/schemas/`).
3. AI (40/41), then the client (50) and art (30).

## Owner ask
Download into `docs/sources/bgg/` (gitignored; needs your BGG login): filepage 160324 (the Crossroads/card
spreadsheet) and threads 2054328, 2017807, 1923268. These close the open data gaps (Microphone item, Thomas Heart
ability, exiled objectives) and let the `(verify)` values be checked.
Also skim `docs/needs-rules-check.md` and correct any ruling your physical copy contradicts.
