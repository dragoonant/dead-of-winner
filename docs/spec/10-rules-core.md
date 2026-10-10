# 10. Rules core

The complete rules of Dead of Winter (base game) as the engine implements them. Mechanics follow the
original 1:1; all wording here is ours. Every clause has a stable number and a source reference.

**Source keys.** `R pN` = official rulebook page, `F x.y` = official FAQ v1.1 entry, both as cited by
the brief (`docs/DEAD-OF-WINTER-HANDOFF.md` Part E; the PDFs are not in this container). `E.n` /
`C.n` = brief section. `[UBG]` = https://www.ultraboardgames.com/dead-of-winter/game-rules.php,
`[RP]` = https://rulespal.com/dead-of-winter/rulebook (public rules summaries, read 2026-10-10),
`[OG]` = https://www.orderofgamers.com/downloads/DeadofWinter_v1.2.pdf (Order of Gamers fan rules
summary v1.2, read 2026-10-10).
`Ruling` = see the Rulings section at the end.

**Seat directions.** Seats are stored in clockwise turn order. `left(s)` = next seat clockwise,
`right(s)` = previous seat. The client renders any seat count; the human is the near edge (C.6).

---

## 10.0 General principles

- 10.0.1 Card text beats this spec when they disagree. (R p15; E intro)
- 10.0.2 When two or more effects would trigger at the same moment, the first player chooses their
  order (decision `orderEffects`, seat = first player). (E intro; [UBG])
- 10.0.3 No card or ability may interrupt an effect already resolving. Example: a medicine card
  cannot be played to save a survivor while the third wound is being applied. (E intro)
- 10.0.4 All ties not otherwise covered are broken by the first player, including exile votes
  (10.12.5). ([UBG])
- 10.0.5 Single generic mechanisms. Every rule below that kills, adds zombies or rolls exposure goes
  through exactly one of these engine functions; cards reach them through the `21` DSL:
  - `killSurvivor(target, cause)` (10.9.6): every death and every "lost/removed" survivor.
  - `addZombies(location, n, source)` (10.8.3): every zombie placement, one at a time, with
    barricade breaking and overrun resolution.
  - `rollExposure(survivor, location, reason)` (10.7.4): every exposure roll, including the bite
    chain.
- 10.0.6 Hidden information: only `view(state, seatId)` reaches deciders. Hidden: other hands
  (count only), other secret objectives, face-down crisis contributions (which cards; each seat's
  contribution count and the total are public, 10.4.16), the held
  Crossroads card (except to its holder), all deck orders. (C.4)
- 10.0.7 Exactly one `PendingDecision` is open at a time; it names a `seat` or `'all'`
  (simultaneous votes). `legalActions` is never empty for an open decision; a turn decision always
  includes `endTurn`. (C.4; CLAUDE.md)
- 10.0.8 The engine computes every number the UI shows: crisis total, food needed, exposure odds,
  attack-on-survivor odds, zombies to be added. (CLAUDE.md)
- 10.0.9 No hand limit. ([RP] silent; Ruling R-HAND)
- 10.0.10 Component counts that are physical limits (zombie standees, wound tokens, food, noise,
  barricade tokens) are not limits in the engine; it tracks integers. Exception: noise and
  barricades are limited by board spaces (10.2). (R p13 "use tokens when standees run out"; Ruling
  R-TOKENS)

## 10.1 Components and quantities (R p2; E.1)

| id | Component | Qty | Notes |
|---|---|---|---|
| 10.1.1 | Main objectives | 10 | double-sided: normal and hardcore side |
| 10.1.2 | Secret objectives (non-betrayal) | 24 | |
| 10.1.3 | Betrayal secret objectives | 10 | |
| 10.1.4 | Exiled secret objectives | 10 | |
| 10.1.5 | Survivor cards | 30 | name, profession, influence, attack, search, ability; influence values are unique (Ruling R-INFL) |
| 10.1.6 | Starting item cards | 25 | |
| 10.1.7 | Location item decks | 6 x 20 | Police Station, Grocery Store, School, Gas Station, Library, Hospital |
| 10.1.8 | Crisis cards | 20 | prevent section of 1–2 symbols, failure effect, optional bonus |
| 10.1.9 | Crossroads cards | 80 | some carry a mature mark (10.3.4) |
| 10.1.10 | Wound tokens | 25 | double-sided: wound / frostbite |
| 10.1.11 | Helpless survivor tokens | 20 | |
| 10.1.12 | Food / noise / barricade tokens | 20 each | |
| 10.1.13 | Starvation tokens | 6 | |
| 10.1.14 | Zombies | 30 standees + 30 overflow tokens | engine: unlimited (10.0.10) |
| 10.1.15 | Survivor standees | 30 | |
| 10.1.16 | Action dice | 30 d6 | |
| 10.1.17 | Exposure die | 1 d12 | faces in 10.7.1 |

