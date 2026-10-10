# 10: Rules core

Every rule of the base game, in our own words, as the engine implements it. Page refs: `R pN` = the 2014
rulebook, `F x.y.z` = FAQ v1.1. Names of actions, decisions, events, windows and state fields are the frozen ones
in `00-architecture` and `src/engine/{types,actions,events,hooks}.ts`; where this file and `00` disagree on
what a rule *does*, this file wins; on names and shapes, `00` wins. Test ids live in `12`, worked examples in `13`.
Rulings taken here are collected in R20 and in `docs/needs-rules-check.md`.

Conventions: "seat" = a player; "survivor" = a survivor card in play; "alive" = `status === 'alive'`;
"wound total" = `wounds + frostbite`; "non-exiled seat" = `!exiled && !eliminated`.

## R1 Components (R p2)

| Id | Component | Count | Engine form |
|---|---|---|---|
| R1.1 | Main objectives, two-sided (normal / hardcore) | 10 | `ObjectiveDescriptor kind:'main'`, `ObjectiveSide` |
| R1.2 | Secret objectives | 24 | `kind:'secret'` |
| R1.3 | Betrayal secret objectives | 10 | `kind:'betrayal'` |
| R1.4 | Exiled secret objectives | 10 | `kind:'exiled'`, `exiledObjectiveDeck` |
| R1.5 | Survivors | 30 | `survivorDeck`, `survivors` |
| R1.6 | Starting items | 25 | dealt at setup, rest out of the game |
| R1.7 | Location item decks | 6 × 20 | `locations[id].deck` |
| R1.8 | Crisis cards | 20 | `crisisDeck` |
| R1.9 | Crossroads cards | 80 | `crossroads.deck` |
| R1.10 | Wound tokens (wound / frostbite sides) | 25 | `SurvivorState.wounds`, `.frostbite` (no token cap) |
| R1.11 | Helpless survivor tokens | 20 | `LocationState.helpless` (colony only in the base game) |
| R1.12 | Food, noise, barricade, starvation tokens | 20 / 20 / 20 / 6 | ints; the engine does not cap token counts |
| R1.13 | Zombie standees + overflow tokens | 30 + 30 | `EntranceState.zombies` (no cap, R p13) |
| R1.14 | Action dice (d6), exposure die (d12) | 30, 1 | `Die`, `rollExposure` |
| R1.15 | Item symbols | 7 | `ItemSymbol`: weapon, fuel, education, food, medicine, tool, survivor |

## R2 Board (R p5)

| Id | Rule | Ref |
|---|---|---|
| R2.1 | Seven locations: the colony and six location cards. `locationOrder` = `'colony'` then the six by the number printed in the card's corner: 01 Police Station, 02 Grocery Store, 03 School, 04 Library, 05 Hospital, 06 Gas Station (card photos; the Spanish thumbnails show 02, 05 and 06 on the same cards; the R p2 component list is in a different order but is a parts list, not a numbering). The data bundle carries the number per record (`20` §3.4). | R p5, R p2; `sources/locations-sources.md` (Ph, ES, W) |
| R2.2 | The colony has six entrances numbered 1 to 6; each entrance has 3 spaces that zombies and barricades share (`capacity.entranceSpaces = 3`, 18 in all). The "Colony Occupants" area has 24 survivor spaces, 3 columns of 8 (`capacity.survivors = 24`). Both counts are read from the R p5 board diagram and a fan photo of entrances 4 and 5; the engine still takes them from the data bundle. | R p5 diagram; `sources/locations-sources.md` L4, L5 |
| R2.3 | The colony also carries the morale track, round track, food supply, main-objective slot, waste pile, crisis deck and crisis contribution area: `morale`, `roundsLeft`, `food` (+`starvation`), `objective`, `waste`, `crisisDeck`, `crisis.contributions`. The colony has no item deck and no noise spaces. Both tracks run 0 to 10. | R p5 diagram; `sources/locations-sources.md` L6 |
| R2.4 | Each location card has survivor spaces, exactly one entrance with its zombie/barricade spaces, an item deck of 20, 4 noise spaces, and a symbol row ordered from likeliest to least likely find, the Survivor (Outsider) symbol always last. Counts per card (card photos cross-checked against the deck counts; the Grocery Store also matches the R p5 sample card): Police Station 3 survivor / 4 entrance spaces, symbols Weapon, Fuel, Tool, Food, Survivor; Grocery Store 3 / 4, Food, Medicine, Tool, Survivor; School 4 / 4, Food, Education, Tool, Medicine, Survivor; Library 3 / 3, Education, Fuel, Food, Tool, Survivor; Hospital 4 / 4, Medicine, Fuel, Food, Tool, Survivor; Gas Station 2 / 3, Fuel, Weapon, Food, Medicine, Survivor. Totals: 19 survivor spaces, 22 entrance spaces, 24 noise spaces. The photos are of The Long Night print of the same six cards (ruling L1). | R p5; `sources/locations-sources.md` L1–L3 |
| R2.5 | "Random location" (card text) = roll a d6 and take the location with that number; the colony is never random. | Fan-source (fandom *Interpreting Card Text*) |

## R3 Setup (R p6–7)

Engine order (00 §2): `createGame` deals everything from the seeded stream, then `chooseSurvivors` per seat in
`seatOrder`, then `chooseLeader` per seat, then `FirstSeatSet`.

