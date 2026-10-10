# 00. Architecture and frozen engine contracts

The layers, the eight frozen engine files and what each exports, the state shape, the single
`PendingDecision`, hidden information, events, hooks, the seeded RNG and the engine-owned numbers.
The TypeScript in `src/engine/{types,actions,events,hooks,rng,decider,view,index}.ts` is the
machine form of this spec; where they disagree, fix both in the same commit.

**Source keys.** `C.n`, `J` = brief sections (`docs/DEAD-OF-WINTER-HANDOFF.md`); `10.x`, `11 §x`,
`20.x`, `21.x`, `40.x`, `50.x`, `60.x` = clauses of those specs; `CL` = `CLAUDE.md`. No web sources
were needed for this spec.

**Status.** FROZEN 2026-10-10 (M0), except the DSL types in `types.ts`, which mirror spec 21 and
stay DRAFT until the M2 dry run (21.12). A change to a frozen file needs a matching edit here and a
note in the changing agent's `issues` (CL). Amended 2026-10-10 by the M0 spec-review fixes (prevent
sets, card votes, seed hiding, hook rng, hidden-objective sources, survivor offers, `mustPlay`,
non-empty fallbacks, annotations, colony-phase event, event bindings, save talk, attract sources).

---

## 00.1 Layers (C.2)

| Layer | Path | Rules |
|---|---|---|
| Engine | `src/engine/` | Pure TS. No DOM, no Node APIs, no `Math.random`, no `Date.now`, no data imports, no globals (env is passed in). Deterministic from `(bundle, config, actions)`. |
| Data | `src/data/` | JSON records (spec 20) + `index.ts` `loadBundle(): DataBundle`. Never imported by the engine; passed to `createEngine`. |
| AI | `src/ai/` | Per-seat `Decider`s (spec 40). Imports only `src/engine/index.ts` exports; never holds a `GameState` (40.1.2). |
| Client | `src/client/` | React 19 + R3F + zustand. `store/` is the only caller of `step` (50.1.1). Renders views only. |
| Tools | `tools/` | `sim.ts`, `ai-bench.ts`, `validate-data.ts`, workflows. Node; same engine API. |

- 00.1.1 Dependency direction: client → ai → engine ← data (loaded by client/sim/tests). Engine
  depends on nothing in the repo.
- 00.1.2 Engine internals (not frozen; C.2): `dice.ts decks.ts exposure.ts actions/*.ts
  crossroads.ts crisis.ts colony-phase.ts zombies.ts survivors.ts exile.ts objectives.ts effects.ts
  code-hooks.ts phases/*.ts odds.ts`. They may change freely as long as the frozen signatures hold.
- 00.1.3 Generic N-seat: 2–5 seats (C.4); nothing in engine, AI or client hard-codes a seat count,
  order or the human's index. The client puts the human at the near edge (C.5, C.6).

## 00.2 Engine API (`index.ts`)

- 00.2.1 `createEngine(bundle, options?) → Engine`. The engine indexes the bundle once (20.12.2);
  `GameState` stores only ids plus `bundleHash`.
- 00.2.2 `Engine` methods:

