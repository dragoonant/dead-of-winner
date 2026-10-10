# Survivors: sources (research 2026-10-09, updated 2026-10-10)

The 30 base-game survivors (wiki `Source` = DoW; The Long Night, Warring Colonies and promo survivors are not
listed). Every value below is a number or a name. The ability column is a one-line mechanical summary in our own
words, written from the wiki's structured fields and never copied sentence by sentence. Fan files were read in the
session and are not committed; the rulebook and FAQ are the owner's private copies under `docs/sources/`
(gitignored).

## Source tags

| Tag | Source | What it gave | Strength |
|---|---|---|---|
| R | Plaid Hat rulebook (2014), `docs/sources/DoW-Rulebook.txt`: the p7 sample cards and the p9-10 examples | printed influence, attack and search of a handful of cards, and printed ability text of nine survivors | highest. The text extract interleaves columns, so a value read from it is marked `R*` when its column was inferred from reading order |
| F | FAQ v1.1, `docs/sources/DoW-FAQ.txt`, sections 1.1-1.3 and 2.2 | clarifications for John Price, Loretta Clay, Edward White, Buddy Davis, Harman Brooks, Rod Miller, Sparky, Janet, Jenny, and the Bev Russel Crossroads card | highest where it speaks; it never lists stats |
| W | Dead of Winter Fandom wiki: the `Survivors` table and each survivor page, from the API dump `fandom/*.txt` | every stat line, ability location, ability text, Crossroads list, co-op compatibility | medium: player-maintained; one copy-paste error (Thomas Heart) and one misprint carried over (Loretta Clay) |
| T | TV Tropes `Characters/DeadOfWinter` (`tvtropes-characters.txt`) | prose that confirms attack and search thresholds and abilities; hints about what the Crossroads cards do | low alone (trope prose, some of it wrong); useful as an independent second reader |
| C | Self-consistency check (ours) | the 30 wiki influence values are all distinct and form exactly 10, 12, 14 ... 68 | strong evidence that no influence value is mistyped, since one typo would break the pattern |
| P | Portuguese fan translation of all 30 survivors, Ludopedia attachment 51115 (`dead_of_winter_um_j_traducao_em_portugues_30_c_51115.pdf`), downloaded by the owner 2026-10-10; read through `docs/sources/fan/ludopedia-transcription.md` | ability location and ability text of all 30 survivors; prints NO influence, attack or search values; die-cost marks only on Bev Russell (1+) and Daniel Smith (4+) | medium: a translation of the real cards; outranks W where they differ and is outranked by R and F. A `P*` tag means P differs from the other sources, see Notes |
| B | Handoff brief Part G.1 (`docs/DEAD-OF-WINTER-HANDOFF.md`) | the starting table of known rows | memory-grade; checked below and corrected where wrong |

Influence matters for rules: all 30 are distinct (tag C), and the lowest influence at a location decides who
dies on an overrun or when a bite spreads (R p13).

## Table (all 30)

Stat tags read `influence / attack / search`. A stat tagged only `W` is single-sourced (fan wiki). A `+` means the
die must show that number or higher.