- 10.1.18 Item symbol types: Weapon, Fuel, Education, Food, Medicine, Tool, Survivor (outsider /
  survivor-adding cards). A crisis card's prevent section shows 1 or 2 of these symbols
  (10.4.14). (E.1; R p12; [OG] Cards; Ruling R-PREVENT2)

## 10.2 Board (R p5; E.2)

- 10.2.1 Seven locations: the Colony plus six non-colony locations. Engine location order (used by
  Add Zombies and noise, 10.4.12): `colony, police, grocery, school, gas, library, hospital`
  (Ruling R-LOCORDER). Table layout: colony at the origin, the six location cards around it (C.6).
- 10.2.2 Colony: six numbered entrances (1–6), each with a fixed number of entrance spaces; a pool of
  survivor spaces ("colony occupants"); morale track; round track; food supply; main objective
  slot; waste pile; crisis deck; crisis contribution area. (E.2)
- 10.2.3 Each non-colony location: N survivor spaces, one entrance with M entrance spaces, exactly 4
  noise spaces, its item deck, and a symbol-likelihood row (display only). (E.2; [RP] "4 noise")
- 10.2.4 An entrance space holds either one zombie or one barricade, never both. (R p5; [RP])
- 10.2.5 Space counts are data, not code: `src/data/core/locations.json` (spec 20 §20.2 owns every
  data path) holds `colony.entrances[1..6].spaces`,
  `colony.survivorSpaces`, and per location `survivorSpaces`, `entranceSpaces`, `symbolRow`. Until
  verified from photos the values are placeholders (Ruling R-SPACES): colony 3 spaces per entrance,
  30 survivor spaces; police 3/3, grocery 4/4, school 4/4, gas 2/2, library 3/3, hospital 4/4
  (survivor/entrance).
- 10.2.6 Morale is clamped to `[0, board.moraleMax]` (Ruling R-MORALEMAX). Food tokens never go
  below 0.
- 10.2.7 Helpless survivor tokens occupy colony survivor spaces. (R p14; Ruling R-HELPSPACE)

## 10.3 Setup (R p6–7; E.3)

- 10.3.1 Main objective: chosen or drawn (normal side; hardcore side in Hardcore/Co-op, 10.14).
  Set morale and the round track to its values. Apply its setup: starting zombies are placed with
  `addZombies` per listed location; starting helpless/food/other per its data. (R p6; E.3.1)
- 10.3.2 Secret objectives: shuffle the 24 non-betrayal cards; take 2 per seat; add 1 random
  betrayal card; shuffle; deal 1 per seat face down; the rest leave the game unseen. P(betrayer
  present) = n/(2n+1). (R p6; E.3.2)
- 10.3.3 Shuffle the crisis deck; form the survivor deck, exiled-objective deck and Crossroads deck.
  (R p6; E.3.3)
- 10.3.4 Option `excludeMature` (default off) removes mature-marked Crossroads cards. (E.3.3)
- 10.3.5 Deal 5 starting items per seat as their hand; the remaining starting items leave the game.
  (R p7; E.3.4)
- 10.3.6 Shuffle each location deck onto its location. (R p7; E.3.5)
- 10.3.7 Deal 4 survivors per seat. Each seat keeps 2 (decision `chooseSurvivors`), then names one
  as group leader (decision `chooseLeader`); the others are followers. Returned survivors go back;
  reshuffle the survivor deck. All kept survivors start at the colony. Decisions are simultaneous
  in rules but the engine asks seats in turn order; a seat's view never shows other seats' picks
  until all have chosen. (R p7; E.3.6; Ruling R-SETUPORDER)
- 10.3.8 The seat whose leader has the highest influence takes the first-player token. (R p7; E.3.7)
- 10.3.9 Food supply starts at the objective's value (0 if unspecified); no starvation tokens; waste
  pile empty. (R p6)

## 10.4 Round order (R p8, p12–13; E.4)

A round = Player Turns Phase then Colony Phase. The game may end at any `checkGameEnd` point (10.13).

### Player Turns Phase
- 10.4.1 Reveal the top crisis card. It is public. (R p8)
- 10.4.2 Roll dice: every seat discards all unused dice from last round and rolls `1 + survivors it
  controls` d6 (helpless tokens are not controlled and give none). Dice belong to the seat, not to a
  survivor; any die may pay for any of the seat's survivors; several dice may go to one survivor.
  Survivors added mid-round give their die only at the next roll. (R p8; E.4.2; E.9)
