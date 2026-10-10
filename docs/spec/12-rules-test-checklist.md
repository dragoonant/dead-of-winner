# 12. Rules test checklist

Every testable rule assertion, with a stable ID. Engine tests are named by these IDs
(`it('EXPO-004 ...')`, 60.2.3); coverage is measured by test names (60.2.6). A new rule needs a new
line here first. IDs are never renumbered or reused; a retired line keeps its ID with `RETIRED`.

**Line format (parsed by `tools/checklist-coverage.ts`).** One table row per assertion:
`| <PREFIX>-<NNN> | <Mn> <must|should> | <assertion> | <ref> |`. Regex:
`^\| ([A-Z]+-\d{3}) \| (M\d+) (must|should) \|`. `Mn` is the milestone the test is due in; `must`
lines fail coverage when uncovered in or after that milestone, `should` lines only warn.

**Refs.** `10.x.y` = `10-rules-core.md` clause; `11 §x.y` = `11-objectives.md` section;
`GOLD-xx` = golden scenario in `13-golden-examples.md` that also exercises the line;
`R-XXX` = a ruling in `10` Rulings; `K-n` = a ruling at the end of this file.

**Fixture defaults.** Four seats A–D clockwise, A first player, scripted dice via `rng.ts` (13 §0).

---

## SETUP- Setup, components, board

| id | ms | assertion | ref |
|---|---|---|---|
| SETUP-001 | M1 must | Applying the main objective sets morale and round track to the chosen side's values | 10.3.1; 11 §2.2; GOLD-07 |
| SETUP-002 | M1 must | Setup zombies are placed through `addZombies` one at a time, before any survivor is placed, and never kill | 10.3.1; 10.8.4; 11 §2.2 |
| SETUP-003 | M1 must | Secret pool = 2n non-betrayal + 1 betrayal, shuffled; each seat gets exactly 1; the n+1 leftovers are out of the game and appear in no view | 10.3.2; 11 §4.4 |
| SETUP-004 | M1 should | Over 10,000 seeded setups at n=4 the betrayer-present rate is 4/9 ± 1% | 10.3.2 |
| SETUP-005 | M1 must | Crisis, survivor, exiled-objective and Crossroads decks are shuffled from the seed; same seed gives identical decks | 10.3.3 |
| SETUP-006 | M1 must | `excludeMature: true` removes every mature-marked Crossroads card; default false keeps them | 10.3.4; 10.14.6 |
| SETUP-007 | M1 must | Each seat's hand is 5 starting items; the rest of the starting-item deck is out of the game | 10.3.5 |
| SETUP-008 | M1 must | Each location's item deck is shuffled onto that location and only that location's cards are in it | 10.3.6 |
| SETUP-009 | M1 must | Each seat is dealt 4 survivors, keeps exactly 2 (`chooseSurvivors`), names 1 leader (`chooseLeader`); the other 2 return and the survivor deck is reshuffled | 10.3.7 |
| SETUP-010 | M1 must | All kept survivors start at the colony | 10.3.7 |
| SETUP-011 | M1 must | The seat whose leader has the highest influence holds the first-player token | 10.3.8 |
| SETUP-012 | M1 must | Food supply starts at the objective's value (0 if absent), starvation tokens 0, waste pile empty | 10.3.9 |
| SETUP-013 | M1 must | `startingPlayers` equals seats dealt in and never changes after exile or elimination | 11 §2.3 |
| SETUP-014 | M1 must | Board has 7 locations in the order colony, police, grocery, school, gas, library, hospital | 10.2.1; R-LOCORDER |
| SETUP-015 | M1 must | Colony has 6 entrances with `board.json` space counts; each non-colony location has 1 entrance and exactly 4 noise spaces | 10.2.2; 10.2.3; 10.2.5 |
| SETUP-016 | M1 must | Morale is clamped to `[0, moraleMax]`; food never goes below 0 | 10.2.6; R-MORALEMAX |
| SETUP-017 | M1 must | Helpless tokens occupy colony survivor spaces and count toward capacity | 10.2.7; R-HELPSPACE |
| SETUP-018 | M8 should | Full content counts: 10 main, 24 secret, 10 betrayal, 10 exiled, 30 survivors, 25 starting items, 6 x 20 location items, 20 crises, 80 Crossroads | 10.1.1–10.1.9; 11 §1 |
| SETUP-019 | M1 must | No engine cap on zombies, wounds, food, noise or barricades beyond board spaces | 10.0.10; 10.1.10–10.1.15; R-TOKENS |
| SETUP-020 | M2 must | Every item card carries exactly one symbol from the 7-symbol set; every crisis names one prevent symbol | 10.1.18; 10.1.8 |
| SETUP-021 | M2 must | Survivor influence values are unique across the survivor data (validation fails on a duplicate) | 10.1.5; 10.9.1; R-INFL |
| SETUP-022 | M8 should | Variant `betrayerVariant`: pool = n non-betrayal + 1 betrayal | 10.14.3; 11 §4.4 |
| SETUP-023 | M8 should | Variant `coop`: hardcore side, no secret objectives dealt, no vote action, non-co-op cards removed | 10.14.1; 11 §6.8 |
| SETUP-024 | M8 should | Variant `twoPlayer`: co-op rules, 7 starting items per seat, keep 3 of 4 survivors | 10.14.2 |
| SETUP-025 | M8 should | Variant `hardcore`: normal game on the hardcore side's setup values | 10.14.4; 11 §3.2 |
| SETUP-026 | M1 must | Same seed and same decisions produce byte-identical state and event logs | 10.0.5; 60.2.8 |

