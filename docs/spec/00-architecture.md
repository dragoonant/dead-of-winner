# 00: Architecture

Source of truth for module boundaries, the engine API, the state shape, the decision model, the view (hidden
information) contract and determinism. Rule semantics live in `10-rules-core` (test ids in `12`), objectives in
`11`, data shapes in `20`, the card-effects vocabulary in `21`, AI in `40`, client in `50`, testing in `60`.

`src/engine/{types,actions,events,hooks,rng,decider,view,index}.ts` are the code form of §2–§13 and are
**FROZEN after M0**: changes are additive only (new optional fields, new union members, new query helpers), each
logged in §16 with the agent's `issues` line. On a conflict, `10` wins on what a rule does; this file wins on
names and shapes. Log the mismatch as a `RULING:` in `docs/needs-rules-check.md`.

## 1. Modules and import boundaries

| Module | Path | May import | Must not | Runtime |
|---|---|---|---|---|
| engine | `src/engine/` | itself; JSON *types* from `src/data/types.ts` | DOM, React, three, timers, `Math.random`, `Date` (except `save` meta), data JSON | node, browser, worker |
| data | `src/data/` | schema types only | side effects, engine internals | JSON, validated by `tools/validate-data.ts` against `docs/spec/schemas/` |
| ai | `src/ai/` | engine public API (`@/engine/index`, read-only), data types | client, three, DOM, `GameState` (bots get a `SeatView`) | node, worker |
| client | `src/client/` | engine, ai (via worker later), data, assets | mutate `GameState`; compute rules numbers | browser |
| tools | `tools/` | anything | be imported by `src/` | node (`tsx`) |
| tests | `tests/` | everything | | vitest, playwright |

- Dependency direction: `data ← engine ← ai ← client`. Alias `@/` → `src/` (no `baseUrl`).
- Enforced by an import-boundary test (`tests/engine/boundaries.test.ts`, M1) that greps imports per module.
- Engine and ai run unchanged in `npm run sim`, `npm run bench:ai` and a Web Worker.
- `src/client/store/` is the ONLY caller of `step`. Every decider, the human's prompt included, receives `view(state, seat)`.
- **Code split** (C.1): the client loads `engine+data` and `ai` as separate dynamic chunks; the title screen renders
  before either arrives. Budgets in §15.

Engine file layout (C.2): the frozen eight above, plus `dice.ts decks.ts exposure.ts actions/*.ts crossroads.ts crisis.ts
colony-phase.ts zombies.ts survivors.ts exile.ts objectives.ts effects.ts code-hooks.ts phases/{setup,player-turns,colony}.ts`,
which are internal and may change freely.

## 2. Engine API (`src/engine/index.ts`)

| Function | Returns | Notes |
|---|---|---|
| `createGame(setup: GameSetup, seed: string, bundle: DataBundle)` | `StepResult` | registers the bundle; validates seats (2–5) and the objective; bad setup → `rejection E_BAD_SETUP`, never a throw. Deals survivors, starting items and secret objectives from the seeded stream (E.3). First pending: `chooseSurvivors` for `seatOrder[0]`, then each seat in turn, then `chooseLeader` per seat; the first seat is then set by leader influence (`FirstSeatSet`). |
| `step(state, action)` | `StepResult` | pure reducer. RNG restored from `state.rng`. Illegal action → same `state` ref, `events = [ActionRejected]`, same `pending`, `rejection`. |
| `legalActions(state)` | `Action[]` | answers to `state.pending`. **Never empty while a decision is open** (§5). Feasibility = "some candidate passes full validation". |
| `validate(state, action)` | `Rejection \| null` | exactly the checks `step` runs; no mutation. |
| `replay(setup, seed, bundle, actions)` | `StepResult` | folds `step` from `createGame`; the first rejection stops the fold. |
| `save(state, label?)` / `load(file, bundle)` | `SaveFile` / `StepResult` | §12. |
| `view(state, seatId)` | `SeatView` | §4. The only thing a decider or the UI ever receives. |
| `query.*` | read-only numbers | §10. The ONLY source of numbers the UI or AI displays. |
| `describe.*` | prompt strings | decision titles and formatted odds; no arithmetic. |
| `registerBundle(bundle)` / `bundleFor(stateOrView)` | — | `step` has no bundle parameter; bundles are kept by `dataVersion`. |

