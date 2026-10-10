# 41. Personas and table talk

Who the bots are at the table and what they say. Decision maths is in `40-ai.md`; this spec gives
the knobs that feed it, the talk triggers, rate limits and line templates. Every line here and in
the line banks is our own writing; none is taken from any published card, rulebook or product.

**Source keys.** `H.n` / `C.n` / `D.n` = brief sections (`docs/DEAD-OF-WINTER-HANDOFF.md`).
`40.x` = `40-ai.md`. No web sources were used.

---

## 41.1 What a persona is (H.7)

- 41.1.1 A persona is the **player**, not a survivor. It keeps its name, portrait, voice and line
  bank when its leader or any survivor dies, and when exiled. Survivors are cards; personas are
  people at the table.
- 41.1.2 Personas are original characters. Their names never reuse a survivor name from the real
  game (checked against brief G.1; `validate:data` rejects a persona name equal to any survivor name
  in `src/data/survivors/survivors.json`, spec 20 §20.2).
- 41.1.3 Data: `src/data/personas/<id>.json` (file name = `id`), schema
  `docs/spec/schemas/persona.schema.json` (written by this spec; listed in spec 20 §20.2), validated
  by `tools/validate-data.ts`. Portraits and voice clips are assets under `public/assets/`, referenced
  by id through the asset manifest (20.15), never stored in the persona file:
  `{id, name, epithet, voiceId, portrait, knobs: {generosity, riskAppetite, paranoia, trust,
  chattiness, bluffing}, derived?: {...overrides of 41.3}, lines: {[trigger]: Line[]}}` with
  `Line = {id, text, slots?: string[], voiced: boolean, weight?: number, when?: Cond}`.
  `when` is a small filter: `{role?: 'loyal'|'betrayer', exiled?: boolean, minRound?: n,
  moraleAtMost?: n}`; role filters are allowed only on lines whose *content* is neutral (41.5.4).
- 41.1.4 `voiceId` points at an ElevenLabs library voice chosen in M6 (D.4); until then it is
  `"tbd"`. One distinct voice per persona. Portraits are our own art (D.1); placeholder initials
  until M5.

## 41.2 Knobs

All knobs are in [0, 1]. They feed `40-ai.md` through the formulas in 41.3.

| Knob | Meaning |
|---|---|
| generosity | willingness to give on requests and to contribute above the minimum |
| riskAppetite | tolerance of exposure rolls, noise and thin crisis margins |
| paranoia | how hard evidence moves suspicion (exponent in 40.5.2) |
| trust | how much other seats' claims count (40.5.3, 40.5.5) |
| chattiness | chance to speak on an optional trigger; chance to lean before a vote |
| bluffing | chance a betrayer makes a cover claim instead of staying silent (40.8.3) |

## 41.3 Derived parameters (formulas; per-persona `derived` may override)

| Parameter | Formula | Used in |
|---|---|---|
| voteThreshold θ | `0.55 − 0.25 · paranoia` | 40.6.1 |
| callThreshold θ_call | `θ + 0.10 − 0.10 · riskAppetite` | 40.6.4 |
| crisis targetP | `0.80 + 0.10 · (1 − riskAppetite)` | 40.4.3 |
| request give weight | `generosity` | 40.7.3 |
| search push-your-luck | `1.5 − riskAppetite` divisor | 40.3.7 |
| move threshold | stay unless the move's gain > `cost · (1.3 − 0.6 · riskAppetite)` | 40.3.10 |
| secret weight f8 | `0.6 · (0.6 + 0.8 · (1 − generosity))` (selfish → higher) | 40.2.3 |
| image weight f11 (loyal) | `0.2 · (1 − bluffing)` | 40.2.3 |
| talk base chance | `0.15 + 0.6 · chattiness` | 41.6 |

## 41.4 The six personas (H.7)

