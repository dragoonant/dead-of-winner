# 11 Objectives

Main, secret, betrayal and exiled objectives: structure, data shape, when each is checked, and how
the game ends and is scored. Rules core (round order, exile procedure, crisis) lives in
`10-rules-core.md`; card data shapes in `20-data-schema.md`; hook/DSL in `21-card-effects-dsl.md`.
Where those specs name a type or event, theirs wins; names here are the intended meaning.

Sources: brief Part E.11, E.12, E.13, Part G.3, G.4, G.7 (citing rulebook R pN, FAQ F x.y).
Web cross-checks (read once, not committed):
- [W1] https://rulespal.com/dead-of-winter/rulebook (public rules transcription)
- [W2] https://www.orderofgamers.com/downloads/DeadofWinter_v1.2.pdf (fan rules summary v1.2)

All card text in our data is our own words written from the one-line mechanics below.

## 1. Objective kinds

| Kind | Count (R p2) | Who sees it | Checked |
|---|---|---|---|
| Main | 10 cards, 2 sides (normal, hardcore) | everyone | colony phase step 5 (OBJ-3) |
| Secret (standard) | 24 | owner only | game end only (OBJ-6) |
| Betrayal (secret) | 10 | owner only | game end only |
| Exiled (secret) | 10 | owner only | game end only; modifies the owner's secret objective |

1.1 Objectives are data (`content/objectives/*.json`), one record per card side, ids `main.<slug>`,
`main.<slug>.hardcore`, `secret.<slug>`, `betrayal.<slug>`, `exiled.<slug>`.
1.2 Every objective condition is a declarative predicate in the `21` DSL, evaluated by the engine
against full state. A `{"code": "<hook>"}` escape hatch is allowed for conditions the DSL cannot say.
1.3 The engine owns every derived number the UI shows: samples collected / needed, items
contributed / needed, rounds left, morale. The view exposes these for the main objective only.

## 2. Main objective

2.1 Record shape (normal or hardcore side):
- `setup`: `{morale, rounds, zombies: {colony?: n, eachNonColony?: n, perLocation?: {loc: n}}}`
  plus optional extra setup steps (hook).
- `progress`: engine-maintained counters owned by the objective (e.g. `samples`).
- `hooks`: event listeners that update `progress` (e.g. `onZombieKilled`).
- `complete`: predicate over state + `progress`. Thresholds may scale with `startingPlayers`.
- `time`: `short | medium | long` (short 45–90 min, medium 90–120, long 120–210) (G.3).
2.2 Setup applies in R p6 order: set morale, set the round track, add zombies (one at a time per
the add-zombie rules, `10-rules-core`). Setup zombie adds never kill (no survivors are placed yet at
locations; colony placement precedes survivor placement) (Unsourced, see Rulings).
2.3 `startingPlayers` = seats dealt in at setup. It never changes after setup (eliminated or exiled
seats still count) (G.3 "per player who started").
2.4 The main objective is complete only when checked at colony phase step 5; satisfying it mid-round
has no effect until then (R p14; [W1]).
2.5 First-release main objective: *We Need More Samples* (G.7). The other nine land in M8 batches;
their titles (R p16–17): X Weeks of Darkness, Kill Them, Find a Cure, Home Sweet Home, Raiding Party,
Leave it all Behind, Stockpile, Winter Has Come, Too Many Mouths. Values are (verify) per G.3.

## 3. We Need More Samples (`main.we-need-more-samples`) (R p6, p15; G.3)

