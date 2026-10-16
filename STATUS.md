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
  `tests/fixtures/bundle/` stays for unit tests. Counts: 30 survivors, 39 items, 7 decks, 7 locations, 20 crises, 80 Crossroads,
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
  itemTarget / effectChoice / objectiveChoice (works, terse); decision kinds the e2e run has not hit yet: newLeader, objectiveChoice
  (forms exist; crossroadsOption, exilePlacement, searchKeepWhich and votes are covered since M7); placeholder 3D art; objective part labels are mapped
  to plain words only for the common tests; the "two words" table talk on Talia Jones is not modelled.

## AI (M4, complete 2026-10-11)
Four tiers, six personas, a log-odds suspicion ledger and the 40 §8.4 vote rules. Entry `src/ai/index.ts` `createDecider(tier, persona, seed)` (`random | easy |
normal | hard`; `AI_TIERS` is what the start screen reads); the planner is `src/ai/normal.ts` over `src/ai/normal/{plan,info,options,suspicion,votes}.ts`, the tier
knobs are `src/ai/tiers.ts`, the table talk is `src/ai/talk.ts` plus `src/client/bot/talk.ts`. `docs/spec/40-ai.md` section 15 lists what is built against the spec.
- Tiers. Easy: 15% score noise, ledger reads attacks only (votes yes only on that), never asks for cards, 1 food token a die, persona at half strength, naive
  betrayer. Normal: full ledger and the cover-budget betrayer (margin 0.8). Hard: wound-aware risk pricing, "finishing" mode (once the counters are met, play only to
  live through the colony phase that checks them), the seat-by-seat crisis-total distribution, thresholds 0.05 lower, a patient betrayer (margin 0.5) that may call
  a deflecting vote. Normal runs the M4b constants (sampleKill 1.15, woundW 0.4); Hard the tuned set (sampleKill 1.3, woundW 1.0).
- Personas (41 §1): Vera Lindqvist (Quartermaster), Teddy Marchbanks (Optimist), Ruth Castellano (Hard Case), Jojo Pruitt (Kid), Dr. Anand Rao (Doctor), Silas Crane
  (Drifter): scalars from the sheet, 63-71 own-words lines each across the 41 keys. The original 24 lines of the first three keep their audio ids (key + position);
  every new line is `voiced: false` and plays no clip (`tools/audio-build-manifest.ts` skips them, the client matches audio by exact line text).
