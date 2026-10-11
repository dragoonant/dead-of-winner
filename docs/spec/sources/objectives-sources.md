# Objectives: sources (research 2026-10-10)

Four families of cards: the 10 main objectives (two sides each, 20 faces), the 24 standard secret objectives, the 10
betrayal secret objectives and the 10 exiled secret objectives. Every value is a number, a symbol or a name; the
effect text is a one-line mechanical summary in our own words. Fan files and official PDFs live in `docs/sources/`
(gitignored), were read in the session and are not committed.

## Source tags

| Tag | Source | What it gave | Strength |
|---|---|---|---|
| R | Plaid Hat rulebook (2014): p5 setup, p14 exile, p15 variants (We Need More Samples both sides), p16-19 the ten main-objective story titles M01-M10 and the ten betrayal story titles S11-S20 | story ids, We Need More Samples (both sides), the exile and betrayer rules | highest |
| F | FAQ v1.1 section 4.1.1 | how cards are added to a main objective | official |
| BO | Plaid Hat official rulings digest (`docs/sources/bgg/official-rulings.txt`) | survive-X-rounds meaning, starter cards, We Need More Samples order of rolls, exile and betrayer rulings | official |
| Ph | fan photo of a real English-edition card (Ten Weeks of Darkness hardcore side, Barter exiled card, Hunger secret objective), named in the research notes | verbatim values for those faces | high |
| ES | Spanish-edition scans, GitHub MiguelAngelCabanillas/Dead-Of-Winter `images/`, read 2026-10-10 (`fan/spanish-scans-transcription.md`) | 6 main objectives (one face each), 12 standard secret, 3 betrayal, 4 exiled | high for numbers; English titles in that file are guesses |
| J | unboxing photos of a non-English edition (the research notes show Japanese titles; the task brief calls them Taiwanese), named in the research notes | Collector and Masochist texts | medium (read from photos of a translated card) |
| P | Portuguese fan translation, Ludopedia attachments 51112 (10 exiled), 51113 (10 main objectives, 2 sides), downloaded by the owner 2026-10-10 (`fan/ludopedia-transcription.md`). Exiled cards carry their English heading in brackets | all 20 main faces, all 10 exiled | medium: a translation, with several slips found below |
| BT | BoardGameGeek thread 2054328 "Main objective cards", transcribed by Ragenarok124 2018-09-06, corrected by Git_ 2022-02-18, pasted by the owner 2026-10-10 (`docs/sources/bgg/thread-2054328-main-objectives.md`) | all 20 main faces, hardcore changes in braces | medium: one volunteer transcription, two corrections already inside |
| N | GitHub etwest/deadofwinter_site, files `obj_nonbetray.txt` and `obj_betray.txt`, read 2026-10-10 (names only) | the 24 standard and 10 betrayal secret objective names | medium (names only) |
| VASSAL | Vassal module "Dead_of_Winner_Crossroads_1.1.vmod" (vassalengine.org, sha256 abaf1ee0..., built 2015 from the printed cards): clean scans of all 20 main-objective faces (hardcore faces carry two red warning triangles) and all 34 standard and betrayal secret objectives; read 2026-10-10 (`fan/vassal-transcription.md`). Betrayal conditions are blurred in the module (its readme says censored): only the morale line, the line count and the rulebook section show | every value on all 20 main faces, all 24 standard secret objectives | highest for card content: a scan of the printed card |
| S | our own self-consistency check | counts and arithmetic | supports the rest |

Precedence: R/F > VASSAL > Ph > ES > P > BT > W (wiki). A VASSAL scan agrees with R wherever R prints a card (R p15 We Need More Samples excepted, see O7). J is read as Ph for texts only it supplies and is below Ph.

---

## A. Main objectives (10 cards, 20 faces)

A card has a normal side and a hardcore side (R p15). "Rounds" is the number the round track starts at. "Morale" is
the starting morale. Setup lines are in addition to the standard setup unless they say Instead. "Other locations" means
non-colony locations. Time is the printed rating. The story id in the first column is the rulebook section read at
the start of the game (R p16-17; the P and ES pointers agree).

