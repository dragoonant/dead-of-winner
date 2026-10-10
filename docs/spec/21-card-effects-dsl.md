# 21. Card-effects DSL (DRAFT)

> **DRAFT.** This vocabulary freezes only after the M2 dry run encodes every first-slice card
> (20.14) and every encoding validates and passes its golden test (21.12). Until then ops may be
> added, renamed or removed; each change edits this file and `schemas/effect.schema.json` together.

The declarative language for survivor abilities, item cards, crisis failures, Crossroads triggers
and options, and objective hooks and conditions. Machine form: `docs/spec/schemas/effect.schema.json`
(`$defs`: `Ability`, `Effect`, `Condition`, `Num`, selectors, `Modifier`, `Duration`, `Scope`,
`Cost`). Data layout: spec 20. Rules the ops call: spec 10.

**Source keys** as in spec 10/20. Mechanics in examples come from the brief (G.1, G.3, G.5, G.6
citing R/F pages); values marked placeholder in 21.11 are not sourced yet.

---

## 21.1 Model

- 21.1.1 Five node kinds: **Ability** (when and at what cost something happens), **Effect** (what
  happens: a tree of ops), **Condition** (boolean), **Num** (integer expression), **Selector**
  (picks survivors, cards, dice, locations or seats). Plus **Modifier** (a standing rule change) with
  **Duration** and **Scope**.
- 21.1.2 Every op / condition / num / modifier object has **exactly one key** (the op name); its
  value is the payload. Primitives: Num may be a bare integer, Condition a bare boolean.
- 21.1.3 Every op maps to one engine routine in `src/engine/effects.ts`. Kills, zombie placement and
  exposure go only through the generic routines (10.0.5): `killSurvivor`, `addZombies`,
  `rollExposure`. No op reimplements them.
- 21.1.4 Escape hatch: `{"code": "<hook>"}` is legal as an Effect, Condition, Num or Modifier
  (21.10). Use it only when the vocabulary cannot say the mechanic; each use is logged for the freeze
  review.
- 21.1.5 Effects resolve depth-first, fully, in order; nothing interrupts a resolving effect
  (10.0.3). Simultaneous triggers are ordered by the first player (`orderEffects`, 10.0.2).
- 21.1.6 All randomness goes through the seeded RNG with a `purpose` tag (`rollD6.purpose`, shuffles,
  exposure) so replays reproduce and the log shows why a die was rolled.

## 21.2 Evaluation context

Every evaluation runs with a context `ctx`. Names usable in selectors (`SeatRef`, `LocRef`,
`SurvivorSel`):

| Name | Kind | Meaning |
|---|---|---|
| `self` | survivor | survivor with the ability; for equip items the survivor it is equipped to. Undefined for crises, Crossroads, objectives (validator rejects it there). |
| `controller` | seat | seat controlling the source: survivor's seat, the seat that played the card, the objective's owner. Crossroads: the active seat. |
| `active` | seat | active seat; in the colony phase, the first player. |
| `holder` | seat | Crossroads only: the seat that drew and held the card. |
| `firstPlayer`, `leftOfActive`, `rightOfActive` | seat | as named (10 "Seat directions"). |
| `each`, `eachOther`, `nonExiled`, `exiled`, `any` | seat set | every seat / every seat but `controller` / filters. |
| `here` | location | location of `self`; where `self` is undefined, location of `actor`. |
| `actor` | survivor | survivor who performed the last resolved action (Crossroads, `afterAction`). |
| `eventSurvivor`, `eventLocation`, `eventSeat` | from the trigger event | 21.5. |
| `{ref: name}` | any | value bound earlier by `choose`, `forEach`, `reveal` or `rollD6` (`as`). |

