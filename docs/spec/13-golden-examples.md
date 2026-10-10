# 13 Golden examples

Step-by-step scenarios that become Vitest cases (`tests/golden/GOLD-xx.test.ts`, test names
`it('GOLD-01 ...')`). Each lists a source, an initial state, actions, the expected state after each
step and the expected events. GOLD-01..06 are the six worked examples named in brief E.14; GOLD-07..11
cover objectives and end of game (`11-objectives.md`).

**Fidelity.** The rulebook PDF was not available when this was written. GOLD-01..06 rebuild each
rulebook example from the rule it illustrates (brief Part E plus [W2]) with our own fixture numbers.
Once the PDF is read, reconcile the numbers with R p9, p10, p12, p13 and F 6.1.1 and set `fidelity`
to `matched`. The rules behaviour asserted here does not depend on those numbers.

Sources: brief E.4–E.8, E.11, E.12, E.14; [W2] https://www.orderofgamers.com/downloads/DeadofWinter_v1.2.pdf
(fan rules summary); [W1] https://rulespal.com/dead-of-winter/rulebook.

## 0. Fixture conventions

0.1 `fixture(...)` builds a full `GameState` directly (no setup dealing). Anything not listed is
empty: no zombies, no noise, no barricades, no wounds, empty hands, morale 8, round 5, food 0,
starvation 0, waste 0, first player = seat A, active seat A in the player turns phase.
0.2 Seats A, B, C, D (4 players, none exiled) unless stated. Main objective `test.noop` (no hooks,
never complete) unless stated, so no sample rolls happen.
0.3 Dice are scripted through the rng contract (`00-architecture`): `d6: [..]` is the queue of d6
results, `d12: [..]` the queue of exposure faces (`blank|wound|frostbite|bitten`), `pick: [..]` the
queue of uniform-choice indices (random steal, crisis shuffle). A test fails if a queue is not used
up exactly.
0.4 Unused action dice are listed as `dice A: [5,1,3]`. Spending a die moves it to used.
0.5 Survivor stats used here (influence / attack / search), from G.1 where known, otherwise fixture
values marked `fx`:

| Id | Survivor | Inf | Atk | Srch |
|---|---|---|---|---|
| daniel | Daniel Smith | 66 | 2 | 5 |
| gabriel | Gabriel Diaz | 60 | 2 | 3 |
| olivia | Olivia Brown | 56 | 3 fx | 3 fx |
| ashley | Ashley Ross | 52 | 2 | 4 fx |
| mike | Mike Cho | 30 | 2 | 4 fx |
| carla | Carla Thompson | 22 | 4 | 2 |
| forest | Forest Plum | 14 | 3 fx | 5 |
| sparky | Sparky | 10 | 2 | 2 |

0.6 Abilities are inert in GOLD-01..06 unless a step names one (fixture flag `abilities: off`
except the named survivor).
0.7 Event names are the intended meaning; `00-architecture` owns the event union and its names win.
Private events (`to: seat`) appear only in that seat's view; the leak test checks it.
0.8 Colony fixture capacity: 3 spaces per entrance, 6 entrances; non-colony entrance 3 spaces
(fixture values; real counts are (verify) per E.2).

---

## GOLD-01 Attack a zombie (R p9; E.5, E.7)
fidelity: rebuilt. Initial:
- Police Station: daniel (A), mike (A, abilities on), 3 zombies.
- dice A: [5, 1, 4]. d12: [wound]. Morale 8.

Steps:
1. legalActions(A) for daniel's attack lists die 5 and die 4, never die 1 (1 < atk 2).
2. `attack {survivor: daniel, die: 5, target: zombie@police}` →
   zombies@police 2; dice A unused [1, 4]; exposure rolled for daniel → `wound`;
   daniel wounds 1; morale 8.
   Events: `DieSpent{A,5}`, `ZombieKilled{loc: police, by: daniel}`,
   `ExposureRolled{survivor: daniel, face: wound}`, `WoundAdded{daniel, kind: wound, total: 1}`.
3. `attack {survivor: mike, die: 4, target: zombie@police}` →
   zombies@police 1; dice A unused [1]; **no exposure roll** (Mike Cho ability); d12 queue already
   empty, so any roll fails the test.
   Events: `DieSpent{A,4}`, `ZombieKilled{loc: police, by: mike}`.
