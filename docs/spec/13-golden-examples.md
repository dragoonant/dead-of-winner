# 13 Golden examples

The six worked examples of brief E.14 as machine-checkable scripts: initial state, forced dice, actions in order,
expected events (ordered) and expected state. Tests are `tests/engine/golden/GOLD-00n.test.ts`, named by ID.
Every value the book prints is cited; every value the book omits is marked **ASSUMED** and chosen so the script
is the smallest state that reproduces the printed outcome. Mechanics are 1:1 with R and F; the prose is ours.

## 0. Harness conventions

| Item | Rule |
|---|---|
| Fixture | `tests/fixtures/build.ts` (60 §1: never a hand-written `GameState`) builds each script's state: `createGame` on the test bundle `golden-fixture` (`dataVersion`), then the build helpers place survivors, set dice values, deck contents (top first), hands, zombies, barricades, noise, morale and food, and open `pending = turnAction` for the active seat in `phase:'playerTurns'`, `roundNumber 1`, `roundsLeft 6`, `morale 6`, `food 0`, `starvation 0`, `waste []`, `effects []`, no held Crossroads card (`crossroads.held = null`, so no trigger can fire) unless the script says otherwise. Colony-step scripts (GOLD-004..006) are built the same way and then handed to the colony-step driver at the named `colonyStep`. Fixture capacities: colony `{survivors 16, entranceSpaces 3, noiseSpaces 0}`, every other location `{survivors 4, entranceSpaces 3, noiseSpaces 4}` (**ASSUMED** except the 4 noise spaces, R p5). |
| Ids | survivors `sv.<kebab-name>`, locations `loc.police-station loc.grocery-store loc.school loc.library loc.hospital loc.gas-station` in that `locationOrder` after `colony`, card instances `c:<n>` with `defId` `item.<kebab>` (**ASSUMED**: 20-data-schema fixes the final spelling; the golden tests import the ids from the fixture bundle, so a rename touches one file). |
| Main objective | `obj.golden-none`: a fixture objective with no triggers and no setup, so a zombie kill rolls nothing extra. GOLD-001 also runs once under *We Need More Samples* with the sample roll forced (see its note). |
| Forced dice | The engine rolls only from `state.rng` (00 §11), so the harness never stubs it. `tests/fixtures/rng.ts: stateForRolls(wanted[])` (60 §1) searches sfc32 states whose next `rollDice` / `rollExposureFace` outputs match the listed `{sides, value}` sequence in order and sets `state.rng` on the built state, applied after the build and before the first rolling action. Each script then ASSERTS the `DiceRolled.dice` / `ExposureRolled.raw` values it listed, so a changed roll order fails loudly instead of silently passing. |
| Exposure raw | raw 1–6 blank, 7–9 wound, 10–11 frostbite, 12 bite (`EXPOSURE_FACES`, fan-source counts, 00 §16). |
| Shuffles | A shuffle also consumes the stream. Where the book's outcome does not depend on the order (GOLD-004 reveal order) the script asserts multisets and totals, not order. |
| Events | "Expected events" lists the events that MUST appear in that relative order; `DieSpent`, `TurnStarted`-class flow events and `DecisionAutoResolved` may interleave. `pending` is asserted exactly. |
| Dice ids | A seat's dice are `<seat>:d1..dn` in roll order with the listed values, all `used:false`. |

## GOLD-001 Attacking a zombie (R p9)

Player one has Ashley Ross at the school with one zombie there, spends a 4 on her 2+ attack, kills it and rolls a
wound on the exposure die.

| Fixture | Value | Source |
|---|---|---|
| Seats | s1 (active, first), s2 | R p9 ("player one"); 2 seats ASSUMED |
| s1 survivors | `sv.ashley-ross` (atk 2+, inf 52) at `loc.school`, leader | R p9 |
| s2 survivors | `sv.mike-cho` at `colony` | ASSUMED (any second seat) |
| `loc.school` entrance 1 | zombies 1, barricades 0 | R p9 (one zombie shown) |
| s1 dice | `s1:d1 = 4`, `s1:d2 = 2` | R p9 (the 4); the 2 ASSUMED, must stay unused |
| Forced rolls | exposure d12 raw **7** (wound) | R p9 ("rolls a wound") |

