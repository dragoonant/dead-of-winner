# Rules to check

Each line follows `RULING: <rule> | <what we did> | <why>`. The owner reconciles these in one sitting.
Status words in the "why" column: **Confirmed** (the rulebook or FAQ agrees), **Corrected** (a source
disagreed and the spec now follows it), **Unsourced** (the sources are silent; our ruling stands),
**Fan-source** (the value comes from a fan database or photo, not the rulebook).

## M0

Every `## Rulings` line from `docs/spec/*.md`, consolidated after the M0 spec review (2026-10-10).
The per-spec Rulings sections stay in place and remain the source; this list is the owner's
one-sitting review copy. Exact duplicates are listed once.

RULING: Requested cards and the crisis (R p11 vs FAQ 3.1.2) | Cards given on a request are played immediately and cannot be contributed to the crisis; the FAQ's Outsider case is treated as the exception for that card only | Unsourced (recommended in the brief, E.6) (superseded in M0 review: see R-REQUEST from 10-rules-core below, Fan-source + FAQ)

### 00-architecture.md

RULING: A-DICE dice visibility | Every seat's dice values are public in views | Unsourced: dice are rolled openly at the table and C.4's hidden list omits them; 50.6.1 "count (others)" is overridden here, spec 50 to align
RULING: A-DIEREF die references | Actions name a Die.id; legalActions lists one action per distinct die value (lowest id) | Unsourced (project decision): identical values are interchangeable; keeps legal lists small for bots
RULING: A-CONTRIB contributing several cards | One card per `contribute` action, repeatable within the turn | Unsourced: 10.6.2 "any number" is preserved by repetition; avoids exponential subset enumeration
RULING: A-CRISISKIND crisisContribution decision | Kept in the frozen kind list but reserved for card effects that ask for an out-of-turn contribution; in-turn contribution is the `contribute` turn action | Unsourced: C.4 lists the kind; 10.15 places it inside turnAction
RULING: A-OBJCHOICE generic option choice | `objectiveChoice` doubles as the decision for any non-Crossroads `choice` op, including an exiled seat's food-card mode (R-EXILEFOOD) | Unsourced: keeps the C.4 kind list unchanged
RULING: A-BALLOT simultaneous votes | Deciders answer `vote` with a per-seat Ballot; only `castVotes` (all ballots) enters `step` | Confirmed against C.4 ("submits one castVotes action")
RULING: A-BETRAYALVIEW exiled betrayer status | Views never expose another seat's `isBetrayal`, even after exile; the engine applies the two-exile rule (10.11.5) itself | Fan-source (follows 11 §5.4 and checklist K-2; conflicts with 10.11.2 "becomes public", flagged for the spec review)
RULING: A-DSLEVENTS abstract DSL events | colonyPhaseStarted → ColonyStepStarted (step payFood); searchResolved → SearchKept; voteResolved → VotesCast | Unsourced: names only, no rules effect
RULING: A-SEARCHKEEP search keep answer | `searchKeep` carries a card list so `searchExtra.keep` can keep more than 1 | Unsourced: mirrors 21.8.1
RULING: A-D12MAP d12 numbering | 1–6 blank, 7–9 wound, 10–11 frostbite, 12 bitten | Fan-source (face counts per R-D12; the numbering is ours and only affects scripted tests)

### 10-rules-core.md

