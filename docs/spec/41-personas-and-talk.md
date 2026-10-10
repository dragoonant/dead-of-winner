# 41: Personas and table talk

A persona is the *player* in a bot seat, not a survivor: it keeps its name, voice and habits when its leader dies
(H.7). Personas are original characters with original names; they never reuse a real survivor's name (Part F).
`40-ai` consumes the scalars (§1–§2) and emits `TalkIntent`s (40 §11); this file owns the sheets, the line-bank
keys (§3), the frequency caps (§4), the hidden-state rule (§5) and the data shape (§6). All line text is ours, in our
own words, never copied from any card, rulebook or wiki (Part F); a verify agent checks every bank (§5.3).

## 1. The six first personas

| id | Name | generosity | risk | paranoia | trust | chattiness | bluffing | θ_vote | θ_call |
|---|---|---|---|---|---|---|---|---|---|
| `quartermaster` | Vera Lindqvist | 0.35 | 0.30 | 1.10 | 0.50 | 0.45 | 0.15 | 0.62 | 0.75 |
| `optimist` | Teddy Marchbanks | 0.85 | 0.55 | 0.60 | 0.90 | 0.90 | 0.05 | 0.78 | 0.90 |
| `hardcase` | Ruth Castellano | 0.30 | 0.65 | 1.45 | 0.35 | 0.60 | 0.30 | 0.48 | 0.58 |
| `kid` | Jojo Pruitt | 0.60 | 0.90 | 0.90 | 0.70 | 0.95 | 0.40 | 0.68 | 0.80 |
| `doctor` | Dr. Anand Rao | 0.50 | 0.25 | 1.00 | 0.60 | 0.30 | 0.10 | 0.65 | 0.78 |
| `drifter` | Silas Crane | 0.15 | 0.50 | 1.25 | 0.30 | 0.25 | 0.55 | 0.72 | 0.92 |

### 1.1 Sheets

| Persona | Plays like | Voice direction (one ElevenLabs library voice each, D.4) | Portrait direction (ours; D.1 look) |
|---|---|---|---|
| **Vera Lindqvist**, the Quartermaster | counts food every turn, barricades early, contributes exactly the shortfall, asks "who ate that?"; moves survivors only for a sure search | woman, 50s, low and even, Scandinavian-tinged English, clipped sentences, no warmth wasted | grey-blonde braid under a wool cap, a ledger and pencil stub, quilted parka with pockets full, steady eyes; cold blue-grey light |
| **Teddy Marchbanks**, the Optimist | gives when asked, searches hopefully, backs every plan, slow to accuse and quick to forgive; votes yes only when the evidence is loud | man, 30s, warm tenor, quick and bright, laughs on the exhale, Midwestern | round face, red beard, a thrift-store ski jacket two sizes too big, a thermos; a half-smile that has not given up |
| **Ruth Castellano**, the Hard Case | kills zombies first, barricades the gate, states a lean before anyone asks, calls votes early and means them | woman, 40s, gravel alto, flat and blunt, Northeastern, short words, never raises her voice | cropped dark hair, a scar through one eyebrow, surplus army coat, fingerless gloves, a tire iron across her knees |
| **Jojo Pruitt**, the Kid | rolls for the big search, makes noise, moves without counting, changes leans mid-vote, talks constantly; brave with other people's survivors too | teenage, high and fast, cracks on the loud lines, Southern, words tumbling | 16, hoodie under a puffer vest, a scavenged bike helmet, a slingshot, chapped cheeks; always looking past the camera |
| **Dr. Anand Rao**, the Doctor | works the objective, hoards medicine for wounds, moves only with a plan, rarely speaks and then precisely; votes on evidence, not noise | man, 60s, soft baritone, measured, Indian-British, pauses before numbers | silver hair, round glasses taped at one hinge, a surgical mask around the neck, a hospital fleece under a long coat |
| **Silas Crane**, the Drifter | keeps his cards, declines politely, searches alone at the far locations, almost never votes yes, says little and lies easily | man, 40s, dry near-whisper, slow Western drawl, every sentence ends early | lean, weather-burnt, a fur-lined hat with ear flaps, a long duster, a pack he never puts down; eyes on the door |

The Drifter and the Hard Case are the two personas a betrayer hides best behind (declines and early votes read as
character, not evidence), so the suspicion model never adds persona-based priors: only behaviour counts (40 §8).

## 2. Scalars