Duplicated rules (R, F, BO): cards added to a main objective sit face up under it and may be added any time during
your own turn unless the card says otherwise (F 4.1.1); starter cards cannot be added when the card says non-starter
only (BO); a card scores by count, one card is one card; "survive X rounds" means the game ends after X rounds if
morale is not 0 and the objective is then complete (BO); the game does not end at once when the objective is met, it
ends at the Check Main Objective step (BO).

### Chosen values (after the rulings in the conflict table below)

| Story id | Card | Side | Morale | Rounds | Setup | Victory | Time | Tags (all five values unless a conflict id is named) |
|---|---|---|---|---|---|---|---|---|
| M01 | Eight Weeks of Darkness | normal | 7 | 8 | 1 helpless survivor per player at the colony; 1 zombie at each other location | survive 8 rounds | Long | VASSAL,ES,BT,P |
| M01 | Ten Weeks of Darkness | hardcore | 6 | 10 | 1 helpless survivor per player at the colony; 3 zombies at each other location | survive 10 rounds and have at least 6 food tokens in the supply at the end | Long | VASSAL,Ph,BT,P |
| M02 | Kill Them | normal | 7 | 7 | 3 zombies at each other location. Exile change: an exiled player and every survivor they control are removed from the game at once instead of the usual exile rules | at most 3 zombies in total across all other locations | Medium | VASSAL,ES,BT,P |
| M02 | Kill Them | hardcore | 5 | 5 | as normal and also 12 zombies at the colony; same exile change | at most 1 zombie in total across all other locations and at least 1 barricade at every other location | Medium | VASSAL,BT,P |
| M03 | Find a Cure | normal | 5 | 6 | none | each player who started the game places 2 Medicine cards under the objective (starter Medicine does not count) | Short | VASSAL,BT,P; PHOTO bing 2026-10-11 agrees |
| M03 | Find a Cure | hardcore | 5 | 6 | Instead of the standard setup: 12 zombies at the colony and 2 at each other location | as normal but 3 Medicine per starting player (O1 settled by VASSAL: 3) | Medium | VASSAL (BT agrees) |
| M04 | Home Sweet Home | normal | 6 | 6 | 12 zombies at the colony and 1 at each other location | at least 10 barricades at the colony and at least 1 at each other location | Medium | VASSAL,ES,BT,P |
| M04 | Home Sweet Home | hardcore | 5 | 5 | 18 zombies at the colony and 2 at each other location | at least 14 barricades at the colony and at least 1 at each other location | Medium | VASSAL,BT,P; conflict O5 settled |
| M05 | Raiding Party | normal | 5 | 6 | 2 zombies at every location, the colony included as printed | the item decks of 2 other locations are empty | Short | VASSAL,ES,BT,P |
| M05 | Raiding Party | hardcore | 5 | 6 | Instead of the standard setup: 12 zombies at the colony and 3 at each other location | 2 or 3 players: empty the item decks of 2 other locations; 4 or 5 players: of 3 other locations | Short | VASSAL,BT,P |
| M06 | Leave It All Behind | normal | 6 | 5 | 12 zombies at the colony and 2 at each other location | every non-exiled player has 1 Weapon card equipped to a survivor they control, and each player who started places 2 FOOD cards under the objective (starter Food does not count). VASSAL scan: the icon is the food can, and the weapon rule is one per player, not one per survivor | Short | VASSAL; conflicts O2, O4 settled |
| M06 | Leave It All Behind | hardcore | 5 | 5 | 12 zombies at the colony and 3 at each other location (VASSAL: 3, O3 settled) | the same weapon condition and 3 Food cards per starting player | Short | VASSAL |
| M07 | Stockpile | normal | 6 | 6 | 18 zombies at the colony | the food supply holds at least 2 tokens for each non-exiled player (corrected from 3 by PHOTO bing 2026-10-11, which also confirms morale 6, 6 rounds, 18 colony zombies, entrance barricades, 2 Medicine, 2 Tool, 2 Fuel); at least 1 barricade at every colony entrance; 2 Medicine, 2 Tool and 2 Fuel cards under the objective (starter cards do not count; Tool means any Tool-symbol card) | Medium | VASSAL,BT,P; PHOTO bing; conflict O6 settled |
| M07 | Stockpile | hardcore | 5 | 8 | 18 zombies at the colony | the same, with 3 food tokens per non-exiled player | Medium | VASSAL,BT,P |
| M08 | Winter Has Come | normal | 8 | 8 | 10 zombies at the colony and 1 at each other location | at the start of each Colony phase one player must put a Fuel card under the objective, or the game ends and the objective fails; with 8 Fuel cards under it at the Check Main Objective step of round 8 it is complete | Long | VASSAL,BT,P |
| M08 | Winter Has Come | hardcore | 7 | 10 | 12 zombies at the colony and 2 at each other location | the same with 10 Fuel cards at round 10 | Long | VASSAL,BT,P |
| M09 | Too Many Mouths | normal | 7 | 5 | helpless survivor tokens at the colony equal to players plus 3; 6 zombies at the colony | survive 5 rounds | Short | VASSAL,ES,BT,P |
| M09 | Too Many Mouths | hardcore | 7 | 6 | helpless survivor tokens equal to players plus 5; 12 zombies at the colony | survive 6 rounds | Medium | VASSAL,BT,P |
| M10 | We Need More Samples | normal | 6 | 6 | 1 zombie at each other location | each time a zombie is killed roll a die; on 4 or more put a zombie token on the objective; complete at 3 tokens per player who started | Short | VASSAL,R,ES,BT,P |
| M10 | We Need More Samples | hardcore | 6 | 5 | 3 zombies at each other location | the same roll; complete at 4 tokens per player who started (O7 settled by VASSAL: 4) | Short | VASSAL,BT,P; R p15 differs |