| id | Name | Epithet | gen | risk | para | trust | chat | bluff | Plays like |
|---|---|---|---|---|---|---|---|---|---|
| `quartermaster` | Marta Voss | the Quartermaster | 0.55 | 0.25 | 0.55 | 0.45 | 0.45 | 0.30 | counts food every round, barricades first, contributes to a safe margin, votes on arithmetic |
| `optimist` | Benny Alder | the Optimist | 0.85 | 0.55 | 0.20 | 0.85 | 0.85 | 0.25 | gives freely, believes claims, cheers every good roll, slow to vote yes |
| `hardcase` | Rook Mahoney | the Hard Case | 0.35 | 0.70 | 0.80 | 0.25 | 0.55 | 0.45 | kills zombies, blunt, calls votes early, holds grudges |
| `kid` | Pip Okafor | the Kid | 0.60 | 0.90 | 0.45 | 0.60 | 0.80 | 0.60 | moves and pushes searches, loud, swings between trust and blame |
| `doctor` | Ines Halloran | the Doctor | 0.50 | 0.35 | 0.50 | 0.50 | 0.25 | 0.20 | methodical, objective-minded, quiet, speaks up when the numbers are wrong |
| `drifter` | Cole Wren | the Drifter | 0.20 | 0.50 | 0.65 | 0.30 | 0.15 | 0.70 | keeps cards, declines often, rarely votes or leans |

- 41.4.1 **Behavioural signatures** (tie-breaks and preferences on top of the knobs):
  - Quartermaster: food token at round end ≥ next need is a hard soft-constraint (+0.5 MP bonus);
    plays food cards early; clean-waste before the waste crosses a multiple of 10.
  - Optimist: never calls a vote before round 3; claims its contributions every time (truthful when
    loyal); answers human requests first in tie-breaks.
  - Hard Case: +0.3 MP per zombie kill in planning; calls a vote the first time θ_call is crossed;
    reacts to accusations by accusing back.
  - Kid: +0.2 MP per search draw (curiosity); first-move bias toward the location with the most
    unknown cards; voices nearly every exposure result.
  - Doctor: +0.3 MP weight on survivor safety; heals before searching; prefers to speak after the
    crisis reveal with numbers.
  - Drifter: decline reason is usually `needIt`; leans only when `suspicion ≥ 0.7`; trades only with
    the seat it trusts most.
- 41.4.2 Default table (1 human + 3 bots): Quartermaster, Optimist, Hard Case. Setup can pick any
  persona per seat; no duplicates at one table.
- 41.4.3 Persona sheets (writing brief for the line banks, our words):
  - **Marta Voss**: former school cafeteria manager; dry, exact, keeps a mental ledger; humour as
    understatement; says numbers out loud.
  - **Benny Alder**: ran a hardware store; warm, talkative, believes in people; tends to apologise.
  - **Rook Mahoney**: long-haul trucker; short sentences, no small talk, suspicious of anyone who is
    comfortable.
  - **Pip Okafor**: nineteen, bike courier; fast, slangy, excitable, bored by waiting.
  - **Ines Halloran**: night-shift ER nurse practitioner; calm, clinical, few words, precise.
  - **Cole Wren**: arrived alone, says little about before; laconic, evasive, occasionally wry.

## 41.5 Talk events and claims (H.6)

- 41.5.1 A talk event is the frozen `TalkEntry` (`src/engine/decider.ts`), filled as:

  | `TalkEntry` field | Talk meaning |
  |---|---|
  | `seq` | log sequence number (monotonic per game) |
  | `round` | game round when spoken |
  | `seat` | the speaker's seat, or `'narrator'` |
  | `kind` | the trigger key (41.6.1), e.g. `'crisis.claim.matched'` |
  | `text` | the rendered line, slots filled |
  | `data` | `{turnSeat, lineId, slots: {name: value}, claim?: Claim, voiced: boolean}` |

  `Claim` is one of the 41.5.2 shapes. "TalkEvent" elsewhere in specs 40 and 41 means this
  `TalkEntry`. The talk log lives outside engine state (40.1.5), reaches bots only through
  `DecideContext.talk` on `decide()` and `Decider.observe()`, is public to every seat, appears in
  the feed and as a speech bubble on the speaker's portrait, and is saved with the game.