4. Same survivor may attack again with another qualifying die: give A die 6 →
   `attack {daniel, 6, zombie}` is legal (repeat attacks allowed).

## GOLD-02 Attack a survivor (R p9; E.5)
fidelity: rebuilt. Initial:
- School: mike (A), ashley (B), gabriel (A). (Helpless tokens exist only at the colony; the
  "cannot attack helpless" check is asserted at the colony in step 1b.)
- B hand: [b1, b2, b3]. A hand: []. dice A: [4, 6, 2]. d6: [2, 5]. pick: [1].

Steps:
1. legalActions(A): mike may target ashley; never gabriel (own survivor).
1b. Separate fixture: daniel (A) at the colony with 2 helpless tokens and no other survivors →
   no attack-survivor action targets a helpless token.
2. `attack {survivor: mike, die: 4, target: survivor ashley}` → the spent die is rolled: d6 = 2.
   2 ≤ ashley's attack value 2 → ashley wounds 1; A steals B's card at index 1 (`b2`);
   A hand [b2]; B hand [b1, b3]; no exposure roll.
   Events: `DieSpent{A,4}`, `DieRolled{purpose: 'attack-survivor', value: 2}`,
   `WoundAdded{ashley, kind: wound, total: 1}`, `CardStolen{from: B, to: A}` (public, no card id),
   `CardStolen{card: b2}` private to A and B.
3. `attack {mike, die: 6, target: ashley}` → d6 = 5; 5 > 2 → no wound, no steal.
   Events: `DieSpent{A,6}`, `DieRolled{value: 5}`, `AttackMissed{target: ashley}`.
4. Die 2 still allows a third attack (2 ≥ mike atk 2); legal.

## GOLD-03 Search with noise (R p10; E.5)
fidelity: rebuilt. Initial:
- Grocery Store: gabriel (A). Noise@grocery 1 of 4 spaces used.
- Grocery deck top → [f1 Food, w1 Weapon, m1 Medicine, t1 Tool, x1 ...]. dice A: [4, 2].

Steps:
1. legalActions(A): search with die 4 (≥ srch 3); not with die 2. No search at the colony.
2. `search {gabriel, die: 4}` → f1 drawn, pending decision for A: `keep | makeNoise`.
   Events: `DieSpent{A,4}`, `CardDrawn{loc: grocery}` public (count only), `CardDrawn{f1}` private A.
3. `makeNoise` → noise@grocery 2; w1 drawn. Events: `NoiseAdded{grocery, total: 2}`, `CardDrawn`.
4. `makeNoise` → noise 3; m1 drawn.
5. `makeNoise` → noise 4; t1 drawn. Now `makeNoise` is not in legalActions (no empty noise space);
   the decision is `keep(card ∈ {f1, w1, m1, t1})`.
6. `keep m1` → A hand [m1]; deck bottom gets f1, w1, t1 in draw order; deck top is x1.
   Events: `CardKept{seat: A}` public, `CardKept{m1}` private A,
   `CardsToBottom{loc: grocery, count: 3}`.
7. A second search by any survivor at Grocery this round may draw only 1 card (no noise space).

## GOLD-04 Resolve a crisis with a wrong-symbol card (R p12; E.4 colony step 3)
fidelity: rebuilt. Crisis fixture `test.crisis.fuel`: prevent [Fuel]; fail: morale −2; no
optional bonus. Initial: morale 8; players 4, none exiled → threshold 4 (bonus at ≥ 6).

Case a (fails): contributions [fuel ×4, weapon ×1], pick order arbitrary.
- Step 3 reveals 5 cards one at a time: +1 ×4, −1 ×1 → total 3 < 4 → crisis fails; morale 6.
- Events: `CrisisCardRevealed ×5` (each public with symbol and ±1), `CrisisResolved{total: 3,
  needed: 4, outcome: 'failed'}`, `MoraleChanged{-2, to: 6}`, `CardsRemovedFromGame{count: 5}`.