Our own checks (S): all starting morale values (5 to 8) fit the 0 to 10 morale track; all round values (5 to 10) fit
the 0 to 10 round track; durations: Short 8 faces (M03 normal, M05 both, M06 both, M09 normal, M10 both), Medium 8
faces (M02 both, M03 hardcore, M04 both, M07 both, M09 hardcore), Long 4 faces (M01 both, M08 both); hardcore keeps
or raises the duration on every card; the ten story ids in R (M01-M10) match the ten cards.

### Conflict and ruling table (main objectives)

| ID | Subject | Values by source | Chosen | Why | Status |
|---|---|---|---|---|---|
| O1 | Find a Cure hardcore: Medicine cards per starting player | BT 3; P 2 (printed "02"); VASSAL scan 3 | 3 | the printed card says 3 | Corrected (VASSAL over P) |
| O2 | Leave It All Behind: starting rounds | BT 6; P 5; VASSAL 5 on both faces | 5 | the printed card | Confirmed (VASSAL) |
| O3 | Leave It All Behind hardcore: zombies at each other location | BT 3; P 2; VASSAL 3 | 3 | the printed card | Corrected (VASSAL over P) |
| O4 | Leave It All Behind: weapon wording | BT one weapon equipped to a survivor they control (each non-exiled player needs one); P one Weapon card per survivor they control; VASSAL: all non-exiled players must have 1 Weapon equipped to a survivor they control | one weapon per non-exiled player | the printed card matches BT; the hook was renamed rule.non-exiled-seats.weaponEach | Corrected (VASSAL over P) |
| O5 | Home Sweet Home hardcore: morale and rounds | BT 6 and 6 (no change in braces); P 5 and 5; VASSAL 5 and 5 | 5 and 5 | the printed card | Confirmed (VASSAL) |
| O6 | Stockpile normal: food tokens per non-exiled player | BT 2 (written 2{3}); P 3 on both sides; PHOTO bing 2; VASSAL 2 normal and 3 hardcore | 2 normal, 3 hardcore | the printed card | Confirmed (VASSAL, PHOTO bing) |
| O7 | We Need More Samples hardcore: tokens per starting player | R p15 hardcore sample card 3; BT 4 (written 3{4}); P 4; VASSAL 4 | 4 | the clean scan of the printed hardcore face says 4; the R p15 figure was an illustration (the normal face is the 3) | Corrected (VASSAL over R p15) |
| O8 | Home Sweet Home normal: starting morale | BT first said 5 and was corrected to 6 by Git_ (2022); ES 6; P 6; VASSAL 6 | 6 | four sources agree | Confirmed |
| O9 | Raiding Party normal: does "every location" include the colony | BT, ES, P and VASSAL all print every location (the card reads "every location") | colony included | the printed wording | Confirmed (VASSAL) |
| O10 | Stockpile cards under the objective | BT first says 2 Junk; Git_ corrected to Tool-symbol cards; P says Tool; VASSAL prints the tool icon | any Tool-symbol card | the printed icon | Confirmed (VASSAL) |
| O11 | We Need More Samples: what rolls the die | R: each zombie killed; P says each time you kill zombies; BO: each zombie killed, kills from effects that say kill count, effects that say remove do not; roll for the sample before the exposure roll | one roll per zombie killed | R and BO outrank P | Corrected (R,BO over P) |
| O12 | Kill Them exile change | ES, BT, P and VASSAL agree: the exiled player and their survivors leave the game at once | as printed | four sources agree | Confirmed (VASSAL) |
| O13 | Ten Weeks of Darkness hardcore values | Ph verbatim: morale 6, rounds 10, 1 helpless per player, 3 zombies at each other location, survive 10 rounds with at least 6 food tokens; BT, P and VASSAL agree | as printed | photo, scan and two fan sources agree | Confirmed (VASSAL) |
| O14 | Winter Has Come: may or must place a Fuel card | BT says a single player may; P says a player must; VASSAL prints "a single player may place 1 Fuel card" and "if a Fuel card is not placed at this time, the game is over and the objective has failed" | a single player may, but the game ends if none is placed (so in practice compulsory) | the printed wording, both sentences | Confirmed (VASSAL) |

