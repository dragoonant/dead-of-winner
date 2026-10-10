# Status

## What exists
- Scaffold (2026-10-09): Vite 8, TS 7, React 19, Vitest 5, Playwright, Pages deploy workflow, copied
  from Whirr Machine. Placeholder title screen in `src/client/App.tsx`.
- `docs/DEAD-OF-WINTER-HANDOFF.md`: the full brief (Parts A-K).
- M0 specs in `docs/spec/` (00, 10, 11, 12, 13, 20, 21, 30, 40, 41, 50, 60), JSON Schemas in
  `docs/spec/schemas/`, per-card source tables in `docs/spec/sources/`. Index: `docs/spec/README.md`.
- Source tables (2026-10-10 card research): survivors 30/30, starting items 25 and the six location decks, crises 20/20
  (all values, 3 official English names), main objectives 10 x 2 sides, exiled objectives 10/10, standard secret objectives
  15/24 texts with all 24 names, betrayal objectives 3/10 texts with all 10 names, six location cards and the colony board
  counts. Conflicts between sources are tabled with a status in `docs/spec/sources/*-sources.md`.
- Frozen engine contracts in `src/engine/` (types, actions, events, hooks, rng, decider, view, index) with
  `tests/engine/contracts.test.ts`. Typecheck clean; 16 tests pass (2 files).
- `docs/sources/` (gitignored): official rulebook and FAQ v1.1 with extracted text, the BGG downloads (Card Spread,
  Crossroads sheet, official rulings digest, objectives thread) and fan sources.
- `docs/needs-rules-check.md`: 164 rulings, 92 under "## M0" and 72 under "## M0b card research (2026-10-10)", for the
  owner to reconcile.

## Spec status
| Spec | Status |
|---|---|
| 00 architecture | written, contracts frozen |
| 10 rules core | written |
| 11 objectives | written; all main and exiled objectives sourced, secret 15/24 and betrayal 3/10 texts |
| 12 test checklist | written |
| 13 golden examples | written (scenario values the book omits are marked ASSUMED; location capacities now sourced) |
| 20 data schema, schemas/*.json | written |
| 21 effects DSL | written |
| 30 art | written (tile layout follows the Long Night location photos, ruling L1) |
| 40 AI, 41 personas | written |
| 50 client | written |
| 60 testing | written |
| Card data (survivors, items, crisis, Crossroads, objectives) | sources tabled, not yet entered into `data/`; the Crossroads cards are in the BGG sheet but not tabled; gaps listed in `docs/spec/sources/README.md` |

## Next
- M1: engine implementation and `npm run sim` against the frozen contracts and the checklist ids.
- Remaining source gaps: 9-10 standard secret objective texts, 7 betrayal texts, official English crisis names (17).
- Owner request: if you have a physical copy, check the conflict tables in `docs/spec/sources/*-sources.md` against it
  (the rows marked Fan-source and the flagged numbers: Fuel Shortage, Zombie Wave, We Need More Samples hardcore,
  Leave It All Behind, Stockpile, and the location card space counts). The BGG and Ludopedia files asked for earlier
  were delivered on 2026-10-10 and are folded in.
