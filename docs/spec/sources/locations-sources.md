# Board and locations: sources (research 2026-10-10)

The colony board (entrances, entrance spaces, the colony occupants area, the tracks) and the six location cards
(survivor spaces, entrance spaces, noise spaces, the item-symbol row). Every value is a number, a symbol or a name.
Fan files, photos and the official PDFs live in `docs/sources/` (gitignored), were read in the session and are not
committed.

## Source tags

| Tag | Source | What it gave | Strength |
|---|---|---|---|
| R | Plaid Hat rulebook (2014): p5 board and location-card legend (the Grocery Store is the sample card), p6 setup, p13 adding zombies, p14 adding survivors | the board layout, the legend, the 4 noise cap, the placement order for zombies, the full-colony rule | highest. The text extract gives the legend but not the printed space counts; those come from the diagram, read by the orchestrator (`fan/research-notes-2026-10-10.md`) |
| Ph | eBay seller photos of The Long Night location cards (`docs/sources/fan/photos/tln-1.png` to `tln-7.png`), read 2026-10-10; the six base locations appear in them, and the survivor circles, entrance symbols, noise ears and symbol row were counted directly in this pass | space counts and symbol order for the six cards | high for what they show; they are cards of the Long Night product (see ruling L1) |
| ES | Spanish-edition location thumbnails, GitHub MiguelAngelCabanillas/Dead-Of-Winter `images/` (240x119, header strip only), read 2026-10-10 | a low-confidence second reading of the symbol row | low (blurry) |
| BC | BGG Card Spread sheet, `docs/sources/bgg/Dead_of_Winter_Card_Spread.xlsx.txt` | deck counts per symbol, and a header row per deck listed in the card's symbol order | medium-high; used as the cross-check |
| W | Dead of Winter Fandom wiki `Locations` page | the numbering 1 to 6 (a die roll picks a random location) | medium |
| S | our own self-consistency check | counts and arithmetic | supports the rest |

Precedence: R > Ph > ES > BC > W.

---

## Colony board

| Item | Value | Tags |
|---|---|---|
| Entrances | 6, numbered 1 to 6; zombies are placed in order of entrance number, going round counter-clockwise (the first zombie goes on entrance 1, the second on entrance 2, and so on, wrapping after 6) | R p13 |
| Entrance spaces | 3 per entrance, 18 in all; a space holds one zombie or one barricade | R p5 diagram, Ph (a fan photo of entrances 4 and 5 shows 3 each) |
| Overrun | an entrance with no empty space and no barricade is overrun when another zombie would be placed | R p13 |
| Colony occupants | 24 survivor spaces (3 columns of 8 rows); each survivor standee sits on one | R p5 diagram, p14 |
| Full colony | when no occupant space is empty, no crossroads card and no item card can add a survivor (helpless survivors included) | R p14 |
| Morale track | 0 to 10 | R p5 diagram |
| Round track | 0 to 10; the main objective sets the starting number | R p5 diagram |
| Food supply | a box for food tokens; no printed capacity | R p5 |
| Waste pile | a space for played cards | R p5 |
| Crisis deck and crisis contributions | one deck space and one contribution area | R p5 |
| Main objective | one slot for the card | R p5 |

Self-consistency (S): the largest starting morale on any main objective is 8 (Winter Has Come normal) and the
largest starting round number is 10 (Ten Weeks of Darkness), both inside the track limits. 6 x 3 = 18 entrance spaces.
No source states a food-supply or helpless-token capacity.

---

## Location cards

All six carry 4 noise spaces (R p5: only 4 noise tokens may sit at one location in a round). The item-symbol row is
ordered from likeliest to least likely (R p5). The number at the card's left corner runs 01 to 06 in the order below
(Ph; W says non-colony locations are numbered 1 to 6 and a die picks a random one; the R setup list uses the same
order; the ES thumbnails show 02, 05 and 06 for Grocery Store, Hospital and Gas Station, which agrees).