Remaining main-objective gaps: none. All 20 faces are read from the clean VASSAL v1.1 scans, which settle O1 to O7 (the
fan-source rulings and the R p15 figure) and confirm the rest. Time ratings differ by face on two cards: Find a Cure and Too
Many Mouths are Short normal and Medium hardcore; the record keeps one card-level rating (the normal face) and notes the
hardcore one.

---

## B. Standard secret objectives (24)

Names come from the GitHub names list (N). Every standard objective starts with the condition that the main objective
has been completed; the rest is listed. "Hand" always means the
cards in the player's hand. Items count by symbol (Hunger is noted as symbol-counting by BGG thread 1228611, cited in the
research notes and not read here). Texts are our one-line summaries.

| # | Name (N) | Spanish title (ES) | Condition besides "main objective completed" | Tags |
|---|---|---|---|---|
| 1 | A new destination | Un nuevo destino | at least 3 Fuel cards in hand | ES,N |
| 2 | All I need is my books | n/a | at least 2 Education (book) cards equipped to a single survivor you control (VASSAL) | VASSAL,PHOTO,N |
| 3 | Burn it all down | Quemalo todo | at least 4 barricades at the colony and at least 1 Fuel card in hand | ES,N |
| 4 | Collector | Coleccionista | at least 4 item cards of any kind in hand | ES,J,N |
| 5 | Desire to live | Ganas de vivir | at least 1 each of Weapon, Food, Fuel and Medicine in hand | ES,N |
| 6 | Experienced | n/a | every survivor you control has an item card equipped (VASSAL, PHOTO bing 2026-10-11) | VASSAL,PHOTO,N |
| 7 | Germ-a-phobe | Germofobia | none of the survivors you control has any wound token | ES,N |
| 8 | Historian | Historiador | at least 2 Education cards in hand | ES,N |
| 9 | Hoarder | n/a | you hold more cards in hand than any other player (VASSAL; new hook rule.hand.mostCards) | VASSAL,N |
| 10 | Hope | n/a | at least 2 helpless survivor tokens on the board (VASSAL confirms the pt-br sheet) | VASSAL,FAN,N |
| 11 | Hunger | n/a | at least 3 Food-symbol cards in hand | Ph,N |
| 12 | Hypochondriac | n/a | main objective complete and at least 2 Medicine cards in hand (corrected by VASSAL; the earlier "hand of only Medicine" reading is Neat Freak) | VASSAL,N |
| 13 | Junkie | n/a | main objective complete and at least 3 Medicine cards in hand (verified, PHOTO ebay 146752101002) | PHOTO,N |
| 14 | Justice | n/a | if there is a betrayer, they have been exiled (VASSAL confirms the pt-br sheet) | VASSAL,FAN,N |
| 15 | Leader | Lider | your group has more survivors than any other player's group | ES,N |
| 16 | Loner | Solitario | you control exactly one survivor | ES,N |
| 17 | Masochist | n/a | one survivor you control has at least 2 wound tokens of any kind | J,N |
| 18 | Neat freak | n/a | main objective complete and your hand holds only Medicine cards, at least 1 (VASSAL; reuses hook rule.hand.onlySymbol) | VASSAL,N |
| 19 | Protected | n/a | at least 2 Weapon cards equipped to survivors you control (PHOTO bing 2026-10-11) | PHOTO,N |
| 20 | Repopulate | n/a | at least 12 survivors on the board, helpless tokens included (PHOTO bing 2026-10-11) | PHOTO,N |
| 21 | Revenge | Venganza | at least 3 survivors have been removed from the game (helpless survivors do not count) | ES,N |
| 22 | Safety | n/a | at least 4 barricades at the colony (PHOTO bing 2026-10-11) | PHOTO,N |
| 23 | The way back home | El camino de vuelta a casa | at least 2 Fuel, 1 Food and 1 Weapon card in hand | ES,N |
| 24 | Zombie killing robot! | Un robot asesino de zombis | at least 1 Weapon and 2 Tool cards in hand | ES,N |

