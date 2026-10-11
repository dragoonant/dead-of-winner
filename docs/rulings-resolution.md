# Rulings resolution (2026-10-10)

Checked every non-Confirmed line of `docs/needs-rules-check.md` against: 2014 rulebook (R), 2020 rulebook, FAQ v1.1 (F), the
designer rulings digest (`sources/bgg/official-rulings.txt`, "digest") and The Long Night rulebook (TLN). Line numbers below are
the numbers in the edited `needs-rules-check.md`. Card-data lines from fan sources stay as they are (no official text covers them).
Each edited line now ends `<status> (<citation>) [was: <old status>]`. Page numbers are the printed rulebook page numbers.

## Summary

| Result | Lines |
| --- | --- |
| Reviewed this pass (previously Unsourced, Fan-source or mixed) | 101 |
| CONFIRMED by an official source | 15 (two of these were already Confirmed and only gained a citation) |
| CORRECTED (an official source says otherwise) | 14 |
| STILL OPEN (no official source, our ruling stands) | 72 |
| Already Confirmed or Corrected before this pass, left as they were | 95 (72 Confirmed, 23 Corrected) |
| Total RULING lines | 196 |

Of the 72 still open: about 30 are fan-sourced card data, about 17 are engine or AI design conventions with no rules content, and the rest are
genuine gaps in the rulebook.

## CHANGES NEEDED (CORRECTED rulings that imply engine or data behaviour)

Ordered by gameplay impact. "Engine file" is the likely owner (grep of `src/engine`); none was edited.

1. **Exiled survivors may not move back to the colony** (lines 41 "exiled survivors moving back to the colony" and 97 "re-entering the colony"; line 53 "exiled survivors and the colony" is now Confirmed).
   Correct rule: exiled survivors cannot move back to the colony. Cite: digest, Exile, "Can exiled survivors move back to the colony? No".
   Engine file: `src/engine/actions/move.ts` (legality and legalActions), `src/engine/exile.ts`; spec test MOVE-010 must flip, and the "then they count for food and zombies" path is moot.
   Test: exiled seat's survivor at the school; `move` to colony is rejected (E_TARGET_INVALID) and absent from legalActions.

2. **Morale reaching 0 inside Adding Zombies does not stop the step mid-way** (line 200 "morale zero inside the colony phase").
   Correct rule: morale is checked only after colony zombies (B), after non-colony zombies (D) and after noise (F); an overrun that empties morale lets the rest of that section finish (including further overruns and the last-survivor replacement), then the game ends. Cite: FAQ 6.2.1 A to F; digest General "Does the game end right away if morale drops to 0?". Outside Adding Zombies (food, waste, crisis) it still ends at once (R p14).
   Engine file: `src/engine/colony-phase.ts` (`addZombiesStep`, the `halted(acc)` returns after `addZombiesInto`) and `src/engine/exposure.ts` (`loseMoraleInto`).
   Test: colony with morale 1 and two overruns queued in step A; both survivors die, both zombies resolve, morale 0 is reported at (B) and the game ends before any non-colony zombie is added.

3. **Vote ties are still broken by the first player, even if that seat cannot vote** (lines 42 "vote tie-break when the first seat cannot vote", 57 "vote ties when the first seat cannot vote", 93 "tie with an ineligible first seat").
   Correct rule: the first player breaks every tie, including when they are exiled or otherwise not voting; our "next eligible seat clockwise" and "the vote fails" rulings are wrong. Cite: digest General "If the 1st player doesn't participate in a group decision, who would break a tie? Still the 1st player (P.4)"; R p4, R p11.
   Engine file: `src/engine/actions/vote.ts` (`tiebreaker`, `voteForecastFor`, the tie branch near line 76); `VoteForecast.tiebreakBy` stays a SeatId.
   Test: four seats, first seat exiled, 2-2 vote; a tie decision goes to the first seat and its answer decides the vote.

4. **Attract placement is the attracting player's free choice** (lines 34 "attract destination at the colony", 55 "attract placement").
   Correct rule: attracted zombies go into any empty entrance spaces, in any entrance, and may be split across entrances; there is no entrance 1-then-2 order. Also one source location per attract, and not from one colony entrance to another. Cite: digest Attracting (four Q&As, "However you want", "you can split them", "1 location per attract action only", "No, only from another Location to the survivor's Location"); FAQ 5.1.1 for empty-only.
   Engine file: `src/engine/actions/attract.ts` (the action carries `from` only; add an optional `to` list as the ruling line anticipated) and the legal-action enumeration at the bottom of that file.
   Test: attract 2 zombies from the school into entrances 3 and 5 of a colony whose entrance 1 is empty; both land where chosen. Second test: a source in the same location as the survivor is rejected.