| # | Survivor | Occupation | Inf | Atk | Srch | Ability location | Ability (our words, one line) | Stat tags (inf / atk / srch) | Ability tags | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Alexis Grey | Librarian | 46 | 5+ | 4+ | Library | Once per round, a search at the library may look at and keep 1 extra card. | R*,W,C / R*,W / R*,W | R,W,T,P* | brief said 68, see C1; P omits "once per round" (translation slip: R p7 card prints it), see C9 |
| 2 | Andrew Evans | Farmer | 12 | 3+ | 3+ | Grocery Store | Once per round, a search at the grocery store may look at and keep 1 extra card. | W,C / W / W | W,T,P |  |
| 3 | Annaleigh Chan | Lawyer | 38 | 2+ | 2+ | Colony | Once per round, look at 1 randomly chosen card in another player's hand (P: one other player; W: each other player). Not allowed in the co-op variant. | W,C / W / W | W,T,P* | location and target differ between P and W, see C10; co-op exclusion: W and T |
| 4 | Arthur Thurston | Principal | 62 | 4+ | 2+ | School | Once per round, a search at the school may look at and keep 1 extra card. | W,C / W / W | W,T,P | T calls him a strong fighter, but 4+ is weak; ignore that T prose |
| 5 | Ashley Ross | Construction Worker | 52 | 2+ | 5+ | Anywhere | Once per round, do a barricade action without spending a die. | R,W,C / R,W,T / R*,W | R,W,T,P |  |
| 6 | Bev Russell | Mother | 34 | 2+ | 4+ | Colony | (1+ die) Once per round, kill 2 zombies at the colony with no exposure roll, while a helpless survivor token is at the colony. | W,C / W,T / W | W,T,P | FAQ spells her Crossroads card 'Bev Russel'; P prints the (1+) cost |
| 7 | Brandon Kane | Janitor | 26 | 2+ | 4+ | Colony | Once per round, a clean waste action removes 5 cards instead of 3. | W,C / W / W | W,T,P |  |
| 8 | Brian Lee | Mayor | 68 | 3+ | 4+ | Anywhere | Once per round, raise one of your unused action dice by 1. | R,W,C,T(highest) / R*,W / R*,W | R,W,P |  |
| 9 | Buddy Davis | Fitness Trainer | 36 | 2+ | 4+ | Anywhere | It takes 4 wounds to kill him instead of 3 (FAQ 1.1.5 covers John Price copying this). | W,C / W / W,T | F,W,T,P |  |
| 10 | Carla Thompson | Police Dispatcher | 22 | 4+ | 2+ | Police Station | Once per round, a search at the police station may look at and keep 1 extra card. | W,C / W / W | W,T,P |  |
| 11 | Daniel Smith | Sheriff | 66 | 2+ | 5+ | Anywhere | (4+ die) Kill 2 zombies at his location with a single exposure roll. The rulebook card shows no round limit; the wiki adds 'once per round'. | R,W,C / R*,W / R*,W | R,W,T,P | CONFLICT R vs W, see C2; P prints "once per round" like W, the R card does not, see C2 |
| 12 | David Garcia | Accountant | 50 | 4+ | 3+ | Anywhere | When he searches, look at 1 extra card (look only; the keep limit is unchanged). | W,C / W / W | W,P | W,P agree: look-only, no round limit printed, see C8 |
| 13 | Edward White | Chemist | 44 | 4+ | 3+ | Colony | (1+ die, plus the attack die: F 1.3.1) Once per round, an attack by Edward may play a medicine-symbol card to kill 3 zombies instead of 1, no exposure roll; the card's own ability is not used. | W,C / W / W | F,W,T,P | F 1.3.2: any medicine-symbol card works; F 1.3.3: a requested card works; P prints no die cost, the F/W cost stands, see C11 |
| 14 | Forest Plum | Mall Santa | 14 | 2+ | 5+ | Anywhere | At the start of your turn, may remove Forest from the game to raise morale by 1. | R,W,C,T(low) / W / R,W,T | R,W,T,P | attack value is in no R example, see C7; P gives no stats, attack stays single-sourced |
| 15 | Gabriel Diaz | Fireman | 60 | 2+ | 3+ | Anywhere | Once per round, at a location with an item deck: reveal its top 4, may take 1 Outsider card among them into hand, shuffle the rest back. | W,C / W / W | R,W,T,P | his influence is not legible in the R extract |
| 16 | Gray Beard | Pirate | 16 | 1+ | 4+ | Colony | Once per round, take a random card from another player's hand. Not allowed in the co-op variant. | W,C,T(low) / W / W | W,T,P | co-op exclusion: W and T |
| 17 | Harman Brooks | Park Ranger | 32 | 3+ | 3+ | Anywhere | A frostbite result counts as an ordinary wound instead. | W,C / W / W | F,W,T,P |  |
| 18 | James Meyers | Psychiatrist | 54 | 6+ | 3+ | Anywhere | Once per round, reroll one or more of your unused action dice and keep the new results. | W,C / W,T / W | W,T,P | W 'one or more' vs T 'one die', see C6 |
| 19 | Janet Taylor | Nurse | 42 | 3+ | 4+ | Hospital | Once per round, a search at the hospital may look at and keep 1 extra card. | W,C / W / W | F,W,T,P |  |
| 20 | Jenny Clark | Waitress | 24 | 4+ | 3+ | Anywhere | Once per round, a search with Jenny may look at 3 extra cards. | W,C / W / W | F,W,T,P | wiki Source cell is typed 'Dow' |
| 21 | John Price | Student | 18 | 3+ | 3+ | Non-colony | While away from the colony, he has the ability of every survivor sharing his location; copies begin on arrival and last until his next move completes. | W,C / W / W | F,W,T,P | 'Non-colony' label is W only, see C5; P label "away from the colony" matches W, see C5 |
| 22 | Loretta Clay | Cook | 20 | 2+ | 4+ | Colony | (4+ die) Once per round, add 2 food tokens to the food supply. | W,C / W,T / W | F,W,T,P | W prints '(4)', F corrects to 4+, see C3; P prints no die cost, the F/W cost stands, see C11 |
| 23 | Maria Lopez | Teacher | 48 | 4+ | 2+ | School | (1+ die) Once per round, kill 1 zombie at the school with no exposure roll. | W,C / W / W | W,T,P | P prints no die cost, the F/W cost stands, see C11 |
| 24 | Mike Cho | Ninja | 30 | 2+ | 4+ | Anywhere | His attacks never trigger an exposure roll. | R,W,C / R,W / W | R,W,T,P |  |
| 25 | Olivia Brown | Doctor | 56 | 4+ | 3+ | Anywhere | Once per round, remove any one wound token (any kind) from a survivor at her location, herself included. | R,W,C / W / W | R,W,T,P |  |
| 26 | Rod Miller | Truck Driver | 40 | 3+ | 3+ | Anywhere | Moving Rod never triggers an exposure roll. | W,C / W / W | F,W,T,P |  |
| 27 | Sophie Robinson | Pilot | 58 | 4+ | 1+ | Anywhere | Once per round, peek at the top card of one location's item deck, then put it back. | W,C / W / W,T | R,W,T,P |  |
| 28 | Sparky | Stunt Dog | 10 | 2+ | 2+ | Anywhere | A bite on his exposure roll counts as a wound instead; he is skipped when a bite effect spreads. | W,C / W / W | F,W,T,P | F 1.1.1 states only the first half |
| 29 | Talia Jones | Fortune Teller | 28 | 3+ | 1+ | Anywhere | Once per round, look at the top 2 crisis cards and reorder them, then say exactly 2 words about them to the table. | W,C / W / W | W,T,P |  |
| 30 | Thomas Heart | Soldier | 64 | 1+ | 3+ | Colony | PROVISIONAL (P only, no card photo): once per round, kill 2 zombies at the colony with no exposure roll; no die cost is printed. The wiki text (a copy of Talia Jones) is discarded. | W,C / W / W | P (single source) | PROVISIONAL, see C4 |