| Id | Step | Rule | Ref |
|---|---|---|---|
| R3.1 | Seats | 2–5 seats clockwise. 2 seats require `variants.twoPlayer` (which implies `coop`); otherwise `E_BAD_SETUP`. | R p15 |
| R3.2 | Main objective | `setup.mainObjective` or `'random'` (seeded). Apply its setup effects: morale, round track, extra zombies (through R9, source `'setup'`). Side = `'hardcore'` when `variants.hardcore` or `coop`, else `'normal'`. | R p6 |
| R3.3 | Secret objectives | Shuffle the 24 standard cards, set aside `2n` (n = seats); shuffle the 10 betrayal cards, add 1; shuffle the `2n+1`; deal 1 per seat (`SecretObjectiveDealt {kind}`); the rest leave the game unseen. `betrayer` variant: `n` standard + 1 betrayal. `coop`: none (`secretObjectiveId = null`). Probability table in spec 11. | R p6, R p15 |
| R3.4 | Decks | Shuffle the crisis deck onto the board; shuffle the survivor, exiled-objective and Crossroads decks. `removeMature` drops Crossroads cards flagged `mature` first. | R p6 |
| R3.5 | Starting items | Deal 5 per seat (7 with `twoPlayer`) from the shuffled 25 (`StartingItemsDealt`, private); the rest leave the game. | R p6, R p15 |
| R3.6 | Location decks | Shuffle each location's 20 cards onto its card (`DeckShuffled {reason:'setup'}`). | R p6 |
| R3.7 | Survivors | Deal 4 per seat (`offered`, private). Each seat keeps 2 (3 with `twoPlayer`) via `chooseSurvivors {keep}`; the rest return and the deck is reshuffled after every seat has chosen. Kept survivors enter `survivors` at the colony, alive, 0 wounds. | R p7 |
| R3.8 | Leader | `chooseLeader {survivorId}` among the kept; the other(s) are followers. | R p7 |
| R3.9 | First seat | The seat whose leader has the highest influence takes the first-player token (`firstSeat`, `FirstSeatSet`). Influence values are unique, so there is no tie. | R p7 |
| R3.10 | Co-op cards | With `coop` (and `twoPlayer`) every card carrying the non-co-op mark (data flag `nonCoop`) is left out of its deck. | R p15 |

## R4 Round order (R p8, p12–13)

