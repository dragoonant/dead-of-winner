# Data sources: index and gaps

Where every card value in the specs came from, and what is still missing. The per-card tables live in
`survivors-sources.md` and `items-sources.md`; this file is the source list and the shopping list.

This is an unofficial fan project, not affiliated with Plaid Hat Games, Fantasy Flight Games or Asmodee.
Mechanics and numbers are used 1:1; names may match the real cards; every sentence of prose in the repo is ours.
Nothing below is copied into the repo. Fan files and the official PDFs live in `docs/sources/` (gitignored) and are
read in the session only.

## Tags used in the sources files

| Tag | Meaning |
|---|---|
| R | official rulebook text (R*, a value read from the garbled column order of the text extract) |
| F | official FAQ v1.1 |
| W | Dead of Winter Fandom wiki |
| T | TV Tropes character page |
| O | Esoteric Order of Gamers rules summary |
| C / S | our own self-consistency checks (distinct influence values, deck sums) |
| (verify) | single fan source, or not stated anywhere readable; check before the data is final |

## Source list

| # | Source | URL | Retrieved or dated | Local file | What it gave | Strength |
|---|---|---|---|---|---|---|
| 1 | Dead of Winter rulebook, Plaid Hat Games | publisher PDF (owner's copy) | 2014 print, copied into the repo workspace 2026-10-09 | `docs/sources/DoW-Rulebook-PlaidHat-2014.pdf` and `DoW-Rulebook.txt` (`rules.pdf` is a byte-identical duplicate) | components list, setup, round order, rules, nine survivor sample cards, Fuel and Lighter cards, location-card legend, the main-objective and betrayal story titles | official; the text extract interleaves columns and some card numbers need the PDF pages (no PDF renderer on this machine) |
| 2 | Dead of Winter FAQ v1.1 | publisher PDF (owner's copy) | v1.1, copied 2026-10-09 | `docs/sources/DoW-FAQ-v1.1.pdf` and `DoW-FAQ.txt` | rulings for John Price, Loretta Clay, Edward White, Buddy Davis, Harman Brooks, Rod Miller, Sparky, Janet, Jenny, Bev Russel, Old Divisions, Outbreak, Outsider cards, attract, request, food tokens, exile | official |
| 3 | Dead of Winter Fandom wiki | https://deadofwinter.fandom.com | MediaWiki API dump, 2026-10-10 (files stamped 2026-10-09 local time) | `docs/sources/fan/fandom/*.txt` (211 pages, wikitext) | all 30 base survivors with stats, abilities and Crossroads lists; the seven item decks; symbol, location and rules pages | medium; two known errors (Thomas Heart ability duplicated from Talia Jones, Loretta Clay `(4)` misprint) |
| 4 | TV Tropes, Characters/DeadOfWinter | http://tvtropes.org/pmwiki/pmwiki.php/Characters/DeadOfWinter | 2026-10-10 | `docs/sources/fan/tvtropes-characters.txt` | prose confirming attack and search values and abilities for most base survivors, and hints about their Crossroads cards | low alone; independent second reader |
| 5 | Esoteric Order of Gamers, Dead of Winter rules summary v1.2 | http://www.orderofgamers.com (summary PDF) | v1.2, March 2016 | `docs/sources/fan/DeadofWinter_v1.2.pdf` and `orderofgamers-summary-v1.2.txt` | a rules digest of the rulebook; the Outsider card handling | medium (secondary to 1) |
| 6 | BoardGameGeek thread 1303776 | https://boardgamegeek.com/thread/1303776 | cited by the owner; not fetched here | none | exposure die faces on its 12 sides: 6 blank, 3 wound, 2 frostbite, 1 bite | community count; matches the rulebook's dice list |
| 7 | BoardGameGeek files page for the base game | https://boardgamegeek.com/boardgame/150376/dead-of-winter-a-crossroads-game/files | the owner pointed to this page | none | lead for card references; filepage 160324 is the "all crossroad cards" sheet | unread |

BGG is unreachable from this machine (per the task note; the owner must download the files). Items 6 and 7 were
never read by an agent in this project. Whoever uses them must record what they actually saw.

## Counts of what we have

| Content | Needed | Have | Where |
|---|---|---|---|
| Base survivors (stats, ability location, ability line) | 30 | 29 complete, 1 with unknown ability (Thomas Heart) | `survivors-sources.md` |
| Survivor Crossroads cards named after a survivor | 30 | 30 named (text of none) | `survivors-sources.md` |
| Starting items | 25 | 25 (names and counts; effects unknown) | `items-sources.md` |
| Location decks | 6 x 20 = 120 | 120 (names, symbols, counts; effects mostly unknown) | `items-sources.md` |

## Still missing

Each line says what to get and the best known lead. Nothing here may be guessed into the data.

1. **20 crisis cards.** Needed per card: name, prevent symbols (item type for each, in order), required card
   count, fail effect, optional bonus. Only Blizzard, Fuel Shortage and the Hunted-related lines in R p4 and p12 are
   known. Leads: BGG files for thing 150376, the fandom `Crisis` page (not in the dump, so fetch it), card photos.
2. **80 Crossroads cards.** Needed per card: trigger predicate, two options with effects, mature flag. The 30
   survivor-named ones exist by name (survivors-sources.md); the other 50 are unnamed. Lead: BGG filepage 160324
   ("all crossroad cards" spreadsheet, needs a BGG login, owner to download). FAQ gives the effect hints for Bev
   Russel, Old Divisions and Outbreak only.
3. **10 main objectives, both sides (20 faces).** Needed: morale, rounds, setup, win condition, hardcore values,
   time rating. R p15-19 gives the ten story titles and We Need More Samples; Find a Cure is partly known from a
   BGG thread. The fandom `Main Objectives` page is not in the dump; fetch it. Lead: BGG files and threads.
4. **Secret objectives: 24 standard, 10 betrayal, 10 exiled** (44 cards). R p18-19 gives the ten betrayal
   titles only. Lead: BGG files and threads, card photos.
5. **Location space counts and symbol orders.** Per location (six) and for the colony board: survivor spaces,
   entrance spaces (and per colony entrance), the item-symbol row. R p5 fixes only the layout (4 noise spaces,
   symbol row ordered likeliest to least). Leads: BGG filepage 160324 and threads 2054328, 2017807 and 1923268
   (the owner's named leads; contents not yet seen), plus board and location-card photos from store listings.
6. **Item card text.** Class (Equip, Event, Waste Pile) and the effect of every item except Fuel and Lighter, for
   all 145 item cards, plus the Microphone card the FAQ mentions that no wiki deck lists.
7. **Thomas Heart's ability.** The wiki copied Talia Jones's text onto him. Needs one card photo.
8. **Survivor stats confirmation.** Most survivors' attack and search values come from the wiki alone (the R
   examples fix only a handful). The influence set is self-consistent (10 to 68 in steps of 2) so influence is safe; attack and
   search would be checked against one photo sheet.
9. **Hardcore, co-op and exile variants, if the main-objective sheet has more.** Beyond what R p15 states.

## Rules that the sources fix (for quick reference, our words)

- Exposure die faces: 6 blank, 3 wound, 2 frostbite, 1 bite (BGG 1303776); the rulebook lists one d12.
- Survivors: 30; influence is unique; abilities may carry a die-cost like `(4+)` and then may be used repeatedly
  unless the card says once per round (R p10).
- Location cards: 4 noise spaces; decks of 20; item symbol row ordered from likeliest to least likely (R p5).
- Starting items: 25 cards, deal 5 per player (7 in the two-player variant) (R p6, p15).

## Conflicts logged

See the tables in `survivors-sources.md` (C1 to C8) and `items-sources.md` (I1 to I5). The ones that change a
number the brief gave: Alexis Grey influence is 46 (not 68); Daniel Smith has no "once per round"; Loretta Clay is a
4+ die; Thomas Heart's ability is unknown.