## Conflicts and rulings

| ID | Subject | Sources disagree | What the spec does | Status |
|---|---|---|---|---|
| C1 | Alexis Grey influence | brief G.1 says 68. The R sample card (p7), W and C all say 46; 68 is Brian Lee's value and sits beside her card in the R text extract | 46 / 5+ / 4+ | Corrected |
| C2 | Daniel Smith "once per round" | R p7 prints the ability with no round limit (only the 4+ die cost and "exposure once"); W, the brief and now P (4+ die, once per round) add "once per round" | follow the printed rulebook card: no round limit, each use costs a 4+ die (R p10: a die-cost ability may be used repeatedly unless it says otherwise). Two fan sources against one official sample card; revisit if the owner's physical card differs | Corrected (R over P,W) |
| C3 | Loretta Clay activation | W prints a plain `(4)`; F 1.2.1 says that was a misprint for `(4+)` | 4+ die, once per round | Corrected (F over W) |
| C4 | Thomas Heart ability | W page text is identical to Talia Jones's (discarded); the brief's guess has no source; T gives no ability text; P prints a real ability: Colony, once per round, kill 2 zombies at the colony, no exposure roll, no die cost printed | use the P ability, marked provisional (single fan source); stats 64 / 1+ / 3+ (W, C) kept; keep him out of golden examples until a card photo confirms | Fan-source (provisional) |
| C5 | John Price location | W labels the ability `NON-COLONY`; F 1.1.1 only says copies begin on arrival and end when his next move completes, and never mentions the colony; P prints "away from the colony" | he copies abilities only while away from the colony | Confirmed (W,P agree) |
| C6 | James Meyers reroll | W: reroll "one or more" unused dice and keep the second result; T: one die | take W (it reads like a quote of the card) | Fan-source |
| C7 | Forest Plum attack | brief: 2+ or 3+ unknown; W says 2+; no R example shows his attack (R p10 shows only his search, 5+); P prints no stats | 2+ (single source) | Fan-source |
| C8 | David Garcia | W with no round limit and look-only (no extra keep); P agrees (look at 1 extra card, no keep, no round limit printed) | as in the table | Confirmed (W,P agree) |
| C9 | Alexis Grey "once per round" | R p7 card text prints "Once per round" for her library search; W and T agree; P omits it | once per round (R); P's omission is a translation slip | Corrected (R over P) |
| C10 | Annaleigh Chan ability location and target | W: Anywhere, peek at 1 card in each other player's hand; P: Colony, look at 1 randomly chosen card from another player (one player). W and T both say not allowed in co-op | P: Colony, one other player's card, random choice; keep the co-op exclusion (W,T). The precedence rule puts P above W, but the readings differ in two fields, so a card photo is wanted | Fan-source |
| C11 | Die-cost marks for Loretta Clay, Maria Lopez, Edward White | P prints no die cost for them (it prints costs only for Bev Russell 1+ and Daniel Smith 4+); F 1.2.1 and W give 4+, 1+ and 1+ (Edward: 1+ plus the attack die, F 1.3.1) | keep the F/W costs; the translation dropped them | Confirmed (F over P) |

