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
- Frozen engine contracts in `src/engine/` (types, actions, events, hooks, rng, decider, view, index); additive changes logged in `00` §16.
- **M1 rules engine (2026-10-10)**, all internal modules of `00` §1: `setup.ts decks.ts dice.ts exposure.ts survivors.ts zombies.ts
  crossroads.ts crisis.ts colony-phase.ts exile.ts objectives.ts effects.ts code-hooks.ts bundles.ts actions/*.ts
  phases/{setup,player-turns,colony}.ts`. `src/engine/index.ts` is wired: `createGame`, `step` (one pending after every step,
  rejections never throw, `E_BAD_PAYLOAD` for malformed input), `validate`, `legalActions` (never empty), `replay`, `save`/`load`
  (`E_DATA_VERSION`), `view`, and every `query.*` helper (crisis totals, food, zombies to add, die requirement, exposure odds, kill
  odds, attack-a-survivor odds, objective progress, search odds, move targets, vote forecast).
- Data layer `src/data/` (schema validation, cross-record rules V-01..V-21, content-hashed bundles) and the first-slice fixture
  bundle `tests/fixtures/bundle/` (12 survivors, 39 items, 7 decks, 7 locations, 8 crises, 20 Crossroads, We Need More Samples,
  13 + 3 + 10 secret objectives). `npm run validate:data` is green (3 count warnings for the partial slice).
- `src/ai/random.ts`: the random bot, a weighted draw over `legalActions` seeded by (seed, decision id).
- `tools/sim.ts` + `tools/sim-core.ts`: `npm run sim -- --games N --seed S [--seats n] [--objective samples] [--json] [--verbose]`.
  Invariants after every step (NaN, one pending, legal actions validate, morale 0..10, board capacities, every card in exactly one
  zone, survivor/crisis/Crossroads card conservation, one leader per living seat), a 3000-decision cap, a 200-decision stall
  detector, a mid-game save/load round trip, replay determinism and the hidden-information leak test on every seat's view and
  every redacted event. `npm run sim -- --games 30 --seed 1`: 30/30 games end (all by morale zero, mean 3.0 rounds, mean 88
  decisions, betrayer dealt in 10), 0 violations, 0 leaks, about 1 s. The fixture's 12 survivors seat 3; `--seats 4` needs more data.
- Tests: 23 files, 289 tests, typecheck clean. Engine tests per checklist prefix (ACT, ATK, CARD, COL, CRIS, DICE, EFF, END, EXIL,
  EXPO, MOVE, OBJ, SETUP, SRCH, SURV, VOTE, XRD, ZOM), the six golden scripts `GOLD-001..006` with variants
  (`tests/engine/golden.test.ts`), the API and sim tests (`tests/engine/api.test.ts`: ACT-002, ACT-003, ACT-009, ACT-013,
  VIEW-013, QRY-001) and the data tests (DATA-001..010).
- `docs/sources/` (gitignored): official rulebook and FAQ v1.1 with extracted text, the BGG downloads (Card Spread,
  Crossroads sheet, official rulings digest, objectives thread) and fan sources.
- `docs/needs-rules-check.md`: 164 M0/M0b rulings plus the M1 section (engine, bot and sim rulings), for the owner to reconcile.

## Card data (M2)
- `src/data/` is the default bundle for the engine, `npm run sim` and the data tests (`tools/default-bundle.ts`: `loadDefaultBundle()`);
  `tests/fixtures/bundle/` stays for unit tests. Counts: 30 survivors, 39 items, 7 decks, 7 locations, 20 crises, 20 Crossroads,
  10 main objectives (normal + hardcore), 26 playable secret-type objectives (13 standard, 3 betrayal, 10 exiled).
- Objectives live as arrays in `src/data/objectives/{main,secret,betrayal,exiled}.json`; names-only stubs (`status: "unknown"`,
  text null) are skipped by the loader.
- 14 new code hooks in `src/engine/code-hooks.ts` (crises, Crossroads, objectives), with golden checks in `tests/engine/m2-hooks.test.ts`.
- Gates: typecheck clean, `npm test` green, `validate-data` 0 errors (2 count warnings), `npm run sim -- --games 30 --seed 2 --seats 4`:
  30/30 end, 0 violations, 0 leaks.
- Known gaps: 18 names-only objectives excluded (11 standard secret, 7 betrayal); 17 of the 20 crisis names are ours (`name-ours` tag);
  hooks choose for the player where the card says "of its choice" (rulings in `docs/needs-rules-check.md` section M2).

## Spec status
| Spec | Status |
|---|---|
| 00 architecture | written, contracts frozen; §16 logs the M1 additive changes |
| 10 rules core | written, implemented (M1) |
| 11 objectives | written; all main and exiled objectives sourced, secret 15/24 and betrayal 3/10 texts; evaluator implemented |
| 12 test checklist | written; M1 covers every prefix with tests named by id |
| 13 golden examples | written and passing (GOLD-001..006 with variants) |
| 20 data schema, schemas/*.json | written, validator implemented |
| 21 effects DSL | written, interpreter implemented (`effects.ts`) |
| 30 art | written (tile layout follows the Long Night location photos, ruling L1) |
| 40 AI, 41 personas | written; random tier implemented |
| 50 client | written |
| 60 testing | written; sim, invariants and leak test implemented |
| Card data (survivors, items, crisis, Crossroads, objectives) | M2 slice in `src/data/` (see Card data (M2)); verify pass against the physical cards still open |

## Next
- M2: card data verification (the fixture slice against the source tables, then the rest of the base game into `src/data/`),
  more survivors so the sim can seat 4 and 5.
- M3: the client (50) on top of `view` + `legalActions` + `query`.
- Remaining source gaps: 9-10 standard secret objective texts, 7 betrayal texts, official English crisis names (17).
- Owner request: if you have a physical copy, check the conflict tables in `docs/spec/sources/*-sources.md` against it
  (the rows marked Fan-source and the flagged numbers: Fuel Shortage, Zombie Wave, We Need More Samples hardcore,
  Leave It All Behind, Stockpile, and the location card space counts), and skim the M1 rulings in `docs/needs-rules-check.md`.
