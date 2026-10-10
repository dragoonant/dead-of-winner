# 21: Card-effects DSL

The declarative vocabulary every item, crisis, Crossroads option, objective and survivor ability is written in.
The types are `src/engine/hooks.ts` (`TriggerWindow`, `ConditionNode`, `EffectNode`, `ScopeNode`,
`EffectDuration`, the descriptors); this file fixes what each member **means** and freezes the member lists after
the dry run in §12 (00 §8: new members are additive and logged in 00 §16). Record shapes are in `20`; rule
semantics in `10`; objectives in `11`. Every example below validates against `schemas/*.json`.

Rules of thumb: encode a card as plain nodes when the vocabulary covers it; use `{"code": ...}` (§11) only for a
mechanism no op expresses; never widen an op's meaning to fit one card.

## 1. Triggers

A trigger is a `TriggerWindow`: a `WindowId` from `types.ts` (00 §9) or the two data-only points.

| Point | Fires | Bound context (`HookContext`) |
|---|---|---|
| `passive` | while the source is in play (survivor alive, item equipped) | `seat` = owner, `survivorId` = holder |
| `action` | when the owner takes `useAbility` / `playCard` on its turn | `seat` = active seat, `survivorId` = holder or the chosen bearer |
| `setup.done` | once, after E.3 step 7 | `seat` = first seat |
| `round.start`, `crisis.revealed`, `dice.rolled` | E.4 player-turns steps 1 and 2 | `seat` = the seat rolling (`dice.rolled`) |
| `turn.start`, `turn.end` | each player turn | `seat` = active seat |
| `action.<type>` | after that turn action fully resolved (FAQ 2.1.1) | `seat` = active, `survivorId` = acting survivor, `location` = where it acted, `targetId`, `cardId`, `dieId`, `face` = the exposure face rolled during it |
| `exposure.rolled` | after the face is final (`ExposureFaceChanged` applied) | `survivorId`, `face`, `params.reason` |
| `wound.taken`, `survivor.killed`, `survivor.added` | per survivor | `survivorId`, `location`, `params.kind` / `params.cause` / `params.source` |
| `zombie.killed`, `zombie.added`, `entrance.overrun`, `noise.added` | per token | `location`, `params.entrance`, `survivorId` = the killer when a survivor killed it |
| `search.drawn`, `search.kept` | per card in a search | `seat`, `survivorId`, `location`, `cardId` |
| `card.played`, `card.equipped` | per card | `seat`, `cardId`, `survivorId` |
| `colony.*` | before each colony step (E.4) | `seat` = first seat |
| `crisis.resolved`, `morale.changed`, `vote.result`, `seat.exiled`, `game.end` | results | `params` carry the result record |

- Triggers bound to a survivor (abilities, equipped items) are collected only while the survivor is alive, its
  owner is not eliminated, and `location` (§9) holds. A `turn.start` ability fires on every seat's turn unless
  `when` says `isActiveSeat` (Forest Plum does).
- Crossroads cards bind to `action.*` only (00 §2 rule 6). Several triggers in one window resolve in collection
  order: rule effects, then the active seat's sources, then the other seats clockwise; a tie inside one seat is an
  `effectChoice` for the first seat (Part E preamble).

## 2. Subjects

Conditions name what they test with `subject`; scopes name whom an effect touches with `who`. Both resolve
against the bound context.

| Subject | Resolves to | Default for |
|---|---|---|
| `self` | the holder: the ability's survivor, the equipped item's bearer, or (hand item) the bearer the owner picks when playing | survivor tests when the source has a holder |
| `survivor` | `ctx.survivorId`: the survivor the window names | survivor tests at rule windows and Crossroads triggers; the candidate inside a scope `filter` |
| `target` | `ctx.targetId` | attack windows |
| `seat` | `ctx.seat`: the owner for owned sources, else the active seat | seat tests |
| `activeSeat` | `state.activeSeat` | |
| `holder` | the owner seat of the descriptor | |
| `location` | `ctx.location`, else the holder's location | location tests |
| `colony` | `'colony'` | |
| `card` | `ctx.cardId` | `symbolDrawn`, `cardKeptHasSymbol` |

## 3. Conditions

`{all}`, `{any}`, `{not}` nest. A test node is `{test, subject?, value?, location?, symbol?, face?}`. `value` types
are fixed per test; a missing optional field means "the bound one".

