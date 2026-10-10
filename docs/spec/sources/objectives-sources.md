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
| S | our own self-consistency check | counts and arithmetic | supports the rest |

Precedence: R/F > Ph > ES > P > BT > W (wiki). J is read as Ph for texts only it supplies and is below Ph.

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
| M01 | Eight Weeks of Darkness | normal | 7 | 8 | 1 helpless survivor per player at the colony; 1 zombie at each other location | survive 8 rounds | Long | ES,BT,P |
| M01 | Ten Weeks of Darkness | hardcore | 6 | 10 | 1 helpless survivor per player at the colony; 3 zombies at each other location | survive 10 rounds and have at least 6 food tokens in the supply at the end | Long | Ph,BT,P |
| M02 | Kill Them | normal | 7 | 7 | 3 zombies at each other location. Exile change: an exiled player and every survivor they control are removed from the game at once instead of the usual exile rules | at most 3 zombies in total across all other locations | Medium | ES,BT,P |
| M02 | Kill Them | hardcore | 5 | 5 | as normal and also 12 zombies at the colony; same exile change | at most 1 zombie in total across all other locations and at least 1 barricade at every other location | Medium | BT,P |
| M03 | Find a Cure | normal | 5 | 6 | none | each player who started the game places 2 Medicine cards under the objective (starter Medicine does not count) | Short | BT,P |
| M03 | Find a Cure | hardcore | 5 | 6 | Instead of the standard setup: 12 zombies at the colony and 2 at each other location | as normal but 2 Medicine per starting player (O1: the BGG thread says 3) | Medium | BT,P; conflict O1 |
| M04 | Home Sweet Home | normal | 6 | 6 | 12 zombies at the colony and 1 at each other location | at least 10 barricades at the colony and at least 1 at each other location | Medium | ES,BT,P |
| M04 | Home Sweet Home | hardcore | 5 | 5 | 18 zombies at the colony and 2 at each other location | at least 14 barricades at the colony and at least 1 at each other location | Medium | BT,P; conflict O5 |
| M05 | Raiding Party | normal | 5 | 6 | 2 zombies at every location, the colony included as printed | the item decks of 2 other locations are empty | Short | ES,BT,P |
| M05 | Raiding Party | hardcore | 5 | 6 | Instead of the standard setup: 12 zombies at the colony and 3 at each other location | 2 or 3 players: empty the item decks of 2 other locations; 4 or 5 players: of 3 other locations | Short | BT,P |
| M06 | Leave It All Behind | normal | 6 | 5 | 12 zombies at the colony and 2 at each other location | every non-exiled player has 1 Weapon card equipped for each survivor they control, and each player who started places 2 Food cards under the objective (starter Food does not count) | Short | BT,P; conflicts O2, O4 |
| M06 | Leave It All Behind | hardcore | 5 | 5 | 12 zombies at the colony and 2 at each other location (BT says 3) | the same weapon condition and 3 Food cards per starting player | Short | BT,P; conflicts O3, O4 |
| M07 | Stockpile | normal | 6 | 6 | 18 zombies at the colony | the food supply holds at least 3 tokens for each non-exiled player (BT says 2); at least 1 barricade at every colony entrance; 2 Medicine, 2 Tool and 2 Fuel cards under the objective (starter cards do not count; Tool means any Tool-symbol card) | Medium | BT,P; conflict O6 |
| M07 | Stockpile | hardcore | 5 | 8 | 18 zombies at the colony | the same, with 3 food tokens per non-exiled player | Medium | BT,P |
| M08 | Winter Has Come | normal | 8 | 8 | 10 zombies at the colony and 1 at each other location | at the start of each Colony phase one player must put a Fuel card under the objective, or the game ends and the objective fails; with 8 Fuel cards under it at the Check Main Objective step of round 8 it is complete | Long | BT,P |
| M08 | Winter Has Come | hardcore | 7 | 10 | 12 zombies at the colony and 2 at each other location | the same with 10 Fuel cards at round 10 | Long | BT,P |
| M09 | Too Many Mouths | normal | 7 | 5 | helpless survivor tokens at the colony equal to players plus 3; 6 zombies at the colony | survive 5 rounds | Short | ES,BT,P |
| M09 | Too Many Mouths | hardcore | 7 | 6 | helpless survivor tokens equal to players plus 5; 12 zombies at the colony | survive 6 rounds | Medium | BT,P |
| M10 | We Need More Samples | normal | 6 | 6 | 1 zombie at each other location | each time a zombie is killed roll a die; on 4 or more put a zombie token on the objective; complete at 3 tokens per player who started | Short | R,ES,BT,P |
| M10 | We Need More Samples | hardcore | 6 | 5 | 3 zombies at each other location | the same roll; complete at 3 tokens per player who started (O7: BT and P say 4) | Short | R,BT,P; conflict O7 |