```ts
interface StepResult {
  state: GameState;            // new state, or the SAME reference when rejected
  events: GameEvent[];         // ordered; [ActionRejected] only, when rejected
  pending: PendingDecision;    // exactly ONE; kind 'gameOver' once the game has ended
  rejection?: Rejection;       // present iff the action was illegal
}
interface Rejection { code: RejectionCode; message: string; detail?: Record<string, unknown> }
```

Reducer rules:
1. Immutable state; structural sharing via spreads. No I/O, clock or `Math.random`.
2. One action → 0..n events → exactly one `pending`. Forced single-option decisions are resolved inside the step and
   emit `DecisionAutoResolved {kind, seat, optionId}`; dice are never "confirmed" by a seat.
3. Every rule effect in Part E emits an event (§7). Client and AI rebuild what they show from the view plus redacted
   events, never from state diffs.
4. **Read targets from state, not events.** The in-flight attack, search, request, bite chain, vote and exile live in
   `state.attack / search / request / bite / vote / exile` while their decision is open.
5. `step` throws only `EngineInvariantError` (corrupt state = programmer error). The sim treats it as a failed game.
   `NotImplementedError` exists only until M1 wires the bodies.
6. **Crossroads triggers are evaluated by the engine** after each resolved action (`action.*` windows; FAQ 2.1.1). The
   human never has to remember a trigger.

## 3. Game state (`types.ts`, `GameState`)

| Field | Type | Notes |
|---|---|---|
| `seed`, `rng`, `rollSeq`, `decisionSeq`, `cardSeq`, `effectSeq` | string, `[u32×4]`, ints | sfc32 state (§11); ids `r:<n>` `d:<n>` `c:<n>` `e:<n>` |
| `dataVersion`, `setup` | string, `GameSetup` | replay/load refuse a mismatch (`E_DATA_VERSION`) |
| `phase`, `colonyStep` | `'setup'\|'playerTurns'\|'colony'\|'ended'`, `ColonyStep\|null` | colony steps in rulebook order (E.4) |
| `roundsLeft`, `roundNumber`, `turnCount`, `turn` | ints, `TurnContext` | `roundsLeft` is the round track (ends at 0); `turn` = active seat, actions taken, vote called, contribution asked |
| `seatOrder`, `firstSeat`, `activeSeat` | `SeatId[]`, `SeatId`, `SeatId\|null` | clockwise; the first-player token moves to the right each round |
| `seats` | `Record<SeatId, SeatState>` | §3.1 |
| `survivors` | `Record<SurvivorId, SurvivorState>` | every survivor that entered play, dead ones included (`status`); survivors still in `survivorDeck` or in a seat's `offered` list are NOT here |
| `survivorDeck`, `crisisDeck`, `exiledObjectiveDeck` | `Id[]` | top first; orders hidden (§4) |
| `locations`, `locationOrder` | `Record<LocationId, LocationState>`, `LocationId[]` | `'colony'` first, then the six in zombie-step order; each holds `entrances[] {zombies, barricades}`, `noise`, `deck: CardId[]`, `helpless`, `capacity` (copied from data at setup) |
| `cards` | `Record<CardId, CardInstance {id, defId}>` | card instances; the zone is derived from the holder (deck, hand, equipped, waste, crisis, objective, removed) |
| `waste`, `removed` | `CardId[]` | waste pile (top first); cards out of the game face up (revealed crisis contributions, cleaned waste, exiled plays) |
| `removedHidden` | `CardId[]` | cards out of the game UNREVEALED: Old Divisions contributions (F 2.3.1), a last survivor's discarded hand (R p14); count-only in views until the recap |
| `cardUses` | `Record<CardId, Record<abilityId, n>>` | once-per-round uses of an equipped item, keyed by card INSTANCE so the use travels with a hand-off (R7.6, CARD-005); survivor abilities stay in `SeatState.abilityUses` |
| `morale`, `food`, `starvation` | ints | the colony tracks |
| `crisis` | `CrisisState {cardId, contributions[], result, history[]}` | contributions are face down `{seat, cardId}`; `result` holds this round's reveal; `history[] {roundNumber, cardId, result}` is appended at `CrisisResolved` and feeds `recap.contributions` |
| `crossroads` | `CrossroadsState {deck, held, active, log}` | `held` = the card the seat to the right drew for the active seat |
| `objective` | `ObjectiveState {id, side, counters, cards, complete}` | main objective progress (spec 11) |
| `effects` | `EffectInstance[]` | every lasting rule effect: Blizzard, Hunted, ability grants; same-named effect on the same targets refreshes to the **later** expiry (never overwrite, lesson J). `sourceKind 'secretObjective' \| 'exiledObjective'` effects carry `ownerSeat` and are private to it (§4) |
| `attack`, `search`, `request`, `bite`, `vote`, `exile` | contexts or `null` | the in-flight mechanism whose sub-decision is open |
| `pending` | `PendingDecision` | also returned in `StepResult` |
| `log` | `Action[]` | full action log for save/replay; never in a view |
| `result` | `GameResult\|null` | `{reason, objectiveComplete, winners}` once ended |