| # | Location | Survivor spaces | Entrance spaces | Noise spaces | Symbol row, left to right (likeliest first) | Tags |
|---|---|---|---|---|---|---|
| 01 | Police Station | 3 | 4 | 4 | Weapon, Fuel, Tool, Food, Survivor | Ph (BC order, ES agrees) |
| 02 | Grocery Store | 3 | 4 | 4 | Food, Medicine, Tool, Survivor | R p5 diagram, Ph (BC order, ES agrees) |
| 03 | School | 4 | 4 | 4 | Food, Education, Tool, Medicine, Survivor | Ph (BC order; ES first two symbols differ, see L2) |
| 04 | Library | 3 | 3 | 4 | Education, Fuel, Food, Tool, Survivor | Ph (BC order, ES agrees) |
| 05 | Hospital | 4 | 4 | 4 | Medicine, Fuel, Food, Tool, Survivor | Ph (BC order, ES agrees) |
| 06 | Gas Station | 2 | 3 | 4 | Fuel, Weapon, Food, Medicine, Survivor | Ph (BC order, ES agrees) |

Totals (S): survivor spaces 3+3+4+3+4+2 = 19; entrance spaces 4+4+4+3+4+3 = 22 (plus the colony's 18); noise spaces
6 x 4 = 24. The "Survivor" symbol is the Outsider card (the head silhouette).

### Cross-check of the symbol row against the deck counts

The BC sheet prints each deck's counts in a header row in the same order as the card's symbol row (BC header order
equals the Ph order on all six cards), so the order is confirmed by two independent readings. The counts also
descend from left to right on every card, with one exception: the Survivor symbol always sits last.

| Location | Counts in symbol-row order (BC) | Non-increasing? |
|---|---|---|
| Police Station | Weapon 6, Fuel 4, Tool 4, Food 3, Survivor 3 | yes (Fuel and Tool tie; the order of ties comes from the photo) |
| Grocery Store | Food 6, Medicine 6, Tool 5, Survivor 3 | yes (Food and Medicine tie) |
| School | Food 6, Education 4, Tool 4, Medicine 3, Survivor 3 | yes (Education and Tool tie; Medicine and Survivor tie) |
| Library | Education 7, Fuel 4, Food 4, Tool 2, Survivor 3 | no: Survivor 3 is printed after Tool 2, so the Survivor symbol is last regardless of its count |
| Hospital | Medicine 6, Fuel 4, Food 4, Tool 3, Survivor 3 | yes |
| Gas Station | Fuel 6, Weapon 5, Food 3, Medicine 3, Survivor 3 | yes (Food, Medicine and Survivor tie) |

Deck totals 20 each, 120 in all (S; `items-sources.md`). The tie order within a count cannot be read from the deck
counts; it is taken from the photos and, where available, the BC header.

---

## Conflicts and rulings

| ID | Subject | Sources disagree | What the spec does | Status |
|---|---|---|---|---|
| L1 | Which product the location photos come from | the photos show The Long Night cards, not the base game. The Grocery Store card matches the base rulebook diagram (R p5) exactly: 3 survivor spaces, 4 entrance spaces, 4 noise spaces, symbols Food, Medicine, Tool, Survivor. The other five cards (Police Station, School, Library, Hospital, Gas Station) are only seen in the Long Night print | treat the Long Night layout as identical to the base game for all six cards. The symbol rows also match the base-game deck counts in BC, which supports it | Fan-source |
| L2 | School symbol row, first two symbols | ES thumbnail (low confidence) reads Fuel then Education; Ph reads Food then Education | Food, Education, Tool, Medicine, Survivor. The School deck holds no Fuel cards (BC: Food 6, Books 4, Tools 4, Meds 3, Outsiders 3), so a Fuel symbol cannot be right | Corrected (Ph,BC over ES) |
| L3 | Survivor symbol position on the Library | the count rule (descending) would put Survivor 3 before Tool 2; the card prints it last | Survivor symbol is always last; the rest follow likelihood | Confirmed (Ph,BC) |
| L4 | Colony entrance space count per entrance | no text source states it; the rulebook diagram and a fan photo of entrances 4 and 5 show 3 each | 3 per entrance, 18 in all | Confirmed (R diagram, Ph) |
| L5 | Colony occupants count | the rulebook diagram shows 24 dashed circles in the occupants area | 24 | Confirmed (R diagram) |
| L6 | Round and morale track length | no text states it; the diagram shows 0 to 10 for both and the largest objective values (10 rounds, 8 morale) fit | 0 to 10 for both | Confirmed (R diagram, S) |

The same rulings are returned as RULING lines to the orchestrator.

## Still missing for the board

- Nothing blocks the board. A base-game (not Long Night) photo of the five locations other than the Grocery Store
  would turn L1 from Fan-source into a plain confirmation.
- The art layout of the board (tile positions) stays unsourced; that belongs to `docs/spec/30-art.md`.