| # | Action |
|---|---|
| 1 | `attack {seat:'s1', survivorId:'sv.ashley-ross', dieId:'s1:d1', target:{kind:'zombie', location:'loc.school', entrance:1}}` |

| # | Expected event | Fields |
|---|---|---|
| 1 | `AttackDeclared` | `attackerId 'sv.ashley-ross'`, `need 2`, `dieId 's1:d1'` |
| 2 | `DieSpent` | `value 4`, `purpose 'attack'`, `need 2` |
| 3 | `ZombieKilled` | `location 'loc.school'`, `entrance 1`, `by 'sv.ashley-ross'`, `zombies 0` |
| 4 | `ExposureRolled` | `reason 'zombieKill'`, `raw 7`, `face 'wound'` |
| 5 | `WoundTaken` | `kind 'wound'`, `wounds 1`, `frostbite 0`, `source 'exposure'` |

Expected state: `locations['loc.school'].entrances[0].zombies = 0`; `survivors['sv.ashley-ross'] = {wounds 1, frostbite 0,
status 'alive'}`; `seats.s1.dice[0].used = true`, `dice[1].used = false`; `morale 6`; `pending.kind = 'turnAction'`,
`pending.seat = 's1'`; `turn.actions = 1`. No `SurvivorAttacked`, no `CardStolen`, no `MoraleChanged`.

Variant GOLD-001b (*We Need More Samples*, R p6): same script with forced rolls objective d6 **4** then exposure raw
7, in that order → an extra `DiceRolled {purpose:'objective', dice:[4]}` and `ObjectiveProgress {counter:'samples',
delta:1, after:1, need:6}` strictly between events 3 (`ZombieKilled`) and 4 (`ExposureRolled`): the main objective's
trigger fires in the `zombie.killed` window and the attacker's exposure roll comes after it (10 R6.1, 21 §1). With the
d6 forced to **3**, no `ObjectiveProgress` and the exposure roll is then the second roll of the stream.

## GOLD-002 Attacking a survivor (R p9)

Ashley Ross, back at the school, attacks Mike Cho (player two). Player one spends a 3, re-rolls that die and gets a 1,
which is at most Mike's attack value 2, so Mike takes a wound and player one steals a random card. No exposure roll.

| Fixture | Value | Source |
|---|---|---|
| Seats | s1 (active, first), s2 | R p9 |
| s1 survivors | `sv.ashley-ross` at `loc.school`, 0 wounds, leader | R p9 |
| s2 survivors | `sv.mike-cho` (atk 2+, inf 30) at `loc.school`, 0 wounds, leader | R p9 |
| s1 hand | `[]` | ASSUMED |
| s2 hand | `['c:1' item.food, 'c:2' item.medicine]` | ASSUMED (2 cards so the steal is a real draw) |
| s1 dice | `s1:d1 = 3` | R p9 (the 3) |
| Forced rolls | attack-a-survivor d6 **1**; the random steal index comes from the same stream, **ASSUMED** to pick `c:1` (the test asserts "one of s2's two cards" and that `rollSeq` advanced for the pick only if the engine implements the pick through `roll`; if it uses `nextU32` directly, assert the hand sizes only) | R p9 ("rolls a 1") |

| # | Action |
|---|---|
| 1 | `attack {seat:'s1', survivorId:'sv.ashley-ross', dieId:'s1:d1', target:{kind:'survivor', survivorId:'sv.mike-cho'}}` |

