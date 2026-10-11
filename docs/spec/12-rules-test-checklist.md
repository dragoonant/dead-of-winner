# 12 Rules test checklist

One line per case: setup → expected result. IDs are stable; never renumber, only append; a retired ID stays
in its table marked *retired*. Engine tests are named by ID (`it('EXPO-004 ...')`, B.4) and coverage is the
set of IDs that appear in test names. `Ref` points at the rulebook (`R p<n>`), the FAQ (`F <n.n.n>`) or
`00-architecture.md` (`00 §<n>`); `(unsourced)` marks a case that rests on our own ruling, listed at the end.
Every case was checked against R and F on 2026-10-09.

Conventions: dice are seeded, so "d6 shows 4" means the roll produced 4. The exposure die is given as its raw
d12 value with the face it maps to under `EXPOSURE_FACES` (raw 1–6 blank, 7–9 wound, 10–11 frostbite, 12 bite;
`rng.ts`). Seats are `s1..s4` clockwise unless stated; `s1` holds the first-player token; survivors are the
real ones with the stats in `sources/survivors-sources.md` (Ashley Ross atk 2+ / srch 5+ / inf 52, Mike Cho 2+ /
4+ / 30, Forest Plum 2+ / 5+ / 14, Sparky 2+ / 2+ / 10, Brian Lee 3+ / 4+ / 68, Olivia Brown 4+ / 3+ / 56).
Location capacities come from the fixture (`capacity` is copied from data at setup, 00 §3), so a case that
says "entrance space count 2" builds that capacity itself and does not depend on the unverified board counts.
Rejections name the `RejectionCode` the engine must return (00 §14) and never change state (00 §2).

## SETUP

| ID | Case | Ref |
|---|---|---|
| SETUP-001 | `createGame` with 1 seat or 6 seats → `E_BAD_SETUP`; 2..5 seats → accepted, `GameCreated` | R p2, 00 §2 |
| SETUP-002 | *We Need More Samples*, normal side → morale 6, round track 6, 1 zombie at each of the six non-colony locations, colony entrances empty | R p6 |
| SETUP-003 | Same objective, `variants.hardcore` → round track 5, 3 zombies per non-colony location (added one at a time, overrun rules apply) | R p15, brief G.3 |
| SETUP-004 | Secret objectives at 4 seats: the pool is 8 standard + 1 betrayal, each seat gets exactly 1, the 5 left over are never in play; `SecretObjectiveDealt` is emitted once per seat with `kind` matching the card | R p6 |
| SETUP-005 | 1,000 seeded 4-seat games → a betrayer is dealt in 44 % ± 2 % of them (4/9) | R p6, brief E.3 |
| SETUP-006 | `variants.betrayer` → pool is 4 standard + 1 betrayal; betrayer present in 80 % ± 2 % of 1,000 seeded games | R p15 |
| SETUP-007 | Each seat is dealt 5 starting items (`StartingItemsDealt`); the 25-card starter deck minus the dealt cards never enters any zone | R p6 |
| SETUP-008 | `variants.twoPlayer` → 7 starting items each and `chooseSurvivors` requires exactly 3 of the 4 offered; `coop` rules apply (no secret objectives, `callVote` → `E_FORBIDDEN`) | R p15 |
| SETUP-009 | Each seat is offered 4 survivors (`SurvivorsDealt`, private); `chooseSurvivors {keep}` with 1 or 3 ids → `E_BAD_PAYLOAD`; with an id not in `me.offered` → `E_NOT_AN_OPTION` | R p6 |
| SETUP-010 | After every seat has chosen, the 8 returned survivors are back in `survivorDeck`, which is reshuffled on the seeded stream, and no returned id is in `state.survivors` | R p6, 00 §16 |
| SETUP-011 | `chooseLeader` with a survivor the seat did not keep → `E_NOT_LEADER_CANDIDATE`; a kept one → `LeaderChosen {reason:'setup'}` and the other becomes a follower | R p6 |
| SETUP-012 | All kept survivors start at `colony`; the colony's survivor spaces hold them (fixture capacity 8 at 4 seats) | R p6 |
| SETUP-013 | Leaders Olivia Brown (56), Ashley Ross (52), Brian Lee (68), Sparky (10) at s1..s4 → `FirstSeatSet {seat:'s3', influence:68}`, `firstSeat = 's3'`, round 1 turn order s3, s4, s1, s2 | R p6 |
| SETUP-014 | `variants.coop` → `secretObjectiveId` null on every seat, main objective on the hardcore side, Annaleigh Chan and Gray Beard are not in the survivor deck | R p15, sources |
| SETUP-015 | `variants.removeMature` → no Crossroads card with `mature: true` is in `crossroads.deck`; without the flag they are | R p6 |
| SETUP-016 | The first `pending` after setup completes is `turnAction` for `firstSeat`, preceded by `RoundStarted {roundNumber:1}`, `CrisisRevealed`, one `ActionDiceRolled` per seat with 3 dice each, `TurnStarted`, and `CrossroadsDrawn {holder: seat to the right of firstSeat}` | R p8, 00 §5 |
| SETUP-017 | Setup emits exactly one `DeckShuffled {reason:'setup'}` per non-colony location (6 at the base board), none for `colony`, all on the seeded stream: two games with one seed have identical location deck orders | R p6, 00 §11 |
| SETUP-018 | `variants.coop` → no Crossroads card with `coop:false` is in `crossroads.deck` and no item card with the non-co-op mark is in any location deck; without the flag they are; `twoPlayer` implies the same removal | R p15 |
| SETUP-019 | `setup.mainObjective = 'random'` → `objective.id` is one of the bundle's 10 main objectives, drawn on the seeded stream (same seed → same objective), and `GameCreated.objectiveId` names it | R p6, brief E.3 |

## DICE

| ID | Case | Ref |
|---|---|---|
| DICE-001 | Round start: a seat with 2 survivors rolls 3 dice; with 3 survivors, 4; last round's dice (used or not) are gone first | R p8 |
| DICE-002 | A survivor added mid-round (SURV-006) gives no extra die until the next roll step; that roll then counts it | R p14 |
| DICE-003 | Dice are the seat's: both dice `s1:d1` and `s1:d2` may be spent on Ashley Ross in one turn | R p8 |
| DICE-004 | Attack with Olivia Brown (4+) using a die showing 3 → `E_DIE_TOO_LOW`; showing 4 → accepted and `DieSpent {need:4}` | R p9 |
| DICE-005 | Spending a die already marked used → `E_DIE_USED`; a `dieId` not owned by the seat → `E_NO_DIE` | R p8 |
| DICE-006 | `spendFood {dieId, tokens:2}` on an unused die showing 3 with food 5 → die 5, `DieBoosted {from:3,to:5,source:'food'}`, `FoodChanged {delta:-2}` | R p11 |
| DICE-007 | `spendFood` with tokens that would push the die past 6 (die 5, tokens 2) → `E_DIE_MAX`; die at 6, tokens 1 → `E_DIE_MAX` | F 5.3.1 |
| DICE-008 | `spendFood` on a used die → `E_DIE_USED`; with no unused die at all, `legalActions` offers no `spendFood` | F 5.3.1 |
| DICE-009 | `spendFood` with food 0 → `E_NO_FOOD`; tokens 0 → `E_BAD_PAYLOAD` | R p11 |
| DICE-010 | Brian Lee's ability on an unused die showing 2 → 3, `DieBoosted {source:'ability'}`, `AbilityUsed {usesThisRound:1}`; a second use the same round → `E_ABILITY_USED` | R p7 |
| DICE-011 | Brian Lee's ability in round 2 after a use in round 1 → allowed (`abilityUses` resets at the roll step) | R p7 |
| DICE-012 | Daniel Smith `(4+)` with a die showing 4 → 2 zombies at his location killed, one `ExposureRolled`; a second use the same turn with another 4+ die → allowed (no printed round limit) | R p7, R p10, sources C2 |
| DICE-013 | Loretta Clay's ability with a die showing 4 → +2 food; with a 3 → `E_DIE_TOO_LOW` | F 1.2.1 |
| DICE-014 | Barricade, clean waste and attract accept a die of any value, including 1 | R p9–10 |
| DICE-016 | Exiled seat `playCard` on a Food card → pending `effectChoice` with `context.data.code = 'exiledFoodCard'` listing `effect` (the printed food) and one `die:<dieId>` per unused die below 6; answering `die:s2:d1` on a die showing 3 → `DieBoosted {from:3, to:4, source:'item'}` and NO `FoodChanged`; answering `effect` → `FoodChanged {delta:+1, reason:'card'}`; `CardPlayed {to:'removed'}` either way; `DieAdded {source:'exiledFood'}` is never emitted; `spendFood` → `E_EXILED` | R p14, F 5.4.4 (RULING R20.12, Corrected) |
| DICE-017 | DICE-016 with every unused die at 6 → the only option is `effect` and the choice is auto-resolved (`DecisionAutoResolved {kind:'effectChoice'}`); with no unused die at all → same | R p14, 00 §2 |

