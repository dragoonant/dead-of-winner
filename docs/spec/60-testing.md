# 60. Testing

How the game is checked: commands, naming, the simulator, the AI benchmark, end-to-end tests, and
the Mallet/Whirr lessons turned into test rules.

**Source keys.** `B.4`, `C.n`, `J` = brief sections (`docs/DEAD-OF-WINTER-HANDOFF.md`). `12` = spec
`12-rules-test-checklist.md`, `13` = spec `13-golden-examples.md`, `40` = spec `40-ai.md`,
`50` = spec `50-client.md`. `CLAUDE.md` = project instructions.

---

## 60.1 Commands (B.4)

| Command | What it runs | Gate |
|---|---|---|
| `npm run typecheck` | `tsc --noEmit` over `src/`, `tools/`, `tests/` | every commit, CI |
| `npm test` | Vitest: `tests/**/*.test.ts` (engine, golden, data, ai, client units) | every commit, CI |
| `npm run validate:data` | `tsx tools/validate-data.ts`: ajv against `docs/spec/schemas/`, cross-refs, asset manifest (30.8.3), prompt lint (30.2.2), card text fit (30.7.5) | every commit, CI from M2 |
| `npm run sim` | `tsx tools/sim.ts`: headless bots-only games with invariants and the leak test (60.4) | every stage from M1 |
| `npm run bench:ai` | `tsx tools/ai-bench.ts`: tier-vs-tier and tier-vs-baseline win rates and decision times (60.5) | AI milestone, before owner playtest |
| `npm run e2e` | Playwright on the Pages sub-path (60.6) | every stage from M3 |

- 60.1.1 After an interrupted run: `git status`, then
  `npm run typecheck && npm test && npm run validate:data`. (CLAUDE.md)
- 60.1.2 All of these run in the FOREGROUND. Never background `npm test` or the sim. (J)
- 60.1.3 Never run `npm install` from concurrent agents. (J)
- 60.1.4 CI (`.github/workflows/deploy.yml`, Node 22): `npm ci`, typecheck, test, build, deploy.
  From M1 add `npm run sim -- --games 20 --ci`; from M3 add `npm run validate:data` and e2e in a
  separate job that does not block the Pages deploy.

## 60.2 Layout and naming

- 60.2.1 Folders: `tests/engine/`, `tests/golden/`, `tests/data/`, `tests/ai/`, `tests/client/`,
  `tests/e2e/`, `tests/fixtures/`. (C.2; 13)
- 60.2.2 Vitest picks up only `*.test.ts`; Playwright specs are `tests/e2e/*.spec.ts` so Vitest
  never loads them (see `vite.config.ts` `test.include`).
- 60.2.3 **Engine tests are named by checklist ID**: `it('EXPO-004 bite spreads to the lowest-
  influence survivor at the location', ...)`. One `it` may carry one ID; an ID may appear in
  several tests. IDs come only from `12`; a new rule needs a new checklist line first. (B.4)
- 60.2.4 Golden tests: `tests/golden/GOLD-xx.test.ts`, `it('GOLD-xx ...')`. (13)
- 60.2.5 Other prefixes. Registered in `12` (rows parsed like rules rows): `VIEW-` (hidden
  information, a rules section of `12`), and the "Non-rules prefixes" table of `12`: `ARCH-`
  (00 §00.11), `SIM-` (simulator invariants, 60.4.3), `DSL-` (21 §21.13), `DATA-` (20 §20.13),
  `AI-` (40 §40.14) and `AI-FAIR-` (40 §40.11). Not coverage-tracked, allowed by name only:
  `GOLD-xx` (two digits, scenarios in `13`), `UI-NNN` (client units) and `E2E-NNN` (Playwright
  titles). Any other prefix is an error (60.2.6).
- 60.2.6 **Coverage is by name, not lines.** `tools/checklist-coverage.ts` (run inside `npm test`
  as `tests/engine/checklist-coverage.test.ts`) works in four passes:
  1. **Registry.** Parse `12` with the row format and regex that `12` itself defines in its "Line
     format" paragraph (row `| <PREFIX>-<NNN> | <Mn> <must|should> | <assertion> | <ref> |`; the
     regex there is authoritative, and the tool imports it as one constant rather than retyping
     it). Rules rows and the non-rules rows (ARCH, SIM, DSL, DATA, AI, AI-FAIR) are parsed the same
     way. The prefix set is the prefixes of parsed rows plus the "Non-rules prefixes" table.
  2. **Owner drift.** Scan the owning sections for every token matching the pass-3 ID pattern
     (unanchored) with that section's prefix: `00` §00.11 (ARCH), `20` §20.13 (DATA), `21` §21.13
     (DSL), `40` §40.11 and §40.14 (AI, AI-FAIR) and the whole of `60` (SIM; `SIM-010` sits in
     60.2.8). An ID defined in an owning spec with no row in `12`, or a row in `12` whose ID is
     absent from its owning spec, fails.
  3. **Titles.** Grep every `it(` / `test(` title under `tests/` for a leading ID token
     (`^[A-Z]+(?:-[A-Z]+)*-\d{2,3}\b`). A token whose prefix is neither in the prefix set nor in the
     name-only list of 60.2.5 fails as **unknown prefix**. A token with a known prefix but no row
     in `12` fails as **unknown ID**.
  4. **Coverage.** Print covered / uncovered per prefix. An uncovered row fails only when it is
     `must` and its `Mn` is at or before the current milestone (env `CHECKLIST_MILESTONE`, e.g. `M1`, set
     by CI per stage; default `M0`); `should` rows only warn.
