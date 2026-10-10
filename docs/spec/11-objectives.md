# 11: Objectives

How the main, secret, betrayal and exiled objectives are represented, how progress is counted and exported, and when
each is checked. Rules references as in `10` (`R pN`, `F x.y.z`); rule ids `R3.3`, `R4.13`, `R17.5` etc. point there.
Card *values* below are copied from `sources/objectives-sources.md` (research 2026-10-10), which holds the per-source
tags and the conflict table; where sources disagree the chosen value is given here with its conflict id (O1–O14 for
the main objectives, D1–D4 for the exiled ones). The data records (spec `20`) cite that file, not this one. All
condition text is our own one-line summary of the mechanics, never the printed wording.

**First slice (M2/M3)**: the main objective *We Need More Samples* (both sides), the 13 standard secret objectives
whose condition is known and whose name is certain (O3.6, column "Slice"), and the 3 betrayal objectives with a known
condition (O4.3). Everything marked "(text unknown, M8)" waits for the M8 card pass.

## O1 One descriptor for every objective

`hooks.ts: ObjectiveDescriptor` (frozen):

| Field | Main | Secret | Betrayal | Exiled |
|---|---|---|---|---|
| `kind` | `'main'` | `'secret'` | `'betrayal'` | `'exiled'` |
| `requiresMain` | — | `true` on every card read so far (14 of 24) | `false` on the 3 known cards (they need morale 0 instead) | not-the-betrayer branch: `true` on 6 of the 10 cards (O5.6) |
| `betrayer.firstCondition` | — | — | — | the node that replaces condition 1 of the holder's betrayal card when the holder is the betrayer (O5.2) |
| `setup` | morale, round track, extra zombies (one list per side, O2.2) | — | — | — |
| `counters` | goals counted over time (`need: n` or `'perSeat'` × `perSeatMultiplier`) | rarely | rarely | rarely |
| `triggers` | hooks that move counters (`CardEffectDescriptor[]`) | — | — | — |
| `complete` | `ConditionNode` over counters and public state | `ConditionNode` over the owner's private and public state | same | same |

- Every objective has one data id (`obj.main.<slug>`, `obj.secret.<slug>`, `obj.betrayal.<slug>`, `obj.exiled.<slug>`).
  A main objective's two sides share the id; the engine reads the side from `objective.side` (R3.2).
- Checking is pure: `complete(state, seat | null)` is evaluated by `hooks.evaluateCondition`, or by a registered
  `CodeObjectiveHook` when the card needs arithmetic the DSL lacks (`{code}` node). Either way the result is
  `{complete, parts[{label, have, need}]}`; the parts are what the UI and the bots show (O5).
- Counters are plain names in `ObjectiveState.counters` (main) or in a seat-scoped effect's `data` (secret ones that
  count events). Convention: `samples`, `zombiesKilled`, `barricades`, `cards.<symbol>`, `survivorsAdded`; the data
  validator rejects a counter the card never reads.

## O2 The main objective (R p3, p6, p12, p15; F 4.1)

