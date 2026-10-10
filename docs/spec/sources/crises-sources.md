# Crisis cards: sources (research 2026-10-10)

All 20 crisis cards of the base game. Every value is a number, a symbol or a name; the effect column is a one-line
mechanical summary in our own words, never copied from a card, wiki or translation. Fan files and the official PDFs
live in `docs/sources/` (gitignored) and were read in the session only. Nothing here is copied into the repo.

English names: only Blizzard (R p4), Fuel Shortage (R p12) and Horror in the Night (English card photo) are
official. Every other title is our own and is marked `(ours)`; it is a working label for the data files, not a claim
about the printed English name. 17 official names are still missing (see `README.md`).

## Source tags

| Tag | Source | What it gave | Strength |
|---|---|---|---|
| R | Plaid Hat rulebook (2014), `docs/sources/DoW-Rulebook.txt`: p4 sample crisis (Blizzard), p12 example and the Resolve Crisis step | the crisis layout (prevent symbol, count, FAIL, optional line), Blizzard and Fuel Shortage values, the point-counting rule | highest |
| Ph | fan photo of a real English-edition card, named in the research notes | Horror in the Night (name, symbol, fail) | high (a real card face) |
| ES | Spanish-edition card scans, GitHub MiguelAngelCabanillas/Dead-Of-Winter `images/`, read 2026-10-10 (`fan/spanish-scans-transcription.md`) | 8 cards: Spanish title, symbols, fail, optional line | high for numbers (real cards); English titles in that file are guesses |
| J | unboxing photo of a non-English edition card (the research notes show a Japanese title), named in the research notes | Exhaustion: the card exists and prevents with Medicine | medium (one fact) |
| P | Portuguese fan translation, Ludopedia attachments 51114 (the 20 crisis cards) and 118679 (20 flavour titles), downloaded by the owner 2026-10-10 (`fan/ludopedia-transcription.md`) | all 20 cards; names are Portuguese; the 118679 file gives a second Portuguese title for 10 of them | medium: a translation, with two known slips (C1, C2) |
| BO | Plaid Hat official rulings digest, `docs/sources/bgg/official-rulings.txt` | crisis rulings (food cards count once, not by value) | official |

