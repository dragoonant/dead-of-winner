# 20: Data schema

The JSON shapes of every content record, the `DataBundle` the engine receives, the validation rules
`tools/validate-data.ts` enforces, and the per-value source convention. Effect trees inside the records follow
`21-card-effects-dsl.md`; the JSON Schemas are `docs/spec/schemas/*.json` (draft 2020-12, ajv 8 with
`{ strict: true, strictRequired: false, allErrors: true }`). Names may match the real cards; every sentence of
`text.*` is ours (Part F).

## 1. Files and ids

| What | Where | Id prefix |
|---|---|---|
| survivors | `src/data/survivors/<slug>.json` | `sv.` |
| item definitions | `src/data/items/<slug>.json` | `it.` |
| decks (starter + 6) | `src/data/decks/<slug>.json` | `deck.` |
| locations (colony + 6) | `src/data/locations/<slug>.json` | `colony`, `loc.` |
| crises | `src/data/crises/<slug>.json` | `cr.` |
| Crossroads | `src/data/crossroads/<slug>.json` | `xr.` |
| main objectives | `src/data/main-objectives/<slug>.json` | `obj.main.` (11 §1) |
| secret, betrayal, exiled objectives | `src/data/secret-objectives/<slug>.json` | `obj.secret.`, `obj.betrayal.`, `obj.exiled.` (11 §1) |
| personas | `src/data/personas/<slug>.json` | `ps.` |
| version and slices | `src/data/version.json`, `src/data/slices.json` | |
| TS types | `src/data/types.ts` (hand-mirrored from the schemas; a test compares the two) | |

One record per file; the file name is the slug of the id; slugs are `[a-z0-9-]`. Ids are stable forever
(saves and replays carry them). A record used by the engine as a `LocationId` keeps the engine's spelling
(`'colony'`, `'loc.<slug>'`).

## 2. Fields every record has (`common.json#recordBase`)

| Field | Type | Rule |
|---|---|---|
| `kind` | the record kind | discriminator, fixed per schema |
| `id`, `name` | string | unique across the bundle; `name` ≤ 80 chars |
| `sources` | `{ "<field path>": "<cite>" }` | §6; at least one entry |
| `status` | `placeholder` \| `draft` \| `verified` | `placeholder` = shape exercised with an invented or unread effect, never loaded; `draft` = loadable in dev builds and the sim, listed in the verify report; `verified` = every mechanical field cited from R, F, PHOTO or BGG, or from two independent fan tags, with no `(verify)` |
| `text` | per kind | our prose; required where the card shows text (personas carry `blurb` and `lines` instead) |
| `notes`, `tags` | string, slug[] | free; `tags` feed `survivorHasKeyword` |

## 3. Shapes

### 3.1 Survivor (`survivor.json`)

| Field | Type | Notes |
|---|---|---|
| `occupation` | string | |
| `stats` | `{influence, attack, search}` ints | `attack`/`search` = the die needed (N+); influence unique over the 30 base survivors (sources C) |
| `ability` | `AbilityDef` or `{unknown: true}` | `unknown` forces `status: placeholder` (Thomas Heart) |
| `crossroads` | `xr.` id | the card named after the survivor |
| `coop` | boolean | false = removed in the co-op variant |
| `text.ability`, `text.bio` | prose | |
| `art.portrait`, `art.figure` | paths | M5 |

`AbilityDef` (`common.json#abilityDef`): `{id, kind: passive|action|triggered, trigger?, location?, when?, cost?,
limit?, scope?, duration?, effect[], optional?, countsAs?}`; meanings in `21 §8–§9`.

### 3.2 Item definition (`item.json`)

| Field | Type | Notes |
|---|---|---|
| `symbol`, `symbols?` | ItemSymbol | the printed symbol; `symbols` when a card carries several |
| `class` | `wastePile` \| `event` \| `equip` \| `none` | where the card goes when played (R p10); `none` = no play text |
| `food?` | int | Food N; an exiled seat may choose +1 on an unused die instead of the effect (R p14, F 5.4.4; `10` R15.4) |
| `outsiders?` | int | required when `symbol` is `survivor`; those cards are `event` and leave the game (O, F 3.1) |
| `play?` | `{when?, cost?, effect[], countsAs?}` | the turn action `playCard`; required for `wastePile` and `event` |
| `equipped?` | `AbilityDef[]` | required for `equip`: abilities of the bearer while attached |
| `text.ability`, `text.flavor` | prose | |