3.1 Normal side setup: morale 6, round track 6, add 1 zombie to each non-colony location (6 total).
3.2 Hardcore side setup: morale 6, round track 5, add 3 zombies to each non-colony location (18).
3.3 Time rating: short. R p15 suggests it for a first game.
3.4 Sample roll: each time a zombie is **killed** (any location, any cause that the rules call a
kill: an attack, a survivor ability, an item or Crossroads effect that kills zombies), roll 1 d6 for
that zombie. On 4, 5 or 6 the zombie becomes a sample: it goes onto the objective card
(`progress.samples += 1`) instead of back to the zombie pool. On 1–3 it returns to the pool.
3.5 One roll per zombie. An effect that kills 2 zombies (e.g. Daniel Smith) rolls twice.
3.6 Not kills, so no sample roll: a zombie removed by breaking a barricade, a zombie removed on an
overrun, zombies moved by Attract, zombies removed by a card that says "remove" (R p13; E.8).
3.7 Ordering: the attacker's exposure roll (E.7) resolves first, then the sample roll. They are
independent, so the order never changes the outcome; fixed order avoids a needless decision.
3.8 Samples are permanent: no effect removes them from the card in the first release.
3.9 Samples count toward nothing else (they are not zombies on the board; they never add to a
location, never overrun).
3.10 Complete when `progress.samples >= 3 * startingPlayers` at colony phase step 5 (12 at four
seats). Same threshold on both sides.
3.11 Event: `ObjectiveProgress {objective, counter: 'samples', value, target}` after each successful
sample roll; the d6 itself is a public `DieRolled {purpose: 'sample'}`.
3.12 UI numbers (engine-owned): `samples`, `target`, and `pSample = 1/2` per kill.

## 4. Secret objectives (standard) (R p3, p6, p14; G.4)

4.1 Structure: `condition = mainObjectiveComplete AND private`, where `private` is a predicate over
the owner's final state (example R p3: holds at least 3 food cards in hand). Some cards may omit
the main-objective clause; the data says which (the clause is explicit, never implied).
4.2 Typical private predicates (DSL building blocks; full list in `21`):
`handCount(symbol, n)`, `handCountAny(n)`, `controlsSurvivors(n)`, `controlsSurvivorWith(trait)`,
`leaderAlive`, `noWounds(n)`, `equippedCount(n)`, `moraleAtLeast(n)`.
4.3 Outsider cards count as item cards for secret-objective hand counts ([W2], "Cards").
4.4 Deal (E.3 step 2): `2 * players` standard cards + 1 betrayal card shuffled; 1 dealt per seat;
the rest boxed unseen. Betrayer variant: `1 * players` standard + 1 betrayal.
4.5 Hidden: a secret objective appears only in `view(state, owner)`. No action reveals it; a player
may not show it to others ([W1]). It is revealed to all only in the `GameEnded` event.
4.6 Bots and humans may *claim* anything in talk; claims are not engine facts.

## 5. Betrayal objectives (R p18–19; G.4)

5.1 A betrayal objective is a secret objective whose condition is typically met only when the colony
fails: `gameEndedBy = 'morale'` (morale reached 0) AND a private predicate, or a private predicate
alone that the colony's success would not normally produce. Each card's exact predicate is data.
5.2 Titles (R p18–19): Gluttony, Runaway, Take Over, All for One, Accept Your Fate, Trigger Happy,
Cult Leader, Serial Killers, Mad Scientist, Obsessed. Mechanics (verify) in M8 data batches.
5.3 First release: 3 betrayal objectives (G.7), chosen at data entry for distinct play patterns
(one morale-sabotage, one hoarding, one violence).
5.4 `isBetrayal: true` is a card field. The engine reads it for the two-exile rule (7.6) and never
exposes it to other seats' views.

## 6. When objectives are checked; game end

6.1 The game ends immediately, at the first of (R p14; E.12; [W1], [W2]):
- (a) morale reaches 0 at any moment (cause `morale`); the main objective is NOT checked;
- (b) the round tracker is moved onto 0 in colony phase step 6 (cause `rounds`); main NOT checked;
- (c) the main objective is found complete in colony phase step 5 (cause `main`);
- (d) two exiled seats exist and neither holds a betrayal objective: morale is set to 0, so (a).
6.2 Morale reaching 0 mid-resolution (a kill, an overrun, starvation, a crisis) ends the game at
that point; the rest of the step does not resolve. In step 4 the morale checks after the colony,
after non-colony locations and after noise (F 6.2.1) are where play stops.
6.3 Step 5 runs only if steps 1–4 did not end the game. Step 6 runs only if step 5 did not.
6.4 Scoring is binary per seat: a seat wins iff its current secret objective condition (after any
exiled modification, 7.3) is true in the end state. Zero, one or many seats may win (R p14; [W2]).
6.5 `mainObjectiveComplete` in secret predicates is true only when cause = `main`. Under cause
`morale` or `rounds` it is false, even if the main condition happens to hold (6.1a–b).
6.6 Hand-based predicates read the hand at the moment of game end (cards played earlier do not
count).
6.7 Event: `GameEnded {cause, round, morale, results: [{seat, objectiveId, exiledObjectiveId?,
won}]}`. This event reveals every seat's objective(s) to all views.
6.8 Co-op variant (E.13): no secret objectives, no exile; every seat wins iff cause = `main`.
Two-player variant follows co-op.