| Id | Phase / step | Rule | Ref |
|---|---|---|---|
| R4.1 | Player turns 1: reveal crisis | Flip the top crisis card (`CrisisRevealed`, window `crisis.revealed`). It resolves in R4.10. If the crisis deck is empty there is no crisis this round (cannot happen in ≤ 20 rounds). | R p8 |
| R4.2 | Player turns 2: roll dice | Every seat discards last round's dice and rolls `1 + alive survivors it controls` d6 (`ActionDiceRolled`, new `DieId`s, window `dice.rolled`). Dice belong to the seat, not a survivor; any number may be spent on one survivor. Helpless tokens give no dice. | R p8 |
| R4.3 | Player turns 3: turns | Clockwise from `firstSeat`, each non-eliminated seat takes one turn (`TurnStarted`). Exiled seats take turns. | R p8 |
| R4.4 | Turn start | In this order: (a) the seat to the **right** (`seatToRight`) draws a Crossroads card and holds it secretly (`CrossroadsDrawn`, R12); (b) frostbite tick: every alive survivor the active seat controls with ≥1 frostbite takes 1 plain wound (`FrostbiteTicked`, `WoundTaken {source:'frostbiteTick'}`), survivors processed in `seats[s].survivors` order, each death through R10 before the next tick; (c) window `turn.start`: every descriptor bound to it fires here (R19.2 order), and "at the beginning of your turn" survivor abilities are such descriptors (`kind:'triggered', trigger:'turn.start'`, spec 21 §12.4), never turn actions. An `optional:true` one raises `effectChoice {code:'survivor.forest-plum.lastGift'}` for its owner (John Price's copy, F 1.1.4, is a second descriptor with the same code and his `survivorId`); the owner fires it or declines, and a declined one leaves no trace. `useAbility` with such an ability's id is rejected (`E_FORBIDDEN`) at any time, inside the window included. | R p11, R p12; order RULING R20.3 |
| R4.5 | Turn body | The active seat answers `turnAction` repeatedly with any of `TURN_ACTION_TYPES` until `endTurn`. There is no action limit; "runs out of actions" = only `endTurn` is legal. | R p8 |
| R4.6 | Turn end | `endTurn` → if the seat is not exiled and `turn.contributionAsked` is false, raise `crisisContribution` once (`[]` = nothing); then window `turn.end`; the unrevealed held Crossroads card goes to the bottom of its deck (`CrossroadsReturned`); `TurnEnded`. Unused dice stay in the pool but are unusable until R4.2 discards them. | R p8, R p12 |
| R4.7 | Colony phase | After the last turn, `phase = 'colony'`, steps `ColonyStep` in order: `payFood checkWaste resolveCrisis addZombies checkObjective roundTick passToken` (`PhaseChanged {step}`). | R p12 |
| R4.8 | 1 pay food (`colony.payFood`) | Mouths = alive survivors at the colony (any seat, exiled included if there) + helpless tokens. Needed = ceil(mouths/2). If `food ≥ needed`: pay it (`FoodPaid`, `FoodChanged {reason:'pay'}`). Else: pay nothing, `starvation += 1`, morale −`starvation` (`Starvation`, `MoraleChanged {reason:'starvation'}`). Starvation tokens never leave unless a card says so. No morale loss on a round that can pay. | R p12, F 6.1.1 |
| R4.9 | 2 check waste (`colony.waste`) | Morale −floor(`waste.length` / 10) (`WasteChecked`, `MoraleChanged {reason:'waste'}`). | R p12 |
| R4.10 | 3 resolve crisis (`colony.crisis`) | Shuffle the face-down contributions (seeded), reveal one at a time: +1 if the card has any symbol in the crisis's `prevent` list, −1 otherwise (`CrisisCardRevealed {points, runningTotal}`, contributor never named). Needed = number of non-exiled seats. Total ≥ needed → prevented; total ≥ needed + 2 → also +1 morale (`MoraleChanged {reason:'crisisBonus'}`); total < needed → the fail effect (`CrisisEffectApplied {kind:'fail'}`). Then every contributed card leaves the game (`CardDiscarded {to:'removed'}`), `CrisisResolved`, window `crisis.resolved`. A food card that adds several tokens is still one card. | R p11–12 |
| R4.11 | Crisis bonus text | A card's printed optional ("2 more cards for +1 morale") is the same bonus as the rulebook's "+2 over needed → +1 morale"; a `CrisisDescriptor.bonus` may change the extra-card count or the effect, and the two never stack. | R p4, R p12; RULING R20.4 |
| R4.12 | 4 add zombies (`colony.zombies`) | In F 6.2.1 order: (A) the colony: ceil((alive survivors there + helpless) / 2) zombies; (C) each non-colony location in `locationOrder`: 1 per alive survivor there (helpless never sit there); (E) noise, location by location: for each noise token roll a d6 (`NoiseRolled`, purpose `'noise'`), 3 or lower adds 1 zombie; tokens are removed as rolled (`NoiseCleared`). Every addition goes through R9 with source `colonyStep`/`locationStep`/`noise`. The count for a location is fixed when its section starts (`ZombiesToAdd`); survivors that appear during the section (R10.5) are counted only by later sections. Morale 0 ends the game at once (R17.1), which satisfies the FAQ's morale checks (B, D, F). | R p12–13, F 6.2.1 |
| R4.13 | 5 check main objective (`colony.objective`) | `ObjectiveChecked`; complete → the game ends (R17.3). Only here, unless the card says "immediately" (R19.1). | R p12 |
| R4.14 | 6 round tick (`colony.roundTick`) | `roundsLeft -= 1` (`RoundTicked`); at 0 the game ends at once, no objective check (R17.2). | R p13 |
| R4.15 | 7 pass token (`passToken`) | `firstSeat` moves one seat to the **right** (`FirstSeatPassed`); an exiled or eliminated seat may hold the token for turn order, but it cannot vote (R p14) and so never breaks a tie: the next eligible seat clockwise from it does (R16.4). A new round starts at R4.1 (`RoundStarted`, window `round.start`). | R p13, R p14 |

## R5 Dice (R p8, p10, p11)

| Id | Rule | Ref |
|---|---|---|
| R5.1 | A die action spends one unused die of the active seat (`DieSpent {purpose}`); `E_NO_DIE` / `E_DIE_USED`. The die must show ≥ the survivor's value for attack, search and `(N+)` abilities (`E_DIE_TOO_LOW`); barricade, clean waste and attract take any value. | R p8–10 |
| R5.2 | `spendFood {dieId, tokens}`: `food -= tokens`, the die rises by `tokens` (`DieBoosted {source:'food'}`, `FoodChanged {reason:'spendOnDie'}`). Only an unused die, never above 6 (`E_DIE_MAX`), only with food (`E_NO_FOOD`); exiled seats cannot (`E_EXILED`). Window `action.spendFood`. | R p11, F 5.3.1 |
| R5.3 | Dice are never a decision: rolls happen inside the step (`DiceRolled`, 00 §11). A die spent on a survivor attack is re-rolled as a fresh d6 (purpose `'attackSurvivor'`); its pool value is irrelevant. | R p8 |
| R5.4 | A survivor added mid-round gives its die at the next R4.2; abilities and items that add a die use `DieAdded`. | R p14 |
| R5.5 | `(N+)` survivor abilities: `useAbility {abilityId, dieId}` with die ≥ N; repeatable unless the ability says once per round (`abilityUses`, `E_ABILITY_USED`, reset at R4.2); the survivor must be at the ability's location (`E_ABILITY_LOCATION`). Loretta Clay's "(4)" reads (4+). Window `action.ability`. | R p10, F 1.2.1 |

## R6 Actions that spend a die (R p8–10)

| Id | Action | Rule | Ref |
|---|---|---|---|
| R6.1 | `attack` a zombie | Die ≥ attacker's attack value; target an entrance at the attacker's location that holds a zombie (`E_NO_ZOMBIE`); at the colony any entrance may be chosen. The zombie dies (`ZombieKilled`, window `zombie.killed`, main-objective triggers fire here), then R8 on the attacker with reason `zombieKill`. The attack never misses. | R p8–9, R p13 |
| R6.2 | `attack` a survivor | Die ≥ attacker's attack value; target an alive survivor at the same location that another seat controls (`E_OWN_SURVIVOR`), never a helpless token (`E_HELPLESS_TARGET`). Roll a d6 (`SurvivorAttacked {roll, targetAttack, hit}`): hit iff roll ≤ the **target's** attack value → target takes 1 wound (`WoundTaken {source:'attack'}`, R8.6 death check) and the attacker's seat steals a random card from the target seat's hand (`CardStolen`, private); an empty hand steals nothing. No exposure roll. Exiled seats' survivors are legal targets. | R p8–9 |
| R6.3 | Repeat attacks | A survivor may attack any number of times per turn, one qualifying die each. | R p9 |
| R6.4 | `search` | Not at the colony (`E_WRONG_LOCATION`); die ≥ search value; deck non-empty (`E_DECK_EMPTY`). Draw 1 (`SearchDrawn`, private, window `search.drawn`), then `searchKeepOrNoise`: `keepCard` ends the search, or `makeNoise` places a noise token (`NoiseAdded`, window `noise.added`) and draws again, while noise spaces (4) remain and the deck is not empty; with no noise space (or no card) left and ≥2 drawn, `searchKeepWhich`. Exactly one drawn card goes to hand (`SearchKept`, window `search.kept`); the others go under the deck in draw order. Extra look/keep grants (Alexis Grey, Janet, Jenny, John Price combos F 1.1.2) widen the draw or the keep count. Several searches per turn are allowed. | R p9–10, R p5 |
| R6.5 | `barricade` | Any die; one barricade onto an empty entrance space at the survivor's location (`BarricadeAdded`); `E_NO_SPACE` when that entrance is full. | R p10 |
| R6.6 | `cleanWaste` | The acting survivor must be at the colony; any die; the top 3 waste cards leave the game (`WasteCleaned`); with 1–2 cards in the waste those leave; with 0 the action is illegal. | R p10; RULING R20.5 |
| R6.7 | `attract` | Any die; move 2 zombies in total (`from[]`, any locations and entrances) into empty entrance spaces at the survivor's location (`ZombieMoved`). Only empty spaces: never destroys a barricade, never overruns (`E_NO_SPACE`). Fewer than 2 zombies on the board → move those that exist (00 §16). At the colony the arrivals fill the lowest-numbered entrance with an empty space first. The same limits apply to the Microphone item. | R p10, F 5.1.1; RULING R20.6 |

## R7 Actions that need no die (R p10–11)

| Id | Action | Rule | Ref |
|---|---|---|---|
| R7.1 | `playCard` | Own turn only, from hand (`E_NOT_IN_HAND`), any number per turn. Destination by card class: Waste Pile → `waste` (top), Equip → attached to one of the seat's survivors (`equipTo`, `CardEquipped`, window `card.equipped`), Event → `removed`. Exiled seats send every played card to `removed`. Targets come through `itemTarget`. Window `action.playCard`, `card.played`. A card whose effect cannot be applied now is not playable (`E_CARD_NOT_PLAYABLE`). | R p10, R p14; Event class Fan-source (fandom *Item*) |
| R7.2 | Equipped cards | Stay on the survivor until contributed (R7.3) or handed off (R7.6). Survivor dies or is removed at the colony → back to the controller's hand; elsewhere → shuffled into that location's deck (`EquippedReturned`, `DeckShuffled {reason:'equippedReturned'}`). | R p10 |
| R7.3 | `contributeCrisis {cardIds}` | Any number, from hand and/or equipped cards (equipped ones unequip). Only cards from the hand are face down: `CardContributed {from:'hand'}` keeps `cardId` private to the contributor until R4.10, every other seat seeing only its count. An equipped card was public on the survivor and its removal is visible to all, so `CardContributed {from:'equipped'}` is fully public, its id is never in the view's hidden list, and the leak test does not count it. Legal at any time on the own turn and asked once at `endTurn` (R4.6). Exiled seats cannot (`E_EXILED`). Contributions cannot be taken back. Window `action.contribute`. | R p11 (only hand cards are added face down); RULING R20.21 |
| R7.4 | `move {survivorId, to}` | Each alive survivor once per turn (`movedThisTurn`, `E_ALREADY_MOVED`; `extraMoves` from abilities), to a *different* location with an empty survivor space (`E_NO_SPACE`). `SurvivorMoved {kind:'action'}`, then R8 with reason `move`; a bite spreads at the destination. Forbidden while a `forbid:'move'` effect covers the survivor (Blizzard; `E_FORBIDDEN`). | R p11 |
| R7.5 | `request {to, symbol?, defId?}` | Ask one other seat for an item card (`RequestMade`, public). The asked seat answers `respondRequest {give}`: `null` declines; otherwise the card is revealed and **played at once by the requester** (`CardGiven` public, then R7.1 with the requester as player, or spent on an ability that needs it, F 5.2.1). `legalActions` offers only cards the requester could play now. A requested card never goes to the crisis (`E_REQUESTED_CARD`; the FAQ's Outsider wording is treated as that card's own text). Exiled seats may ask and give. Several requests per turn: the rulebook's ask is addressed to the whole table, which with the frozen `to: SeatId` costs one action (and one Crossroads evaluation) per seat asked (R20.19). Window `action.request`. | R p11, F 5.2.1, F 3.1.2, F 5.4.2; RULINGS R20.16, R20.19 |
| R7.6 | `handOff {cardId, toSurvivorId}` | An equipped item moves from one of the seat's survivors to any other alive survivor at the same location, own or another seat's (`CardHandedOff`). A once-per-round use already spent this round stays spent (the count lives on the card instance). Window `action.handOff`. | R p11 |
| R7.7 | `callVote {target}` | Once per turn (`turn.voteCalled`, `E_VOTE_USED`); target another seat (`E_SELF_TARGET`) that is neither exiled nor eliminated (`E_TARGET_INVALID`). Exiled seats may call. Raises `votes` (R16); on a yes result R15 runs. Never in `coop`. Window `action.vote`. | R p11, F 5.4.5 |
| R7.8 | `endTurn` | Always legal while `turnAction` is open (00 §5). See R4.6. | R p8 |

## R8 Exposure and the bite chain: ONE routine (R p11)

`exposure.ts: rollExposureFor(state, survivorId, reason)`; callers: move (R7.4), zombie kill (R6.1, abilities, items),
the chain itself, cards and abilities with `op:'exposure'`. `state.bite` holds the chain while `biteSpreadOption` is open.

| Id | Step | Rule | Ref |
|---|---|---|---|
| R8.1 | Skip | A grant `noExposureOnMove` (Rod Miller, Fuel card) / `noExposureOnKill` (Mike Cho) / `noExposureOnAbility` for this reason → `ExposureSkipped`, done. | R p9, F 1.1.1 |
| R8.2 | Roll | `rollExposure` → d12 → `ExposureRolled {raw, face}`; faces 6 blank / 3 wound / 2 frostbite / 1 bite (`EXPOSURE_FACE_COUNT`, 00 §16 ruling). Then `treatFaceAs` grants (Sparky bite→wound, Harman Brooks frostbite→wound) → `ExposureFaceChanged`. Window `exposure.rolled`. | R p11 |
| R8.3 | blank | Nothing. | R p11 |
| R8.4 | wound | `wounds += 1` (`WoundTaken {kind:'wound', source:'exposure'}`, window `wound.taken`), then R8.6. | R p11 |
| R8.5 | frostbite | `frostbite += 1` (`WoundTaken {kind:'frostbite'}`); it counts as a wound now and ticks one more plain wound at each of the owner's turn starts while any frostbite remains (R4.4). Then R8.6. | R p11 |
| R8.6 | Death check | Wound total ≥ 3 → R10 with cause `wounds`. The threshold is 4 for a survivor covered by `fourWoundsToDie` (Buddy Davis' location); the check re-runs whenever a survivor's location or the grant changes, so a 3-wound survivor dies the moment the move that separates him from Buddy completes, whichever of the two moved (F 1.1.5: once the survivor reaches the new location). Items cannot interrupt (R19.3). | R p14, F 1.1.5 |
| R8.7 | bite | The survivor dies through R10 with cause `bite`, then the chain starts at the survivor's current location (after a move: the destination). | R p11 |
| R8.8 | Chain step | Next = the alive survivor with the lowest influence at that location, any seat, exiled seats' survivors included, helpless tokens never. None → `BiteChainEnded {reason:'noSurvivors'}`. Else `BiteSpreadStep` and decision `biteSpreadOption` for its controller. | R p11 |
| R8.9 | `biteSpread {choice:'kill'}` | That survivor dies (R10, cause `biteChoice`); `BiteChoiceMade`, `BiteChainEnded {reason:'killChoice'}`. | R p11 |
| R8.10 | `biteSpread {choice:'roll'}` | `ExposureRolled {reason:'biteChain'}`: a raw blank → survives, `BiteChainEnded {reason:'blank'}`; any other face → dies (R10, cause `exposureChain`) and the chain continues at R8.8 from the same location. Face-changing grants do not apply to a chain roll (only a blank stops it). | R p11; RULING R20.7 |
| R8.11 | Nested kills | Each death inside the chain runs R10 fully (leader replacement, last-survivor replacement) before the chain continues; a survivor that enters play during a chain is not a candidate for that chain. `BiteChainEnded.killed` lists every victim after the original. | RULING R20.8 |
| R8.12 | Odds | `query.exposureOdds(view, survivorId, reason)` applies R8.1–R8.2 and the wound total; the client never computes them. | 00 §10 |

## R9 Adding zombies: ONE routine (R p13)

`zombies.ts: addZombies(state, location, count, source)`; callers: colony step, location step, noise, objective setup,
crisis/Crossroads/item effects (`op:'addZombies'`). Attract never calls it (R6.7). `ZombiesToAdd` then one event per zombie.

| Id | Step | Rule | Ref |
|---|---|---|---|
| R9.1 | One at a time | Zombies are added singly; each one fully resolves (barricade or overrun included) before the next. | R p13 |
| R9.2 | Colony rotation | Every call to the colony starts at entrance 1 and advances 1→2→…→6→1 per zombie. All spaces within an entrance are equivalent, so there is no placement choice. | R p13 |
| R9.3 | Other locations | One entrance; every zombie targets it. | R p13 |
| R9.4 | Empty space | Place it (`ZombieAdded`, window `zombie.added`). | R p13 |
| R9.5 | Full, with a barricade | Destroy one barricade (`BarricadeDestroyed`); the zombie is not placed. | R p13 |
| R9.6 | Full, no barricade: overrun | `EntranceOverrun {killed}`, window `entrance.overrun`; the zombie is not placed; the lowest-influence alive survivor at that location dies (R10, cause `overrun`); a survivor that cannot be killed (Bev Russel's card) is skipped for the next lowest (F 2.2.1). Only helpless tokens there → one helpless dies (`HelplessKilled`, −1 morale). Nobody there → nothing more. | R p13, F 2.2.1 |
| R9.7 | Continue | The rotation continues with the next entrance for the next zombie, overrun or not. | R p13 |
| R9.8 | Killing | Any attack or effect kills exactly the zombie it names (`ZombieKilled`); at the colony the killer picks the entrance. Killed zombies return to the supply; there is no supply limit. | R p13 |
| R9.9 | Forecast | `query.zombiesToAdd(view)` shows per-location counts, noise odds (1/2 per token) and empty colony spaces. | 00 §10 |

## R10 Killing a survivor: ONE routine (R p14)

`survivors.ts: killSurvivor(state, survivorId, cause)`; callers: R8.6, R8.7, R8.9, R8.10, R9.6, crises, Crossroads,
items, objectives, abilities. `removeSurvivor` (card text "remove from the game", Forest Plum) is the sibling: R10.7.

| Id | Step | Rule | Ref |
|---|---|---|---|
| R10.1 | Die | `status = 'dead'`, `owner = null`, standee off the board (`SurvivorKilled {cause, moraleLoss, wasLeader}`), window `survivor.killed`. | R p14 |
| R10.2 | Morale | −1 (`MoraleChanged {reason:'survivorKilled'}`) unless the owner is exiled (`moraleLoss:false`). A helpless token killed by a card or an overrun: −1 always (`HelplessKilled`). Morale 0 → R17.1 immediately. | R p13–14 |
| R10.3 | Equipped cards | At the colony → owner's hand; elsewhere → shuffled into that location's deck (`EquippedReturned`). | R p14 |
| R10.4 | Leader lost, followers left | Decision `newLeader` for the owner (`chooseLeader`, `LeaderChosen {reason:'replacement'}`); with exactly one follower the engine auto-resolves (`DecisionAutoResolved`). | R p14 |
| R10.5 | Last survivor lost | The owner's whole hand leaves the game (`HandDiscarded {reason:'lastSurvivor'}`); the owner draws the top survivor card (`SurvivorAdded {source:'lastSurvivor'}` at the colony, `LeaderChosen {reason:'newSurvivor'}`); it may act this turn and gets its die at the next R4.2. An exiled owner instead picks a non-colony location with an empty space (`effectChoice`, `context.data.code = 'exiledSurvivorPlacement'`): a placement, not a move, no exposure; it may be a location the zombie step has not reached yet. This interrupts any colony-phase section. | R p14, F 6.2.1 |
| R10.6 | Variants / empty deck | `playerElimination`: the seat is out instead (`SeatEliminated`; its hand leaves the game; its remaining decisions never arise; it does not vote or count for crises). An empty survivor deck eliminates the seat the same way. | R p15; RULING R20.9 |
| R10.7 | Removed, not killed | `removeSurvivor`: `status = 'removed'`, no morale loss unless the card says so (`SurvivorRemoved`); R10.3–R10.6 still apply ("or otherwise lost"). | R p14 |
| R10.8 | Mid-action | A kill never undoes the action that caused it: a move stays moved, a die stays spent, the search card stays kept. | F 2.1.1 |

## R11 Survivors, leaders and helpless tokens (R p14, p7)

| Id | Rule | Ref |
|---|---|---|
| R11.1 | Stats come from the bundle by `SurvivorId`: influence (unique, hierarchy), attack value (die needed), search value (die needed), ability location, ability. Occupation has no effect. | R p3 |
| R11.2 | A survivor added by any effect (`SurvivorAdded`, window `survivor.added`) joins the colony under the controller named by the effect, is usable this turn, and gives a die only at the next R4.2 (R5.4). Exiled controllers place it at a non-colony location instead (R15.3). | R p14 |
| R11.3 | With no empty colony survivor space, effects that would add a survivor or a helpless token cannot happen: a Crossroads card with any option that adds one **does not trigger at all** (its `when` reads false while the colony is full; it stays held and goes to the bottom at turn end, R12.4, R12.6), and an item card that adds one is not playable (`E_CARD_NOT_PLAYABLE`). This is the whole-card rule of R p14, not an option-level one. | R p14; RULING R20.20 |
| R11.4 | Helpless tokens live only at the colony; they eat (R4.8), attract zombies (R4.12), die on an overrun with no survivors left (R9.6) and can be killed by cards; they never catch a bite, never hold items, never count for dice, cannot be attacked. Exiled seats never add them (R15.3). | R p4, R p13–14 |
| R11.5 | Each seat has exactly one leader among its alive survivors (`leaderId`); the leader matters for R3.9 and for cards that name "your leader" (`isLeader`). | R p7 |
| R11.6 | John Price copies every ability at his location while there (F 1.1.1–1.1.5): grants bound to his location via `copyAbilitiesAtLocation`; a copied once-per-round ability is a separate instance for him. | F 1.1 |
| R11.7 | Edward White's ability spends 2 dice (one attack, one ability) plus a medicine-symbol card, which may be requested (F 1.3.1–1.3.3). | F 1.3 |

## R12 Crossroads (R p12; F 2.x)

| Id | Rule | Ref |
|---|---|---|
| R12.1 | Draw: R4.4(a). The holder (`crossroads.held.holder`) sees the card (`me.crossroadsHeld`); nobody else does. With two seats the other seat holds it. | R p12 |
| R12.2 | Evaluation: the engine tests the held card's `when` predicate at `turn.start` and once after each turn action has fully resolved, in that action's `action.*` window (FAQ 2.1.1). A survivor that dies during a move never reaches `action.move`. A card whose trigger needs an action's *result* (Hunted: a non-frostbite wound from the exposure roll after a move) binds to that action's window with a condition on the result. Nothing outside the active seat's turn can trigger it. | R p12, F 2.1.1 |
| R12.3 | Trigger: `CrossroadsTriggered`, the card goes face up (`crossroads.active`), decision `crossroadsOption` for the active seat with the possible options; `chooseCrossroadsOption {optionId}` → `CrossroadsResolved {forced}`, effects apply at once, the card leaves the game. At most one card per turn. | R p12 |
| R12.4 | Untriggered by turn end → bottom of the deck (`CrossroadsReturned`); its id stays hidden in `crossroads.log` until the recap. | R p12 |
| R12.5 | A card effect that searches the Crossroads deck shuffles it afterwards (`CrossroadsDeckShuffled {reason:'search'}`). | R p12 |
| R12.6 | Impossible option → the other is forced (`forced:true`, auto-resolved). Both impossible → the card is removed with no effect. A full colony is handled one level up: a card with any survivor- or helpless-adding option never triggers while the colony is full (R11.3, `CrossroadsReturned` at turn end), so "impossible" here never means a full colony. | R p12, R p14; RULINGS R20.10, R20.20 |
| R12.7 | A `vote:true` option raises `votes` (R16); a card may narrow the voters (Outbreak: seats with a survivor at the colony, F 2.4.1). Old Divisions' thumbs-up removes the crisis contributions unrevealed (F 2.3.1). Bev Russel counts as a survivor for zombies but cannot die to an overrun (F 2.2.1). | F 2.2–2.4 |
| R12.8 | `removeMature` leaves flagged cards out at setup (R3.4). | R p4, R p6 |

## R13 Crisis cards (R p4, p8, p11–12)

| Id | Rule | Ref |
|---|---|---|
| R13.1 | `CrisisDescriptor {prevent, fail, bonus?}`. "Needed" is always the live count of non-exiled seats at resolution time, not at reveal. | R p4, R p12 |
| R13.2 | `query.crisis(view)` scores the viewer's own contributions and every seat's equipped contributions (public, R7.3) exactly, and bounds the other seats' hand contributions ±1 each; the human and the bots see the same shape. | 00 §10, R7.3 |
| R13.3 | Lasting fail effects (Blizzard: non-exiled survivors cannot move until the end of next round, −1 morale) are `EffectInstance`s with `forbid` and `expires`; a repeat of the same effect refreshes to the later expiry. | R p4, 00 §3 |
| R13.4 | Zero contributions with needed ≥ 1 fails the crisis; needed = 0 (every seat exiled) prevents it. | R p12 |

## R14 Morale, food, waste and the tracks

| Id | Rule | Ref |
|---|---|---|
| R14.1 | Morale changes only through `MoraleChanged {delta, after, reason}`; it never rises above 10, the top of the printed track (R2.3), and the game ends the instant it is 0 (R17.1), even mid-chain. | R p5 diagram, R p14; `sources/locations-sources.md` L6 |
| R14.2 | Food changes only through `FoodChanged`; it never goes below 0; food cards add their printed tokens (`reason:'card'`). | R p5, R p11 |
| R14.3 | `waste` is public and ordered (top first); `cleanWaste` (R6.6) and card effects remove from the top; crisis contributions, cleaned cards and exiled plays go to `removed`, never to `waste`. | R p10, R p12, R p14 |
| R14.4 | The round track counts down from the objective's starting value (`roundsLeft`, at most 10, the top of the printed track; the largest printed start is 10); `roundNumber` counts up for logs and effect expiries. | R p5 diagram, R p13; `sources/locations-sources.md` L6 |

## R15 Exile (R p14; F 5.4)

| Id | Rule | Ref |
|---|---|---|
| R15.1 | On a yes vote: `seat.exiled = true`, draw 1 exiled objective (`SeatExiled {objectiveId}`, private; spec 11), window `seat.exiled`, then decision `exilePlacement` → `placeExiled {placements}` naming every alive survivor of the seat at the colony and a non-colony destination with an empty space. Each placement, in order, is a move with exposure (R8, bites spread at the destination) that does not consume `movedThisTurn` (`SurvivorMoved {kind:'exile'}`, `ExiledPlaced`). | R p14 |
| R15.2 | No empty slot anywhere: the exiled seat names a non-exiled survivor to return to the colony (`SurvivorBumped`; not a move, no exposure), then the exile goes into the freed slot; repeat as needed. | F 5.4.1; RULING R20.11 |
| R15.3 | While exiled (one `rule` `EffectInstance`): cannot contribute to the crisis (`forbid:'contribute'`), never adds helpless tokens (`'addHelpless'`), new survivors from cards go to a non-colony location of the seat's choice, cannot spend food tokens on dice (`'spendFood'`), cannot vote (`'vote'`), no morale loss for its survivors' deaths (`grant:'noMoraleOnDeath'`), played cards go to `removed`. | R p14 |
| R15.4 | Food cards: the exiled seat chooses per card: its printed effect (F 5.4.4) or +1 on one unused die (max 6) (`DieBoosted {source:'item'}`). | R p14, F 5.4.4; RULING R20.12 |
| R15.5 | Still allowed: request and give cards (F 5.4.2), add cards to the main objective (F 5.4.3), call votes (F 5.4.5), take turns, move anywhere including back to the colony (where its survivors then count for food and zombies). | F 5.4; RULING R20.13 |
| R15.6 | The moment a second seat is exiled and neither exiled seat was dealt a betrayal objective, morale becomes 0 (`MoraleChanged {reason:'doubleExile'}`) and R17.1 applies. | R p14 |
| R15.7 | Exile is permanent; an exiled seat cannot be targeted again (R7.7). Never in `coop`. | R p15 |

## R16 Voting (R p11, p15)

| Id | Rule | Ref |
|---|---|---|
| R16.1 | A vote (`callVote`, a Crossroads option, a crisis effect) raises one `votes` decision with `seat:'all'`; eligible = every non-exiled, non-eliminated seat, narrowed by the card when it says so. The target of an exile vote votes too. | R p11, R p15 |
| R16.2 | The client collects every eligible seat's answer privately and submits one `castVotes {votes}`; bots never see the human's vote first (00 §5). Seats may talk before voting (H.5); the engine does not model the talk. | R p15 |
| R16.3 | Result: yes > no passes; no > yes fails (`VotesCast`, `VoteResult`, window `vote.result`). | R p11 |
| R16.4 | Tie: the first seat's vote decides; if the first seat is ineligible (exiled, eliminated, or outside a card's narrowed voter set), the next eligible seat clockwise from it decides. A vote is only raised with at least one eligible seat (none → it fails at once, `VoteResult {yes:0, no:0, tiebreakBy:null}`), so `query.voteForecast(view).tiebreakBy` is always a resolved `SeatId`; `VoteResult.tiebreakBy` names that seat when the count was tied and is `null` when it was not. | R p4, R p11, R p14; RULING R20.14 |
| R16.5 | A passed exile vote runs R15 inside the same step; a failed one changes nothing (the caller's once-per-turn is still spent). | R p11 |

## R17 Ending and winning (R p14)

| Id | Rule | Ref |
|---|---|---|
| R17.1 | Morale reaches 0 → the game ends at once (`reason:'moraleZero'`), no objective check, even in the middle of a chain, a colony-phase section or a turn. Every in-flight context is dropped; `pending.kind = 'gameOver'`. | R p14 |
| R17.2 | The round track reaches 0 at R4.14 → ends at once (`'roundsOut'`), no objective check. | R p14 |
| R17.3 | The main objective is found complete at R4.13 (or a card says "immediately", R19.1) → ends (`'objectiveComplete'`). | R p12, R p14 |
| R17.4 | `'concession'`: the human resigns; nobody wins. | ours |
| R17.5 | Winners (`GameEnded.winners`, `SeatState.outcome`): a non-eliminated seat wins iff its goal is complete at that moment: `coop` → the main objective; exiled → its exiled objective (spec 11); otherwise its secret objective. Several may win; everyone may lose. Eliminated seats lose. | R p14; RULING R20.15 |
| R17.6 | At `ended` the view's `recap` reveals every secret objective, contribution and Crossroads card (00 §4). | ours |

## R18 Variants as setup flags (R p15)

| Flag (`GameVariants`) | What changes | Ref |
|---|---|---|
| `coop` | Hardcore side; no secret objectives; `callVote` illegal; non-co-op cards out (R3.10); everyone wins iff the main objective completes. | R p15 |
| `twoPlayer` | Implies `coop`; 7 starting items; keep 3 of 4 survivors (so 4 dice at the start). Required for 2 seats. | R p15 |
| `betrayer` | R3.3 with `n` standard + 1 betrayal. | R p15 |
| `hardcore` | Standard game on the hardcore side. | R p15 |
| `playerElimination` | R10.6. | R p15 |
| `removeMature` | R3.4. | R p4, R p6 |

The standard game is every flag off. Flags are validated at `createGame` (`E_BAD_SETUP` on contradictions such as `betrayer` with `coop`).

## R19 Precedence and timing (R p15)

| Id | Rule | Ref |
|---|---|---|
| R19.1 | Card text beats this document: a descriptor's `when`/`effect`/`code` overrides the generic rule it names (including "the game ends immediately"). | R p15 |
| R19.2 | Two effects that would trigger at the same moment: the first seat picks the order (`effectChoice`, `context.data.code = 'orderSimultaneous'`); auto-resolved when only one order is possible. Within one seat's own start-of-turn effects the engine order is R4.4. | R p15 |
| R19.3 | Nothing interrupts an effect in progress: a card can only be played between actions, so a third wound kills before medicine could be played. `playCard` is never legal while `attack`, `search`, `bite`, `vote` or `exile` contexts are open. | R p15 |
| R19.4 | Any effect that searches a deck shuffles it afterwards (`DeckShuffled {reason:'card'}`, R12.5). | R p12 |
| R19.5 | Rejections never change state (00 §2); `legalActions` is never empty while a decision is open. | 00 |

## R20 Rulings taken in this document

Format: rule | what we did | why. Also appended to `docs/needs-rules-check.md` by the orchestrator.

| Id | RULING |
|---|---|
| R20.1 | Exposure die faces \| 6 blank / 3 wound / 2 frostbite / 1 bite (`EXPOSURE_FACE_COUNT`) \| Fan-source (BGG 1303776; R p11 names faces only) — logged in 00 §16 |
| R20.2 | Location order for the zombie step \| `locationOrder` follows the numbers printed in the card corners, 01 Police Station to 06 Gas Station (R2.1); the rulebook's component list is in another order but is a parts list, not a numbering \| Fan-source for the numbers (card photos and the Spanish thumbnails, `sources/locations-sources.md`); Unsourced that the zombie step uses them (F 6.2.1 says "in location order" without listing it) |
| R20.3 | Turn-start order and "beginning of your turn" abilities \| Crossroads draw, then frostbite ticks (seat's survivor order), then the `turn.start` window; such abilities are `triggered, optional` descriptors in that window (`effectChoice {code:'survivor.forest-plum.lastGift'}`), never turn actions and never `useAbility` \| Unsourced order (R p11–12 give both as "at the beginning of the turn"); model Confirmed by F 1.1.4 (John Price's copy fires the same way) |
| R20.4 | Crisis optional bonus vs the +2 rule \| one bonus, never stacked; a card's `bonus` may change the extra-card count or effect \| Unsourced (R p4 and R p12 describe the same +1 morale) |
| R20.5 | Clean waste with fewer than 3 waste cards \| removes what is there; illegal with an empty waste pile \| Unsourced |
| R20.6 | Attract destination at the colony \| lowest-numbered entrance with an empty space first; an additive `to?: EntranceIndex[]` on `AttractAction` may later let the seat choose \| Unsourced |
| R20.7 | Face-changing abilities in a bite chain \| only a raw blank saves the survivor; Sparky/Harman conversions do not apply to chain rolls \| Confirmed (R p11: "any other result" kills) |
| R20.8 | Survivors added during a bite chain \| not candidates for that chain; each kill resolves fully (leader, last-survivor) before the chain continues \| Unsourced |
| R20.9 | Empty survivor deck when a last survivor dies \| the seat is eliminated as in the player-elimination variant \| Unsourced |
| R20.10 | Crossroads with both options impossible \| the card is removed with no effect \| Unsourced (R p12 covers one impossible option) |
| R20.11 | Who picks the survivor bumped back to the colony (F 5.4.1) \| the exiled seat \| Unsourced (the FAQ's instruction is addressed to the exiled player) |
| R20.12 | Exiled seat playing a food card \| chooses per card: printed effect or +1 to an unused die (max 6) \| Corrected (R p14 allows only the die boost *instead of* the printed effect; F 5.4.4 allows the printed effect; we offer both and let the seat pick) |
| R20.13 | Exiled survivors moving back to the colony \| allowed after the initial placement; they then count for food and zombies \| Unsourced (R p14 mandates only the initial move) |
| R20.14 | Tie-break when the first seat cannot vote \| the next eligible seat clockwise from the first seat breaks it; a vote with no eligible seat is never raised and fails at once; `VoteForecast.tiebreakBy` is therefore always resolved and `VoteResult.tiebreakBy` is `null` only when there was no tie \| Unsourced (R p4: the first player breaks all ties; R p14: an exiled player cannot vote; nothing covers the combination) |
| R20.15 | Eliminated seats at game end \| they lose \| Unsourced (R p15: "that player is out of the game") |
| R20.16 | Requested cards and the crisis \| never contributable (`E_REQUESTED_CARD`); the FAQ's Outsider case is that card's own text \| Confirmed (R p11 states a requested card cannot be added to the crisis; F 3.1.2 conflicts for Outsider cards only) — already in `needs-rules-check` |
| R20.17 | Two seats without `twoPlayer` \| rejected (`E_BAD_SETUP`) \| Confirmed (R p15: the two-player game follows the co-op rules) |
| R20.18 | Zombie count per section during the colony phase \| fixed when the section starts; survivors added mid-section (R10.5) count only in later sections \| Unsourced (consistent with F 6.2.1's "not had zombies added yet") |
| R20.19 | Request addressed to the table \| `request.to` names one seat; asking the whole table is one `request` per seat, each a separate action with its own Crossroads evaluation; an additive `to: SeatId \| 'all'` raising `requestResponse` per non-exiled seat until one gives may be added in M1 and logged in 00 §16 \| Unsourced (R p11 phrases the request as "1 or more item cards from other players", a table-wide ask the frozen shape cannot express) |
| R20.20 | Full colony vs survivor-adding Crossroads \| the card does not trigger when any of its options would add a survivor or helpless token; it stays held and returns to the bottom at turn end (`CrossroadsReturned`); the forced-option path of R12.6 is never used for a full colony \| Corrected (R p14 says such cards cannot be triggered, a card-level rule; the earlier option-level reading was ours) |
| R20.21 | Visibility of equipped crisis contributions \| `CardContributed {from:'equipped'}` is public with its id; only hand contributions are hidden; `query.crisis` scores equipped contributions for every viewer; `types.ts Contribution` has no `from` field, so the view derives it from the equipped-card history (an additive `from` on `Contribution` is recommended before the freeze) \| Confirmed (R p11: only cards from the hand are placed face down) |
