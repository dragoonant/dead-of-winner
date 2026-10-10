# 20. Data schema

The JSON content files the engine runs on: layout, ids, record shapes, the per-value source
convention and the validator rules. Record effects use the card-effects DSL (`21-card-effects-dsl.md`,
DRAFT). The JSON Schemas in `docs/spec/schemas/` are the machine form of this spec; where this text
and a schema disagree, fix both in the same commit.

**Source keys.** `C.n`, `E.n`, `G.n` = sections of the brief (`docs/DEAD-OF-WINTER-HANDOFF.md`);
`R pN` / `F x.y` = rulebook page / FAQ entry as cited by the brief; `10.x` / `11.x` = clauses of
specs 10 and 11. `Ruling` = see the end of this file. Web pages consulted for specs 20 and 21
(2026-10-10; no card lists found there, so item values stay placeholders):
https://www.ultraboardgames.com/dead-of-winter/game-rules.php (equip, hand-off, crisis scoring) and
https://www.orderofgamers.com/downloads/DeadofWinter_v1.2.pdf (fan summary; Outsider cards count as
items).

---

## 20.1 Principles

- 20.1.1 Content is data. Survivors, items, crises, Crossroads, objectives and location boards are
  JSON records; their behaviour is DSL (`21`) with `{"code": "<hook>"}` escape hatches. (C.3)
- 20.1.2 The engine never imports data. The client (or sim, or test) loads `src/data/`, builds a
  `DataBundle` (20.12) and passes it into `createGame`. (C.3)
- 20.1.3 Mechanics only in the structured fields. Display prose lives in `text` and is our own
  wording written from the one-line `mech` summary; never a paraphrase of the printed card. (IP rule;
  Part F)
- 20.1.4 Every value has a source (20.11). A value nobody has sourced yet is still entered, with
  `status: "placeholder"` and a source entry that says so. Placeholders never block work.
- 20.1.5 One record per distinct card design. Copies are a count (`copies`), never duplicate records.
- 20.1.6 All JSON files are UTF-8, LF, 2-space indent, records sorted by `id` (stable diffs).

## 20.2 File layout (C.2)