Precedence for this file: R > Ph > ES > J > P.

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
| 1 | Eles estao nos observando (Estamos sendo observados) | Nos estan observando | We Are Being Watched (ours) | Medicine or Tool | add 3 zombies at the Library and 3 at the Grocery Store | ES,P / ES,P | ES calls the store the Supermarket; same location |
| 2 | Marcha dos homens mortos (Marcha dos mortos) | n/a | March of the Dead (ours) | Tool or Fuel | add 3 zombies at the School and 3 at the Police Station | P / P | single source |
| 3 | Instinto de assassino (Instinto assassino) | n/a | Killer Instinct (ours) | Food or Medicine | add 3 zombies at the Hospital and 3 at the Gas Station | P / P | single source |
| 4 | Hordas interminaveis | n/a | Endless Hordes (ours) | Tool | add 8 zombies at the Colony; lose 1 morale | P / P | single source |
| 5 | Agitando as coisas (Intercambio) | Reorganizacion | Reorganization (ours) | Tool | each non-exiled player hands 1 survivor they control to the player on their left, who now controls it; lose 1 morale | ES,P / ES,P | |
| 6 | Tempestade de granizo (Chuva de granizo) | n/a | Hailstorm (ours) | Tool | each non-exiled player rolls 1 die; on 4 or lower they put a frostbite wound on one survivor they control; then remove every barricade from every location; no morale loss | P / P | single source |
| 7 | Onda de zumbi (Surto de zumbis) | Oleada de zombis | Zombie Wave (ours) | Tool | add 6 zombies at the Colony and 1 at each other location; no morale loss | ES,P / ES (P prints 8) | conflict C2 |
| 8 | Escassez de combustivel | Escasez de gasolina | **Fuel Shortage** (official, R p12) | Fuel | lose 2 morale | R,ES,P / R,ES (P prints 1) | conflict C1 |
| 9 | Congelamento (Nevasca) | n/a | **Blizzard** (official, R p4) | Fuel | non-exiled survivors cannot move until the end of the next round; lose 1 morale | R,P / R,P | the P card is identified by its matching effect (Fuel, no movement, lose 1) |
| 10 | Forcas dos mortos (Forca dos mortos) | n/a | Strength of the Dead (ours) | Fuel | remove every barricade at the Colony, then add 10 zombies at the Colony; no morale loss | P / P | single source |
| 11 | Legioes da morte | n/a | Legions of Death (ours) | Fuel | add 12 zombies at the Colony; no morale loss | P / P | single source |
| 12 | Desespero | n/a | Despair (ours) | Medicine | lose 2 morale | P / P | single source |
| 13 | Exaustao | Agotamiento | Exhaustion (ours) | Medicine | put 1 frostbite wound on each of the 5 non-exiled survivors with the highest influence; no morale loss | ES,P,J / ES,P | |
| 14 | Doencas (Molestia) | Enfermedad | Sickness (ours) | Medicine | put 1 ordinary wound on every non-exiled survivor; lose 1 morale | ES,P / ES,P | ES says ordinary wound; P just says wound token |
| 15 | Comida vencida | n/a | Spoiled Food (ours) | Food | until the end of the next round non-exiled players cannot spend food tokens to raise action dice; lose 1 morale | P / P | single source |
| 16 | Sem desperdicio (Nao desperdicaras) | n/a | No Waste (ours) | Food | as printed: every Food card that left the game goes onto the waste pile; lose 1 morale | P / P | direction flagged, see C3 |
| 17 | Invasores (Saqueadores) | n/a | Raiders (ours) | Food | if able, each non-exiled player removes 1 random card of their hand from the game; lose 1 morale | P / P | single source |
| 18 | Fome (Inanicao) | Despensa vacia | Empty Pantry (ours) | Food | add 1 starvation token to the food supply; lose 1 morale | ES,P / ES,P | the official token name is starvation token (R Pay Food step, FAQ 6.1.1); ES says Hunger token, P says hunger marker |
| 19 | Super populacao (Superpopulacao) | n/a | Overpopulation (ours) | Food | kill the 2 non-exiled survivors with the lowest influence; no morale loss | P / P | single source |
| 20 | Horror na noite (Terror na noite) | Horror en la noche | **Horror in the Night** (official, photo) | Food | lose 2 morale | Ph,ES,P / Ph,ES,P | |

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
| C1 | Fuel Shortage morale loss | R p12 sample card and the ES scan print 2; P prints 1 | 2 | Corrected (R over P) |
| C2 | Zombie Wave colony zombies | ES scan prints 6 at the Colony plus 1 at each other location; P prints 8 plus 1. P's 8 equals the Endless Hordes value (#4), so a copy slip is likely | 6 at the Colony, 1 at every other location. Flagged: single English face unseen, revisit if one turns up | Corrected (ES over P) |
| C3 | No Waste direction | P prints "take all Food cards that left the game and put them on the waste pile"; the transcriber found the direction odd and suspected the reverse (Food leaves the waste pile). No other source has this card | keep the printed direction: it reads as a penalty (the waste pile grows, and the rulebook's Check Waste step charges morale per 10 waste cards). Revisit if an English face shows the opposite | Fan-source |
| C4 | Empty Pantry token name | ES says Hunger token, P says hunger marker, R and FAQ say starvation token | starvation token (the official component) | Corrected (R over ES,P) |
| C5 | Sickness wound type | ES says ordinary wound token, P says only "wound token" | ordinary wound (not frostbite, not bite) | Confirmed (ES; P compatible) |
| C6 | Blizzard / Congelamento match | the P card has no English name; the two titles in 118679 and 51114 differ (Nevasca vs Congelamento) | map by effect to Blizzard (Fuel, no movement until end of next round, lose 1 morale, as R p4) | Confirmed (R) |
| C7 | Location names in fails | ES says Supermarket where P (and the board) say Grocery Store | Grocery Store (R p5 location list) | Confirmed |
| C8 | Count rule wording | R text says "number of players"; the cards say non-exiled players | non-exiled players (printed on every card in R, ES, P) | Confirmed |

The same rulings are returned as RULING lines to the orchestrator.

## Still missing for crises

- Official English names for 17 of the 20 cards (all except Blizzard, Fuel Shortage, Horror in the Night).
- An English face for Zombie Wave to settle C2, and for No Waste to settle C3.