- 10.4.3 Turns run clockwise from the first player; each seat takes exactly one turn per round
  (exiled seats included). (R p8)
- 10.4.4 Start of turn, in order: (a) `right(active)` draws the top Crossroads card and holds it
  secretly (10.10); (b) frostbite: every survivor of the active seat with ≥1 frostbite token takes
  1 wound, then death checks (10.7.3). (R p8, p11; [RP]; Ruling R-TURNSTART)
- 10.4.5 The active seat performs actions (10.5, 10.6) one at a time, in any order and number, until
  it chooses `endTurn` or has no option but `endTurn`. After every resolved action the engine
  evaluates the held Crossroads trigger (10.10.3) and `checkGameEnd`. (R p8; C.4; F 2.1.1)
- 10.4.6 End of turn: an untriggered Crossroads card goes to the bottom of its deck. (R p12)

### Colony Phase (steps strictly in order)
- 10.4.7 **Pay food.** `need = ceil(colonySurvivors / 2)`, where colonySurvivors counts every
  survivor and helpless token at the colony (survivors elsewhere do not count). If `food ≥ need`,
  remove `need` food. Otherwise remove none, add 1 starvation token, and lose morale equal to the
  number of starvation tokens now in the supply. No morale loss on a round where food is paid, even
  with starvation tokens present. Starvation tokens stay unless a card removes them. (R p12; F 6.1.1)
- 10.4.8 **Check waste.** Lose `floor(waste / 10)` morale. (R p12; [UBG])
- 10.4.9 **Resolve crisis** (10.4.13–10.4.16).
- 10.4.10 **Add zombies** (10.8.6).
- 10.4.11 **Check main objective.** If complete, the game ends now (10.13.1). (R p13)
- 10.4.12 **Move the round tracker** down 1; at 0 the game ends now with no objective check
  (10.13.1). (R p13)
- 10.4.12a **Pass the first-player token** to `right(firstPlayer)`. (R p13; E.4.7; [RP]; [OG] step 7; Ruling R-FIRSTPASS)

### Crisis resolution (R p12; E.4.3)
- 10.4.13 During any seat's own turn it may add any number of item cards face down from hand or
  from its survivors' equipped items (10.6.2). Exiled seats cannot (10.11.4). Cards are placed
  openly face down, so how many cards each seat added is public at once; which cards is not
  (spec 40 Ruling "Visible per-seat crisis contribution counts").
- 10.4.14 At resolution the engine shuffles the contributions and reveals them one at a time
  (presentation order only). The prevent section is a set of 1 or 2 symbols. Each card whose symbol
  is in that set = +1 (with two symbols, any mix of the two scores), every other card = −1. A food
  card counts as 1 card regardless of how much food it would give. (R p12 "a symbol matching a
  symbol in the prevent section"; [OG] Cards "any combination"; E.6; Ruling R-PREVENT2)
- 10.4.15 `players` = number of non-exiled seats. `total ≥ players` → prevented; `total ≥ players +
  2` → prevented and +1 morale; otherwise the crisis failure effect resolves (DSL). Optional bonus
  contributions on some crises resolve per card text. (R p12 and its crisis example; [RP] "the
  number of non-exiled players"; [UBG]; [OG] abbreviates to "number of players"; Ruling
  R-CRISISPLAYERS)
- 10.4.16 All contributed cards leave the game (not the waste pile). The crisis card leaves the
  game. Contribution identities stay hidden in views until the end recap, except the revealed
  symbols at resolution (count per symbol, not per seat). Each seat's contribution count (how many
  cards, not which) is public from the moment it contributes: `view.ts` `SeatPublic.contributed`
  per seat and `crisis.contributed` in total (10.4.13; spec 40 Ruling). (R p12; C.4)

## 10.5 Actions that need a die (R p8–10; E.5)

Common: the acting survivor belongs to the active seat; the die is unused; the spent die is gone
for the round. Every die action names one survivor.

- 10.5.1 **Attack a zombie.** Die ≥ survivor's attack value; a zombie at the survivor's location.
  Remove the zombie, then `rollExposure(attacker, location, 'kill')`. At the colony the seat picks
  the zombie at any entrance. Repeatable, one qualifying die per attack. (R p9; R p13; E.5; E.8)