Counts (S): 24 names, 24 texts, all verified from the clean VASSAL v1.1 scans (Secret_Objectives_*.jpg). The VASSAL cross-check changed 3 records: Hoarder and Neat Freak (were names-only stubs) became real records, and Hypochondriac was corrected from "hand of only Medicine" to "at least 2 Medicine" (the earlier reading, and the ES Farmaceutico scan, belong to Neat Freak). All 21 other cards matched, Hope and Justice included.

Secret objective rules (R p6, BO): each player gets 2 standard and, with the betrayer rule, the setup adds 1 betrayal
card to the pool dealt (R setup step 4); cards may be hidden; the same card can count for several objectives.

---

## C. Betrayal secret objectives (10)

Story ids are the rulebook's section ids (R p18-19, S11 to S20). The ES scans show the same ids for the three cards
they cover (S16, S17, S18), which cross-checks the mapping. The three known betrayal cards do not need the main
objective: they need morale at 0 plus a private condition. The other seven are unread.

| Story id | Name (N, R) | Condition (all required) | Tags |
|---|---|---|---|
| S11 | Gluttony | morale is 0 and you hold at least 6 Food cards in hand (starter item cards do not count) | PHOTO ebay 313087713029,N,R |
| S12 | Runaway | morale 0; a Weapon equipped on a survivor you control; at least 2 Fuel and 2 Food in hand, starter cards excluded (FAN pt-br sheet, draft) | FAN,N,R |
| S13 | Take Over | morale 0; at least 4 barricades at a single non-colony location; you control a survivor with a Weapon equipped; at least 2 Fuel in hand, starter cards excluded (PHOTO bing 2026-10-11) | PHOTO,N,R |
| S14 | All for One | morale 0; you control only 1 survivor; a Weapon equipped on each survivor you control; 1 Food, 1 Fuel, 1 Medicine and 1 Tool in hand, starter cards excluded (FAN pt-br sheet, draft) | FAN,N,R |
| S15 | Accept Your Fate | morale 0; at least 2 Weapons equipped on survivors you control; at least 3 Medicine in hand, starter cards excluded (PHOTO bing 2026-10-11; the pt-br sheet agrees) | PHOTO,N,R |
| S16 | Trigger Happy | morale is 0 and the survivors you control carry at least 4 Weapon cards between them | ES,N,R (a secondary review agrees, per the research notes) |
| S17 | Cult Leader | morale is 0 and you control at least 2 more survivors than any other player | ES,N,R (the same review agrees) |
| S18 | Serial Killers | morale is 0, at least 5 survivors have been removed from the game (helpless survivors do not count) and you control at least 2 survivors | ES,N,R |
| S19 | Mad Scientist | morale 0; at least 2 survivors in your following; at least 2 Medicine and 2 Tool in hand, starter cards excluded (PHOTO bing 2026-10-11) | PHOTO,N,R |
| S20 | Obsessed | morale is 0, only 1 survivor in your following, at least 1 Weapon equipped to each survivor you control, at least 1 Fuel, 1 Medicine and 1 Food card in hand (starter cards do not count) | PHOTO ebay 146752101002,N,R |