| # | Expected event | Fields |
|---|---|---|
| 1 | `AttackDeclared` | `need 2`, `target.kind 'survivor'` |
| 2 | `DieSpent` | `value 3`, `purpose 'attack'` |
| 3 | `DiceRolled` | `purpose 'attackSurvivor'`, `dice [1]`, `target 2` |
| 4 | `SurvivorAttacked` | `attackerId 'sv.ashley-ross'`, `targetId 'sv.mike-cho'`, `roll 1`, `targetAttack 2`, `hit true` |
| 5 | `WoundTaken` | `survivorId 'sv.mike-cho'`, `kind 'wound'`, `wounds 1`, `source 'attack'` |
| 6 | `CardStolen` | `from 's2'`, `to 's1'`, `cardId ∈ {'c:1','c:2'}` |

Expected state: `survivors['sv.mike-cho'].wounds = 1`, alive; `seats.s1.hand.length = 1`, `seats.s2.hand.length = 1`,
the two hands are disjoint and together equal `{'c:1','c:2'}`; NO `ExposureRolled` and NO `ExposureSkipped` in the
events; `morale 6`; `pending = turnAction` for s1. Leak check: `view(state,'s2')` after the step does not contain the
stolen card's id outside `recap`, and `redactEvent(CardStolen,'s3')` (a third seat, if added) blanks `cardId`.