## DICE- Action dice

| id | ms | assertion | ref |
|---|---|---|---|
| DICE-001 | M1 must | At round start every seat discards all unused dice and rolls `1 + survivors it controls` d6 | 10.4.2 |
| DICE-002 | M1 must | Helpless tokens give no dice | 10.4.2; 10.9.3 |
| DICE-003 | M1 must | Any of a seat's unused dice may pay for any of its survivors; one survivor may use several dice in a turn | 10.4.2 |
| DICE-004 | M1 must | A survivor added mid-round adds no die until the next roll, but may act with existing dice | 10.4.2; 10.9.2 |
| DICE-005 | M1 must | A spent die is gone for the round and cannot be used again | 10.5 common |
| DICE-006 | M1 must | Spend food: removes 1 food and adds +1 to one unused die | 10.6.4 |
| DICE-007 | M1 must | Spend food is illegal with 0 food, or when no unused die is below 6; a die never exceeds 6 | 10.6.4 |
| DICE-008 | M1 must | Exiled seats cannot spend food tokens on dice | 10.6.4; 10.11.4 |
| DICE-009 | M1 must | Unused dice from the previous round are not carried into the next round | 10.4.2 |

## ACT- Turn structure and generic actions

| id | ms | assertion | ref |
|---|---|---|---|
| ACT-001 | M1 must | Exactly one `PendingDecision` is open at any time, with a `seat` or `'all'` | 10.0.7 |
| ACT-002 | M1 must | `legalActions` is non-empty for every open decision; every `turnAction` includes `endTurn` | 10.0.7; 10.6.8 |
| ACT-003 | M1 must | Turns run clockwise from the first player; each seat (exiled included) gets exactly one turn per round | 10.4.3 |
| ACT-004 | M1 must | The active seat may take actions in any order and number until `endTurn` | 10.4.5 |
| ACT-005 | M1 must | Die actions only name a survivor of the active seat and an unused die of that seat | 10.5 common |
| ACT-006 | M1 must | Barricade: any die, an empty entrance space at the survivor's location; places 1 barricade; at the colony the seat picks the entrance | 10.5.4 |
| ACT-007 | M1 must | Barricade is illegal when the location's entrance(s) have no empty space | 10.5.4; 10.2.4 |
| ACT-008 | M1 must | Clean waste: any die, survivor at the colony; removes the top 3 waste cards from the game (fewer if fewer) | 10.5.5 |
| ACT-009 | M1 must | Clean waste is illegal for a survivor outside the colony | 10.5.5 |
| ACT-010 | M1 must | Attract: moves up to 2 zombies, one at a time, from other locations into empty entrance spaces at the survivor's location | 10.5.6 |
| ACT-011 | M1 must | Attract never places into a full entrance, never breaks a barricade, never overruns, and stops early when no space or source remains | 10.5.6; 10.8.4 |
| ACT-012 | M2 must | Ability `(N+)`: needs a die ≥ N per use; repeatable unless marked once per round | 10.5.7 |
| ACT-013 | M2 should | Loretta Clay's `(4)` cost is read as `(4+)` | 10.5.7 |
| ACT-014 | M1 must | Request: each other seat in turn order answers `give` or `decline` via `requestResponse` | 10.6.5 |
| ACT-015 | M1 must | A given card is revealed and must be played at once (effect or ability cost); it cannot be contributed to the crisis | 10.6.5; K-1 |
| ACT-016 | M1 must | Exiled seats may request and may give | 10.6.5; 10.11.4 |
| ACT-017 | M1 must | Hand off: moves an equipped item between two survivors at the same location (any seat's); a used once-per-round ability stays used | 10.6.6; R-HANDOFF |
| ACT-018 | M1 must | Hand off is illegal between survivors at different locations | 10.6.6 |
| ACT-019 | M1 must | After every resolved action the engine evaluates the held Crossroads trigger and then `checkGameEnd` | 10.4.5 |
| ACT-020 | M1 must | When two effects trigger together, an `orderEffects` decision goes to the first player | 10.0.2 |
| ACT-021 | M1 must | Every decision prompt carries engine-computed numbers; the view never needs the client to compute odds | 10.0.8 |

## ATK- Attacks

| id | ms | assertion | ref |
|---|---|---|---|
| ATK-001 | M1 must | Attack a zombie needs a die ≥ the survivor's attack value and a zombie at its location; lower dice are not legal | 10.5.1; GOLD-01 |
| ATK-002 | M1 must | A zombie attack removes 1 zombie, then calls `rollExposure(attacker, loc, 'kill')` | 10.5.1; 10.7.4; GOLD-01 |
| ATK-003 | M1 must | The same survivor may attack again with another qualifying die | 10.5.1; GOLD-01 |
| ATK-004 | M1 must | At the colony the seat picks the zombie from any entrance holding one | 10.5.1; 10.8.5 |
| ATK-005 | M1 must | Attack a survivor needs a die ≥ attacker's attack, a non-helpless target at the same location owned by another seat; own survivors and helpless tokens are never targets | 10.5.2; GOLD-02 |
| ATK-006 | M1 must | The spent die is re-rolled; result ≤ target's attack → target takes 1 wound and the attacker takes 1 random card from the target seat's hand | 10.5.2; GOLD-02 |
| ATK-007 | M1 must | Re-roll > target's attack → no wound, no steal | 10.5.2; GOLD-02 |
| ATK-008 | M1 must | Attacking a survivor never rolls exposure | 10.5.2 |
| ATK-009 | M1 must | Survivor attacks are legal at any location and for exiled seats | 10.5.2; R-ATTACKSURV |
| ATK-010 | M1 must | A wound from a survivor attack runs the death check; a third token kills via `killSurvivor(t, 'attack')` | 10.5.2; 10.7.3 |
| ATK-011 | M1 must | The prompt for a survivor attack shows engine-computed hit odds = target attack / 6 | 10.0.8 |

## SRCH- Search and noise

| id | ms | assertion | ref |
|---|---|---|---|
| SRCH-001 | M1 must | Search needs a non-colony location, a non-empty deck and a die ≥ the survivor's search value | 10.5.3; R-EMPTYDECK; GOLD-03 |
| SRCH-002 | M1 must | Search draws 1 card and opens `searchKeepOrNoise` for the active seat | 10.5.3; GOLD-03 |
| SRCH-003 | M1 must | `makeNoise` places a noise token and draws 1 more; illegal when the location's 4 noise spaces are full or the deck is empty | 10.5.3; 10.8.7; GOLD-03 |
| SRCH-004 | M1 must | When the loop ends, exactly 1 drawn card is kept (`searchKeepWhich`); the rest go to the deck bottom in seeded order | 10.5.3; GOLD-03 |
| SRCH-005 | M1 must | The kept card goes to the active seat's hand | 10.5.3 |
| SRCH-006 | M1 must | Search may be repeated with further qualifying dice | 10.5.3 |
| SRCH-007 | M1 must | Search is never legal at the colony | 10.5.3 |

## MOVE- Movement

| id | ms | assertion | ref |
|---|---|---|---|
| MOVE-001 | M1 must | Each survivor moves at most once per turn | 10.6.3 |
| MOVE-002 | M1 must | Move needs a different destination with an empty survivor space (colony included) | 10.6.3; 10.9.7 |
| MOVE-003 | M1 must | Every move calls `rollExposure(s, destination, 'move')` | 10.6.3; 10.7.4 |
| MOVE-004 | M1 must | A survivor added this turn may move | 10.6.3 |
| MOVE-005 | M1 must | Move needs no die | 10.6 |
| MOVE-006 | M1 must | Forced placements (10.11.6) may use a location with no free space; voluntary moves may not | 10.9.7 |
| MOVE-007 | M1 must | An exiled seat's survivor can never move into the colony | 10.11.4 |

## EXPO- Exposure and the bite chain

| id | ms | assertion | ref |
|---|---|---|---|
| EXPO-001 | M1 must | The exposure d12 has 6 blank, 3 wound, 2 frostbite, 1 bitten faces | 10.7.1; R-D12 |
| EXPO-002 | M1 must | Blank → nothing; wound → 1 wound token; frostbite → 1 frostbite token | 10.7.2 |
| EXPO-003 | M1 must | A survivor with ≥ 3 wound+frostbite tokens is killed at once via `killSurvivor(s, 'wounds')` | 10.7.3 |
| EXPO-004 | M1 must | Bitten kills the survivor, then the bite spreads to the lowest-influence non-helpless survivor at the location (any seat, exiled included) | 10.7.5; R-BITEHELPLESS |
| EXPO-005 | M1 must | The spread target's controller gets `biteSpread`: kill → chain stops; roll → blank stops, any other face kills and loops | 10.7.5 |
| EXPO-006 | M1 must | The chain stops when no non-helpless survivor remains at the location; helpless tokens are never spread targets | 10.7.5 |
| EXPO-007 | M1 must | The chain location is the move destination for a move-triggered bite | 10.7.5 |
| EXPO-008 | M1 must | `rollExposure` runs after every move and every zombie kill; card text with "no exposure" skips it | 10.7.4 |
| EXPO-009 | M1 must | All exposure goes through `rollExposure`; no other code path rolls the d12 | 10.0.5 |
| EXPO-010 | M1 must | No card may be played while a death check or exposure is resolving (no interrupt) | 10.0.3; 10.7.3 |
| EXPO-011 | M1 must | Crossroads triggers evaluate only after the whole action including bite chain has resolved | 10.7.6; 10.10.3 |
| EXPO-012 | M1 must | Move and attack prompts expose the engine-computed odds 50/25/16.7/8.3 | 10.0.8; 10.7.1 |

## CARD- Playing cards and the DSL

| id | ms | assertion | ref |
|---|---|---|---|
| CARD-001 | M1 must | Only the active seat may play a card; the effect resolves via the `21` DSL | 10.6.1; 10.10.2 |
| CARD-002 | M1 must | A played non-equip card goes to the waste pile | 10.6.1 |
| CARD-003 | M1 must | An Equip card attaches to one of the seat's survivors at any location and stays until contributed or handed off | 10.6.1 |
| CARD-004 | M1 must | An exiled seat's played cards leave the game instead of entering waste | 10.6.1; 10.11.4 |
| CARD-005 | M1 must | A card that adds a survivor or helpless token is not legal when the colony has no empty survivor space | 10.6.1; 10.9.2 |
| CARD-006 | M1 must | Card text overrides the default rule where it says so (DSL override beats core behaviour) | 10.0.1 |
| CARD-007 | M1 must | A food card counts as one card in a crisis regardless of its food value | 10.4.14 |
| CARD-008 | M1 must | An effect that searches a deck for a named card reshuffles that deck afterwards | 10.10.6 |
| CARD-009 | M1 must | Every kill, zombie addition and exposure from a card reaches `killSurvivor`, `addZombies`, `rollExposure` | 10.0.5 |
| CARD-010 | M1 must | Every `{"code": "<hook>"}` in card data resolves to a registered hook | 11 §1.2; 10.10.2 |
| CARD-011 | M1 must | A card that "removes" a survivor uses cause `removed` and costs no morale unless the card says so | 10.9.6 |
| CARD-012 | M1 should | Over a long sim, no hand-size limit is enforced | 10.0.9; R-HAND |

## XRD- Crossroads

| id | ms | assertion | ref |
|---|---|---|---|
| XRD-001 | M1 must | At start of each turn `right(active)` draws the top Crossroads card and holds it | 10.4.4; 10.10.1 |
| XRD-002 | M1 must | The Crossroads draw happens before frostbite wounds at start of turn | 10.4.4; R-TURNSTART |
| XRD-003 | M1 must | The trigger is checked after each resolved action of the active turn, never mid-action | 10.4.5; 10.10.3 |
| XRD-004 | M1 must | A survivor who dies mid-action does not satisfy a trigger that needs the action to finish | 10.10.3 |
| XRD-005 | M1 must | On trigger the card is revealed publicly and the active seat answers `crossroadsOption` | 10.10.4 |
| XRD-006 | M1 must | An option that cannot be fulfilled is absent from `legalActions`; the other stays | 10.10.4 |
| XRD-007 | M1 must | A resolved Crossroads card is removed from the game | 10.10.4 |
| XRD-008 | M1 must | At most one Crossroads card triggers per turn | 10.10.4 |
| XRD-009 | M1 must | An untriggered card goes to the bottom of the Crossroads deck at end of turn | 10.4.6; 10.10.5 |
| XRD-010 | M1 must | Triggers are declarative DSL predicates over events (move, search, wound type, location, survivor, start of turn) | 10.10.2 |

## CRIS- Crisis

| id | ms | assertion | ref |
|---|---|---|---|
| CRIS-001 | M1 must | The top crisis card is revealed publicly at round start | 10.4.1 |
| CRIS-002 | M1 must | During its own turn a seat may contribute any number of hand or equipped cards face down | 10.4.13; 10.6.2 |
| CRIS-003 | M1 must | A seat cannot contribute outside its own turn | 10.4.13 |
| CRIS-004 | M1 must | Exiled seats cannot contribute | 10.4.13; 10.11.4 |
| CRIS-005 | M1 must | Each contributed card with the prevent symbol = +1, any other card = −1 | 10.4.14; GOLD-04 |
| CRIS-006 | M1 must | `players` = non-exiled seats; total ≥ players → prevented | 10.4.15 |
| CRIS-007 | M1 must | Total ≥ players + 2 → prevented and +1 morale | 10.4.15 |
| CRIS-008 | M1 must | Total < players → the failure effect resolves through the DSL | 10.4.15; GOLD-04 |
| CRIS-009 | M2 should | Optional bonus contributions resolve per card data | 10.4.15 |
| CRIS-010 | M1 must | Contributed cards and the crisis card leave the game (not waste) | 10.4.16 |
| CRIS-011 | M1 must | Reveal order is a seeded shuffle; the total does not depend on order | 10.4.14 |
| CRIS-012 | M1 must | The engine exposes the running crisis total and needed total at resolution | 10.0.8 |
| CRIS-013 | M1 must | A card received by request cannot be contributed | 10.6.5; K-1 |

## COL- Colony phase

| id | ms | assertion | ref |
|---|---|---|---|
| COL-001 | M1 must | Colony steps run strictly: pay food, waste, crisis, add zombies, main check, round track, pass first player | 10.4.7–10.4.12a |
| COL-002 | M1 must | Food need = ceil(colony survivors incl. helpless / 2); survivors elsewhere do not count | 10.4.7 |
| COL-003 | M1 must | Food ≥ need → remove `need` food, no morale loss even with starvation tokens present | 10.4.7; GOLD-06 |
| COL-004 | M1 must | Food < need → remove none, add 1 starvation token, lose morale equal to starvation tokens now present | 10.4.7; GOLD-06 |
| COL-005 | M1 must | Starvation tokens persist across rounds unless a card removes them | 10.4.7; GOLD-06 |
| COL-006 | M1 must | Waste check loses floor(waste / 10) morale | 10.4.8 |
| COL-007 | M1 must | Main objective check runs only after zombies are added and only if the game has not ended | 10.4.11; 11 §6.3 |
| COL-008 | M1 must | Round track drops by 1 each colony phase; at 0 the game ends with no objective check | 10.4.12; 11 §8.1 |
| COL-009 | M1 must | The first-player token passes to `right(firstPlayer)` at the end of the colony phase | 10.4.12a; R-FIRSTPASS |
| COL-010 | M1 must | Colony zombies added = ceil(colony survivors incl. helpless / 2) | 10.8.6; GOLD-05 |
| COL-011 | M1 must | Each non-colony location adds zombies equal to survivors there, in board order, after the colony | 10.8.6 |
| COL-012 | M1 must | Noise: each token is removed and rolls a d6; ≤ 3 adds 1 zombie there; all noise is cleared | 10.8.6; 10.8.7 |
| COL-013 | M1 must | `checkGameEnd` runs after the colony adds, after each location, and after noise | 10.8.6; 11 §6.2 |
| COL-014 | M1 must | The engine exposes food needed and zombies to be added per location before the phase | 10.0.8 |

## ZOM- Zombies and overrun

| id | ms | assertion | ref |
|---|---|---|---|
| ZOM-001 | M1 must | Zombies are counted per entrance; an entrance space holds one zombie or one barricade, never both | 10.8.1; 10.2.4 |
| ZOM-002 | M1 must | Each colony `addZombies` call starts at entrance 1 and advances 1→6→1 after each zombie | 10.8.2; GOLD-05 |
| ZOM-003 | M1 must | Empty space → zombie placed | 10.8.3 |
| ZOM-004 | M1 must | No space but a barricade → 1 barricade removed, zombie discarded | 10.8.3; GOLD-05 |
| ZOM-005 | M1 must | No space and no barricade → overrun: zombie discarded, lowest-influence non-helpless survivor killed with cause `overrun` | 10.8.3; GOLD-05 |
| ZOM-006 | M1 must | Overrun with only helpless present kills 1 helpless token (−1 morale); with nobody present nothing happens | 10.8.3; 10.9.3 |
| ZOM-007 | M1 must | Zombies are added one at a time; each overrun resolves (including death and morale) before the next zombie | 10.8.3; 10.0.5 |
| ZOM-008 | M1 must | Every zombie placement goes through `addZombies`; Attract and setup never overrun | 10.0.5; 10.8.4 |
| ZOM-009 | M1 must | Noise tokens are only cleared in colony step 4; up to 4 per location | 10.8.7 |

## SURV- Survivors, wounds, death

| id | ms | assertion | ref |
|---|---|---|---|
| SURV-001 | M1 must | Each seat controls one leader plus followers; "lowest influence" never ties | 10.9.1 |
| SURV-002 | M1 must | An added survivor joins the colony (exiled: a non-colony location of the seat's choice) | 10.9.2 |
| SURV-003 | M1 must | Helpless tokens take no actions, have no controller and give no dice | 10.9.3 |
| SURV-004 | M1 must | Helpless count for food and colony zombie adds | 10.9.3; 10.4.7; 10.8.6 |
| SURV-005 | M1 must | Each helpless death costs 1 morale | 10.9.3; 10.9.6 |
| SURV-006 | M1 must | Exiled seats' effects never add helpless tokens | 10.9.3; 10.11.4 |
| SURV-007 | M1 must | Frostbite: at start of the owner's turn each survivor with ≥ 1 frostbite takes 1 wound, then the death check | 10.4.4; 10.7.3 |
| SURV-008 | M1 must | Card effects can remove wound and frostbite tokens | 10.9.4 |
| SURV-009 | M1 must | Killed leader with followers → `newLeader` decision for its seat | 10.9.5 |
| SURV-010 | M1 must | `killSurvivor` removes the survivor and its wound tokens | 10.9.6 |
| SURV-011 | M1 must | Equipped items of a killed survivor: at the colony → controller's hand; elsewhere → shuffled into that location deck | 10.9.6 |
| SURV-012 | M1 must | Death costs 1 morale, except cause `removed` or an exiled controller | 10.9.6 |
| SURV-013 | M1 must | A seat losing its last survivor discards its hand to waste and draws a new leader at the colony | 10.9.6 |
| SURV-014 | M1 must | Exiled seat losing its last survivor: hand leaves the game, new leader goes to a non-colony location of its choice | 10.9.6; 10.11.4 |
| SURV-015 | M1 must | `killSurvivor` emits `survivorKilled` and then `checkGameEnd` | 10.9.6 |
| SURV-016 | M1 must | All deaths, whatever the cause, run through `killSurvivor` | 10.0.5; 10.9.6 |
| SURV-017 | M8 should | Variant `playerElimination`: a seat losing its last survivor is out instead of drawing | 10.14.5 |

## OBJ- Objectives

| id | ms | assertion | ref |
|---|---|---|---|
| OBJ-001 | M1 must | Setup applies morale, rounds and zombies of the chosen side | 11 §2.2; 10.3.1; GOLD-07 |
| OBJ-002 | M2 must | We Need More Samples: each killed zombie rolls 1 d6; 4–6 → sample, 1–3 → back to pool | 11 §3.4; GOLD-08 |
| OBJ-003 | M2 must | Barricade breaks, overruns, Attract and "remove" effects never roll for samples | 11 §3.6 |
| OBJ-004 | M1 must | The main objective completes only at colony step 5, never mid-round | 11 §2.4; 10.4.11; GOLD-08 |
| OBJ-005 | M1 must | Morale 0 skips the main check and secret predicates see `mainObjectiveComplete = false` | 11 §6.1a; 11 §6.5; GOLD-08 |
| OBJ-006 | M1 must | Round track 0 likewise skips the main check; `mainObjectiveComplete = false` | 11 §6.1b; 11 §6.5; GOLD-10 |
| OBJ-007 | M1 must | Multiple winners and zero winners are both possible | 11 §6.4; 10.13.2; GOLD-09 |
| OBJ-008 | M1 must | After exile the exiled card's condition replaces the seat's winning condition | 11 §7.3; 10.11.2 |
| OBJ-009 | M1 must | Two-exile rule: ≥ 2 exiled seats and none holds a betrayal objective → morale 0 | 11 §7.6; 10.11.5; GOLD-11 |
| OBJ-010 | M1 must | Every objective is hidden in every other seat's view until `GameEnded` | 11 §4.5; 10.0.6 |
| OBJ-011 | M1 must | Objective conditions are DSL predicates or registered hooks; ids follow `main./secret./betrayal./exiled.` | 11 §1.1; 11 §1.2; 11 §4.2 |
| OBJ-012 | M2 must | One roll per zombie: an effect killing 2 zombies rolls twice | 11 §3.5 |
| OBJ-013 | M2 must | Exposure resolves before the sample roll | 11 §3.7 |
| OBJ-014 | M2 must | Samples are permanent and never count as board zombies | 11 §3.8; 11 §3.9 |
| OBJ-015 | M2 must | Completion threshold = 3 x `startingPlayers` (12 at 4 seats) on both sides | 11 §3.10 |
| OBJ-016 | M2 must | WNMS normal: morale 6, rounds 6, 1 zombie per non-colony location; hardcore: 6, 5, 3 each | 11 §3.1; 11 §3.2; GOLD-07 |
| OBJ-017 | M2 must | A successful sample emits `ObjectiveProgress`; every sample d6 emits public `DieRolled{purpose:'sample'}` | 11 §3.11 |
| OBJ-018 | M2 must | The view exposes samples, target and pSample = 1/2 for the main objective | 11 §1.3; 11 §3.12 |
| OBJ-019 | M1 must | A secret objective's main-objective clause is explicit in data, never implied | 11 §4.1 |
| OBJ-020 | M2 must | Outsider cards count as item cards for hand-count predicates | 11 §4.3 |
| OBJ-021 | M1 must | Hand-based predicates read the hand at game end, not cards played earlier | 11 §6.6 |
| OBJ-022 | M1 must | Betrayal objectives may require `gameEndedBy = 'morale'`; a betrayer can win when the colony fails | 11 §5.1 |
| OBJ-023 | M1 must | Exiled seats' kills still roll for samples | 11 §7.5 |
| OBJ-024 | M1 must | Exiled objective `condition` may reference `original` / `originalPrivate`; generic fallback = `originalPrivate` | 11 §7.2; 11 §7.4 |
| OBJ-025 | M1 must | The engine exposes `roundsLeft` and `morale` publicly; morale changes only through rule events | 11 §8.2; 11 §8.3 |
| OBJ-026 | M1 should | Talk claims about objectives never change engine state | 11 §4.6 |
| OBJ-027 | M3 should | First release ships WNMS plus 3 betrayal objectives of distinct patterns | 11 §2.5; 11 §3.3; 11 §5.2; 11 §5.3 |
| OBJ-028 | M1 must | Main objective record carries setup, progress, hooks, complete and time fields | 11 §2.1 |

## EXIL- Exile

| id | ms | assertion | ref |
|---|---|---|---|
| EXIL-001 | M1 must | A successful vote exiles the target; an exiled seat is never a legal vote target | 10.11.1; 11 §7.7 |
| EXIL-002 | M1 must | The exiled seat draws 1 exiled objective before moving its colony survivors | 11 §7.1 |
| EXIL-003 | M1 must | A betrayer's winning condition is unchanged by exile | 10.11.2; 11 §7.3; GOLD-11 |
| EXIL-004 | M1 must | Every colony survivor of the exiled seat moves to a non-colony location of its choice with a free space, rolling exposure each, without using its move | 10.11.3 |
| EXIL-005 | M1 must | Exiled seat loses: crisis contribution, food-token dice, voting, colony entry | 10.11.4; GOLD-11 |
| EXIL-006 | M1 must | Exiled seat keeps: request, give, attack, search, call votes, play food cards | 10.11.4 |
| EXIL-007 | M1 must | An exiled seat's food card offers food tokens or +1 to dice per card | 10.11.4; R-EXILEFOOD |
| EXIL-008 | M1 must | New survivors of an exiled seat go to a non-colony location | 10.11.4; 10.9.2 |
| EXIL-009 | M1 must | Exiled survivors' deaths cost no morale | 10.11.4; 10.9.6 |
| EXIL-010 | M1 must | Two exiled non-betrayers → morale 0 and `GameEnded{cause:'morale'}` at once | 10.11.5; 11 §6.1d; GOLD-11 |
| EXIL-011 | M1 must | Two exiled seats with a betrayer among them → no morale change; rechecked on every later exile | 11 §7.6; GOLD-11 |
| EXIL-012 | M1 must | No free non-colony space: the exiled seat picks a non-exiled survivor to move to the colony (no move, no exposure), then places its survivor | 10.11.6 |
| EXIL-013 | M1 must | `players` for crisis thresholds excludes exiled seats from the moment of exile | 10.4.15 |

## VOTE- Voting

| id | ms | assertion | ref |
|---|---|---|---|
| VOTE-001 | M1 must | The active seat (exiled or not) may call at most one exile vote per turn | 10.12.1; 10.6.7 |
| VOTE-002 | M1 must | The vote target must be a non-exiled seat | 10.12.1 |
| VOTE-003 | M1 must | One `PendingDecision{seat:'all', kind:'vote'}` collects every non-exiled seat's vote, caller and target included | 10.12.3 |
| VOTE-004 | M1 must | Exiled seats cannot vote | 10.12.3; 10.11.4 |
| VOTE-005 | M1 must | More yes than no → exile; more no → nothing | 10.12.4 |
| VOTE-006 | M1 must | Tie → outcome equals the first player's vote | 10.12.5; 10.0.4; GOLD-11 |
| VOTE-007 | M1 must | Tie with an exiled first player → `voteTiebreak` decision for the first player | 10.12.5; R-VOTETIE |
| VOTE-008 | M1 must | Votes are revealed publicly only after resolution | 10.12.6 |
| VOTE-009 | M1 must | Table talk before a vote adds no decision | 10.12.2 |
| VOTE-010 | M8 should | `coop`/`twoPlayer`: the vote action is never legal | 10.14.1 |

## END- Ending and winning

| id | ms | assertion | ref |
|---|---|---|---|
| END-001 | M1 must | Morale ≤ 0 at any moment ends the game immediately; the rest of the step does not resolve | 10.13.1; 11 §6.2 |
| END-002 | M1 must | Round track reaching 0 ends the game | 10.13.1; 10.4.12; GOLD-10 |
| END-003 | M1 must | Main objective complete at step 5 ends the game with cause `main` | 10.13.1; 11 §6.1c; GOLD-08 |
| END-004 | M1 must | A card or objective that says the game ends ends it | 10.13.1 |
| END-005 | M1 must | Each seat wins iff its current objective (exiled or betrayal as applicable) holds at that moment | 10.13.2; 11 §6.4 |
| END-006 | M1 must | Non-betrayal secret objectives with the main clause fail unless cause = `main` | 10.13.2; 11 §6.5 |
| END-007 | M1 must | `GameEnded` carries cause, round, morale and per-seat results | 11 §6.7 |
| END-008 | M1 must | Step 5 runs only if steps 1–4 did not end the game; step 6 only if step 5 did not | 11 §6.3 |
| END-009 | M1 must | After `GameEnded` there is no open decision and no legal action | 10.13.1 |
| END-010 | M8 should | Co-op: every seat wins iff cause = `main` | 11 §6.8 |
| END-011 | M1 must | End recap includes every secret objective, every contribution by seat and crisis, every Crossroads drawn and whether it triggered, every vote | 10.13.3 |

## VIEW- Hidden information

Every VIEW line also runs as the sim leak test on every game (B.4; 60.4).

| id | ms | assertion | ref |
|---|---|---|---|
| VIEW-001 | M1 must | Deciders receive only `view(state, seatId)`; no decider is ever handed `GameState` | 10.0.6 |
| VIEW-002 | M1 must | Another seat's hand appears only as a count; none of its card ids appear in the serialized view | 10.0.6 |
| VIEW-003 | M1 must | Another seat's secret objective id never appears in the serialized view before `GameEnded` | 10.0.6; 11 §4.5 |
| VIEW-004 | M1 must | Face-down crisis contributions appear only as a count (per seat and total); card ids never appear before reveal | 10.0.6; 10.4.13 |
| VIEW-005 | M1 must | After resolution the view shows symbol counts, not which seat gave which card, until the recap | 10.4.16 |
| VIEW-006 | M1 must | A held Crossroads card is visible only to its holder until it triggers | 10.0.6; 10.10.1 |
| VIEW-007 | M1 must | No deck order (crisis, survivor, Crossroads, location, exiled objectives) appears in any view; only counts | 10.0.6 |
| VIEW-008 | M1 must | Search draws and the discarded-to-bottom cards are visible only to the searching seat | 10.5.3 |
| VIEW-009 | M1 must | The card taken by a survivor attack is visible only to attacker and victim seats | 10.5.2 |
| VIEW-010 | M1 must | During setup no view shows another seat's dealt or kept survivors before all seats have chosen | 10.3.7 |
| VIEW-011 | M1 must | A pending vote shows no other seat's ballot until all votes are cast | 10.12.3 |
| VIEW-012 | M1 must | `isBetrayal` of any other seat's objective is absent from the view, exiled seats included | 11 §5.4; 11 §7.8; K-2 |
| VIEW-013 | M1 must | An exiled seat's drawn exiled objective is visible only to that seat | 11 §7.1 |
| VIEW-014 | M1 must | The boxed (undealt) secret objectives and returned setup survivors never appear in any view | 10.3.2; 10.3.7 |
| VIEW-015 | M1 must | A card given via request is revealed to all views | 10.6.5 |
| VIEW-016 | M1 must | `GameEnded` reveals every seat's objective(s) to all views | 11 §6.7; 10.13.3 |
| VIEW-017 | M1 must | Each seat's view is deterministic: same state → same serialization | 10.0.6 |
| VIEW-018 | M1 must | Events delivered to a seat are filtered the same way as its view (no hidden id in a `CardDrawn` for another seat) | 10.0.6 |

---

## Coverage

| prefix | count |
|---|---|
| SETUP | 26 |
| DICE | 9 |
| ACT | 21 |
| ATK | 11 |
| SRCH | 7 |
| MOVE | 7 |
| EXPO | 12 |
| CARD | 12 |
| XRD | 10 |
| CRIS | 13 |
| COL | 14 |
| ZOM | 9 |
| SURV | 17 |
| OBJ | 28 |
| EXIL | 13 |
| VOTE | 10 |
| END | 11 |
| VIEW | 18 |
| **total** | **248** |

Clause coverage: every numbered clause of `10` (10.0.1–10.15) and every section of `11` (§1–§8) is
cited by at least one line above. 10.15 (decision kinds) is covered by the lines that name each
decision; 11 §9 is this file.

## Rulings

RULING: K-1 requested cards and the crisis | CRIS-013 and ACT-015 test that a given card is never contributable | Mirrors 10 Rulings (R-REQUEST); Unsourced
RULING: K-2 exiled betrayer status in views | VIEW-012 asserts `isBetrayal` stays hidden; the engine applies the two-exile rule itself, so no public reveal is needed. 10.11.2 ("becomes public") conflicts with 11 §5.4 / §7.8; this checklist follows 11 until the spec review settles it | rulespal.com/dead-of-winter/rulebook (read 2026-10-10): exile text mentions no reveal and says secret objectives may not be shown; Fan-source
RULING: K-3 exile objective for a betrayer | EXIL-003 tests only that the betrayal condition is unchanged, not whether an exiled card is drawn (10.11.2 says keeps; 11 §7.1 says draws) | Outcome identical for scoring; Unsourced