## 7. Exile and exiled objectives (R p14; F 5.4; E.11; [W2])

7.1 On a successful exile vote the exiled seat immediately draws 1 exiled secret objective card
(hidden; owner view only). This happens before the exiled seat moves its colony survivors out.
7.2 Exiled objective record: `{id, condition, appliesToBetrayal: false}` where `condition` may
reference `original` (the seat's prior secret predicate) or `originalPrivate` (its private clause
without the main-objective clause). Typical shape: drop the main-objective requirement and add a
new private clause. Exact cards (verify) in M8.
7.3 After exile the seat's winning condition is the exiled card's `condition`. A betrayal holder's
condition does not change (`appliesToBetrayal: false` on all first-release cards) (Rulings).
7.4 First release (M3) ships the 10 real exiled cards only if they are sourced by then. Otherwise
it ships one generic exiled card: "win iff `originalPrivate` holds", which drops the main clause
(Unsourced, see Rulings).
7.5 Exiled seats still contribute to the main objective: their zombie kills roll for samples (3.4).
7.6 Two-exile rule: after any exile resolves, if `exiledSeats.length >= 2` and none of them holds a
betrayal objective, set morale to 0 (game ends, 6.1d). Checked again on every later exile.
7.7 A seat cannot be exiled twice (it cannot vote and is not a legal exile target once exiled).
7.8 The view never states why the two-exile rule did or did not fire beyond the morale change.

## 8. Round track and morale track (E.4, E.12)

8.1 Round track starts at the main objective's `setup.rounds` and drops by 1 at colony step 6.
8.2 Morale starts at `setup.morale`; changes come only from rules events (kills, starvation, waste,
crisis, cards). Track bounds per `10-rules-core`.
8.3 The engine exposes `roundsLeft` and `morale` publicly at all times.

## 9. Checklist IDs (for `12-rules-test-checklist.md`)

OBJ-001 setup applies morale/rounds/zombies of chosen side. OBJ-002 WNMS sample on 4+ only.
OBJ-003 non-kill removals never roll. OBJ-004 completion only at step 5. OBJ-005 morale 0 skips the
main check and secret predicates see `mainObjectiveComplete=false`. OBJ-006 round 0 likewise.
OBJ-007 multiple winners / no winners. OBJ-008 exiled card replaces the condition. OBJ-009
two-exile rule. OBJ-010 objectives hidden in every other seat's view until `GameEnded`.

## Rulings

RULING: WNMS kill definition | Only kills roll for samples; barricade breaks, overruns, Attract and "remove" effects do not | R p13 separates killing from removing zombies; Unsourced for this card
RULING: WNMS exposure vs sample order | Exposure resolves before the sample roll, no first-player choice | Independent outcomes, so order is moot; Unsourced
RULING: WNMS sample threshold base | 3 x players dealt in at setup, fixed for the game | G.3 "per player who started"; Confirmed (brief citing R p6)
RULING: WNMS hardcore values | morale 6, rounds 5, +3 zombies per non-colony location | Brief G.3 citing R p6, p15; Confirmed (brief) but recheck against the card when a photo is sourced
RULING: Setup zombies cannot overrun | Objective setup zombies are placed before survivors exist, so no kill | No survivors present; Unsourced
RULING: mainObjectiveComplete under morale/rounds end | False even if the condition holds | R p14 "do not check the main objective" ([W1], [W2]); Confirmed
RULING: Exile of a betrayer | Draws an exiled card (keeps the deck count honest) but the betrayal condition is unchanged | Two-exile rule implies the engine tracks betrayal status; card wording not sourced; Unsourced
RULING: Exiled card timing | Drawn before the exiled seat moves its colony survivors out | [W2] "must immediately draw", then move; Fan-source
RULING: Generic exiled objective fallback | Until the 10 cards are sourced, one generic card drops the main clause and keeps the private clause | Exiled cards "adjust" the objective ([W2]); exact texts unsourced; Unsourced
RULING: Outsider cards in hand counts | Count as item cards for secret objectives | [W2] Cards section; Fan-source
