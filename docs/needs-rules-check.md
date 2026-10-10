# Rules to check

Each line follows `RULING: <rule> | <what we did> | <why>`. The owner reconciles these in one sitting.
Status words in the "why" column: **Confirmed** (the rulebook or FAQ agrees), **Corrected** (a source
disagreed and the spec now follows it), **Unsourced** (the sources are silent; our ruling stands),
**Fan-source** (the value comes from a fan database or photo, not the rulebook).

## M0
RULING: Requested cards and the crisis (R p11 vs FAQ 3.1.2) | Cards given on a request are played immediately and cannot be contributed to the crisis; the FAQ's Outsider case is treated as the exception for that card only | Unsourced (recommended in the brief, E.6)
RULING: Alexis Grey influence | used 46 / 5+ / 4+ (brief G.1 said 68, which is Brian Lee's value) | Corrected (rulebook p7 sample card and wiki agree)
RULING: Daniel Smith ability limit | followed the printed rulebook card: 4+ die, no 'once per round' (wiki and brief add it); the p10 rule lets die-cost abilities repeat unless the card limits them | Corrected (R over W); revisit if the owner's physical card differs
RULING: Loretta Clay activation | 4+ die once per round (wiki prints '(4)') | Corrected (FAQ 1.2.1)
RULING: Thomas Heart ability | left unknown; wiki page duplicates Talia Jones's text and the brief's guess is unsourced; stats 64/1+/3+ kept; keep him out of the first slice | Unsourced
RULING: John Price ability location | kept the wiki's NON-COLONY label; FAQ 1.1.x never mentions the colony | Fan-source
RULING: James Meyers reroll | wiki 'one or more unused dice' over TV Tropes 'one die' | Fan-source
RULING: Forest Plum attack 2+ | single wiki source; no rulebook example shows his attack | Fan-source
RULING: David Garcia ability | look at 1 extra card, look only, no round limit; wiki is the only source | Fan-source
RULING: Gas Station 'Food or Trade 1' x3 | treated as Food 1 (Trade is a Long Night word that leaked into the wiki's Dead of Winter column) | Fan-source
RULING: FAQ 5.1.1 'Microphone' item card | no wiki deck lists it and every deck sums to exactly 20, so it is unplaced; do not add a 21st card, find it in the BGG item sheet | Unsourced
RULING: exposure die face counts | EXPOSURE_FACES = 6 blank, 3 wound, 2 frostbite, 1 bite; exposureFaceOf(raw) isolates a later correction to one table | Fan-source (R p11 names the four faces but not their counts)
RULING: crisis contribution timing | contributeCrisis is accepted as a turn action at any time AND the engine raises crisisContribution once when the seat takes endTurn ([] = nothing) | Confirmed (R p11: any time during your turn)
RULING: contributor of a revealed crisis card | hidden in every view (crisis.result.revealed[].seat = null) until the recap, because the pile is shuffled face down before the reveal | Confirmed (R p12)
RULING: attract with fewer than 2 zombies on the board | moves as many as exist (0..2) into empty entrance spaces only | Unsourced
RULING: survivors offered at setup | kept out of state.survivors and hidden from other seats (SeatState.offered) until chosen; returned ones rejoin the reshuffled deck | Confirmed (R p7)
RULING: location order for the zombie step | locationOrder follows the location numbers 1..6 from data (rulebook list and wiki differ) | Unsourced (F 6.2.1 says 'in location order' without listing it)
RULING: turn-start order | Crossroads draw, then frostbite ticks in the seat's survivor order, then turn.start effects; 'beginning of your turn' abilities are actions legal only before the first other action | Unsourced
RULING: crisis printed optional vs the rulebook +2 bonus | one +1 morale bonus, never stacked; a card's bonus descriptor may change the extra-card count or effect | Unsourced (R p4 and R p12 describe the same bonus)
RULING: clean waste with fewer than 3 waste cards | removes what is there; illegal with an empty pile | Unsourced
RULING: attract destination at the colony | lowest-numbered entrance with an empty space first; AttractAction has no destination field, an additive to?: EntranceIndex[] may follow | Unsourced
RULING: face-changing abilities (Sparky, Harman) in a bite chain | only a raw blank saves the survivor | Confirmed (R p11 'any other result' kills)
RULING: survivors added during a bite chain | not candidates for that chain; each kill resolves fully before the chain continues | Unsourced
RULING: empty survivor deck when a last survivor dies | seat eliminated as in the player-elimination variant | Unsourced
RULING: Crossroads card with both options impossible | removed with no effect | Unsourced (R p12 covers one impossible option)
RULING: who picks the survivor bumped back to the colony (F 5.4.1) | the exiled seat | Unsourced
RULING: exiled seat playing a food card | chooses per card: printed effect or +1 to an unused die (max 6), emitted as DieBoosted {source:'item'} not DieAdded | Confirmed (R p14 + F 5.4.4)
RULING: exiled survivors moving back to the colony | allowed after the initial placement; they then count for food and zombies | Unsourced
RULING: vote tie-break when the first seat cannot vote | next eligible seat clockwise from the first seat | Unsourced
RULING: eliminated seats at game end | they lose | Unsourced (R p15 'out of the game')
RULING: two seats without variants.twoPlayer | rejected with E_BAD_SETUP | Confirmed (R p15 two-player follows co-op)
RULING: zombie count per colony-phase section | fixed when the section starts; survivors added mid-section count only in later sections | Unsourced (consistent with F 6.2.1)
RULING: adding a card to the main objective | playCard {cardId, data:{objective:true}} moves the instance to objective.cards and emits ObjectiveProgress, no CardPlayed and no item effect; a dedicated contributeObjective action / CardAddedToObjective event may be added additively in M1 | Confirmed mechanics (F 4.1.1), Unsourced shape
RULING: how an exiled objective 'adjusts' a secret objective | the exiled node is the whole win condition; it may reference the original via secretObjectiveComplete / secretObjectiveWithoutMain code conditions | Unsourced (R p14 says only 'adjusts'; the 10 cards are unread)
RULING: what counts as a zombie kill for We Need More Samples | every ZombieKilled by attack, ability or card, one d6 each; attract moves and overrun removals are not kills | Confirmed (R p6, R p13)
RULING: main objective completion mid-turn | detected only at colony step 5 unless the card says 'immediately' | Confirmed (R p12, R p15)
RULING: exiled seat's food card (R p14 vs brief E.11) | raises one unused die by 1 via DieBoosted {source:'item'}; DieAdded {source:'exiledFood'} in the frozen events stays unused | Corrected (R p14 says 'increase an action die result by 1')
RULING: attack-a-survivor steal with an empty target hand | the wound still lands; no CardStolen; order is wound, death check, steal | Unsourced
RULING: search returns and empty decks | returned cards go under the deck in draw order; a deck emptied mid-search ends the search with the cards drawn so far; empty at start → E_DECK_EMPTY | Unsourced
RULING: exiled survivors and the colony | an exiled seat's survivors may never move into the colony; moving to the current location is E_TARGET_INVALID | Unsourced
RULING: once-per-round uses of equipped items | keyed by the card instance so a hand-off carries the used state (R p11 note) | Confirmed (R p11) on effect, Unsourced on the key
RULING: attract placement | fills the survivor's location's empty entrance spaces in entrance order and moves as many as fit (0..2); never breaks barricades or overruns | Confirmed (F 5.1.1) on empty-only, Unsourced on order and partial moves
RULING: round tick never re-checks the main objective | objective checked only at colony step 5; roundsOut at step 6 ends without a check even if complete | Confirmed (R p13–14)
RULING: vote ties when the first seat cannot vote (exiled) | the vote fails | Unsourced
RULING: voting against an already-exiled seat | E_TARGET_INVALID | Unsourced
RULING: Crossroads drawer when the right-hand seat is exiled or eliminated | that seat still draws (exile forbids only contributing and voting) | Unsourced for eliminated, Confirmed (R p14) for exiled
RULING: John Price and Buddy Davis' 4-wound grant | John at 3 wounds dies the moment either finishes a move apart | Confirmed (F 1.1.5)
RULING: Sparky skipped by a spreading bite | the bite passes to the next-lowest influence at the location | Fan-source (F 1.1.1 gives only the bite-as-wound half)
RULING: Lighter's item symbol | weapon, read from the R p12 crisis example picture (3 fuel + Lighter = 'one weapon symbol') | Confirmed (R p12 picture), verify on the card sheet
RULING: sample-roll order after a zombie kill (We Need More Samples) | the kill's exposure roll resolves first, then the objective d6 | Unsourced (golden GOLD-001b assumes it)
RULING: golden fixture capacities | colony entrances 3 spaces each, locations 4 survivor spaces, 3 entrance spaces; only the 4 noise spaces are R p5 | Unsourced (brief E.2 verify); fixtures carry their own capacity so tests do not depend on it
RULING: Daniel Smith with one zombie present | usable with >=1 zombie, kills up to 2, rolls exposure once | Unsourced
RULING: a move made by playing Fuel | counts as that survivor's move this turn and evaluates action.move Crossroads triggers (countsAs: move) | Unsourced
RULING: abilities that say no exposure | an ability or equipped item that kills zombies rolls exposure only when its effect lists an exposure op | Confirmed (R p10 Lighter, R p7 Daniel Smith)
RULING: Sparky and the bite chain | a spreading bite skips him via code hook survivor.sparky.skipBiteSpread; FAQ fixes only bite->wound | Fan-source (W)
RULING: John Price copies only away from the colony | location: nonColony on the copyAbilitiesAtLocation grant | Fan-source (W; F 1.1.1 silent)
RULING: onRoll semantics | a d6 gate on the host op (op and then apply only inside the range); on exposure a severity branch blank0/wound1/frostbite2/bite3 | Unsourced (engine convention)
RULING: Lighter is an attack | countsAs: attack charges the attack die and reaches action.attack; the fuel card is a cost with no effect | Confirmed (R p10)
RULING: item copies | one item record per card face, deck records carry copy counts, CardInstances created from deck lists at setup | Unsourced (engine convention)
RULING: exiled objective and the original | the exiled node is the whole win condition; requiresOriginal is sugar for also needing the original; finer references use spec 11's code conditions | Unsourced (R p14 says only adjusts)
RULING: Outsider cards | symbol survivor records are class event and leave the game when played | Fan-source (O; F 3.1.2 silent on the pile)
RULING: placeholder records | status placeholder validates but never loads so the schema can be exercised before the card pass | Unsourced (process)
RULING: verified threshold | official text, a photo, or two independent fan sources with no (verify) | Unsourced (process)
RULING: suspicion prior per seat | 1/(2n+1) with n seats (one betrayal card among 2n+1 dealt n), 1/(n+1) in the betrayer variant, 0 in co-op | Confirmed (R p6 setup, R p15 variants)
RULING: betrayer voting | a betrayer bot votes yes on loyal seats when that serves its lever, since two exiled non-betrayers drop morale to 0 | Confirmed (R p14)
RULING: vote affordability | a loyal bot votes yes only if suspicion >= persona threshold AND the colony can afford the lost dice (morale >= 3 and <= 1/3 of table dice, or roundsLeft <= 1, or main objective >= 80%) | Unsourced (design; rulebook sets no criterion)
RULING: persona priors in suspicion | no persona-based prior (Drifter/Hard Case habits are not evidence); only observed behaviour updates suspicion | Unsourced (design)
RULING: requests never target crisis cards directly | bots ask for an effect (food, medicine, ability cost) because a given card is played immediately and cannot enter the crisis | Confirmed (R p11; existing M0 RULING in docs/needs-rules-check.md)
RULING: exposure odds used by the AI | 6/3/2/1 faces via EXPOSURE_FACE_COUNT; death on a roll = bite + [wounds >= 2]*(wound+frostbite) | Fan-source (rng.ts RULING; R p11 names faces only)
RULING: arrangement of the six location tiles around the colony board | three along the far edge, one at each side, the hospital near the human edge (30 §2); R p6 says 'as shown' but its diagram is an image (pdftoppm missing, text extract empty) and fan sources give no layout | Unsourced
RULING: location numbers 1–6 for random-location rolls | police 1, grocery 2, school 3, gas 4, library 5, hospital 6, used as tile numbers and display order; engine locationOrder stays the rules order | Fan-source (fandom Locations page)
RULING: board, tile and card dimensions | 22x12 in board, 6x4 in tiles, 2.5x3.5 in cards, 30 mm bases; our own sizes, not measured from the product | Unsourced
RULING: unrevealed removals (Old Divisions contributions, a last survivor's discarded hand) | new GameState.removedHidden zone, count-only in views, ids revealed only in recap.removedHidden; CardDiscarded {to:'removed', revealed:false} routes there | Confirmed (F 2.3.1, R p14)
RULING: gameOver decision addressee | pending.seat = 'all'; any seat may send ack | Unsourced (engine contract, no rule)
RULING: concession | ConcedeAction legal for the human on any decision addressed to it or 'all'; GameEnded {reason:'concession', winners: []} | Confirmed (R17.4 nobody wins)
RULING: exposure after a card or ability kills a zombie | killZombies rolls exposure on the killer once per zombie by default (reason zombieKill, so noExposureOnKill grants apply); Lighter, Edward White, Bev Russell, Maria Lopez carry value 'noExposure', Daniel Smith 'exposureOnce'; schema common.json restricts killZombies.value to those two words and 21 §10 / 20 V-10 validate it | Corrected (R p13: a zombie killed by an attack or a card effect costs its killer an exposure roll; R p10 Lighter and R p7 Daniel Smith print their exceptions)
RULING: countsAs and dice | cost.die when set is the one die charged; without it 'attack'/'search' charge the stat die and 'barricade'/'cleanWaste'/'attract'/'move' charge none, so Ashley Ross is countsAs barricade with no cost and limit oncePerRound rather than a freeBarricade grant (grants carry no use limit); freeBarricade stays in GrantWhat for item use | Unsourced (engine convention; W for Ashley's wording)
RULING: secret objective spelling | data/schema type and ObjectiveDescriptor.kind both use 'secret'; the frozen SecretObjectiveDealt.kind keeps 'standard' and 21 §9 maps type secret -> 'standard' explicitly; EffectInstance.sourceKind in src/engine/types.ts already lists 'secretObjective' (not touched by this task) | Confirmed (hooks.ts, types.ts, events.ts as frozen)
RULING: full colony vs survivor-adding Crossroads | the card does not trigger when any option would add a survivor or helpless token; it stays held and goes to the bottom at turn end (CrossroadsReturned); R12.6 forced-option path never used for a full colony (R11.3, R12.6, R20.20) | Corrected (R p14 line 'cannot trigger crossroads cards that would add survivors' is card-level)
RULING: tie with an ineligible first seat | the next eligible seat clockwise from the first seat breaks it; a vote with no eligible seat is never raised and fails at once, so VoteForecast.tiebreakBy stays non-null SeatId and VoteResult.tiebreakBy is null only when there was no tie (R4.15, R16.4, R20.14) | Unsourced (R p4 first player breaks all ties; R p14 exiled cannot vote)
RULING: 'beginning of your turn' survivor abilities | triggered+optional descriptors in the turn.start window raising effectChoice {code:'survivor.forest-plum.lastGift'}, auto-skipped on decline; useAbility rejected E_FORBIDDEN (R4.4(c), R20.3) | Unsourced order; model Confirmed (F 1.1.4 John Price copy)
RULING: equipped crisis contributions | CardContributed {from:'equipped'} is public with its id, only hand contributions hidden, query.crisis scores equipped ones for every viewer (R7.3, R13.2, R20.21) | Confirmed (R p11: only cards from the hand are face down). Note for contract owner: types.ts Contribution {seat, cardId} has no `from`; spec recommends the additive field before freeze
RULING: request addressed to one seat | request.to names one SeatId; a table-wide ask costs one action per seat; additive to: SeatId | 'all' deferred to M1 (R7.5, R20.19) | Unsourced (R p11 'request 1 or more item cards from other players')
RULING: exiled survivors re-entering the colony | MOVE-010 inverted: allowed after the initial placement, then counts for food and zombies (matches 10 R15.5/R20.13) | Unsourced (R p14 mandates only the initial move out)
RULING: exiled food cards | DICE-016/DICE-017/EXIL-007 go through effectChoice code 'exiledFoodCard' (printed effect or DieBoosted {source:'item'} +1 on an unused die, max 6); DieAdded {source:'exiledFood'} is never emitted | Corrected (R p14 'rather than' vs F 5.4.4)
RULING: exiled survivor placement decision | CARD-015, EXIL-010, ZOM-010 all use effectChoice code 'exiledSurvivorPlacement', never itemTarget. The finding proposed 'rule.exile.survivorPlacement', but 10 R10.5 (not mine) already names 'exiledSurvivorPlacement', so the checklist follows 10 for one code everywhere | Confirmed (F 6.2.1 for the placement; code name is ours)
RULING: GameEnded.objectiveComplete | defined as objective.complete (the colony-step-5 flag, or set by a card's endGame op per 11 O2.5): OBJ-003 asserts false at moraleZero, RULE-003 asserts true for the immediate-end card | Confirmed (R p12/p14, 11 O3.3)
RULING: objective roll order after a kill | GOLD-001b places DiceRolled {purpose:'objective'} + ObjectiveProgress between ZombieKilled and ExposureRolled, ASSUMED alternative dropped | Confirmed (10 R6.1, 21 section 1)
RULING: leak invariant and ballot leaks | VIEW-018 blanks DecisionAutoResolved.optionId for searchKeepWhich to other seats; VIEW-019 nulls a rejected castVotes for EVERY seat (the submitter already has the rejection from step), which is stricter than the finding's 'non-voters'; VIEW-020 excludes EquippedReturned.cardIds (to:'hand') and CardStolen.cardId for from/to from the needles | Unsourced (00 section 4)
RULING: location numbers 1-6 for random-location rolls (R2.5) and zombie-step order (R20.2) | police 1, grocery 2, school 3, library 4, hospital 5, gas station 6, marked (verify) in 30-art until a card photo settles it; matches locationOrder (13 §0), sources/items-sources.md and the R p7 setup picture | Fan-source (fandom Locations page; R p7 picture agrees, R p2 components list differs)
RULING: gate numeral direction on the colony board model | gates 1-6 laid out counter-clockwise seen from above; only the 3D model changes, R9 placement order unaffected | Confirmed (R p13 example says 'Continuing counter-clockwise')
RULING: dice per player = 1 + 1 per controlled survivor (brief Part E setup step 2; two-player variant keeps 3 survivors per player, step 6) | §4.1 now says 3 dice at the standard start and 4 in the two-player variant; the earlier draft wrongly gave 3 dice for the two-player start | Confirmed