Variant GOLD-002b: forced d6 **3** → event 4 has `hit false`, no events 5–6, hands unchanged (R p9: the roll must be
at most the target's attack value).

## GOLD-003 Searching with noise (R p10)

Forest Plum at the gas station spends a 5 on his 5+ search, draws a Lighter, makes noise to draw again, finds a Fuel,
keeps the Fuel and puts the Lighter under the deck.

| Fixture | Value | Source |
|---|---|---|
| Seats | s1 (active, first), s2 | R p10 |
| s1 survivors | `sv.forest-plum` (srch 5+, inf 14) at `loc.gas-station`, leader | R p10 |
| `loc.gas-station.deck` (top first) | `['c:10' item.lighter, 'c:11' item.fuel, 'c:12' item.fuel, 'c:13' item.weapon-generic]` | R p10 (Lighter then Fuel); the two cards below ASSUMED, must stay in place |
| `loc.gas-station.noise` | 0 | R p10 (an empty noise space is used) |
| s1 hand | `[]` | ASSUMED |
| s1 dice | `s1:d1 = 5` | R p10 (the 5) |
| Forced rolls | none (no die is rolled during a search) | R p10 |

| # | Action | Pending before |
|---|---|---|
| 1 | `search {seat:'s1', survivorId:'sv.forest-plum', dieId:'s1:d1'}` | `turnAction` s1 |
| 2 | `makeNoise {seat:'s1'}` | `searchKeepOrNoise` s1, `context.cardId 'c:10'` |
| 3 | `keepCard {seat:'s1', cardId:'c:11'}` | `searchKeepOrNoise` s1, `context.cardIds ['c:10','c:11']` |

| # | Expected event | Fields |
|---|---|---|
| 1 | `SearchStarted` | `survivorId 'sv.forest-plum'`, `location 'loc.gas-station'`, `need 5` |
| 2 | `DieSpent` | `value 5`, `purpose 'search'` |
| 3 | `SearchDrawn` | `cardId 'c:10'`, `defId 'item.lighter'` |
| 4 | `NoiseAdded` | `location 'loc.gas-station'`, `count 1`, `after 1`, `by 'search'` |
| 5 | `SearchDrawn` | `cardId 'c:11'`, `defId 'item.fuel'`, `symbols ['fuel']` |
| 6 | `SearchKept` | `cardId 'c:11'`, `returned 1` |
| 7 | `CardDiscarded` | `cardId 'c:10'`, `to 'deck'`, `reason 'searchReturned'` (reason string **ASSUMED**) |

Expected state after action 3: `seats.s1.hand = ['c:11']`; `locations['loc.gas-station'].deck = ['c:12','c:13','c:10']`
(Lighter at the bottom, the untouched cards in their original order); `noise = 1`; `state.search = null`; `pending =
turnAction` s1. Between actions 1 and 2: `state.search = {seat:'s1', drawn:['c:10'], noiseAdded:0}`, and
`view(state,'s2').search.drawnCount = 1` with `'c:10'` absent from s2's serialised view (VIEW-007).

Variant GOLD-003b: same fixture with `noise = 4` before the search → after event 3 the pending is `searchKeepWhich`
with one option, auto-resolved (`DecisionAutoResolved {kind:'searchKeepWhich'}`), `SearchKept {cardId:'c:10',
returned 0}`; `makeNoise` would be `E_NO_NOISE_SPACE` (SRCH-006).

## GOLD-004 Resolving a crisis with a wrong-symbol card (R p12)

Three players, none exiled, so Fuel Shortage needs 3 points. Four cards were contributed: three Fuel and one Lighter,
whose weapon symbol is not in the prevent list. Total 2 < 3, so the crisis is not prevented and the fail effect
(lose 2 morale) happens.

| Fixture | Value | Source |
|---|---|---|
| Seats | s1 (first), s2, s3; `phase 'colony'`, `colonyStep 'resolveCrisis'` set by the `build.ts` colony helper (the test calls the colony-step driver from the `payFood`-done state) | R p12 ("three player game") |
| `crisis.cardId` | `crisis.fuel-shortage` = `{prevent:['fuel'], fail: morale −2, bonus: +2 cards → morale +1}` | R p4, R p12 |
| `crisis.contributions` | `[{s1,'c:20'},{s1,'c:21'},{s2,'c:22'},{s3,'c:23'}]` with `c:20..22 = item.fuel`, `c:23 = item.lighter` (symbol `weapon`) | R p12 (3 fuel + 1 weapon shown); who gave which is ASSUMED |
| `morale` | 6 | ASSUMED (the example gives none) |
| Forced rolls | none; the face-down pile is shuffled on the stream (order not asserted) | R p12 |

| # | Action |
|---|---|
| — | none: the colony step advances by itself once the fixture's step driver runs `resolveCrisis` (no decision is open) |

| # | Expected event | Fields |
|---|---|---|
| 1–4 | `CrisisCardRevealed` ×4 | multiset of `points` = {+1,+1,+1,−1}; `runningTotal` after the 4th = 2; `defId 'item.lighter'` carries `points −1`; no `seat` field |
| 5 | `CrisisResolved` | `cardId 'crisis.fuel-shortage'`, `total 2`, `needed 3`, `prevented false`, `bonus false`, `cards 4` |
| 6 | `CrisisEffectApplied` | `kind 'fail'` |
| 7 | `MoraleChanged` | `delta −2`, `after 4`, `reason 'crisisFailed'`, `sourceId 'crisis.fuel-shortage'` |
| 8–11 | `CardDiscarded` ×4 | `to 'removed'` for `c:20..c:23` |

Expected state: `morale 4`; `removed ⊇ {'c:20','c:21','c:22','c:23'}`; `waste = []`; `crisis.contributions = []`;
`crisis.result = {total 2, needed 3, prevented false, bonus false, moraleDelta −2}` with `revealed[].seat` filled in
state; `view(state,'s2').crisis.result.revealed` shows `seat 's2'` on `c:22` and `null` on the other three
(CRIS-011). `colonyStep` then advances to `addZombies`.

Variants: GOLD-004b replaces `c:23` with a fourth Fuel → `total 4`, `prevented true`, `bonus false`, morale 6 (needs
5 for the bonus, R p12). GOLD-004c adds a fifth Fuel `c:24` from s3 → `total 5`, `bonus true`, `MoraleChanged {+1,
reason 'crisisBonus'}`, morale 7.

## GOLD-005 Adding seven zombies with an overrun at entrance 3 (R p13)

Fourteen survivors are in the colony, so seven zombies are added. Entrance 3 is already full and has no barricade, so
the third zombie is not placed and the lowest-influence colony survivor dies instead; placement continues at 4, 5, 6
and wraps to 1.

| Fixture | Value | Source |
|---|---|---|
| Seats | s1 (first), s2, s3, s4; `phase 'colony'`, `colonyStep 'addZombies'` (crisis already resolved) | R p13; 4 seats ASSUMED |
| Colony mouths | 6 survivors + 8 helpless = 14 | R p13 ("fourteen survivors"); the split ASSUMED (helpless count, R p12) |
| Colony survivors | s1: `sv.brian-lee` (68), `sv.olivia-brown` (56); s2: `sv.ashley-ross` (52), `sv.mike-cho` (30); s3: `sv.forest-plum` (14), `sv.sparky` (10); s4: `sv.daniel-smith` (66) at `loc.library` (away) | ASSUMED; Sparky is the lowest influence at the colony |
| Colony entrances (capacity 3) | e1 0/0, e2 0/0, **e3 3 zombies, 0 barricades**, e4 0/0, e5 0/0, e6 0/0 (`zombies/barricades`) | R p13 (entrance 3 full, no barricade); the capacity ASSUMED |
| Non-colony locations | no survivors except Daniel at the library; no noise anywhere | ASSUMED, so only the colony block adds zombies (the library adds 1 for Daniel, listed below) |
| `morale` | 6 | ASSUMED |
| Forced rolls | none | R p13 |

| # | Expected event | Fields |
|---|---|---|
| 1 | `ZombiesToAdd` | `location 'colony'`, `count 7`, `source 'colonyStep'`, `survivors 14` |
| 2 | `ZombieAdded` | `entrance 1`, `zombies 1` |
| 3 | `ZombieAdded` | `entrance 2`, `zombies 1` |
| 4 | `EntranceOverrun` | `entrance 3`, `killed 'sv.sparky'` |
| 5 | `SurvivorKilled` | `survivorId 'sv.sparky'`, `owner 's3'`, `cause 'overrun'`, `moraleLoss true`, `wasLeader false` |
| 6 | `MoraleChanged` | `delta −1`, `after 5`, `reason 'survivorKilled'` |
| 7 | `ZombieAdded` | `entrance 4`, `zombies 1` |
| 8 | `ZombieAdded` | `entrance 5`, `zombies 1` |
| 9 | `ZombieAdded` | `entrance 6`, `zombies 1` |
| 10 | `ZombieAdded` | `entrance 1`, `zombies 2` |
| 11 | `ZombiesToAdd` | `location 'loc.library'`, `count 1`, `source 'locationStep'` |
| 12 | `ZombieAdded` | `location 'loc.library'`, `entrance 1` |

Expected state: colony entrances `[2,1,3,1,1,1]` zombies, all barricades 0; `survivors['sv.sparky'] = {status 'dead',
owner null}`; `seats.s3.survivors = ['sv.forest-plum']`, `leaderId` unchanged (Forest was the leader, ASSUMED);
`morale 5`; colony `helpless 8` (an overrun kills a survivor before a helpless token while any survivor is there,
R p13). Sparky's seat s3 was given Forest as leader in the fixture so no `newLeader` decision interrupts the step.

Variants: GOLD-005b puts 1 barricade in entrance 3 (2 zombies + 1 barricade) → event 4 becomes `BarricadeDestroyed
{entrance 3, barricades 0}`, no kill, morale 6, entrance 3 ends with 2 zombies (R p13). GOLD-005c removes every
colony survivor (14 helpless only) → event 4–6 become `EntranceOverrun {killed 'helpless'}`, `HelplessKilled {count 1,
after 13, moraleLoss true}`, `MoraleChanged −1` (R p13–14). GOLD-005d: nothing at the colony at all (0 mouths) →
`ZombiesToAdd {count 0}` and no adds.

## GOLD-006 Three rounds of starvation (F 6.1.1)

Round 1: 5 food, 13 colony survivors → short; add a starvation token, lose 1 morale, keep the food. Round 2: 8 food,
15 survivors → pay all 8, no loss. Round 3: 2 food, 15 survivors → short; second token, lose 2 morale.

This is a colony-step script: the harness runs the `payFood` step on three fixture states built from the previous
result with the food and head count set between rounds (the FAQ gives no actions, only the totals). The head counts
use helpless tokens, which count as survivors for food (R p12).

| Round | Fixture before `payFood` | Source |
|---|---|---|
| 1 | colony survivors 5 + helpless 8 = 13 mouths; `food 5`; `starvation 0`; `morale 6` (ASSUMED) | F 6.1.1 |
| 2 | 15 mouths (helpless 10); `food 8`; `starvation 1`; `morale 5` | F 6.1.1 |
| 3 | 15 mouths; `food 2`; `starvation 1` (round 2 added none); `morale 5` | F 6.1.1 |

| Round | Expected events | Expected state after |
|---|---|---|
| 1 | `Starvation {needed 7, supply 5, starvationAfter 1, moraleLoss 1}`, `MoraleChanged {delta −1, after 5, reason 'starvation'}`; NO `FoodPaid`, NO `FoodChanged` | `food 5`, `starvation 1`, `morale 5` |
| 2 | `FoodPaid {needed 8, survivors 15, foodAfter 0}`, `FoodChanged {delta −8, after 0, reason 'pay'}`; NO `Starvation`, NO `MoraleChanged` | `food 0`, `starvation 1`, `morale 5` |
| 3 | `Starvation {needed 8, supply 2, starvationAfter 2, moraleLoss 2}`, `MoraleChanged {delta −2, after 3, reason 'starvation'}` | `food 2`, `starvation 2`, `morale 3` |

`query.foodNeeded` before each round must report `{needed 7, shortfall 2, moraleLossIfShort 1}`, `{needed 8, shortfall 0,
moraleLossIfShort 0}` and `{needed 8, shortfall 6, moraleLossIfShort 2}` respectively (00 §10). Note that the FAQ's
round 2 head count (15 with 8 food) is exactly affordable: ceil(15/2) = 8.

Variant GOLD-006b: round 3 with `food 0` and a card that removed the starvation token after round 1 (`starvation 0`
entering round 3) → `Starvation {starvationAfter 1, moraleLoss 1}` (tokens leave play only by card effect, F 6.1.1).

## Coverage map

| Golden | Checklist IDs it also discharges |
|---|---|
| GOLD-001 | ATK-001, ATK-002, EXPO-003, DICE-004, ATK-014 (b) |
| GOLD-002 | ATK-005, ATK-006 (b), ATK-007, VIEW-010 (CardStolen) |
| GOLD-003 | SRCH-001, SRCH-002, SRCH-003, SRCH-006 (b), VIEW-007 |
| GOLD-004 | CRIS-004, CRIS-005 (b), CRIS-006 (c), CRIS-010, CRIS-011 |
| GOLD-005 | ZOM-001, ZOM-002, ZOM-003 (b), ZOM-004 (c), ZOM-006, COL-010, COL-011 |
| GOLD-006 | COL-003, COL-004, COL-005, COL-006 (b), COL-019 |

## Open values (ASSUMED) to confirm against physical components

| Value | Where | Why it matters |
|---|---|---|
| Entrance spaces per colony entrance and per location | GOLD-005 capacity 3 | changes when an entrance is "full" (brief E.2 verify) |
| Colony survivor spaces | fixtures | only bounds `SurvivorAdded` and moves (MOVE-003) |
| Lighter's symbol = weapon | GOLD-004 | read from the R p12 example picture; the card sheet should agree |
| Exposure die face counts 6/3/2/1 | every exposure raw | fan-source ruling (00 §16); only `EXPOSURE_FACES` changes if wrong |
| Reveal order of a shuffled crisis pile | GOLD-004 | never asserted |

The sample-roll order after a kill is no longer open: 10 R6.1 fixes `ObjectiveProgress` before `ExposureRolled`
(GOLD-001b).