- 60.2.7 Lean mode (default): about 10 focused tests per stage, no adversarial verify loop.
  Verify loops are on for card data batches and the AI milestone. (CLAUDE.md)
- 60.2.8 Determinism: every test that rolls dice or shuffles sets a seed through `rng.ts`; no
  `Math.random` in `src/engine` or `src/ai` (a grep test, `SIM-010`, enforces it).

## 60.3 Engine and data tests

- 60.3.1 Engine tests drive the public API only (`src/engine/index.ts`): build a state from a
  fixture, apply actions, assert state, events and the one `PendingDecision`.
- 60.3.2 Fixtures in `tests/fixtures/` are JSON states or builder calls; never hand-built objects
  that bypass the engine's own constructors.
- 60.3.3 Data tests (`DATA-*`): every card validates against its schema; every DSL effect parses;
  every `{"code": "<hook>"}` names a registered hook; every value carries a source key that exists
  in `docs/spec/sources/`; counts match 10.1 (30 survivors, 25 starting items, 6 × 20 location
  items, 20 crises, 80 Crossroads, 10/24/10/10 objectives) once each batch lands.

## 60.4 Simulator (`tools/sim.ts`, `tools/sim-core.ts`) (B.4, J)

- 60.4.1 Usage: `npm run sim -- --games <n> --seed <s> --seats <k> --objective <id|random>
  --variant <standard|betrayer|...> --tier <id> [--ci] [--json out.json]`. Defaults: 50 games,
  seed 1, seats cycling 2–5, random objective, standard variant.
- 60.4.2 Each game runs bots-only through the same store-free loop: `pending = decision(state)`;
  for each answering seat call its decider with `view(state, seat)` only; `step`. Bots never see
  `GameState`.
- 60.4.3 Invariants checked after **every** step (a failure stops the game, prints seed, step,
  decision and the last 20 events, and the run exits non-zero):
  - `SIM-001` exactly one `PendingDecision` while the game is open; none after it ends.
  - `SIM-002` the open decision's legal answers (`legalActions`, `decision.legal` in each
    answerer's view) are non-empty. (J)
  - `SIM-003` every answer a decider returns is in its `decision.legal`.
  - `SIM-004` morale within `[0, moraleMax]`; food ≥ 0; round within the objective's range.
  - `SIM-005` card conservation: every card id is in exactly one zone.
  - `SIM-006` zombies: each entrance space holds at most one zombie or one barricade; counts in
    the view equal counts in the state.
  - `SIM-007` **leak test** (`VIEW-*`, B.4): serialize `view(state, s)` for every seat `s`; assert
    it contains none of the other seats' hand card ids, secret objective ids, the face-down crisis
    contribution ids (before reveal), or the Crossroads card another seat drew. Runs on every step
    of every game.
  - `SIM-008` replay: re-running the game from its seed and action log reproduces the final state
    hash.
  - `SIM-009` every game ends with a recorded outcome (win/loss per seat).
- 60.4.4 **Decision cap**: `SIM_MAX_DECISIONS` (default 4000) per game. Hitting it fails the game
  as `cap` with seed and round.
- 60.4.5 **Stall detector**: fail as `stall` if the state hash and the pending decision are
  unchanged for `SIM_STALL_STEPS` consecutive steps (default 50), or if one game exceeds
  `SIM_GAME_MS` wall time (default 60000; CI doubles it). (J)
- 60.4.6 Output: a summary line per game and a JSON report `{games, failures:[{seed, kind, step,
  detail}], outcomes:{win, loss, betrayerWin}, rounds:{mean,p95}, decisions:{mean,p95},
  msPerDecision:{mean,p95}}`.

## 60.5 AI benchmark (`tools/ai-bench.ts`) (B.4; spec `40`)

- 60.5.1 Runs fixed seed sets: each tier vs a random-legal baseline and each tier vs the tier below;
  reports win rate with 95% interval, objective completion, betrayer detection rate, false exile
  rate and per-decision time (mean, p95, max).
- 60.5.2 Pass thresholds are owned by `40`; the bench exits non-zero when one fails.
- 60.5.3 Results append to `docs/bench/ai-<date>.json` so trends are visible across stages.

## 60.6 Per-decision AI time budgets (CLAUDE.md, B.4)

- 60.6.1 Every AI decision reads its wall-clock budget from `DecideContext.budgetMs`, which the
  host fills with `resolveAiBudgetMs(env, override)` from `src/engine/decider.ts`: env var
  `DOW_AI_BUDGET_MS` (Node: `process.env`) or `VITE_DOW_AI_BUDGET_MS` (browser build), default
  250 ms, `0` = no wall-clock cap (00.10.2; 40.12.2). No AI code hard-codes a time limit.
