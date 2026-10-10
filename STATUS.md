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
  10 main objectives (normal + hardcore), 27 playable secret-type objectives (14 standard, 3 betrayal, 10 exiled).
- Objectives live as arrays in `src/data/objectives/{main,secret,betrayal,exiled}.json`; names-only stubs (`status: "unknown"`,
  text null) are skipped by the loader.
- 14 new code hooks in `src/engine/code-hooks.ts` (crises, Crossroads, objectives), with golden checks in `tests/engine/m2-hooks.test.ts`.
- Gates: typecheck clean, `npm test` green, `validate-data` 0 errors (2 count warnings), `npm run sim -- --games 30 --seed 2 --seats 4`:
  30/30 end, 0 violations, 0 leaks.
- Known gaps: 18 names-only objectives excluded (11 standard secret, 7 betrayal); 17 of the 20 crisis names are ours (`name-ours` tag);
  hooks choose for the player where the card says "of its choice" (rulings in `docs/needs-rules-check.md` section M2).

## Client (M3)
Playable in the browser against Random bots: https://dragoonant.github.io/dead-of-winner/ (local: `npm run dev`, or
`npm run build && npm run preview` for the `/dead-of-winner/` build).
- How to play: the start screen seats you plus 1-4 bots (default 3), picks a main objective (or Random), a seed and the animation
  speed. Every decision opens in the prompt dock at the bottom centre: on your turn pick an action chip (grouped by survivor; Table
  for cards, requests, votes and Add to crisis), read the odds line, pick the die, Confirm; End turn when done. Top bar: Objectives
  (O), How to play, Settings; keys: 1-4 camera, Space skips an animation, E ends the turn, S saves, ? lists the keys.