VASSAL v1.1 cross-check (2026-10-10): the module censors the conditions after the morale line (blurred in every Secret_Betrayal_*.jpg), so no betrayal record could be verified or corrected from it. What is legible agrees with our records: line 1 is "morale is at 0" on all 10; the number of numbered lines (including the morale line) is Gluttony 2, Runaway 3, Take Over 4, All for One 4, Accept Your Fate 3, Trigger Happy 2, Cult Leader 2, Serial Killers 3, Mad Scientist 3, Obsessed 4, which equals the condition count of every record; and the printed rulebook sections S11 to S20 match the story ids. Records keep their earlier status. Still unverified against a real card (fan sheet or Spanish scan only): Runaway, All for One, Trigger Happy, Cult Leader, Serial Killers.

Counts (S): 10 names, 10 texts known (Gluttony and Obsessed added 2026-10-10; Accept Your Fate, Mad Scientist, Take Over from English photos 2026-10-11; All for One and Runaway from the pt-br fan sheet, draft).

---

## D. Exiled secret objectives (10)

Rules (R p14, BO): an exiled player draws one of these cards. A player who is not the betrayer reveals their secret
objective, removes it from the game and takes the "not the betrayer" text as their new objective. The betrayer keeps
both objectives, but the first victory condition is replaced by the "betrayer" text. The reveal duty is printed on
the cards, not in the rulebook (BO).

The English headings are the words printed in brackets on the P sheet (the Portuguese title is in the P file); they
look like the card names and are used here as working names (names may match the real cards). The ES scans cover
four cards.

| # | Name (P heading) | Spanish (ES) | Not the betrayer: new objective | Betrayer: first condition becomes | Tags | Notes |
|---|---|---|---|---|---|---|
| 1 | Remorse | n/a | main objective completed and 4 Medicine cards in hand | at least 10 cards in hand | P | single source |
| 2 | Atonement | n/a | main objective completed | at least 1 each of Fuel, Food, Medicine and Tool in hand | P | single source |
| 3 | New Friends | Nuevos amigos | main objective completed and your group has more survivors than any other player's group | no item cards remain at one or more locations | ES (P differs) | conflict D1 |
| 4 | Shelter | n/a | at least 3 locations on the board each have at least 2 barricades | you carry more equipped Weapon cards than any other player | P | single source; whether the colony is one of the 3 locations is not stated |
| 5 | South | n/a | main objective completed and 4 Fuel cards in hand | at least 4 survivors you do not control each carry at least 1 wound token of any kind | P | single source |
| 6 | The Chosen | n/a | you control at least 3 survivors and none of them has any wound token | none of your survivors has any wound token and there are at least 5 barricades on the board | P | single source |
| 7 | Barter | n/a | 4 Medicine cards in hand (no main-objective condition) | at least 3 Education cards equipped to survivors you control | Ph,P | photo cross-check: agrees with P on both halves |
| 8 | Forgiveness | Perdon | main objective completed and 5 Food cards in hand | main objective completed | ES,P | |
| 9 | Vengeance | Venganza | at least 5 survivors removed from the game (helpless survivors do not count) | at least 4 survivors removed from the game (same exclusion) | ES,P | P prints "improdutivos"; ES says helpless |
| 10 | Resourceful | Habil | main objective completed and 4 Tool cards in hand | at least 3 Tool cards in hand | ES,P | the ES scan is Habil; the P English heading is Resourceful |