An item definition is one card face; how many copies sit in which deck is the deck's business, so "Fuel" is one
record and the Police Station deck lists it 4 times.

### 3.3 Deck (`deck.json`)

`{size, cards: [{item, count}]}`. `size` must equal the sum of counts: 25 for `deck.starter`, 20 for each
location deck (R p2). Setup deals 5 starter cards per seat (7 in the two-player variant) and boxes the rest (R p6).

### 3.4 Location (`location.json`)

| Field | Type | Notes |
|---|---|---|
| `number?` | 1–6 | the number printed in the card's corner (PHOTO; W agrees), also the random-location die value; absent at the colony |
| `spaces` | `{survivors, entrances, entranceSpaces, noise}` | colony: 24 survivors, 6 entrances × 3 spaces, 0 noise (R p5 diagram); others: 1 entrance, 4 noise (R p5), survivor and entrance spaces per card from photos (`sources/locations-sources.md`) |
| `symbolOrder` | ItemSymbol[] | the printed row, likeliest first, `survivor` last (R p5, PHOTO, cross-checked against the deck counts); feeds `query.searchOdds`; `[]` at the colony |
| `deck` | `deck.` id or null | null at the colony |

`locationOrder` in the engine is `colony` then the six by `number` (E.4 zombie step order). The sourced counts, as
`{survivors, entranceSpaces, noise}`: colony `{24, 3, 0}`; 1 Police Station `{3, 4, 4}`; 2 Grocery Store `{3, 4, 4}`;
3 School `{4, 4, 4}`; 4 Library `{3, 3, 4}`; 5 Hospital `{4, 4, 4}`; 6 Gas Station `{2, 3, 4}` (`10` R2.2, R2.4).

### 3.5 Crisis (`crisis.json`)

`{prevent: ItemSymbol[], need?: {perSeat, plus}, fail: Effect[], bonus?: {extraCards, effect[]}, text: {fail,
bonus?, flavor?}}`. Scoring is the rule in `10` (R p12): +1 per contributed card with a prevent symbol, −1
otherwise, prevented at ≥ non-exiled seats, bonus at ≥ seats + `extraCards`. `need` exists for a card that
prints a different formula; default `{perSeat: 1, plus: 0}` (all 20 base cards use it, `sources/crises-sources.md`).
Three base cards print an either/or pair of prevent symbols ("X/Y": Medicine or Tool, Tool or Fuel, Food or
Medicine); they are `prevent: ["medicine", "tool"]` and so on, since a card with either symbol scores +1 and the
array already means "any of these". No separate pair field exists.

### 3.6 Crossroads (`crossroads.json`)

`{survivor?, mature, coop?, trigger: {point, when}, options: [a, b], text: {vignette, trigger?, options:
{<id>: prose}}, voice?}`. `point` is an `action.*` window (FAQ 2.1.1); each option is `{id, effect[], requires?,
vote?}`; an option whose `requires` is false is impossible and the other is forced (R p12). The vignette is a new
scene of ours that lands on the same two choices.

### 3.7 Main objective (`main-objective.json`)

`{code: M01..M10, time: short|medium|long, sides: {normal: Side, hardcore: Side}, text: {story?, normal: {setup,
victory}, hardcore: {setup, victory}}}` with `Side = {morale, rounds, setup?: Effect[], counters?, complete,
triggers?: TriggerDef[], contributions?: [{symbol, counter, exiledMayContribute?}]}`. `counters.<name>.need` is an
int or `perSeat` (× `perSeatMultiplier`, resolved against the seats that started). `contributions` are the cards a
seat may play onto the objective (F 4.1.1); exiled seats may contribute (F 5.4.3). A card that changes the exile
rules (Kill Them) carries a trigger on the `seat.exiled` window; goals the condition tests cannot spell out (a
seat-count split, empty item decks, a food need counted over the live non-exiled seats, a compulsory Fuel card at
the start of the colony phase) use `{code:'objective.<slug>.<name>'}` nodes (`11` O2.10, V-20). The ten cards'
values are in `11` O2.9.

### 3.8 Secret, betrayal and exiled objectives (`secret-objective.json`)