| Method | Contract |
|---|---|
| `newGame(config) → StepOk` | Seeded setup (10.3) up to the first decision. |
| `step(state, action) → StepOk \| Rejection` | Applies one answer to the open decision. Pure: input state untouched. Illegal input returns `{ok:false, code, message}`, never throws (C.3). |
| `pending(state)` | The open `PendingDecision`, or `null` iff the game ended. |
| `legalActions(state, seat) → Answer[]` | 00.4.2. |
| `view(state, seat) → PlayerView` | 00.6. |
| `eventsFor(events, seat) → SeatEvent[]` | 00.7.2. |
| `preview(view, answer) → ActionPreview` | Helper only: an annotation from the view alone. The authoritative per-answer numbers are `ViewDecision.annotations`, computed from state (00.8.3). |
| `replay({config, actions})`, `save(state)`, `load(save)` | Save = config + action log + `stateHash` + optional `talk` log (41.5.1); load replays and verifies the hash (SIM-008). `replay` returns the final `StepOk` (its `events` are the last step's only). |
| `replayEvents({config, actions}) → EngineEvent[]` | Every event of the replay in order, unredacted, so a resumed game can rebuild bot belief from `eventsFor` + `SaveFile.talk` (40.1.4). |

- 00.2.3 `StepOk = {ok:true, state, events, decision}`. `events` are unredacted (store/sim only).
- 00.2.4 Rejection codes: `GAME_OVER`, `NO_DECISION`, `WRONG_KIND` (answer type not allowed for the
  decision kind), `NOT_LEGAL` (not deep-equal to a legal answer), `BAD_BALLOTS`, `MALFORMED`.
- 00.2.5 `stateHash(state)` = hash of canonical JSON (sorted keys). `ENGINE_VERSION` is recorded
  in saves.
- 00.2.6 `index.ts` re-exports every frozen module and `odds.ts`. Nothing outside `src/engine/`
  imports an engine internal (60.3.1; 40.1.2).

## 00.3 State (`types.ts`)

- 00.3.1 Ids: `SeatId` = `s0..s{n-1}` in clockwise turn order. Content ids per 20.3. Instances
  `<recordId>@<n>` (cards and survivors), `n` from `state.seq.instance`. Dice: `Die{id, value,
  used}`, ids from `state.seq.die`.
- 00.3.2 `GameConfig = {seed, seats: SeatConfig[], mainObjective, variants?, overrides?, script?}`.
  `overrides` (secret objectives, groups, hands, deck tops, morale, rounds, food, first player,
  `skipSetupDecisions`) serve golden fixtures (13 §0; 60.3.2). `script` swaps in a scripted RNG
  (00.9.3).
- 00.3.3 `GameState` is plain JSON (no Map, Set, class, function). Fields: `schema`, `bundleHash`,
  `config`, `rng`, `seq`, `phase` (`setup|playerTurns|colony|ended`), `colonyStep`, `round`,
  `roundsLeft`, `morale`, `moraleMax`, `food`, `starvation`, `seats[]` (with `dice`), `firstPlayer`,
  `activeSeat`, `turnsTaken`, `turn` (moved survivors, vote called, Crossroads resolved,
  `lastAction`, `mustPlay`), `survivors{}`, `cards{}` (instance → record), `zones` (item decks,
  hands, waste, outOfGame, limbo), `survivorDeck`, `survivorOffers{}`, `crisisDeck`, `crisis`
  (`prevent: PreventSymbol[]`, 1–2 symbols, 10.4.14), `crisisHistory`, `locations{}`
  (entrances `{n, spaces, zombies, barricades}`, noise, helpless), `crossroads` (deck, held, draws),
  `objectives` (main + progress, secret, exiled, exiledDeck, boxed, seatProgress), `lasting[]`
  (21.8.4; each with `hiddenOwner`, 00.6.8), `limits{}` (21.3.3), `stack[]`, `pending`, `log[]`,
  `votes[]` (`VoteRecord`, 00.4.7), `ended`. Colony and location records carry no `mech` field
  (location.schema.json); every other record does.
- 00.3.4 Zones are ordered arrays, index 0 = top. Each card instance is in exactly one zone, an
  equipped list or a crisis contribution (SIM-005).
- 00.3.5 `stack: WorkFrame[]` is the engine's continuation: an effect that needs a decision pushes
  frames and returns with `pending` set; the answering `step` resumes from the stack. This is how
  "nothing interrupts a resolving effect" (10.0.3) and mid-effect decisions coexist.
- 00.3.6 `log[]` holds every accepted answer `{decisionId, seat, action}`; replaying `config` +
  log reproduces `stateHash` (SIM-008). The log contains hidden ids and never enters a view.
- 00.3.7 Survivor offers: dealt-but-unkept survivor cards (setup deal 10.3.7, `addSurvivor`
  `drawChoose`) are record ids in `survivorOffers[seat]`, never `SurvivorState`s, so they hold no
  location and never count for capacity or food. `chooseSurvivors` context `offered` and answer
  `keep` are `ContentId[]`; instances are created only for kept cards, and the rest go back to
  `survivorDeck`. Offers reach only their seat, through its decision context (VIEW-010, VIEW-014).
- 00.3.8 `turn.mustPlay`: a card received through a request must be used at once (10.6.5). While it
  is set, the turnAction legal list is `playCard` of that card plus `ability` actions whose cost
  discards it; if none exists, the engine discards it to the waste and clears the field. Cleared
  when the card leaves the hand.

## 00.4 The single PendingDecision (C.4; 10.0.7)

- 00.4.1 While `phase ≠ ended` exactly one `PendingDecision{id, kind, seat, answerers, context}`
  is open; after `GameEnded` none (SIM-001). `seat` is a `SeatId` or `'all'`; `answerers` lists
  the seats that must answer (`[seat]`, or every voter for `'all'`).
- 00.4.2 `legalActions(state, seat)` is **never empty** when `seat` is an answerer, and `[]`
  otherwise. Feasibility = some concrete candidate passes full validation, never "the planner's
  preferred arrangement" (J). A `turnAction` always includes `endTurn` (10.6.8). The sim asserts
  this every step (SIM-002). Two cases that could otherwise empty the list:
  1. a triggered Crossroads card whose options are all unavailable does not trigger: it stays held
     and goes to the bottom of its deck at end of turn (10.4.6; Ruling A-XRDNONE);
  2. exile placement where every non-colony location is full of exiled survivors only (none to
     displace): the context sets `overCapacity: true` and `place` puts the survivor over capacity,
     as forced placement does (10.9.7; Ruling A-EXILEFULL).
- 00.4.3 Decision kinds (frozen, `DECISION_KINDS`) and their answers (`ANSWERS_BY_KIND`):

| Kind | Answer type(s) | Raised by |
|---|---|---|
| `chooseSurvivors` | `chooseSurvivors{keep: ContentId[]}` | 10.3.7; 00.3.7 |
| `chooseLeader` | `chooseLeader{survivor}` | 10.3.7 |
| `turnAction` | `attackZombie`, `attackSurvivor`, `search`, `barricade`, `cleanWaste`, `attract`, `ability`, `playCard`, `contribute`, `move`, `spendFood`, `request`, `handOff`, `callVote`, `endTurn` | 10.4.5 |
| `searchKeepOrNoise` | `searchMore`, `searchStop` | 10.5.3 |
| `searchKeepWhich` | `searchKeep{cards}` | 10.5.3; 21.8.1 `searchExtra` |
| `crisisContribution` | `contribute`, `skip` | reserved: card effects asking for an out-of-turn contribution (Ruling A-CRISISKIND) |
| `requestResponse` | `give{card}`, `decline` | 10.6.5 |
| `crossroadsOption` | `crossroadsChoice{option}` | 10.10.4 |
| `biteSpread` | `biteSpread{kill\|roll}` | 10.7.5 |
| `newLeader` | `newLeader{survivor}` | 10.9.5 |
| `exilePlacement` | `place{location, displace?}` | 10.11.3, 10.11.6, 10.9.2 |
| `vote` (seat `'all'`) | per seat `Ballot{vote: option id}`; engine takes one `castVotes{votes}` | 10.12.3, 10.12.7; DSL `vote` (21.7) |
| `voteTiebreak` | `tiebreak{vote: option id}` | 10.12.5 |
| `orderEffects` | `orderEffects{first}` | 10.0.2 |
| `objectiveChoice` | `chooseOption{option}` | DSL `choice`, exiled food-card mode (Ruling A-OBJCHOICE) |
| `itemTarget` | `chooseTargets{targets}`, `skip` | DSL `choose`/selectors with `chooser`, `optional` (21.4.3; 21.3.6) |

  Encodings mirrored from 21: a confirm ("may") is `itemTarget{purpose:'confirm', candidates:['yes'], min:1, max:1, canSkip:true}`, answered `chooseTargets['yes']` or `skip`. Peek ordering uses `itemTarget{purpose:'peekOrder'}` picks from the top down (n-1 picks), and a top/bottom peek choice is an `objectiveChoice` with options top/bottom (bottom keeps current order). The trigger dispatcher applies the 21.5 filters: `ColonyStepStarted` only for step `payFood`, and `SurvivorKilled` only where the survivor is non-null.

- 00.4.4 Simultaneous decisions: the client/sim asks each answerer's decider with its own view; each
  returns a `Ballot{seat, vote}`; `collectBallots(answerers, ballots)` builds the one `castVotes`
  passed to `step`. A `Ballot` is never a `step` input. No view shows another seat's ballot before
  `VotesCast` (VIEW-011; 40.1.7).
- 00.4.5 Actions name concrete things: survivor/card instance ids, `Die.id`, location ids, colony
  entrance numbers. `legalActions` lists one action per **distinct die value** (lowest die id of that
  value) so lists stay small (Ruling A-DIEREF). Contributions and hand-offs are one card per action.
- 00.4.6 A decider must return an element of its legal list (deep equality, `sameAnswer`);
  otherwise the host falls back to `fallbackAnswer` (endTurn, else first legal) and logs it (40.1.3).
- 00.4.7 Votes. `vote` context = `{purpose: 'exile'|'card', caller: SeatId|null, target:
  SeatId|null, sourceKey: string|null, options: {id, label?}[], voters}`; `voteTiebreak` context
  adds `tied: string[]` in place of `voters`. Ballots, `castVotes` values and `tiebreak.vote` are
  option ids (`BallotChoice = string`). An exile vote has options `yes`/`no`, caller and target
  set, `sourceKey` null. A card vote (a Crossroads or other card's `vote` op) has the card's
  options, `sourceKey` `<recordId>#<op>`, and caller/target only if the card names them; it is not
  the once-per-turn exile vote (10.12.7). `VoteCalled`/`VotesCast` and `GameState.votes`
  (`VoteRecord{round, purpose, caller, target, sourceKey, sourceCard, ballots, tiebreak, result,
  exiled}`) carry the same fields.

## 00.5 Actions (`actions.ts`)

- 00.5.1 `Action` = the discriminated union of 00.4.3 answer types; turn action `type`s equal
  `ActionKind` in `types.ts` and `effect.schema.json` (one name per action across spec, schema,
  engine and DSL `action:` conditions).
- 00.5.2 Exports: action interfaces, `TurnAction`, `Action`, `ActionType`, `Ballot`, `Answer`,
  `ANSWERS_BY_KIND`, `REJECT_CODES`, `RejectCode`, `Rejection`, `isTurnAction`, `canonicalJson`,
  `sameAnswer`, `collectBallots`.
- 00.5.3 `attract{sources, entrances?, sourceEntrances?}`: `entrances` = the colony entrance each
  zombie lands on when the colony is the target; `sourceEntrances` = the colony entrance each
  zombie leaves, one per `'colony'` entry in `sources`, required when a source is the colony.
  `legalActions` lists each distinct entrance choice (later overruns depend on it).

## 00.6 Views and hidden information (`view.ts`; C.4; 10.0.6)

- 00.6.1 `view(state, seatId) → PlayerView` is the only thing deciders see (VIEW-001). It is plain
  JSON, deterministic (VIEW-017), and built fresh per call.
- 00.6.2 Hidden from a seat (shown as counts or absent):
  1. other seats' hands → `handCount` (VIEW-002);
  2. other seats' secret / exiled objectives and every `isBetrayal` flag → absent until
     `GameEnded` (VIEW-003, -012, -013; Ruling A-BETRAYALVIEW);
  3. face-down crisis contributions → which cards stay hidden; the per-seat count
     (`SeatPublic.contributed`) and total are public, because the cards go down face down at the
     table (10.4.13). At resolution each card's symbol and ±1 are public (`CrisisCardRevealed`),
     never its seat or card id (VIEW-004, -005);
  4. the held Crossroads card → only `crossroadsHolder`; the card id is in `you.heldCrossroads`
     for the holder only, public once triggered (VIEW-006);
  5. all deck orders and contents → counts (VIEW-007); boxed objectives and returned setup survivors
     → nothing (VIEW-014);
  6. search draws and returned cards → searching seat only (VIEW-008); a stolen card → thief and
     victim only (VIEW-009);
  7. setup picks → hidden until every seat has chosen (VIEW-010);
  8. the open decision's `context` and `legal` → answerers only.
- 00.6.3 Public: board (zombies per entrance, barricades, noise, helpless), survivors with wounds
  and equipped cards, dice of every seat (Ruling A-DICE), morale, food, starvation, waste count and
  top card, round, current crisis and its prevent symbols, main objective progress, lasting effects,
  exiled/eliminated flags, a card given through a request (VIEW-015).
- 00.6.4 `PlayerView` fields: `seat, bundleHash, phase, colonyStep, round, roundsLeft, morale,
  moraleMax, food, starvation, firstPlayer, activeSeat, seats[] (SeatPublic), survivors[],
  locations[], deckCounts, waste, crisis, lastCrisis, main, lasting[], numbers, you{hand,
  secretObjective, exiledObjective, objectiveStatus[], heldCrossroads, searchDrawn},
  crossroadsHolder, decision (ViewDecision), ended, recap`. `you.objectiveStatus` =
  `{clause, label, current, target, met}[]` for the seat's own secret (or exiled) objective,
  computed by the engine (50.6).
- 00.6.5 `ViewDecision = {id, kind, seat, answerers, yours, context?, legal?, annotations?}`;
  `context`, `legal` and `annotations` exist iff `yours`. `annotations[i]` is the engine's
  `ActionPreview` for `legal[i]`, computed from state. Non-answerers see who is deciding and the
  kind only (50.5.1).
- 00.6.6 After `GameEnded`, `recap` reveals every objective, every contribution by seat and crisis,
  every Crossroads draw and whether it triggered, and every vote (10.13.3); `eventsFor` stops
  redacting.
- 00.6.8 Hidden objective sources. Effects sourced from a secret, betrayal or exiled objective
  (`BetrayalObjectiveRecord.hooks`, seat progress) must not reveal their owner: the
  `LastingEffect.hiddenOwner` is set and views show other seats `sourceKey: 'hidden'`
  (`HIDDEN_SOURCE_KEY`, `lastingForSeat`); `LastingAdded` redacts `sourceKey` except for the owner;
  seat-scoped `ObjectiveProgress` is `vis {to: [owner]}`; such hooks are never `optional` (no
  public decision for the owner); when one must open a decision for another seat, its context
  shows `sourceKey: 'hidden'` and `DecisionOpened` shows only the kind (VIEW-019; Ruling A-HIDDENSRC).
- 00.6.7 Leak test: the sim serializes every seat's view and its delivered events after every step
  and asserts no hidden id appears (SIM-007; VIEW-018).

## 00.7 Events (`events.ts`)

- 00.7.1 `step` returns the ordered `EngineEvent[]` describing every change: board, cards, dice,
  morale/food/waste, wounds/deaths, Crossroads, crisis, requests, votes, objectives, turn and colony
  steps, `DecisionOpened`, `GameEnded{result}`. Each has `seq` (monotonic per game) and `round`.
  Events describe; the UI and bots read targets and numbers from views, not from events (C.3).
  `GameStarted` carries no seed (00.9.5). `ColonyPhaseStarted` fires once per round before the
  first `ColonyStepStarted`. `CrisisCardRevealed{index, symbol, delta}` fires once per contributed
  card, public, in shuffled order, before `CrisisResolved`.
- 00.7.2 Visibility: absent = public; `{to: seats}` = only those seats receive it; `{redact: fields,
  except: seats}` = others receive it with those fields deleted (redactable fields are optional in
  the types). `eventForSeat` / `eventsForSeat` in `view.ts` implement it; after `GameEnded` all
  events are whole.
- 00.7.3 Dice rolls are events (`DiceRolled`, `DieRolled{purpose}`, `ExposureRolled{d12, rolled,
  face}`) so every roll type reaches the dice tray (J; 50.5.7).
- 00.7.4 `DSL_EVENT_MAP` maps each DSL `on:` name (21.5) to one engine event type; `events.ts` is
  authoritative (Ruling DSL-EVENTS in 21; Ruling A-DSLEVENTS here). `DSL_EVENT_BINDINGS` names the
  event field that fills each context slot; when `eventSurvivor` is bound and `eventSeat` /
  `eventLocation` are not, the engine fills them from that survivor's state at trigger time:

| DSL event | eventSurvivor | eventLocation | eventSeat | face / reason / cause |
|---|---|---|---|---|
| turnStarted, turnEnded, cardPlayed, seatExiled | – | – | `seat` | – |
| roundStarted, crisisRevealed, colonyPhaseStarted | – | – | – | – |
| actionResolved | `actor` | `location` | `seat` | – |
| survivorMoved | `survivor` | `to` | – | – |
| zombieKilled | `by` | `location` | – | – |
| survivorWounded | `survivor` | – | – | face ← `kind` |
| exposureRolled | `survivor` | `location` | – | face ← `face`, reason ← `reason` |
| survivorKilled | `survivor` | `location` | `seat` | cause ← `cause` |
| survivorAdded, searchResolved | `survivor` | `location` | `seat` | – |
| crisisResolved | – | – | – | cause ← `outcome` |
| voteResolved | – | – | `target` | cause ← `result` |

## 00.8 Hooks and engine-owned numbers (`hooks.ts`, `odds.ts`)

- 00.8.1 `CodeHook = EffectHook | ConditionHook | NumHook | ModifierHook` (21.10.2). Every hook gets
  `HookInput{state (read-only), bundle, ctx: EvalContext}` with no rng, because condition, num and
  modifier hooks and `EffectHook.feasible` run inside `legalActions`, `view` and annotations, which
  must neither advance nor depend on the rng. Only `EffectHook.run(input: EffectHookInput, api)`
  gets `rng`, drawing from the game rng inside `step` (Ruling A-HOOKRNG). Effect hooks change the game only
  through `EffectApi` (`run(effect)`, `killSurvivor`, `addZombies`, `rollExposure`, `bind`), which
  queues work on the stack, so a hook can lead to decisions and never bypasses the generic routines
  (10.0.5). `ModifierHook.run(input, ModifierQuery)` answers the fixed query points of 21.8.1.
- 00.8.2 The registry `codeHooks: CodeHookRegistry` lives in `src/engine/code-hooks.ts` (not frozen);
  `defineHooks` type-checks it; names match `HOOK_NAME_PATTERN` (DATA-003).
- 00.8.3 The engine owns every number the UI shows (10.0.8; C.3). `PlayerView.numbers`: `players,
  colonySurvivors, foodNeeded, wasteCount, wasteMoraleStep, wasteMoraleLoss, crisisPrevent,
  crisisBonus, zombiesIncoming{loc: {fromSurvivors, noiseTokens}}, mainTarget`. Per-answer numbers
  (die minimum after modifiers, exposure odds after skip/replace modifiers, attack-on-survivor hit
  odds) come from `ViewDecision.annotations`, computed from `GameState` so code-hook modifiers
  count; `preview(view, answer)` is a view-only helper.
- 00.8.4 `odds.ts` pure helpers (re-exported; signatures frozen): `exposureOdds(reason, mods)`,
  `dieAtLeastOdds(min)`, `attackSurvivorHitOdds(targetAttack)`, `foodNeeded(n, delta)`,
  `wasteMoraleLoss(waste, step)`, `crisisThresholds(players)`, `crisisOutcome(total, players)`,
  `colonyZombiesIncoming(n)`, `noiseExpectedZombies(tokens)`. The AI's `odds.ts` builds on these.

## 00.9 Seeded RNG (`rng.ts`)

- 00.9.1 `Rng{float, int(n), d6, d12, shuffle, pick, state}`. sfc32 seeded by cyrb128 of
  `seedKey(seed)` (`n:<num>` / `s:<str>`), 15 warm-up draws, unbiased `int` by rejection. State is 4
  uint32 words in `GameState.rng`; `rngFromState` resumes exactly.
- 00.9.2 All engine randomness goes through the game rng: dice, exposure, shuffles, random picks,
  survivor-attack steal (21.1.6). No `Math.random` in `src/engine` or `src/ai` (SIM-010).
- 00.9.3 Scripted rng (`scriptedRng`, `GameConfig.script`): queues `d6`, `d12` (faces or 1–12),
  `pick` (indices for `int`); a dry queue throws `ScriptExhausted` unless a fallback seed is given.
  The queues live in `GameState.rng`, so `scriptRemaining(state.rng)` lets golden tests assert every
  value was used (13 §0.3).
- 00.9.4 d12 → face: 1–6 blank, 7–9 wound, 10–11 frostbite, 12 bitten (`D12_FACES`; 10.7.1).
- 00.9.5 Sub-streams: `deriveSeed(seed, label)`; bots use `ai/<seatId>` and `ai/talk/<seatId>` and
  never draw from the game rng (40.1.8). `hashString` gives stable hashes (state, bundle). The game
  seed is hidden information: the engine is deterministic from it, so it would reveal deck orders
  and the secret deal. No event or view carries it (`GameStarted` has no seed); drivers pass a bot
  only `deriveSeed(seed, 'ai/<seat>')`, never the seed itself (VIEW-020; Ruling A-SEEDHIDDEN).

## 00.10 Deciders and the AI time budget (`decider.ts`)

- 00.10.1 `Decider{seat, kind, decide(view, decision, ctx), observe?}`. `decide` may return a
  promise (client worker). `ctx = {events (redacted, since last call), talk (since last call),
  budgetMs}`. The same interface serves the human UI and bots (C.3).
- 00.10.2 Per-decision AI budget env var from day one (CL): `DOW_AI_BUDGET_MS` (Node),
  `VITE_DOW_AI_BUDGET_MS` (client), default 250, `0` = no wall-clock cap. `resolveAiBudgetMs(env,
  override?)` is pure; callers pass `process.env` or `import.meta.env`. Sim, bench and tests use 0
  (40.12.3); node caps are the deterministic budget (40.12.1).
- 00.10.3 Drivers (store and sim) loop: `d = pending(state)`; for each answerer call its decider
  with `view(state, seat)` and that seat's `ViewDecision`; for `'all'` collect ballots; `step`.
  Sim caps: `SIM_MAX_DECISIONS`, stall detector (60.4.4–60.4.5; J).

## 00.11 Test IDs (contract tests, `tests/engine/contracts.test.ts`)

ARCH-001 rng determinism and snapshot resume. ARCH-002 rng distribution (d6, d12 faces, shuffle).
ARCH-003 scripted rng queues and leftovers. ARCH-004 frozen exports present; `ACTION_KINDS` and
`DSL_EVENT_NAMES` equal the schema enums; `ANSWERS_BY_KIND` covers `DECISION_KINDS`. ARCH-005 event
redaction, ballots (yes/no and option ids), AI budget resolution, exposure odds. VIEW-019 hidden
objective sources (`lastingForSeat`, `LastingAdded` redaction, owner-only progress). VIEW-020 no
seed in `GameStarted` (type-level now; the sim leak scan joins in M1).

---

## Rulings

RULING: A-DICE dice visibility | Every seat's dice values are public in views | Unsourced: dice are rolled openly at the table and C.4's hidden list omits them; 50.6.1 is aligned with this ruling (closed)
RULING: A-DIEREF die references | Actions name a Die.id; legalActions lists one action per distinct die value (lowest id) | Unsourced (project decision): identical values are interchangeable; keeps legal lists small for bots
RULING: A-CONTRIB contributing several cards | One card per `contribute` action, repeatable within the turn | Unsourced: 10.6.2 "any number" is preserved by repetition; avoids exponential subset enumeration
RULING: A-CRISISKIND crisisContribution decision | Kept in the frozen kind list but reserved for card effects that ask for an out-of-turn contribution; in-turn contribution is the `contribute` turn action | Unsourced: C.4 lists the kind; 10.15 places it inside turnAction
RULING: A-OBJCHOICE generic option choice | `objectiveChoice` doubles as the decision for any non-Crossroads `choice` op, including an exiled seat's food-card mode (R-EXILEFOOD) | Unsourced: keeps the C.4 kind list unchanged
RULING: A-BALLOT simultaneous votes | Deciders answer `vote` with a per-seat Ballot; only `castVotes` (all ballots) enters `step` | Confirmed against C.4 ("submits one castVotes action")
RULING: A-BETRAYALVIEW exiled betrayer status | Views never expose another seat's `isBetrayal`, even after exile; the engine applies the two-exile rule (10.11.5) itself | Fan-source (follows 11 §5.4 and checklist K-2; conflicts with 10.11.2 "becomes public", flagged for the spec review)
RULING: A-DSLEVENTS abstract DSL events | colonyPhaseStarted → ColonyPhaseStarted (once per round; was ColonyStepStarted, which fires 7×); searchResolved → SearchKept; voteResolved → VotesCast; ctx bindings per 00.7.4 (survivorWounded face ← kind) | Unsourced: names only, no rules effect
RULING: A-VOTEOPTS vote options | Ballots are option ids; exile votes use yes/no; card votes use the card's options with purpose 'card' and nullable caller/target | Unsourced for the encoding; procedure per 10.12.7 (R-CARDVOTE)
RULING: A-SEEDHIDDEN game seed | Never in an event or view; bots get only deriveSeed(seed,'ai/<seat>') | Unsourced (project decision): the seed reproduces every hidden deck order
RULING: A-HOOKRNG hook rng | Only EffectHook.run receives rng; condition/num/modifier hooks and feasible get none | Unsourced (project decision): legalActions, view and annotations must not touch the rng
RULING: A-HIDDENSRC hidden objective sources | Effects from secret/betrayal/exiled objectives mask sourceKey as 'hidden' for others, owner-only progress, never optional | Unsourced: in the physical game a betrayer's hooks act without announcing the card
RULING: A-OFFERS survivor offers | Dealt-but-unkept survivors are record ids in survivorOffers, not instances | Unsourced (project decision): unkept cards are not on the board
RULING: A-MUSTPLAY requested card | turn.mustPlay restricts legal turn actions to using the received card; no use → discard to waste | Follows 10.6.5 (R-REQUEST); fallback is Unsourced
RULING: A-XRDNONE Crossroads with no available option | Does not trigger; stays held; bottom of deck at end of turn | Unsourced: a card whose every option is impossible has nothing to resolve
RULING: A-EXILEFULL exile placement with nothing to displace | Place over capacity, as forced placement (10.9.7) | Unsourced: keeps legalActions non-empty
RULING: A-ATTRACTSRC attract from the colony | sourceEntrances names the colony entrance each pulled zombie leaves | Unsourced: the rules let the player choose; the choice must be explicit for replays
RULING: A-SEARCHKEEP search keep answer | `searchKeep` carries a card list so `searchExtra.keep` can keep more than 1 | Unsourced: mirrors 21.8.1
RULING: A-D12MAP d12 numbering | 1–6 blank, 7–9 wound, 10–11 frostbite, 12 bitten | Fan-source (face counts per R-D12; the numbering is ours and only affects scripted tests)