Cross-checks that agreed, no conflict: Ashley Ross attack 2+ (R example, T) and search 5+ (R*); Mike Cho attack 2+
(R example); Forest Plum search 5+ (R example); influence 56 Olivia Brown, 66 Daniel Smith, 52 Ashley Ross, 30 Mike
Cho, 14 Forest Plum, 68 Brian Lee, 46 Alexis Grey (R sample cards); Sophie Robinson search 1+, James Meyers attack
6+, Loretta Clay attack 2+, Bev Russell attack 2+ with 1+ on her ability (T prose); Buddy Davis a fighter and not
a searcher (T), matching 2+ / 4+. The brief rows for Carla Thompson, Sparky, Gabriel Diaz, Thomas Heart (stats),
Janet, Jenny, Harman, Rod, Buddy and Edward matched the wiki once the conflicts above were settled. The brief's
"remaining 10 survivors" are now filled.

P (2026-10-10) agrees with the table, apart from the rows in C2, C4, C9 and C10, for these survivors: Andrew Evans, Arthur
Thurston, Ashley Ross, Bev Russell, Brandon Kane, Brian Lee, Buddy Davis (4 wounds to kill), Carla Thompson, David
Garcia, Edward White, Forest Plum (ability), Gabriel Diaz, Gray Beard, Harman Brooks, James Meyers (one or more dice),
Janet Taylor, Jenny Clark, John Price (away from the colony), Loretta Clay, Maria Lopez, Mike Cho, Olivia Brown, Rod
Miller, Sophie Robinson, Sparky, Talia Jones. P gives no stats, so influence, attack and search keep their W/C/R tags.

## Crossroads cards named after survivors

Every one of the 30 wiki survivor pages lists exactly one Crossroads entry, and it carries the survivor's own name.
So all 30 base survivors have a personal Crossroads card: Alexis Grey, Andrew Evans, Annaleigh Chan, Arthur
Thurston, Ashley Ross, Bev Russell, Brandon Kane, Brian Lee, Buddy Davis, Carla Thompson, Daniel Smith, David
Garcia, Edward White, Forest Plum, Gabriel Diaz, Gray Beard, Harman Brooks, James Meyers, Janet Taylor, Jenny
Clark, John Price, Loretta Clay, Maria Lopez, Mike Cho, Olivia Brown, Rod Miller, Sophie Robinson, Sparky, Talia
Jones, Thomas Heart. The FAQ confirms one by name (2.2, "Bev Russel"). That is 30 of the 80 Crossroads cards; the
other 50 are not survivor-named and are still missing (see `README.md`).

T hints that some of these cards can show up when the survivor is not yet in play (check against the real card
list before trusting): Gabriel Diaz (arrives with 3 helpless survivors), John Price (a rescue at the school),
Sophie Robinson (a helicopter crash), Mike Cho (fights beside the player). Triggers and options for all 30 come
from the BGG "all crossroad cards" sheet and are not recorded here.

## Notes for the data schema

- Thomas Heart's ability (C4) is now provisional (P only). The schema should allow a `provisional` flag on an ability,
  and the loader may warn when a provisional ability is used in a golden example.
- Ability-location counts in the table: Anywhere 16, Colony 7 (Annaleigh Chan and Thomas Heart added from P), School 2, Library 1, Grocery Store 1, Police Station 1, Hospital 1, Non-colony 1 (= 30; none unknown any more).
- Die-cost abilities seen: Daniel Smith 4+, Loretta Clay 4+, Edward White 1+, Maria Lopez 1+, Bev Russell 1+ (P prints only Bev's and Daniel's).
- Co-op exclusions (W, T): Annaleigh Chan, Gray Beard. P prints no co-op note for either.
- Every "extra card" search ability is "look at and keep 1 more" except David Garcia (look only) and Jenny Clark
  (look at 3 more, no extra keep); John Price can stack them (F 1.1.2: at the hospital with Janet and Jenny he
  looks at 4 extra and keeps 2).
