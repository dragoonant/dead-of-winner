# Data sources: index and gaps

Where every card value in the specs came from, and what is still missing. The per-card tables live in
`survivors-sources.md`, `items-sources.md`, `crises-sources.md`, `objectives-sources.md` and `locations-sources.md`
(the Crossroads cards have no table here yet); this file is the source list and the shopping list. Updated 2026-10-10.

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
| C / S | our own self-consistency checks (distinct influence values, deck sums). In `items-sources.md` and `locations-sources.md` S is this check; in `survivors-sources.md` B is the handoff brief |
| P | Portuguese fan translation (Ludopedia attachments 51111-51115 and 118679). A `P*` in a row means P words that card differently from the other sources |
| ES | Spanish-edition card scans (GitHub MiguelAngelCabanillas/Dead-Of-Winter) |
| Ph | fan photo of a real English-edition card, including the eBay photos of The Long Night location cards |
| J | unboxing photos of a non-English edition (Collector, Masochist, Exhaustion) |
| BT | BGG thread 2054328, main-objective transcription |
| BC | BGG Card Spread sheet (item decks and effects) |
| BO | Plaid Hat official rulings digest (BGG file) |
| N | GitHub etwest/deadofwinter_site, names of the secret objectives |
| (verify) | single fan source, or not stated anywhere readable; check before the data is final |

Precedence when sources disagree: rulebook and FAQ (R, F), then a photo of a real English card (Ph), then the Spanish
scans (ES), then the Portuguese translation (P), then the BGG fan transcriptions (BT, BC), then the wiki (W). Every
disagreement is tabled in the conflict section of the per-card file and carries a status: Confirmed, Corrected,
Unsourced or Fan-source.

## Source list