### 3.1 SeatState
`{ seat: Seat {id, kind: 'human'|'bot', persona?, name?, exiled, eliminated}, hand: CardId[], secretObjectiveId,
exiledObjectiveId, offered: SurvivorId[] (setup only), dice: Die[] {id, value, used, foodSpent?}, survivors: SurvivorId[],
leaderId, abilityUses: Record<"<survivorId>|<abilityId>", n> (survivor abilities only; item uses live in `GameState.cardUses`), outcome? }`.
Dice belong to the seat, not to a survivor (E.4). A survivor added mid-round gets its die at the next roll step
automatically (the roll counts survivors at that moment).

### 3.2 SurvivorState
`{ id, owner: SeatId|null, location, status: 'alive'|'dead'|'removed', wounds, frostbite, equipped: CardId[],
movedThisTurn, extraMoves }`. Wounds total = `wounds + frostbite`; 3 kills (4 with Buddy Davis' grant). Stats
(influence, attack, search, ability) come from the bundle by `id`.

## 4. Seats, hidden information and the view contract (`view.ts`)

`view(state, seatId): SeatView` is a frozen projection and the ONLY input to any decider (human prompt or bot).
Bots never see `GameState`. The leak test (B.4; `hiddenIdsFor` + `serializeView`) runs inside the sim on every game
and asserts a seat's serialized view contains none of the ids below.

| Hidden from the viewer | Shown instead |
|---|---|
| other seats' hands | `seats[s].handCount` |
| other seats' secret and exiled objectives | `hasSecretObjective`, `hasExiledObjective` |
| survivors offered to another seat at setup | nothing (`offered` is own-only) |
| every face-down crisis contribution | `crisis.contributionCount`, `contributionsBySeat`; own cards in `me.contributions` |
| who contributed each revealed crisis card | `crisis.result.revealed[].seat` is `null` until the recap (they were shuffled) |
| the Crossroads card held by the seat to the right of the active seat | `crossroads.held {holder, forSeat}`; the holder sees it in `me.crossroadsHeld` |
| untriggered Crossroads cards in the log | `log[].cardId = null` |
| cards another seat drew in the open search | `search.drawnCount`; the searcher sees `me.searchDrawn` |
| deck orders (locations, survivors, crisis, Crossroads, exiled objectives) | `deckCount` fields |
| `state.log` | nothing |
| card instances in hidden zones | `cards` lists only instances in zones the viewer may see |
| cards that left the game unrevealed (`removedHidden`) | `removedHiddenCount`; the ids appear only in `recap.removedHidden` |
| other seats' secret/exiled-objective effects (`sourceKind 'secretObjective' \| 'exiledObjective'`, `ownerSeat ≠ viewer`) | dropped from `effects`; `hiddenEffectCount` |
| the card ids and options inside ANOTHER seat's pending decision (search draws, offered survivors, a responder's matching hand cards) | `redactPending`: a stub with `id seat kind window canPass`, `redacted: true`, only the public context ids (`survivorId targetId seatId location symbol need data.code`), no `cardId/cardIds`, no `options` |

- Everything else is public: dice, survivors and wounds, equipped cards, zombies, barricades, noise, morale, food,
  starvation, waste, the crisis card, the main objective, public effects, the open vote, the bite chain, `cardUses`, and the
  pending decision in full when `pending.seat` is the viewer or `'all'`.
- `pending.seat === 'all'` (votes): the view carries the decision unchanged; the client collects each seat's answer
  privately and submits one `castVotes` (C.4). Bots never see the human's vote before casting theirs.
- **Recap.** When `phase === 'ended'`, `view.recap` reveals every secret objective, every contribution by seat and crisis,
  every Crossroads card drawn and whether it triggered, every hand, and the unrevealed removals (`recap.removedHidden`)
  (C.4). `recap.contributions` is built from `crisis.history`, one entry per resolved crisis. `hiddenIdsFor` returns `[]` then.