RULING: R-REQUEST requested cards and the crisis (R p11 vs F 3.1.2) | Given cards are played at once and never contributed to a crisis, except Outsider cards: as a type they may be requested and then contributed (10.6.5) | Fan-source + FAQ (F 3.1.2 per brief; [OG] Cards "can even request and play these cards into the crisis"); replaces the earlier one-card exception
RULING: R-D12 exposure faces | 6 blank, 3 wound, 2 frostbite, 1 bitten | Fan-source (brief E.7 community count; matches C.5 odds 25/17/8); verify on a physical die
RULING: R-SPACES board space counts | Data file with placeholders (colony 3 per entrance, 30 occupant spaces; police 3/3, grocery 4/4, school 4/4, gas 2/2, library 3/3, hospital 4/4) | Unsourced; [UBG] and [RP] give no counts; verify from board/card photos into docs/spec/sources/
RULING: R-LOCORDER non-colony order for Add Zombies | police, grocery, school, gas, library, hospital (brief E.1 listing order) | Unsourced; the rulebook p5 arrangement should replace it if it differs
RULING: R-INFL influence ties | Treated as impossible (unique influence values); data validation asserts uniqueness | Unsourced
RULING: R-HAND hand limit | None | Unsourced ([UBG]/[RP] state none)
RULING: R-TOKENS physical token caps | Not enforced except via board spaces | Confirmed for zombies (R p13 overflow tokens); Unsourced for others
RULING: R-MORALEMAX morale ceiling | Clamp at the board track maximum (data value) | Unsourced
RULING: R-HELPSPACE helpless occupy colony spaces | Yes; they block survivor additions when full | Unsourced
RULING: R-SETUPORDER survivor choice | Seats choose in turn order with hidden picks | Unsourced (table does it simultaneously; outcome identical)
RULING: R-TURNSTART start-of-turn order | Crossroads draw, then frostbite wounds | Unsourced
RULING: R-FIRSTPASS first-player token direction | Passes to the right (previous seat clockwise) while turns run left | Confirmed (R p13 per brief E.4.7; [RP] "passes the token to the player on his right"; [OG] step 7)
RULING: R-BITEHELPLESS bite spread and helpless tokens | Spread skips helpless tokens | Unsourced ([RP] silent); consistent with overrun killing helpless last
RULING: R-HANDOFF hand-off target | Any survivor at the same location, including another seat's | Unsourced
RULING: R-EXILEOBJ exiled objective | Every exiled seat draws 1 hidden exiled objective; it does not apply to a betrayal holder (appliesToBetrayal:false, verify from card photos); nothing is revealed and the engine applies 10.11.5 silently | Corrected (R p14; [RP] "the exiled player immediately draws 1 exiled secret objective card", R p7 no showing; [OG] v1.2 "adjusts his secret objective"); the earlier public-reveal ruling is withdrawn
RULING: R-EXILEFOOD exiled food cards | Exiled seat chooses per food card: food tokens, or +1 die each | Unsourced (brief E.11 lists both)
RULING: R-VOTETIE exile vote ties | First player's vote decides; exiled first player gets a tiebreak decision | Confirmed ([UBG]: ties broken by the first player, including exile votes)
RULING: R-EMPTYDECK search with empty location deck | Search is illegal at a location whose deck is empty | Unsourced ([RP] silent)
RULING: R-ATTACKSURV attacking survivors | Allowed at any shared location, exiled or not; target's attack value is the threshold | Confirmed ([UBG]; brief E.5)
RULING: R-LASTHAND last survivor lost | The whole hand leaves the game for every seat, exiled or not; it never enters the waste | Corrected (R p14 "removes from the game all cards in her hand"; [OG] Survivors); [RP] says "discards"
RULING: R-PREVENT2 crisis prevent section | A set of 1–2 symbols; a card scores +1 if its symbol is in the set | Corrected (R p12 "a symbol matching a symbol in the prevent section"; [OG] Cards "two item symbols ... any combination")
RULING: R-OUTSIDER played Outsider cards | Leave the game instead of entering the waste; count as item cards otherwise | Fan-source + FAQ ([OG] Cards; F 3.1.2 per brief)
RULING: R-CRISISPLAYERS crisis threshold | `players` = non-exiled seats | Confirmed (R p12 crisis example; [RP] "the number of non-exiled players"); [OG] abbreviates to "number of players"
RULING: R-SELFVOTE exile vote target | Another non-exiled seat; never the caller | Confirmed (R p11; [RP]; [OG] "You cannot initiate a vote to exile yourself")
RULING: R-CARDVOTE votes called by cards | Same seat:'all' ballot, non-exiled seats vote, first player breaks ties, card data decides the outcome | Unsourced for the procedure ([RP] and [OG] mention Crossroads-called votes only in passing); reuses the exile-vote rules
RULING: R-ATTRACTSHORT attract with fewer than 2 movable | Moves exactly min(2, available source zombies, empty spaces); never fewer by choice | Unsourced for the short case; "move 2 zombies" is Confirmed (R p10; [RP]; [OG])
RULING: R-EXILECOLONY exiled survivors and the colony | Exiled survivors cannot enter the colony (no move there; forced placement only for non-exiled survivors, 10.11.6) | Unsourced (implied by F 5.4.1 and non-colony placement in R p14; [RP] and [OG] state no explicit ban)