- Waste pile unchanged (contributed cards leave the game).
Case b (prevented): [fuel ×5, weapon ×1] → total 4 ≥ 4 → prevented; morale 8; no bonus.
Case c (bonus): [fuel ×6] → total 6 ≥ 4 + 2 → prevented and morale 9.
Case d (food card value): a Food card that adds 3 food counts as one card (−1 here) and adds no food.
Case e (exiled seat): seat D exiled, [fuel ×4, weapon ×1] → total 3 ≥ threshold 3 → prevented
(threshold = non-exiled players per E.4; see Rulings).
Order independence: any `pick` permutation gives the same totals.

## GOLD-05 Add seven zombies, overrun at entrance 3 (R p13; E.4 step 4, E.8)
fidelity: rebuilt. Initial (colony phase, step 4 about to run; non-colony locations empty, no
noise):
- Colony occupants (13): daniel, gabriel (A); olivia, ashley (B); mike, carla (C); forest, sparky
  (D); 5 helpless tokens. Morale 6.
- Entrances (3 spaces each): E1 1 zombie; E2 2 zombies + 1 barricade; E3 3 zombies; E4 0; E5 0;
  E6 0.

Steps:
1. Colony adds ceil(13 / 2) = 7 zombies, one at a time, starting at entrance 1:
   - z1 → E1 (E1: 2 zombies).
   - z2 → E2 has no empty space but a barricade: destroy the barricade, drop z2
     (E2: 2 zombies, 1 empty space).
   - z3 → E3 has no empty space and no barricade: overrun; drop z3; kill the lowest-influence
     colony survivor = sparky (10); morale 5.
   - z4 → E4, z5 → E5, z6 → E6 (1 each).
   - z7 → E1 (E1: 3 zombies, full).
2. Morale check after colony adds: 5 > 0, continue.
Expected state: E1 3, E2 2 (no barricade), E3 3, E4 1, E5 1, E6 1; occupants 12 (sparky gone,
D controls forest only; helpless 5); morale 5.
Events: `ZombieAdded{colony, entrance: 1}`, `BarricadeDestroyed{colony, entrance: 2}`,
`EntranceOverrun{colony, entrance: 3}`, `SurvivorKilled{sparky, cause: 'overrun'}`,
`MoraleChanged{-1, to: 5}`, `ZombieAdded{entrance: 4}`, `{5}`, `{6}`, `ZombieAdded{entrance: 1}`.
Variants:
- 5a. If only helpless tokens were at the colony, the overrun removes 1 helpless token, morale −1.
- 5b. If no survivors are at the colony, z3 is dropped with no further effect.
- 5c. Sparky's equipped cards (if any) go back to D's hand (died at the colony).
- 5d. A zombie removed by a barricade or an overrun is not a kill (no exposure, no sample roll).

## GOLD-06 Three rounds of starvation (F 6.1.1; E.4 step 1)
fidelity: rebuilt. Initial: colony occupants 4 (any), so food needed = ceil(4 / 2) = 2. Morale 8.
Run only colony step 1 in each round (other steps are no-ops in the fixture).

| Round | Food before | Pay? | Food after | Starvation | Morale loss | Morale |
|---|---|---|---|---|---|---|
| 1 | 1 | no | 1 (none removed) | 1 | −1 | 7 |
| 2 | 0 | no | 0 | 2 | −2 | 5 |
| 3 | 3 (fixture adds 3 before step 1) | yes | 1 | 2 (stay) | 0 | 5 |

Events: R1 `FoodShort{needed: 2, have: 1}`, `StarvationAdded{total: 1}`, `MoraleChanged{-1}`;
R2 `StarvationAdded{total: 2}`, `MoraleChanged{-2}`; R3 `FoodPaid{2}`, no morale event.
Edge: with morale 2 at round 2 the −2 drops morale to 0 and the game ends at once
(`GameEnded{cause: 'morale'}`); steps 2–7 do not run.

## GOLD-07 We Need More Samples setup (R p6, p15; 11-objectives §3)
Setup with 4 seats, objective `main.we-need-more-samples`:
- normal: morale 6, round 6, 1 zombie at each of the 6 non-colony locations, colony 0;
  `samples 0 / target 12`.