- **Events** are the engine's full truth and may carry hidden ids. The client feed shows a seat only
  `redactEvent(event, seatId)`: `null` means hide the event; otherwise hidden fields are blanked (`''`/`[]`). The
  private events are `SurvivorsDealt StartingItemsDealt SecretObjectiveDealt CardStolen SearchDrawn SearchKept CardDrawn
  CardContributed CardDiscarded(revealed:false) CrossroadsDrawn CrossroadsReturned SeatExiled ObjectiveProgress(seat)
  ObjectiveComplete(seat) EffectApplied(ownerSeat) EffectExpired(ownerSeat) ActionRejected(other seat)`. `CrisisCardRevealed`
  never names the contributor.

## 5. Decision model

The engine never blocks; when the rules need a choice it returns a `PendingDecision`. The next `Action` must carry
`decisionId === pending.id` and `seat === pending.seat` (or `'all'` for `castVotes`).

```ts
interface PendingDecision {
  id: DecisionId;                // "d:<n>"
  seat: SeatId | 'all';          // who answers; 'all' for votes and for gameOver (any seat may ack)
  kind: DecisionKind;
  window: WindowId;              // §9
  context: DecisionContext;      // ids + engine-computed numbers (need, odds) for the prompt
  options?: DecisionOption[];    // finite answers, each {id, label, action, cost?, odds?}
  canPass: boolean;
  redacted?: true;               // set by view.ts on another seat's decision (§4): no card ids, no options
}
```

| Kind | Who | Raised at | Answer (action types) |
|---|---|---|---|
| `chooseSurvivors` | each seat in order | setup | `chooseSurvivors {keep}`: 2 of the 4 in `me.offered` (3 in two-player) |
| `chooseLeader` | each seat | setup | `chooseLeader {survivorId}` |
| `turnAction` | active seat | every point of its turn | one of `TURN_ACTION_TYPES`: `attack search barricade cleanWaste attract useAbility playCard contributeCrisis move spendFood request handOff callVote endTurn`; re-raised after each outcome |
| `searchKeepOrNoise` | searcher | after each search draw while noise spaces remain | `keepCard {cardId}` / `makeNoise` |
| `searchKeepWhich` | searcher | last draw (no noise space left) with ≥2 drawn | `keepCard {cardId}` |
| `crisisContribution` | active seat | once, when `endTurn` is taken and the seat is not exiled | `contributeCrisis {cardIds}` (`[]` = nothing); the same action is also a turn action at any time |
| `requestResponse` | the asked seat | after `request` | `respondRequest {give: CardId \| null}` |
| `crossroadsOption` | active seat (`forSeat`) | a held card's trigger fires after an action resolves | `chooseCrossroadsOption {optionId}`; a card offers one or more options (R p12: most have two); an option failing `requires` is not offered; `forced` in the event = only one option was possible; a `vote: true` option raises `votes` |
| `biteSpreadOption` | controller of the survivor the bite reached | each bite-chain step | `biteSpread {choice: 'kill' \| 'roll'}` |
| `newLeader` | owner | leader killed with followers left | `chooseLeader {survivorId}` |
| `exilePlacement` | exiled seat | right after a successful exile vote | `placeExiled {placements}`: every colony survivor to a non-colony location (exposure follows); bumps per F 5.4.1 are automatic |
| `votes` | `'all'` | `callVote`, or a Crossroads/crisis vote | `castVotes {votes}` (one entry per eligible seat; exiled and eliminated seats excluded) |
| `objectiveChoice` | the seat the objective names | objective triggers (spec 11) | `objectiveChoice {optionId, data?}` |
| `itemTarget` | the player of the item | a played card needs targets | `itemTarget {targets, optionId?}` |
| `effectChoice` | the seat the effect names | any card effect or code hook with a finite choice (`context.data.code`) | `effectChoice {optionId, data?}` |
| `gameOver` | `'all'` (any seat may answer) | `ended` | `ack` only |

- `pass` is legal iff `canPass`. `turnAction` never sets `canPass` (`endTurn` is the way out).
- `concede {decisionId, seat}` is legal for the human seat on any decision addressed to it (or to `'all'`): the engine
  emits `GameEnded {reason:'concession', winners: []}` (R17.4: nobody wins) and raises `gameOver`.
- `legalActions` invariant: for every open decision the list is non-empty and every member passes `validate`.
  `turnAction` always contains `endTurn`; `crisisContribution` always contains `contributeCrisis {cardIds: []}`;
  `biteSpreadOption` always contains both choices; `votes` always contains an all-no ballot.