### 11-objectives.md

RULING: WNMS kill definition | Only kills roll for samples; barricade breaks, overruns, Attract and "remove" effects do not | R p13 separates killing from removing zombies; Unsourced for this card
RULING: WNMS exposure vs sample order | Exposure resolves before the sample roll, no first-player choice | Independent outcomes, so order is moot; Unsourced
RULING: WNMS sample threshold base | 3 x players dealt in at setup, fixed for the game | G.3 "per player who started"; Confirmed (brief citing R p6)
RULING: WNMS hardcore values | morale 6, rounds 5, +3 zombies per non-colony location | Brief G.3 citing R p6, p15; Confirmed (brief) but recheck against the card when a photo is sourced
RULING: Setup zombies cannot overrun | Objective setup zombies are placed before survivors exist, so no kill | No survivors present; Unsourced
RULING: mainObjectiveComplete under morale/rounds end | False even if the condition holds | R p14 "do not check the main objective" ([W1], [W2]); Confirmed
RULING: Exile of a betrayer | Every exiled seat draws an exiled card, hidden; it does not apply to a betrayal holder, whose condition is unchanged; no public reveal | Corrected for the draw and no reveal ([W1] "the exiled player immediately draws 1 exiled secret objective card"; [W2] "adjusts his secret objective"; mirrors 10 R-EXILEOBJ); appliesToBetrayal:false Unsourced until card photos
RULING: Exiled card timing | Drawn before the exiled seat moves its colony survivors out | [W2] "must immediately draw", then move; Fan-source
RULING: Generic exiled objective fallback | Until the 10 cards are sourced, one generic card drops the main clause and keeps the private clause | Exiled cards "adjust" the objective ([W2]); exact texts unsourced; Unsourced
RULING: Outsider cards in hand counts | Count as item cards for secret objectives | [W2] Cards section; Fan-source

### 12-rules-test-checklist.md

RULING: K-1 requested cards and the crisis | CRIS-013 and ACT-015 test that a given card is never contributable except an Outsider card; CARD-013 tests played Outsiders leave the game | Mirrors 10 R-REQUEST; Fan-source + FAQ ([OG] Cards; F 3.1.2)
RULING: K-2 exiled betrayer status in views | VIEW-012 asserts `isBetrayal` stays hidden; the engine applies the two-exile rule itself. Closed: 10.11.2 now says nothing is revealed (R-EXILEOBJ) | Corrected (R p7, R p14; rulespal.com/dead-of-winter/rulebook; orderofgamers.com DeadofWinter_v1.2.pdf)
RULING: K-3 exile objective for a betrayer | Closed: EXIL-003 asserts every exiled seat draws, and a betrayal holder's condition is unchanged (10.11.2 and 11 §7.1 now agree) | Corrected (R p14; rulespal.com/dead-of-winter/rulebook; orderofgamers.com DeadofWinter_v1.2.pdf "adjusts his secret objective")

### 13-golden-examples.md