| # | Source | URL | Retrieved or dated | Local file | What it gave | Strength |
|---|---|---|---|---|---|---|
| 1 | Dead of Winter rulebook, Plaid Hat Games | publisher PDF (owner's copy) | 2014 print, copied into the repo workspace 2026-10-09 | `docs/sources/DoW-Rulebook-PlaidHat-2014.pdf` and `DoW-Rulebook.txt` (`rules.pdf` is a byte-identical duplicate) | components list, setup, round order, rules, nine survivor sample cards, Fuel and Lighter cards, location-card legend, the main-objective and betrayal story titles | official; the text extract interleaves columns and some card numbers need the PDF pages (no PDF renderer on this machine) |
| 2 | Dead of Winter FAQ v1.1 | publisher PDF (owner's copy) | v1.1, copied 2026-10-09 | `docs/sources/DoW-FAQ-v1.1.pdf` and `DoW-FAQ.txt` | rulings for John Price, Loretta Clay, Edward White, Buddy Davis, Harman Brooks, Rod Miller, Sparky, Janet, Jenny, Bev Russel, Old Divisions, Outbreak, Outsider cards, attract, request, food tokens, exile | official |
| 3 | Dead of Winter Fandom wiki | https://deadofwinter.fandom.com | MediaWiki API dump, 2026-10-10 (files stamped 2026-10-09 local time) | `docs/sources/fan/fandom/*.txt` (211 pages, wikitext) | all 30 base survivors with stats, abilities and Crossroads lists; the seven item decks; symbol, location and rules pages | medium; two known errors (Thomas Heart ability duplicated from Talia Jones, Loretta Clay `(4)` misprint) |
| 4 | TV Tropes, Characters/DeadOfWinter | http://tvtropes.org/pmwiki/pmwiki.php/Characters/DeadOfWinter | 2026-10-10 | `docs/sources/fan/tvtropes-characters.txt` | prose confirming attack and search values and abilities for most base survivors, and hints about their Crossroads cards | low alone; independent second reader |
| 5 | Esoteric Order of Gamers, Dead of Winter rules summary v1.2 | http://www.orderofgamers.com (summary PDF) | v1.2, March 2016 | `docs/sources/fan/DeadofWinter_v1.2.pdf` and `orderofgamers-summary-v1.2.txt` | a rules digest of the rulebook; the Outsider card handling | medium (secondary to 1) |
| 6 | BoardGameGeek thread 1303776 | https://boardgamegeek.com/thread/1303776 | cited by the owner and in the research notes; not fetched here | none | exposure die faces on its 12 sides: 6 blank, 3 wound, 2 frostbite, 1 bite | community count; matches the rulebook's dice list |
| 7 | BoardGameGeek files page for the base game | https://boardgamegeek.com/boardgame/150376/dead-of-winter-a-crossroads-game/files | the owner pointed to this page; the files below were downloaded by the owner and are in `docs/sources/bgg/` as of 2026-10-10 | see rows 14 to 16 | the downloads are rows 14 to 16 | see those rows |

| 8 | Ludopedia fan translation (Portuguese), attachments 51111-51115 and 118679, by users Sauron / spartaniv | https://www.ludopedia.com.br (Dead of Winter, anexos) | downloaded by the owner 2026-10-10; read the same day. The transcription header names 51111-51115; the files present are 51112, 51113, 51114, 51115 and 118679 | `docs/sources/bgg/dead_of_winter_um_j_traducao_em_portugues_*_5111[2-5].pdf` and `..._narrativas_..._118679.pdf` (with .txt), transcription in `docs/sources/fan/ludopedia-transcription.md` | all 20 crises (51114, titles in 118679), all 10 exiled objectives (51112), all 10 main objectives both sides (51113), 30 survivor abilities (51115), items and the six decks (51114) | medium: a translation of real cards, with slips found (Fuel Shortage morale, Zombie Wave zombies, New Friends text, several hardcore numbers) |
| 9 | BoardGameGeek thread 2054328, "Main objective cards" | https://boardgamegeek.com/thread/2054328/main-objective-cards | transcribed by Ragenarok124 2018-09-06, corrected by Git_ 2022-02-18, pasted by the owner 2026-10-10 | `docs/sources/bgg/thread-2054328-main-objectives.md` | all 10 main objectives, both sides, with hardcore changes in braces | medium: one volunteer transcription, two corrections inside it |
| 10 | Vassal module "Dead_of_Winner_Crossroads_1.1.vmod" (Dead of Winter: A Crossroads Game, v1.1) | https://vassalengine.org (module library) | built 2015 from the printed cards; sha256 abaf1ee0...; read 2026-10-10 | `docs/sources/fan/vassal-transcription.md` (the 117 extracted card images are not kept in the repo) | clean scans of all 20 crises, all 20 main-objective faces, all 24 standard secret objectives and 29 base survivors plus Gray Beard; betrayal objective conditions are censored in the module. Source tag `VASSAL v1.1 <file>` |
| 10 | Spanish-edition card scans | https://github.com/MiguelAngelCabanillas/Dead-Of-Winter (`images/`) | read 2026-10-10 | `docs/sources/fan/spanish-scans-transcription.md` (the images themselves are not copied) | 8 crises, 6 main objectives, 12 standard and 3 betrayal secret objectives, 4 exiled objectives, blurry location thumbnails | high for numbers (real cards); the English titles in the transcription are guesses |
| 11 | eBay seller photos of The Long Night location cards | an eBay listing (seller photos) | read 2026-10-10 | `docs/sources/fan/photos/tln-1.png` to `tln-10.png` | survivor spaces, entrance spaces, noise spaces and symbol rows of the six locations (ruling L1: Long Night layout taken as the base layout; the Grocery Store matches the rulebook diagram) | high for what they show; a different product from the base game |
| 12 | Taiwanese unboxing photos | a fan or seller unboxing set (non-English edition; the research notes label the edition J and show Japanese titles) | read 2026-10-10 | none in the repo; values are in the research notes | secret objective texts for Collector and Masochist, and the Exhaustion crisis symbol | medium: photos of a translated edition; the edition label is inconsistent between the brief and the notes |
| 13 | GitHub etwest/deadofwinter_site, files `obj_nonbetray.txt` and `obj_betray.txt` | https://github.com/etwest/deadofwinter_site | read 2026-10-10 | none in the repo; the names are in `objectives-sources.md` | the 24 standard and 10 betrayal secret objective names | medium (names only) |
| 14 | BoardGameGeek Card Spread sheet, `Dead_of_Winter_Card_Spread.xlsx` | BGG files for thing 150376 | downloaded by the owner, in `docs/sources/bgg/` as of 2026-10-10 | `docs/sources/bgg/Dead_of_Winter_Card_Spread.xlsx` and `.txt` | all item decks, counts by symbol in print order, class and effect of every item | medium-high |
| 15 | BoardGameGeek Crossroads sheet, `Crossroad_cards_v1.1.xlsx` (filepage 160324) | BGG files for thing 150376 | downloaded by the owner, in `docs/sources/bgg/` as of 2026-10-10 | `docs/sources/bgg/Crossroad_cards_v1.1.xlsx` and `.txt` | all 80 Crossroads cards (not tabled here yet) | medium |
| 16 | Plaid Hat official rulings digest, `Dead_of_Winter_Official_Rulings.pdf` | BGG files for thing 150376 | downloaded by the owner, in `docs/sources/bgg/` as of 2026-10-10 | `docs/sources/bgg/Dead_of_Winter_Official_Rulings.pdf` and `official-rulings.txt` | rulings on objectives, crises, exile, items and survivors | official |

BGG is unreachable from this machine (the owner downloads the files). Row 6 (thread 1303776) was never read by an agent
in this project; the exposure die faces rest on the research notes. Whoever uses it must record what they actually saw.

## Counts of what we have

| Content | Needed | Have | Where |
|---|---|---|---|
| Base survivors (stats, ability location, ability line) | 30 | 30 (Thomas Heart's ability is provisional, single fan source) | `survivors-sources.md` |
| Survivor Crossroads cards named after a survivor | 30 | 30 named (text of none here) | `survivors-sources.md` |
| Starting items | 25 | 25 with class and effect | `items-sources.md` |
| Location decks | 6 x 20 = 120 | 120 with class and effect (three wording points flagged) | `items-sources.md` |
| Crisis cards | 20 | 20 with symbols, fail and bonus; 3 official English names | `crises-sources.md` |
| Main objectives | 10 (20 faces) | 20 faces with every value; 6 rulings rest on P over BT, 1 on R over two fans | `objectives-sources.md` |
| Standard secret objectives | 24 | 24 names, 14 texts | `objectives-sources.md` |
| Betrayal secret objectives | 10 | 10 names, 3 texts | `objectives-sources.md` |
| Exiled secret objectives | 10 | 10 texts (P, 4 cross-checked by ES, Barter by a photo) | `objectives-sources.md` |
| Colony board | entrances, spaces, tracks | 6 entrances x 3 spaces, 24 occupant spaces, tracks 0 to 10 | `locations-sources.md` |
| Location cards | 6 | 6 with survivor spaces, entrance spaces, 4 noise, symbol order | `locations-sources.md` |
| Crossroads cards | 80 | 80 in the BGG sheet (row 15), not tabled here | `docs/sources/bgg/Crossroad_cards_v1.1.xlsx.txt` |

## Still missing

1. Real text for 5 betrayal objectives (Runaway, All for One, Trigger Happy, Cult Leader, Serial Killers): the VASSAL module
   censors every betrayal condition, so they stay on the fan sheet or the Spanish scan.
2. Nothing else for crises, main objectives, standard secret objectives or survivors: all verified from the clean VASSAL v1.1
   scans (2026-10-10). The Crossroads cards are not covered by that pass.

## Rules that the sources fix (for quick reference, our words)

- Exposure die faces: 6 blank, 3 wound, 2 frostbite, 1 bite (BGG 1303776); the rulebook lists one d12.
- Survivors: 30; influence is unique; abilities may carry a die-cost like `(4+)` and then may be used repeatedly
  unless the card says once per round (R p10).
- Location cards: 4 noise spaces; decks of 20; item symbol row ordered from likeliest to least likely (R p5).
- Starting items: 25 cards, deal 5 per player (7 in the two-player variant) (R p6, p15).
- Colony board: 6 entrances of 3 spaces each, 24 occupant spaces, morale and round tracks 0 to 10 (R p5 diagram).
- Every crisis needs a count equal to the number of non-exiled players and has the standard +2 cards for +1 morale option (R p4, p12).

## Conflicts logged

Each per-card file ends in a conflict table with a status per row.

- `survivors-sources.md`: C1 to C11. The ones that change a number the brief gave: Alexis Grey influence is 46 (not 68);
  Daniel Smith is once per round at a 4+ die (the VASSAL scan settles it); Loretta Clay is a 4+ die; Thomas Heart is a 5+ die
  (VASSAL v1.1 prints 5+); Annaleigh Chan is a Colony ability. All 30 are verified from the VASSAL scans.
- `items-sources.md`: I1 to I10. School holds a Megaphone, not Football Pads; Microphone is read as the FAQ's name for
  Megaphone; Walkie Talkie once per round and Scissors location take P over BC.
- `crises-sources.md`: C1 to C8. All 20 names are official and all 20 cards verified from the VASSAL scans: Fuel Shortage loses 2 morale; Zombie Surge puts 6 zombies at the colony; Waste Not keeps the
  printed direction (confirmed).
- `objectives-sources.md`: O1 to O14 (main) and D1 to D4 (exiled). New Friends follows the Spanish scan; the VASSAL scans settle O1 to O7:
  Find a Cure hardcore 3 Medicine, Leave It All Behind hardcore 3 zombies and one weapon per player and Food (not Fuel) cards,
  Stockpile 2 food (normal) and 3 (hardcore), We Need More Samples hardcore 4 tokens per player.
- `locations-sources.md`: L1 to L6. Long Night photos stand in for the base location cards (ruling L1); the School symbol
  row follows the photo, not the blurry Spanish thumbnail.