5. **Attract count is the player's choice, 0 to 2** (line 28 "attract with fewer than 2 zombies").
   Correct rule: you may choose to attract fewer than 2 zombies, even 0, so "moves as many as exist" is wrong. Cite: digest Errata "When performing an attract, you can choose to attract fewer than 2 zombies, even 0".
   Engine file: `src/engine/actions/attract.ts` (`total > 2` check is fine; make sure total 0 and 1 are legal even with 2+ available, and that the bots/legalActions offer them).
   Test: school holds 3 zombies; attract with `from: []` (or count 1) is accepted and moves exactly that many.

6. **Zombie count is taken per location when it is processed** (line 45 "zombie count per colony-phase section"; inferred, medium confidence).
   Correct rule: FAQ 6.2.1 lets an exiled player put a replacement survivor "at a Location that has not had Zombies added yet", which only matters if that survivor then counts. The engine already reads `survivorsThere` when each location starts, so the code likely matches; the ruling text and any test that assumes a section-start count are wrong.
   Engine file: `src/engine/colony-phase.ts` (`addZombiesStep`, stage `locations`).
   Test: exiled seat loses its last survivor during step C; the replacement is placed at a not-yet-processed location and that location adds one more zombie.

7. **Sample roll comes before the exposure roll** (line 63 "sample-roll order after a zombie kill"). The old line is inverted; lines 101 and 172 (GOLD-001b, We Need More Samples trigger) already say sample first. Cite: digest Main Objectives "roll for sample first".
   Engine file: `src/engine/objectives.ts` / `src/engine/exposure.ts` (verify event order only).
   Test: golden GOLD-001b asserts `DiceRolled{objective}` before `ExposureRolled`.

8. **One request addresses all other players** (line 96 "request addressed to one seat"; low impact, a request costs no die).
   Correct rule: R p11 and TLN p11 "request 1 or more item cards from other players. Other players may give..." Digest Requesting also allows asking a player with no survivor at your location.
   Engine file: `src/engine/actions/request.ts` (`to`; allow `'all'`), `src/engine/view.ts`.
   Test: one `request` with `to: 'all'`; two seats answer in turn.

9. **Crisis cards are removed after the crisis resolves** (line 201 "crisis card removal timing"; log order only). Cite: R p12 Resolve Crisis, "After resolving the crisis, remove all cards".
   Engine file: `src/engine/crisis.ts` (the `CardDiscarded ... to: 'removed', reason: 'crisis'` loop near line 72).
   Test: GOLD-004 lists the removals after the fail or bonus effect and the morale change.

10. **The player chooses a replacement group leader** (line 211 "choices inside code hooks"; known engine limitation). Cite: R p14 Killing Survivors. Hooks auto-pick the highest influence; accept as a documented deviation or give hooks a suspend point.
    Engine file: `src/engine/code-hooks.ts`, `src/engine/survivors.ts`. Test: a hook kill of a leader raises `newLeader` to the owner.

### Official rulings with no matching ruling line (verify the engine; derived from the digest and FAQ)

- A requested card cannot be placed on the main objective; a requested equip card may be equipped, used, then contributed from equipped (digest Requesting; Adding a Card to the Crisis). Check `src/engine/actions/request.ts` and `objective.ts`. Test: `contributeObjective` of a just-requested card is rejected.
- The target of an exile vote may vote (digest Exile). Check `voteEligible` in `src/engine/actions/vote.ts`.
- Each player's count of cards added to the crisis is public (digest General). Check the crisis view in `src/engine/view.ts`.
- Edward White: one die to attack plus one die for his ability; the ability is not an attack; any Medicine-symbol card works (F 1.3.1, 1.3.2; digest Specific). Check the Edward White data in `src/data/survivors/` and `attack.ts`.
- Helpless survivors do not follow an exiled player (digest Exile); bites do not spread to helpless survivors (digest Exposure); the cap on exiled helpless tokens is in R p14.
- Zombies restart at entrance 1 each time a batch is added, and a barricade-destroyed zombie does not shift the next one (digest Adding Zombies). Check `src/engine/zombies.ts`.
- Starvation: add one token and lose morale equal to the tokens in play only when food is short; tokens are never removed (F 6.1.1). Check `colony-phase.ts` `payFood`.
- Old Divisions trigger errata ("a survivor the player controls is at the colony and there is at least 1 helpless survivor at the colony") (digest Errata). Check `src/data/crossroads/old-divisions.json`.
- Used once-per-round state stays with the card across deaths and hand-offs (digest Item Cards General); already Confirmed on line 54.
- Hunted, Outsider and event cards: see the 2014 versus 2020 list below.