`{type: secret|betrayal|exiled, code? (betrayal story S11–S20), requiresMain, betrayer? (exiled: {firstCondition}),
requiresOriginal? (exiled, unused by the base game), counters?, complete, triggers?, setup?, ai?: {lever}, text:
{goal, story?, betrayer? (exiled)}}`. `type` uses the same spelling as `ObjectiveDescriptor.kind` (`hooks.ts`) and
the id prefix, so `21 §9` copies it straight across; the frozen setup event `SecretObjectiveDealt.kind` spells
`type: secret` as `'standard'` (`21 §9`). `ai.lever` is the betrayer hint `40 §7.1` reads: `moraleZero`,
`hoard:<ItemSymbol>`, `killSurvivors`, `zombiesAtColony`, `exileOthers`, `starve` or `custom`; every betrayal record
carries one (V-10 warns when it is missing), other types may. `complete` is evaluated at game end with `seat` = the
holder (E.12).

A betrayal record's `complete` is an `{all:[...]}` node whose **first child is the printed condition 1** (morale 0
on every card read so far), because an exiled card swaps that child (V-21).

An exiled record carries the card's two printed branches (`11` O5.2, `sources/objectives-sources.md` §D):
`requiresMain` + `complete` are the **not-the-betrayer** branch, a self-contained replacement for the revealed and
removed original (6 of the 10 cards require the main objective, 4 do not); `betrayer.firstCondition` is the
**betrayer** branch, the node that replaces condition 1 of the holder's betrayal card, the rest of that card staying
as printed. `text.goal` is the not-the-betrayer prose and `text.betrayer` the betrayer prose. "Main objective
complete" as a node is `{code:'rule.objective.mainComplete'}` (`11` O7.6). `requiresOriginal` stays in the schema
for expansions but no base card sets it: every not-the-betrayer branch replaces the original outright.

### 3.9 Persona (`persona.json`)

Shape owned by `41 §6`: `{blurb, scalars: {generosity, risk, paranoia, trust, chattiness, bluffing,
voteThreshold, callThreshold}, voice?: {libraryVoiceId, direction}, portrait?: {file, direction}, lines:
{<eventKey>: [{text, voiced?}]}}`. Line keys are the `41 §3` bank (`crisis.revealed`, `vote.lean.yes`,
`search.found.fuel`, ...); slot fills in braces; a line is ≤ 90 characters. Scalars are in `[0,1]` except
`paranoia`, a multiplier in `[0.5, 1.6]` (`41 §2`, `40 §8.2`). Ids are `ps.<slug>` (§1), the spelling
`GameSetup.seats[].persona` carries. Personas are original characters (H.7) and never reuse survivor names.

## 4. DataBundle and the loader

```ts
// src/data/types.ts (shape-compatible with the engine placeholder in types.ts)
interface DataBundle {
  version: string                          // dataVersion stamped into GameState; bump on any mechanical change
  byId: Record<Id, DataRecord>             // every record, placeholders excluded
  records: { survivors, items, decks, locations, crises, crossroads, mainObjectives, secretObjectives, personas }
  slices: Record<string, Id[]>             // 'first' = G.7; createGame(setup.slice ?? 'all')
}
```

- `loadBundle(raw)` (`src/data/index.ts`) validates against `bundle.json`, runs the cross-record rules (§5),
  drops `placeholder` records, builds `byId` and returns the bundle; the engine registers it by `version`.
- A slice is a list of ids; loading `first` includes the records it names plus every record they reference
  (decks → items, survivors → their Crossroads card). The sim and `bench:ai` load `first` until M8.
- Descriptors are compiled per game by the engine from `byId` (`21 §9`), never stored in the bundle.
- The client renders card faces from the record (`name`, `symbol`, `text`), with optional `art`.

## 5. Validation rules (`tools/validate-data.ts`, `npm run validate:data`)

Schema errors stop the run; then the cross-record rules below. The verify agent (M2, M8) also runs the prose
checks. `warn` rows print and pass; `error` rows fail the build.

