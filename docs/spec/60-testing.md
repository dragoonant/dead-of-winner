# 60: Testing

Lean by default (CLAUDE.md): about 10 focused tests per stage, plus the invariants below, which always run. Coverage is
measured by test names against the checklist IDs in `12-rules-test-checklist`, not by line coverage.

## 1. Layout and naming

| Path | Runner | Content |
|---|---|---|
| `tests/engine/*.test.ts` | vitest | rules by checklist ID; contracts (`CONTRACT-`); import boundaries |
| `tests/data/*.test.ts` | vitest | schema + `validate-data` cross-checks, text limits, source columns present |
| `tests/ai/*.test.ts` | vitest | dice knapsack vs brute force, crisis estimate, suspicion updates, betrayer cover budget (`40-ai`) |
| `tests/client/*.test.ts` | vitest (node, no DOM) | director ordering, tray purpose coverage, prompt text, feed lines, seat layout, GLB slugs |
| `tests/e2e/*.spec.ts` | Playwright | the production build at `/dead-of-winner/` |
| `tests/fixtures/` | | seeds, saves, golden logs, `build.ts` state helpers |

- **Checklist-ID naming.** Every rules test title starts with its ID: `it('EXPO-004 a bite on a move spreads at the
  destination', …)`. Prefixes (Part I): `SETUP- DICE- ACT- ATK- SRCH- MOVE- EXPO- CARD- XRD- CRIS- COL- ZOM- SURV- OBJ-
  EXIL- VOTE- END- VIEW-`, plus `CONTRACT-` (rng), `GOLD-` (§6), `AI-`, `UI-`.
- `tools/checklist-coverage.ts` greps test titles and prints covered / uncovered IDs; a `must` ID without a test fails M2.
- Tests build states through `createGame` + actions or `tests/fixtures/build.ts`, never hand-written `GameState`.
  Forced dice come from `tests/fixtures/rng.ts: stateForRolls(wanted[])`, which searches sfc32 states whose next
  `rollDice`/`rollExposureFace` outputs match and sets `state.rng` on the built state; the frozen `rng.ts` has no
  override hook and `Math.random` is never patched.

## 2. The verification ladder

Run in this order; each rung assumes the one above is green. All in the FOREGROUND.

| Rung | Command | Passes when |
|---|---|---|
| 1 Types | `npm run typecheck` | `tsc --noEmit` clean, frozen files unchanged (or logged in `00` §16) |
| 2 Unit | `npm test` (`vitest run`), `npm test -- -t "EXPO-"` for one prefix | green; `tools/checklist-coverage.ts` shows no uncovered `must` from the stage's prefixes |
| 3 Data | `npm run validate:data` | every JSON in `src/data/` validates against `docs/spec/schemas/`, ids unique, every reference resolves, every value has a source row |
| 4 Sim | `npm run sim -- --games 200 --seed s` | 0 invariant failures, 0 leaks, 0 stalls, 0 caps (§3) |
| 5 AI | `npm run bench:ai -- --games 50 --seed 1 --seats bot,bot,bot,bot --objective samples` | targets in `40-ai` (H.8); p95 decision time within budget |
| 6 E2E | `npm run e2e` | builds, serves `/dead-of-winner/`, core specs green (§7) |

Every stage ends with rungs 1–3 green, a commit and a push; rungs 4–6 are per milestone (§9).

## 3. Engine invariants (every sim game and a vitest fuzz)