## ACT (turn structure and generic action validation)

| ID | Case | Ref |
|---|---|---|
| ACT-001 | An action whose `decisionId` is not `pending.id` → `E_WRONG_DECISION`; whose `seat` is not `pending.seat` → `E_NOT_YOUR_DECISION` | 00 §5 |
| ACT-002 | A rejected action returns the SAME `state` reference, `events = [ActionRejected]`, the same `pending` | 00 §2 |
| ACT-003 | `legalActions` on every open decision in a 200-game seeded sim is non-empty and every member passes `validate` | 00 §5 |
| ACT-004 | `turnAction` always lists `endTurn`; `pass` on a `turnAction` → `E_NOT_AN_OPTION` (`canPass` false) | 00 §5 |
| ACT-005 | Turn order in round 1 is `firstSeat` then clockwise; `TurnStarted` per seat; after the last seat's `endTurn`, `PhaseChanged {phase:'colony'}` | R p8 |
| ACT-006 | A seat acting with a survivor it does not control → `E_NOT_YOUR_SURVIVOR`; with a dead survivor → `E_SURVIVOR_DEAD` | R p8 |
| ACT-007 | `endTurn` by a non-exiled seat that has not been asked → `crisisContribution` is raised first (`contributionAsked` true); `contributeCrisis {cardIds:[]}` then ends the turn | R p11, 00 §16 |
| ACT-008 | `endTurn` by an exiled seat → no `crisisContribution` prompt; `TurnEnded` at once | R p14 |
| ACT-009 | An action after `phase === 'ended'` → `E_GAME_OVER`; `ack` is the only legal action | 00 §5 |
| ACT-010 | A survivor can attack, search and attack again in one turn with three qualifying dice; `turn.actions` counts 3 | R p9 |
| ACT-011 | Frostbite tick: at `TurnStarted` for s1, each s1 survivor with ≥1 frostbite takes exactly 1 extra wound (`FrostbiteTicked`, `WoundTaken {source:'frostbiteTick'}`), one per survivor not per token; other seats' survivors are untouched | R p11 |
| ACT-012 | Frostbite tick that gives a third wound → the survivor dies before any action is offered (`SurvivorKilled {cause:'wounds'}`) | R p11, R p14 |
| ACT-013 | Replay of a 4-seat random-bot game's `save()` reproduces the final state byte for byte; a save with another `dataVersion` → `E_DATA_VERSION` | 00 §12 |
| ACT-014 | s2 exiled during round 1 → round 2 still emits `TurnStarted {seat:'s2'}` in clockwise order and s2 gets a `turnAction`; an eliminated seat (SURV-005) gets neither | R p8, R p14 |

## ATK (attacks)

| ID | Case | Ref |
|---|---|---|
| ATK-001 | Ashley Ross (2+) at the school, die 4, zombie at the school entrance → `AttackDeclared {need:2}`, `DieSpent`, `ZombieKilled {zombies:0}`, then `ExposureRolled {reason:'zombieKill'}` | R p9 |
| ATK-002 | ATK-001 with exposure raw 7 → `WoundTaken {kind:'wound', wounds:1}` (the printed example) | R p9 |
| ATK-003 | Attack a zombie at a location the attacker is not at → `E_WRONG_LOCATION`; at an entrance holding 0 zombies → `E_NO_ZOMBIE` | R p9 |
| ATK-004 | Attacking at the colony: the target names an entrance; a zombie at entrance 5 is killed while entrance 1 keeps its zombie | R p13 |
| ATK-005 | Ashley Ross (s1) attacks Mike Cho (s2, atk 2+) at the school, die 3 spent, the spent die is re-rolled and shows 1 → `SurvivorAttacked {roll:1, targetAttack:2, hit:true}`, `WoundTaken {source:'attack'}` on Mike, `CardStolen` (one random s2 card to s1), NO `ExposureRolled` | R p9 |
| ATK-006 | ATK-005 with the re-roll showing 3 → `hit:false`, no wound, no steal | R p9 |
| ATK-007 | The attack-a-survivor roll is a fresh `DiceRolled {purpose:'attackSurvivor'}`, not the spent die's face (die 3 spent, roll shows 1) | R p9 |
| ATK-008 | Hit on a target whose controller's hand is empty → wound applied, no `CardStolen` (unsourced) | R p9 |
| ATK-009 | Hit that is the target's third wound → `SurvivorKilled {cause:'wounds'}`, `MoraleChanged {delta:-1}`, and the steal still happens from the controller's hand (unsourced on order: wound, kill, steal) | R p9, R p14 |
| ATK-010 | Attacking your own survivor → `E_OWN_SURVIVOR`; attacking a helpless token → `E_HELPLESS_TARGET` (there is no survivor id for one) | R p9 |
| ATK-011 | Attacking a survivor at another location → `E_WRONG_LOCATION`; a dead one → `E_SURVIVOR_DEAD` | R p9 |
| ATK-012 | Mike Cho kills a zombie → `ExposureSkipped {sourceId: Mike's ability}` and no `ExposureRolled`; Mike attacking a survivor → nothing exposure-related either way | R p9 |
| ATK-013 | `query.attackSurvivorOdds` vs Mike Cho (2+) → `pHit 1/3`; vs Olivia Brown (4+) → `2/3`; `stealsCard` true iff the target seat's `handCount > 0` | R p9, 00 §10 |
| ATK-014 | Zombie kill at the school with *We Need More Samples*: d6 shows 4 → `ObjectiveProgress {counter:'samples', delta:1}`; shows 3 → no progress; Daniel Smith's 2-zombie ability → 2 objective rolls | R p6 |
| ATK-015 | Lighter equipped on Ashley Ross, a Fuel card in hand: attack with the Lighter's once-per-round use → 4 zombies killed (fewer if fewer exist), Fuel to waste, NO exposure roll; the Fuel's own move effect does not fire | R p10 |
| ATK-016 | ATK-015 twice in one round → the second use `E_ABILITY_USED`; a plain attack with Ashley still works | R p10 |
| ATK-017 | Edward White's ability: spends the attack die AND a 1+ die plus a medicine-symbol card → 3 zombies, no exposure; with only one die → `E_NO_DIE` | F 1.3.1, F 1.3.2 |