All content lives under `src/data/` (the brief's `data/`). Every content file is a **JSON array of
records** of one schema.

| Path | Schema | Records | First slice (G.7) |
|---|---|---|---|
| `src/data/core/locations.json` | `location.schema.json` | 7 (colony + 6) | all 7 |
| `src/data/survivors/survivors.json` | `survivor.schema.json` | 30 | 12 (G.1 rows 1–12) |
| `src/data/items/starting.json` | `card.schema.json` | sum of `copies` = 25 | all |
| `src/data/items/{police,grocery,school,gas,library,hospital}.json` | `card.schema.json` | sum of `copies` = 20 each | all 6 decks |
| `src/data/crisis/crises.json` | `crisis.schema.json` | 20 | 8 |
| `src/data/crossroads/<batch>.json` (`batch-01.json`, …) | `crossroads.schema.json` | 80 total | 20 (`batch-01`) |
| `src/data/objectives/main.json` | `objective.schema.json` (Main) | 20 (10 cards × 2 sides) | WNMS both sides |
| `src/data/objectives/secret.json` | `objective.schema.json` (Secret) | 24 | all 24 (placeholders allowed) |
| `src/data/objectives/betrayal.json` | `objective.schema.json` (Betrayal) | 10 | 3 |
| `src/data/objectives/exiled.json` | `objective.schema.json` (Exiled) | 10 | 1 generic or 10 (11 §7.4) |
| `src/data/personas/*.json` | `persona.json` (owned by spec 41) | 4–6 | per spec 41 |
| `src/data/index.ts` | n/a | builds `DataBundle` | |
| `public/assets/asset-manifest.json` | `asset-manifest.schema.json` (20.15) | 1 per runtime asset | placeholders for every first-slice survivor and symbol |

- 20.2.1 The folder decides the schema; `tools/validate-data.ts` maps folder → schema with the
  table above. The asset manifest is the one file outside `src/data/`; the validator maps it by its
  exact path. It is not part of the `DataBundle` (the engine never sees asset ids).
- 20.2.2 Path aliases in earlier specs: spec 10.2.5 `data/board.json` = `src/data/core/locations.json`;
  spec 11 §1.1 and spec 41 `content/...` = `src/data/...`. (Ruling D-PATHS)
- 20.2.3 Content batches (M8) add records to these files or add `crossroads/batch-NN.json` files;
  parallel batches in worktrees merge by keeping both sides (CLAUDE.md).
- 20.2.4 Sources live next to the specs: `docs/spec/sources/<x>-sources.md` with
  `x ∈ {survivors, items, locations, crises, crossroads, objectives}`; format in
  `docs/spec/sources/README.md`.

## 20.3 Ids

- 20.3.1 Format `<prefix>.<slug>[.<suffix>]`, slug = lowercase ASCII kebab-case of the card name
  (diacritics stripped, apostrophes dropped, `&` → `and`). Ids are permanent once committed; a rename
  keeps the id.
- 20.3.2 Prefixes: `survivor.`, `item.<deck>.`, `crisis.`, `xr.`, `main.`, `secret.`, `betrayal.`,
  `exiled.`. Hardcore sides append `.hardcore` (`main.we-need-more-samples.hardcore`), with
  `pairId` = the normal side's id. (11 §1.1)
- 20.3.3 Item ids carry their deck: `item.police.shotgun`. The same design in two decks = two
  records sharing `design` (art key), each with its own `copies`.
- 20.3.4 Location ids are bare: `colony, police, grocery, school, gas, library, hospital`
  (spec 10.2.1). They are DSL literals (`LocationId`).
- 20.3.5 Ability ids are local kebab slugs, unique within their record; the engine's global ability
  key is `<recordId>#<abilityId>` (used for once-per-round tracking, logs and events).
- 20.3.6 Ids are unique across the whole bundle (validator DATA-001).
- 20.3.7 Runtime instance ids (a specific card copy, a survivor in play) are engine-generated
  (`<recordId>@<n>`), never stored in data.

## 20.4 Common record fields

Every content record has:

| Field | Type | Rule |
|---|---|---|
| `id` | string | 20.3 |
| `name` | string ≤ 40–50 | the card name (Mallet posture: may match the original) |
| `mech` | string ≤ 200–300 | one-line mechanical summary, terse, our words; the input for `text` |
| `text` | string or object | display prose, our words, written from `mech` |
| `status` | `verified` \| `partial` \| `placeholder` | `verified`: every value sourced Confirmed/Corrected; `partial`: some values Fan-source/Unsourced; `placeholder`: invented to keep work moving |
| `src` | SrcMap | 20.11 |
| `notes` | string, optional | data-entry notes; never shown in UI |

Ability records (inside survivors, items, objectives) carry `id`, `timing`, `mech` and DSL fields
(spec 21 §21.3).

## 20.5 Locations (`location.schema.json`; 10.2; E.2; G.2)

- 20.5.1 Colony record: `{id:"colony", kind:"colony", name, survivorSpaces, entrances:[{n:1..6,
  spaces}] × 6, moraleMax, roundMax, wasteMoraleStep?:10, status, src}`.
- 20.5.2 Non-colony record: `{id, kind:"location", name, order:1..6, survivorSpaces, entranceSpaces,
  noiseSpaces:4, symbolRow:[Symbol], deckSize:20, status, src}`.
- 20.5.3 `order` is the Add Zombies / noise resolution order (10.2.1, 10.8.6). Validator: orders
  are 1..6, unique.
- 20.5.4 `symbolRow` is display only: the deck's symbol-likelihood strip, left to right. The engine
  never reads it for rules.
- 20.5.5 Deck composition is derived, not stored: the item records with `deck == id`, summed by
  `copies`, must equal `deckSize` (DATA-010).
- 20.5.6 Placeholder space counts (until photos are sourced) are spec 10.2.5's values; `moraleMax`
  10, `roundMax` 10 (Ruling D-TRACKS).

## 20.6 Survivors (`survivor.schema.json`; E.9; G.1)

- 20.6.1 `{id, name, profession, influence, attack, search, abilities:[Ability] (0–3), tags?, mech,
  text, status, src}`.
- 20.6.2 `attack` and `search` store N for "N+" (1–6). `influence` 1–99, unique across all 30
  (DATA-004; 10.9.1).
- 20.6.3 `tags`: `animal` (Sparky), `child`, `outsiderOnly` (cannot be drawn from the survivor deck at
  setup; added only by its Outsider card). Rules effects of tags live in DSL or code hooks; a tag
  alone does nothing (Ruling D-TAGS).
- 20.6.4 Ability conventions: `(N+)` → `cost: {die: {min: N}}`; "once per round" → `limit:
  "oncePerRound"`; "Location name:" prefix → `where: "<locationId>"`; "Anywhere" → no `where`.
  `(4)` on Loretta Clay is entered as `{min: 4}` (10.5.7; F 1.2.1).
- 20.6.5 `text` is the ability prose shown on our card face (≤ 240 chars). Persona lines and
  biographies live in spec 41's persona files, not here.

## 20.7 Items and starting deck (`card.schema.json`; E.1; E.6; G.2)

- 20.7.1 `{id, name, deck, copies, symbol, equip, outsider, design?, abilities:[Ability] (1–3), mech,
  text, status, src}`.
- 20.7.2 `deck`: `starting` or a location id. `copies`: copies of this design in that deck.
  Starting deck sums to 25 (DATA-011).
- 20.7.3 `symbol` ∈ `weapon, fuel, education, food, medicine, tool, survivor, none` (10.1.18).
  `none` is for cards with no crisis symbol (junk-type cards; Ruling D-NONE). A crisis contribution
  scores +1 iff `symbol == crisis.prevent` (10.4.14).
- 20.7.4 `equip: true` → playing the card attaches it to a survivor (10.6.1); its `action` and
  `passive` abilities have `self` = the survivor it is equipped to.
- 20.7.5 `outsider: true` ⇒ `symbol: "survivor"` (schema-enforced). Outsider cards count as item
  cards for secret-objective hand counts (11 §4.3). Never in the starting deck (schema-enforced).
- 20.7.6 Non-equip cards have exactly one `play` ability (the card's effect); after it resolves the
  card goes to the waste pile (exiled: out of the game) (10.6.1; 10.11.4). Validator DATA-012.
- 20.7.7 Food cards: `play` ability `{food: N}`. The exiled food rule (10.11.4, Ruling R-EXILEFOOD)
  is applied by the engine to any `food` op played by an exiled seat; the data never encodes it.
- 20.7.8 A card that adds a survivor or helpless token carries a `requires` that checks for a free
  space (10.6.1, 10.9.2); the engine also enforces it (belt and braces).

## 20.8 Crises (`crisis.schema.json`; E.4.3; G.5)

- 20.8.1 `{id, name, prevent, onReveal?, fail, overPrevent?, mech, text, status, src}`.
- 20.8.2 `prevent`: one symbol (not `survivor`, not `none`) (10.1.8).
- 20.8.3 `fail`: Effect resolved when `total < players` (10.4.15).
- 20.8.4 `overPrevent`: replaces the default `{morale: 1}` when `total ≥ players + 2`. Omit for the
  default (Blizzard and Fuel Shortage use the default; G.5 "optional +2 cards for +1 morale").
- 20.8.5 `onReveal`: Effect resolved when the card is revealed at round start (10.4.1); none in the
  first slice.

## 20.9 Crossroads (`crossroads.schema.json`; E.10; G.6)

- 20.9.1 `{id, name, mature, trigger:{at, when}, options:[{id, mech, requires?, effect}] (1–3), mech,
  text:{vignette, options:{a, b}}, status, src}`.
- 20.9.2 `trigger.at`: `afterAction` (evaluated after each resolved action, 10.10.3) or `turnStart`
  (evaluated once, right after the draw and frostbite step, 10.4.4). `when` is a DSL Condition over the
  resolved-action context (spec 21 §21.6).
- 20.9.3 `options`: usually `a` and `b`. An option whose `requires` fails is unavailable
  (10.10.4); single-option cards resolve without a choice.
- 20.9.4 `mature: true` cards are removed by `excludeMature` (10.3.4).
- 20.9.5 `text.vignette` is our own short scene (≤ 600 chars), written from `mech`; never a
  paraphrase of the printed story. `text.options` keys match option ids.

## 20.10 Objectives (`objective.schema.json`; spec 11; G.3; G.4)

- 20.10.1 Main (one record per side): `{id, kind:"main", side, pairId, name, time, setup:{morale,
  rounds, food?, helpless?, zombies?:{colony?, eachNonColony?, perLocation?}, effect?}, progress?:
  {<counter>:{initial, label?}}, hooks?:[Ability(trigger)], complete:Condition, target?:Num, coop?,
  mech, text, status, src}`. `target` is the number the UI shows beside the progress counter
  (11 §1.3).
- 20.10.2 Secret: `{id, kind:"secret", isBetrayal:false, requiresMain, condition, …}`. The engine
  evaluates `requiresMain ? mainObjectiveComplete ∧ condition : condition` at game end (11 §4.1, §6).
- 20.10.3 Betrayal: `{id, kind:"betrayal", isBetrayal:true, condition, hooks?, progress?, …}`.
  `condition` usually includes `{gameEndedBy: "morale"}` (11 §5.1).
- 20.10.4 Exiled: `{id, kind:"exiled", appliesToBetrayal:false, condition, …}`; `condition` may use
  `{original: true}` / `{originalPrivate: true}` (11 §7.2).
- 20.10.5 Hand-count predicates (`handCount`) count Outsider cards as items by default (11 §4.3).

## 20.11 Per-value source convention

- 20.11.1 Every record has `src: SrcMap`, an object from **field path** to **source ref**:
  `{"*": "survivors#daniel-smith", "attack": "survivors#unverified-stats"}`.
  - `"*"` (required) covers every field not listed.
  - A field path is a `/`-joined path into the record (`attack`, `setup/morale`, `abilities/0`,
    `options/1/effect`). The most specific path wins.
- 20.11.2 A source ref is `<x>#<entry>` and resolves to the heading `### <entry>` in
  `docs/spec/sources/<x>-sources.md` (format: `docs/spec/sources/README.md`).
- 20.11.3 Each source entry states a status word (`Confirmed`, `Corrected`, `Fan-source`,
  `Unsourced`, `Placeholder`), the references (R pN, F x.y, URLs with read date), and the values it
  backs. A record's `status` must be consistent with its entries (DATA-021).
- 20.11.4 Shared entries are allowed and expected: `survivors#unverified-stats`,
  `items#placeholder-basic`, `locations#placeholder-spaces`.
- 20.11.5 Never copy card prose into a source entry. Record values and a one-line mechanical summary
  in our words (IP rule).

## 20.12 DataBundle and loading

- 20.12.1 `src/data/index.ts` exports `loadBundle(): DataBundle` with
  `{version, hash, locations, survivors, items, crises, crossroads, objectives, personas}`; arrays are
  sorted by id; `hash` is a stable hash of the canonical JSON (saves and replays record it; a replay
  with a different hash warns).
- 20.12.2 The engine indexes the bundle once (`Map<id, record>`) and stores only ids in `GameState`.
- 20.12.3 Test fixtures may pass a reduced bundle (subset of records) as long as it validates.

## 20.13 Validator rules (`npm run validate:data` → `tools/validate-data.ts`)

Ajv 2020 (`ajv/dist/2020`), all schemas added by `$id`, options `{strict: true, strictRequired: false,
allowUnionTypes: true, allErrors: true}`. Each check below is a test ID for `tests/data/`.

| ID | Rule |
|---|---|
| DATA-001 | Every file validates against its folder's schema; ids are unique across the bundle. |
| DATA-002 | Every DSL `named` / ContentId reference resolves to a record of the right prefix. |
| DATA-003 | Every `code` hook name exists in `src/engine/code-hooks.ts`'s registry, and every registered hook is used by some record. |
| DATA-004 | Survivor influence values are unique. |
| DATA-005 | Every `{ref: name}` is bound earlier in the same effect tree (`choose.as`, `forEach.as`, `reveal.as`, `rollD6.as`). |
| DATA-006 | `limit` appears only on `action`, `passive` and `trigger` abilities. |
| DATA-007 | DSL trigger events (21.5.2): `DSL_EVENT_NAMES` (types.ts), `effect.schema.json` `$defs.EventName` and the 21.5 table list the same names; each has a `DSL_EVENT_MAP` entry (events.ts) whose value is an `EngineEvent` type and equals the 21.5 "events.ts type" column. |
| DATA-010 | Per location, item `copies` sum to `deckSize` (20). |
| DATA-011 | Starting-deck `copies` sum to 25. |
| DATA-012 | Non-equip items have exactly one `play` ability; equip items have none. |
| DATA-013 | Location `order` values are 1..6 and unique; exactly one colony record. |
| DATA-014 | Main objectives come in pairs: each normal side has a hardcore side with `pairId`. |
| DATA-015 | Counts per kind match E.1 when the bundle is marked `complete` (first slice: G.7 counts). |
| DATA-016 | Crossroads `text.options` keys equal the option ids. |
| DATA-020 | Every `src` ref resolves to an existing entry heading. |
| DATA-021 | `status: verified` records only cite entries with status Confirmed or Corrected; any Placeholder entry forces `status: placeholder`. |
| DATA-022 | Report (warning, not error): counts of placeholder / partial records per file. |
| DATA-040 | `public/assets/asset-manifest.json` validates against `asset-manifest.schema.json` (20.15.3); ids are unique and sorted. |
| DATA-041 | Every survivor record id has a manifest entry of kind `figure`; every symbol except `none` has `icon.<symbol>` (kind `icon`); every location id has `location.<id>` (20.15.4). Placeholder entries satisfy this. |
| DATA-042 | Every manifest `path` exists under `public/assets/` unless `status` is `placeholder`; every `concept` exists on disk when given. |
| DATA-043 | No manifest id appears in `tools/audio-manifest.json` (30.8.4); skipped while that file does not exist. |
| DATA-030 | `text` is not identical to `mech` and contains no string from `docs/spec/sources/denylist.txt` (optional, gitignored list of original card sentences kept locally for an IP smoke check). |

## 20.14 First-slice content manifest (G.7)

- 7 locations; 6 real 20-card decks + 25 starting items (all sourced or placeholder by type).
- 12 survivors: Alexis Grey, Daniel Smith, Thomas Heart, Gabriel Diaz, Olivia Brown, Ashley Ross,
  Mike Cho, Carla Thompson, Forest Plum, Sparky, Sophie Robinson, Brian Lee.
- Main: *We Need More Samples*, both sides. 24 secret, 3 betrayal, exiled per 11 §7.4.
- 8 crises including Blizzard and Fuel Shortage; 20 Crossroads including Hunted.
- The M2 dry run (spec 21 §21.12) encodes all of it before the DSL freezes.

## 20.15 Asset manifest (`asset-manifest.schema.json`; spec 30 §30.8)

- 20.15.1 Ownership: this spec owns the schema and the validator checks; spec 30 owns the content
  (which assets exist, their pipelines and status). Art agents edit `public/assets/asset-manifest.json`;
  data agents never do.
- 20.15.2 The file is a JSON array of entries sorted by `id` (20.1.6). Entry:
  `{id, kind, path?, fallback?, tris?, scale?, heightIn?, concept?, pipeline, status, batch?, notes?}`
  with the enums of 30.8.2. `path` is relative to `public/assets/`; `concept` is repo-relative
  under `art/`.
- 20.15.3 Schema-enforced: `path` is required unless `status` is `placeholder`; `fallback` is required
  for kinds `figure`, `zombie`, `prop`, `board`, `location`; `tris` ≤ 7000 for `figure`, `zombie`,
  `prop`; `path` never starts with `/`, never contains `..` and never starts with `docs/`.
- 20.15.4 Asset ids for content are derived, never stored in data (Ruling D-ARTID): a survivor's
  figure is the entry whose `id` equals the survivor record id (`survivor.forest-plum`, kind
  `figure`; the card portrait renders from it or its `concept`, 30.7.3); a symbol icon is
  `icon.<symbol>` for every symbol in 20.7.3 except `none`; a location card or board is
  `location.<locationId>` (`location.colony` for the colony board). No content schema has an `art`
  field.
- 20.15.5 Ids are unique in the manifest and never collide with `tools/audio-manifest.json` ids
  (30.8.4).

---

## Rulings

RULING: D-PATHS content root | All content under `src/data/` (brief C.2); spec 10 `data/board.json` and spec 11/41 `content/` are aliases to be aligned | Brief C.2 layout is the source of truth; Unsourced (project decision)
RULING: D-TRACKS morale and round track maxima | Placeholder moraleMax 10, roundMax 10 in the colony record | Unsourced; verify from a board photo into locations-sources.md
RULING: D-NONE cards without a crisis symbol | Symbol `none`; they always score −1 if contributed | Unsourced (fan memory of junk-type cards); verify against location deck lists
RULING: D-TAGS survivor tags | Tags are inert labels; any rules effect (e.g. an animal that cannot equip) is DSL or a hook on that survivor | Unsourced; keeps one mechanism per concept
RULING: D-OUTSIDER-COUNT Outsider cards in hand counts | Counted as items by default (`handCount.outsiderCountsAsItem` defaults true) | Fan-source ([W2] in spec 11)
RULING: D-BLIZZARD-SYMBOL Blizzard prevent symbol | Entered as `fuel` with status partial | Unsourced; the brief gives the failure effect (R p4, p12) but not the symbol
RULING: D-ARTID art references | Asset ids are derived from record ids (`<recordId>`, `icon.<symbol>`, `location.<id>`); survivor/card records carry no `art` field, so `survivor.schema.json` and types.ts stay unchanged; spec 30.8.3 "survivor `art`" reads as "the survivor's derived asset id" | Unsourced (engineering); one id per concept, no frozen-contract change, procedural fallbacks keep placeholders playable