| Id | Rule | Ref |
|---|---|---|
| O2.1 | Exactly one main objective per game (`setup.mainObjective`, or `'random'` from the 10). `objective = {id, side, counters, cards, complete}` is public. | R p6 |
| O2.2 | `setup` runs inside `createGame` after seats are validated: `op:'morale'` sets the start value, `op:'roundTrack'` the start of `roundsLeft`, `op:'addZombies'` adds through R9 with source `'setup'` (location by location, in `locationOrder`). | R p6, R p13 |
| O2.3 | `triggers` bind to windows like any card (e.g. `zombie.killed`); their effects usually end in `op:'objectiveCounter'` → `ObjectiveProgress {seat:null, counter, delta, after, need}` (public). | R p6 |
| O2.4 | **Adding cards to the objective** (F 4.1.1): `playCard {cardId, data:{objective:true}}` on the player's own turn; legal only for a card whose symbol the objective requires (`E_CARD_NOT_PLAYABLE` otherwise), any number per turn unless the card limits it, exiled seats included (F 5.4.3). The card instance joins `objective.cards` (zone `objective`, face up, public); no `CardPlayed` is emitted; `ObjectiveProgress {counter:'cards.<symbol>'}` is. The card is not an item play: no effect, no waste, no Crossroads `action.playCard` trigger. | F 4.1.1, F 5.4.3; RULING O7.1. **Implemented (M4b) through the dedicated-action option**: `contributeObjective {cardId}` (a no-die turn action) emits `CardAddedToObjective {seat, cardId, defId, counter}` then `ObjectiveProgress`; a hand card counts only for a `contributions[]` entry of its symbol whose counter is below its need, and `excludeStarter` entries (Find a Cure, Leave It All Behind, Stockpile: "starting cards do not count") refuse cards marked `CardInstance.starter`. `playCard {data:{objective:true}}` is not accepted. |
| O2.5 | `complete` is evaluated at colony step 5 (`colony.objective`, `ObjectiveChecked`) and nowhere else, unless the card carries `op:'endGame'` in a trigger ("the game ends immediately"), which is card text beating the rulebook (R19.1). | R p12 |
| O2.6 | `'perSeat'` needs multiply by the number of seats that **started** the game (`setup.seats.length`), never the live count. | R p6 |
| O2.7 | On `coop` / `twoPlayer` / `hardcore` the hardcore side's `setup` and `complete` are used; the normal side otherwise. | R p15 |
| O2.8 | `query.objectiveProgress(view)` with no id returns the main objective's parts for any viewer. | 00 §10 |

### O2.9 The ten main objectives (all values from `sources/objectives-sources.md` §A)

`code` is the story section read at setup (R p16–17). "Other locations" = the six non-colony locations. Setup lines are
in addition to the standard setup unless they say *instead*. Where a value rests on a ruling, the conflict id from the
sources file follows it in brackets; the sources file names what each source printed.