RULING: Golden example numbers | GOLD-01..06 use our own fixture numbers that exercise the same rule as the rulebook example | Rulebook PDF unavailable in this container; reconcile when read; Unsourced
RULING: Search discards order | Unkept search cards go to the deck bottom in draw order | Rules say "bottom" only ([W2]); order needed for determinism; Unsourced
RULING: Attack-a-survivor hit test | Re-roll the spent die; hit on result ≤ the target's attack value | [W2] "equal to or less than the chosen survivor's attack value"; Fan-source (matches brief E.5)
RULING: Crisis threshold with exiled seats | Threshold = non-exiled players | Confirmed (R p12 crisis example; [W1] rulespal.com/dead-of-winter/rulebook "the number of non-exiled players"; brief E.4); [W2] abbreviates to "number of players"; mirrors 10 R-CRISISPLAYERS
RULING: Zombie add cycle restarts at entrance 1 | Each add-zombies batch starts at entrance 1 | [W2] "place the first zombie ... entrance 1"; Fan-source
RULING: Exile vote tie | First player breaks the tie (counts as their side) | [W2] "all ties are broken by the first player"; Fan-source

### 20-data-schema.md

RULING: D-PATHS content root | All content under `src/data/` (brief C.2); spec 10 `data/board.json` and spec 11/41 `content/` are aliases to be aligned | Brief C.2 layout is the source of truth; Unsourced (project decision)
RULING: D-TRACKS morale and round track maxima | Placeholder moraleMax 10, roundMax 10 in the colony record | Unsourced; verify from a board photo into locations-sources.md
RULING: D-NONE cards without a crisis symbol | Symbol `none`; they always score −1 if contributed | Unsourced (fan memory of junk-type cards); verify against location deck lists
RULING: D-TAGS survivor tags | Tags are inert labels; any rules effect (e.g. an animal that cannot equip) is DSL or a hook on that survivor | Unsourced; keeps one mechanism per concept
RULING: D-OUTSIDER-COUNT Outsider cards in hand counts | Counted as items by default (`handCount.outsiderCountsAsItem` defaults true) | Fan-source ([W2] in spec 11)
RULING: D-BLIZZARD-SYMBOL Blizzard prevent symbol | Entered as `fuel` with status partial | Unsourced; the brief gives the failure effect (R p4, p12) but not the symbol
RULING: D-ARTID art references | Asset ids are derived from record ids (`<recordId>`, `icon.<symbol>`, `location.<id>`); survivor/card records carry no `art` field, so `survivor.schema.json` and types.ts stay unchanged; spec 30.8.3 "survivor `art`" reads as "the survivor's derived asset id" | Unsourced (engineering); one id per concept, no frozen-contract change, procedural fallbacks keep placeholders playable

### 21-card-effects-dsl.md

