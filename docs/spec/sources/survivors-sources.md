# Survivors: sources (research 2026-10-09)

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
| B | Handoff brief Part G.1 (`docs/DEAD-OF-WINTER-HANDOFF.md`) | the starting table of known rows | memory-grade; checked below and corrected where wrong |

Influence matters for rules: all 30 are distinct (tag C), and the lowest influence at a location decides who
dies on an overrun or when a bite spreads (R p13).

## Table (all 30)

Stat tags read `influence / attack / search`. A stat tagged only `W` is single-sourced (fan wiki). A `+` means the
die must show that number or higher.

| # | Survivor | Occupation | Inf | Atk | Srch | Ability location | Ability (our words, one line) | Stat tags (inf / atk / srch) | Ability tags | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Alexis Grey | Librarian | 46 | 5+ | 4+ | Library | Once per round, a search at the library may look at and keep 1 extra card. | R*,W,C / R*,W / R*,W | R,W,T | brief said 68, see C1 |
| 2 | Andrew Evans | Farmer | 12 | 3+ | 3+ | Grocery Store | Once per round, a search at the grocery store may look at and keep 1 extra card. | W,C / W / W | W,T |  |
| 3 | Annaleigh Chan | Lawyer | 38 | 2+ | 2+ | Anywhere | Once per round, randomly peek at 1 card in each other player's hand. Not allowed in the co-op variant. | W,C / W / W | W,T | co-op exclusion: W and T |
| 4 | Arthur Thurston | Principal | 62 | 4+ | 2+ | School | Once per round, a search at the school may look at and keep 1 extra card. | W,C / W / W | W,T | T calls him a strong fighter, but 4+ is weak; ignore that T prose |
| 5 | Ashley Ross | Construction Worker | 52 | 2+ | 5+ | Anywhere | Once per round, do a barricade action without spending a die. | R,W,C / R,W,T / R*,W | R,W,T |  |
| 6 | Bev Russell | Mother | 34 | 2+ | 4+ | Colony | (1+ die) Once per round, kill 2 zombies at the colony with no exposure roll, while a helpless survivor token is at the colony. | W,C / W,T / W | W,T | FAQ spells her Crossroads card 'Bev Russel' |
| 7 | Brandon Kane | Janitor | 26 | 2+ | 4+ | Colony | Once per round, a clean waste action removes 5 cards instead of 3. | W,C / W / W | W,T |  |
| 8 | Brian Lee | Mayor | 68 | 3+ | 4+ | Anywhere | Once per round, raise one of your unused action dice by 1. | R,W,C,T(highest) / R*,W / R*,W | R,W |  |
| 9 | Buddy Davis | Fitness Trainer | 36 | 2+ | 4+ | Anywhere | It takes 4 wounds to kill him instead of 3 (FAQ 1.1.5 covers John Price copying this). | W,C / W / W,T | F,W,T |  |
| 10 | Carla Thompson | Police Dispatcher | 22 | 4+ | 2+ | Police Station | Once per round, a search at the police station may look at and keep 1 extra card. | W,C / W / W | W,T |  |
| 11 | Daniel Smith | Sheriff | 66 | 2+ | 5+ | Anywhere | (4+ die) Kill 2 zombies at his location with a single exposure roll. The rulebook card shows no round limit; the wiki adds 'once per round'. | R,W,C / R*,W / R*,W | R,W,T | CONFLICT R vs W, see C2 |
| 12 | David Garcia | Accountant | 50 | 4+ | 3+ | Anywhere | When he searches, look at 1 extra card (look only; the keep limit is unchanged). | W,C / W / W | W | single source; T gives no ability text, see C8 |
| 13 | Edward White | Chemist | 44 | 4+ | 3+ | Colony | (1+ die, plus the attack die: F 1.3.1) Once per round, an attack by Edward may play a medicine-symbol card to kill 3 zombies instead of 1, no exposure roll; the card's own ability is not used. | W,C / W / W | F,W,T | F 1.3.2: any medicine-symbol card works; F 1.3.3: a requested card works |
| 14 | Forest Plum | Mall Santa | 14 | 2+ | 5+ | Anywhere | At the start of your turn, may remove Forest from the game to raise morale by 1. | R,W,C,T(low) / W / R,W,T | R,W,T | attack value is in no R example, see C7 |
| 15 | Gabriel Diaz | Fireman | 60 | 2+ | 3+ | Anywhere | Once per round, at a location with an item deck: reveal its top 4, may take 1 Outsider card among them into hand, shuffle the rest back. | W,C / W / W | R,W,T | his influence is not legible in the R extract |
| 16 | Gray Beard | Pirate | 16 | 1+ | 4+ | Colony | Once per round, take a random card from another player's hand. Not allowed in the co-op variant. | W,C,T(low) / W / W | W,T | co-op exclusion: W and T |
| 17 | Harman Brooks | Park Ranger | 32 | 3+ | 3+ | Anywhere | A frostbite result counts as an ordinary wound instead. | W,C / W / W | F,W,T |  |
| 18 | James Meyers | Psychiatrist | 54 | 6+ | 3+ | Anywhere | Once per round, reroll one or more of your unused action dice and keep the new results. | W,C / W,T / W | W,T | W 'one or more' vs T 'one die', see C6 |
| 19 | Janet Taylor | Nurse | 42 | 3+ | 4+ | Hospital | Once per round, a search at the hospital may look at and keep 1 extra card. | W,C / W / W | F,W,T |  |
| 20 | Jenny Clark | Waitress | 24 | 4+ | 3+ | Anywhere | Once per round, a search with Jenny may look at 3 extra cards. | W,C / W / W | F,W,T | wiki Source cell is typed 'Dow' |
| 21 | John Price | Student | 18 | 3+ | 3+ | Non-colony | While away from the colony, he has the ability of every survivor sharing his location; copies begin on arrival and last until his next move completes. | W,C / W / W | F,W,T | 'Non-colony' label is W only, see C5 |
| 22 | Loretta Clay | Cook | 20 | 2+ | 4+ | Colony | (4+ die) Once per round, add 2 food tokens to the food supply. | W,C / W,T / W | F,W,T | W prints '(4)', F corrects to 4+, see C3 |
| 23 | Maria Lopez | Teacher | 48 | 4+ | 2+ | School | (1+ die) Once per round, kill 1 zombie at the school with no exposure roll. | W,C / W / W | W,T |  |
| 24 | Mike Cho | Ninja | 30 | 2+ | 4+ | Anywhere | His attacks never trigger an exposure roll. | R,W,C / R,W / W | R,W,T |  |
| 25 | Olivia Brown | Doctor | 56 | 4+ | 3+ | Anywhere | Once per round, remove any one wound token (any kind) from a survivor at her location, herself included. | R,W,C / W / W | R,W,T |  |
| 26 | Rod Miller | Truck Driver | 40 | 3+ | 3+ | Anywhere | Moving Rod never triggers an exposure roll. | W,C / W / W | F,W,T |  |
| 27 | Sophie Robinson | Pilot | 58 | 4+ | 1+ | Anywhere | Once per round, peek at the top card of one location's item deck, then put it back. | W,C / W / W,T | R,W,T |  |
| 28 | Sparky | Stunt Dog | 10 | 2+ | 2+ | Anywhere | A bite on his exposure roll counts as a wound instead; he is skipped when a bite effect spreads. | W,C / W / W | F,W,T | F 1.1.1 states only the first half |
| 29 | Talia Jones | Fortune Teller | 28 | 3+ | 1+ | Anywhere | Once per round, look at the top 2 crisis cards and reorder them, then say exactly 2 words about them to the table. | W,C / W / W | W,T |  |
| 30 | Thomas Heart | Soldier | 64 | 1+ | 3+ | (unknown) | (ability unknown) The wiki page repeats Talia Jones's ability word for word, almost certainly a wiki error. Do not use. | W,C / W / W | none | CONFLICT, see C4 |