| Id | Rule | Severity |
|---|---|---|
| V-01 | every record validates against its kind's schema; `kind` matches the folder | error |
| V-02 | ids unique across kinds; prefix matches the kind; file name = slug | error |
| V-03 | every id reference resolves (`deck`, `cards[].item`, `crossroads`, `survivor`, `location`, `location` inside conditions and scopes, slice ids) | error |
| V-04 | `deck.size` = sum of counts; `deck.starter` = 25; each location deck = 20; exactly 7 decks | error |
| V-05 | `symbolOrder` lists exactly the symbols present in the location's deck, each once | error |
| V-06 | `colony` exists with 6 entrances and no deck; exactly 6 other locations numbered 1–6 once each | error |
| V-07 | base survivors: 30 records, influence values distinct | error (warn while the set is incomplete) |
| V-08 | survivor `ability.location` naming a location id resolves | error |
| V-09 | Crossroads: 2 options with distinct ids; `text.options` keys = option ids; `vote: true` ⇒ first effect is `vote`; `trigger.point` is `action.*`; a `survivor` reference ⇒ the trigger tests `survivorIs` or `atLocation` of that survivor (warn) | error / warn |
| V-10 | effect-tree rules of `21 §10` (op vs point, durations, counters, code names, `chosen` chooser, `killZombies`/`moveSurvivor` `value` words); a betrayal objective without `ai.lever` (the enum itself is schema-checked) | per row / warn |
| V-11 | `objectiveCounter`/`objectiveCounterAtLeast` counters declared on that objective side | error |
| V-12 | main objectives: both sides; `code` unique; `time` set | error |
| V-13 | secret objectives: 24 `secret`, 10 `betrayal`, 10 `exiled` when complete (warn below) | warn |
| V-14 | `status: verified` ⇒ every mechanical field (§6 list) has a cite without `(verify)` and no tag set is fan-only (`W`, `T`, `O` alone) | error |
| V-15 | `status: placeholder` records are not in any slice; `ability.unknown` ⇒ placeholder | error |
| V-16 | `sources` keys are dot paths that exist on the record | error |
| V-17 | prose fields non-empty for non-placeholder records; ≤ 600 chars; no sentence of 8+ words equal to a line in `docs/sources/**` (run locally only; the sources are gitignored) | error |
| V-18 | persona scalars in range (schema: `paranoia` 0.5–1.6, the rest [0,1]); ≥ 40 lines per persona across ≥ 12 keys (warn under) | warn |
| V-19 | `version` bumped when any non-text field changed since the last tag (`git diff`) | warn |
| V-20 | every `code` name exists in `CODE_HOOKS` and every hook has a golden test (`60`) | error |
| V-21 | betrayal records: `complete` is an `all` node with ≥ 2 children (condition 1 first); exiled records: `betrayer.firstCondition` present and `text.betrayer` non-empty; `betrayer` absent on every other type (schema) | error |

## 6. Per-value source convention (`docs/spec/sources/`)

Every record carries `sources`: a map from a **field path** to a **cite**. Field paths are dot paths into the
record (`stats.attack`, `ability`, `ability.effect[1]`, `sides.hardcore`, `options`, `spaces.survivors`,
`cards`). A cite on a parent covers its children unless a child has its own.

Cite grammar: `<TAG>[ ref](; <TAG>[ ref])*[ (verify)]`.

| Tag | Source | Example |
|---|---|---|
| `R` / `R*` | rulebook page (`*` = read from a garbled column) | `R p7`, `R* p9` |
| `F` | FAQ v1.1 section | `F 1.3.2` |
| `W` | fandom wiki page | `W` |
| `T` | TV Tropes | `T` |
| `O` | Order of Gamers summary | `O` |
| `C` / `S` | self-consistency (influence set, deck sums) | `C` |
| `B` | the handoff brief section | `B G.2` |
| `BGG` | BoardGameGeek thread or file | `BGG 1303776` |
| `PHOTO` | a card or board photo the owner supplied | `PHOTO police-station` |

Mechanical fields that must be cited before `verified`: survivors `stats.*`, `ability`; items `symbol`,
`class`, `food`, `outsiders`, `play`, `equipped`; decks `cards`; locations `spaces.*`, `symbolOrder`, `number`;
crises `prevent`, `fail`, `bonus`; Crossroads `trigger`, `options`, `mature`; objectives `sides.*` or
`complete`, `counters`, `requiresMain`; personas `scalars` (cite `B H.7`). The per-kind tables in
`sources/*-sources.md` stay the human-readable index; the record is the machine-readable truth and the verify
agent diffs the two.