- 41.5.2 **Claims** are structured statements bots can reason about (40.5.3, 40.5.5):
  - `{kind:'contributed', crisis, count, matching}` (from `crisis.claim.*`)
  - `{kind:'declineReason', reason: 'needIt'|'dontHave'|'dontTrust'}`
  - `{kind:'lean', target, vote: 'yes'|'no'}`
  - `{kind:'accuse', target}`
  A line with a claim must express exactly the claim's content (validator: claim-bearing triggers
  only take lines whose slots include the claim fields).
- 41.5.3 Truthfulness: loyal bots' claims are true or absent; betrayers' claims follow 40.8.3. Public
  numbers in slots (`{n}`, `{morale}`, `{food}`) always come from the engine (40.11.6).
- 41.5.4 **Same bank for betrayers** (H.6). Line selection never depends on role, except `when.role`
  filters on lines whose wording is neutral (e.g. a sigh) for variety. No line hints at betrayal
  status; the verify agent checks this.
- 41.5.5 Determinism: line choice uses the bot's `ai/talk/<seat>` RNG (40.1.8), weighted by `weight`
  (default 1), excluding lines used by that persona in the last 3 rounds.

## 41.6 Triggers and rate limits (H.6)

- 41.6.1 **Trigger table.** `who`: S = the seat the event is about, O = any other bot, A = any bot.
  `kind`: R = required (always speaks, subject only to the queue cap), P = prompted (part of a
  decision flow; uses `chattiness` as written), O = optional (talk base chance 41.3 × `mult`).

  | Trigger | Event | who | kind | mult | prio |
  |---|---|---|---|---|---|
  | `game.won` / `game.lost` | `GameEnded`, per seat result | S | R | — | 1 |
  | `exiled.me` | this seat exiled | S | R | — | 2 |
  | `exiled.other` | another seat exiled | O | O | 1.0 | 3 |
  | `vote.called` | a bot calls a vote (caller speaks) | S | R | — | 3 |
  | `vote.target.me` | this seat is the vote target | S | R | — | 3 |
  | `vote.lean.yes` / `vote.lean.no` | before cast (40.6.5) | A | P | — | 3 |
  | `vote.result` | votes revealed | O | O | 0.5 | 4 |
  | `accused.me` | the human accused this seat | S | R | — | 3 |
  | `accused.other` | the human accused someone else | O | O | 0.7 | 4 |
  | `crisis.revealed` | crisis card revealed at round start | A | O | 0.4 | 6 |
  | `crisis.claim.*` | after this seat contributes (40.4.7) | S | P | — | 5 |
  | `crisis.prevented` / `crisis.bonus` / `crisis.failed` | crisis resolved | A | O | 1.0 | 4 |
  | `crisis.mismatch` | revealed off-symbol cards > own (EV-CRISIS fired) | A | O | 1.2 | 4 |
  | `request.ask` | this seat makes a request (prompt text for the human) | S | R | — | 5 |
  | `request.give` / `request.decline` | this seat answers | S | O | 1.0 | 5 |
  | `request.declined.me` | everyone declined my request | S | O | 0.8 | 6 |
  | `search.found.<symbol>` | this seat kept a card (symbol only if the seat would show it: food, fuel, medicine; else `search.found.any`) | S | O | 0.3 | 8 |
  | `search.noise` | this seat made noise | S | O | 0.4 | 8 |
  | `exposure.safe` / `exposure.wound` / `exposure.frostbite` | own exposure result | S | O | 0.2 / 0.5 / 0.5 | 7 |
  | `exposure.bite` | own survivor bitten | S | R | — | 4 |
  | `bite.chain.kill` | a survivor lost to a spreading bite | O | O | 0.8 | 5 |
  | `survivor.lost` | own survivor dies (other causes) | S | O | 0.8 | 5 |
  | `zombies.overrun` | overrun at a location | A | O | 0.6 | 5 |
  | `morale.low` | morale ≤ 2 after a change | A | O | 0.6 | 5 |
  | `food.short` | colony cannot pay next round (forecast) | A | O | 0.5 | 6 |
  | `objective.progress` | main objective counter moved (e.g. a sample) | A | O | 0.3 | 7 |
  | `crossroads.triggered` | Crossroads revealed (not the chooser) | O | O | 0.4 | 6 |
  | `turn.start` | own turn begins (idle chatter) | S | O | 0.15 | 9 |
  | `turn.end` | own turn ends with nothing said this turn | S | O | 0.1 | 9 |