Our own checks (S): all starting morale values (5 to 8) fit the 0 to 10 morale track; all round values (5 to 10) fit
the 0 to 10 round track; durations: Short 8 faces (M03 normal, M05 both, M06 both, M09 normal, M10 both), Medium 8
faces (M02 both, M03 hardcore, M04 both, M07 both, M09 hardcore), Long 4 faces (M01 both, M08 both); hardcore keeps
or raises the duration on every card; the ten story ids in R (M01-M10) match the ten cards.

### Conflict and ruling table (main objectives)

| ID | Subject | Values by source | Chosen | Why | Status |
|---|---|---|---|---|---|
| O1 | Find a Cure hardcore: Medicine cards per starting player | BT 3; P 2 (printed "02") | 2 | P outranks BT; flagged because hardcore normally asks for more and the hardcore setup already adds 2 per location | Fan-source |
| O2 | Leave It All Behind normal: starting rounds | BT 6; P 5 | 5 | P outranks BT; both are fan sources, revisit on a real card | Fan-source |
| O3 | Leave It All Behind hardcore: zombies at each other location | BT 3 (written 2{3}); P 2 | 2 | P outranks BT; P normal and hardcore are then identical here, which is a warning sign | Fan-source |
| O4 | Leave It All Behind: weapon wording | BT one weapon equipped to a survivor they control (each non-exiled player needs one); P one Weapon card per survivor they control | per survivor | P outranks BT; the two readings differ for any player with 2 or more survivors | Fan-source |
| O5 | Home Sweet Home hardcore: morale and rounds | BT 6 and 6 (no change in braces); P 5 and 5 | 5 and 5 | P outranks BT; flagged because BT lists no hardcore change here | Fan-source |
| O6 | Stockpile normal: food tokens per non-exiled player | BT 2 (written 2{3}); P 3 on both sides | 3 | P outranks BT; flagged because the normal and hardcore values are then identical | Fan-source |
| O7 | We Need More Samples hardcore: tokens per starting player | R p15 hardcore sample card 3; BT 4 (written 3{4}); P 4 | 3 | the rulebook outranks both fans; flagged because two independent fan sources say 4, so the rulebook sample may be an illustration. Revisit if a card photo shows 4 | Corrected (R over BT,P) |
| O8 | Home Sweet Home normal: starting morale | BT first said 5 and was corrected to 6 by Git_ (2022); ES 6; P 6 | 6 | three sources agree after the correction | Confirmed |
| O9 | Raiding Party normal: does "every location" include the colony | BT, ES and P all print every or each location with no non-colony qualifier (other cards say non-colony or other locations when they mean it) | colony included | all three printed wordings agree; flagged for interpretation | Confirmed (printed wording) |
| O10 | Stockpile cards under the objective | BT first says 2 Junk; Git_ corrected to Tool-symbol cards; P says Tool | any Tool-symbol card | correction plus P | Confirmed |
| O11 | We Need More Samples: what rolls the die | R: each zombie killed; P says each time you kill zombies; BO: each zombie killed, kills from effects that say kill count, effects that say remove do not; roll for the sample before the exposure roll | one roll per zombie killed | R and BO outrank P | Corrected (R,BO over P) |
| O12 | Kill Them exile change | ES, BT and P agree: the exiled player and their survivors leave the game at once | as printed | three sources agree | Confirmed |
| O13 | Ten Weeks of Darkness hardcore values | Ph verbatim: morale 6, rounds 10, 1 helpless per player, 3 zombies at each other location, survive 10 rounds with at least 6 food tokens; BT and P agree | as printed | photo and two fan sources agree | Confirmed |
| O14 | Winter Has Come: may or must place a Fuel card | BT says a single player may; P says a player must; both then say the game ends if none is placed | must (the ending clause makes it compulsory) | P and the effect of BT's own second sentence agree | Confirmed |

Remaining main-objective gaps: no value is missing. Six rulings rest on P over BT (O1 to O6), one on the rulebook over
two fan sources (O7). Only M10 (both sides, R) and the Ten Weeks of Darkness hardcore face (photo) are official;
no other hardcore face has a real English photo.

---

## B. Standard secret objectives (24)

Names come from the GitHub names list (N). Every standard objective starts with the condition that the main objective
has been completed; the rest is listed. "Hand" always means the
cards in the player's hand. Items count by symbol (Hunger is noted as symbol-counting by BGG thread 1228611, cited in the
research notes and not read here). Texts are our one-line summaries.