## 2014 versus 2020 rulebook differences

Word-level diff of the two text extracts (layout noise ignored). There are no changes to exile, attract, bites, starvation, zombie
placement, request, voting, search or survivor death. The game follows the 2014 rules; the items below are clarifications, so the 2020 wording is followed.

1. Play a Card (p10): new sentence, "When an event item card is played it is not placed in the waste pile, instead remove it from the game." Also in TLN p10. Clarification, adopted (supports the Outsider line 74; event cards never add to the waste count for morale).
2. New "Roll a Die" section (p8): when an effect says roll a die, take an action die not in use and roll that, then return it. No mechanical effect on results.
3. Resolve Crisis (p12): "number of players" becomes "number of non-exiled players" in the prevent test and the +2 bonus test. The crisis card already said non-exiled; the engine already uses non-exiled.
4. Hunted crossroads: trigger "If at any point during the player's turn that player receives a non-frostbite wound..." becomes "If the player receives a non-frostbite wound..."; option 2 "a regular die" becomes "a die". Wording only.
5. We Need More Samples (p1, p5, p15 hardcore side): "place it on this main objective card" becomes "add a zombie token to this objective", "If it is a 4 or higher" becomes "If the die result is a 4 or higher". Wording only.
6. Attacking a survivor example (p9): "rolls an action die" becomes "rolls the spent action die", matching the rule text on p8.
7. Not rules: zombie token count 30 to 20, credits (Grey to Gray), publisher address, index rebuilt.

The Long Night rulebook restates the base rules unchanged (Request, Attract, Bite, Exile, Clean Waste, Lighter "once per round"), adds its own random-location rule (the number printed on a location card, the colony has none) and a shuffle-after-searching rule; neither changes the base game.

## STILL OPEN (our ruling stands)

Rules gaps with no official answer:
- Turn-start order (31; R p15 lets the first player order simultaneous effects), beginning-of-turn ability order (94).
- Clean waste with fewer than 3 cards (33); search returns order and an empty deck (52); steal from an empty hand (51).
- Empty survivor deck on a last-survivor death (37); eliminated seats at game end (43); Crossroads drawer when the right-hand seat is eliminated (59); voting against an already exiled seat (58); both Crossroads options impossible (38).
- How an exiled objective adjusts a secret objective (47, 73).
- Sparky skipped by a spreading bite (61, 68); Daniel Smith with one zombie (65); exposure die face counts and AI odds (25, 82); location order and numbers (30, 84, 103, 161).
- Shelter "at least 3 locations" (183, 197); Germ-a-phobe/The Chosen with no survivors (196); Winter Has Come fuel duty (219); given equip cards (220).

Fan-sourced card data (no official text): Thomas Heart (18, 140), James Meyers (20), Forest Plum attack (21; the printed card art is not in the text extract and pdftoppm is missing, so check the R p9 sample visually), David Garcia (22), Gas Station Food (23), No Waste (115, 214), Find a Cure, Leave It All Behind, Home Sweet Home and Stockpile numbers (119 to 124, 162 to 167), Farmaceutico (136, 180), Annaleigh Chan (139), Walkie Talkie and Scissors (147, 148), location layout, counts and numbers (151, 158, 161), Exhaustion/Overpopulation and Hailstorm (212, 213).

Engine and design conventions (not rulebook questions): golden fixture capacities (64), onRoll (70), item copies (72), placeholders and threshold (75, 76), AI persona and affordability (79, 80), board dimensions (85), gameOver addressee (87), countsAs dice (90), leak and redaction rules (102, 192), legalActions (193), objective hooks (194), condition node (184), search odds and bot weights (203, 204).