| Test | Subject | Fields | True when |
|---|---|---|---|
| `atLocation` | survivor | `location?` | the survivor is at `location` (default: the bound location) |
| `isColony`, `isNonColony` | location | | the location is / is not the colony |
| `locationIs` | location | `location` | equal |
| `survivorIs` | survivor | `value: SurvivorId` | that survivor (Crossroads named after one) |
| `survivorOwnedBy` | survivor | `value: 'holder' \| 'activeSeat' \| 'other'` | owner relation to the context seat |
| `survivorHasKeyword` | survivor | `value: tag` | the survivor record carries that tag |
| `woundsAtLeast`, `woundsAtMost` | survivor | `value: n` | wounds + frostbite compared to n |
| `hasFrostbite` | survivor | | frostbite ≥ 1 |
| `hasEquipped` | survivor | `value?: itemId`, `symbol?` | an equipped card matches (any when both omitted) |
| `equippedAtLeast` | survivor | `value: n` | equipped count ≥ n |
| `influenceAtLeast`, `influenceAtMost` | survivor | `value: n` | |
| `exposureFace` | survivor | `face` | the final face of the exposure rolled in this window |
| `exposureReason` | survivor | `value: ExposureReason` | why that exposure was rolled |
| `woundKind` | survivor | `value: WoundKind` | the wound taken in this window is of that kind |
| `movedThisTurn` | survivor | | |
| `actionWas` | — | `value: TurnActionType` | the resolved action's type |
| `symbolDrawn` | card | `symbol` | the drawn card carries the symbol |
| `cardKeptHasSymbol` | card | `symbol` | the kept card carries the symbol |
| `handAtLeast`, `handAtMost` | seat | `value: n` | hand size |
| `handHasSymbol` | seat | `symbol`, `value?: n` (default 1) | at least n hand cards carry the symbol |
| `foodAtLeast`, `foodAtMost`, `moraleAtLeast`, `moraleAtMost`, `starvationAtLeast`, `wasteAtLeast` | colony | `value: n` | the track or pile compared to n |
| `roundsLeftAtMost`, `roundsLeftAtLeast` | colony | `value: n` | |
| `zombiesAtLeast`, `zombiesAtMost`, `barricadesAtLeast`, `noiseAtLeast`, `helplessAtLeast` | location | `value: n`, `location?` | totals over the location's entrances |
| `survivorsAtLeast`, `survivorsAtMost` | location or seat | `value: n`, `location?` | survivors there; with subject `seat`: that seat's survivors (at `location` when given) |
| `emptySurvivorSpace` | location | `location?` | at least one free survivor space (E.9) |
| `seatIsExiled` | seat | | |
| `seatCountAtLeast` | — | `value: n` | non-eliminated seats ≥ n |
| `dieAtLeast` | seat | `value: n` | an unused die ≥ n exists |
| `hasUnusedDie` | seat | | |
| `crisisPrevented` | — | | this round's crisis result was prevented |
| `objectiveCounterAtLeast` | seat or — | `value: counterName \| {counter, need}` | the counter (main, or the seat's secret objective) ≥ its declared `need`, or ≥ the given one |
| `isActiveSeat`, `isFirstSeat` | seat | | |
| `isLeader` | survivor | | the survivor is its owner's leader |
| `variantIs` | — | `value: keyof GameVariants` | the setup flag is on |

## 4. Effects

An effect is a list; nodes apply in order, each emitting its events (00 §7). Each op reads only the fields in its
row; `scope` defaults are in §5. `value` is a number or a string: an amount, a name, a die expression `"d6"` (roll
once, use the result as the amount) or a mode word listed in the row.

| Op | Fields | Does |
|---|---|---|
| `morale`, `food`, `starvation`, `roundTrack` | `value: ±n` | moves the track; morale reaches 0 → the game ends (E.12) |
| `objectiveCounter` | `value: counter`, `count: ±n` (default 1), `scope` seat for secret objectives | advances a counter; emits `ObjectiveProgress` |
| `addZombies` | `value: n \| 'd6' \| 'perSurvivor'`, `location` or `scope` over locations | adds one at a time with barricades and overruns (E.8) at each target location |
| `killZombies` | `count: n \| 'all'`, `location`, `scope` = the killer (default `self`), `value?: 'noExposure' \| 'exposureOnce'` | removes zombies; the owner picks the entrance at the colony. **Default: the killer rolls exposure once per zombie removed** (reason `zombieKill`, so `noExposureOnKill` grants apply), exactly as an attack would (R p13: a kill by a card effect is still a kill). `value: 'exposureOnce'` = one roll however many died (Daniel Smith); `value: 'noExposure'` = no roll (Lighter, Edward White, Bev Russell, Maria Lopez). A source with no holder survivor and no survivor scope (crisis, objective trigger, a Crossroads option that does not name `{who: survivor}`) has no killer: nothing rolls |
| `moveZombies` | `count`, `location` = destination, `scope` = source entrances (`chosen`) | into empty spaces only (F 5.1.1) |
| `addBarricade`, `removeBarricade`, `addNoise`, `removeNoise` | `count`, `location` | tokens; barricades need an empty entrance space; noise caps at 4 |
| `wound` | `count` (1), `kind` (`wound`), `scope` | wound tokens; 3 kill (4 with `fourWoundsToDie`) |
| `heal` | `count` (1), `kind?`, `scope` | removes tokens; `kind` omitted → the owner picks |
| `exposure` | `count` = rolls (1), `value: ExposureReason` (`card`), `scope`, `onRoll` | one exposure roll per count per survivor, bite chain included |
| `killSurvivor` | `scope` | the kill routine (00 §8): morale, equipment, leader |
| `removeSurvivor` | `scope` | out of the game, no morale (R p14) |
| `addSurvivor` | `count` (1), `scope` seat | draws from the survivor deck to the colony (exiled seat: a non-colony location of its choice, R p14); illegal with no empty colony space (E.9) |
| `addHelpless`, `removeHelpless` | `count`, `location` (`colony`) | tokens; an exiled seat adds none (R p14) |
| `moveSurvivor` | `scope`, `location` = destination, `value?: 'noExposure'` | a move with the normal rules; counts as the survivor's move this turn and reaches `action.move` |
| `newLeader` | `scope` seat | raises `newLeader` |
| `draw` | `value: 'revealed' \| 'here' \| LocationId`, `count` (1), `symbol?`, `optional?`, `scope` seat | item cards to the seat's hand from the revealed buffer or a deck top |
| `drawFromDeck` | `value: 'survivor' \| 'crisis' \| 'crossroads' \| 'exiledObjective'`, `count` | from a non-item deck to where that card kind lives |
| `discard` | `count \| 'all'`, `value: 'random' \| 'chosen'` (`chosen`), `symbol?`, `scope` seat | hand to waste (exiled seat: removed) |
| `removeCard` | `value: 'self' \| 'hand' \| 'waste' \| 'crisis'`, `count` | out of the game; `self` = the source card; `crisis` = the face-down contributions unrevealed (Old Divisions, F 2.3.1) |
| `giveCard` | `count`, `symbol?`, `scope` = receiving seat | from the acting seat's hand, revealed |
| `stealCard` | `count` (1), `scope` = the seat stolen from | random cards to the acting seat |
| `contribute` | `value: 'crisis' \| 'objective'`, `count`, `symbol?`, `scope` seat | forced contribution |
| `peekDeck` | `count`, `location` or `value: 'crisis' \| 'survivor' \| 'crossroads'`, `scope` seat | the seat sees the top cards; order unchanged |
| `revealDeck` | `value: n`, `location` | top n face up into the revealed buffer (public) until the list ends; leftovers go back on top in order unless `shuffleDeck` follows |
| `shuffleDeck` | `location` or `value` as peekDeck | shuffles the buffer back in |
| `cleanWaste` | `count` (3) | top waste cards out of the game |
| `equip` | `value: 'self' \| cardId`, `scope` survivor | attaches the card |
| `extraSearchKeep`, `extraSearchLook` | `count`, `scope` self | in the search this window belongs to: keep / look at that many more cards; look-only draws cost no noise |
| `modDie` | `value: ±n \| 'reroll' \| 'set:k'`, `count` (1), `scope` seat, `optional` | changes unused dice the owner picks; never above 6 |
| `addDie` | `value: n \| 'd6'`, `scope` seat | a new unused die this round |
| `refundDie` | — | the die spent on the action in progress is unused again |
| `forbid` | `what: ForbidWhat`, `scope`, `duration` | a lasting rule: the action is illegal (`E_FORBIDDEN`) |
| `grant` | `what: GrantWhat`, `value?`, `scope`, `duration` | a lasting rule (§7) |
| `treatFaceAs` | `face`, `asFace`, `scope`, `duration` | exposure face mapping, applied before `exposure.rolled` |
| `choose` | `options[{id,label,effect,requires?}]`, `scope.chooser` (owner) | raises `effectChoice`; an option whose `requires` fails is not offered; one option left → auto-resolved |
| `vote` | `options[0]` = yes effects, `options[1]` = no effects, `scope` = eligible seats (default non-exiled) | raises `votes`; ties go to the first seat (E.6) |
| `exile` | `scope` seat | the exile routine without a vote (E.11) |
| `endGame` | `value: GameEndReason` | ends the game now |

Common fields: `optional: true` asks the acting seat before the node applies (`effectChoice` yes/no); `then`
runs after the node; `onRoll` is in §6. Costs and limits are on the descriptor, not on nodes (§8).

## 5. Scopes

`{who, location?, filter?, count?, chooser?}`. `filter` is a condition over each candidate (`subject` defaults to
the candidate). `count` below the candidate set size means the chooser picks that many (`chooser` default
`owner`, the active seat for crises and Crossroads); `'all'` is the default.

| Who | Candidates |
|---|---|
| `self` | the holder (§2) |
| `survivor`, `target` | the bound survivor / target |
| `seatSurvivors` | every alive survivor of the acting seat |
| `allSurvivors` | every alive survivor |
| `atLocation` | alive survivors at `location` (default: the bound location) |
| `lowestInfluenceAtLocation`, `highestInfluenceAtLocation` | that one survivor at `location` |
| `seat`, `activeSeat` | one seat |
| `allSeats`, `otherSeats`, `nonExiledSeats` | seats; `otherSeats` excludes the acting seat; eliminated seats never |
| `location`, `colony` | one location |
| `allLocations`, `nonColonyLocations` | locations |
| `chosen` | whatever the op expects (survivors, seats, entrances, cards, locations), picked by `chooser` through `itemTarget` (items) or `effectChoice` (everything else); `filter` limits the offer; `chooser: 'engine'` = the first legal candidate |

Default scope per op: survivor ops → `self`; seat ops → `seat`; location ops take `location` (`'here'` = the
holder's location, `'chosen'` = picked). A node whose scope resolves to nothing is skipped with no error; an
item whose required scopes are all empty is not playable (`E_TARGET_INVALID`).

## 6. Dice inside effects

- `value: "d6"` rolls one action die (purpose by source: `item`, `ability`, `crisis`, `crossroads`, `objective`)
  and uses the result as the amount.
- `onRoll: {atLeast?, atMost?, then}` on any op except `exposure`: roll one d6 first; the op **and** `then` apply
  only when the result is inside the range (We Need More Samples: on 4+ add a sample). Outside it, nothing happens
  and the node-level `then` still runs.
- `onRoll` on `exposure`: `then` runs per rolled face whose severity is in range, severity = blank 0, wound 1,
  frostbite 2, bite 3 (after `treatFaceAs`).
- Every roll reaches the dice tray through `DiceRolled` / `ExposureRolled` (00 §11).

## 7. Durations and lasting rules

| Duration | Expires |
|---|---|
| `instant` | nothing lasts (default for every op but `forbid`, `grant`, `treatFaceAs`) |
| `turn` | end of the current player turn |
| `round` | end of this round's colony phase |
| `nextRound` | end of the next round's colony phase (Blizzard: "until the end of the next round") |
| `game` | never; passive abilities and equipped grants end when the source leaves play |

A lasting rule becomes an `EffectInstance` named `<sourceId>#<nodeIndex>`; the same name on the same targets
refreshes to the later expiry (00 §3). Grants:

| Grant | Meaning |
|---|---|
| `noExposureOnMove`, `noExposureOnKill`, `noExposureOnAbility` | skip the roll for that reason (`ExposureSkipped`) |
| `biteIsWound`, `frostbiteIsWound`, `nonBiteIsBlank` | face mapping shorthands (Sparky, Harman) |
| `extraSearchKeep`, `extraSearchLook` | `value` more cards on every search by the survivor |
| `extraMove` | one more move this turn |
| `killTwoPerAttack` | an attack on zombies kills 2 with one exposure roll |
| `fourWoundsToDie` | the kill threshold is 4 (Buddy Davis; F 1.1.5 for copies) |
| `copyAbilitiesAtLocation` | John Price: holds the abilities of every other survivor at his location; copies start when his move completes there and end when his next move completes (F 1.1.1); each copy of a once-per-round ability is its own instance (F 1.1.3); copies may stack (F 1.1.2) |
| `attackValueMinus`, `searchValueMinus` | the stat needs `value` less |
| `freeBarricade` | a barricade action without a die |
| `moveRollWound` | every move also rolls a d6: 2 or less → 1 wound (Hunted option 2) |
| `noMoraleOnDeath` | the colony keeps morale when the survivor dies |

Forbids name the action type they block (`ForbidWhat`); `heal` blocks wound removal by any source.

## 8. Costs, limits, locations, counting as an action

- `cost.die: n` — the owner spends an unused die ≥ n (`E_DIE_TOO_LOW`); `cost.cards {symbol?, count}` — hand or
  equipped cards leave play as their class says, with no effect of their own (the Lighter's fuel); `cost.food`;
  `cost.noise`; `cost.removeSelf` — the source survivor leaves the game.
- `countsAs: '<type>'` on an action ability or an item play makes the resolved action count as that turn-action
  type: the `action.<type>` window (and so Crossroads triggers) fires after it, `forbid` of that type blocks it,
  and `movedThisTurn` is set by `'move'`. Dice: one die at most, taken from `cost.die` when it is set (Edward
  White attacks on any die: `cost.die: 1`); without `cost.die`, `'attack'` and `'search'` charge the stat die
  (≥ the survivor's attack / search value: Lighter), and `'barricade'`, `'cleanWaste'`, `'attract'` and `'move'`
  charge no die at all, so an ability of those types without `cost.die` is a free action of that type (Ashley
  Ross's barricade; the Fuel move).
  Exposure comes from the effect, not from `countsAs`: a `killZombies` node rolls by its own default (§4), so an
  ability that counts as an attack never rolls twice.
- `limit`: `oncePerTurn`, `oncePerRound` (reset at `dice.rolled`), `oncePerGame`; tracked in `abilityUses`.
  A hand-off keeps the count (E.6). Abilities with a die cost and no limit repeat (R p10).
- `location`: `anywhere`, `colony`, `nonColony` or one location id; passives switch on and off as the survivor
  moves.

## 9. Compiling data to descriptors

| Data | Descriptor | Binding |
|---|---|---|
| `survivor.ability` | `CardEffectDescriptor {source:'survivor', sourceId: survivor id, survivorId, ownerSeat}` | `point` = `passive` / `action` / `trigger`; `scope` default `{who:'self'}`; `duration` default `game` for passives, else `instant`; `optional` default false; `location` default `anywhere` |
| `item.play` | `{source:'item', point:'action', ownerSeat}` | `self` = the bearer picked at play time; the loader lists the `chosen` scopes in order for `itemTarget` |
| `item.equipped[]` | one descriptor per entry, `survivorId` = bearer | re-bound on hand-off |
| `crisis` | `CrisisDescriptor {id, prevent, fail, bonus}` | `need` is read by the crisis step |
| `crossroads` | `CrossroadsDescriptor {id, point, when, options, mature}` | options keep `{id, effect, requires, vote}` |
| `mainObjective.sides[side]` | `ObjectiveDescriptor {kind:'main'}` | `triggers[]` → descriptors with `source:'objective'`; `perSeat` resolved to seats at setup × multiplier |
| `secretObjective` | `ObjectiveDescriptor {kind: type}` (`type` is `secret` \| `betrayal` \| `exiled`, the same spelling as `kind`) | `ownerSeat` = holder; `complete` evaluated with `seat` = holder; `triggers[]` → descriptors with `source: 'secretObjective'` (`'exiledObjective'` for `type: exiled`); the setup event `SecretObjectiveDealt.kind` keeps the frozen `events.ts` spelling: `type: secret` → `'standard'`, `type: betrayal` → `'betrayal'` |

## 10. Validation of effect trees (schema plus `tools/validate-data.ts`)

| Rule | Severity |
|---|---|
| op in `OP_HOOK_POINTS` used at a point outside its list | warn |
| `forbid`/`grant`/`treatFaceAs` without `duration`; any other op with one | error |
| `choose`/`vote` without ≥ 1 option (`vote`: exactly 2, ids `yes` and `no`) | error |
| `scope.who = 'chosen'` without `chooser` | error (schema) |
| `onRoll` on `choose`, `vote`, `forbid`, `grant` | error |
| a `code` name missing from `CODE_HOOKS` | error |
| `objectiveCounter` / `objectiveCounterAtLeast` naming a counter the objective does not declare | error |
| a Crossroads trigger point that is not `action.*` | error |
| an ability `kind` whose point disagrees with `KIND_HOOK_POINTS` | error |
| `countsAs` on a passive | error |
| `killZombies.value` other than `noExposure` / `exposureOnce`; `moveSurvivor.value` other than `noExposure` | error |

## 11. The code escape hatch

`{"code": "<name>", "params"?: {...}}` may stand anywhere a condition or an effect node may. Names are
`<source>.<slug>.<what>` in camel case: `survivor.sparky.skipBiteSpread`, `crossroads.bev-russel.immune`,
`objective.find-a-cure.contribute`. Implementations live in `src/engine/code-hooks.ts` as `CODE_HOOKS:
CodeHookRegistry` (`conditions`, `effects`, `objectives`); the hook receives `HookContext` and `params`, returns
`boolean` or `HookResult`, and must emit the same events a plain node would. The validator rejects unknown
names. Keep each hook under 40 lines and add a golden test per hook (`60`). When three cards need the same hook,
propose an additive op instead (00 §16).

Known hooks the first slice needs: `survivor.sparky.skipBiteSpread` (the bite chain passes over him),
`survivor.annaleigh-chan.peekHands`, `survivor.talia-jones.reorderTop`, `crossroads.bev-russel.immune` (she
cannot be the overrun victim, F 2.2.1).

## 12. Dry run (every block below validates against the schemas)

Status words follow `20 §2`: `verified` = official text read; `draft` = fan-sourced or partly legible;
`placeholder` = the shape is exercised with an invented effect and the record is never loaded.

### 12.1 Crossroads: Hunted (R p4)

```json
{
  "kind": "crossroads", "id": "xr.hunted", "name": "Hunted", "mature": false,
  "trigger": {
    "point": "action.move",
    "when": { "all": [
      { "test": "exposureReason", "subject": "survivor", "value": "move" },
      { "test": "exposureFace", "subject": "survivor", "face": "wound" }
    ] }
  },
  "options": [
    { "id": "hunt", "effect": [ { "op": "exposure", "value": "card", "count": 2, "scope": { "who": "seatSurvivors" } } ] },
    { "id": "lieLow", "effect": [ { "op": "grant", "what": "moveRollWound", "scope": { "who": "allSeats" }, "duration": "game" } ] }
  ],
  "text": {
    "trigger": "One of your survivors took a plain wound on the exposure roll after a move.",
    "vignette": "The wound is not a scratch from the dead. It is a bullet, and it came from the tree line, from people in winter camouflage who looked fed and rested and were not interested in the shamblers at all. Somebody out there is hunting the living.",
    "options": {
      "hunt": "Go after them tonight. Every survivor in your group rolls for exposure twice.",
      "lieLow": "Keep your heads down. From now on every move any player makes also rolls a die: a 1 or 2 means a wound."
    }
  },
  "sources": { "trigger": "R p4", "options": "R p4", "mature": "R p4" },
  "status": "verified"
}
```

### 12.2 Crises: Blizzard and Fuel Shortage (R p4, p12)

```json
{
  "kind": "crisis", "id": "cr.blizzard", "name": "Blizzard",
  "prevent": ["fuel"],
  "fail": [
    { "op": "forbid", "what": "move", "scope": { "who": "nonExiledSeats" }, "duration": "nextRound" },
    { "op": "morale", "value": -1 }
  ],
  "bonus": { "extraCards": 2, "effect": [ { "op": "morale", "value": 1 } ] },
  "text": {
    "fail": "Nobody who still belongs to the colony may move until the end of next round, and morale drops by 1.",
    "bonus": "Two cards beyond the need lift morale by 1."
  },
  "sources": { "prevent": "R p4 (verify)", "fail": "R p4", "bonus": "R p4" },
  "status": "draft"
}
```

```json
{
  "kind": "crisis", "id": "cr.fuel-shortage", "name": "Fuel Shortage",
  "prevent": ["fuel"],
  "fail": [ { "op": "morale", "value": -2 } ],
  "bonus": { "extraCards": 2, "effect": [ { "op": "morale", "value": 1 } ] },
  "text": { "fail": "The generators go quiet. Morale drops by 2.", "bonus": "Two cards beyond the need lift morale by 1." },
  "sources": { "prevent": "R p12 (verify)", "fail": "R p12", "bonus": "R p12" },
  "status": "draft"
}
```

`prevent` is `(verify)` on both: the icon row is not legible in the text extract; the p12 example proves only that
fuel counts and weapon does not.

### 12.3 Main objective: We Need More Samples, both sides (R p6, p15)

```json
{
  "kind": "mainObjective", "id": "obj.main.we-need-more-samples", "name": "We Need More Samples", "code": "M10", "time": "short",
  "sides": {
    "normal": {
      "morale": 6, "rounds": 6,
      "setup": [ { "op": "addZombies", "value": 1, "scope": { "who": "nonColonyLocations" } } ],
      "counters": { "samples": { "need": "perSeat", "perSeatMultiplier": 3 } },
      "complete": { "test": "objectiveCounterAtLeast", "value": "samples" },
      "triggers": [ { "id": "sample", "trigger": "zombie.killed",
        "effect": [ { "op": "objectiveCounter", "value": "samples", "count": 1, "onRoll": { "atLeast": 4, "then": [] } } ] } ]
    },
    "hardcore": {
      "morale": 6, "rounds": 5,
      "setup": [ { "op": "addZombies", "value": 3, "scope": { "who": "nonColonyLocations" } } ],
      "counters": { "samples": { "need": "perSeat", "perSeatMultiplier": 3 } },
      "complete": { "test": "objectiveCounterAtLeast", "value": "samples" },
      "triggers": [ { "id": "sample", "trigger": "zombie.killed",
        "effect": [ { "op": "objectiveCounter", "value": "samples", "count": 1, "onRoll": { "atLeast": 4, "then": [] } } ] } ]
    }
  },
  "text": {
    "normal": { "setup": "Morale 6, six rounds, one zombie at every location outside the colony.", "victory": "Whenever a zombie dies, roll a die; a 4 or better bags it. Collect three per player who started the game." },
    "hardcore": { "setup": "Morale 6, five rounds, three zombies at every location outside the colony.", "victory": "As the normal side." }
  },
  "sources": { "sides.normal": "R p6; R p15", "sides.hardcore": "R p15", "code": "R p15", "time": "R p15" },
  "status": "verified"
}
```

### 12.4 Survivors

```json
{
  "kind": "survivor", "id": "sv.forest-plum", "name": "Forest Plum", "occupation": "Mall Santa",
  "stats": { "influence": 14, "attack": 2, "search": 5 },
  "ability": { "id": "lastGift", "kind": "triggered", "trigger": "turn.start", "location": "anywhere",
    "when": { "test": "isActiveSeat", "subject": "seat" }, "optional": true,
    "effect": [ { "op": "removeSurvivor", "scope": { "who": "self" } }, { "op": "morale", "value": 1 } ] },
  "crossroads": "xr.forest-plum", "coop": true,
  "text": { "ability": "Forest can walk out into the snow for good as your turn opens, and the colony takes heart from it: morale +1." },
  "sources": { "stats.influence": "R p7; W; C", "stats.attack": "W", "stats.search": "R p10; W", "ability": "R p7; W; T" },
  "status": "draft"
}
```

```json
{
  "kind": "survivor", "id": "sv.daniel-smith", "name": "Daniel Smith", "occupation": "Sheriff",
  "stats": { "influence": 66, "attack": 2, "search": 5 },
  "ability": { "id": "doubleTap", "kind": "action", "location": "anywhere", "cost": { "die": 4 },
    "when": { "test": "zombiesAtLeast", "subject": "location", "value": 1 },
    "effect": [ { "op": "killZombies", "count": 2, "location": "here", "value": "exposureOnce" } ] },
  "crossroads": "xr.daniel-smith", "coop": true,
  "text": { "ability": "(4+) Daniel drops two zombies where he stands and rolls for exposure only once." },
  "sources": { "stats.influence": "R p7; W; C", "stats.attack": "R* p7; W", "stats.search": "R* p7; W", "ability": "R p7; W; T" },
  "status": "draft",
  "notes": "No round limit: the printed card has none (sources C2). `exposureOnce` collapses the per-zombie default (§4) to one roll; with a single zombie present the ability kills it and still rolls once."
}
```

```json
{
  "kind": "survivor", "id": "sv.gabriel-diaz", "name": "Gabriel Diaz", "occupation": "Fireman",
  "stats": { "influence": 60, "attack": 2, "search": 3 },
  "ability": { "id": "sweep", "kind": "action", "location": "nonColony", "limit": "oncePerRound",
    "effect": [
      { "op": "revealDeck", "value": 4, "location": "here" },
      { "op": "draw", "value": "revealed", "symbol": "survivor", "count": 1, "optional": true, "scope": { "who": "chosen", "chooser": "owner" } },
      { "op": "shuffleDeck", "location": "here" }
    ] },
  "crossroads": "xr.gabriel-diaz", "coop": true,
  "text": { "ability": "Four cards off the top of the local deck, one Outsider kept if Gabriel likes the look of them, the rest shuffled back in. Not at the colony; once a round." },
  "sources": { "stats.influence": "W; C", "stats.attack": "W", "stats.search": "W", "ability": "R p7; W; T" },
  "status": "draft"
}
```

```json
{
  "kind": "survivor", "id": "sv.sparky", "name": "Sparky", "occupation": "Stunt Dog",
  "stats": { "influence": 10, "attack": 2, "search": 2 },
  "ability": { "id": "goodBoy", "kind": "passive",
    "effect": [
      { "op": "grant", "what": "biteIsWound", "scope": { "who": "self" }, "duration": "game" },
      { "code": "survivor.sparky.skipBiteSpread" }
    ] },
  "crossroads": "xr.sparky", "coop": true,
  "text": { "ability": "A bite on Sparky's exposure roll is only a wound, and a spreading bite passes him by." },
  "sources": { "stats.influence": "W; C", "stats.attack": "W", "stats.search": "W", "ability": "F 1.1.1; W; T", "ability.effect[1]": "W (verify)" },
  "status": "draft"
}
```

```json
{
  "kind": "survivor", "id": "sv.harman-brooks", "name": "Harman Brooks", "occupation": "Park Ranger",
  "stats": { "influence": 32, "attack": 3, "search": 3 },
  "ability": { "id": "thickSkin", "kind": "passive",
    "effect": [ { "op": "grant", "what": "frostbiteIsWound", "scope": { "who": "self" }, "duration": "game" } ] },
  "crossroads": "xr.harman-brooks", "coop": true,
  "text": { "ability": "Frostbite never takes hold of Harman: he takes an ordinary wound instead." },
  "sources": { "stats.influence": "W; C", "stats.attack": "W", "stats.search": "W", "ability": "F 1.1.1; W; T" },
  "status": "draft"
}
```

```json
{
  "kind": "survivor", "id": "sv.john-price", "name": "John Price", "occupation": "Student",
  "stats": { "influence": 18, "attack": 3, "search": 3 },
  "ability": { "id": "quickStudy", "kind": "passive", "location": "nonColony",
    "effect": [ { "op": "grant", "what": "copyAbilitiesAtLocation", "scope": { "who": "self" }, "duration": "game" } ] },
  "crossroads": "xr.john-price", "coop": true,
  "text": { "ability": "Away from the colony, John can do whatever the survivors around him can do." },
  "sources": { "stats.influence": "W; C", "stats.attack": "W", "stats.search": "W", "ability": "F 1.1; W; T", "ability.location": "W (verify)" },
  "status": "draft"
}
```

```json
{
  "kind": "survivor", "id": "sv.buddy-davis", "name": "Buddy Davis", "occupation": "Fitness Trainer",
  "stats": { "influence": 36, "attack": 2, "search": 4 },
  "ability": { "id": "ironBody", "kind": "passive",
    "effect": [ { "op": "grant", "what": "fourWoundsToDie", "scope": { "who": "self" }, "duration": "game" } ] },
  "crossroads": "xr.buddy-davis", "coop": true,
  "text": { "ability": "It takes four wounds, not three, to put Buddy down." },
  "sources": { "stats.influence": "W; C", "stats.attack": "W", "stats.search": "W; T", "ability": "F 1.1.5; W; T" },
  "status": "draft"
}
```

```json
{
  "kind": "survivor", "id": "sv.loretta-clay", "name": "Loretta Clay", "occupation": "Cook",
  "stats": { "influence": 20, "attack": 2, "search": 4 },
  "ability": { "id": "stretchIt", "kind": "action", "location": "colony", "cost": { "die": 4 }, "limit": "oncePerRound",
    "effect": [ { "op": "food", "value": 2 } ] },
  "crossroads": "xr.loretta-clay", "coop": true,
  "text": { "ability": "(4+) Once per round, while at the colony, Loretta adds 2 food to the supply." },
  "sources": { "stats.influence": "W; C", "stats.attack": "W; T", "stats.search": "W", "ability": "F 1.2.1; W; T" },
  "status": "draft"
}
```

### 12.5 Ten items of different kinds

| # | Card | Kind exercised | Mechanics source |
|---|---|---|---|
| 1 | Fuel | waste pile, played as a move, `moveSurvivor` with `noExposure`, `countsAs` | R p10 card |
| 2 | Lighter | equip, action ability with a card cost, counts as an attack, no exposure | R p9-10 card |
| 3 | Food 2 | waste pile resource, `food` field (exiled: may boost a die instead) | W; brief G.2 (verify) |
| 4 | Medicine | waste pile heal with a chosen target | R p12 (verify) |
| 5 | 2 Outsiders | event, `addSurvivor`, `when` on colony space | R p14; W; F 3.1 (verify) |
| 6 | Baseball Bat | equip passive grant | T (placeholder) |
| 7 | Junk | class `none` | W (verify) |
| 8 | Microphone | `moveZombies` into empty spaces from chosen entrances | F 5.1.1 (placeholder) |
| 9 | Adrenaline Shot | medicine symbol, `grant` for a turn on a chosen survivor | F 1.3.2 (placeholder) |
| 10 | 1,2,3 Barricades | `choose` with three options, `addBarricade` | W name only (placeholder) |

```json
{
  "kind": "item", "id": "it.fuel", "name": "Fuel", "symbol": "fuel", "class": "wastePile",
  "play": {
    "countsAs": "move",
    "effect": [ { "op": "moveSurvivor", "value": "noExposure", "location": "chosen",
      "scope": { "who": "seatSurvivors", "count": 1, "chooser": "owner", "filter": { "not": { "test": "movedThisTurn", "subject": "survivor" } } } } ]
  },
  "text": { "ability": "Burn it on the road: move one of your survivors without rolling for exposure." },
  "sources": { "symbol": "R p10; W", "class": "R p10", "play": "R p10" },
  "status": "verified"
}
```

```json
{
  "kind": "item", "id": "it.lighter", "name": "Lighter", "symbol": "weapon", "class": "equip",
  "equipped": [ { "id": "burn", "kind": "action", "limit": "oncePerRound", "countsAs": "attack",
    "cost": { "cards": { "symbol": "fuel", "count": 1 } },
    "when": { "test": "zombiesAtLeast", "subject": "location", "value": 1 },
    "effect": [ { "op": "killZombies", "count": 4, "location": "here", "value": "noExposure" } ] } ],
  "text": { "ability": "Once per round, when the bearer attacks, feed a fuel card to the flame: four zombies die instead of one and nobody rolls for exposure." },
  "sources": { "symbol": "R p10; W", "class": "R p10", "equipped": "R p9; R p10" },
  "status": "verified"
}
```

```json
{
  "kind": "item", "id": "it.food-2", "name": "Food 2", "symbol": "food", "class": "wastePile", "food": 2,
  "play": { "effect": [ { "op": "food", "value": 2 } ] },
  "text": { "ability": "Two food tokens for the supply." },
  "sources": { "symbol": "W", "food": "B G.2; W (verify)", "class": "R p10 (verify)", "play": "B E.6 (verify)" },
  "status": "draft"
}
```

```json
{
  "kind": "item", "id": "it.medicine", "name": "Medicine", "symbol": "medicine", "class": "wastePile",
  "play": { "effect": [ { "op": "heal", "count": 1,
    "scope": { "who": "chosen", "chooser": "owner", "filter": { "test": "woundsAtLeast", "subject": "survivor", "value": 1 } } } ] },
  "text": { "ability": "Remove one wound token from a survivor." },
  "sources": { "symbol": "W; F 1.3.2", "class": "R p12 (verify)", "play": "R p12 (verify)" },
  "status": "placeholder",
  "notes": "R p12 fixes only that it is played after a wound lands and cannot save a survivor from a third wound; which survivors qualify is unread."
}
```

```json
{
  "kind": "item", "id": "it.outsiders-2", "name": "2 Outsiders", "symbol": "survivor", "class": "event", "outsiders": 2,
  "play": {
    "when": { "test": "emptySurvivorSpace", "location": "colony" },
    "effect": [ { "op": "addSurvivor", "count": 1, "scope": { "who": "seat" } } ]
  },
  "text": { "ability": "Strangers at the gate: a new survivor joins your group at the colony." },
  "sources": { "symbol": "W", "class": "O; F 3.1", "outsiders": "W (verify)", "play": "R p14; W", "play.when": "R p14" },
  "status": "draft",
  "notes": "What the printed number changes is unread (items-sources I2); an exiled seat places the newcomer at a non-colony location (R p14)."
}
```

```json
{
  "kind": "item", "id": "it.baseball-bat", "name": "Baseball Bat", "symbol": "tool", "class": "equip",
  "equipped": [ { "id": "swing", "kind": "passive",
    "effect": [ { "op": "grant", "what": "killTwoPerAttack", "scope": { "who": "self" }, "duration": "game" } ] } ],
  "text": { "ability": "Each attack by the bearer takes down two zombies for one exposure roll." },
  "sources": { "symbol": "W", "class": "T (verify)", "equipped": "T (verify)" },
  "status": "placeholder"
}
```

```json
{
  "kind": "item", "id": "it.junk", "name": "Junk", "symbol": "tool", "class": "none",
  "text": {},
  "sources": { "symbol": "W", "class": "W (verify)" },
  "status": "draft"
}
```

```json
{
  "kind": "item", "id": "it.microphone", "name": "Microphone", "symbol": "tool", "class": "wastePile",
  "play": { "effect": [ { "op": "moveZombies", "count": 2, "location": "here", "scope": { "who": "chosen", "chooser": "owner" } } ] },
  "text": { "ability": "Turn it up: pull two zombies from anywhere into empty spaces at the bearer's location." },
  "sources": { "symbol": "F 5.1.1 (verify)", "class": "F 5.1.1 (verify)", "play": "F 5.1.1 (verify)" },
  "status": "placeholder",
  "notes": "F 5.1.1 fixes only that it attracts into empty spaces; the deck it belongs to is unknown (items-sources I3)."
}
```

```json
{
  "kind": "item", "id": "it.adrenaline-shot", "name": "Adrenaline Shot", "symbol": "medicine", "class": "wastePile",
  "play": { "effect": [ { "op": "grant", "what": "extraMove", "duration": "turn",
    "scope": { "who": "seatSurvivors", "count": 1, "chooser": "owner" } } ] },
  "text": { "ability": "One of your survivors may move a second time this turn." },
  "sources": { "symbol": "F 1.3.2; W", "class": "F 1.3.2 (verify)", "play": "F 1.3.2 (verify)" },
  "status": "placeholder"
}
```

```json
{
  "kind": "item", "id": "it.barricades-123", "name": "1,2,3 Barricades", "symbol": "education", "class": "wastePile",
  "play": { "effect": [ { "op": "choose", "scope": { "who": "seat", "chooser": "owner" }, "options": [
    { "id": "one", "label": "One barricade here", "effect": [ { "op": "addBarricade", "count": 1, "location": "here" } ] },
    { "id": "two", "label": "Two barricades here, one noise", "effect": [ { "op": "addBarricade", "count": 2, "location": "here" }, { "op": "addNoise", "count": 1, "location": "here" } ] },
    { "id": "three", "label": "Three barricades here, two noise", "effect": [ { "op": "addBarricade", "count": 3, "location": "here" }, { "op": "addNoise", "count": 2, "location": "here" } ] }
  ] } ] },
  "text": { "ability": "Pick a plan: one quiet barricade, two with some noise, or three with a racket." },
  "sources": { "symbol": "W", "class": "W (verify)", "play": "W (verify)" },
  "status": "placeholder"
}
```

## 13. Coverage of every known card (encoding sketch; data entry fills the records)

| Card | Encoding | Gap |
|---|---|---|
| Alexis Grey, Andrew Evans, Arthur Thurston, Carla Thompson, Janet Taylor | `triggered search.drawn`, `location` = their place, `limit oncePerRound`, `optional`, effect `extraSearchLook 1` + `extraSearchKeep 1` | none |
| David Garcia | as above without limit, `extraSearchLook 1` only | W only |
| Jenny Clark | as above, `extraSearchLook 3` | none (F 1.1.2) |
| Annaleigh Chan | `action`, `limit oncePerRound`, `{code: survivor.annaleigh-chan.peekHands}`, `coop:false` | code hook |
| Ashley Ross | `action`, `limit oncePerRound`, no `cost`, `countsAs barricade` (free of a die by the §8 rule; reaches `action.barricade`), `addBarricade 1 here` | none |
| Bev Russell | `action`, `colony`, `cost.die 1`, `limit oncePerRound`, `when helplessAtLeast 1 and zombiesAtLeast 1`, `killZombies 2 here value noExposure` | none |
| Brandon Kane | `action`, `colony`, `cost.die 1`, `limit`, `countsAs cleanWaste`, `cleanWaste 5` | none |
| Brian Lee | `action`, `limit`, `modDie +1 count 1` | none |
| Edward White | `action`, `colony`, `cost {die 1, cards medicine 1}`, `countsAs attack` (any die, §8), `limit`, `killZombies 3 here value noExposure` | none (F 1.3) |
| Gray Beard | `action`, `colony`, `limit`, `stealCard 1` from a chosen other seat with `handAtLeast 1`, `coop:false` | none |
| James Meyers | `action`, `limit`, `modDie 'reroll' count 'all'` with the owner picking the subset | wording C6 |
| Maria Lopez | `action`, `loc.school`, `cost.die 1`, `limit`, `killZombies 1 here value noExposure` (W: no roll) | none |
| Mike Cho / Rod Miller | passive `grant noExposureOnKill` / `noExposureOnMove` | none |
| Olivia Brown | `action`, `limit`, `heal 1` on a chosen survivor `atLocation` with `woundsAtLeast 1` | none |
| Sophie Robinson | `action`, `limit`, `peekDeck count 1 location chosen` | none |
| Talia Jones | `action`, `limit`, `peekDeck count 2 value crisis` then `{code: survivor.talia-jones.reorderTop}` | code hook; the two words are table talk |
| Thomas Heart | `ability: {unknown: true}`, status placeholder | card photo (C4) |
| Outbreak (Crossroads) | an option with `vote:true`, first effect `vote` with `scope {who: allSeats, filter: survivorsAtLeast 1 at colony}` (F 2.4.1) | the rest of the card |
| Old Divisions | the thumbs-up option: `removeCard value crisis count all` (F 2.3.1) | the rest of the card |
| Bev Russel (Crossroads) | option 1 adds zombies at the school (`addZombies`) with `{code: crossroads.bev-russel.immune}` (F 2.2.1) | the rest of the card |
| Find a Cure | `contributions [{symbol medicine, counter medicine}]`, `counters {medicine: perSeat x2 / x3}`, hardcore `setup addZombies 12 colony` + `2 nonColonyLocations` | BGG (verify) |
| Secret objective "main complete and 3 food cards" (R p3) | `requiresMain true`, `complete {handHasSymbol food value 3}` | real card list |
| Exiled objectives | `type exiled`, `requiresOriginal` per card | cards unread |
| Exiled seat food cards | engine rule, not data: the seat chooses per card between the `food` effect and `modDie +1` on an unused die (R p14, F 5.4.4; `10` R15.4) | none |

## 14. Rulings taken here

- RULING: Daniel Smith with one zombie present | the ability is usable with ≥ 1 zombie, kills what is there (up to 2) and rolls exposure once | Unsourced
- RULING: a move made by playing Fuel | counts as that survivor's move this turn and evaluates `action.move` Crossroads triggers like a move action (`countsAs: move`) | Unsourced
- RULING: exposure after a card or ability kills a zombie | `killZombies` rolls exposure on the killer once per zombie by default (reason `zombieKill`); a card that waives or collapses the roll says so in data (`value: 'noExposure'` on Lighter, Edward White, Bev Russell, Maria Lopez; `'exposureOnce'` on Daniel Smith); an earlier draft made no roll the silent default | Corrected (R p13: a zombie killed by an attack or a card effect costs its killer an exposure roll; R p10 Lighter and R p7 Daniel Smith print their exceptions)
- RULING: `countsAs` and dice | `cost.die` when set is the one die charged; otherwise `attack`/`search` charge the stat die and `barricade`/`cleanWaste`/`attract`/`move` charge none, so Ashley Ross is `countsAs barricade` with no `cost` rather than a `freeBarricade` grant (grants carry no use limit and passives carry no `limit`) | Unsourced (engine convention; W for Ashley's and Edward White's wording)
- RULING: Sparky and the bite chain | a spreading bite skips him (code hook) while the FAQ fixes only bite→wound | Fan-source (W)
- RULING: John Price copies only away from the colony | `location: nonColony` on the grant | Fan-source (W; F 1.1.1 silent)
- RULING: `onRoll` semantics | a d6 gate on the host op; on `exposure` a severity branch | Unsourced (engine convention)
- RULING: Lighter is an attack | `countsAs: attack` charges the attack die and reaches `action.attack`; the fuel card is a cost with no effect | Confirmed (R p10)
