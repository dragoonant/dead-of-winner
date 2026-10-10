# 11: Objectives

How the main, secret, betrayal and exiled objectives are represented, how progress is counted and exported, and when
each is checked. Rules references as in `10` (`R pN`, `F x.y.z`); rule ids `R3.3`, `R4.13`, `R17.5` etc. point there.
Card *values* for all but the two verified main objectives are data-entry work (spec `20`, `sources/`); nothing here
is a source for them.

## O1 One descriptor for every objective

`hooks.ts: ObjectiveDescriptor` (frozen):

| Field | Main | Secret | Betrayal | Exiled |
|---|---|---|---|---|
| `kind` | `'main'` | `'secret'` | `'betrayal'` | `'exiled'` |
| `requiresMain` | — | usually `true` | usually `false` | per card (**verify**) |
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
| O2.4 | **Adding cards to the objective** (F 4.1.1): `playCard {cardId, data:{objective:true}}` on the player's own turn; legal only for a card whose symbol the objective requires (`E_CARD_NOT_PLAYABLE` otherwise), any number per turn unless the card limits it, exiled seats included (F 5.4.3). The card instance joins `objective.cards` (zone `objective`, face up, public); no `CardPlayed` is emitted; `ObjectiveProgress {counter:'cards.<symbol>'}` is. The card is not an item play: no effect, no waste, no Crossroads `action.playCard` trigger. | F 4.1.1, F 5.4.3; RULING O7.1 |
| O2.5 | `complete` is evaluated at colony step 5 (`colony.objective`, `ObjectiveChecked`) and nowhere else, unless the card carries `op:'endGame'` in a trigger ("the game ends immediately"), which is card text beating the rulebook (R19.1). | R p12 |
| O2.6 | `'perSeat'` needs multiply by the number of seats that **started** the game (`setup.seats.length`), never the live count. | R p6 |
| O2.7 | On `coop` / `twoPlayer` / `hardcore` the hardcore side's `setup` and `complete` are used; the normal side otherwise. | R p15 |
| O2.8 | `query.objectiveProgress(view)` with no id returns the main objective's parts for any viewer. | 00 §10 |

### O2.9 Known main objectives