- 60.6.2 Tests, the sim and `bench:ai` set `DOW_AI_BUDGET_MS=0` so only the deterministic node caps
  apply and slow CI runners cannot change outcomes (40.12.3). No test asserts on wall time except
  `bench:ai --budget-ms N`.
- 60.6.3 Planners are anytime: on budget expiry they return the best legal action found so far,
  never nothing.

## 60.7 End-to-end (Playwright) (B.4, C.5)

- 60.7.1 Serves the Pages sub-path: `playwright.config.ts` builds, then runs `vite preview` at
  `http://localhost:<PW_PORT|4173>/dead-of-winner/`, so base-path bugs show locally.
  `PW_PORT=4183` picks another port.
- 60.7.2 `E2E-001` full game: open `?test=1&seats=human,bot,bot,bot&objective=<id>&seed=<n>
  &speed=instant`; the human answers every prompt by clicking the first enabled option by exact
  text; the test ends at the recap. Fails if a prompt stays open longer than 10 s without a human
  owner.
- 60.7.3 `E2E-002` start screen: Start is visible above the fold at 1280 × 760. `E2E-003` gallery
  loads every manifest entry (fallbacks allowed). `E2E-004` no console errors and no asset 404s
  under the sub-path.
- 60.7.4 Picks match exact visible text (`{ exact: true }`); state checks use `window.__game` and
  the DOM proxies of 50.10.4, never pixel positions. (J)
- 60.7.5 Each stage that changes the client ends with screenshots from Playwright for the
  check-in. (CLAUDE.md)

## 60.8 Part J lessons as test rules

| # | Lesson (J) | Test rule |
|---|---|---|
| 60.8.1 | Empty `legalActions` froze a bot | `SIM-002` on every step |
| 60.8.2 | Planner's preferred plan used as the feasibility test | `AI-*`: feasibility = any candidate passes engine validation; a test feeds a state where the preferred plan fails but another passes |
| 60.8.3 | Duration expiry overwritten instead of max | a checklist test applies two "until the end of the next round" effects (Blizzard twice) and asserts the later expiry holds |
| 60.8.4 | Games hit the 60 s cap | decision cap and stall detector (60.4.4–5) from M1 |
| 60.8.5 | DSL lacked verbs; mechanics shipped unbuilt | `DATA-*`: every card in the slice encodes with no `unbuilt` marker before the DSL freezes |
| 60.8.6 | Values marked unverified after one failed source | `DATA-*`: every value cites at least one source key; two-source values flagged in the report |
| 60.8.7 | Rulings reconciled late | `DATA-*`: every `RULING:` line carries a status word (Confirmed, Corrected, Unsourced, Fan-source) |
| 60.8.8 | UI showed the previous roll's target | `UI-*`: prompt target equals the engine value at the presentation cursor |
| 60.8.9 | UI arithmetic ignored a modifier | `UI-*`: grep test, no arithmetic on view numbers in `src/client/ui` prompt builders; numbers come from the engine |
| 60.8.10 | Dice tray hidden behind a prompt | `E2E-*`: tray and open prompt bounding boxes do not overlap at 1280 × 760 |
| 60.8.11 | Some roll types skipped the tray | `UI-*`: every roll event type has a tray presenter (exposure included) |
| 60.8.12 | Panel hid Confirm/Reset | `E2E-*`: every open prompt's buttons are in the viewport |
| 60.8.13 | Right/middle click or Alt/Space dragged pieces | `UI-*`: pointer handler ignores non-primary buttons and modifier keys |
| 60.8.14 | E2E text picks drifted | exact-text picks only (60.7.4) |
| 60.8.15 | One sound for every weapon | `DATA-*`: every location and item symbol has a search and reveal entry in `eventSounds.ts` |
| 60.8.16 | Heavy GLBs hurt frame time | `validate:data`: `tris` ≤ 7000 (30.8.3) |
| 60.8.17 | Style words gave wrong proportions | prompt lint (30.2.2) |
| 60.8.18 | Backgrounded `npm test` stalled; concurrent installs broke `node_modules` | process rules 60.1.2–3 |

## Rulings

- RULING: sim decision cap | `SIM_MAX_DECISIONS` default 4000 per game | brief J reports 3,700-decision games in Whirr; a DoW game has fewer decisions, so 4000 catches loops without false failures | Unsourced
- RULING: AI time budget default | DOW_AI_BUDGET_MS, default 250 ms, 0 in tests/sim/CI (node caps only) | follows the frozen decider.ts and 40.12; replaces the earlier 150 ms ×2 CI scaling, which made results machine-dependent | Unsourced
- RULING: checklist ID registry | 12's row format and regex are authoritative; owning specs (00, 20, 21, 40, 60) are drift-checked against 12; unknown prefixes fail; GOLD/UI/E2E are name-only | keeps 60.2.3 "IDs come only from 12" true for non-rules IDs | Confirmed (12 Line format and Non-rules prefixes)