- **Simultaneous votes:** the engine computes `yes/no`, the first seat breaks ties (E.6), exiled seats cannot vote
  (E.11). The client runs the table talk before submitting (H.5).

## 6. Actions (`actions.ts`)

Every action is `{type, decisionId, seat, ...payload}`. Turn actions carry the survivor and the die they spend
(`dieId`), so the engine can check "die ≥ value" and mark it used; `spendFood {dieId, tokens}` raises an unused die
(never above 6, only when an unused die exists, F 5.3.1). `attack.target` is `{kind:'zombie', location, entrance}` or
`{kind:'survivor', survivorId}`. `attract.from[]` names where the 2 zombies come from. `useAbility {abilityId, dieId?}`
covers `(N+)` abilities and once-per-round abilities. `playCard {cardId, equipTo?}` plays from hand; targets come
through a following `itemTarget`. `contributeCrisis {cardIds}` takes hand or equipped cards. `ack` answers `gameOver`; `concede` ends the game with no
winners (§5).

## 7. Events (`events.ts`)

Every rule effect in Part E has an event, grouped: flow (`GameCreated PhaseChanged RoundStarted TurnStarted TurnEnded
RoundTicked FirstSeatPassed DecisionAutoResolved ActionRejected`), setup (`SurvivorsDealt SurvivorsChosen LeaderChosen
StartingItemsDealt SecretObjectiveDealt FirstSeatSet`), dice (`DiceRolled ActionDiceRolled DieSpent DieBoosted DieAdded`),
exposure (`ExposureRolled ExposureFaceChanged ExposureSkipped WoundTaken WoundHealed FrostbiteTicked BiteSpreadStep
BiteChoiceMade BiteChainEnded`), survivors (`SurvivorKilled SurvivorRemoved EquippedReturned SurvivorAdded HelplessAdded
HelplessKilled HandDiscarded SeatEliminated SurvivorMoved`), attacks (`AttackDeclared SurvivorAttacked CardStolen`),
zombies (`ZombiesToAdd ZombieAdded ZombieKilled ZombieMoved BarricadeAdded BarricadeDestroyed EntranceOverrun NoiseAdded
NoiseRolled NoiseCleared`), cards (`SearchStarted SearchDrawn SearchKept CardDrawn CardPlayed CardEquipped CardHandedOff
CardContributed CardGiven CardDiscarded WasteCleaned RequestMade RequestAnswered`), colony phase (`FoodPaid Starvation
FoodChanged WasteChecked MoraleChanged CrisisRevealed CrisisCardRevealed CrisisResolved CrisisEffectApplied
ObjectiveChecked`), Crossroads (`CrossroadsDrawn CrossroadsTriggered CrossroadsResolved CrossroadsReturned
CrossroadsDeckShuffled`), votes and exile (`VoteCalled VotesCast VoteResult SeatExiled ExiledPlaced SurvivorBumped`),
objectives (`ObjectiveProgress ObjectiveComplete`), effects (`EffectApplied EffectExpired AbilityUsed DeckShuffled`) and
`GameEnded`. `DeckShuffled.location` is a `LocationId` or `'survivor' | 'crisis' | 'exiledObjective'` (SETUP-010, Talia
Jones); `CardDiscarded {to:'removed', revealed:false}` routes the card to `removedHidden`.

Sequences the client animates from events (one event per step, in order):
- **Exposure:** `ExposureRolled {raw, face}` → optional `ExposureFaceChanged` (Sparky, Harman) → `WoundTaken` or
  `SurvivorKilled {cause:'bite'}` → bite chain: `BiteSpreadStep` → `biteSpreadOption` → `BiteChoiceMade` →
  (`SurvivorKilled {cause:'biteChoice'}` | `ExposureRolled {reason:'biteChain'}` …) → `BiteChainEnded`.
- **Crisis:** `CrisisCardRevealed {points, runningTotal}` per card → `CrisisResolved` → `CrisisEffectApplied` and/or
  `MoraleChanged {reason:'crisisBonus'}`; contributed cards → `CardDiscarded {to:'removed'}`.
- **Zombies:** `ZombiesToAdd {location, count}` then one `ZombieAdded` per zombie with `BarricadeDestroyed` or
  `EntranceOverrun {killed}` (+ `SurvivorKilled {cause:'overrun'}` / `HelplessKilled`) as they happen; `NoiseRolled` per token.