## SRCH (searching)

| ID | Case | Ref |
|---|---|---|
| SRCH-001 | Forest Plum (5+) at the gas station, die 5, deck top Lighter → `SearchStarted {need:5}`, `SearchDrawn {Lighter}` (private), pending `searchKeepOrNoise` | R p10 |
| SRCH-002 | SRCH-001 then `makeNoise` → `NoiseAdded {after:1, by:'search'}`, `SearchDrawn {Fuel}`, pending `searchKeepOrNoise` again (noise 1 of 4) | R p10 |
| SRCH-003 | SRCH-002 then `keepCard {Fuel}` → `SearchKept {returned:1}`, Fuel in s1's hand, Lighter at the BOTTOM of the gas station deck, `state.search` null, pending `turnAction` | R p10 |
| SRCH-004 | `keepCard` with a card id that was not drawn → `E_NOT_AN_OPTION` | R p10 |
| SRCH-005 | Searching at the colony → `E_WRONG_LOCATION`; search with Forest and a die showing 4 → `E_DIE_TOO_LOW` | R p9–10 |
| SRCH-006 | Location already holding 4 noise: the first draw raises `searchKeepWhich`-style forced keep (`DecisionAutoResolved` when 1 card) and `makeNoise` → `E_NO_NOISE_SPACE` | R p5, R p10 |
| SRCH-007 | Noise 3 then `makeNoise` → noise 4 and the next decision is `searchKeepWhich` (no more noise possible) listing both drawn cards | R p10 |
| SRCH-008 | Returned cards go under the deck in draw order (drawn A, B, C, keep B → bottom = A then C) (unsourced on order among returned cards) | R p10 |
| SRCH-009 | Deck empty at search start → `E_DECK_EMPTY`; deck runs out after the first draw → `makeNoise` is not offered and the card is kept automatically (unsourced) | R p10 |
| SRCH-010 | Two searches with the same survivor in one turn with two 5+ dice → both resolve; noise accumulates (2 noise after one `makeNoise` each) | R p10 |
| SRCH-011 | Alexis Grey at the library: once per round the search keeps 2 of the drawn cards (`extraSearchKeep`); at the school → normal keep 1 | sources, R p7 |
| SRCH-012 | Jenny Clark: the first draw of a search reveals 4 cards (`extraSearchLook` 3), keep 1; `makeNoise` afterwards draws 1 more | F 1.1.2 |
| SRCH-013 | John Price at the hospital with Janet Taylor and Jenny Clark → looks at 4 extra cards and keeps 2 in one search | F 1.1.2 |
| SRCH-014 | Another seat's view during s1's open search shows `search.drawnCount` and no card ids; s1's view lists `me.searchDrawn` | 00 §4 |
| SRCH-015 | Alexis Grey (s1) has spent her once-per-round keep-2 at the library; John Price (s2) at the library searches the same round → he still keeps 2 (his copy is a separate instance with its own `abilityUses`); John's second library search that round → keep 1 | F 1.1.3, 10 R11.6 |

## MOVE

| ID | Case | Ref |
|---|---|---|
| MOVE-001 | Move Ashley Ross colony → school (empty space) → `SurvivorMoved {kind:'action'}`, `movedThisTurn` true, then `ExposureRolled {reason:'move'}` | R p11 |
| MOVE-002 | A second `move` of the same survivor in one turn → `E_ALREADY_MOVED`; next turn it is allowed again | R p11 |
| MOVE-003 | Move to a location with no empty survivor space (fixture capacity 1, occupied) → `E_NO_SPACE` | R p11 |
| MOVE-004 | Move to the location the survivor is already at → `E_TARGET_INVALID` (unsourced) | R p11 |
| MOVE-005 | Rod Miller moves → `ExposureSkipped` and no roll; a Fuel card played with the move → same, Fuel to waste | F 1.1.1, R p10 |
| MOVE-006 | Move with exposure raw 12 (bite) → Ashley dies at the DESTINATION and the bite spreads among survivors there, not at the origin | R p11 |
| MOVE-007 | Survivor dies on the move's exposure roll → no `action.move` window: a held Crossroads card with a move trigger does not fire | F 2.1.1 |
| MOVE-008 | `query.moveTargets` lists every location with an empty space, its zombie count and the survivor's exposure odds; the current location is excluded | 00 §10 |
| MOVE-009 | Blizzard failed last colony phase → `move` by a non-exiled seat → `E_FORBIDDEN` until the end of the next round; an exiled seat may still move | R p4, brief G.5 |
| MOVE-010 | Exiled seat (placement already done) moves a survivor to the colony → rejected `E_TARGET_INVALID`, and absent from `legalActions` / `moveTargets` (CORRECTED 2026-10-10; digest Exile "Can exiled survivors move back to the colony? No") | digest, Exile |
| MOVE-011 | John Price moves away from Rod Miller → still no exposure on that move; arrives next to Harman Brooks and rolls raw 10 → frostbite (copies start after arrival) | F 1.1.1 |

## EXPO (exposure, wounds, bites)

| ID | Case | Ref |
|---|---|---|
| EXPO-001 | `exposureFaceOf`: 1..6 blank, 7..9 wound, 10..11 frostbite, 12 bite; 12,000 seeded rolls hit 6/3/2/1 of 12 within 5σ | R p11, 00 §11 (fan-source counts) |
| EXPO-002 | Raw 3 → `ExposureRolled {face:'blank'}` and nothing else | R p11 |
| EXPO-003 | Raw 8 on a survivor with 0 wounds → `WoundTaken {wounds:1, frostbite:0}` | R p11 |
| EXPO-004 | Raw 10 → `WoundTaken {kind:'frostbite', frostbite:1}`; a frostbite counts toward the 3-wound kill (2 wounds + 1 frostbite → dead) | R p11, R p14 |
| EXPO-005 | Raw 12 on Ashley Ross at the school with Mike Cho (30) and Forest Plum (14) there → `SurvivorKilled {cause:'bite'}`, `MoraleChanged -1`, `BiteSpreadStep {toId: Forest Plum}` (lowest influence), pending `biteSpreadOption` for Forest's seat | R p11 |
| EXPO-006 | EXPO-005, `biteSpread {choice:'kill'}` → `BiteChoiceMade`, `SurvivorKilled {cause:'biteChoice'}`, `MoraleChanged -1`, `BiteChainEnded {reason:'killChoice', killed:[Forest]}`; Mike is untouched | R p11 |
| EXPO-007 | EXPO-005, `choice:'roll'`, raw 2 → `ExposureRolled {reason:'biteChain', face:'blank'}`, Forest lives, `BiteChainEnded {reason:'blank'}` | R p11 |
| EXPO-008 | EXPO-005, `choice:'roll'`, raw 8 (wound face) → Forest is KILLED (any non-blank kills), `BiteSpreadStep {toId: Mike Cho}`, pending for Mike's seat | R p11 |
| EXPO-009 | Chain reaches the last survivor at the location who chooses `roll` and gets raw 12 → killed, `BiteChainEnded {reason:'noSurvivors'}` | R p11 |
| EXPO-010 | Bite with no other survivor at the location → `SurvivorKilled`, `BiteChainEnded {reason:'noSurvivors', killed:[]}` without a `biteSpreadOption` | R p11 |
| EXPO-011 | Sparky rolls raw 12 → `ExposureFaceChanged {from:'bite', to:'wound'}` then `WoundTaken`; a bite spreading at Sparky's location skips him and goes to the next-lowest influence (fan-source on the skip) | F 1.1.1, sources |
| EXPO-012 | Harman Brooks rolls raw 10 → `ExposureFaceChanged {from:'frostbite', to:'wound'}`, `WoundTaken {kind:'wound'}` | F 1.1.1 |
| EXPO-013 | Buddy Davis with 3 wounds is alive (`fourWoundsToDie`); a 4th kills him. John Price sharing Buddy's location at 3 wounds lives; when Buddy moves away John dies at once (unsourced timing: at the end of Buddy's move) | F 1.1.5 |
| EXPO-014 | Olivia Brown removes a frostbite token from Forest Plum at her location → `WoundHealed {kind:'frostbite'}`; on herself → allowed; on a survivor elsewhere → `E_ABILITY_LOCATION` | R p7 |
| EXPO-015 | A Medicine card played after the third wound is applied → `E_CARD_NOT_PLAYABLE` (the survivor is already dead); played at 2 wounds → `WoundHealed` | R p15 |
| EXPO-016 | `query.exposureOdds` for Sparky → `bite 0, wound 4/12`; for Harman → `frostbite 0, wound 5/12`; for Rod Miller with reason `'move'` → all 0; `pDeath` for a 2-wound survivor = P(wound)+P(frostbite)+P(bite) | 00 §10 |