- 41.6.2 **Rate limits.**
  1. Per bot: at most **1 optional (O) line per turn** (any seat's turn), plus prompted/required.
  2. Per event: at most **2 bots** react; pick by `prio`, then by `chattiness`, then RNG.
  3. Per bot per trigger: cooldown of 2 turns (except R and P triggers).
  4. Global queue: at most **3 lines pending**; on overflow drop the lowest-priority, oldest first.
     R lines are never dropped.
  5. No repeat of a line id per persona within 3 rounds (41.5.5).
  6. Bench metric M10 (40.13) checks mean ≤ 1.5 lines per bot per turn.
- 41.6.3 Bubble shows ~3.5 s (`max(2.5 s, 45 ms × chars)`); the feed keeps every line.
- 41.6.4 Line length: ≤ 70 characters (bubble fit), bank average ≤ 50 (voice budget, D.4).
- 41.6.5 **Accusation** (H.5): the human clicks a seat on the rail and picks *Accuse*. It is a talk
  event (`claim.kind = 'accuse'`), at most once per human turn per target; rules are unaffected.
  The accused bot always replies (`accused.me`); up to 2 others react; suspicion updates per EV-ACCUSE.

## 41.7 Pacing

- 41.7.1 Bot actions are shown with a presentation delay of 450–900 ms (RNG on the talk stream),
  plus the time of any line voiced on that action, capped at 2.5 s per action. `?test=1` sets 0.
- 41.7.2 A vote's leans play one after another before the human's vote prompt opens, so the human
  can read them (H.5).

## 41.8 Slots

`{me}` speaker name, `{seat}` / `{target}` / `{accuser}` persona or player name, `{survivor}`
survivor card name, `{loc}` location name, `{n}` count, `{matching}`, `{symbol}` item symbol name,
`{morale}`, `{food}`, `{round}`, `{need}` food needed. Missing slot value → that line is skipped.
Lines with no slots are voiced; lines with slots are text-only unless a slot-free variant exists
(D.4 budget).

## 41.9 Line templates (examples; our own words)

The full banks (~60 lines per persona, every trigger in 41.6.1 covered at least twice per persona)
are written in M4 by the session model from 41.4.3, then checked by a verify agent for copied text
and role hints (41.5.4). Examples below fix tone and slot use.

### 41.9.1 By trigger (mixed personas)

| Trigger | Persona | Line |
|---|---|---|
| `crisis.revealed` | quartermaster | "Right. That's {n} cards we owe it. Start looking." |
| `crisis.revealed` | kid | "Oh, come on. Again with this?" |
| `crisis.claim.allMatching` | optimist | "Put in {n}, all of them good ones. We've got this." |
| `crisis.claim.some` | doctor | "{n} in. {matching} of them fit." |
| `crisis.claim.none` | drifter | "Nothing to spare this time." |
| `crisis.prevented` | optimist | "See? Together! I knew it." |
| `crisis.bonus` | quartermaster | "Two over. That's what a margin looks like." |
| `crisis.failed` | hardcase | "Somebody's not pulling their weight." |
| `crisis.mismatch` | doctor | "{n} wrong cards in there. That's not an accident." |
| `crisis.mismatch` | quartermaster | "I count {n} that don't belong. Who wants to explain?" |
| `vote.called` | hardcase | "I'm done waiting. {target}, you're out." |
| `vote.target.me` | kid | "Me? I've been running my legs off for you lot!" |
| `vote.lean.yes` | doctor | "The numbers point at {target}. I'll vote yes." |
| `vote.lean.no` | optimist | "I just don't see it. Give {target} a chance." |
| `vote.result` | drifter | "Hm. So that's how it is." |
| `exiled.me` | hardcase | "Fine. I'll do better out there without you." |
| `exiled.other` | quartermaster | "One fewer mouth. I'll fix the food sums." |
| `accused.me` | drifter | "Say it louder. Still not true." |
| `accused.me` | optimist | "Ouch. I'm on your side, I swear." |
| `accused.other` | hardcase | "About time someone said it." |
| `request.ask` | kid | "Anyone got {symbol}? Hand it over, I'll use it now." |
| `request.give` | optimist | "Here, take it. Better with you than in my pocket." |
| `request.decline` (needIt) | drifter | "Need it myself." |
| `request.decline` (dontHave) | quartermaster | "I'd give it if I had it. I don't." |
| `request.decline` (dontTrust) | hardcase | "Not to you. Not today." |
| `request.declined.me` | kid | "Wow. Generous bunch, aren't you." |
| `search.found.food` | quartermaster | "Tins. Good. That's tomorrow sorted." |
| `search.found.any` | drifter | "Found something." |
| `search.noise` | kid | "One more drawer, what's the worst that—" |
| `exposure.safe` | kid | "Not a scratch!" |
| `exposure.wound` | doctor | "{survivor}'s cut. Manageable." |
| `exposure.frostbite` | hardcase | "Can't feel my fingers. Keep moving." |
| `exposure.bite` | doctor | "{survivor} is bitten. I'm sorry." |
| `bite.chain.kill` | optimist | "No, no, not {survivor} too." |
| `zombies.overrun` | hardcase | "{loc} just fell. Told you to barricade it." |
| `morale.low` | quartermaster | "Morale's at {morale}. One more bad night and we're finished." |
| `food.short` | quartermaster | "We need {need} food and we have {food}. Do the maths." |
| `objective.progress` | doctor | "Another sample. Keep them coming." |
| `crossroads.triggered` | kid | "Ooh, story time." |
| `turn.start` | drifter | "My go." |
| `game.won` | optimist | "We made it. All of us. Well, most of us." |
| `game.lost` | hardcase | "Should have trusted my gut." |

### 41.9.2 Voice samples per persona (tone reference for the bank writers)

- **Marta Voss (Quartermaster):** "Everyone eats tonight. Barely." / "I wrote that down." / "Two
  barricades before anyone goes shopping."
- **Benny Alder (Optimist):** "Honestly, I think we're doing great." / "Sorry, sorry, my fault." /
  "Bet the next search is a good one."
- **Rook Mahoney (Hard Case):** "Less talk." / "That's a lie and you know it." / "I'll take the
  front door."
- **Pip Okafor (Kid):** "Watch this." / "That was so close!" / "Can we go to the hospital now? Please?"
- **Ines Halloran (Doctor):** "Hold still." / "We've lost enough people." / "Count again."
- **Cole Wren (Drifter):** "Don't look at me." / "Maybe." / "Seen worse."

---

## Rulings

RULING: Persona names | Six original names (Marta Voss, Benny Alder, Rook Mahoney, Pip Okafor, Ines Halloran, Cole Wren); none matches a survivor in brief G.1; "Rook" kept from the brief's H.5 example | Unsourced: the full 30-survivor list is not yet sourced, so validate:data re-checks at data entry
RULING: Talk is outside engine state | Talk log is a client/sim side channel fed to bots; no rules effect | Confirmed by brief H.5 (accusation has no rules effect) and H.6; keeps the frozen engine contracts unchanged
RULING: Voiced subset | Slot-free lines are voiced; slotted lines are text-only unless a slot-free variant exists | Unsourced (brief D.4 says ~60 lines per persona pre-generated; H.6 says a subset is voiced)
RULING: Talk record shape | Talk events use the frozen TalkEntry: seat = speaker, kind = trigger, data = {turnSeat, lineId, slots, claim?, voiced}; delivered via DecideContext.talk and Decider.observe | Contract: src/engine/decider.ts (frozen M0); no rules effect
RULING: Persona data location | src/data/personas/<id>.json with schemas/persona.schema.json written by spec 41; assets stay under public/assets/ | Follows spec 20 §20.2 folder table