- 21.2.1 SeatRefs inside a `lasting` scope are resolved to concrete seat ids when the lasting effect
  is created (Hunted's `active` stays the seat that chose it).
- 21.2.2 `ref` bindings are lexically scoped to the enclosing effect tree; DATA-005 checks it.

## 21.3 Ability

`{id, timing, mech, cost?, limit?, where?, on?, when?, requires?, optional?, effect?, modifier?,
scope?, aiHint?}`

- 21.3.1 `timing`:
  - `action`: a turn action of the active seat for this survivor (or equipped card). Appears in
    `legalActions` as `{kind:'ability', source, abilityId}`. Requires `effect`.
  - `play`: the effect of playing an item card from hand (10.6.1). Requires `effect`.
  - `passive`: a standing `modifier` active while the source is in play (survivor alive; item
    equipped; objective in play). Requires `modifier`, forbids `effect`.
  - `trigger`: runs `effect` when event `on` fires and `when` holds. Requires `on` and `effect`.
- 21.3.2 `cost`: `{die: {min: N}}` (spend one unused die ≥ N; 10.5.7), `{die: "any"}`,
  `{discard: CardsSel}` (e.g. a medicine-symbol card), `{food: n}`, `{removeSelf: true}`,
  `{all: [Cost, …]}`. Costs are paid before the effect; an unpayable cost makes the ability illegal.
- 21.3.3 `limit`: `oncePerTurn`, `oncePerRound`, `oncePerGame`; tracked per
  `<recordId>#<abilityId>@<instance>`. An equipped item's used limit survives a hand-off (10.6.6).
  On a `passive`, the limit counts uses of the modifier (the first qualifying use in the period).
- 21.3.4 `where`: location(s) where `self` must be for the ability to work (the card's location
  prefix). Absent = anywhere.
- 21.3.5 Legality of `action`/`play`: cost payable ∧ limit unused ∧ `where` holds ∧ `requires`
  holds ∧ the effect is **feasible**. Each op defines feasibility (21.7 "Feasible" column) and an
  effect is feasible iff its first op is. `requires` is only for conditions beyond feasibility.
- 21.3.6 `optional: true` on a trigger asks the controller first (decision `itemTarget` with a
  `skip` candidate; Ruling DSL-CONFIRM). Mandatory triggers just resolve.
- 21.3.7 `scope` on a passive says who the modifier applies to (21.8.3); default `{self: true}`.
- 21.3.8 `aiHint` is a short machine tag for the bot evaluator (spec 40), never shown.

## 21.4 Selectors

| Selector | Shape | Notes |
|---|---|---|
| Survivors | `{survivors: {seat?, at?, helpless?, named?, notSelf?, wounded?, isLeader?, exiledSeat?}, pick?, n?, upTo?, chooser?}` | default `seat: controller`, `helpless: false` |
| Cards | `{cards: {from, seat?, symbol?, outsider?, equip?, named?, of?}, pick?, n?, upTo?, chooser?}` | `from`: hand, equipped, handOrEquipped, waste, revealed (`of` a `reveal` binding), drawn |
| Dice | `{dice: {seat?, unused?, below?}, pick?, n?, chooser?}` | |
| Locations | `{locations: {nonColony?, deckNotEmpty?, hasZombies?, hasFreeSurvivorSpace?, hasFreeEntranceSpace?, in?, not?}, pick?, n?, chooser?}` | |
| Seats | `{seats: SeatRef, pick?, n?, chooser?}` | |
| LocRef | `"here"`, `"eventLocation"`, `"actorLocation"`, a LocationId, `{ref}`, `{choose: LocFilter, chooser?}` | `{choose}` asks a decision |

- 21.4.1 `pick`: `chooser` (a decision for `chooser`, default `controller`), `all`,
  `lowestInfluence`, `highestInfluence`, `random` (seeded). Default `chooser` when `n` is set,
  else `all`.
- 21.4.2 `n` defaults to 1 for `chooser`/`random`; `upTo: true` allows 0..n (the decider may stop).
- 21.4.3 Each `chooser` pick is one decision of kind `itemTarget` (C.4) whose candidates are the
  matching ids; the engine never offers an empty candidate list (if none match, the op is
  infeasible or, mid-effect, does nothing).
- 21.4.4 Hidden information: candidates drawn from hidden zones (another seat's hand) are offered as
  opaque slots (`random` only); views never leak ids (10.0.6).

## 21.5 Events usable by `trigger.on`

Names are the DSL's; each maps to one event type in `src/engine/events.ts`, which is authoritative
(Ruling DSL-EVENTS).

| `on` | Fires | Binds |
|---|---|---|
| `turnStarted` | after the start-of-turn steps (10.4.4) | `eventSeat` |
| `turnEnded` | at end of turn (10.4.6) | `eventSeat` |
| `roundStarted` | before the crisis reveal (10.4.1) | |
| `colonyPhaseStarted` | before Pay food (10.4.7) | |
| `actionResolved` | after an action fully resolves (10.10.3) | `actor`, `eventSeat`, `eventLocation` |
| `survivorMoved` | after a move and its exposure | `eventSurvivor`, `eventLocation` (destination) |
| `zombieKilled` | once per zombie killed (not removed) (11 §3.4–3.6) | `eventSurvivor` (killer, if any), `eventLocation` |
| `survivorWounded` | after a wound/frostbite token is placed | `eventSurvivor`, `face` |
| `exposureRolled` | after each exposure roll (post-replacement) | `eventSurvivor`, `face`, `reason` |
| `survivorKilled` | in `killSurvivor` step 6 (10.9.6) | `eventSurvivor`, `eventSeat`, `cause` |
| `survivorAdded` | after a survivor joins | `eventSurvivor`, `eventSeat` |
| `cardPlayed` | after a card's play effect | `eventSeat` |
| `searchResolved` | after a search keeps its card | `eventSurvivor`, `eventLocation` |
| `crisisRevealed`, `crisisResolved` | 10.4.1, 10.4.15 | |
| `voteResolved`, `seatExiled` | 10.12.4, 10.11 | `eventSeat` (target) |

## 21.6 Conditions and the resolved-action context

- 21.6.1 Combinators `all`, `any`, `not`; comparisons `eq, gte, gt, lte, lt: [Num, Num]`.
- 21.6.2 State predicates: `at: {survivor, location}`, `exists: Selector`, `controls: {seat?,
  survivor: SurvivorFilter}`, `isActiveSeat: SeatRef`, `isExiled: SeatRef`.
- 21.6.3 Resolved-action predicates (Crossroads `afterAction`, `actionResolved`, `afterAction`
  modifiers) read `ctx.lastAction = {kind, seat, actor, from?, to?, location, exposures:[{face,
  reason}], drawn?, kept?, zombiesKilled, deaths, actorDied}`:
  - `action: ActionKind | [ActionKind]`; `actor: SurvivorFilter`;
  - `exposureFace: Face | [Face]`: true if any exposure roll of the actor in this action had that
    face **after** replacement modifiers (Ruling DSL-FACE);
  - `searchFound: CardFilter`: the drawn / kept cards of a search.
  - If `actorDied`, `action` and `actor` are false (F 2.1.1: a survivor who dies mid-move does not
    trigger a movement card).
- 21.6.4 Event predicate: `eventIs: {survivor?, seat?, location?, cause?, face?, reason?}` matches
  the triggering event's bindings.
- 21.6.5 Objective predicates: `mainObjectiveComplete: bool`, `gameEndedBy: morale|rounds|main|card`,
  `original: true`, `originalPrivate: true` (exiled cards; 11 §7.2).
- 21.6.6 `{code: hook}` for anything else.

## 21.7 Effect ops

Num args accept any Num (21.9). "Generic" = the 10.0.5 routine the op must call.

| Op | Payload | Semantics | Feasible when |
|---|---|---|---|
| `seq` | `[Effect]` | in order | first op feasible |
| `if` | `{cond, then, else?}` | branch | always |
| `choice` | `{who?, decision?, options:[{id, label?, requires?, effect}]}` | decider picks one available option; `decision` default `objectiveChoice` (Crossroads use `crossroadsOption`) | ≥1 option available |
| `choose` | `{as, who?, from: Selector \| LocRef, decision?}` | binds a pick to `as` | ≥1 candidate |
| `optional` | `{who?, effect}` | "may": yes/skip decision | always |
| `forEach` | `{in: Selector, as?, effect}` | runs effect per selected item (`as` default `each`) in seat order, then influence | always |
| `repeat` | `{times, effect}` | | always |
| `rollD6` | `{as?, purpose?, atLeast?, atMost?, then?, else?}` | seeded d6; `then` if in range | always |
| `vote` | `{options:[Option]}` | `PendingDecision{seat:'all', kind:'vote'}` among non-exiled seats; majority option resolves; tie → first player (10.12.5) | always |
| `nothing` | `true` | no-op (explicit "nothing happens" option) | always |
| `code` | hook name | 21.10 | hook's `feasible` |
| `morale` | Num | add (negative = lose); clamp 0..moraleMax; `checkGameEnd` | always |
| `food` | Num | add/remove food tokens, floor 0; exiled seat playing a food card: 10.11.4 handled by engine | always |
| `starvation` | Num | add/remove starvation tokens, floor 0 | always |
| `cleanWaste` | Num | remove top N waste cards from the game | waste > 0 |
| `helpless` | `{add?, kill?}` | add helpless tokens to the colony (not for exiled seats, 10.11.4); `kill` → `killSurvivor` on tokens | add: free colony space; kill: token exists |
| `endGame` | `true` | end now, cause `card` | always |
| `addZombies` | `{at: LocRefOrMany, n}` | **generic `addZombies`** per location in 10.2.1 order | always |
| `killZombies` | `{at, n, upTo?, exposure: each\|once\|none, by?}` | remove n zombies as kills (each fires `zombieKilled`); then `rollExposure(by, at, 'kill')` per zombie (`each`) or once; modifiers on `by` apply | ≥1 zombie at `at` |
| `removeZombies` | `{at, n, upTo?}` | remove without killing (no `zombieKilled`, no samples, 11 §3.6) | ≥1 zombie |
| `moveZombies` | `{from?, to, n, upTo?}` | Attract semantics: empty spaces only, no overrun, no barricade breaking (10.5.6) | a source zombie and a free space |
| `barricade` | `{at, n}` | place up to n barricades on empty entrance spaces (colony: chooser picks entrance) | ≥1 empty space |
| `removeBarricade` | `{at, n}` | | ≥1 barricade |
| `noise` | `{at, delta}` | add/remove noise tokens, capped at 4 per location | add: free noise space |
| `wound` | `{target, n?, kind?}` | place tokens one at a time, death check after each (10.7.3) | target exists |
| `heal` | `{target, n?, kinds?}` | remove tokens (default kinds: wound, frostbite) | a target with a matching token |
| `kill` | `{target, cause?}` | **generic `killSurvivor`**; `cause` `card` (default) or `removed` (no morale loss, 10.9.6.3) | target exists |
| `rollExposure` | `{target, times?}` | **generic `rollExposure`** (reason `card`) at the target's location, `times` sequential rolls, bite chain included | target exists |
| `moveSurvivor` | `{target, to, exposure?, usesMove?}` | needs a free survivor space; `exposure` default true (reason `move`); `usesMove` consumes the survivor's move this turn | target can move and a destination exists |
| `addSurvivor` | `{seat?, named?, n?, drawChoose?}` | draw `drawChoose` (default 1) from the survivor deck, keep 1 (or the `named` survivor); joins per 10.9.2 | free space (10.9.2) |
| `draw` | `{from: LocRef \| "starting", n, seat?}` | top n cards to the seat's hand; no noise | deck non-empty |
| `reveal` | `{deck, n, as, public?}` | turn up top n; binds them; they stay on top until moved | deck non-empty |
| `peek` | `{deck, n, who?, then}` | private look; `then`: returnSameOrder, chooseOrder, chooseTopOrBottom | deck non-empty |
| `take` | `{cards, to, seat?}` | move cards to hand / waste / outOfGame / deckBottom / deckTop | always (may move 0 with `upTo`) |
| `discard` | `{cards, to?}` | from hand/equipped to waste (exiled: out of game) | cards exist |
| `giveCards` | `{cards, to: SeatRef}` | | cards exist |
| `shuffleDeck` | LocRef | reshuffle (10.10.6) | always |
| `dieBonus` | `{dice: DiceSel, n}` | raise unused dice, never above 6 | an unused die below 6 |
| `gainDice` | `{seat?, n}` | roll n extra dice now for the seat | always |
| `loseDice` | `{seat?, n, pick?}` | discard n unused dice (`chooser` or `random`) | always |
| `lasting` | `{id?, duration, scope?, modifier}` | register a lasting modifier (21.8) | always |
| `progress` | `{counter, delta}` | change an objective counter; emits `ObjectiveProgress` (11 §3.11) | always |

## 21.8 Modifiers, durations, scope

- 21.8.1 A modifier is a standing rule change, read by the engine at fixed query points:

| Modifier | Payload | Query point |
|---|---|---|
| `exposureSkip` | `{reasons: [move\|kill\|card]}` | start of `rollExposure`: no roll |
| `exposureFaceReplace` | `{from, to}` | after the face is rolled, before it applies (one replacement per roll; first-player order if several) |
| `searchExtra` | `{look?, keep?}` | search: `look` extra cards on the first draw; `keep` extra kept at `searchKeepWhich` |
| `woundsToDie` | int | death check threshold for scoped survivors (highest applicable wins) |
| `forbidAction` | `[ActionKind]` | `legalActions` for scoped survivors |
| `attackValue`, `searchValue` | `{delta}` or `{set}` | die thresholds, clamped 1..6 |
| `afterAction` | `{action, effect}` | after a scoped survivor's action of that kind, inside the same action (before Crossroads evaluation; Ruling DSL-AFTER) |
| `foodNeeded` | Num (delta) | Pay food (10.4.7) |
| `code` | hook | hook-defined query |

- 21.8.2 Duration (for `lasting`): `instant` (not stored), `{until: endOfTurn|endOfRound|
  startOfNextTurnOf, offset?, seat?}`, `restOfGame`, and implicit `whileEquipped` / `whileAlive` for
  passives. `{until: endOfRound, offset: 0}` expires after colony step 10.4.12a of the current
  round; `offset: 1` one round later. A crisis failing in round r with `offset: 1` lasts through the
  end of round r+1 (Blizzard).
- 21.8.3 Scope: `{self: true}`, `{survivors: SurvivorFilter}` (evaluated live: a survivor entering
  the location is covered), `{seat: SeatRef}` (survivors controlled by that seat, including ones
  added later), `{location: LocRefOrMany}`, `{global: true}`.
- 21.8.4 Lasting effects live in `GameState.lasting[]` as `{id, sourceKey, scope, modifier, expires}`
  and are public in every view (they are table-visible effects).
- 21.8.5 Several modifiers of the same kind stack additively for deltas; for booleans any applies;
  for `set` and `woundsToDie` the highest wins.

## 21.9 Numbers

`integer`, `{var}` (players, startingPlayers, round, roundsLeft, morale, food, waste, starvation,
colonySurvivors, foodNeeded, exiledSeats), `{count: Selector}`, `{progress: counter}`,
`{zombiesAt: LocRef}`, `{handCount: {seat?, symbol?, outsiderCountsAsItem?}}` (default true; 20.10.5),
`{add}`, `{sub}`, `{mul}`, `{ceilDiv}`, `{neg}`, `{ref}` (a `rollD6.as` result), `{code}`.
`players` = non-exiled seats (10.4.15); `startingPlayers` = seats dealt in (11 §2.3).

## 21.10 Code hooks

- 21.10.1 Registry: `src/engine/code-hooks.ts` exports `codeHooks: Record<HookName, CodeHook>`;
  names `<area>.<record-slug>.<what>` (e.g. `survivor.john-price.copy-abilities`).
- 21.10.2 `CodeHook = {kind: 'effect'|'condition'|'num'|'modifier', feasible?(ctx), run(ctx, api)}`.
  `api` exposes only the effect ops of 21.7 plus read-only state queries; a hook may not mutate state
  directly and must call `killSurvivor` / `addZombies` / `rollExposure` for those concepts.
- 21.10.3 Hooks are pure functions of `(ctx, state, rng)`, deterministic and replayable.
- 21.10.4 DATA-003 checks names both ways. The freeze review (21.12) lists every hook; a hook used by
  3+ cards becomes an op.

## 21.11 Example encodings (first slice; mechanics only)

Stats beside each name are G.1 values; `?` marks placeholders. Full records add `mech`, `text`,
`status`, `src` (spec 20). All examples validate against the schemas (checked 2026-10-10 with ajv).

**E1. Daniel Smith** (66 / 2+ / 5+; R p7): "(4+) kill 2 zombies here, one exposure roll".
```json
{"id": "double-kill", "timing": "action", "mech": "Anywhere (4+): kill up to 2 zombies here, one exposure roll",
 "cost": {"die": {"min": 4}},
 "effect": {"killZombies": {"at": "here", "n": 2, "upTo": true, "exposure": "once", "by": "self"}}}
```
Each zombie fires `zombieKilled`, so WNMS rolls twice (11 §3.5).

**E2. Gabriel Diaz** (60 / 2+ / 3+; R p7): once per round, reveal top 4 of a location deck, keep 1
Outsider, shuffle the rest back.
```json
{"id": "sweep", "timing": "action", "limit": "oncePerRound", "mech": "Reveal top 4 of a location deck, keep 1 Outsider, shuffle",
 "effect": {"seq": [
   {"choose": {"as": "L", "from": {"choose": {"nonColony": true, "deckNotEmpty": true}}}},
   {"reveal": {"deck": {"ref": "L"}, "n": 4, "as": "R", "public": true}},
   {"take": {"cards": {"cards": {"from": "revealed", "of": {"ref": "R"}, "outsider": true}, "pick": "chooser", "n": 1, "upTo": true}, "to": "hand"}},
   {"shuffleDeck": {"ref": "L"}}]}}
```

**E3. Olivia Brown** (56 / ? / ?; R p7): once per round remove any wound token from a survivor here.
```json
{"id": "patch-up", "timing": "action", "limit": "oncePerRound", "mech": "Remove 1 wound or frostbite from a survivor here",
 "effect": {"heal": {"target": {"survivors": {"seat": "any", "at": "here", "wounded": true}, "pick": "chooser", "n": 1},
                     "n": 1, "kinds": ["wound", "frostbite"]}}}
```

**E4. Ashley Ross** (52 / 2+ / ?; R p9): once per round barricade without a die.
```json
{"id": "free-barricade", "timing": "action", "limit": "oncePerRound", "mech": "Barricade here without a die",
 "effect": {"barricade": {"at": "here", "n": 1}}}
```
No `cost`, so no die; feasibility (an empty entrance space here) comes from the op.

**E5. Mike Cho** (30 / 2+ / ?; R p9): no exposure roll when attacking.
```json
{"id": "silent", "timing": "passive", "mech": "No exposure roll after killing a zombie",
 "scope": {"self": true}, "modifier": {"exposureSkip": {"reasons": ["kill"]}}}
```

**E6. Forest Plum** (14 / ? / 5+; R p3, p10): start of your turn, may remove him from the game for
+1 morale.
```json
{"id": "last-gift", "timing": "trigger", "on": "turnStarted", "optional": true,
 "mech": "Start of your turn: remove him from the game, +1 morale",
 "when": {"isActiveSeat": "controller"},
 "effect": {"seq": [{"kill": {"target": "self", "cause": "removed"}}, {"morale": 1}]}}
```
`cause: removed` skips the death morale loss (10.9.6.3); leader replacement and last-survivor rules
still run.

**E7. Sparky** (10 / 2+ / 2+; F 1.1.1): a bitten result is a wound instead.
```json
{"id": "tough-hide", "timing": "passive", "mech": "Bitten exposure result counts as a wound",
 "scope": {"self": true}, "modifier": {"exposureFaceReplace": {"from": "bitten", "to": "wound"}}}
```

**E8. Alexis Grey** (68 / ? / ?; R p7) and **Carla Thompson** (22 / 4+ / 2+; fan sources): extra
search card at a named location. Carla has no once-per-round limit in G.1.
```json
{"id": "stacks", "timing": "passive", "where": "library", "limit": "oncePerRound",
 "mech": "Library search: look at and keep 1 extra card",
 "scope": {"self": true}, "modifier": {"searchExtra": {"look": 1, "keep": 1}}}
{"id": "radio-room", "timing": "passive", "where": "police",
 "mech": "Police station search: look at and keep 1 extra card",
 "scope": {"self": true}, "modifier": {"searchExtra": {"look": 1, "keep": 1}}}
```

**E9. Brian Lee** (? / ? / ?; R p7): once per round +1 to one unused die.
```json
{"id": "nudge", "timing": "action", "limit": "oncePerRound", "mech": "+1 to one unused die",
 "effect": {"dieBonus": {"dice": {"dice": {"seat": "controller", "unused": true, "below": 6}, "pick": "chooser", "n": 1}, "n": 1}}}
```

**E10. Sophie Robinson** (? / ? / 1+?; R p7): once per round look at the top card of a location deck
and put it back.
```json
{"id": "aerial-scout", "timing": "action", "limit": "oncePerRound", "mech": "Look at the top card of a location deck, put it back",
 "effect": {"peek": {"deck": {"choose": {"nonColony": true, "deckNotEmpty": true}}, "n": 1, "then": "returnSameOrder"}}}
```

**E11. Thomas Heart** (64 / 1+ / 3+; fan sources, verify): colony, once per round, kill 2 zombies
there without exposure.
```json
{"id": "clear-gate", "timing": "action", "where": "colony", "limit": "oncePerRound",
 "mech": "Colony: kill up to 2 zombies there, no exposure",
 "effect": {"killZombies": {"at": "colony", "n": 2, "upTo": true, "exposure": "none", "by": "self"}}}
```

**E12. Crisis: Blizzard** (R p4, p12): fail → non-exiled survivors cannot move until the end of next
round; −1 morale. Prevent symbol is a placeholder (Ruling D-BLIZZARD-SYMBOL in spec 20).
```json
{"id": "crisis.blizzard", "name": "Blizzard", "prevent": "fuel",
 "fail": {"seq": [
   {"lasting": {"id": "snowed-in", "duration": {"until": "endOfRound", "offset": 1},
                "scope": {"survivors": {"seat": "any", "exiledSeat": false}}, "modifier": {"forbidAction": ["move"]}}},
   {"morale": -1}]}}
```

**E13. Crisis: Fuel Shortage** (R p4, p12): fail → −2 morale; default over-prevent bonus.
```json
{"id": "crisis.fuel-shortage", "name": "Fuel Shortage", "prevent": "fuel", "fail": {"morale": -2}}
```

**E14. Crossroads: Hunted** (R p4): trigger: a move whose exposure roll gave a (non-frostbite) wound.
A: every survivor you control rolls exposure twice. B: rest of game, each of your moves also rolls a
d6 and wounds the mover on 2 or less.
```json
{"id": "xr.hunted", "name": "Hunted", "mature": false,
 "trigger": {"at": "afterAction", "when": {"all": [{"action": "move"}, {"exposureFace": "wound"}]}},
 "options": [
  {"id": "a", "mech": "Roll exposure twice for each of your survivors",
   "effect": {"forEach": {"in": {"survivors": {"seat": "active"}, "pick": "all"}, "as": "s",
              "effect": {"rollExposure": {"target": {"ref": "s"}, "times": 2}}}}},
  {"id": "b", "mech": "Rest of game: after each of your moves roll a d6, wound on 1-2",
   "effect": {"lasting": {"id": "hunted", "duration": "restOfGame", "scope": {"seat": "active"},
              "modifier": {"afterAction": {"action": "move",
                "effect": {"rollD6": {"purpose": "hunted", "atMost": 2, "then": {"wound": {"target": "actor", "n": 1}}}}}}}}}]}
```

**E15. Main objective: We Need More Samples** (R p6, p15; 11 §3). Hardcore side: `rounds: 5`,
`eachNonColony: 3`, same hooks.
```json
{"id": "main.we-need-more-samples", "kind": "main", "side": "normal", "pairId": "main.we-need-more-samples", "time": "short",
 "setup": {"morale": 6, "rounds": 6, "zombies": {"eachNonColony": 1}},
 "progress": {"samples": {"initial": 0, "label": "Samples"}},
 "hooks": [{"id": "sample-roll", "timing": "trigger", "on": "zombieKilled", "mech": "Each zombie killed: d6, on 4+ it becomes a sample",
            "effect": {"rollD6": {"purpose": "sample", "atLeast": 4, "then": {"progress": {"counter": "samples", "delta": 1}}}}}],
 "complete": {"gte": [{"progress": "samples"}, {"mul": [3, {"var": "startingPlayers"}]}]},
 "target": {"mul": [3, {"var": "startingPlayers"}]}}
```
Exposure from the kill resolves before the sample trigger (11 §3.7): `killZombies` finishes its
exposure step, then queued `zombieKilled` triggers run.

**E16. Secret objective** (R p3 example): main complete and you hold 3+ food cards.
```json
{"id": "secret.full-pantry", "kind": "secret", "isBetrayal": false, "requiresMain": true,
 "condition": {"gte": [{"handCount": {"seat": "controller", "symbol": "food"}}, 3]}}
```

**E17. Item shapes** (placeholders until the deck lists are sourced; names are ours).
```json
{"id": "eat", "timing": "play", "mech": "+2 food tokens", "effect": {"food": 2}}
{"id": "drive", "timing": "play", "mech": "Move a survivor; no exposure roll",
 "effect": {"seq": [{"choose": {"as": "s", "from": {"survivors": {"seat": "controller"}, "pick": "chooser", "n": 1}}},
   {"moveSurvivor": {"target": {"ref": "s"}, "to": {"choose": {"hasFreeSurvivorSpace": true}}, "exposure": false, "usesMove": true}}]}}
{"id": "shot", "timing": "action", "limit": "oncePerRound", "mech": "Equipped: kill 1 zombie here without a die",
 "effect": {"killZombies": {"at": "here", "n": 1, "exposure": "each", "by": "self"}}}
{"id": "join", "timing": "play", "mech": "Add 1 survivor from the survivor deck to your group",
 "effect": {"addSurvivor": {"seat": "controller", "n": 1}}}
```

**E18. Escape hatch and area scope** (not first slice; F 1.1, F 1.1.5).
```json
{"id": "mimic", "timing": "passive", "mech": "Has the abilities of other survivors at his location",
 "scope": {"self": true}, "modifier": {"code": "survivor.john-price.copy-abilities"}}
{"id": "steady", "timing": "passive", "mech": "Survivors at his location die at 4 wounds",
 "scope": {"survivors": {"seat": "any", "at": "here"}}, "modifier": {"woundsToDie": 4}}
```

## 21.12 Freeze procedure (M2)

1. Encode every first-slice record (20.14) in `src/data/`; `npm run validate:data` passes.
2. One golden test per ability / crisis / Crossroads / objective hook (`DSL-*` IDs below plus the
   card's id), driving the engine with a fixed seed.
3. Review list: every `code` hook, every op used by 0 cards (delete or keep with a reason), every
   placeholder field.
4. Change this file's header from DRAFT to FROZEN with the date and commit; from then on op changes
   follow the frozen-contract rule (edit spec + schema + note in `issues`).

## 21.13 Test IDs (for `12-rules-test-checklist.md`)

DSL-001 one-key rule rejects two-key ops (schema). DSL-002 `{ref}` unbound → DATA-005 error.
DSL-003 infeasible first op removes the ability from `legalActions`. DSL-004 `oncePerRound` resets
at round start and survives hand-off. DSL-005 `killZombies` fires one `zombieKilled` per zombie;
`removeZombies` fires none. DSL-006 `exposure: once` rolls once for 2 kills. DSL-007
`exposureSkip` prevents the roll; `exposureFaceReplace` turns bitten into wound with no bite chain.
DSL-008 `lasting` `{until: endOfRound, offset: 1}` expires at the right step. DSL-009 Crossroads
`afterAction` is false when the actor died (F 2.1.1). DSL-010 `optional` trigger offers skip.
DSL-011 `choose` with hidden candidates never leaks ids in other views. DSL-012 every `code` hook
registered and used (DATA-003).

---

## Rulings

RULING: DSL-EVENTS trigger event names | The DSL uses its own event names (21.5) mapped 1:1 to events.ts types | Unsourced; events.ts is being frozen concurrently and is authoritative; rename here at the M2 dry run if they differ
RULING: DSL-CONFIRM optional effects | A "may" is an `itemTarget` decision with a `skip` candidate rather than a new decision kind | Unsourced; keeps the C.4 decision-kind list unchanged
RULING: DSL-FACE exposure face for triggers | Crossroads `exposureFace` reads the face after replacement modifiers (Sparky's bite reads as a wound) | Unsourced; the card's effect is what happened at the table
RULING: DSL-AFTER afterAction modifiers | Resolve inside the action, before Crossroads evaluation and `checkGameEnd` | Unsourced; mirrors 10.10.3 "action fully resolved"
RULING: DSL-SEARCHEXTRA once-per-round search bonus | Applies automatically to the first qualifying search of the round (it is never harmful) | Unsourced; avoids a needless decision
RULING: DSL-HUNTED-SCOPE Hunted options | A applies to all survivors the active seat controls; B to that seat's future moves | Unsourced (brief G.6 wording "each of your survivors", "every move"); verify against the card
RULING: DSL-DIEFREE Abilities without (N+) | An ability with no die cost is a free action limited only by its `limit` | Confirmed (R p7, p9 examples: Gabriel Diaz, Ashley Ross)
