# Status

## What exists
- Scaffold (2026-10-09): Vite 8, TS 7, React 19, Vitest 5, Playwright, Pages deploy workflow, copied
  from Whirr Machine. Placeholder title screen in `src/client/App.tsx`.
- `docs/DEAD-OF-WINTER-HANDOFF.md`: the full brief (Parts A-K).
- M0 specs in `docs/spec/` (00, 10, 11, 12, 13, 20, 21, 30, 40, 41, 50, 60), JSON Schemas in
  `docs/spec/schemas/`, per-card source tables in `docs/spec/sources/`. Index: `docs/spec/README.md`.
- Frozen engine contracts in `src/engine/` (types, actions, events, hooks, rng, decider, view, index) with
  `tests/engine/contracts.test.ts`. Typecheck clean; 16 tests pass (2 files).
- `docs/sources/` (gitignored): official rulebook and FAQ v1.1 with extracted text, plus fan sources.
- `docs/needs-rules-check.md`: 92 rulings under "## M0" for the owner to reconcile.

## Spec status
| Spec | Status |
|---|---|
| 00 architecture | written, contracts frozen |
| 10 rules core | written |
| 11 objectives | written (only 2 main objectives verified) |
| 12 test checklist | written |
| 13 golden examples | written (some capacities ASSUMED) |
| 20 data schema, schemas/*.json | written |
| 21 effects DSL | written |
| 30 art | written (tile layout unsourced) |
| 40 AI, 41 personas | written |
| 50 client | written |
| 60 testing | written |
| Card data (survivors, items, crisis, Crossroads, objectives) | not entered; gaps listed in `docs/spec/sources/README.md` |

## Next
- M1: engine implementation and `npm run sim` against the frozen contracts and the checklist ids.
- Owner request: download BGG filepage 160324 (Crossroads spreadsheet) and threads 2054328, 2017807,
  1923268 into `docs/sources/bgg/` (needs the owner's login; fills the card-data gaps, e.g. the Microphone item,
  the Thomas Heart ability, the exiled objectives).
