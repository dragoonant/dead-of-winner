# Crisis cards: sources (research 2026-10-10)

All 20 crisis cards of the base game. Every value is a number, a symbol or a name; the effect column is a one-line
mechanical summary in our own words, never copied from a card, wiki or translation. Fan files and the official PDFs
live in `docs/sources/` (gitignored) and were read in the session only. Nothing here is copied into the repo.

All 20 English names are official: the clean scans of the Vassal module (VASSAL v1.1, 2026-10-10, read card by card) print
every title and every mechanic, and each of the 20 records is now status verified with the source tag
`VASSAL v1.1 Crisis_<name>.jpg`. Nine titles were still our own before that: six are renamed (Unending Hordes, Waste Not,
Illness, They're Watching Us, Starvation, Shaking Things Up) and three (Despair, Killer Instinct, Legions of Death) were
already the official words. Record ids never change, so saves keep working (the ids still read zombie-wave,
march-of-the-dead, endless-hordes, no-waste, sickness, we-are-being-watched, empty-pantry, reorganization and
spoiled-food).

## Source tags

| Tag | Source | What it gave | Strength |
|---|---|---|---|
| R | Plaid Hat rulebook (2014), `docs/sources/DoW-Rulebook.txt`: p4 sample crisis (Blizzard), p12 example and the Resolve Crisis step | the crisis layout (prevent symbol, count, FAIL, optional line), Blizzard and Fuel Shortage values, the point-counting rule | highest |
| Ph | fan photo of a real English-edition card, named in the research notes | Horror in the Night (name, symbol, fail) | high (a real card face) |
| ES | Spanish-edition card scans, GitHub MiguelAngelCabanillas/Dead-Of-Winter `images/`, read 2026-10-10 (`fan/spanish-scans-transcription.md`) | 8 cards: Spanish title, symbols, fail, optional line | high for numbers (real cards); English titles in that file are guesses |
| J | unboxing photo of a non-English edition card (the research notes show a Japanese title), named in the research notes | Exhaustion: the card exists and prevents with Medicine | medium (one fact) |
| P | Portuguese fan translation, Ludopedia attachments 51114 (the 20 crisis cards) and 118679 (20 flavour titles), downloaded by the owner 2026-10-10 (`fan/ludopedia-transcription.md`) | all 20 cards; names are Portuguese; the 118679 file gives a second Portuguese title for 10 of them | medium: a translation, with two known slips (C1, C2) |
| VASSAL | Vassal module "Dead_of_Winner_Crossroads_1.1.vmod" (vassalengine.org, sha256 abaf1ee0..., built 2015 from the printed cards), 20 clean card scans, read 2026-10-10 (`fan/vassal-transcription.md`) | all 20 cards in English: title, prevent symbol, FAIL text, optional line | highest for card content: a scan of the printed card |
| BO | Plaid Hat official rulings digest, `docs/sources/bgg/official-rulings.txt` | crisis rulings (food cards count once, not by value) | official |

Precedence for this file: R > VASSAL > Ph > ES > J > P (every VASSAL card agrees with R wherever R prints one).

## Rules that every card shares (all 20 agree)

| Rule | Value | Tags |
|---|---|---|
| Count needed to prevent | the number of non-exiled players, on all 20 cards | R p4 and p12, ES (8 cards), P (20 cards) |
| Scoring | each added card carrying a prevent symbol is +1; each added card without one is -1; prevented when the total reaches the count; a card counts once however many tokens or points it is worth | R (Resolve Crisis step), BO |
| Optional bonus | on every card: if the total exceeds the count by 2 or more, the colony gains 1 morale (the card line reads "add 2 extra matching cards for +1 morale") | R p12, ES, P |
| Two-symbol cards | either printed symbol scores +1 | R (any matching symbol), ES, P |
| Cards added to the crisis | removed from the game after resolving | R |

## The 20 cards

Prevent symbols: Fuel, Food, Medicine, Tool. All values below use the count "non-exiled players" and the standard
optional bonus unless the Notes column says otherwise. "P #" is the order on the Portuguese sheet (not a printed
number). Tags read `prevent / fail`; the count and bonus tags are in the shared-rules table above.

| P # | Portuguese name (alt title, file 118679) | Spanish name | English name | Prevent symbol(s) | FAIL effect (our words, one line) | Tags (prevent / fail) | Notes |
|---|---|---|---|---|---|---|---|
| 1 | Eles estao nos observando (Estamos sendo observados) | Nos estan observando | They're Watching Us (official, VASSAL; was our We Are Being Watched) | Medicine or Tool | add 3 zombies at the Library and 3 at the Grocery Store | VASSAL,ES,P / VASSAL,ES,P | ES calls the store the Supermarket; same location |
| 2 | Marcha dos homens mortos (Marcha dos mortos) | n/a | **Dead Man's March** (official, VASSAL, PHOTO bing; was March of the Dead) | Tool or Fuel | add 3 zombies at the School and 3 at the Police Station | VASSAL,P / VASSAL,P | single source |
| 3 | Instinto de assassino (Instinto assassino) | n/a | **Killer Instinct** (official, VASSAL) | Food or Medicine | add 3 zombies at the Hospital and 3 at the Gas Station | VASSAL,P / VASSAL,P | single source |
| 4 | Hordas interminaveis | n/a | **Unending Hordes** (official, VASSAL; was our Endless Hordes) | Tool | add 8 zombies at the Colony; lose 1 morale | VASSAL,P / VASSAL,P | single source |
| 5 | Agitando as coisas (Intercambio) | Reorganizacion | **Shaking Things Up** (official, VASSAL; was our Reorganization) | Tool | each non-exiled player hands 1 survivor they control to the player on their left, who now controls it; lose 1 morale | VASSAL,ES,P / VASSAL,ES,P | |
| 6 | Tempestade de granizo (Chuva de granizo) | n/a | **Hailstorm** (official, VASSAL, PHOTO bing) | Tool | each non-exiled player rolls 1 die; on 4 or lower they put a frostbite wound on one survivor they control; then remove every barricade from every location; no morale loss | VASSAL,P / VASSAL,P | single source |
| 7 | Onda de zumbi (Surto de zumbis) | Oleada de zombis | **Zombie Surge** (official, VASSAL, PHOTO bing; was Zombie Wave) | Tool | add 6 zombies at the Colony and 1 at each other location; no morale loss | VASSAL,ES,P,PHOTO bing / VASSAL,ES,PHOTO bing (P prints 8) | conflict C2 settled by the English card: 6 |
| 8 | Escassez de combustivel | Escasez de gasolina | **Fuel Shortage** (official, R p12, VASSAL) | Fuel | lose 2 morale | VASSAL,R,ES,P / VASSAL,R,ES (P prints 1) | conflict C1 |
| 9 | Congelamento (Nevasca) | n/a | **Blizzard** (official, R p4, VASSAL) | Fuel | non-exiled survivors cannot move until the end of the next round; lose 1 morale | VASSAL,R,P / VASSAL,R,P | the P card is identified by its matching effect (Fuel, no movement, lose 1) |
| 10 | Forcas dos mortos (Forca dos mortos) | n/a | **Strength of the Dead** (official, VASSAL, PHOTO bing) | Fuel | remove every barricade at the Colony, then add 10 zombies at the Colony; no morale loss | VASSAL,P / VASSAL,P | single source |
| 11 | Legioes da morte | n/a | **Legions of Death** (official, VASSAL) | Fuel | add 12 zombies at the Colony; no morale loss | VASSAL,P / VASSAL,P | single source |
| 12 | Desespero | n/a | **Despair** (official, VASSAL) | Medicine | lose 2 morale | VASSAL,P / VASSAL,P | single source |
| 13 | Exaustao | Agotamiento | **Exhaustion** (official, VASSAL, PHOTO ebay 405654582648) | Medicine | put 1 frostbite wound on each of the 5 non-exiled survivors with the highest influence; no morale loss | VASSAL,ES,P,J / VASSAL,ES,P | |
| 14 | Doencas (Molestia) | Enfermedad | **Illness** (official, VASSAL; was our Sickness) | Medicine | put 1 ordinary wound on every non-exiled survivor; lose 1 morale | VASSAL,ES,P / VASSAL,ES,P | ES says ordinary wound; P just says wound token |
| 15 | Comida vencida | n/a | **Food Spoilage** (official, VASSAL, PHOTO bing; was Spoiled Food) | Food | until the end of the next round non-exiled players cannot spend food tokens to raise action dice; lose 1 morale | VASSAL,P / VASSAL,P | single source |
| 16 | Sem desperdicio (Nao desperdicaras) | n/a | **Waste Not** (official, VASSAL; was our No Waste) | Food | as printed: every Food card that left the game goes onto the waste pile; lose 1 morale | VASSAL,P / VASSAL,P | direction flagged, see C3 |
| 17 | Invasores (Saqueadores) | n/a | **Raiders** (official, VASSAL, PHOTO ebay 326680035955) | Food | if able, each non-exiled player removes 1 random card of their hand from the game; lose 1 morale | VASSAL,P / VASSAL,P | single source |
| 18 | Fome (Inanicao) | Despensa vacia | **Starvation** (official, VASSAL; was our Empty Pantry) | Food | add 1 starvation token to the food supply; lose 1 morale | VASSAL,ES,P / VASSAL,ES,P | the official token name is starvation token (R Pay Food step, FAQ 6.1.1); ES says Hunger token, P says hunger marker |
| 19 | Super populacao (Superpopulacao) | n/a | **Overpopulation** (official, VASSAL, PHOTO ebay 313087713029) | Food | kill the 2 non-exiled survivors with the lowest influence; no morale loss | VASSAL,P / VASSAL,P | single source |
| 20 | Horror na noite (Terror na noite) | Horror en la noche | **Horror in the Night** (official, VASSAL, photo) | Food | lose 2 morale | VASSAL,Ph,ES,P / VASSAL,Ph,ES,P | |

Counts by prevent symbol (S, our check): two-symbol cards 3 (#1 Medicine or Tool, #2 Tool or Fuel, #3 Food or
Medicine); Tool only 4 (#4-#7); Fuel only 4 (#8-#11); Medicine only 3 (#12-#14); Food only 6 (#15-#20). Total 20.
Weapon and Education never appear as a prevent symbol.

By fail family (S, our check): morale only 3 (#8, #12, #20); movement lock plus morale 1 (#9); zombies only,
no morale 6 (#1, #2, #3, #7, #10, #11); zombies plus morale 1 (#4); wounds 3 (#6 and #13 without morale, #14 with);
cards or food 4 (#15, #16, #17, #18); survivor transfer or loss 2 (#5 with morale, #19 without). Total 20. The
families are only a reading aid for the effects DSL; they are not printed on the cards.

## Conflicts and rulings

| ID | Subject | Sources disagree | What the spec does | Status |
|---|---|---|---|---|
| C1 | Fuel Shortage morale loss | R p12 sample card and the ES scan print 2; P prints 1 | 2 | Corrected (R over P); Confirmed again by the VASSAL scan (Crisis_Fuel_Shortage.jpg prints 2) |
| C2 | Zombie Wave colony zombies | ES scan prints 6 at the Colony plus 1 at each other location; P prints 8 plus 1. P's 8 equals the Endless Hordes value (#4), so a copy slip is likely | 6 at the Colony, 1 at every other location. Flagged: single English face unseen, revisit if one turns up | Confirmed (English card photo, bing 2026-10-11, and VASSAL v1.1 Crisis_Zombie_Surge.jpg: 6 at the colony and 1 at every other location) |
| C3 | No Waste direction | P prints "take all Food cards that left the game and put them on the waste pile"; the transcriber found the direction odd and suspected the reverse (Food leaves the waste pile). No other source has this card | keep the printed direction: it reads as a penalty (the waste pile grows, and the rulebook's Check Waste step charges morale per 10 waste cards). VASSAL v1.1 Crisis_Waste_Not.jpg prints exactly this direction (food removed from the game goes to the waste pile, lose 1 morale) | Confirmed (VASSAL v1.1) |
| C4 | Empty Pantry token name | ES says Hunger token, P says hunger marker, R and FAQ say starvation token | starvation token (the official component); VASSAL v1.1 Crisis_Starvation.jpg prints "starvation token" | Corrected (R over ES,P); Confirmed (VASSAL v1.1) |
| C5 | Sickness wound type | ES says ordinary wound token, P says only "wound token" | ordinary wound (not frostbite, not bite) | Confirmed (ES; P compatible; VASSAL v1.1 Crisis_Illness.jpg prints "1 wound token" on every non-exiled survivor) |
| C6 | Blizzard / Congelamento match | the P card has no English name; the two titles in 118679 and 51114 differ (Nevasca vs Congelamento) | map by effect to Blizzard (Fuel, no movement until end of next round, lose 1 morale, as R p4) | Confirmed (R; VASSAL v1.1 Crisis_Blizzard.jpg) |
| C7 | Location names in fails | ES says Supermarket where P (and the board) say Grocery Store | Grocery Store (R p5 location list) | Confirmed |
| C8 | Count rule wording | R text says "number of players"; the cards say non-exiled players | non-exiled players (printed on every card in R, ES, P) | Confirmed |

The same rulings are returned as RULING lines to the orchestrator.

## Still missing for crises

Nothing. All 20 cards are read from the clean VASSAL v1.1 scans (title, symbol, FAIL, optional line); no value differed from
our records. Two open readings remain, neither a data gap: Shaking Things Up lets each player choose the survivor they
hand over, whereas the code hook (`crisis.reorganization.passSurvivors`) picks for them (the lowest-influence survivor
that is not the leader); and the Hailstorm and Reorganization hooks run inside the effect interpreter, which cannot pause
for a choice.

## VASSAL v1.1 cross-check (2026-10-10)

The 20 scans (Crisis_*.jpg) were compared field by field with the records. Result: 0 mechanics changed; 6 names changed
(Unending Hordes, Waste Not, Illness, They're Watching Us, Starvation, Shaking Things Up) and 3 of our own titles
(Despair, Killer Instinct, Legions of Death) turned out to be the official ones; all 20 are now verified. The scans also print "Optional: add 2 additional [symbol] cards to gain 1 morale
for preventing the crisis" on every card, confirming the shared bonus rule.

## Bing card photos (2026-10-11, superseded by the VASSAL scans above)

| Photo name | Our record (id kept) | Match | Result |
|---|---|---|---|
| Strength of the Dead | cr.strength-of-the-dead | Fuel; remove all colony barricades; add 10 zombies at the colony | verified, name official |
| Zombie Surge | cr.zombie-wave | Tool; 6 zombies at the colony and 1 at every other location | renamed, verified, C2 settled at 6 |
| Dead Man's March | cr.march-of-the-dead | Tool or Fuel; 3 zombies at the school and 3 at the police station | renamed, verified |
| Hailstorm | cr.hailstorm | name only (effect blurred) | name official, mechanics stay draft |
| Food Spoilage | cr.spoiled-food | name plus a "Lose 1 m..." fragment that fits | renamed, mechanics stay draft |
| "...hing Us" | cr.we-are-being-watched | Tool/Medicine-style symbol, zombies to the library and grocery store | effect fits, start of title cut off, so our name stays (tag name-partial-photo) |
