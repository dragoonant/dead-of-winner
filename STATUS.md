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
- Tests (M1): 23 files, 289 tests, typecheck clean; M4b brings the suite to 33 files and 354 tests (OBJ-010..016 for the objective rule, AI-008). Engine tests per checklist prefix (ACT, ATK, CARD, COL, CRIS, DICE, EFF, END, EXIL,
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
- Update 2026-10-11 (card photos): only Hoarder and Neat Freak remain names-only; 11 objectives added, 4 of them draft from the pt-br fan sheet; 5 more crisis names are official.
- Update 2026-10-10 (VASSAL v1.1 scans): all 20 crises, 10 main objectives (20 faces), 24 standard secret objectives and 30 survivors are verified against clean scans of the real cards; Hoarder and Neat Freak are real records; all 20 crisis names are official. Corrections: Leave It All Behind (Food cards, 3 zombies hardcore, one weapon per player), Find a Cure hardcore (3 Medicine), We Need More Samples hardcore (4 samples), Hypochondriac (2 Medicine). Open: 5 betrayal texts the module censors (Runaway, All for One, Trigger Happy, Cult Leader, Serial Killers).
- Earlier known gaps (now closed except the betrayal texts above): 18 names-only objectives excluded (11 standard secret, 7 betrayal); 17 of the 20 crisis names are ours (`name-ours` tag);
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
  cards up to the estimated shortfall and never cards their objective needs; the betrayer's sabotage is described under M4b below. Requests answered by generosity and suspicion of the asker. Suspicion: a Bayesian ledger over "seat j is the
  betrayer" from crisis shortfalls split over the seats that put cards in, declined requests and attacks on others; vote yes only on the top
  suspect above the persona threshold from round 2 (higher after a first exile), never self, the betrayer protects itself.
- M4b balance pass: the engine gained the missing rule, **adding cards under the main objective** (`contributeObjective {cardId}`, event
  `CardAddedToObjective`, additive, logged in 00 §16; no die, own turn, exiled seats included; only symbols the objective counts, starter-deck
  cards refused where the card says "starting cards do not count" via `CardInstance.starter` + `excludeStarter`). The human gets an "Add to
  objective" button in the turn prompt and a feed line; Normal loyal seats add counting cards first thing each turn (unless the crisis needs the
  card or the seat's own secret objective counts it), a betrayer hoards them (one cover contribution a round once the table suspects it).
  AI changes: weapons and kill-ability survivors are picked and valued for Samples (survivor picks, colony-bound kill abilities such as Thomas
  Heart keep their owner home, equipped noExposure weapons), a fuel card is played before a move to skip its exposure roll, medicine is valued
  higher, crisis contributions run a little over the estimate, spare food is spent on dice, Outsiders stay in hand. Betrayer: wrong cards and
  withheld cards when the crisis is within two points of the line (more as rounds run out), colony help fades late, own survivors protected,
  hoards what its card needs (weapons for Trigger Happy, Outsiders for Cult Leader and a thin Serial Killers), asks for weapons, refuses
  requests for what it hoards, paces the collapse to its private goal.
- Bench (`npm run bench:ai -- --games 40 --seed 1 --tier normal|random`, default objective We Need More Samples, 4 bots; before = M4, after = M4b):

| 40 games, seed 1, Samples | random | normal before | normal after |
|---|---|---|---|
| colony objective completed | 0% (0/40) | 15% (6/40) | 30% (12/40) |
| mean rounds | 2.83 | 4.43 | 4.65 |
| ended by | moraleZero 40 | moraleZero 31, objective 6, roundsOut 3 | moraleZero 24, objective 12, roundsOut 4 |
| morale lost per game (killed / crisis / waste) | 3.6 / 1.3 / 0.7 | 4.2 / 1.4 / 0.3 | 2.9 / 1.8 / 0.6 |
| betrayer present / betrayer won | 13 / 0 | 13 / 0 | 13 / 3 (23%) |
| exiles correct / innocent | 0 / 1 | 3 / 0 | 1 / 0 |
| decision ms mean / p95 / max | 0.01 / 0.02 / 0.45 | 0.12 / 0.29 / 2.03 | 0.14 / 0.33 / 2.5 |
| rejected / stalls / leaks | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |

  Larger pools (the 40-game rows swing by ±7 points): Samples, 300 games seed 90: normal 24% completed, 4.66 rounds, betrayer won 19%
  (24/128), exiles 8 correct / 3 innocent; random 0/300, 2.82 rounds, betrayer 1/132. Samples seed 2 (40 games): normal 25%, 4.5 rounds,
  betrayer 1/17. `--objective random` (all ten main objectives, 40 games): seed 1 normal 0% (random tier 0%), 4.45 rounds, betrayer 3/26;
  seed 2 normal 5%, 4.85 rounds, betrayer 1/17. Per objective (30 games, M4b): Find a Cure about 30-37% (cards under the objective now count),
  Too Many Mouths about 17%; Leave It All Behind and Stockpile collect about half their cards but still never finish (every survivor armed;
  food, barricades and six cards), Winter Has Come ends at round 2-4 when no seat holds a fuel card for the colony-phase duty, Eight Weeks
  of Darkness, Kill Them, Home Sweet Home and Raiding Party never complete. `npm run sim -- --games 20 --seed 5 --tier normal`: 0 violations,
  0 leaks. The sim and bench print morale lost by reason and a `tally` of diagnostic counters (kills by cause and action, exposure rolls,
  crisis points, objective cards).
- Known weaknesses: Samples sits at 24-30% against a 35% target. The arithmetic is hard: 12 samples need about 24 kills, every kill that is
  not an item or ability kill rolls the exposure die (1 in 12 bite, 1 in 6 frostbite, which ticks a wound a turn until healed), so a win needs
  free kills and luck; parameter sweeps over 20 constants moved the rate by less than the bench noise, only the structural changes above
  counted. Crises still fail 2.5 times in 4.4 (the table rarely holds four cards of the one symbol; trading cannot help because a requested
  card is played at once). The betrayer reaches about 20% on pools of 130+ betrayer games (Cult Leader 33%, Trigger Happy 21%, Serial
  Killers 16%) and is still found more often than an innocent is exiled; it never attacks survivors (every attack hunt tried lifted the exile
  rate more than the win rate). Requests only ask for food, medicine or (Trigger Happy) weapons; no Easy/Hard tier; abilities are valued only
  for kill, barricade, heal, food and waste. `AI_TUNE='{"death":2}'` overrides the tuning constants in `src/ai/normal/plan.ts` for bench
  experiments.

## Rules corrections and photo data (2026-10-10)
- Engine now follows the official rulings in `docs/rulings-resolution.md` (CHANGES NEEDED): exiled survivors cannot move back to the
  colony (MOVE-010 flipped); morale 0 inside Adding Zombies ends the game only at checkpoints B, D, F (COL-019, `withMoraleEndDeferred`);
  the first player breaks vote ties even when exiled (VOTE-007; ballot key `tiebreakSeat`); attract = 0-2 zombies from one other
  location with an optional `to` choice of entrance spaces (ZOM-017..019; `00` §16); a request can address everyone (`to: 'all'`,
  CARD-020); crisis removals are logged after the effect (CRIS-021); event cards already left the game (CARD-021 pins it). Sample-roll
  order was already right (GOLD-001b). Deviation kept: hooks still pick the replacement leader themselves (item 10).
- Client limits: the exiled first player's tie-break answer defaults to "no" (no ballot UI for it); the Normal AI never attracts, so it
  uses no `to`.
- Data from eBay photos: Gluttony and Obsessed (betrayal), Junkie and Hypochondriac (standard), Thomas Heart (5+, once per round, no
  exposure; provisional flag cleared), Daniel Smith (once per round), Forest Plum, Raiders and Overpopulation official names
  (Exhaustion name seen too). New hooks `rule.hand.symbolsAtLeast`, `rule.hand.onlySymbol`, `rule.seat-survivors.eachEquippedSymbolAtLeast`.
  Playable objectives now 16 standard + 5 betrayal + 10 exiled. Still unknown: see `OWNER-REVIEW.md` section 2.

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
- Remaining source gaps: 5 betrayal texts (censored in the VASSAL module).
- Owner request: if you have a physical copy, check the conflict tables in `docs/spec/sources/*-sources.md` against it
  (the rows marked Fan-source and the location card space counts; the card numbers are now verified from the VASSAL scans), and skim the M1 rulings in `docs/needs-rules-check.md`.