| Invariant | Check |
|---|---|
| one decision | every `StepResult.pending` is defined; kind `gameOver` iff `phase === 'ended'`; `pending.seat` is a live seat or `'all'` for `votes` |
| non-empty legal | `legalActions(state).length > 0` for every open decision and every member passes `validate`; `turnAction` contains `endTurn`, `crisisContribution` contains `[]`, `biteSpreadOption` both choices, `votes` an all-no ballot |
| reject, never throw | random malformed actions give a `rejection` with a known `RejectionCode` and the SAME state reference; only `EngineInvariantError` may throw (counted as a failed game) |
| determinism | `replay(setup, seed, bundle, log)` reproduces the final state hash; two runs of one seed give identical logs |
| save/load | `save` → `load` mid-game → same hash and `pending.id` |
| **leak** | for every seat after every step: `serializeView(view(state, seat))` contains none of `hiddenIdsFor(state, seat)`; `redactEvent` leaves none either; `recap` is absent until `ended` (B.4, `VIEW-*`) |
| counts | morale ≥ 0, food ≥ 0, `roundsLeft ≥ 0`; zombies per entrance ≤ `capacity.entranceSpaces` − barricades; survivors per location ≤ `capacity.survivors`; noise ≤ `capacity.noiseSpaces`; a seat's dice = 1 + alive survivors at the roll step |
| zones | every `CardId` is in exactly one zone (deck, hand, equipped, waste, crisis, objective, removed); every alive survivor has an owner and a location |
| effects | a refreshed same-named effect never shortens its expiry (Blizzard twice, lesson J) |
| numbers from state | an open `attack`/`search`/`bite`/`vote` context matches the decision that opened it |
| end | the game ends on morale 0 or `roundsLeft` 0 with no objective check, or on the objective at colony step 5 (R p14) |

## 4. Headless sim (`npm run sim`)

`tsx tools/sim.ts --games 200 --seed s [--seats 4] [--tiers random:random:random:random] [--objective samples]
[--cap 3000] [--stall 150] [--wall 60000] [--json]`

- Random deciders by default (`createRandomDecider`), AI tiers once M4 lands; bots roll on the shared seeded stream in turn order.
- **Decision cap** 3 000 per game → fail with the seed (`00` §15).
- **Stall detector**: 150 consecutive decisions with no change in (roundNumber, turnCount, morale, food, total zombies,
  total wounds, waste length, deck counts) → fail with the seed and the last 20 actions.
- 60 s wall cap per game. Watchdog-style forced answers do not exist in the sim; a bot that cannot answer is a failure.
- Output: JSON summary (games, finished, end reasons, objective rate, winners by seat kind, betrayer present/won, mean
  rounds, p95 `step` ms, invariant failures with seeds, leak failures with the offending id).
- A failing seed becomes a fixture test under its checklist ID.

## 5. Leak test detail (`VIEW-`)

- Needles: other seats' hands, secret and exiled objective ids, offered survivors, face-down contributions, the held
  Crossroads card (unless holder), another seat's open search draws (`hiddenIdsFor`).
- Also asserted: `crisis.result.revealed[].seat` is `null` for other seats before `ended`; untriggered `crossroads.log`
  entries have `cardId: null`; `cards` lists no instance in a hidden zone; `log` is absent.
- Runs on every seat after every step of every sim game and as `VIEW-001..` unit tests on built states.

## 6. Golden examples (`GOLD-001..006`, spec `13-golden-examples`)

From the rulebook's worked examples (E.14): attacking a zombie (R p9), attacking a survivor (R p9), searching with noise
(R p10), a crisis with a wrong-symbol card (R p12), seven zombies with an overrun at gate 3 (R p13), the three-round
starvation example (F 6.1.1). Each is a fixture `{setup, seed, forcedRolls, actions, expectedEvents, expectedState}`;
`forcedRolls` is applied through `stateForRolls` (§1) before the first rolling action. Rulebook text is never quoted
in the fixture; the setup positions are authored, not copied.

## 7. Client tests

Unit (node, M3+): director plays a batch's events in order and `idle` flips only at the end; every `RollPurpose` and
`ExposureRolled` has a tray renderer; every `DecisionKind` has a prompt builder and the §5 example strings render from a
fixture view (`UI-PROMPT-*`); every `GameEventType` has a feed line; `redactEvent` output never reaches the feed
unredacted; `seats.ts` gives 2–5 seats distinct positions with the human at the near edge; `ENABLED_GLB_SLUGS` ⊆ files;
settings survive a throwing `localStorage`; the watchdog fires at 5 s on a bot decision and never on the human's.