- **Kill-a-survivor** (one routine, E.7/E.9): `SurvivorKilled` → `MoraleChanged` (unless exiled owner) →
  `EquippedReturned` → `LeaderChosen {reason:'replacement'}` after `newLeader`, or `HandDiscarded` + `SurvivorAdded
  {source:'lastSurvivor'}` + `LeaderChosen`, or `SeatEliminated` (variant).

## 8. One generic mechanism per concept (C.3)

| Mechanism | Module (M1) | Everything that calls it |
|---|---|---|
| kill a survivor | `survivors.ts: killSurvivor` | wounds, bite, bite choice, overrun, crisis, Crossroads, items, objectives |
| add zombies one at a time with barricade and overrun handling | `zombies.ts: addZombies` | colony step, location step, noise, objective setup, cards, attract never (empty spaces only) |
| exposure roll with the bite chain | `exposure.ts: rollExposureFor` | move, zombie kill, bite chain, cards, abilities |
| effect list with refresh-to-later-expiry | `effects.ts` | Blizzard, Hunted, grants, forbids |
| declarative card effects with code escape hatches | `hooks.ts` types, `code-hooks.ts` registry | items, crises, Crossroads, objectives, survivor abilities |

The card-effects vocabulary (`hooks.ts`: `ConditionTest`, `EffectOp`, `ForbidWhat`, `GrantWhat`, `ScopeWho`,
`EffectDuration`, `TriggerWindow`) is frozen by `21-card-effects-dsl.md` only after a dry run that encodes every card
of the first slice (lesson J); new members are additive and logged in §16.

## 9. Windows and triggers

`WindowId` (frozen string union in `types.ts`; data triggers use the same ids plus `'passive'` and `'action'`):

| Group | Ids |
|---|---|
| flow | `setup.done round.start crisis.revealed dice.rolled turn.start turn.end` |
| after an action resolved (Crossroads triggers, FAQ 2.1.1) | `action.attack action.search action.barricade action.cleanWaste action.attract action.ability action.playCard action.contribute action.move action.request action.handOff action.vote action.spendFood` |
| rule effects | `exposure.rolled wound.taken survivor.killed survivor.added zombie.killed zombie.added entrance.overrun noise.added search.drawn search.kept card.played card.equipped` |
| colony phase | `colony.payFood colony.waste colony.crisis colony.zombies colony.objective colony.roundTick` |
| results | `crisis.resolved morale.changed vote.result seat.exiled game.end` |

A survivor who dies mid-move does not reach `action.move`; the held Crossroads card is checked once per resolved action.
If two effects would trigger at once, the first seat decides the order (`effectChoice`). An item cannot interrupt an
effect in progress (Part E preamble).

## 10. The engine owns every displayed number (`query.*`)

All queries take a `SeatView`, so they can never show the human or a bot a number built from hidden information.

| Query | Returns |
|---|---|
| `query.crisis(view)` | `{cardId, prevent, needed, bonusAt, cardsIn, cardsBySeat, myPoints, minTotal, maxTotal, resolved}`: the viewer's own cards are scored, other seats' cards count ±1 |
| `query.foodNeeded(view)` | `{survivorsAtColony, helpless, needed, supply, shortfall, starvationNow, moraleLossIfShort}` (E.4 step 1, F 6.1.1) |
| `query.zombiesToAdd(view)` | per-location counts, noise rolls at 1/2 each, colony empty spaces, expected total |
| `query.dieRequirement(view, survivorId, action, abilityId?)` | `{need, dice[{dieId, value, ok, foodToReach}], usable}` |
| `query.exposureOdds(view, survivorId, reason?: ExposureReason)` / `query.exposureBase()` | `{blank, wound, frostbite, bite, pDeath}` with grants applied for that reason (`move zombieKill biteChain card ability`) / the raw 6-3-2-1 die |
| `query.attackSurvivorOdds(view, attackerId, targetId)` | `{targetAttack, pHit = P(d6 ≤ targetAttack), pKillTarget, stealsCard}` |
| `query.zombieKillOdds(view, survivorId, location, entrance)` | `{pKill: 1 with a qualifying die, exposure}` |
| `query.objectiveProgress(view, objectiveId?)` | `{objectiveId, kind, complete, requiresMain, parts[{label, have, need}]}` for the viewer's own and the main objective |
| `query.searchOdds(view, location)` | `{remaining, pSymbol, seen}` from the deck composition minus cards seen (H.2) |
| `query.moveTargets(view, survivorId)` | legal destinations with empty spaces, zombies and the exposure cost |
| `query.voteForecast(view, target)` | `{eligible, needed, tiebreakBy}` |