- 10.5.2 **Attack a survivor.** Die ≥ attacker's attack value; target is a non-helpless survivor at
  the same location controlled by another seat. Roll the spent die again: if the result ≤ the
  **target's** attack value, the target takes 1 wound (death check) and the attacker takes one
  random card from the target seat's hand. No exposure roll. Allowed anywhere, exiled or not.
  (R p9; E.5; [UBG])
- 10.5.3 **Search.** Survivor at a non-colony location with a non-empty deck; die ≥ survivor's
  search value. Draw 1 card (private). Loop: stop (`searchStop`) or, if the location has an empty
  noise space, place a noise token there and draw 1 more (`searchMore`). When the loop ends, keep
  exactly 1 of all cards drawn (decision `searchKeepWhich`, action `searchKeep`); the rest go to
  the bottom of that deck in an order the engine fixes (seeded). Kept cards go to hand.
  Repeatable. (R p10; E.5; decisions `searchKeepOrNoise`, `searchKeepWhich`)
- 10.5.4 **Barricade.** Any die; an empty entrance space at the survivor's location (colony: seat
  chooses the entrance). Place a barricade. (R p10; E.5)
- 10.5.5 **Clean waste.** Any die; survivor at the colony. Remove the top 3 waste cards from the
  game (fewer if fewer). (R p10; E.5)