## Conflicts and rulings

| ID | Subject | Sources disagree | What the spec does | Status |
|---|---|---|---|---|
| C1 | Alexis Grey influence | brief G.1 says 68. The R sample card (p7), W and C all say 46; 68 is Brian Lee's value and sits beside her card in the R text extract | 46 / 5+ / 4+ | Corrected |
| C2 | Daniel Smith "once per round" | R p7 prints the ability with no round limit (only the 4+ die cost and "exposure once"); W and the brief add "once per round" | follow the printed card: no round limit, each use costs a 4+ die (R p10: a die-cost ability may be used repeatedly unless it says otherwise). Revisit if the owner's physical card differs | Corrected (R over W) |
| C3 | Loretta Clay activation | W prints a plain `(4)`; F 1.2.1 says that was a misprint for `(4+)` | 4+ die, once per round | Corrected (F over W) |
| C4 | Thomas Heart ability | W page text is identical to Talia Jones's; the brief's guess has no source; T gives no ability text | ability stays unknown; stats 64 / 1+ / 3+ (W, C) kept; leave him out of the first slice and out of test decks until a card photo settles it | Unsourced |
| C5 | John Price location | W labels the ability `NON-COLONY`; F 1.1.1 only says copies begin on arrival and end when his next move completes, and never mentions the colony | keep the W label: he copies abilities only while away from the colony | Fan-source |
| C6 | James Meyers reroll | W: reroll "one or more" unused dice and keep the second result; T: one die | take W (it reads like a quote of the card) | Fan-source |
| C7 | Forest Plum attack | brief: 2+ or 3+ unknown; W says 2+; no R example shows his attack (R p10 shows only his search, 5+) | 2+ | Fan-source |
| C8 | David Garcia | W alone, with no round limit and look-only (no extra keep) | as in the table | Fan-source |

Cross-checks that agreed, no conflict: Ashley Ross attack 2+ (R example, T) and search 5+ (R*); Mike Cho attack 2+
(R example); Forest Plum search 5+ (R example); influence 56 Olivia Brown, 66 Daniel Smith, 52 Ashley Ross, 30 Mike
Cho, 14 Forest Plum, 68 Brian Lee, 46 Alexis Grey (R sample cards); Sophie Robinson search 1+, James Meyers attack
6+, Loretta Clay attack 2+, Bev Russell attack 2+ with 1+ on her ability (T prose); Buddy Davis a fighter and not
a searcher (T), matching 2+ / 4+. The brief rows for Carla Thompson, Sparky, Gabriel Diaz, Thomas Heart (stats),
Janet, Jenny, Harman, Rod, Buddy and Edward matched the wiki once the conflicts above were settled. The brief's
"remaining 10 survivors" are now filled.

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

- Thomas Heart's ability (C4) blocks a complete survivor set. The schema should allow an `unknown` ability, and the
  loader should refuse to put him in a game until it is filled.
- Ability-location counts in the table: Anywhere 17, Colony 5, School 2, Library 1, Grocery Store 1, Police Station 1, Hospital 1, Non-colony 1, (unknown) 1.
- Die-cost abilities seen: Daniel Smith 4+, Loretta Clay 4+, Edward White 1+, Maria Lopez 1+, Bev Russell 1+.
- Co-op exclusions (W, T): Annaleigh Chan, Gray Beard.
- Every "extra card" search ability is "look at and keep 1 more" except David Garcia (look only) and Jenny Clark
  (look at 3 more, no extra keep); John Price can stack them (F 1.1.2: at the hospital with Janet and Jenny he
  looks at 4 extra and keeps 2).