Playwright (`playwright.config.ts`): builds, then `vite preview --port 4173` at `http://localhost:4173/dead-of-winner/`;
`PW_PORT=4183` moves it. Every `page.goto` is relative (`./?test=1&seats=…`). Drive through `window.__game` and
`data-testid`; assert through the DOM proxies (`figure-<id>` `data-location`, `zombies-<loc>-<n>`, `seat-<id>`).

| Spec | Covers |
|---|---|
| `home` | title loads, setup validates, Start reaches `chooseSurvivors` |
| `play-slice` | 4 random bots at speed instant to `gameOver`, recap shows every seat's objective |
| `human-turn` | pick survivors, a search prompt shows the die need and odds, keep-or-noise, the tray shows the roll, exposure routes to the tray, end turn |
| `crisis-vote` | contribute two cards, call a vote, lean bubbles, thumbs, result |
| `gallery` | `?gallery` screenshot with GLB and fallback side by side |
| `save-load` | save mid-game, reload, same pending |

Screenshots for owner check-ins go to `tests/e2e/__shots__/` (review only, not baselines).

## 8. `bench:ai` (M4)

`tsx tools/ai-bench.ts --games 50 --seed 1 --seats bot,bot,bot,bot --objective samples [--tiers normal] [--json]`
reports objective completion rate, betrayer win rate when present, mean rounds, exile accuracy (exiled seats that were
betrayers), mean and p95 decision time. Per-decision time budgets read `DOW_AI_BUDGET_MS` (default 500; CI sets 1500).

## 9. CI notes

- `.github/workflows/deploy.yml` on push to `main`: `npm ci`, typecheck, `npm test`, build, upload `dist`, deploy
  Pages. Node 22. A failing unit test blocks the deploy.
- The sim, `bench:ai` and Playwright are **not** in the deploy job (runner time); a `verify.yml` (M3) runs `validate:data`,
  `sim --games 20` and the e2e core specs on pull requests and nightly, with `DOW_AI_BUDGET_MS=1500`.
- Never two `npm install`s at once; never background `npm test` (lesson J). Agents in a shared tree stage by exact path.
- `vitest` timeout 30 s (CI runners run about 2× slower). Heavy engine tests mark themselves `slow` and run in CI only.

## 10. Definition of done per milestone

| Milestone | Done when |
|---|---|
| M0 | specs 00–60 + schemas written and reviewed once; frozen contract files compile; `validate:data` runs on the empty bundle; checklist IDs exist; skeleton on Pages |
| M1 | engine tests for every prefix with ≥1 `must` per group; `GOLD-001..006` pass; `npm run sim --games 50` green with the leak test, cap and stall detector live |
| M2 | all `must` IDs covered for the first slice; `validate:data` green with a source row per value; verify agent finds no copied prose; 200-game random sim: 0 failures |
| M3 | Pages build playable end to end vs random bots; §7 e2e core specs green; prompts with odds, hand, tray, feed, seat rail, objective panel, recap exercised; owner gates (layout, figure look, first persona lines) answered |
| M4 | `bench:ai` targets met; `AI-` unit tests; p95 ≤ 500 ms; owner's three games |
| M5 | all 30 survivor slugs enabled with files present; zombies, board, tiles, icons, card faces and title art in gallery screenshots |
| M6 | a sound per `RollPurpose`, per location search and per symbol reveal in `eventSounds.ts`; `sounds.html` audition; loudness measured |
| M7 | feed breakdowns, settings, Low graphics, recap story; perf budgets met with 30 survivors and 60 zombies on `?fps` |
| M8 | per batch: verify loop on card mechanics and prose, data validates, sim with the batch green, e2e screenshot |

Every stage: `npm run typecheck && npm test && npm run validate:data` green, commit, push, Pages deploy green.