Exiled conflicts and rulings

| ID | Subject | Values by source | Chosen | Why | Status |
|---|---|---|---|---|---|
| D1 | New Friends text | ES not-betrayer: main objective completed and more survivors; ES betrayer: no item cards remain at one or more locations. P not-betrayer: main objective NOT completed and more survivors; P betrayer: 10 cards in hand (the same line as Remorse's betrayer text, a likely copy slip) | the ES values | the Spanish scan outranks the Portuguese translation; P's betrayer line duplicates card 1 | Corrected (ES over P) |
| D2 | Barter photo | Ph and P agree on both halves | as printed | a real card face confirms P | Confirmed |
| D3 | Resourceful versus Habil | the same four values on ES and P | one card | ES and P match on both halves; only the title differs | Confirmed |
| D4 | Vengeance helpless exclusion | ES says not counting helpless survivors; P says unproductive | helpless survivors do not count | ES outranks P; the wording means the same | Confirmed |

Counts (S): 10 cards; 10 values from P, 4 cross-checked by ES, 1 by a real photo (Barter).

---

## Still missing for objectives

- Real text for 5 betrayal objectives, none readable in any scan (the VASSAL module censors them): Runaway, All for One,
  Trigger Happy, Cult Leader and Serial Killers still rest on the fan sheet or the Spanish scan. Gluttony, Take Over,
  Accept Your Fate, Mad Scientist and Obsessed are verified from English photos.
- Nothing else: all 20 main-objective faces and all 24 standard secret objectives are verified from the VASSAL scans.

## Changes from the VASSAL v1.1 scans (2026-10-10)

| Card | Earlier value | Scan value | Effect |
|---|---|---|---|
| Find a Cure (hardcore) | 2 Medicine per starting player | 3 | data changed (O1) |
| Leave It All Behind (both) | 2 or 3 Fuel cards per starting player (a bing photo had moved it from Food) | 2 or 3 FOOD cards (the can icon) | counter and contribution symbol fuel to food |
| Leave It All Behind (both) | one weapon per survivor of each non-exiled player | one weapon per non-exiled player | hook rule.non-exiled-seats.weaponPerSurvivor replaced by rule.non-exiled-seats.weaponEach |
| Leave It All Behind (hardcore) | 2 zombies at each other location | 3 | data changed (O3) |
| We Need More Samples (hardcore) | 3 samples per starting player (R p15) | 4 | data changed (O7) |
| Hypochondriac | hand of only Medicine, at least 1 | at least 2 Medicine cards in hand | data changed |
| Hoarder, Neat Freak | names-only stubs | real records | added (new hook rule.hand.mostCards for Hoarder) |
| everything else | n/a | matches | status verified, source tag `VASSAL v1.1 <file>` |

## Changes from the bing card photos (2026-10-11, earlier step; Leave It All Behind is superseded by the VASSAL scans above)

| Card | Earlier fan value | English photo value | Effect |
|---|---|---|---|
| Find a Cure (normal) | morale 5, 6 rounds, 2 Medicine per player | the same, no zombie line | none; sources upgraded |
| Stockpile (normal) | 3 food tokens per non-exiled player | 2 food tokens per non-exiled player | data changed; rest matched |
| Leave It All Behind (normal) | 2 Food cards per starting player | 2 Fuel cards per starting player | data changed (counter and contribution symbol Food to Fuel); morale 6, 5 rounds, 12 and 2 zombies matched; hardcore also moved to Fuel at 3 |