- hardcore: morale 6, round 5, 3 zombies at each non-colony location; target 12.
- 3 seats: target 9. Events: `ObjectiveSetup{morale, rounds}`, `ZombieAdded ×6` (normal).

## GOLD-08 Sample rolls and completion timing (11-objectives §3, §6)
Initial: objective WNMS (normal), 4 seats, samples 11, morale 4, round 3. Police: daniel (A),
2 zombies. dice A: [6, 3]. d12: [blank, blank]. d6: [4, 3].
1. `attack {daniel, 6, zombie}` → exposure blank; sample d6 4 → samples 12; zombie on the card,
   not in the pool. Events: `ZombieKilled`, `ExposureRolled{blank}`, `DieRolled{purpose:
   'sample', 4}`, `ObjectiveProgress{samples: 12, target: 12}`. The game does NOT end yet.
2. `attack {daniel, 3, zombie}` → exposure blank; sample d6 3 → back to the pool; samples 12.
3. End all turns; colony phase steps 1–4 do not drop morale to 0; step 5 finds 12 ≥ 12 →
   `GameEnded{cause: 'main'}`; step 6 does not run (round stays 3).
3b. Variant: a step-4 overrun drops morale 1 → 0 first: `GameEnded{cause: 'morale'}`, main not
   checked, standard secret objectives all lose.

## GOLD-09 Winners at game end (R p14; 11-objectives §4–6)
End state for cause `main`: A secret "main + ≥3 Food cards in hand", A hand 3 Food → wins.
B secret "main + controls ≥3 survivors", B controls 2 → loses. C betrayal "morale 0 + ..." →
loses. D secret "main + ≥2 Medicine", D hand [Medicine, Outsider(Medicine)] → wins (Outsider
counts). Event `GameEnded.results` = A won, B lost, C lost, D won; all four objectives revealed.
Same hands with cause `rounds`: everyone with a main clause loses; C loses (morale > 0).

## GOLD-10 Round track runs out (R p14; E.4 step 6)
Initial: round 1, morale 5, main incomplete. Colony phase step 5 → not complete; step 6 → round 0
→ `GameEnded{cause: 'rounds'}`; step 7 does not run (first-player token not passed). A seat whose
betrayal condition does not need morale 0 and holds is the only winner.

## GOLD-11 Exile and the two-exile rule (E.11; [W2]; 11-objectives §7)
Initial: 4 seats, none betrayal holders, morale 7. B controls olivia at the colony.
1. A calls a vote on B; votes A yes, B no, C yes, D no → tie 2–2, first player A breaks it: exiled.
   Events: `VoteCalled{target: B}`, `VotesRevealed`, `SeatExiled{B}`, `ExiledObjectiveDrawn{B}`
   (card private to B). Then B must move olivia to a non-colony location (exposure rolled; not B's
   one move this turn).
2. B can no longer vote, add to a crisis or spend food tokens; legalActions(B) lacks them.
3. Later C is exiled → 2 exiled seats, neither betrayal → morale set to 0 → `GameEnded{cause:
   'morale'}`.
3b. Variant: B held a betrayal objective → step 3 does not end the game; B's condition is unchanged.

## Rulings

RULING: Golden example numbers | GOLD-01..06 use our own fixture numbers that exercise the same rule as the rulebook example | Rulebook PDF unavailable in this container; reconcile when read; Unsourced
RULING: Search discards order | Unkept search cards go to the deck bottom in draw order | Rules say "bottom" only ([W2]); order needed for determinism; Unsourced
RULING: Attack-a-survivor hit test | Re-roll the spent die; hit on result ≤ the target's attack value | [W2] "equal to or less than the chosen survivor's attack value"; Fan-source (matches brief E.5)
RULING: Crisis threshold with exiled seats | Threshold = non-exiled players | Brief E.4 says non-exiled; [W2] says "number of players"; owner of 10-rules-core decides; Unsourced
RULING: Zombie add cycle restarts at entrance 1 | Each add-zombies batch starts at entrance 1 | [W2] "place the first zombie ... entrance 1"; Fan-source
RULING: Exile vote tie | First player breaks the tie (counts as their side) | [W2] "all ties are broken by the first player"; Fan-source