Implemented in M0: `foodNeeded`, `zombiesToAdd`, `exposureBase`. The rest throw `NotImplementedError` until M1.
The client never does rules arithmetic (Mallet lesson: UI maths ignored a modifier).

## 11. Determinism, RNG, replay (`rng.ts`)

- sfc32 seeded by `cyrb128(seed)` with a 15-step warm-up; state in `state.rng`. Every d6 roll goes through
  `roll(state, {count, purpose, seat?, target?})` → `DiceRolled {rollId, purpose, dice, total}`; the exposure die
  through `rollExposure(state, survivorId, reason)` → `ExposureRolled {rollId, raw, face}`; deck shuffles through
  `shuffle(rng, items)`. Each advances `rollSeq`.
- `EXPOSURE_FACES`: 12 entries, 6 blank / 3 wound / 2 frostbite / 1 bite (RULING, fan-source). `exposureFaceOf(raw)` maps
  a d12 value to its face so a physical-die correction only changes this table.
- `RollPurpose` ∈ `actionDice exposure attackSurvivor noise objective crisis crossroads item ability other`; every
  purpose reaches the dice tray (`50-client`), exposure included (lesson J).
- Bots roll on the same seeded stream as the human, in turn order (H.9). AI randomness uses `deriveSeed(seed, seat,
  decisionId)`, never `state.rng`, so logs replay identically.
- Contract tests: `CONTRACT-001..006` (determinism, range, the 12k-roll face distribution within 5σ, `roll` and
  `rollExposure` advancing state, seeded shuffle).

## 12. Save, load, undo

`SaveFile = {format: 1, engine: semver, dataVersion, setup, seed, actions: Action[], meta: {savedAt, label}}`.
Load = replay. Undo = replay minus the trailing actions back to the human's previous decision (vs bots only; a replay
re-deals the same hidden cards, so nothing leaks). Saves live in `localStorage` (`dow.save.<slot>`) and export as `.json`.

## 13. Decider (`decider.ts`)

```ts
interface Decider { decide(view: SeatView, pending: PendingDecision, legal: Action[]): Promise<Action> }
```
- One interface for the human (resolved by the interaction layer), the AI colonists (worker, `40-ai`), the random bot
  (`createRandomDecider(seed, seat)`) and replay (`createReplayDecider(log)`).
- The store is the ONLY caller of `step`; a bot answers only when presentation is idle, with a 5 s no-progress
  watchdog that force-answers bot-owned decisions with `legal[0]` (C.5).
- For `votes` the store asks every eligible decider with the same view-per-seat and submits one `castVotes`.

## 14. Rejection codes

`E_WRONG_DECISION E_NOT_YOUR_DECISION E_NOT_AN_OPTION E_BAD_PAYLOAD E_BAD_SETUP E_DATA_VERSION E_GAME_OVER
E_NOT_YOUR_SURVIVOR E_SURVIVOR_DEAD E_WRONG_LOCATION E_NO_SPACE E_ALREADY_MOVED E_NO_DIE E_DIE_USED E_DIE_TOO_LOW E_DIE_MAX
E_NO_FOOD E_NO_ZOMBIE E_HELPLESS_TARGET E_OWN_SURVIVOR E_NO_NOISE_SPACE E_DECK_EMPTY E_NOT_IN_HAND E_NOT_EQUIPPED
E_CARD_NOT_PLAYABLE E_TARGET_INVALID E_REQUESTED_CARD E_ABILITY_USED E_ABILITY_LOCATION E_FORBIDDEN E_EXILED E_VOTE_USED
E_SELF_TARGET E_NOT_LEADER_CANDIDATE`. New codes are additive.

## 15. Performance and code-split budgets

| Item | Budget |
|---|---|
| `step` | ≤1 ms median, ≤5 ms p99 (node, laptop class) |
| `legalActions` | ≤5 ms p99; a `turnAction` list ≤200 candidates (attract combinations are capped to distinct outcomes) |
| `view` | ≤0.5 ms |
| `npm run sim` | random-vs-random 4-seat game ≤2 s; 200-game batch ≤3 min; per-game decision cap 3,000 and a stall detector (lesson J) |
| AI decision (normal) | ≤500 ms p95, 2 s hard cap; per-decision budget behind an env var |
| JS | initial chunk ≤350 KB gz; engine+data ≤250 KB gz; ai ≤150 KB gz; each content batch (survivors, Crossroads text) its own chunk |
| Frame | 60 fps at 1080p mid GPU; ≤200 draw calls; instanced zombies; Low graphics setting |