- URL params: `seats=human,bot,bot,bot` (2-5 seats, skips the start screen), `seed=<word>`, `objective=<id or word>` (e.g.
  `samples`) or `random`, `speed=0..8` (0 = instant), `tier=random|normal` (every bot's difficulty, default normal), `test=1` (exposes `window.__game` and the DOM proxies for tests), `fps`.
- Data: the client loads `src/data` (validated by `loadBundle`, same hash as the node loader, `tests/client/bundle.test.ts`); the
  fixture fallback is gone. Chunks: `title` (start screen), `react`, `engine` (engine + data + ajv), `three` (three/R3F/drei),
  `client` (game screen); the start screen loads only `title` + `react`, then the `engine` chunk for the objective list.
- E2E (`npm run e2e`, production build under `/dead-of-winner/`): `tests/e2e/play.spec.ts` plays a whole game as the human vs
  3 Random bots (`?seed=e2e&seats=human,bot,bot,bot&objective=samples`) by clicking dock buttons by exact text
  (`tests/e2e/policy.ts`) to the recap, checks the dock does not cover the dice tray, and opens Objectives and How to play.
  Screenshots (gitignored): `e2e-out/m3-start.png`, `m3-turn.png`, `m3-crisis.png`, `m3-recap.png`.
- Fixed in M3: the browser bundle loaded names-only objective stubs (now mirrors the node loader); an overrun kill inside a card
  effect (crisis fail) dropped the exiled owner's replacement-placement decision, losing a survivor card (`effects.ts` addZombies);
  the sim counted that waiting survivor as missing; the colony-phase feed line printed twice; discard lines read "Rook card".
- Known gaps: (Random bots wrecked morale in M3; fixed by the M4 Normal tier above.) The generic option list serves
  itemTarget / effectChoice / objectiveChoice (works, terse); decision kinds the e2e run has not hit yet: crossroadsOption,
  exilePlacement, searchKeepWhich, newLeader, objectiveChoice (forms exist); placeholder 3D art; objective part labels are mapped
  to plain words only for the common tests; the "two words" table talk on Talia Jones is not modelled.

## AI (M4)
Slim AI colonists, one tier: `src/ai/normal.ts` (+ `src/ai/normal/{info,plan,options,suspicion}.ts`), entry `src/ai/index.ts`
`createDecider(tier, persona, seed)`; `random` stays selectable. Bots default to Normal with distinct personas (Vera Lindqvist,
Teddy Marchbanks, Ruth Castellano: `src/data/personas/*.json`, scalars plus 24 own-words lines each); the start screen has a persona and
a difficulty select per bot; `?tier=random` forces Random. Table talk (`src/ai/talk.ts` `pickLine`, `src/client/bot/talk.ts`) lands in the
event feed (`Name: "line"`) and as a 4 s speech bubble on the seat card.
- What it does: a decider only sees `view(state, seat)`, the pending decision and the legal list (plus the events its seat may see, fed
  through `redactEvent`, for its suspicion ledger); it never rolls dice or reads GameState; seeded by `deriveSeed(seed, seat, decision id)`;
  budget `AI_TIME_BUDGET_MS` (default 100, worst decision so far 2.6 ms). Turn: greedy re-plan after every action, each legal action scored in
  morale points: colony defence from a board model (arrivals fill spaces, break barricades, then overrun; kills and barricades valued by the
  overruns they prevent, kills charged the exposure roll with frostbite counted as nearly lethal), food played only when the pay is short,
  waste cleaned near a multiple of 10, searches ranked by `query.searchOdds` weighted by the crisis' prevent symbols, the seat's secret
  objective and food shortage, moves only when search gain beats the exposure cost (colony not stripped while threatened), survivor and item
  abilities that kill without exposure, barricade, heal, feed or clean, never an attack on a survivor. Crisis: loyal seats contribute matching
  cards up to the estimated shortfall and never cards their objective needs; the betrayer contributes a wrong card about half the time unless the
  table's suspicion of it is high. Requests answered by generosity and suspicion of the asker. Suspicion: a Bayesian ledger over "seat j is the
  betrayer" from crisis shortfalls split over the seats that put cards in, declined requests and attacks on others; vote yes only on the top
  suspect above the persona threshold from round 2 (higher after a first exile), never self, the betrayer protects itself.
- Bench (`npm run bench:ai -- --games 40 --seed 1 --tier normal|random`, default objective We Need More Samples, 4 bots):

| 40 games, seed 1 | random | normal |
|---|---|---|
| colony objective completed | 0% (0/40) | 15% (6/40) |
| mean rounds | 2.83 | 4.43 |
| ended by | moraleZero 40 | moraleZero 31, objective 6, roundsOut 3 |
| betrayer present / betrayer won | 13 / 0 | 13 / 0 |
| exiles correct / innocent | 0 / 1 | 3 / 0 |
| decision ms mean / p95 / max | 0.01 / 0.02 / 0.25 | 0.12 / 0.29 / 2.03 |
| rejected actions / stalls | 0 / 0 | 0 / 0 |

  With `--objective random` (all ten main objectives): random 0/40 completed, 2.33 rounds; normal 0/40 (1 in 200 games), 4.97 rounds, 16 of
  40 games reach the last round alive. `npm run sim -- --games 20 --seed 5 [--tier normal]`: 0 violations, 0 leaks (random 2.3 rounds, normal 4.85).
- Known weaknesses: Normal still loses most games to morale (about one survivor a round to exposure, overruns and frostbite, a failed crisis every
  other round); only survival objectives and We Need More Samples (a kill-for-samples drive, 0.85 morale points per kill) can complete, and the
  card-contribution objectives (Find a Cure, Leave It All Behind, Stockpile) have no contribution action in the engine at all; the betrayer almost
  never wins (it sabotages crises but does not play its own win condition); suspicion needs wrong cards to read from, so a quiet betrayer is only
  found by its contribution pattern; requests only ask for food or medicine (a given card is played at once); no Easy/Hard tier, no spend-food on
  dice, no fuel-before-move trick, abilities valued only for kill, barricade, heal, food and waste. `AI_TUNE='{"death":2}'` overrides the tuning
  constants in `src/ai/normal/plan.ts` for bench experiments.

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
| 40 AI, 41 personas | written; random tier and slim Normal tier implemented (M4), 3 of 6 personas |
| 50 client | written; M3 vertical slice implemented (`src/client/`) |
| 60 testing | written; sim, invariants and leak test implemented |
| Card data (survivors, items, crisis, Crossroads, objectives) | M2 slice in `src/data/` (see Card data (M2)); verify pass against the physical cards still open |

## Next
- Owner playtest gate (M4): play 3 games on Pages against the three personas: does the table feel alive, is the betrayer findable but not obvious.
- M4 follow-ups if the playtest asks for them: Easy/Hard tiers, a betrayer that plays its own win condition, objective contribution actions in the engine.
- Remaining source gaps: 9 standard secret objective texts, 7 betrayal texts, official English crisis names (17).
- Owner request: if you have a physical copy, check the conflict tables in `docs/spec/sources/*-sources.md` against it
  (the rows marked Fan-source and the flagged numbers: Fuel Shortage, Zombie Wave, We Need More Samples hardcore,
  Leave It All Behind, Stockpile, and the location card space counts), and skim the M1 rulings in `docs/needs-rules-check.md`.