| Id | `code` | Title | Side | Morale | Rounds | Setup | Goal (`complete`, our words) | Time | Sources / rulings |
|---|---|---|---|---|---|---|---|---|---|
| `obj.main.x-weeks-of-darkness` | M01 | Eight Weeks of Darkness | normal | 7 | 8 | 1 helpless token per seat at the colony; 1 zombie at each other location | survive 8 rounds | long | ES, BT, P |
| | | Ten Weeks of Darkness | hardcore | 6 | 10 | 1 helpless token per seat at the colony; 3 zombies at each other location | survive 10 rounds and end with `food ≥ 6` | long | Ph, BT, P (O13 Confirmed) |
| `obj.main.kill-them` | M02 | Kill Them | normal | 7 | 7 | 3 zombies at each other location. Exile change: a seat voted out is removed from the game with every survivor it controls, instead of R15 (trigger on `seat.exiled`, O12) | zombies at the other locations total ≤ 3 | medium | ES, BT, P |
| | | | hardcore | 5 | 5 | as normal, plus 12 zombies at the colony; same exile change | that total ≤ 1 and ≥ 1 barricade at every other location | medium | BT, P |
| `obj.main.find-a-cure` | M03 | Find a Cure | normal | 5 | 6 | none | `cards.medicine` ≥ 2 × starting seats via O2.4; starter Medicine cards may not be added | short | BT, P |
| | | | hardcore | 5 | 6 | *instead*: 12 zombies at the colony and 2 at each other location | `cards.medicine` ≥ 2 × starting seats [O1: BT prints 3; P over BT, Fan-source] | medium | BT, P |
| `obj.main.home-sweet-home` | M04 | Home Sweet Home | normal | 6 [O8] | 6 | 12 zombies at the colony and 1 at each other location | ≥ 10 barricades at the colony and ≥ 1 at each other location | medium | ES, BT, P |
| | | | hardcore | 5 [O5] | 5 [O5] | 18 zombies at the colony and 2 at each other location | ≥ 14 barricades at the colony and ≥ 1 at each other location | medium | BT, P (O5: BT lists no hardcore morale/round change; P over BT, Fan-source) |
| `obj.main.raiding-party` | M05 | Raiding Party | normal | 5 | 6 | 2 zombies at every location, the colony included [O9] | the item decks of 2 other locations are empty | short | ES, BT, P |
| | | | hardcore | 5 | 6 | *instead*: 12 zombies at the colony and 3 at each other location | 2–3 seats: 2 other decks empty; 4–5 seats: 3 (a `{code}` node, O2.10) | short | BT, P |
| `obj.main.leave-it-all-behind` | M06 | Leave It All Behind | normal | 6 | 5 [O2] | 12 zombies at the colony and 2 at each other location | every non-exiled seat has 1 Weapon card equipped per survivor it controls [O4], and `cards.food` ≥ 2 × starting seats (no starter Food) | short | BT, P (O2, O4: P over BT, Fan-source) |
| | | | hardcore | 5 | 5 | 12 zombies at the colony and 2 at each other location [O3] | the same weapon condition and `cards.food` ≥ 3 × starting seats | short | BT, P (O3: BT prints 3 zombies; P over BT, Fan-source) |
| `obj.main.stockpile` | M07 | Stockpile | normal | 6 | 6 | 18 zombies at the colony | `food ≥ 3` × live non-exiled seats [O6]; ≥ 1 barricade at every colony entrance; `cards.medicine ≥ 2`, `cards.tool ≥ 2` (any Tool-symbol card, O10), `cards.fuel ≥ 2`, starter cards excluded | medium | BT, P (O6: BT prints 2; P over BT, Fan-source) |
| | | | hardcore | 5 | 8 | 18 zombies at the colony | the same with `food ≥ 3` × live non-exiled seats | medium | BT, P |
| `obj.main.winter-has-come` | M08 | Winter Has Come | normal | 8 | 8 | 10 zombies at the colony and 1 at each other location | at the start of every colony phase one seat must add a Fuel card to the objective or the game ends with the objective failed [O14]; complete when `cards.fuel ≥ 8` at the objective check of round 8 | long | BT, P |
| | | | hardcore | 7 | 10 | 12 zombies at the colony and 2 at each other location | the same with `cards.fuel ≥ 10` at round 10 | long | BT, P |
| `obj.main.too-many-mouths` | M09 | Too Many Mouths | normal | 7 | 5 | helpless tokens at the colony = seats + 3; 6 zombies at the colony | survive 5 rounds | short | ES, BT, P |
| | | | hardcore | 7 | 6 | helpless tokens = seats + 5; 12 zombies at the colony | survive 6 rounds | medium | BT, P |
| `obj.main.we-need-more-samples` | M10 | We Need More Samples | normal | 6 | 6 | 1 zombie at each other location | counter `samples` ≥ 3 × starting seats; trigger `zombie.killed` → roll d6 (`purpose:'objective'`), 4+ → `samples += 1`. Every zombie killed by any attack, ability or card counts once (Daniel Smith's two kills = two rolls); zombies removed by attract or overrun are not kills (O11, O7.3) | short | R p6, ES, BT, P |
| | | | hardcore | 6 | 5 | 3 zombies at each other location | same goal, still 3 × starting seats [O7: BT and P print 4; the R p15 sample card prints 3 and outranks them, Corrected; revisit on a card photo] | short | R p15, BT, P |

Time ratings: short 45–90 min, medium 90–120, long 120–210 (R p3); stored as `time: 'short'|'medium'|'long'` for the
title screen only. "Survive N rounds" = the game reaches the objective check with the round track at the value that
makes it the Nth round and morale above 0 (BO). Only M10 (both sides, R) and the Ten Weeks of Darkness hardcore face
(photo) are official; every other value is fan-sourced (Spanish scans, the Portuguese sheet, the BGG transcription).
**First slice: `obj.main.we-need-more-samples` only** (both sides); the other nine enter at M8.

| Id | Rule | Ref |
|---|---|---|
| O2.10 | Goals the condition DSL cannot spell out take a `{code:'objective.<slug>.<name>'}` node or trigger (`21`, V-20): Raiding Party hardcore (the seat-count split), the empty-deck count for both Raiding Party sides, Winter Has Come's compulsory Fuel card at the start of the colony phase (a decision for the table, then `op:'endGame'` on refusal), Kill Them's exile change (a trigger on `seat.exiled` that removes the seat's survivors and eliminates the seat), and Stockpile's food need, which counts the **live** non-exiled seats, unlike `'perSeat'` (O2.6). | our reading of the sources |

## O3 Secret objectives (R p3, p6, p14)

| Id | Rule | Ref |
|---|---|---|
| O3.1 | Dealt per R3.3 (`SecretObjectiveDealt`, private); `seats[s].secretObjectiveId` is hidden from every other seat (`hasSecretObjective` only) until the recap. | R p6 |
| O3.2 | Shape: `requiresMain` + a private condition. The condition reads the owner's seat (`handHasSymbol`, `handAtLeast`, `survivorsAtLeast`, `equippedAtLeast`, `objectiveCounterAtLeast` on a seat-scoped counter…) and public state (`moraleAtLeast`, `barricadesAtLeast`, `foodAtLeast`…). Example, R p3: *Hunger* = main objective complete AND at least 3 cards with the food symbol in hand. Outsider cards count as item cards for these (F 3.1.1). | R p3, F 3.1.1 |
| O3.3 | Checked for the win only when the game ends (R17.5), whatever ended it; `requiresMain` reads `objective.complete`, which R4.13 set (so a morale-0 or rounds-out ending never satisfies it). | R p14 |
| O3.4 | Progress is live for the owner: `query.objectiveProgress(view)` returns the viewer's own objective's parts; `ObjectiveProgress {seat}` / `ObjectiveComplete {seat}` are private to that seat and feed the AI's planner (H.2) and the secret-objective panel (50). A bot never sees another seat's parts. | 00 §4, §10 |
| O3.5 | Hidden until `ended`; then `view.recap` lists every seat's objective id and outcome. | 00 §4 |
| O3.6 | 24 cards, listed below. Every known card requires the main objective (`requiresMain: true`) plus the listed private condition. Names are from the fan name list (N); 14 conditions are known (Spanish scans, one English photo, two from a non-English edition); "(text unknown, M8)" marks the rest. "Slice" = in the first slice. | `sources/objectives-sources.md` §B |

| Id | Name | Condition besides the main objective (our words) | Sources | Slice |
|---|---|---|---|---|
| `obj.secret.a-new-destination` | A New Destination | ≥ 3 Fuel cards in hand | ES, N | yes |
| `obj.secret.all-i-need-is-my-books` | All I Need Is My Books | (text unknown, M8) | N | no |
| `obj.secret.burn-it-all-down` | Burn It All Down | ≥ 4 barricades at the colony and ≥ 1 Fuel card in hand | ES, N | yes |
| `obj.secret.collector` | Collector | ≥ 4 item cards of any kind in hand | ES, J, N | yes |
| `obj.secret.desire-to-live` | Desire to Live | ≥ 1 each of Weapon, Food, Fuel and Medicine in hand | ES, N | yes |
| `obj.secret.experienced` | Experienced | (text unknown, M8) | N | no |
| `obj.secret.germ-a-phobe` | Germ-a-phobe | no survivor you control carries any wound token (frostbite included) | ES, N | yes |
| `obj.secret.historian` | Historian | ≥ 2 Education cards in hand | ES, N | yes |
| `obj.secret.hoarder` | Hoarder | (text unknown, M8) | N | no |
| `obj.secret.hope` | Hope | (text unknown, M8) | N | no |
| `obj.secret.hunger` | Hunger | ≥ 3 cards with the Food symbol in hand (symbols, not food value) | R p3, Ph, N | yes |
| `obj.secret.hypochondriac` | Hypochondriac | (text unknown, M8; see Junkie) | N | no |
| `obj.secret.junkie` | Junkie | probably: every card in hand is a Medicine card and there is at least 1. The Spanish scan (Farmaceutico) carries this text, and its mapping to Junkie rather than Hypochondriac is the scan reader's guess | ES (mapping unverified), N | no (name unverified) |
| `obj.secret.justice` | Justice | (text unknown, M8) | N | no |
| `obj.secret.leader` | Leader | you control more survivors than any other seat | ES, N | yes |
| `obj.secret.loner` | Loner | you control exactly 1 survivor | ES, N | yes |
| `obj.secret.masochist` | Masochist | one survivor you control carries ≥ 2 wound tokens of any kind | J, N | yes |
| `obj.secret.neat-freak` | Neat Freak | (text unknown, M8) | N | no |
| `obj.secret.protected` | Protected | (text unknown, M8) | N | no |
| `obj.secret.repopulate` | Repopulate | (text unknown, M8) | N | no |
| `obj.secret.revenge` | Revenge | ≥ 3 survivors have left the game dead or removed (helpless tokens do not count) | ES, N | yes |
| `obj.secret.safety` | Safety | (text unknown, M8) | N | no |
| `obj.secret.the-way-back-home` | The Way Back Home | ≥ 2 Fuel, ≥ 1 Food and ≥ 1 Weapon card in hand | ES, N | yes |
| `obj.secret.zombie-killing-robot` | Zombie Killing Robot! | ≥ 1 Weapon and ≥ 2 Tool cards in hand (the card's naming line has no effect) | ES, N | yes |

Counts: 24 ids, 14 conditions known, 10 unknown (9 named plus whichever of Junkie and Hypochondriac is not the
Farmaceutico card); 13 in the first slice, enough for the `2n` set-aside at 5 seats (R3.3). Hand counts count cards;
"Food symbol" conditions count symbols (BGG 1228611, cited in the research notes). "Left the game" = `status` `dead`
or `removed` (R10), which a seat-independent counter `survivorsLost` tracks.

## O4 Betrayal objectives (R p6, p15, p18–19)

| Id | Rule | Ref |
|---|---|---|
| O4.1 | Same descriptor with `kind:'betrayal'`; dealt as the single betrayal card mixed in at R3.3; the holder's `SecretObjectiveDealt.kind = 'betrayal'`. Whether a seat holds one is what R15.6 reads (two exiled seats, neither a betrayer → morale 0). | R p6, R p14 |
| O4.2 | Betrayal goals usually do **not** need the main objective (`requiresMain:false`) and often need the colony to fail (`moraleAtMost 0`, `starvationAtLeast`, `survivorsAtMost`…) plus a private hoard; they are the only objectives the bots' suspicion model reasons about (H.3–H.4). | R p15 |
| O4.3 | Ten cards, `code` S11–S20 = the story section a winning, un-exiled betrayer reads (R p18–19; the Spanish scans print the same ids). The 3 known cards each need morale 0 plus a private condition and never the main objective; their `complete` node is `{all:[moraleAtMost 0, ...]}` with the printed first condition first (O5.2 swaps it). The first slice ships those 3. | R p18–19; `sources/objectives-sources.md` §C |

| Id | `code` | Name | Condition (all parts, our words) | Sources | Slice |
|---|---|---|---|---|---|
| `obj.betrayal.gluttony` | S11 | Gluttony | (text unknown, M8) | N, R | no |
| `obj.betrayal.runaway` | S12 | Runaway | (text unknown, M8) | N, R | no |
| `obj.betrayal.take-over` | S13 | Take Over | (text unknown, M8) | N, R | no |
| `obj.betrayal.all-for-one` | S14 | All for One | (text unknown, M8) | N, R | no |
| `obj.betrayal.accept-your-fate` | S15 | Accept Your Fate | (text unknown, M8) | N, R | no |
| `obj.betrayal.trigger-happy` | S16 | Trigger Happy | 1. morale is 0; 2. the survivors you control carry ≥ 4 equipped Weapon cards between them | ES, N, R | yes |
| `obj.betrayal.cult-leader` | S17 | Cult Leader | 1. morale is 0; 2. you control at least 2 more survivors than any other seat | ES, N, R | yes |
| `obj.betrayal.serial-killers` | S18 | Serial Killers | 1. morale is 0; 2. ≥ 5 survivors have left the game (helpless tokens do not count); 3. you control ≥ 2 survivors | ES, N, R | yes |
| `obj.betrayal.mad-scientist` | S19 | Mad Scientist | (text unknown, M8) | N, R | no |
| `obj.betrayal.obsessed` | S20 | Obsessed | (text unknown, M8) | N, R | no |

`ai.lever` for the three known cards: Trigger Happy `hoard:weapon`, Cult Leader `custom` (grow the following), Serial
Killers `killSurvivors`; all three also want `moraleZero`, which `40 §7.1` reads from condition 1.
| O4.4 | Betrayer odds at setup (standard deal: `2n` standard + 1 betrayal, `n` dealt; `betrayer` variant: `n` + 1): | R p6, R p15 |

| Seats `n` | Standard `n/(2n+1)` | `betrayer` variant `n/(n+1)` | `coop` / `twoPlayer` |
|---|---|---|---|
| 2 | n/a (two-player is co-op) | n/a | 0 |
| 3 | 3/7 ≈ 42.9% | 3/4 = 75% | 0 |
| 4 | 4/9 ≈ 44.4% | 4/5 = 80% | 0 |
| 5 | 5/11 ≈ 45.5% | 5/6 ≈ 83.3% | 0 |

The engine does not bias the deal: `createGame` shuffles the set-aside cards with the seeded stream and deals in seat
order, so the table above is exact. `describe` may show the standard column on the title screen.

## O5 Exiled objectives (R p14; F 5.4)

| Id | Rule | Ref |
|---|---|---|
| O5.1 | On exile (R15.1) the seat draws the top card of `exiledObjectiveDeck` into `exiledObjectiveId` (`SeatExiled {objectiveId}`, private; `hasExiledObjective` for others). | R p14 |
| O5.2 | "Adjusts the secret objective": every exiled card prints two branches and the holder's dealt kind picks one. **Not the betrayer** (`SecretObjectiveDealt.kind === 'standard'`): the seat reveals its secret objective to the table, that card leaves the game, and the exiled card's own `requiresMain` + `complete` become the seat's whole win condition. **The betrayer** (`kind === 'betrayal'`): nothing is revealed; the seat keeps its betrayal card, and condition 1 of that card (the first child of its `{all:[...]}` node, morale 0 on every card read so far) is replaced by the exiled card's `betrayer.firstCondition` node; the other conditions stay. A betrayer therefore holds two cards. The reveal duty is printed on the exiled cards, not in the rulebook (BO). | R p14, BO; `sources/objectives-sources.md` §D; RULING O7.2, O7.5 |
| O5.3 | `query.objectiveProgress(view)` for an exiled viewer returns the exiled objective's parts (`kind:'exiled'`), with the original goal as a nested part when the node references it. | 00 §10 |
| O5.4 | An exiled betrayer stays a betrayer for R15.6 (the dealt kind, not the current goal). | R p14 |
| O5.5 | 10 cards, listed in O5.6. Names are the English headings printed on the Portuguese sheet (they look like the card names); 4 are cross-checked by the Spanish scans and Barter by an English photo. None is in the first slice (exile is M4). | `sources/objectives-sources.md` §D |
| O5.6 | The ten exiled cards: | |

| Id | Name | Not the betrayer: new objective (`requiresMain` + `complete`, our words) | Betrayer: condition 1 becomes (`betrayer.firstCondition`) | Sources / rulings |
|---|---|---|---|---|
| `obj.exiled.remorse` | Remorse | main objective complete; ≥ 4 Medicine cards in hand | ≥ 10 cards in hand | P (single source) |
| `obj.exiled.atonement` | Atonement | main objective complete (nothing else) | ≥ 1 each of Fuel, Food, Medicine and Tool in hand | P (single source) |
| `obj.exiled.new-friends` | New Friends | main objective complete; you control more survivors than any other seat | at least one location's item deck is empty | ES over P (D1 Corrected: P printed "not completed" and a betrayer line copied from Remorse) |
| `obj.exiled.shelter` | Shelter | ≥ 3 locations each hold ≥ 2 barricades (`requiresMain: false`; whether the colony counts as one of the 3 is unstated, read as yes: it is a location on the board) | you have more Weapon cards equipped across your survivors than any other seat | P (single source) |
| `obj.exiled.south` | South | main objective complete; ≥ 4 Fuel cards in hand | ≥ 4 survivors you do not control each carry ≥ 1 wound token of any kind | P (single source) |
| `obj.exiled.the-chosen` | The Chosen | you control ≥ 3 survivors and none of them carries a wound token (`requiresMain: false`) | none of your survivors carries a wound token and ≥ 5 barricades stand on the board (every location, colony included) | P (single source) |
| `obj.exiled.barter` | Barter | ≥ 4 Medicine cards in hand (`requiresMain: false`) | ≥ 3 Education cards equipped across your survivors | Ph, P (D2 Confirmed) |
| `obj.exiled.forgiveness` | Forgiveness | main objective complete; ≥ 5 Food cards in hand | main objective complete (`{code:'rule.objective.mainComplete'}`) | ES, P |
| `obj.exiled.vengeance` | Vengeance | ≥ 5 survivors have left the game, helpless tokens excluded (`requiresMain: false`) | ≥ 4 survivors have left the game, same exclusion | ES, P (D4 Confirmed) |
| `obj.exiled.resourceful` | Resourceful | main objective complete; ≥ 4 Tool cards in hand | ≥ 3 Tool cards in hand | ES (Habil), P (D3 Confirmed: one card, two titles) |

Six cards require the main objective on the not-the-betrayer branch (Remorse, Atonement, New Friends, South,
Forgiveness, Resourceful); four do not (Shelter, The Chosen, Barter, Vengeance). Betrayer branches that the condition
DSL cannot spell out (an empty deck anywhere, barricade counts across locations, wound-free followings, cross-seat
equipped counts) take `{code:'objective.<slug>.<name>'}` nodes (V-20), as O2.10 does for the main objectives.

## O6 Win evaluation at `GameEnded` (R p14)

| Seat state | Wins iff |
|---|---|
| eliminated | never (R20.15) |
| `coop` / `twoPlayer` | `objective.complete` |
| exiled, dealt a standard card | the exiled card's `requiresMain` → `objective.complete`, and its `complete` node (O5.2) |
| exiled, dealt a betrayal card | the betrayal card's node with its first condition swapped for the exiled card's `betrayer.firstCondition` (O5.2) |
| otherwise | its secret or betrayal objective's node, with `requiresMain` → `objective.complete` |

`SeatState.outcome` and `GameEnded.winners` carry the result; the recap explains each seat's parts. A `concession`
ending evaluates nobody as a winner (R17.4).

## O7 Rulings taken in this document

| Id | RULING |
|---|---|
| O7.1 | Adding a card to the main objective \| `playCard {cardId, data:{objective:true}}` moves the instance to `objective.cards` and emits `ObjectiveProgress`; no `CardPlayed`, no item effect; a dedicated `contributeObjective` action and `CardAddedToObjective` event may be added additively in M1 and logged in 00 §16 \| Confirmed mechanics (F 4.1.1: required cards only, any number on your turn), Unsourced shape |
| O7.2 | How an exiled objective "adjusts" a secret objective \| two branches per card (O5.2): a non-betrayer's original card is revealed, leaves the game and is replaced outright by the exiled card's node; a betrayer keeps the betrayal card with condition 1 swapped for `betrayer.firstCondition`. The earlier `secretObjectiveComplete` / `secretObjectiveWithoutMain` code conditions are withdrawn: no card needs them \| Confirmed (all 10 cards read: P, 4 cross-checked by ES, Barter by a photo; the reveal rule is BO) |
| O7.5 | Where "condition 1" of a betrayal card lives \| a betrayal `complete` node is `{all:[...]}` whose first child is the printed first condition (morale 0 on the 3 known cards); the swap is positional (`20` V-21). The reveal of a non-betrayer's original card is public information: the engine exposes the revealed id in every seat's view from that moment (an additive `SecretObjectiveRevealed {seat, objectiveId}` event is recommended in M1 and logged in 00 §16; `SeatExiled` stays private for the drawn id) \| Unsourced shape; Confirmed mechanics (the cards print both branches) |
| O7.6 | "Main objective complete" as a condition node \| the registered code condition `{code:'rule.objective.mainComplete'}` (Forgiveness's betrayer branch), the same read as `requiresMain` \| Unsourced (shape only) |
| O7.3 | What counts as "a zombie is killed" for We Need More Samples \| every `ZombieKilled`, by attack, ability or card; attract moves and overrun removals are not kills; one d6 per zombie \| Confirmed (R p6 "every time a zombie is killed"; R p13 kills vs removals) |
| O7.4 | Main objective completion mid-turn \| only detected at colony step 5 unless the card says "immediately" \| Confirmed (R p12 step 5, R p15 card text precedence) |
