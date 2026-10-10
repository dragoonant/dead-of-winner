# Specs

Written in M0. Engine contracts in `src/engine/` are FROZEN: specs and code match them exactly; changes are additive
and logged in `00-architecture` §16. Rule ids `R<n>` live in `10`, test ids in `12`.

| Spec | What it fixes |
|---|---|
| `00-architecture.md` | Module boundaries, engine API, state shape, decision model, view (hidden information) contract, determinism |
| `10-rules-core.md` | Every base-game rule in our words, with rulebook and FAQ page refs |
| `11-objectives.md` | Main, secret, betrayal and exiled objectives: representation, progress, when each is checked |
| `12-rules-test-checklist.md` | Stable test ids, one line per case; coverage is measured against these |
| `13-golden-examples.md` | The six worked examples as machine-checkable scripts |
| `20-data-schema.md` | Content record shapes, `DataBundle`, validation rules, per-value source convention |
| `21-card-effects-dsl.md` | The declarative effect vocabulary used by items, crisis, Crossroads, objectives, abilities |
| `30-art.md` | Table, figures, board, icons and card faces; the game-side art contract |
| `40-ai.md` | AI colonists: the `Decider` for bot seats, suspicion, voting, requests |
| `41-personas-and-talk.md` | Persona sheets, line-bank keys, frequency caps, table talk |
| `50-client.md` | React/R3F client: views, prompts, formatting, no rules maths in the client |
| `60-testing.md` | Test layout, invariants, sim and bench gates |
| `sources/` | Where every card value came from and what is still missing: `README.md` (index, tags, gaps), `survivors-sources.md`, `items-sources.md`, `crises-sources.md`, `objectives-sources.md` (main, secret, betrayal, exiled), `locations-sources.md` (location cards and colony board); each ends in a conflict table |
| `schemas/*.json` | JSON Schemas (draft 2020-12) for each content record |

Rulings made where the sources are silent or disagree: `docs/needs-rules-check.md`.