| Scalar | Range | Where it acts (40) | Effect |
|---|---|---|---|
| `generosity` | 0–1 | §3 hand weight, §6.2 contribution, §9.1 request target estimate, §9.2 answers | high: gives cheap cards, contributes one above the shortfall; low: keeps the hand, contributes the minimum |
| `risk` | 0–1 | §3 safety weight (`1 − 0.5·risk`), §2 `searchKeepOrNoise` | high: moves wounded survivors, makes noise for a better card; low: stays home, keeps the first decent card |
| `paranoia` | 0.5–1.6 | §8.3: multiplies every positive evidence Δ | high: suspects after one bad crisis; low: needs two |
| `trust` | 0–1 | §8.3: multiplies statement rows (`claim.*`, `accused`) | high: believes claims and accusations; low: ignores talk, counts cards |
| `chattiness` | 0–1 | §4: `P(speak)` per eligible event; §8.4 leans | high: a line almost every turn and a lean before every vote; low: mostly silent |
| `bluffing` | 0–1 | §6.3: `P(untruthful claim)`; §9.2 decline phrasing | high: claims more than it put in; the betrayer always claims matching cards regardless |
| `θ_vote`, `θ_call` | 0–1 | §8.4 | the suspicion needed to vote yes, and to call a vote |

Scalars are data (§6), so new personas are JSON plus a line bank, no code.

## 3. Line-bank event keys

Every key fires from a public event or a public decision outcome. `slots` are filled by the client from the bot's
`TalkIntent` (40 §11) with display names only. Slot vocabulary: `{seat}` another seat's display name, `{survivor}`
a survivor's name, `{location}` a location name, `{symbol}` one of the seven item symbols, `{n}` a number,
`{entrance}` 1–6, `{crisis}` the crisis card's name, `{objective}` the main objective's name.

| Key | Fires on | Slots | Class | Lines / persona |
|---|---|---|---|---|
| `round.start` | `RoundStarted` | `{n}` rounds left | ambient | 2 |
| `crisis.revealed` | `CrisisRevealed` | `{crisis}`, `{symbol}` (prevent symbols) | ambient | 3 |
| `crisis.contributed` | the bot's own `contributeCrisis` | `{n}`, `{symbol}` (a claim, §5) | claim | 3 |
| `crisis.prevented` | `CrisisResolved {prevented: true}` | `{n}` total | reaction | 2 |
| `crisis.bonus` | `CrisisResolved {bonus: true}` | — | reaction | 1 |
| `crisis.failed` | `CrisisResolved {prevented: false}` | `{n}` short | reaction | 3 |
| `crisis.shortfall` | after a failed crisis when `S(seat)` rose the most | `{seat}` (the suspected seat) | opinion | 2 |
| `vote.called.me` | `VoteCalled` against this bot | `{seat}` caller | reaction | 2 |
| `vote.called.other` | `VoteCalled` against another seat | `{seat}` target | reaction | 1 |
| `vote.lean.yes` | before `castVotes`, from 40 §8.4 | `{seat}` target | opinion | 2 |
| `vote.lean.no` | before `castVotes` | `{seat}` target | opinion | 2 |
| `vote.lean.silent` | before `castVotes` (shown as "…") | — | opinion | 1 |
| `vote.passed` / `vote.failed` | `VoteResult` | `{seat}` target | reaction | 1 + 1 |
| `exiled.me` | `SeatExiled` this bot | — | reaction | 2 |
| `exiled.other` | `SeatExiled` another seat | `{seat}` | reaction | 2 |
| `request.made` | the bot's own `request` | `{seat}` asked, `{symbol}` | social | 2 |
| `request.give` | `RequestAnswered {cardId ≠ null}` by this bot | `{seat}` | social | 2 |
| `request.decline` | `RequestAnswered {cardId: null}` by this bot | `{seat}` | social | 3 |
| `request.refused.me` | another seat declined this bot | `{seat}` | reaction | 2 |
| `search.found.<symbol>` | `SearchKept` by this bot (seven keys, `{symbol}` fixed per key) | `{location}` | action | 1 each (7) |
| `search.noise` | `makeNoise` by this bot | `{location}` | action | 1 |
| `move.out` | `SurvivorMoved {kind: 'action'}` leaving the colony | `{survivor}`, `{location}` | action | 1 |
| `zombie.killed` | `ZombieKilled` by this bot's survivor | `{location}` | action | 1 |
| `barricade.built` | `BarricadeAdded` by this bot | `{entrance}` | action | 1 |
| `exposure.wound` | `WoundTaken {source: 'exposure'}` on this bot's survivor | `{survivor}` | reaction | 1 |
| `exposure.bite` | `SurvivorKilled {cause: 'bite'}` on this bot's survivor | `{survivor}` | reaction | 2 |
| `bite.chain.kill` | `BiteChoiceMade {choice: 'kill'}` by this bot | `{survivor}` | reaction | 1 |
| `survivor.lost.other` | `SurvivorKilled` on another seat's survivor | `{seat}`, `{survivor}` | reaction | 1 |
| `overrun` | `EntranceOverrun` at the colony | `{entrance}` | reaction | 1 |
| `food.short` | `Starvation` | `{n}` morale lost | reaction | 2 |
| `morale.low` | `MoraleChanged` with `after ≤ 2` | `{n}` morale | reaction | 1 |
| `objective.progress` | `ObjectiveProgress {seat: null}` (main) | `{n}` have, `{n}` need | reaction | 1 |
| `crossroads.me` | `CrossroadsResolved {forSeat: me}` | — | reaction | 1 |
| `accused.me` | human accusation or a bot's `vote.lean.yes` naming this bot | `{seat}` accuser | reaction | 3 |
| `accused.other` | an accusation naming a third seat | `{seat}` accused | opinion | 1 |
| `game.won` / `game.lost` | `GameEnded` with this seat's `outcome` | — | end | 1 + 1 |
| `idle` | a turn with no line fired and `P(speak)` hit | — | ambient | 2 |