- 10.5.6 **Attract.** Any die. Move exactly `min(2, zombies at other locations, empty entrance
  spaces at the survivor's location)` zombies, chosen one at a time from any other location(s),
  into empty entrance spaces at the survivor's location. The seat may not move fewer when 2 can
  move. Attract never places into a full entrance, never breaks barricades and never overruns; it
  stops early only when no empty space or no source zombie remains. (R p10; [RP] "move 2
  zombies"; [OG]; F 5.1.1; Ruling R-ATTRACTSHORT)
- 10.5.7 **Survivor ability `(N+)`.** Die ≥ N per use; repeatable unless the card says once per
  round. `(4)` on Loretta Clay reads as `(4+)`. (R p10; F 1.2.1)

## 10.6 Actions that need no die (R p10–11; E.6)

- 10.6.1 **Play a card** (active seat only). Resolve its effect; it goes to the waste pile, unless it
  is an Equip card, which attaches to one of the seat's survivors (any location) and stays until
  contributed or handed off. Exiled: played cards leave the game instead (10.11.4). A played Outsider card (card data marks
  the type) always leaves the game instead of entering the waste, exiled or not, and counts as an
  item card everywhere else (F 3.1.2; [OG] Cards; Ruling R-OUTSIDER). Cards that add
  a survivor (helpless included) cannot be played when the colony has no empty survivor space
  (exiled: a non-colony space, 10.11.4). (R p10; E.6; E.9)
- 10.6.2 **Contribute to the crisis.** Any number of hand or equipped cards, face down. (R p10; E.6)
- 10.6.3 **Move.** Each survivor at most once per turn, to any other location with an empty survivor
  space (the colony counts). Then `rollExposure(survivor, destination, 'move')`. A survivor added
  this turn may move. (R p10; [RP]; E.6)
- 10.6.4 **Spend food.** Remove 1 food token: +1 to one unused die, never above 6; illegal with no
  unused die below 6. Exiled seats cannot. (R p10; F 5.3.1)
- 10.6.5 **Request.** The active seat names an item need; each other seat in turn order answers
  `give <card>` or `decline` (decision `requestResponse`). A given card is revealed and the
  requester must play it at once for its effect or to pay an ability cost; it cannot be contributed
  to the crisis. Exception by type: a given Outsider card may be contributed to the crisis instead
  of played (Ruling R-REQUEST). Exiled seats may request and give. (R p11; F 5.2.1; F 3.1.2; [OG]
  Cards)
- 10.6.6 **Hand off.** Move an equipped item from one survivor to another survivor at the same
  location. A once-per-round item ability already used stays used. (R p11; E.6; Ruling R-HANDOFF)
- 10.6.7 **Call an exile vote** (10.12). Once per turn, naming another non-exiled seat; never
  itself. (R p11; R p15; E.6; [RP]; [OG])
- 10.6.8 **End turn.** Always legal. (C.4)

## 10.7 Exposure and the bite chain: `rollExposure` (R p11; E.7)

- 10.7.1 Exposure d12 faces: 6 blank, 3 wound, 2 frostbite, 1 bitten (50% / 25% / 16.7% / 8.3%).
  (Ruling R-D12)
- 10.7.2 Effects: blank = nothing; wound = 1 wound token; frostbite = 1 frostbite token (counts as a
  wound, 10.4.4b); bitten = `killSurvivor(s, 'bite')` then the bite spreads (10.7.5). (R p11)
- 10.7.3 Death check: a survivor with ≥3 wound+frostbite tokens is killed at once via
  `killSurvivor(s, 'wounds')`; nothing interrupts it (10.0.3). (R p11; E intro)
- 10.7.4 `rollExposure(s, loc, reason)` is called after every move (at the destination) and every
  zombie kill. Card text may skip it. reason ∈ {`move`, `kill`, `card`}. (R p11; E.7)
- 10.7.5 **Bite chain.** `loc` = where the bitten survivor was killed (the move destination for a
  move). Loop: target = lowest-influence non-helpless survivor at `loc` (any seat; exiled included);
  if none, stop. Target's controller decides (`biteSpread`): (a) kill the target → `killSurvivor`,
  chain stops; or (b) roll the exposure die for the target: blank → target safe, chain stops; any
  other face → `killSurvivor(target, 'bite')` and loop again. (R p11; E.7; Ruling R-BITEHELPLESS)
- 10.7.6 Crossroads triggers evaluate only after the whole action including its exposure and bite
  chain has resolved (10.10.3). (F 2.1.1)

## 10.8 Zombies and overrun: `addZombies` (R p13; E.8)

- 10.8.1 Zombies have no identity; a location tracks per entrance `{zombies, barricades}`.
- 10.8.2 Entrance cursor: at the colony each `addZombies` call starts at entrance 1 and advances
  1→2→…→6→1 after each zombie. A non-colony location has one entrance. (R p13 example: 7th zombie
  at entrance 1; E.8)
- 10.8.3 `addZombies(loc, n, source)`: repeat n times, one zombie at a time, at the current entrance:
  1. an empty entrance space exists → place the zombie;
  2. else a barricade exists → remove 1 barricade, the zombie is discarded;
  3. else **overrun**: the zombie is discarded and `killSurvivor(lowest, 'overrun')` where `lowest`
     is the lowest-influence non-helpless survivor at `loc`; if only helpless remain, one helpless
     token is killed; if nobody is there, nothing happens.
  Then advance the cursor (colony). (R p13; E.8; [UBG] helpless last)
- 10.8.4 Card effects that "add zombies" use `addZombies`; Attract (10.5.6) and setup placement on
  empty boards never overrun.
- 10.8.5 Killing a zombie at the colony: the seat picks any entrance holding a zombie. (R p13)
- 10.8.6 **Colony-phase Add Zombies order** (F 6.2.1):
  1. Colony: `addZombies(colony, ceil(colonySurvivors/2))` (helpless count); `checkGameEnd`.
  2. Each non-colony location in 10.2.1 order: `addZombies(loc, survivorsThere)`; `checkGameEnd`
     after each location.
  3. Noise: for each location in order, for each noise token there: remove it, roll a d6, on ≤3
     `addZombies(loc, 1)`. Then `checkGameEnd`. (R p13; [RP])
- 10.8.7 Noise spaces are cleared only by 10.8.6.3; up to 4 per location (10.2.3).

## 10.9 Survivors, leaders, helpless (R p14; E.9)

- 10.9.1 Each seat controls a group: one leader plus followers. Influence values are unique, so
  "lowest influence" never ties among survivor cards. (R p14; Ruling R-INFL)
- 10.9.2 Adding a survivor (item, Crossroads, card): drawn from the survivor deck (or as the card
  names); joins the colony (exiled: a non-colony location of the seat's choice with an empty
  survivor space). It may act this turn with existing dice; its die comes at the next roll. Needs
  an empty colony survivor space or the effect cannot be triggered/played. (R p14; E.9; E.11)
- 10.9.3 Helpless survivor tokens: added to the colony by cards; nobody controls them; no actions,
  no dice; count for food (10.4.7) and colony zombies (10.8.6.1); occupy survivor spaces; killed
  only when only helpless remain at an overrun, or by card text; each death costs 1 morale.
  An exiled seat's effects never add helpless tokens. (R p14; [RP]; E.11)
- 10.9.4 Wounds: wound and frostbite tokens sit on a survivor card; card effects may remove them.
  (R p11)
- 10.9.5 Leader replacement: if a seat's leader is killed or lost and it has followers, it picks a
  new leader among them (decision `newLeader`). (R p14; [RP])
- 10.9.6 `killSurvivor(target, cause)`, cause ∈ {`bite`, `wounds`, `overrun`, `attack`, `card`,
  `removed`}:
  1. Remove the survivor/token from its location and return its wound tokens.
  2. Equipped items: at the colony → back to the controller's hand; elsewhere → shuffled into that
     location's item deck. (R p10; [RP])
  3. Morale −1 unless cause = `removed` (a card that removes a survivor from the game, unless the
     card says otherwise) or the controller is exiled. Helpless deaths cost 1. (R p11; E.7)
  4. If it was the leader and followers remain → 10.9.5.
  5. If it was the seat's last survivor: every card in the seat's hand leaves the game, exiled or
     not (never the waste pile, so it never feeds the waste check 10.4.8); the seat draws a
     survivor who becomes leader at the colony (exiled: a non-colony location of its choice,
     F 6.2.1); in Player Elimination the seat is eliminated instead (10.14.5). (R p14 "removes from
     the game all cards in her hand"; [OG] Survivors; [RP] says "discards"; Ruling R-LASTHAND)
  6. Emit `survivorKilled` (Crossroads/objective hooks), then `checkGameEnd`. (R p14; E.9)
- 10.9.7 A survivor at a location with no free survivor space can still be placed by rules that
  force placement (10.11.6); voluntary moves need a free space (10.6.3).

## 10.10 Crossroads timing (R p12; F 2.x; E.10)

- 10.10.1 At the start of each turn `right(active)` draws one Crossroads card and keeps it secret
  (visible only in that seat's view; if the human is that seat it is shown face up). (R p12; C.4)
- 10.10.2 Each card has a trigger: a declarative DSL predicate over events (move, search result,
  wound type, location, survivor named or type, start of turn, etc.). (E.10; spec 21)
- 10.10.3 The engine evaluates the trigger after each resolved action of the active turn (an action
  is resolved when its exposure, bite chain and deaths are done). A survivor who dies mid-action
  does not satisfy a trigger that needs that action to finish. (F 2.1.1; C.4)
- 10.10.4 On trigger: reveal publicly; the active seat picks one option (decision
  `crossroadsOption`); an option that cannot be fulfilled is unavailable, leaving the other. Resolve,
  then remove the card from the game. At most one Crossroads card per turn. (R p12; [RP])
- 10.10.5 Untriggered at end of turn → bottom of the Crossroads deck. (R p12)
- 10.10.6 Any effect that searches a deck for a specific card reshuffles that deck afterwards.
  (R p12; E.10)

## 10.11 Exile (R p14; F 5.4; E.11)

- 10.11.1 A seat is exiled by a successful vote (10.12). An exiled seat cannot be voted again.
- 10.11.2 Objective: every exiled seat immediately draws 1 exiled secret objective card, hidden
  (owner view only), before it moves its colony survivors (11 §7.1). The card adjusts the seat's
  winning condition per 11 §7.2–§7.3. It does not apply to a betrayal holder
  (`appliesToBetrayal: false`; verify from card photos), whose betrayal condition stands. Nothing
  is revealed: betrayer status stays hidden (R p7 forbids showing a secret objective) and the
  engine applies the two-exile rule (10.11.5) silently. (R p14; [RP]; [OG] Exile "adjusts his
  secret objective"; Ruling R-EXILEOBJ)
- 10.11.3 Immediately, every colony survivor of the exiled seat moves to a non-colony location of
  its choice with a free survivor space, rolling exposure each; these moves do not use the
  survivors' move for the turn. (R p14; E.11)
- 10.11.4 From then on the exiled seat: cannot contribute to crises; adds no helpless tokens; new
  survivors go to a non-colony location; cannot spend food tokens on dice (a food card it plays
  gives +1 die each instead of its effect); cannot vote; its survivors' deaths cost no morale; its
  played cards leave the game instead of entering the waste; its survivors never move into the
  colony (Ruling R-EXILECOLONY). It may still request and give cards, contribute to the main
  objective, play food cards for food tokens, attack, search and call votes. (R p14; E.11; [RP];
  [OG] Exile; Ruling R-EXILEFOOD)
- 10.11.5 If two seats are exiled and neither holds a betrayal objective, morale drops to 0 at once
  (game ends, 10.13.1). (R p14; [UBG]; [RP])
- 10.11.6 If an exiled survivor must be placed and no non-colony location has a free survivor space,
  move one non-exiled survivor from a location to the colony (no move used, no exposure), then
  place the exiled survivor there. The exiled seat chooses which. (F 5.4.1)

## 10.12 Voting (R p15; E.6; C.4)

- 10.12.1 The active seat (exiled or not) may call one exile vote per turn, naming another
  non-exiled seat. A seat can never target itself. (R p11 "cannot initiate a vote to exile
  themselves"; [RP]; [OG]; Ruling R-SELFVOTE)
- 10.12.2 Before votes, table talk may happen (persona lines, spec 41); this adds no decision.
- 10.12.3 Every non-exiled seat, the caller and the target included, votes simultaneously:
  `VoteCalled{purpose:'exile', caller, target, sourceKey:null, options}` opens one
  `PendingDecision{seat:'all', kind:'vote', purpose:'exile', options:[{id:'yes'},{id:'no'}], voters}`;
  a ballot is an option id, and answers are collected privately and submitted as one
  `castVotes{votes: Record<SeatId, optionId>}` action. No seat's view shows another's vote before all are cast. (C.4; [UBG])
- 10.12.4 The result is a `VoteRecord` (`ballots`, `tiebreak`, `result`, `exiled`). More yes than no → the target is exiled (10.11). More no → nothing.
- 10.12.5 Tie → the first player decides: the outcome equals the first player's vote; if the first
  player is exiled (did not vote), it answers a `voteTiebreak` decision. ([UBG]; Ruling R-VOTETIE)
- 10.12.6 Votes are revealed publicly after resolution.
- 10.12.7 **Card votes.** A Crossroads (or other) card that calls a vote uses the same ballot: one
  `PendingDecision{seat:'all', kind:'vote', purpose:'card'}` whose `options` are the card's own
  option ids (each `{id, label?}`), with `sourceKey`/`sourceCard` naming the card op, collected as
  one `castVotes` (`VotesCast{purpose:'card', result: <winning option id>}`); every non-exiled seat
  votes; ties follow 10.12.5 (first player); votes are revealed
  after resolution (10.12.6). The card's data defines each option id and what it does (the winning option id is `result`); nobody is exiled
  unless the card says so. A card vote is not the active seat's once-per-turn exile vote
  (10.12.1). (R p15; [RP] "a crossroads-called vote"; [OG] Voting; Ruling R-CARDVOTE)

## 10.13 Ending and winning (R p14; E.12)

- 10.13.1 `checkGameEnd` ends the game immediately when: morale ≤ 0; the round track reaches 0
  (10.4.12); or the main objective is found complete at 10.4.11 (or an objective/card says the game
  ends). Morale and round endings skip the main objective check. (R p14; E.12)
- 10.13.2 Each seat then wins iff its current secret objective is complete at that moment (exiled:
  its exiled objective; betrayer: its betrayal objective). Whether an objective requires the main
  objective is a clause in its card data (11 §4.1); the engine never adds it. Any number of seats may win, including none. (R p14; [RP])
- 10.13.3 End recap reveals all secret objectives, all face-down contributions by seat and crisis,
  every Crossroads card drawn and whether it triggered, and every vote. (C.4)

## 10.14 Variants (R p15; E.13) — LATER: build the standard game first; each is a setup flag

- 10.14.1 `coop`: hardcore side, no secret objectives, no exile/votes, remove non-co-op cards.
- 10.14.2 `twoPlayer`: co-op rules, 7 starting items each, keep 3 of 4 survivors.
- 10.14.3 `betrayerVariant`: secret pool = 1 non-betrayal per seat + 1 betrayal; P = n/(n+1).
- 10.14.4 `hardcore`: normal game on the hardcore side.
- 10.14.5 `playerElimination`: a seat losing its last survivor is out (10.9.6.5) instead of drawing.
- 10.14.6 `excludeMature`: see 10.3.4 (available from M1; trivial filter).

## 10.15 Decision kinds referenced here (C.4)

`chooseSurvivors`, `chooseLeader`, `turnAction`, `searchKeepOrNoise`, `searchKeepWhich`,
`crisisContribution` (inside `turnAction`), `requestResponse`, `crossroadsOption`, `biteSpread`,
`newLeader`, `exilePlacement`, `vote` (seat `'all'`), `voteTiebreak`, `orderEffects`,
`objectiveChoice`, `itemTarget`.

---

## Rulings

RULING: R-REQUEST requested cards and the crisis (R p11 vs F 3.1.2) | Given cards are played at once and never contributed to a crisis, except Outsider cards: as a type they may be requested and then contributed (10.6.5) | Fan-source + FAQ (F 3.1.2 per brief; [OG] Cards "can even request and play these cards into the crisis"); replaces the earlier one-card exception
RULING: R-D12 exposure faces | 6 blank, 3 wound, 2 frostbite, 1 bitten | Fan-source (brief E.7 community count; matches C.5 odds 25/17/8); verify on a physical die
RULING: R-SPACES board space counts | Data file with placeholders (colony 3 per entrance, 30 occupant spaces; police 3/3, grocery 4/4, school 4/4, gas 2/2, library 3/3, hospital 4/4) | Unsourced; [UBG] and [RP] give no counts; verify from board/card photos into docs/spec/sources/
RULING: R-LOCORDER non-colony order for Add Zombies | police, grocery, school, gas, library, hospital (brief E.1 listing order) | Unsourced; the rulebook p5 arrangement should replace it if it differs
RULING: R-INFL influence ties | Treated as impossible (unique influence values); data validation asserts uniqueness | Unsourced
RULING: R-HAND hand limit | None | Unsourced ([UBG]/[RP] state none)
RULING: R-TOKENS physical token caps | Not enforced except via board spaces | Confirmed for zombies (R p13 overflow tokens); Unsourced for others
RULING: R-MORALEMAX morale ceiling | Clamp at the board track maximum (data value) | Unsourced
RULING: R-HELPSPACE helpless occupy colony spaces | Yes; they block survivor additions when full | Unsourced
RULING: R-SETUPORDER survivor choice | Seats choose in turn order with hidden picks | Unsourced (table does it simultaneously; outcome identical)
RULING: R-TURNSTART start-of-turn order | Crossroads draw, then frostbite wounds | Unsourced
RULING: R-FIRSTPASS first-player token direction | Passes to the right (previous seat clockwise) while turns run left | Confirmed (R p13 per brief E.4.7; [RP] "passes the token to the player on his right"; [OG] step 7)
RULING: R-BITEHELPLESS bite spread and helpless tokens | Spread skips helpless tokens | Unsourced ([RP] silent); consistent with overrun killing helpless last
RULING: R-HANDOFF hand-off target | Any survivor at the same location, including another seat's | Unsourced
RULING: R-EXILEOBJ exiled objective | Every exiled seat draws 1 hidden exiled objective; it does not apply to a betrayal holder (appliesToBetrayal:false, verify from card photos); nothing is revealed and the engine applies 10.11.5 silently | Corrected (R p14; [RP] "the exiled player immediately draws 1 exiled secret objective card", R p7 no showing; [OG] v1.2 "adjusts his secret objective"); the earlier public-reveal ruling is withdrawn
RULING: R-EXILEFOOD exiled food cards | Exiled seat chooses per food card: food tokens, or +1 die each | Unsourced (brief E.11 lists both)
RULING: R-VOTETIE exile vote ties | First player's vote decides; exiled first player gets a tiebreak decision | Confirmed ([UBG]: ties broken by the first player, including exile votes)
RULING: R-EMPTYDECK search with empty location deck | Search is illegal at a location whose deck is empty | Unsourced ([RP] silent)
RULING: R-ATTACKSURV attacking survivors | Allowed at any shared location, exiled or not; target's attack value is the threshold | Confirmed ([UBG]; brief E.5)
RULING: R-LASTHAND last survivor lost | The whole hand leaves the game for every seat, exiled or not; it never enters the waste | Corrected (R p14 "removes from the game all cards in her hand"; [OG] Survivors); [RP] says "discards"
RULING: R-PREVENT2 crisis prevent section | A set of 1–2 symbols; a card scores +1 if its symbol is in the set | Corrected (R p12 "a symbol matching a symbol in the prevent section"; [OG] Cards "two item symbols ... any combination")
RULING: R-OUTSIDER played Outsider cards | Leave the game instead of entering the waste; count as item cards otherwise | Fan-source + FAQ ([OG] Cards; F 3.1.2 per brief)
RULING: R-CRISISPLAYERS crisis threshold | `players` = non-exiled seats | Confirmed (R p12 crisis example; [RP] "the number of non-exiled players"); [OG] abbreviates to "number of players"
RULING: R-SELFVOTE exile vote target | Another non-exiled seat; never the caller | Confirmed (R p11; [RP]; [OG] "You cannot initiate a vote to exile yourself")
RULING: R-CARDVOTE votes called by cards | Same seat:'all' ballot, non-exiled seats vote, first player breaks ties, card data decides the outcome | Unsourced for the procedure ([RP] and [OG] mention Crossroads-called votes only in passing); reuses the exile-vote rules
RULING: R-ATTRACTSHORT attract with fewer than 2 movable | Moves exactly min(2, available source zombies, empty spaces); never fewer by choice | Unsourced for the short case; "move 2 zombies" is Confirmed (R p10; [RP]; [OG])
RULING: R-EXILECOLONY exiled survivors and the colony | Exiled survivors cannot enter the colony (no move there; forced placement only for non-exiled survivors, 10.11.6) | Unsourced (implied by F 5.4.1 and non-colony placement in R p14; [RP] and [OG] state no explicit ban)
