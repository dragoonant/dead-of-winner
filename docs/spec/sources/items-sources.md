# Items: sources (research 2026-10-09, updated 2026-10-10)

The 25 starting items and the six 20-card location decks of the base game (the wiki's "Dead of Winter" column
only; The Long Night and Warring Colonies columns are ignored). Values are card names, symbol types and counts.
Effect text is ours, one line each, written from the BGG Card Spread (BC) and cross-checked against the Portuguese
fan translation (P). Fan files were read in the session and are not committed.

## Source tags

| Tag | Source | What it gave | Strength |
|---|---|---|---|
| R | Plaid Hat rulebook (2014), `docs/sources/DoW-Rulebook.txt`: p2 components, p5 board and location-card legend, p6 setup, p8-10 examples with the Fuel and Lighter cards | the seven symbol types, 25 starting items, 6 x 20 location cards, noise cap of 4 per location, printed Fuel and Lighter cards | highest; card faces are in garbled column order in the extract |
| F | FAQ v1.1, `docs/sources/DoW-FAQ.txt`, 1.3.2, 3.1, 5.1.1 | medicine-symbol cards include Adrenaline Shot; Outsider cards rules; the FAQ names a "Microphone" item card in 5.1.1 (see I3) | highest where it speaks |
| W | Dead of Winter Fandom wiki: `*_Item_Deck.txt` for the six locations and `Starter_Item_Deck.txt`, plus `Item.txt`, `Equip.txt`, `Event.txt`, `Waste_Pile_ability.txt`, symbol pages | per-deck card names, symbol types and counts; Equip, Event and Waste Pile definitions | medium: player-maintained; counts sum to 20 in every deck, which supports them |
| O | Esoteric Order of Gamers rules summary v1.2 (Mar 2016), `orderofgamers-summary-v1.2.txt` | Outsider cards are removed from the game when used and count as item cards for objectives | medium (a summary of R) |
| BC | BGG "Dead of Winter Card Spread" sheet, `docs/sources/bgg/Dead_of_Winter_Card_Spread.xlsx.txt`, read 2026-10-10 | per deck: counts by symbol (header row in the card's symbol order), every card name and count, the class (Equip, Waste Pile, Event) and effect of every distinct item | medium-high: one volunteer sheet, matches P and R where they overlap |
| P | Portuguese fan translation, Ludopedia attachment 51114 (25 starter items and six 20-card decks), downloaded by the owner 2026-10-10; read through `docs/sources/fan/ludopedia-transcription.md` | the same decks and counts, with effect text | medium: a translation; outranks BC and W by the precedence rule, and agrees with BC on every count; a `P*` tag in a row means P words that card differently, see I7 to I9 |
| BO | Plaid Hat official rulings digest, `docs/sources/bgg/official-rulings.txt` | effect rulings for Switchblade, Baseball Bat, Megaphone and Tikka T3, Blueprints | official |
| S | Self-consistency (ours) | each location deck sums to exactly 20, the starter deck to exactly 25 | supports W |

## What a card is (R p2, p6)

A card has a name, one of 7 symbol types (Weapon, Fuel, Education, Food, Medicine, Tool, Survivor), an optional
ability line, and a location that says which deck it starts in. An ability line may start with WASTE PILE (the
card goes on the waste pile when played), EVENT (removed from the game when played) or EQUIP (placed beside a
survivor you control and stays; cannot be unequipped except when added to a crisis or handed off; if the bearer
dies at the colony the cards return to the owner's hand, elsewhere they are shuffled into that location's deck)
(W, R p9-10; BC fixes the class of every distinct card, table rows below). A Survivor-symbol card is an "Outsider" card; per the FAQ it counts as an item card for secret
objectives, may be held in hand and requested, and (O) leaves the game instead of going to the waste pile.

Setup (R p6): shuffle the starter deck and deal 5 per player (7 in the two-player variant); box the rest.
Each location deck is shuffled onto its location card.

The wiki gives class and effect for almost no card; the BGG Card Spread (BC) gives all of them and P agrees on every
card except the three wording differences listed under "Verification against P and BC". Fuel and Lighter also carry R.

## Starting items (25)

| Symbol | Card | Count | Class | Effect (our words) | Tags |
|---|---|---|---|---|---|
| Food | Food 1 | 10 | Waste Pile | Add 1 food token to the food supply. | W,S,BC,P |
| Medicine | Medicine | 5 | Waste Pile | Heal one wound on a survivor you control, or on another player's survivor sharing a location with one of yours (BC). R p12: played after a wound lands, it cannot save a survivor from a lethal wound. | W,S,BC,P |
| Fuel | Fuel | 5 | Waste Pile (R, BC) | When moving a survivor you control, skip the exposure roll for that move (R sample card, BC). | W,S,R,BC,P |
| Tool | Junk | 5 | Waste Pile | Reroll one of your unused action dice. | W,S,BC,P |

Notes: the wiki's Long Night column renames these ("Food 1 or Trade", "Fuel or Fire", "Junk or Advance"); the
Dead of Winter names above are the plain ones. 10 + 5 + 5 + 5 = 25 (S). Deal 5 per player (R p6). BC and P both list
the same 25 (Food 1 x10, Junk x5, Fuel x5, Medicine x5), so the starter deck is confirmed by two further sources.

## Locations and their 20-card decks

Space counts and the item-symbol row now come from the location-card photos and the rulebook diagram; the full
table, the cross-check against these deck counts and the rulings are in `locations-sources.md`. The 4 noise spaces
are R p5. The six locations are numbered 01 to 06 in the order below (Police Station, Grocery Store, School,
Library, Hospital, Gas Station). Each section's symbol row is the printed order, left to right, from likeliest to
least likely, and agrees with the BC header row of that deck.

### Police Station

- Survivor spaces: 3 (Ph; locations-sources.md)
- Entrance spaces: 4 (Ph; locations-sources.md)
- Noise spaces: 4 (R p5)
- Item-symbol row (left = likeliest): Weapon, Fuel, Tool, Food, Survivor (Ph, BC header order)
- Deck composition by type: Weapon 6, Fuel 4, Food 3, Tool 4, Survivor 3 = 20 (S)

| Symbol | Card | Count | Class | Effect (our words) | Tags |
|---|---|---|---|---|---|
| Weapon | Colt 1911 Pistol | 3 | Equip | Once per round, the bearer's attack skips the exposure roll. | W,S,BC,P |
| Weapon | FN SLP Shotgun | 1 | Equip | Once per round, the bearer's attack kills 2 zombies instead of 1, with no exposure roll, and adds a noise token at that location if able. | W,S,BC,P |
| Weapon | Tikka T3 Tactical Rifle | 2 | Equip | Once per round, kill 1 zombie at any location with no exposure roll; this is not an attack, so it needs no die (BC; BO says it is not an attack). | W,S,BC,P |
| Fuel | Fuel | 4 | Waste Pile (R, BC) | When moving a survivor you control, skip the exposure roll for that move (R sample card, BC). | W,S,R,BC,P |
| Tool | Junk | 1 | Waste Pile | Reroll one of your unused action dice. | W,S,BC,P |
| Tool | Night Vision Goggles | 1 | Equip | At the start of each round, roll 1 extra action die. | W,S,BC,P |
| Tool | Walkie Talkie | 1 | Equip | Once per round, may lower another player's unused die by 1 to raise one of your unused dice by 1 (must lower to raise). BC omits once per round; P prints it and outranks BC, see I7. | W,S,BC,P* |
| Tool | Pad Lock | 1 | Waste Pile | Build 2 barricades at a location where one of your survivors is; no die is used. | W,S,BC,P |
| Food | Food 1 | 3 | Waste Pile | Add 1 food token to the food supply. | W,S,BC,P |
| Survivor | 1 Outsider | 1 | Event (BC); removed from the game when played (O) | Draw the top survivor card and add it to your following (its standee goes to the colony); add no helpless survivors. | W,S,O,BC,P |
| Survivor | 2 Outsiders | 2 | Event (BC); removed from the game when played (O) | Draw the top survivor card and add it to your following (its standee goes to the colony); add 1 helpless survivor token to the colony. | W,S,O,BC,P |

### Grocery Store

- Survivor spaces: 3 (Ph; locations-sources.md)
- Entrance spaces: 4 (Ph; locations-sources.md)
- Noise spaces: 4 (R p5)
- Item-symbol row (left = likeliest): Food, Medicine, Tool, Survivor (Ph, BC header order)
- Deck composition by type: Food 6, Medicine 6, Tool 5, Survivor 3 = 20 (S)

| Symbol | Card | Count | Class | Effect (our words) | Tags |
|---|---|---|---|---|---|
| Food | Food 1 | 2 | Waste Pile | Add 1 food token to the food supply. | W,S,BC,P |
| Food | Food 2 | 2 | Waste Pile | Add 2 food tokens to the food supply. | W,S,BC,P |
| Food | Food 3 | 2 | Waste Pile | Add 3 food tokens to the food supply. | W,S,BC,P |
| Medicine | Medicine | 6 | Waste Pile | Heal one wound on a survivor you control, or on another player's survivor sharing a location with one of yours (BC). R p12: played after a wound lands, it cannot save a survivor from a lethal wound. | W,S,BC,P |
| Tool | Junk | 1 | Waste Pile | Reroll one of your unused action dice. | W,S,BC,P |
| Tool | Wrench | 1 | Equip | Once per round, spend any unused die to attack with the bearer. | W,S,BC,P |
| Tool | Snow Shoes | 1 | Equip | A frostbite wound the bearer would take becomes an ordinary wound. | W,S,BC,P |
| Tool | Hammer | 1 | Equip | Once per round, a barricade action builds 2 barricades instead of 1. | W,S,BC,P |
| Tool | Rotten Flesh | 1 | Equip | The bearer is ignored when a bite effect spreads. | W,S,BC,P |
| Survivor | 1 Outsider | 1 | Event (BC); removed from the game when played (O) | Draw the top survivor card and add it to your following (its standee goes to the colony); add no helpless survivors. | W,S,O,BC,P |
| Survivor | 2 Outsiders | 2 | Event (BC); removed from the game when played (O) | Draw the top survivor card and add it to your following (its standee goes to the colony); add 1 helpless survivor token to the colony. | W,S,O,BC,P |

### School

- Survivor spaces: 4 (Ph; locations-sources.md)
- Entrance spaces: 4 (Ph; locations-sources.md)
- Noise spaces: 4 (R p5)
- Item-symbol row (left = likeliest): Food, Education, Tool, Medicine, Survivor (Ph, BC header order)
- Deck composition by type: Education 4, Food 6, Medicine 3, Tool 4, Survivor 3 = 20 (S)

| Symbol | Card | Count | Class | Effect (our words) | Tags |
|---|---|---|---|---|---|
| Food | Food 1 | 3 | Waste Pile | Add 1 food token to the food supply. | W,S,BC,P |
| Food | Food 2 | 3 | Waste Pile | Add 2 food tokens to the food supply. | W,S,BC,P |
| Education | 1,2,3 Barricades | 1 | Equip | Once per round during your turn, if the bearer is at the colony, build a barricade without spending a die. | W,S,BC,P |
| Education | Guide to Leadership | 1 | Equip | Once per round, raise one of your unused action dice by 1. | W,S,BC,P |
| Education | Beginner's Martial Arts | 1 | Equip | Once per round, the bearer's attack skips the exposure roll. | W,S,BC,P |
| Education | School Blueprints | 1 | Equip | Once per round, a search at the School by the bearer may look at and keep 1 extra card. | W,S,BC,P |
| Tool | Junk | 1 | Waste Pile | Reroll one of your unused action dice. | W,S,BC,P |
| Tool | Scissors | 1 | Waste Pile | Kill 1 zombie at the location of one of your survivors, with no exposure roll. BC states no location; P states it and outranks BC, see I8. | W,S,BC,P* |
| Tool | Baseball Bat | 1 | Equip | Once per round, the bearer's attack kills 2 zombies instead of 1 (an exposure roll is still made for each kill, BO). | W,S,BC,P |
| Tool | Megaphone | 1 | Waste Pile | Move 4 zombies from one location to a location where one of your survivors is; works like attract, so only into empty spaces (FAQ 5.1.1, BO). P adds an optional shout with no rules effect, see I9. | W,S,BC,P* |
| Medicine | Medicine | 3 | Waste Pile | Heal one wound on a survivor you control, or on another player's survivor sharing a location with one of yours (BC). R p12: played after a wound lands, it cannot save a survivor from a lethal wound. | W,S,BC,P |
| Survivor | 2 Outsiders | 2 | Event (BC); removed from the game when played (O) | Draw the top survivor card and add it to your following (its standee goes to the colony); add 1 helpless survivor token to the colony. | W,S,O,BC,P |
| Survivor | 3 Outsiders | 1 | Event (BC); removed from the game when played (O) | Draw the top survivor card and add it to your following (its standee goes to the colony); add 2 helpless survivor tokens to the colony. | W,S,O,BC,P |

### Library

- Survivor spaces: 3 (Ph; locations-sources.md)
- Entrance spaces: 3 (Ph; locations-sources.md)
- Noise spaces: 4 (R p5)
- Item-symbol row (left = likeliest): Education, Fuel, Food, Tool, Survivor (Ph, BC header order)
- Deck composition by type: Fuel 4, Education 7, Food 4, Tool 2, Survivor 3 = 20 (S)

| Symbol | Card | Count | Class | Effect (our words) | Tags |
|---|---|---|---|---|---|
| Education | Hospital Blueprints | 1 | Equip | Once per round, a search at the Hospital by the bearer may look at and keep 1 extra card. | W,S,BC,P |
| Education | Gas Station Blueprints | 1 | Equip | Once per round, a search at the Gas Station by the bearer may look at and keep 1 extra card. | W,S,BC,P |
| Education | Library Blueprints | 1 | Equip | Once per round, a search at the Library by the bearer may look at and keep 1 extra card. | W,S,BC,P |
| Education | Police Station Blueprints | 1 | Equip | Once per round, a search at the Police Station by the bearer may look at and keep 1 extra card. | W,S,BC,P |
| Education | Grocery Store Blueprints | 1 | Equip | Once per round, a search at the Grocery Store by the bearer may look at and keep 1 extra card. | W,S,BC,P |
| Education | Survivor's Cookbook | 1 | Equip | Once per round, if the bearer is at the colony, add 1 food token to the food supply. | W,S,BC,P |
| Education | A Journey in Jazzercise | 1 | Equip | Once per round, reroll one of your unused action dice. | W,S,BC,P |
| Fuel | Fuel | 4 | Waste Pile (R, BC) | When moving a survivor you control, skip the exposure roll for that move (R sample card, BC). | W,S,R,BC,P |
| Food | Food 1 | 4 | Waste Pile | Add 1 food token to the food supply. | W,S,BC,P |
| Tool | Junk | 1 | Waste Pile | Reroll one of your unused action dice. | W,S,BC,P |
| Tool | Reading Lamp | 1 | Waste Pile | Make an attack with a survivor you control without spending a die. | W,S,BC,P |
| Survivor | 1 Outsider | 1 | Event (BC); removed from the game when played (O) | Draw the top survivor card and add it to your following (its standee goes to the colony); add no helpless survivors. | W,S,O,BC,P |
| Survivor | 2 Outsiders | 2 | Event (BC); removed from the game when played (O) | Draw the top survivor card and add it to your following (its standee goes to the colony); add 1 helpless survivor token to the colony. | W,S,O,BC,P |

### Hospital

- Survivor spaces: 4 (Ph; locations-sources.md)
- Entrance spaces: 4 (Ph; locations-sources.md)
- Noise spaces: 4 (R p5)
- Item-symbol row (left = likeliest): Medicine, Fuel, Food, Tool, Survivor (Ph, BC header order)
- Deck composition by type: Fuel 4, Food 4, Medicine 6, Tool 3, Survivor 3 = 20 (S)

| Symbol | Card | Count | Class | Effect (our words) | Tags |
|---|---|---|---|---|---|
| Medicine | Medicine | 4 | Waste Pile | Heal one wound on a survivor you control, or on another player's survivor sharing a location with one of yours (BC). R p12: played after a wound lands, it cannot save a survivor from a lethal wound. | W,S,BC,P |
| Medicine | Adrenaline Shot | 2 | Waste Pile | Set one unused action die to any value you choose; carries the medicine symbol (F 1.3.2). | W,S,F,BC,P |
| Fuel | Fuel | 4 | Waste Pile (R, BC) | When moving a survivor you control, skip the exposure roll for that move (R sample card, BC). | W,S,R,BC,P |
| Food | Food 2 | 4 | Waste Pile | Add 2 food tokens to the food supply. | W,S,BC,P |
| Tool | Junk | 1 | Waste Pile | Reroll one of your unused action dice. | W,S,BC,P |
| Tool | Mop | 1 | Equip | Once per round, a clean waste action removes 5 cards instead of 3. | W,S,BC,P |
| Tool | Flashlight | 1 | Equip | Once per round, when making noise, look at 3 cards instead of 1. | W,S,BC,P |
| Survivor | 2 Outsiders | 3 | Event (BC); removed from the game when played (O) | Draw the top survivor card and add it to your following (its standee goes to the colony); add 1 helpless survivor token to the colony. | W,S,O,BC,P |

### Gas Station

- Survivor spaces: 2 (Ph; locations-sources.md)
- Entrance spaces: 3 (Ph; locations-sources.md)
- Noise spaces: 4 (R p5)
- Item-symbol row (left = likeliest): Fuel, Weapon, Food, Medicine, Survivor (Ph, BC header order)
- Deck composition by type: Weapon 5, Fuel 6, Food 3, Medicine 3, Survivor 3 = 20 (S)

| Symbol | Card | Count | Class | Effect (our words) | Tags |
|---|---|---|---|---|---|
| Fuel | Fuel | 6 | Waste Pile (R, BC) | When moving a survivor you control, skip the exposure roll for that move (R sample card, BC). | W,S,R,BC,P |
| Weapon | FN SLP Shotgun | 1 | Equip | Once per round, the bearer's attack kills 2 zombies instead of 1, with no exposure roll, and adds a noise token at that location if able. | W,S,BC,P |
| Weapon | Switchblade | 2 | Equip | Once per round, spend any unused die to attack with the bearer; this changes only the die needed, so other attack effects still combine with it (BO). | W,S,BC,P |
| Weapon | Lighter | 2 | Equip (R, BC) | Once per round, the bearer's attack may burn a fuel card to kill 4 zombies instead of 1, with no exposure roll; the fuel card's own ability is not used. | W,S,R,BC,P |
| Food | Food 1 | 3 | Waste Pile | Add 1 food token to the food supply. | W,S,BC,P |
| Medicine | Medicine | 3 | Waste Pile | Heal one wound on a survivor you control, or on another player's survivor sharing a location with one of yours (BC). R p12: played after a wound lands, it cannot save a survivor from a lethal wound. | W,S,BC,P |
| Survivor | 1 Outsider | 1 | Event (BC); removed from the game when played (O) | Draw the top survivor card and add it to your following (its standee goes to the colony); add no helpless survivors. | W,S,O,BC,P |
| Survivor | 2 Outsiders | 2 | Event (BC); removed from the game when played (O) | Draw the top survivor card and add it to your following (its standee goes to the colony); add 1 helpless survivor token to the colony. | W,S,O,BC,P |

## Verification against P and BC (2026-10-10)

Every deck was compared card by card with BC and with P. The six location decks have 20 cards each and the starter
deck 25; every name, symbol and count below agrees across W, BC and P, except the points named here.

| Deck | Total | W | BC | P | Result |
|---|---|---|---|---|---|
| Starter (Food 1 x10, Junk x5, Fuel x5, Medicine x5) | 25 | yes | yes | yes | confirmed |
| 01 Police Station (Weapon 6, Fuel 4, Tool 4, Food 3, Survivor 3) | 20 | yes | yes | yes | confirmed |
| 02 Grocery Store (Food 6, Medicine 6, Tool 5, Survivor 3) | 20 | yes | yes | yes | confirmed (Rotten Flesh is Rotting Flesh in W) |
| 03 School (Food 6, Education 4, Tool 4, Medicine 3, Survivor 3) | 20 | Football Pads | Megaphone | Megaphone | confirmed with Megaphone, see I6 |
| 04 Library (Education 7, Fuel 4, Food 4, Tool 2, Survivor 3) | 20 | yes | yes | yes | confirmed |
| 05 Hospital (Medicine 6, Fuel 4, Food 4, Tool 3, Survivor 3) | 20 | yes | yes | yes | confirmed |
| 06 Gas Station (Fuel 6, Weapon 5, Food 3, Medicine 3, Survivor 3) | 20 | yes | yes | yes | confirmed (Switchblade is Switch Blade in W) |

Three wording differences between P and BC. By the precedence rule (P above BC) the first two take P; the third is
flavour only. All three stay flagged until a card photo is seen:

| ID | Card | BC | P | Chosen |
|---|---|---|---|---|
| I7 | Walkie Talkie | no once-per-round limit | adds "once per round" | once per round (P over BC); a global P habit (nearly every equip item prints it) and a limit BC may have dropped |
| I8 | Scissors | kill 1 zombie, no location stated | kill 1 zombie at the location of one of your survivors | at the location of one of your survivors (P over BC) |
| I9 | Megaphone | move 4 zombies to a location with one of your survivors | same, plus an optional shout when used | no rules difference; the shout is flavour and is not coded |

## Flags and conflicts

| ID | Subject | Detail | What the spec does | Status |
|---|---|---|---|---|
| I1 | "Food or Trade 1" (Gas Station, 3 cards) | the wiki's Dead of Winter column prints a Long Night word ("Trade"); BC and P both list plain Food 1 | Food 1, count 3 | Corrected (BC,P over W) |
| I2 | Hospital "2 Outsider (x3)" and School "2 Outsider (x2), 3 Outsiders (x1)" | singular/plural typos in the wiki; BC prints "2 Outsiders" for all of them | store the number as `outsiders: N` | Corrected (BC,P over W) |
| I3 | FAQ 5.1.1 mentions a "Microphone" item card | no source places a Microphone card in any deck: W, BC and P all agree on 120 location cards and 25 starter cards with none named Microphone. FAQ 5.1.1 is about moving zombies into empty spaces only, and the official rulings digest applies that same ruling to the Megaphone, whose effect is moving zombies | read "Microphone" as the FAQ's name slip for Megaphone; do not add a card | Corrected (inferred; no source contradicts) |
| I4 | Medicine class and effect | R p12 only fixes timing; F 1.3.2 says Adrenaline Shot also carries the medicine symbol; BC now gives a Waste Pile heal of one wound on a survivor you control or one sharing a location with one of yours | as in the table | Confirmed (R,F,BC,P agree) |
| I5 | Outsider count per deck | every one of the six decks holds exactly 3 Outsider cards (Police Station 1+2, Gas Station 1+2, Grocery Store 1+2, Library 1+2, Hospital 3, School 2+1), 18 in all; P and BC agree | 18 Outsider cards | Confirmed (W,BC,P) |
| I6 | School deck fourth Tool card | W (Dead of Winter column) lists Football Pads; BC and P list Megaphone (W lists Megaphone only in its Long Night column) | Megaphone | Corrected (BC,P over W) |
| I10 | Card spellings | W: Rotting Flesh, Switch Blade, Beginner's Martial Arts; BC: Rotten Flesh, Switchblade, a misspelt Martial Arts; P agrees with BC on the first two | Rotten Flesh, Switchblade, Beginner's Martial Arts | Confirmed (BC,P) |

## Symbol totals across the six location decks (W, S)

| Symbol | Cards |
|---|---|
| Weapon | 11 |
| Fuel | 18 |
| Education | 11 |
| Food | 26 |
| Medicine | 18 |
| Tool | 18 |
| Survivor | 18 |
| Total | 120 |

## Still unknown (see `README.md`)

- Nothing in the item decks. All 145 cards now have a class and an effect line (BC, cross-checked by P).
- Two wording points that rest on P over BC and that a card photo would settle: Walkie Talkie once per round (I7) and
  Scissors location (I8).
- Survivor spaces, entrance spaces and the symbol order per location are in `locations-sources.md`.