Total ≈ 62 lines per persona (D.4 budget: 60 ± 5). Betrayers draw from the same bank; there are no role-marked keys.

## 4. Frequency caps and selection

| Rule | Value |
|---|---|
| per bot per turn | ≤1 `ambient`/`action`/`social`/`claim` line, plus ≤1 `reaction` and ≤1 `opinion` |
| per event across the table | ≤2 bots speak to one event; the two with the highest `chattiness × relevance` (relevance 1.0 when the event names the bot or the human, 0.5 otherwise) |
| speak probability | `P = chattiness × relevance`; `vote.lean.*` and `accused.me` always fire (the human needs something to read, H.5); `crisis.contributed` fires with `P = chattiness` |
| repeat guard | a line is not reused until every other line under its key has played; a key is silent for 2 turns after firing unless it is `reaction` |
| global pace | ≤1 bubble every 2.5 s of presentation; queued lines older than one turn are dropped |
| voiced subset | per persona the `vote.lean.*`, `accused.me`, `exiled.*`, `crisis.failed`, `crisis.prevented`, `request.give/decline`, `game.*`, `exposure.bite` keys are generated (≈22 lines); the rest are text bubbles (D.4: 6 × 60 lines pre-generated once; the voiced set is the first batch to price) |
| display | a speech bubble on the seat portrait for 4 s and a feed row tagged with the persona name; the feed keeps them |
| mute | the settings panel has a table-talk volume and an "off" that keeps the leans in the feed (they carry game-relevant intent) |

## 5. Lines never reveal hidden state

| Rule | Detail |
|---|---|
| slot sources | only public values: seat display names, survivor names, location and symbol names, crisis and objective names, numbers the viewer's own `query.*` would show; the renderer rejects any slot id not in the public vocabulary |
| forbidden content | another seat's hand, any secret or exiled objective, any face-down contribution (the bot's own included: only the `crisis.contributed` **claim** may speak of it, and it is a claim), the held Crossroads card, deck orders, the bot's own role, the suspicion numbers themselves (a lean is yes/no/silent, never "73%") |
| no role tells | the betrayer uses the same bank and the same caps; no key, line or timing differs by role; a claim's truthfulness is set by `bluffing` and role in 40 §6.3, not by the text |
| no rules effect | talk changes nothing in the engine; it only feeds other bots' suspicion through the statement rows (40 §8.2) and informs the human |
| leak test | serialised `TalkIntent`s and rendered lines go through the same needle check as views (`hiddenIdsFor`, B.4) on every sim game |

### 5.3 Authoring and verification
Lines are written by the session model from the persona sheet (§1.1), one key at a time, in our own words, with no
card, rulebook or wiki phrasing. The verify agent (B.4) checks each bank for: copied or near-copied text against
`docs/sources/` (shingle overlap), slot names outside §3's vocabulary, lines that mention cards, objectives or roles,
lines over 90 characters (voice cost, D.4) and line counts per key against §3.

## 6. Data shape

`src/data/personas/<id>.json`, validated by `tools/validate-data.ts` against `docs/spec/schemas/persona.json`:

```
{ id, name, blurb,                       // blurb: one line for the seat picker, ours
  scalars: { generosity, risk, paranoia, trust, chattiness, bluffing, voteThreshold, callThreshold },
  voice: { libraryVoiceId, direction },  // direction: the §1.1 text, for the audition page
  portrait: { file, direction },         // our own portrait; direction: the §1.1 text, for the Gemini prompt
  lines: { "<key>": [ { text, voiced? } ] } }
```

- Voiced lines are mirrored into `tools/audio-manifest.json` as `{id: "voice.<persona>.<key>.<n>", kind: 'voice', text,
  voiceId}` so a regenerate is one command (D.4).
- `GameSetup.seats[].persona` names the id; the client's seat picker lists every persona with its blurb and portrait,
  and assigns the remaining bots distinct personas in sheet order.
- Later personas (M8) add a JSON file and a bank; no engine or AI code changes.