- Suspicion: crisis shortfalls split over contributors (a seat that put nothing in is cleared), declined requests, colony-hurting Crossroads picks, zombies attracted
  onto others, hoarding, attacks, claims against the revealed pile (over an in-process talk bus), accusing votes; paranoia scales bad news, trust scales statements;
  vote iff S passes the persona threshold and the colony can afford the dice (morale 3+, at most a third of the table's dice); a call needs the estimated yes votes to
  reach a majority; an exiled first player breaks ties through `votes[tiebreakSeat]` and the bot answers for it. `suspicionTrajectory(seed?)` feeds the recap.
- Betrayer: the card's own condition tree is parsed from the bundle (hand symbols, weapons carried, survivors, barricades, most survivors, survivors gone): it
  hoards, searches, equips and paces the collapse to the card.
- Found while balancing: the Samples win was blocked in about 19% of games by The Deputy's added victory condition (0 of 19 such games completed): the bots took the
  deal. Options now price added victory conditions and Crossroads effect votes are read from the card's two outcomes. Also fixed in the engine: a `newLeader`
  decision stale after a multi-kill (SURV-017/018), a Snowmobile overrun that dropped the leader decision (SURV-019), a negative objective `have` (OBJ-021).
- Bench (`npm run bench:ai -- --games 200 --seed <21|22> --tier <t>`, We Need More Samples, 4 bots, personas Vera/Teddy/Ruth/Jojo; 400 games per tier, both seeds pooled):

| tier | colony objective completed | betrayer won (present 180) | exiles correct / innocent | mean rounds | decision ms mean / p95 / max | rejected / stalls / leaks |
|---|---|---|---|---|---|---|
| random | 0% (0/400) | 2.8% (5/180) | 0 / 5 | 2.8 | 0.02 / 0.04 / 0.6 | 0 / 0 / 2 (Gambling card, see below) |
| easy | 19.5% (78/400) | 8% (15/180) | 0 / 0 | 4.0 | 0.23 / 0.49 / 4.0 | 0 / 0 / 0 |
| normal | 26.0% (104/400) | 9% (16/180) | 0 / 0 | 4.2 | 0.24 / 0.51 / 4.4 | 0 / 0 / 0 |
| hard | 30.5% (122/400) | 11% (20/180) | 0 / 0 | 4.4 | 0.25 / 0.52 / 4.8 | 0 / 0 / 0 |

  Seeds 91+92 (1600 games each, run through the same code): normal 25.9%, hard 28.1%. Seed-to-seed spread is about 3 points per 200 games, so the ladder
  random < easy < normal < hard holds but hard over normal is a 2 to 4 point edge (about 1.5 sigma).
- Misses against the M4 targets (honest list): Normal completes 26-30%, target 30-40% (retargeted 2026-10-15 to the designer's stated 30% aim; was 35-50%), so Normal is about 4 points short and Hard 28-31% is at the edge. Betrayer wins 8-11% of the games it is in, target 25-40%. Exiles are
  almost never called (0 in 1600 bench games at spec weights): one wrong card in the pile cannot tell three contributors apart, so a rational ledger stays below every
  persona's threshold; scaling the weights up (8 per wrong card and a clamp of 5 a round) exiled 48 innocents for 2 correct exiles in 800 games. Hence "real betrayer exiled more often than an innocent"
  holds only vacuously (the ledger test AI-007 shows three wrong-card crises do lift the one seat that was always in the pile over the thresholds). Mean decision time and
  rejected / stalls / unknown-code targets are met.
- What the sweeps showed (about 12 iterations of 400-1600 games; the rule-off runs below are diagnostics only, the exposure die stays as printed): the engine's exposure die is the whole game. With no bite face the Normal bot completes 55%; with no
  frostbite 46%; with no exposure at all 82%; with no crisis fail effects 49%. Each morale point is worth about 8 points of completion, and a bot loses about 3.7
  morale a game to survivor deaths (18-20 exposure rolls: 12 kills, 5 moves, 2 cards) and 1.8 to failed crises (only 45% are prevented: the table rarely holds 4 matching
  cards). Parameter sweeps over 35 constants (kill value, death price, wound price, contributions, movement, search weights, survivor picks, outsiders, hoard size,
  betrayer appetite) moved the rate by less than the noise except: sampleKill 0.85 to 1.3 (+3), contributing nearly everything that matches (inP 0.85 to 0.45, +3),
  wound price 0.12 to 1.0 (+3), the Deputy/effect-vote fix (+2), finishing mode (+1 to 2). What did not help: lookahead 3 colony phases, hand-tracked crisis totals
  (neutral), a per-survivor risk model, morale-scaled caution, more weapon hunting (monotonically worse), playing Outsiders.
- Known gaps: the recap's `suspicionTrajectory` has one point per crisis; the client's tie-break ballot for an exiled bot first player is assembled in
  `src/client/store/gameStore.ts` (`ballotAction`), which still answers "no" for the extra `tiebreakSeat` key (sim-core answers it from the bot); the sim's `random` tier
  trips the hidden-id leak test in the Gambling Crossroads card (a continuation in the pending decision carries another seat's card id; task spawned, engine view fix).
- Experiment knobs: `AI_TUNE='{"woundW":1}'` overrides `TUNE` (plan.ts) and the ledger weights (`wShort`, `wCleared`, `clamp`), `hHand`, `hHorizon`, `hTau`, `hFin` switch Hard's
  features one at a time; nothing else reads the environment.

## Rules corrections and photo data (2026-10-10)
- Engine now follows the official rulings in `docs/rulings-resolution.md` (CHANGES NEEDED): exiled survivors cannot move back to the
  colony (MOVE-010 flipped); morale 0 inside Adding Zombies ends the game only at checkpoints B, D, F (COL-019, `withMoraleEndDeferred`);
  the first player breaks vote ties even when exiled (VOTE-007; ballot key `tiebreakSeat`); attract = 0-2 zombies from one other
  location with an optional `to` choice of entrance spaces (ZOM-017..019; `00` §16); a request can address everyone (`to: 'all'`,
  CARD-020); crisis removals are logged after the effect (CRIS-021); event cards already left the game (CARD-021 pins it). Sample-roll
  order was already right (GOLD-001b). Deviation kept: hooks still pick the replacement leader themselves (item 10).
- Client limits: the Normal AI never attracts, so it uses no `to`. (The exiled first player's tie-break ballot was added in M7.)
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
| 40 AI, 41 personas | written; four tiers, six personas, suspicion model and vote rules implemented (M4); balance targets partly missed, see AI (M4) |
| 50 client | written; M3 vertical slice implemented (`src/client/`) |
| 60 testing | written; sim, invariants and leak test implemented |
| Card data (survivors, items, crisis, Crossroads, objectives) | M2 slice in `src/data/` (see Card data (M2)); verify pass against the physical cards still open |

## Next
- Owner playtest gate (M4): play 3 games on Pages against the six personas at Normal and Hard: does the table feel alive, is the betrayer findable but not obvious.
- AI follow-ups: a betrayer that is detectable from public play (it needs a trace other than wrong cards), a stronger Hard (the exposure die decides Samples; free kills from weapons are the lever), the client ballot for an exiled bot first player.
- Remaining source gaps: 5 betrayal texts (censored in the VASSAL module).
- Owner request: if you have a physical copy, check the conflict tables in `docs/spec/sources/*-sources.md` against it
  (the rows marked Fan-source and the location card space counts; the card numbers are now verified from the VASSAL scans), and skim the M1 rulings in `docs/needs-rules-check.md`.

## Crossroads (M8, 2026-10-11)
- Content: all **80** base-game Crossroads cards are in `src/data/crossroads/` (20 earlier + 60 new). Triggers and option effects follow the
  BGG sheet; every vignette, trigger line and option text is ours (`npm run check:copied`: 0 runs of 8+ words shared with the sheet).
  9 cards carry the mature mark (the sheet has none: Abandoned, Addiction, Brandon Kane, Voyeur, Welcome Home, Annaleigh Chan, Arthur
  Thurston, Bev Russell, Lover's Quarrel); Gray Beard, Mugging and Prophet leave the co-op deck; 30 of 30 survivors have their card, linked
  through `survivor`. Army, Riot and Thomas Heart print three options. Table: `docs/spec/sources/crossroads-sources.md`.
- Hooks: `src/engine/crossroads-hooks.ts` (about 60 hooks, registered in `code-hooks.ts`, vocabulary in `docs/spec/21-card-effects-dsl.md` section 15);
  `tests/engine/xrd-m8.test.ts` (66 tests: every card's trigger and both options, plus the engine seams) and `xrd-copied.test.ts`.
- Engine fixes found on the way (all in `docs/spec/00-architecture.md` section 16): the die actions (move, search, attack, barricade, clean
  waste, attract) never let the held Crossroads card look, so in play almost no card fired (1 choice per 30 sim games before, about 3 per
  game now); effect votes now send an exiled first player's tie answer through `votes[tiebreakSeat]`; `hiddenIdsFor` keeps revealed crisis
  cards public; Maude's trigger used `locationIs` with `location`, which tested the card's own place (now `value`).
- Gates: `npx tsx tools/validate-data.ts src/data` 0 errors, 0 warnings, 80 Crossroads; typecheck and `npm test` green (458 tests);
  `npm run sim -- --games 30 --seed 12 --tier normal` 0 violations, 0 leaks (and 660 more games over 2 to 5 seats: 0 leaks, 1 rejected
  `chooseLeader` that is a crisis multi-kill bug outside this work, task spawned).
- Bench (`npm run bench:ai -- --games 100 --seed 11 --tier normal`, We Need More Samples, 4 bots): colony objective completed **24%** (24/100;
  M4b figure 29%), mean 4.75 rounds, ended by moraleZero 66 / objective 24 / roundsOut 10, betrayer won **2%** (1/49; was 10%), exiles 4 correct
  / 2 innocent, 0 rejected, 0 stalls, 0 leaks. The drop is mostly real Crossroads now happening (about 3.1 choices a game, 0.09 morale a game lost to them), not
  the new cards alone. The bots value hook-based options at 0 and answer optional prompts "no", so they play the new cards blind; teaching
  `src/ai/normal/options.ts` the hook names is the next AI step.
- Known gaps: the client labels an injected ability (greenhouse, clinic, craving) with the survivor's own ability text; an attached
  survivor ability is not drawn on the card.

## Client polish (M7, 2026-10-11)
Everything here is `src/client/**`, `tests/client/m7.test.ts` and `tests/e2e/{m7.spec,drive,policy}.ts`; the engine and the AI are untouched. Every number the
feed, tray and recap print is an engine event field or a `query.*` call on the presented state (the exposure odds of a roll, the crisis target); the client only counts
the lines it has already listed.
- **Feed** (`presentation/feedModel.ts`, `ui/FeedRail.tsx`): lines are grouped by round, then turn, with a header per colony-phase step ("Step 3: the crisis resolves").
  Four breakdown groups fold open: the **crisis reveal** (each card flipped with +1/-1, the running total against the target, the verdict chip, the failure effect and
  the morale change), every **exposure roll** (the face with an odds bar, the odds it had from `query.exposureOdds`, wound/frostbite/bite-chain steps, a death in the
  chip), **zombie placement** (entrance number, barricade broken, overrun victim, a count chip) and a **vote** (ballots, result, exile). The newest three groups stay
  open. A Crossroads card vote reads as a table vote (nobody is exiled); Crossroads lines name the card and the option taken. Phase-change lines are gone (the headers say it).
- **Crisis strip** shows the target and bonus line (`query.crisis`), each flipped card with its running total, then the verdict and the morale change.
- **Recap story** (`recap/story.ts`, `ui/GameOver.tsx`): per seat "what they were really doing": the secret objective with its engine progress and whether it was met,
  the betrayer reveal, the hidden crisis cards per crisis (a seat-by-crisis table too), the Crossroads choices with the option text, the final hand, and the table's
  suspicion by round **when the AI exposes it**: the recap calls an optional `suspicionTrajectory(seed)` export of `src/ai` (shape in `recap/suspicion.ts`); nothing exports
  it yet, so the section is skipped. Play again keeps the personas, tiers and variants.
- **Effects** (`vfx/`): light snowfall (one Points object), a flickering firelight over the colony (a point light and an additive decal), a frost vignette that grows as
  morale falls (CSS, from the engine morale), short edge flashes for zombie kills, wounds, frostbite, bites and deaths, a 3D tumble with changing faces for the action dice
  and a 12-sided exposure die in the tray (with the odds under it). **Demand frameloop respected**: ambient effects ask for frames at 24 per second only while active
  (High graphics, no reduced-motion preference, tab visible); **Low graphics** turns off the snow, the shadows (new on High: one 1024 shadow map) and the flicker, and the
  canvas then renders nothing while the table is still (the e2e counts frames through `window.__game.frames()`).
- **Settings popover**: animation speed, graphics, seat colours (Default, Alternative, Colour-blind safe = Okabe-Ito with a shape mark beside each seat), narration,
  the two rails with `[` and `]` (verified in the e2e, remembered in `dow.settings`), the volumes, tutorial tips and **Replay tutorial tips**. Nine one-off tips
  (`ui/tipsModel.ts`) show the first time each situation comes up.
- **Start screen**: three columns (seats, objective, variants). Co-op, two players (forces you plus one bot; un-ticking seats a second), hardcore objective side, betrayer
  variant, player elimination and **Mature Crossroads cards (default ON: all 80 cards, as in the original; off leaves out the 9 with adult themes)**. Validation
  (`launch.ts` `checkVariants`, tested against the engine's own `createGame` for every offered combination): the betrayer variant cannot join co-op or two-player (greyed
  with a note), co-op shows the hardcore side as forced, Start is blocked on an invalid combination. Per bot: persona with its blurb and a difficulty. The tier list is
  read from `src/ai` (its exported `AI_TIERS`, a dynamic import; Normal and Random are the fallback when a module lists none), so Easy, Normal, Hard and Random show once
  the AI exports them, as `src/ai/tiers.ts` now does. URL: `?variants=coop,hardcore,betrayer,elimination,twoPlayer` and `?mature=0`; `?tier=easy|hard` accepted.
- **Votes**: an exiled first player now gets a ballot of their own when a vote needs a tie-break (the old default was "no"). It is asked up front ("if the vote ends in a
  tie, should X be exiled?"), held until the bots' private ballots are in, and sent in the one `castVotes` as `votes[tiebreakSeat]`. A human voter's ballot is held the same
  way, which also closes a small race (the ballot used to go out with unanswered bots counted as "no"). **Crossroads group votes** read the card and the two answers from the
  decision's own continuation and show them ("Yes means ..."), instead of the exile text that was wrong for them.
- **E2E** (`tests/e2e/m7.spec.ts`, 13 tests, helper `drive.ts`): the human's decisions are answered through the `?test=1` hook by a fixed policy until the wanted prompt
  opens, then the test clicks the real dock. Seeds: `b` (Crossroads choice and keep-which-card after making noise), `s16` (Crossroads group vote), `i` (you hold the
  first-player token: exile placement, then the tie-break ballot; bots are paused through the new `window.__game.pauseBots(true)` hook and one ballot is completed through the
  hook). Also covered: start-screen variants and validation, variants reaching the engine, settings, rails keys, Low graphics, tips, the feed groups and crisis strip,
  the tray tumble and hit flash, the recap story. Screenshots (gitignored): `e2e-out/m7-{start,settings,feed,crisis,snow,recap}.png`.
- **Fixed on the way**: the top bar title was clipped at 1280 px and its buttons shifted as the active seat changed (fixed-width seat block, shorter labels); the
  prompt dock did not re-render when a held ballot was set; talk lines carry no round or turn and join the group before them.
- Chunk sizes (gzip): title 24 KB (was 18), react 62, client 51.5 (was 45), engine 193 (the AI work grew it), three 266; the first load is title + react, about 86 KB.
- Known limits: a bot that is the exiled first player answers a vote tie as "no" (the bot driver collects ballots for eligible seats only; `src/client/bot/` is not part of
  this work); `window.__game.frames()` and `pauseBots` are test hooks only; the firelight is subtle by design; the Easy and Hard tiers play as far as the AI work has taken them.