## CARD (items, hand, requests, hand-offs)

| ID | Case | Ref |
|---|---|---|
| CARD-001 | `playCard` of a Food card (+1 food) from hand → `CardPlayed {to:'waste'}`, `FoodChanged {delta:+1, reason:'card'}`, card on top of `waste` | R p10 |
| CARD-002 | `playCard` with an id not in hand → `E_NOT_IN_HAND`; on another seat's turn → `E_NOT_YOUR_DECISION` | R p10 |
| CARD-003 | Lighter (Equip) played with `equipTo: Ashley` → `CardPlayed {to:'equipped'}`, `CardEquipped`, card in `survivors[Ashley].equipped`, NOT in waste; without `equipTo` → `E_BAD_PAYLOAD` | R p10 |
| CARD-004 | `handOff` Lighter from Ashley (s1) to Mike Cho (s2's survivor) at the same location → `CardHandedOff`, the Lighter is in `survivors[Mike].equipped`; to one of s1's own survivors there → same; to a survivor elsewhere → `E_WRONG_LOCATION`; `cardId` equipped on another seat's survivor → `E_NOT_YOUR_SURVIVOR`; a card in hand, not equipped → `E_NOT_EQUIPPED` | R p11 |
| CARD-005 | Lighter's once-per-round use spent by Ashley, then handed to Mike → Mike's use this round → `E_ABILITY_USED` (uses travel with the card) | R p11 |
| CARD-006 | Ashley dies at the colony with Lighter equipped → `EquippedReturned {to:'hand'}`, Lighter in her seat's hand | R p10 |
| CARD-007 | Ashley dies at the gas station with Lighter equipped → `EquippedReturned {to:'deck'}`, `DeckShuffled {reason:'equippedReturned'}`, Lighter somewhere in that deck | R p10 |
| CARD-008 | `request {to:'s2', symbol:'medicine'}` → `RequestMade`, pending `requestResponse` for s2; `respondRequest {give:null}` → `RequestAnswered {cardId:null}`; the requester's turn continues | R p11 |
| CARD-009 | s2 gives a Medicine card → `CardGiven` (public, names the card), the card is played at once for s1 (`CardPlayed`, its effect or an `itemTarget`), it never enters s1's hand | R p11, F 5.2.1 |
| CARD-010 | A given card used to pay Edward White's ability → allowed | F 1.3.3 |
| CARD-011 | A given card named in `contributeCrisis` → `E_REQUESTED_CARD` (it is already played) | R p11 (unsourced vs F 3.1.2) |
| CARD-012 | `respondRequest {give}` with a card not in the responder's hand → `E_NOT_IN_HAND`; requesting from yourself → `E_SELF_TARGET` | R p11 |
| CARD-013 | Exiled seat may `request` and may give on a request | F 5.4.2 |
| CARD-014 | A Survivor item card played with the colony's survivor spaces full → `E_NO_SPACE`; with a space → `SurvivorAdded {source:'item'}` at the colony | R p14 |
| CARD-015 | An exiled seat plays a Survivor item → pending `effectChoice` with `context.data.code = 'exiledSurvivorPlacement'` listing the non-colony locations with an empty space (the same decision as EXIL-010 and ZOM-010, never `itemTarget`); the survivor is added there (`SurvivorAdded {source:'item'}`), a placement with no exposure roll | R p14 |
| CARD-016 | An exiled seat plays any card → `CardPlayed {to:'removed'}`, nothing enters `waste` | R p14 |
| CARD-017 | A Food card that adds 3 food is one card for crisis scoring (+1 or −1), and `FoodChanged {delta:+3}` when played | R p11 |
| CARD-018 | Gray Beard's ability takes a random card from s2 (`CardStolen`); in `coop` the ability is absent | sources |
| CARD-019 | Annaleigh Chan peeks one random card per other seat → the peeked ids reach only her seat's redacted feed (no public event carries them); other seats' views are unchanged | sources, 00 §4 |

## XRD (Crossroads)

| ID | Case | Ref |
|---|---|---|
| XRD-001 | At `TurnStarted` for s2, `CrossroadsDrawn {holder:'s1', forSeat:'s2'}` (s1 is to s2's right); `crossroads.held.cardId` is in s1's `me.crossroadsHeld` only | R p12 |
| XRD-002 | The trigger is checked after each resolved action; Hunted (trigger: a non-frostbite wound from a move's exposure) fires after `move` with raw 8 → `CrossroadsTriggered {window:'action.move'}` then pending `crossroadsOption` for s2 | R p4, R p12 |
| XRD-003 | Hunted after a move with raw 10 (frostbite) → does not fire; after a move with raw 2 → does not fire | R p4 |
| XRD-004 | Untriggered card at `TurnEnded` → `CrossroadsReturned`, card at the BOTTOM of the deck; the log entry has `triggered:false` and its `cardId` is null in every view until the recap | R p12, 00 §4 |
| XRD-005 | `chooseCrossroadsOption {optionId}` → `CrossroadsResolved`, the option's effects apply, the card goes to `removed` (never back in the deck), log `triggered:true` | R p12 |
| XRD-006 | Option 1 impossible (it needs a survivor the seat lacks) → only option 2 offered; choosing it → `CrossroadsResolved {forced:true}`; sending option 1 → `E_NOT_AN_OPTION` | R p12 |
| XRD-007 | A card whose trigger is a search result fires after `SearchKept`, not after `SearchDrawn` | R p12, F 2.1.1 |
| XRD-008 | A Crossroads option that would add a survivor with the colony full → that option is not offered (`forced`) | R p14 |
| XRD-009 | A Crossroads that searches a deck for a card → `DeckShuffled {reason:'card'}` for that deck afterwards | R p12 |
| XRD-010 | A Crossroads with `vote:true` option → `votes` decision for every non-exiled seat (Outbreak: only seats with a survivor at the colony) | R p15, F 2.4.1 |
| XRD-011 | Old Divisions thumbs-up → the current contributions go to `removed` without reveal (`CardDiscarded {to:'removed'}`, no `CrisisCardRevealed`) | F 2.3.1 |
| XRD-012 | Bev Russell's card option 1: Bev counts as a survivor for the school's zombie step; on an overrun there she cannot be the victim, the next-lowest influence dies | F 2.2.1 |
| XRD-013 | The held card fires at most once per resolved action; two actions in a turn that both match → it fires on the first and is gone | R p12, 00 §9 |
| XRD-014 | The seat to the right of an exiled or eliminated active seat still draws; a 2-seat game: each seat draws for the other | R p12 (unsourced for eliminated) |
| XRD-015 | Both options impossible (option 1 adds a survivor to a full colony, option 2 needs a survivor the seat lacks) → `CrossroadsTriggered`, no `crossroadsOption` decision, `CrossroadsResolved {forced:true, optionId:''}` with no effect events, the card in `removed`, log `triggered:true` (unsourced: R20.10) | R p12, R p14 |

## CRIS (crisis contributions and resolution)

| ID | Case | Ref |
|---|---|---|
| CRIS-001 | `contributeCrisis {cardIds:[Fuel from hand]}` → `CardContributed {from:'hand'}` (card id private), `crisis.contributions` has `{seat:'s1'}`; other views show `contributionsBySeat.s1 = 1` and no id | R p11, 00 §4 |
| CRIS-002 | Contributing an equipped Lighter → `CardContributed {from:'equipped'}`, the survivor loses it | R p11 |
| CRIS-003 | Contributing a card id neither in hand nor equipped → `E_NOT_IN_HAND`; by an exiled seat → `E_EXILED` | R p14 |
| CRIS-004 | Fuel Shortage at 3 non-exiled seats, contributions 3 Fuel + 1 Lighter (weapon) → four `CrisisCardRevealed` with `points` +1,+1,+1,−1 in shuffled order, `CrisisResolved {total:2, needed:3, prevented:false}`, `CrisisEffectApplied {kind:'fail'}`, `MoraleChanged {delta:-2, reason:'crisisFailed'}` | R p12 |
| CRIS-005 | CRIS-004 with 3 Fuel only → `total 3 ≥ 3`, prevented, no effect, no bonus | R p12 |
| CRIS-006 | 5 Fuel at 3 seats → `total 5 ≥ needed+2`, `bonus:true`, `MoraleChanged {delta:+1, reason:'crisisBonus'}` | R p12 |
| CRIS-007 | 4 Fuel at 3 seats → prevented, `bonus:false` (needs needed+2) | R p12 |
| CRIS-008 | No contributions → `total 0`, not prevented, fail effect applies | R p12 |
| CRIS-009 | `needed` counts non-exiled, non-eliminated seats: 4 seats with one exiled → `needed 3` | R p12 |
| CRIS-010 | After resolution every contributed card is in `removed` (`CardDiscarded {to:'removed'}`), never in `waste`; `crisis.contributions` is empty | R p12 |
| CRIS-011 | `CrisisCardRevealed` never carries a seat; `view.crisis.result.revealed[].seat` is null for other seats' cards and set for the viewer's own; the recap lists every contributor | 00 §4 |
| CRIS-012 | `query.crisis` for s1 who put in 1 Fuel and 1 Weapon while s2 put in 2 cards → `myPoints 0, minTotal −2, maxTotal 2, needed 4, bonusAt 6` | 00 §10 |
| CRIS-013 | Blizzard fails → `EffectApplied {sourceId:'cr.blizzard', name:'cr.blizzard#0'}` (the `forbid` node is index 0 of `fail`, 21 §7) forbidding `move` for non-exiled seats until the end of the next round, `MoraleChanged -1`; the effect expires at that round's end (`EffectExpired {reason:'duration'}`) | R p4, 00 §3, 21 §7 |
| CRIS-014 | A second Blizzard failure while the first is active → the single effect refreshes to the LATER expiry (`EffectApplied {refreshed:true}`), never two effects | 00 §3 |

## COL (colony phase order and steps)

| ID | Case | Ref |
|---|---|---|
| COL-001 | Colony steps run in order `payFood checkWaste resolveCrisis addZombies checkObjective roundTick passToken`, each announced by `PhaseChanged {phase:'colony', step}` | R p12–13 |
| COL-002 | 5 survivors + 2 helpless at the colony, 2 survivors away, food 4 → `FoodPaid {needed:4, survivors:7, foodAfter:0}` (ceil(7/2)); the two away survivors do not count | R p12 |
| COL-003 | 13 colony survivors, food 5 → `Starvation {needed:7, supply:5, starvationAfter:1, moraleLoss:1}`, food stays 5, morale −1 | F 6.1.1 |
| COL-004 | Next round 15 survivors, food 8 → `FoodPaid {needed:8, foodAfter:0}`, no morale loss although a starvation token is in play | F 6.1.1 |
| COL-005 | Round after, 15 survivors, food 2 → `Starvation {starvationAfter:2, moraleLoss:2}` | F 6.1.1 |
| COL-006 | Starvation tokens never leave by themselves; a card effect removing one → `starvation` decreases | F 6.1.1 |
| COL-007 | 0 colony survivors and 0 helpless → `FoodPaid {needed:0}`; 1 survivor → needed 1 | R p12 |
| COL-008 | Waste 9 cards → `WasteChecked {moraleLoss:0}`; 10 → 1; 20 → 2; 29 → 2 | R p12 |
| COL-009 | Clean waste with 3+ waste cards → the top 3 go to `removed` (`WasteCleaned`); with 2 → both; with Brandon Kane's ability → 5; survivor not at the colony → `E_WRONG_LOCATION` | R p10, sources |
| COL-010 | Colony with 7 survivors + 1 helpless → `ZombiesToAdd {location:'colony', count:4}`; 8 → 4; 9 → 5 | R p12 |
| COL-011 | Gas station with 3 survivors → `ZombiesToAdd {count:3}`; empty location → no zombie | R p12 |
| COL-012 | Zombie step order: colony, then non-colony locations in `locationOrder`, then noise per location in order; a `MoraleChanged` from kills is checked after each block and morale 0 ends the game mid-step | F 6.2.1 |
| COL-013 | Noise 2 at the school, d6 shows 3 then 4 → `NoiseRolled {die:3, zombie:true}`, `ZombieAdded`, `NoiseRolled {die:4, zombie:false}`, `NoiseCleared {count:2}`, noise 0 | R p12 |
| COL-014 | Noise rolls only use `purpose:'noise'`; a 1, 2 or 3 adds, a 4, 5 or 6 does not | R p12 |
| COL-015 | `checkObjective` with the main objective complete → `ObjectiveChecked {complete:true}`, `GameEnded {reason:'objectiveComplete'}`; no `RoundTicked` | R p13 |
| COL-016 | `roundTick` from 1 → `RoundTicked {roundsLeft:0}`, `GameEnded {reason:'roundsOut'}`; the objective is NOT re-checked at that moment even if complete (unsourced edge: it was checked one step earlier) | R p13 |
| COL-017 | `passToken` → `FirstSeatPassed {from:'s1', to:'s4'}` (to the right), `RoundStarted {roundNumber:2}`, new crisis, new dice | R p13 |
| COL-018 | Starvation morale loss, waste loss and crisis fail each emit their own `MoraleChanged` with the right `reason`; morale never goes below 0 | R p12 |
| COL-019 | `query.foodNeeded` with 7 mouths, food 2, starvation 1 → `{needed:4, shortfall:2, moraleLossIfShort:2}` | 00 §10 |
| COL-020 | Morale at the track maximum (the printed value in the board data, **verify**) and a crisis bonus → `morale` stays at the maximum, `MoraleChanged {delta:0, after:max, reason:'crisisBonus'}` (the delta is the clamped change; unsourced on emitting a zero-delta event); morale 1 short of the maximum and +2 from a card → `delta:+1` | R p5, R p14 |

## ZOM (zombies, barricades, overruns, attract)

| ID | Case | Ref |
|---|---|---|
| ZOM-001 | 7 zombies to the colony with all entrances empty (capacity 3) → `ZombieAdded` at entrances 1,2,3,4,5,6,1 in that order; entrance 1 ends with 2 | R p13 |
| ZOM-002 | Same with entrance 3 full (3 zombies, no barricade) and Sparky (10) among the colony survivors → the third add is `EntranceOverrun {entrance:3, killed:Sparky}`, `SurvivorKilled {cause:'overrun'}`, `MoraleChanged -1`; adds 4..7 continue at 4,5,6,1 | R p13 |
| ZOM-003 | Entrance full but holding a barricade → `BarricadeDestroyed {barricades:n-1}` and NO zombie placed, no kill | R p13 |
| ZOM-004 | Overrun with only helpless tokens at the colony → `HelplessKilled {count:1, moraleLoss:true}`, `MoraleChanged -1` | R p13–14 |
| ZOM-005 | Overrun with no survivor and no helpless at the colony → `EntranceOverrun {killed:null}`, nothing else | R p13 |
| ZOM-006 | Overrun at the colony kills the lowest influence across ALL seats' survivors there, not the active seat's | R p13 |
| ZOM-007 | Non-colony location (1 entrance, capacity 3): 4 zombies to add with 2 already there → 1 placed, then overrun → lowest-influence survivor there dies, then overrun again (3rd) and 4th | R p13 |
| ZOM-008 | Overrun victim is an exiled seat's survivor → `SurvivorKilled {moraleLoss:false}`, no `MoraleChanged` | R p14 |
| ZOM-009 | Overrun kills a seat's last survivor mid-step → `HandDiscarded`, `SurvivorAdded {source:'lastSurvivor'}` at the colony, `LeaderChosen`, then the zombie step continues | F 6.2.1 |
| ZOM-010 | ZOM-009 for an exiled seat → `effectChoice` (`context.data.code = 'exiledSurvivorPlacement'`) asks for a non-colony location with an empty space, which may be one whose zombie step has not happened yet; the newcomer is placed with no exposure roll | F 6.2.1 |
| ZOM-011 | `barricade {entrance:2}` with an empty space there → `BarricadeAdded {barricades:1}`; with the entrance full of zombies+barricades → `E_NO_SPACE`; at a non-colony location `entrance` must be 1 | R p9 |
| ZOM-012 | A barricade occupies a space: capacity 3 with 1 barricade accepts 2 more zombies before the 3rd add destroys the barricade | R p13 |
| ZOM-013 | `attract {from:[{school,1,count:1},{library,1,count:1}]}` by a survivor at the colony with 2 empty entrance spaces → two `ZombieMoved`; the action names no destination entrance, so the engine fills the survivor's location's empty spaces in entrance order (unsourced on which entrance) | R p10 |
| ZOM-014 | Attract into a location with 1 empty space → only 1 zombie moves (unsourced); with 0 → `E_NO_SPACE`; never destroys a barricade, never overruns | F 5.1.1 |
| ZOM-015 | Attract `from` naming more zombies than an entrance holds → `E_NO_ZOMBIE`; `count` total > 2 → `E_BAD_PAYLOAD` | R p10 |
| ZOM-016 | Attract with only 1 zombie on the whole board → moves that 1 (00 §16 ruling); with 0 → `E_NO_ZOMBIE` | 00 §16 |
| ZOM-017 | Killing a colony zombie at entrance 4 leaves other entrances unchanged; the 31st zombie is still tracked (token overflow is a count, never a cap) | R p13 |
| ZOM-018 | Ashley Ross's free barricade: `useAbility` without a die → `BarricadeAdded`, `AbilityUsed`; twice in a round → `E_ABILITY_USED`; a paid `barricade` afterwards still works | R p9 |

## SURV (survivors, leaders, helpless)

| ID | Case | Ref |
|---|---|---|
| SURV-001 | Third wound on Ashley (2 wounds, raw 8) → `SurvivorKilled {cause:'wounds', wasLeader:false}`, `MoraleChanged {delta:-1, reason:'survivorKilled'}`, `status:'dead'`, `owner:null`, removed from `seats.s1.survivors` and from the location's spaces | R p14 |
| SURV-002 | Leader killed with 2 followers left → pending `newLeader` for the owner; `chooseLeader` with a follower → `LeaderChosen {reason:'replacement'}`; with a dead or foreign survivor → `E_NOT_LEADER_CANDIDATE` | R p14 |
| SURV-003 | Leader killed with exactly 1 follower → `DecisionAutoResolved {kind:'newLeader'}`, `LeaderChosen` | R p14, 00 §2 |
| SURV-004 | Last survivor killed → `HandDiscarded {reason:'lastSurvivor'}` (every hand card to `removed`), `SurvivorAdded {source:'lastSurvivor', location:'colony'}` from the top of the survivor deck, `LeaderChosen {reason:'newSurvivor'}` | R p14 |
| SURV-005 | SURV-004 with `variants.playerElimination` → `SeatEliminated`, no new survivor; the seat is skipped in turn order and excluded from `needed` and votes | R p14, brief E.9 |
| SURV-006 | A survivor added on s1's turn (item) may act this turn (an attack with an existing die works) and yields no die until the next roll step | R p14 |
| SURV-007 | A card effect that REMOVES a survivor (Forest Plum's ability) → `SurvivorRemoved`, `status:'removed'`, NO `MoraleChanged` from the removal; Forest's ability then gives `MoraleChanged {delta:+1, reason:'ability'}` | R p10, R p14 |
| SURV-008 | Forest Plum's ability outside the start of your turn → `E_FORBIDDEN`; at `turn.start` → allowed; John Price sharing Forest's location may use it too | R p10, F 1.1.4 |
| SURV-009 | Helpless tokens: `HelplessAdded {after:3}`; they count for food (COL-002) and colony zombies (COL-010), never move and are not attack targets | R p12–13 |
| SURV-010 | Adding a helpless token with the colony's survivor spaces full → not added (effect is skipped, `forced` option on a Crossroads) | R p14 |
| SURV-011 | An exiled seat directed to add helpless tokens → none added | R p14 |
| SURV-012 | Last survivor killed with `survivorDeck` empty and `variants.playerElimination` off → `HandDiscarded {reason:'lastSurvivor'}`, `SeatEliminated`, no `SurvivorAdded`; the seat is skipped in turn order and excluded from `needed` and from votes (unsourced: R20.9) | R p14, R p15 |

## OBJ (main and secret objectives)

| ID | Case | Ref |
|---|---|---|
| OBJ-001 | *We Need More Samples* at 4 starting seats → `counters.samples` needs 12; `ObjectiveComplete {seat:null}` only when ≥ 12 | R p6 |
| OBJ-002 | Samples reach 12 during s3's turn → nothing ends yet; the game ends at colony step 5 of that round (`GameEnded {reason:'objectiveComplete'}`) | R p13 |
| OBJ-003 | Morale hits 0 during the player turns with the main objective's condition already met but not yet checked → `GameEnded {reason:'moraleZero', objectiveComplete:false}` (`GameEnded.objectiveComplete` is `objective.complete`, the flag only colony step 5 sets), `ObjectiveChecked` is not emitted, and a `requiresMain` secret objective with its private part met still loses | R p14, 11 O3.3 |
| OBJ-004 | A standard secret objective (`requiresMain`) with its private condition met but the main objective incomplete → the seat loses; both met → wins | R p14, brief G.4 |
| OBJ-005 | A betrayal objective met at `moraleZero` → that seat wins while every standard-objective seat loses; `winners` lists exactly the met seats | R p14 |
| OBJ-006 | `query.objectiveProgress(view)` for s1 reports s1's secret objective parts and the main objective; asking for s2's secret objective id before the end throws (the view holds no data for it, so no number can be built from hidden information) | 00 §10 |
| OBJ-007 | *Find a Cure* (ASSUMED values, sources): contributing a Medicine card to the objective → `ObjectiveProgress`; a non-Medicine card → `E_CARD_NOT_PLAYABLE`; an exiled seat may contribute | F 4.1.1, F 5.4.3 |
| OBJ-008 | A secret objective needing 3 item cards in hand (`handAtLeast 3`) with 2 items and 1 Outsider card → met; the Outsider counts as an item card (a symbol-based condition counts it only if it carries the symbol) | F 3.1.1, 11 O3.2 |

## EXIL (exile)

| ID | Case | Ref |
|---|---|---|
| EXIL-001 | Vote exiles s2 → `SeatExiled {seat:'s2'}` with an exiled objective drawn (`exiledObjectiveId` set, private), `seats.s2.seat.exiled` true, pending `exilePlacement` for s2 | R p14 |
| EXIL-002 | `placeExiled` must name every s2 survivor at the colony with a non-colony destination; a colony destination → `E_TARGET_INVALID`; a missing survivor → `E_BAD_PAYLOAD` | R p14 |
| EXIL-003 | Placement moves roll exposure (`SurvivorMoved {kind:'exile'}` then `ExposureRolled {reason:'move'}` each) and do not set `movedThisTurn` | R p14 |
| EXIL-004 | Every non-colony location full → `SurvivorBumped` moves a non-exiled survivor back to the colony with no exposure and no move flag, then the exile is placed there | F 5.4.1 |
| EXIL-005 | Exiled seat: `contributeCrisis` → `E_EXILED`; `castVotes` ballot includes `s2` → `E_BAD_PAYLOAD`; `spendFood` → `E_EXILED` | R p14 |
| EXIL-006 | Exiled seat's survivor killed → `SurvivorKilled {moraleLoss:false}`, no `MoraleChanged` | R p14 |
| EXIL-007 | Exiled seat may `callVote` against another seat and may contribute cards to the main objective; a Food card played for its printed food goes through the DICE-016 `effectChoice` (`code 'exiledFoodCard'`, answer `effect`) → `FoodChanged {delta:+1}` | F 5.4.3–5.4.5 |
| EXIL-008 | Second seat exiled, neither holding a betrayal objective → `MoraleChanged {reason:'doubleExile', after:0}`, `GameEnded {reason:'moraleZero'}` | R p14 |
| EXIL-009 | Second seat exiled where one of the two holds a betrayal objective → game continues | R p14 |
| EXIL-010 | Exiled seat's last survivor dies → the new survivor is placed at a non-colony location of its choice (`effectChoice`, `context.data.code = 'exiledSurvivorPlacement'`, as in CARD-015 and ZOM-010) | F 6.2.1 |
| EXIL-011 | Voting to exile an already-exiled seat → `E_TARGET_INVALID` (unsourced); in `coop` → `E_FORBIDDEN` | R p15 |
| EXIL-012 | `needed` for the crisis drops by one after an exile (CRIS-009); an exiled seat's survivors away from the colony count for location zombies as usual | R p12–14 |

## VOTE

| ID | Case | Ref |
|---|---|---|
| VOTE-001 | `callVote {target:'s3'}` → `VoteCalled`, pending `votes` with `seat:'all'`; `turn.voteCalled` true | R p11 |
| VOTE-002 | A second `callVote` in the same turn → `E_VOTE_USED`; targeting yourself → `E_SELF_TARGET` | R p11 |
| VOTE-003 | `castVotes` must carry one entry per eligible seat (non-exiled, non-eliminated), the target included; a missing or extra seat → `E_BAD_PAYLOAD` | R p11 |
| VOTE-004 | 4 seats, votes yes s1,s2 / no s3,s4 with `firstSeat = s1` → tie broken by s1's yes → `VoteResult {yes:2,no:2,exiled:true,tiebreakBy:'s1'}` | R p11 |
| VOTE-005 | Same split with s1 voting no → `exiled:false, tiebreakBy:'s1'`; 3 yes / 1 no → `exiled:true, tiebreakBy:null` | R p11 |
| VOTE-006 | 3 eligible seats (one exiled): 2 yes / 1 no → exiled; 1 yes / 2 no → not | R p14 |
| VOTE-007 | Tie when the first seat is exiled (cannot vote) → the vote fails (unsourced) | R p11 |
| VOTE-008 | `VotesCast` is public after the fact; before `castVotes` no view carries any ballot (the client collects them) | 00 §4 |
| VOTE-009 | `query.voteForecast(view,'s3')` at 4 seats → `eligible 4, needed 3 (or 2 with the first seat's yes), tiebreakBy 's1'` | 00 §10 |

## END (ending and winning)

| ID | Case | Ref |
|---|---|---|
| END-001 | Morale 1, a survivor dies → `MoraleChanged {after:0}`, `GameEnded {reason:'moraleZero'}`, `phase:'ended'`, pending `gameOver` | R p14 |
| END-002 | Round track 1 → colony `roundTick` → `GameEnded {reason:'roundsOut'}` | R p13 |
| END-003 | `GameEnded.winners` = seats whose secret (or exiled) objective is met at that moment; `seats[s].outcome` set for all; several winners and zero winners are both possible | R p14 |
| END-004 | In `coop` every seat wins iff the main objective completed; `roundsOut` → all lose | R p15 |
| END-005 | After `GameEnded`, `view(state, s)` carries `recap` with every secret objective, every hand, every Crossroads card drawn with `triggered`, and the contributors of every revealed crisis card | 00 §4 |
| END-006 | Morale 0 during the colony zombie step → the step stops: no further `ZombieAdded` after `GameEnded` | F 6.2.1 |
| END-007 | Morale 0 mid-bite-chain → the chain stops; `pending` is `gameOver`, not `biteSpreadOption` | R p14 |
| END-008 | A `concession` end (client-only) emits `GameEnded {reason:'concession'}` and still computes winners | 00 §3 (unsourced) |

## VIEW (hidden-information leaks)

Each case serialises `view(state, s)` with `serializeView` and asserts none of `hiddenIdsFor(state, s)` occurs in it;
the last column names the needle.

| ID | Case | Ref |
|---|---|---|
| VIEW-001 | After setup, s1's view contains none of s2..s4's hand card ids; `seats.s2.handCount` is 5 | 00 §4 |
| VIEW-002 | s1's view contains no other seat's `secretObjectiveId`; `hasSecretObjective` true for all | 00 §4 |
| VIEW-003 | During s2's `chooseSurvivors`, s1's view has `me.offered` for s1 only; s2's offered ids are absent | 00 §4 |
| VIEW-004 | After s2 contributes two cards, s1's view has `crisis.contributionCount 2`, `contributionsBySeat.s2 = 2`, no card ids; s2's `me.contributions` lists both | 00 §4 |
| VIEW-005 | During s2's turn the held Crossroads card id (drawn by s1) is absent from s2's, s3's and s4's views and present in s1's `me.crossroadsHeld` | 00 §4 |
| VIEW-006 | After an untriggered return, `crossroads.log[n].cardId` is null for every seat including the holder; after a trigger it is set for all | 00 §4 |
| VIEW-007 | During s2's open search, s1's view has `search.drawnCount` and none of the drawn ids; `cards` lacks them | 00 §4 |
| VIEW-008 | No view contains `log`; deck orders appear only as `deckCount`, `survivorDeckCount`, `crisisDeckCount`, `exiledObjectiveDeckCount` | 00 §4 |
| VIEW-009 | `cards` in s1's view lists exactly: s1's hand, every equipped card, waste, removed, objective cards, s1's contributions, s1's open search draws, revealed crisis cards; nothing from s2's hand or any deck | 00 §4 |
| VIEW-010 | `redactEvent(SearchDrawn for s2, 's1')` → null; `(CardContributed for s2, 's1')` → `cardId ''`; `(CrossroadsDrawn holder s1, 's2')` → `cardId ''`; `(SecretObjectiveDealt s2, 's1')` → null; `(CardStolen s2→s3, 's1')` → `cardId ''` | 00 §4 |
| VIEW-011 | `redactEvent(ObjectiveProgress {seat:'s2'}, 's1')` → null; with `seat:null` → unchanged; `ActionRejected` for s2's action → null for s1 | 00 §4 |
| VIEW-012 | After an exile, s1's view shows `hasExiledObjective` for s2 and not the id; `SeatExiled` redacted for s1 has `objectiveId ''` | 00 §4 |
| VIEW-013 | Leak sim: 200 seeded random-bot games, every seat's view serialised after EVERY step → zero needle hits | B.4 |
| VIEW-014 | `view(state,'s9')` throws; a bot decider receives only `SeatView` (type-level: `Decider.decide` takes no `GameState`) | 00 §13 |
| VIEW-015 | At `phase:'ended'`, `hiddenIdsFor` returns `[]` and `recap.hands` lists every seat's hand | 00 §4 |
| VIEW-016 | During a `votes` decision no view contains another seat's ballot; after `castVotes`, `vote.votes` is public in all views | 00 §4 |
| VIEW-017 | `query.crisis(view)` for s1 never reads other seats' contributed card ids: its `minTotal/maxTotal` spread equals the number of other seats' cards | 00 §10 |
| VIEW-018 | `redactEvent(DecisionAutoResolved {kind:'searchKeepWhich', seat:'s2', optionId:<card id>}, 's1')` → `optionId ''` (the auto-kept card is in s2's hand); for s2 → unchanged; for other kinds (`newLeader`) `optionId` stays | 00 §4 |
| VIEW-019 | `redactEvent(ActionRejected {action: castVotes {votes}}, s)` → null for EVERY seat (the ballots must not leak before `VotesCast`; the submitting client already has the rejection from `step`); a rejected `callVote` is redacted as any other action | 00 §4 |
| VIEW-020 | Leak sim `redactEvent` check: the needles are `hiddenIdsFor(state, s)` minus the ids the redacted event carries by design because they were public a moment earlier: `EquippedReturned.cardIds` (`to:'hand'`, the card was face up on the survivor) and `CardStolen.cardId` when `s` is `from` or `to`; with these exclusions a correct engine reports zero hits, and the view itself (not the event) must still hide those ids once they are in another hand | 00 §4, B.4 |

## RULE (precedence and ordering)

These run on the `golden-fixture` test bundle, which registers throwaway descriptors and code hooks so that no real
card's unverified text is asserted.

| ID | Case | Ref |
|---|---|---|
| RULE-001 | Card text beats this checklist: a fixture Crossroads option carrying `{code:'test.killNoMorale'}` kills a survivor → `SurvivorKilled {moraleLoss:false}` and no `MoraleChanged`, although R10.2 would take 1; the same kill by a plain `op:'killSurvivor'` node → `MoraleChanged -1` | R p15, 10 R19.1 |
| RULE-002 | Two effects on the same window from different sources (a fixture main objective's `zombie.killed` trigger and a fixture equipped item's `zombie.killed` trigger) fire on one kill → pending `effectChoice` with `context.data.code = 'orderSimultaneous'` for `firstSeat` (even when another seat is active) listing both orders; the chosen order is the event order; with a single source → `DecisionAutoResolved` and no prompt; a seat's own start-of-turn effects use the fixed R4.4 order and raise nothing | R p15, 10 R19.2 |
| RULE-003 | A fixture main objective whose `zombie.killed` trigger ends in `op:'endGame', value:'objectiveComplete'` → the op sets `objective.complete = true` first, then `GameEnded {reason:'objectiveComplete', objectiveComplete:true}` at that moment in the player turn (consistent with OBJ-003: the field is still `objective.complete`), `phase 'ended'`, `pending gameOver`, no `ObjectiveChecked`, no further `turnAction`; winners are computed as in END-003 | R p15, 10 R17.3, 11 O2.5 |

## Rulings behind the `(unsourced)` cases

Each becomes a `RULING:` line in `docs/needs-rules-check.md` via the orchestrator.

| Case | Ruling |
|---|---|
| ATK-008, ATK-009 | A hit always wounds; the steal happens only if the controller holds a card; wound, then death, then steal. |
| DICE-016, DICE-017, EXIL-007 | An exiled seat's food card is a per-card choice (`effectChoice`, code `exiledFoodCard`): the printed effect (F 5.4.4) or +1 on one unused die, max 6 (`DieBoosted {source:'item'}`). R p14's "rather than" and F 5.4.4's "yes" conflict, so this is Corrected, not Confirmed (10 R20.12 says so). `DieAdded {source:'exiledFood'}` is a contract member the engine never emits; `events.ts` should drop that source before the freeze. |
| SRCH-008, SRCH-009 | Returned cards go under the deck in draw order; an emptied deck ends the search with the cards drawn so far. |
| MOVE-004, MOVE-010 | Moving to the current location is invalid; an exiled seat's survivors may not move back to the colony (digest Exile; corrected 2026-10-10). |
| CARD-015, EXIL-010, ZOM-010 | Every exiled placement of a new survivor is one `effectChoice` with code `exiledSurvivorPlacement` (10 R10.5); `itemTarget` is never used for it. |
| XRD-015 | A Crossroads card with both options impossible is removed with no effect (10 R20.10). |
| SURV-012 | An empty survivor deck eliminates the seat as the player-elimination variant would (10 R20.9). |
| COL-020 | Morale is clamped at the printed track maximum; the clamped change is still reported through `MoraleChanged` (delta 0 at the cap). |
| VIEW-019, VIEW-020 | A rejected `castVotes` is hidden from every feed; the leak sim's event check excludes ids a public event legitimately carries the moment a face-up card enters a hand. |
| CARD-005 | Once-per-round uses of an equipped item are keyed by the card instance, so a hand-off carries the use. |
| CARD-011 | Requested cards cannot be contributed (already in `needs-rules-check.md`). |
| EXPO-013 | John Price loses Buddy's grant the moment either finishes a move away. |
| ZOM-013, ZOM-014, ZOM-016 | Attract fills the destination's empty entrance spaces in entrance order and moves as many as fit (0..2). |
| COL-016 | The round tick never re-checks the objective. |
| VOTE-007 | A tie with the first seat unable to vote fails the vote. |
| EXIL-011 | Voting against an exiled seat is invalid. |
| XRD-014 | The seat to the right still draws when the active seat's neighbour is exiled or eliminated. |
| END-008 | Concession is a client-side end reason that still computes winners. |