## 16. Contract change log (additive only; frozen after M0)

| Date | File | Change | Why |
|---|---|---|---|
| 2026-10-09 | all eight | M0 freeze | this document |
| 2026-10-10 | view.ts, types.ts | `view()` projects another seat's `pending` as a public stub (`redactPending`, `redacted?: true` on `PendingDecision`); the stub's ids join `hiddenIdsFor` | review: drawn cards / offered survivors / a responder's hand leaked through `pending` (VIEW-003, VIEW-007, new VIEW-018) |
| 2026-10-10 | types.ts, events.ts, view.ts | `EffectInstance.ownerSeat?` (required for secret/exiled-objective effects); `view.effects` drops other seats' private effects (`hiddenEffectCount`); `EffectApplied/EffectExpired.ownerSeat?` redacted | review: secret-objective counters leaked the objective id (VIEW-019) |
| 2026-10-10 | types.ts, events.ts, view.ts | `GameState.removedHidden: CardId[]`, `SeatView.removedHiddenCount`, `GameRecap.removedHidden`; `CardDiscarded.revealed?: false` | review: Old Divisions contributions (F 2.3.1) and a last survivor's discarded hand (R p14) leave unrevealed |
| 2026-10-10 | hooks.ts | `CrossroadsDescriptor.options: CrossroadsOptionDescriptor[]` (≥1) instead of a 2-tuple; `forced` = only one option possible | review: R p12 says MOST cards offer two |
| 2026-10-10 | hooks.ts, types.ts | `CardEffectDescriptor.abilityId? cardInstanceId? countsAs?`; `GameState.cardUses: Record<CardId, Record<abilityId, n>>`; `SeatState.abilityUses` is survivor-only | review: once-per-round item uses travel with the card instance (R7.6, CARD-005); `useAbility` must address an item's second ability |
| 2026-10-10 | types.ts, view.ts | `CrisisState.history: CrisisHistoryEntry[]`, `CrisisView.history`, `recap.contributions` from the history | review: the recap promised every contribution by seat and crisis (END-005) |
| 2026-10-10 | actions.ts | `ConcedeAction` (`'concede'`); `GameEnded {reason:'concession'}` carries `winners: []` | review: a pure reducer cannot concede without an action; R17.4 nobody wins |
| 2026-10-10 | types.ts | `gameOver` decisions use `seat: 'all'` (any seat may `ack`) | review: no legal seat for `gameOver` |
| 2026-10-10 | hooks.ts | `OP_HOOK_POINTS.vote` lists every `action.*` window (`ACTION_WINDOWS`) | review: a Crossroads vote after `playCard`/`barricade` drew a validator warning |
| 2026-10-10 | events.ts | `DeckShuffled.location: LocationId \| 'survivor' \| 'crisis' \| 'exiledObjective'` | review: survivor/crisis deck reshuffles had no event (SETUP-010, Talia Jones) |
| 2026-10-10 | index.ts | `query.exposureOdds(view, survivorId, reason?: ExposureReason)` | review: odds for `card`/`ability`/`biteChain` rolls (Hunted, Daniel Smith) |

Rulings taken while writing the contracts (the orchestrator appends them to `docs/needs-rules-check.md`):
- RULING: exposure die face counts | `EXPOSURE_FACES` = 6 blank, 3 wound, 2 frostbite, 1 bite; `exposureFaceOf` isolates a correction | Fan-source (R p11 names the faces only)
- RULING: crisis contribution timing | `contributeCrisis` is a turn action at any time AND the engine asks once more (`crisisContribution`) when the seat ends its turn, so a bot's end-of-turn plan (H.2) and the human's table habit both fit | Confirmed (R p11: any time on your turn)
- RULING: who contributed a revealed crisis card | hidden in views until the recap, since the pile is shuffled face down before the reveal | Confirmed (R p12)
- RULING: attract with fewer than 2 zombies on the board | moves as many as exist (0..2) into empty entrance spaces | Unsourced
- RULING: a seat's survivors offered at setup | kept out of `state.survivors` and hidden from other seats until chosen; returned ones go back into the reshuffled deck | Confirmed (R p7)