## 7. Examples (validated with the dry run in `21 §12`)

```json
{
  "kind": "location", "id": "colony", "name": "Colony",
  "spaces": { "survivors": 24, "entrances": 6, "entranceSpaces": 3, "noise": 0 },
  "symbolOrder": [], "deck": null,
  "sources": { "spaces.entrances": "R p5", "spaces.noise": "R p5", "spaces.survivors": "R p5 diagram", "spaces.entranceSpaces": "R p5 diagram; PHOTO colony entrances 4-5" },
  "status": "draft"
}
```

```json
{
  "kind": "location", "id": "loc.police-station", "name": "Police Station", "number": 1,
  "spaces": { "survivors": 3, "entrances": 1, "entranceSpaces": 4, "noise": 4 },
  "symbolOrder": ["weapon", "fuel", "tool", "food", "survivor"],
  "deck": "deck.police-station",
  "sources": { "number": "PHOTO tln police-station; W", "spaces.noise": "R p5", "spaces.entrances": "R p5", "spaces.survivors": "PHOTO tln police-station", "spaces.entranceSpaces": "PHOTO tln police-station", "symbolOrder": "PHOTO tln police-station; BGG card-spread; S" },
  "status": "draft"
}
```

```json
{
  "kind": "secretObjective", "id": "obj.exiled.forgiveness", "name": "Forgiveness", "type": "exiled",
  "requiresMain": true,
  "complete": { "test": "handHasSymbol", "subject": "holder", "symbol": "food", "value": 5 },
  "betrayer": { "firstCondition": { "code": "rule.objective.mainComplete" } },
  "text": { "goal": "The colony pulls through and you are carrying five cans when it does.", "betrayer": "Your first demand is now simply that the colony pulls through." },
  "sources": { "complete": "PHOTO es-perdon; BGG ludopedia-51112", "betrayer": "PHOTO es-perdon; BGG ludopedia-51112", "requiresMain": "PHOTO es-perdon; BGG ludopedia-51112" },
  "status": "draft"
}
```

```json
{
  "kind": "deck", "id": "deck.starter", "name": "Starting items", "size": 25,
  "cards": [ { "item": "it.food-1", "count": 10 }, { "item": "it.medicine", "count": 5 }, { "item": "it.fuel", "count": 5 }, { "item": "it.junk", "count": 5 } ],
  "sources": { "cards": "W; S", "size": "R p2; R p6" },
  "status": "draft"
}
```

```json
{
  "kind": "persona", "id": "ps.quartermaster", "name": "Vera Lindqvist",
  "blurb": "Counts every tin twice and trusts a ledger more than a smile.",
  "scalars": { "generosity": 0.35, "risk": 0.30, "paranoia": 1.10, "trust": 0.50, "chattiness": 0.45, "bluffing": 0.15, "voteThreshold": 0.62, "callThreshold": 0.75 },
  "lines": {
    "crisis.revealed": [ { "text": "{n} cards short. Count your hands before you count on luck." } ],
    "request.decline": [ { "text": "I keep what the pantry needs. Ask me after the colony phase.", "voiced": true } ]
  },
  "sources": { "scalars": "B H.7" },
  "status": "draft"
}
```

## 8. Rulings taken here

- RULING: item copies | one item record per card face; deck records carry the copy counts; the engine creates `CardInstance`s from the deck lists at setup | Unsourced (engine convention)
- RULING: exiled objective and the original | an exiled record holds both printed branches: `requiresMain` + `complete` replace a non-betrayer's revealed original outright; `betrayer.firstCondition` replaces condition 1 of a betrayer's card, whose `complete` must therefore be an `all` node with condition 1 first (V-21); `requiresOriginal` is kept but unused | Confirmed mechanics (all 10 cards read, `sources/objectives-sources.md` §D; `11` O7.2, O7.5), Unsourced shape
- RULING: Outsider cards | `symbol: survivor` records are `class: event` and leave the game when played | Fan-source (O; F 3.1.2 silent on the pile)
- RULING: placeholder records | records with `status: placeholder` validate and never load, so the schema can be exercised before the card pass | Unsourced (process)
- RULING: `verified` threshold | official text, a photo, or two independent fan sources with no `(verify)` | Unsourced (process)