RULING: DSL-EVENTS trigger event names | The DSL keeps its own event names; 21.5 names the exact events.ts type and filter for each (`colonyPhaseStarted` = `ColonyStepStarted` with step `payFood`, `searchResolved` = `SearchKept`, `voteResolved` = `VotesCast`), checked by DATA-007 | Unsourced (engineering); events.ts `DSL_EVENT_MAP` is authoritative, the filters live in the trigger dispatcher
RULING: DSL-CONFIRM optional effects | A "may" with no target is `itemTarget{purpose:'confirm', candidates:['yes'], min:1, max:1, canSkip:true}`, answered `chooseTargets['yes']` or `skip`; a "may" with a target is the target pick itself with `upTo`/`canSkip`. Reviewers proposed `['self']` or `['yes']` as the candidate; `'yes'` won because confirms also come from crises, Crossroads and objectives where `self` is undefined (21.2) | Unsourced (engineering); keeps the C.4 decision-kind list and the frozen contracts unchanged
RULING: DSL-FACE exposure face for triggers | Crossroads `exposureFace` reads the face after replacement modifiers (Sparky's bite reads as a wound) | Unsourced; the card's effect is what happened at the table
RULING: DSL-AFTER afterAction modifiers | Resolve inside the action, before Crossroads evaluation and `checkGameEnd` | Unsourced; mirrors 10.10.3 "action fully resolved"
RULING: DSL-SEARCHEXTRA once-per-round search bonus | Applies automatically to the first qualifying search of the round (it is never harmful) | Unsourced; avoids a needless decision
RULING: DSL-HUNTED-SCOPE Hunted options | A applies to all survivors the active seat controls; B to that seat's future moves | Unsourced (brief G.6 wording "each of your survivors", "every move"); verify against the card
RULING: DSL-DIEFREE Abilities without (N+) | An ability with no die cost is a free action limited only by its `limit` | Confirmed (R p7, p9 examples: Gabriel Diaz, Ashley Ross)
RULING: DSL-PEEK peek ordering | `chooseOrder` = n−1 `itemTarget` picks (purpose `peekOrder`) from the top down; `chooseTopOrBottom` = `objectiveChoice` top/bottom, bottom keeps current order | Unsourced (engineering); no new decision kind; card-specific wording is checked at the M2 dry run

### 30-art.md

RULING: card face layouts | our own field order and styling per 30.7.3, no reference to original card layouts | IP rule forbids trade dress; mechanics need only the fields | Confirmed (IP rule)
RULING: figure height 1.2 in on 30 mm base | used for all survivors and zombies | brief D.1/D.3 numbers | Confirmed (brief)
RULING: in-world card size 2.5 × 3.5 in | standard poker size for items, survivors, crisis, Crossroads | physical card size not in this container | Unsourced

### 40-ai.md

RULING: Bots requesting cards "for the crisis" (H.5 example prompt) | Bots request only for immediate play; the prompt names the use | Corrected: 10.6.5 and Ruling R-REQUEST say a given card is played at once and never contributed; the brief's example wording conflicts
RULING: Visible per-seat crisis contribution counts | Bots read the count each seat contributed (not the cards) | Unsourced: at the table contributions are placed openly face down; C.4 hides only the faces ("count only")
RULING: Betrayer probability priors | 1/(2n) per other seat under the standard deal; 1/n under the betrayer variant | Confirmed by arithmetic from the deal in 11.4.4 and 10.14.3
RULING: Community win rate for We Need More Samples (~50%) used as the T2 target | Band 40%–65% | Unsourced (brief H.8 "community reports"; no web source checked)
RULING: Exile reveals betrayer status | Suspicion collapses on reveal | Unsourced; depends on 10 Ruling R-EXILEOBJ

### 41-personas-and-talk.md

RULING: Persona names | Six original names (Marta Voss, Benny Alder, Rook Mahoney, Pip Okafor, Ines Halloran, Cole Wren); none matches a survivor in brief G.1; "Rook" kept from the brief's H.5 example | Unsourced: the full 30-survivor list is not yet sourced, so validate:data re-checks at data entry
RULING: Talk is outside engine state | Talk log is a client/sim side channel fed to bots; no rules effect | Confirmed by brief H.5 (accusation has no rules effect) and H.6; keeps the frozen engine contracts unchanged
RULING: Voiced subset | Slot-free lines are voiced; slotted lines are text-only unless a slot-free variant exists | Unsourced (brief D.4 says ~60 lines per persona pre-generated; H.6 says a subset is voiced)

### 50-client.md

RULING: rulebook p5 location arrangement | six slots clockwise from left-far in engine order (50.2.3), constant table in one file | p5 diagram not in container; public summaries say only "six location cards around the colony board" ([RPAL], [ZATU]); positions unsourced | Unsourced
RULING: colony board 20 × 20 in, location tile 6 × 8.5 in | used for world layout | physical dimensions not in container; only layout depends on them | Unsourced
RULING: gate 1 at near-left, numbering clockwise | used for colonyLayout.ts | gate numbering exists (E.2) but positions are not stated | Unsourced
RULING: vote timing | no timer on the human's vote; the "3, 2, 1" is presentation only, played when all votes are in | brief D.4 lists a narrator countdown but no rule imposes a time limit; a timer could force a human vote | Unsourced

### 60-testing.md

RULING: sim decision cap | `SIM_MAX_DECISIONS` default 4000 per game | brief J reports 3,700-decision games in Whirr; a DoW game has fewer decisions, so 4000 catches loops without false failures | Unsourced
RULING: AI time budget default | 150 ms per decision, scaled ×2 on CI | no source; keeps a full sim game well under the 60 s wall cap | Unsourced