| # | Name (N) | Spanish title (ES) | Condition besides "main objective completed" | Tags |
|---|---|---|---|---|
| 1 | A new destination | Un nuevo destino | at least 3 Fuel cards in hand | ES,N |
| 2 | All I need is my books | n/a | (text unknown) | N |
| 3 | Burn it all down | Quemalo todo | at least 4 barricades at the colony and at least 1 Fuel card in hand | ES,N |
| 4 | Collector | Coleccionista | at least 4 item cards of any kind in hand | ES,J,N |
| 5 | Desire to live | Ganas de vivir | at least 1 each of Weapon, Food, Fuel and Medicine in hand | ES,N |
| 6 | Experienced | n/a | (text unknown) | N |
| 7 | Germ-a-phobe | Germofobia | none of the survivors you control has any wound token | ES,N |
| 8 | Historian | Historiador | at least 2 Education cards in hand | ES,N |
| 9 | Hoarder | n/a | (text unknown) | N |
| 10 | Hope | n/a | (text unknown) | N |
| 11 | Hunger | n/a | at least 3 Food-symbol cards in hand | Ph,N |
| 12 | Hypochondriac | possibly Farmaceutico | (text unknown; one of 12 and 13 has the Farmaceutico text below) | N |
| 13 | Junkie | possibly Farmaceutico | (text unknown; the ES Farmaceutico card shows only Medicine cards in hand, at least 1) | N |
| 14 | Justice | n/a | (text unknown) | N |
| 15 | Leader | Lider | your group has more survivors than any other player's group | ES,N |
| 16 | Loner | Solitario | you control exactly one survivor | ES,N |
| 17 | Masochist | n/a | one survivor you control has at least 2 wound tokens of any kind | J,N |
| 18 | Neat freak | n/a | (text unknown) | N |
| 19 | Protected | n/a | (text unknown) | N |
| 20 | Repopulate | n/a | (text unknown) | N |
| 21 | Revenge | Venganza | at least 3 survivors have been removed from the game (helpless survivors do not count) | ES,N |
| 22 | Safety | n/a | (text unknown) | N |
| 23 | The way back home | El camino de vuelta a casa | at least 2 Fuel, 1 Food and 1 Weapon card in hand | ES,N |
| 24 | Zombie killing robot! | Un robot asesino de zombis | at least 1 Weapon and 2 Tool cards in hand | ES,N |

Counts (S): 24 names; 14 texts known (13 named rows plus the Farmaceutico card, which is one of rows 12 and 13);
10 unknown (9 named rows plus the other of Junkie and Hypochondriac). The ES Farmaceutico mapping to Junkie or
Hypochondriac is a guess by the Spanish-scan reader; Junkie is the likelier fit, not verified.

Secret objective rules (R p6, BO): each player gets 2 standard and, with the betrayer rule, the setup adds 1 betrayal
card to the pool dealt (R setup step 4); cards may be hidden; the same card can count for several objectives.

---

## C. Betrayal secret objectives (10)

Story ids are the rulebook's section ids (R p18-19, S11 to S20). The ES scans show the same ids for the three cards
they cover (S16, S17, S18), which cross-checks the mapping. The three known betrayal cards do not need the main
objective: they need morale at 0 plus a private condition. The other seven are unread.

| Story id | Name (N, R) | Condition (all required) | Tags |
|---|---|---|---|
| S11 | Gluttony | (text unknown) | N,R |
| S12 | Runaway | (text unknown) | N,R |
| S13 | Take Over | (text unknown) | N,R |
| S14 | All for One | (text unknown) | N,R |
| S15 | Accept Your Fate | (text unknown) | N,R |
| S16 | Trigger Happy | morale is 0 and the survivors you control carry at least 4 Weapon cards between them | ES,N,R (a secondary review agrees, per the research notes) |
| S17 | Cult Leader | morale is 0 and you control at least 2 more survivors than any other player | ES,N,R (the same review agrees) |
| S18 | Serial Killers | morale is 0, at least 5 survivors have been removed from the game (helpless survivors do not count) and you control at least 2 survivors | ES,N,R |
| S19 | Mad Scientist | (text unknown) | N,R |
| S20 | Obsessed | (text unknown) | N,R |

Counts (S): 10 names, 3 texts known, 7 unknown (Accept your fate, All for one, Gluttony, Mad scientist, Obsessed,
Runaway, Take over).

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

- Texts for 9 standard secret objectives (All I need is my books, Experienced, Hoarder, Hope, Justice, Neat freak,
  Protected, Repopulate, Safety) and one of Junkie or Hypochondriac.
- Texts for 7 betrayal objectives (Accept your fate, All for one, Gluttony, Mad scientist, Obsessed, Runaway, Take over).
- A real English photo for the hardcore faces still resting on P over BT (Find a Cure, Leave It All Behind, Home
  Sweet Home, Stockpile) and for the We Need More Samples hardcore token count.