| Id | Title (R p16–17) | Side | Morale | Rounds | Setup zombies | Goal (`complete`) | Time | Source |
|---|---|---|---|---|---|---|---|---|
| `obj.main.we-need-more-samples` | We Need More Samples | normal | 6 | 6 | +1 at every non-colony location | counter `samples` ≥ 3 × starting seats; trigger `zombie.killed` → roll d6 (`purpose:'objective'`), 4+ → `samples += 1`. Every zombie killed by any attack, ability or card counts once (Daniel Smith's two kills = two rolls); zombies removed by attract or overrun are not kills. | short | R p6 |
| | | hardcore | 6 | 5 | +3 at every non-colony location | same goal | short | R p15 |
| `obj.main.find-a-cure` | Find a Cure | normal | 5 (**verify**) | 6 (**verify**) | none (**verify**) | `cards.medicine` ≥ 2 × starting seats via O2.4 (**verify**) | **verify** | brief G.3 (BGG thread, unread) |
| | | hardcore | **verify** | **verify** | 12 at the colony, 2 per location (**verify**) | `cards.medicine` ≥ 3 × starting seats (**verify**) | **verify** | brief G.3 |
| `obj.main.x-weeks-of-darkness` | X Weeks of Darkness | both | **verify** | | | | | R p16 title only |
| `obj.main.kill-them` | Kill Them | both | **verify** | | | | | R p16 |
| `obj.main.home-sweet-home` | Home Sweet Home | both | **verify** | | | | | R p16 |
| `obj.main.raiding-party` | Raiding Party | both | **verify** | | | | | R p16 |
| `obj.main.leave-it-all-behind` | Leave it all Behind | both | **verify** | | | | | R p17 |
| `obj.main.stockpile` | Stockpile | both | **verify** | | | | | R p17 |
| `obj.main.winter-has-come` | Winter Has Come | both | **verify** | | | | | R p17 |
| `obj.main.too-many-mouths` | Too Many Mouths | both | **verify** | | | | | R p17 |

Time ratings: short 45–90 min, medium 90–120, long 120–210 (R p3); stored as `time: 'short'|'medium'|'long'` for the
title screen only. The first release ships *We Need More Samples* alone (PLAN, G.7).

## O3 Secret objectives (R p3, p6, p14)

| Id | Rule | Ref |
|---|---|---|
| O3.1 | Dealt per R3.3 (`SecretObjectiveDealt`, private); `seats[s].secretObjectiveId` is hidden from every other seat (`hasSecretObjective` only) until the recap. | R p6 |
| O3.2 | Shape: `requiresMain` + a private condition. The condition reads the owner's seat (`handHasSymbol`, `handAtLeast`, `survivorsAtLeast`, `equippedAtLeast`, `objectiveCounterAtLeast` on a seat-scoped counter…) and public state (`moraleAtLeast`, `barricadesAtLeast`, `foodAtLeast`…). Example, R p3: *Hunger* = main objective complete AND at least 3 cards with the food symbol in hand. Outsider cards count as item cards for these (F 3.1.1). | R p3, F 3.1.1 |
| O3.3 | Checked for the win only when the game ends (R17.5), whatever ended it; `requiresMain` reads `objective.complete`, which R4.13 set (so a morale-0 or rounds-out ending never satisfies it). | R p14 |
| O3.4 | Progress is live for the owner: `query.objectiveProgress(view)` returns the viewer's own objective's parts; `ObjectiveProgress {seat}` / `ObjectiveComplete {seat}` are private to that seat and feed the AI's planner (H.2) and the secret-objective panel (50). A bot never sees another seat's parts. | 00 §4, §10 |
| O3.5 | Hidden until `ended`; then `view.recap` lists every seat's objective id and outcome. | 00 §4 |
| O3.6 | 24 cards; titles and conditions are **verify** (spec 20 data entry from card photos or BGG files). The first release uses "the standard secret objectives" that the data slice carries (G.7). | brief G.4 |

## O4 Betrayal objectives (R p6, p15, p18–19)

| Id | Rule | Ref |
|---|---|---|
| O4.1 | Same descriptor with `kind:'betrayal'`; dealt as the single betrayal card mixed in at R3.3; the holder's `SecretObjectiveDealt.kind = 'betrayal'`. Whether a seat holds one is what R15.6 reads (two exiled seats, neither a betrayer → morale 0). | R p6, R p14 |
| O4.2 | Betrayal goals usually do **not** need the main objective (`requiresMain:false`) and often need the colony to fail (`moraleAtMost 0`, `starvationAtLeast`, `survivorsAtMost`…) plus a private hoard; they are the only objectives the bots' suspicion model reasons about (H.3–H.4). | R p15 |
| O4.3 | Titles (R p18–19): Gluttony, Runaway, Take Over, All for One, Accept Your Fate, Trigger Happy, Cult Leader, Serial Killers, Mad Scientist, Obsessed. Conditions are **verify**; the first release ships 3 of them (G.7). | R p18–19 |
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
| O5.2 | "Adjusts the secret objective": while exiled the seat's win condition is the exiled card's `complete` node. A card that keeps part of the original goal says so with `{code:'secretObjectiveComplete'}` (the original card's node, evaluated for the same seat) or `{code:'secretObjectiveWithoutMain'}` (the original node with `requiresMain` ignored); a card that replaces the goal outright has a self-contained node. Which of the 10 cards do which is **verify**. | R p14; RULING O7.2 |
| O5.3 | `query.objectiveProgress(view)` for an exiled viewer returns the exiled objective's parts (`kind:'exiled'`), with the original goal as a nested part when the node references it. | 00 §10 |
| O5.4 | An exiled betrayer stays a betrayer for R15.6 (the dealt kind, not the current goal). | R p14 |
| O5.5 | 10 cards; titles and conditions **verify**. | brief G.4 |

## O6 Win evaluation at `GameEnded` (R p14)

| Seat state | Wins iff |
|---|---|
| eliminated | never (R20.15) |
| `coop` / `twoPlayer` | `objective.complete` |
| exiled | its exiled objective's node (O5.2) |
| otherwise | its secret or betrayal objective's node, with `requiresMain` → `objective.complete` |

`SeatState.outcome` and `GameEnded.winners` carry the result; the recap explains each seat's parts. A `concession`
ending evaluates nobody as a winner (R17.4).

## O7 Rulings taken in this document

| Id | RULING |
|---|---|
| O7.1 | Adding a card to the main objective \| `playCard {cardId, data:{objective:true}}` moves the instance to `objective.cards` and emits `ObjectiveProgress`; no `CardPlayed`, no item effect; a dedicated `contributeObjective` action and `CardAddedToObjective` event may be added additively in M1 and logged in 00 §16 \| Confirmed mechanics (F 4.1.1: required cards only, any number on your turn), Unsourced shape |
| O7.2 | How an exiled objective "adjusts" a secret objective \| the exiled node is the whole win condition; it may reference the original through `secretObjectiveComplete` / `secretObjectiveWithoutMain` code conditions \| Unsourced (R p14 says only "adjusts"; the 10 cards are unread) |
| O7.3 | What counts as "a zombie is killed" for We Need More Samples \| every `ZombieKilled`, by attack, ability or card; attract moves and overrun removals are not kills; one d6 per zombie \| Confirmed (R p6 "every time a zombie is killed"; R p13 kills vs removals) |
| O7.4 | Main objective completion mid-turn \| only detected at colony step 5 unless the card says "immediately" \| Confirmed (R p12 step 5, R p15 card text precedence) |
