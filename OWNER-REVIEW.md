# What I need from you (owner review list)

Written 2026-10-10. The game is live at https://dragoonant.github.io/dead-of-winner/ and plays end to end
against AI colonists. Nothing below blocks the build; each item makes the game more faithful or tells me what to
build next. Tick items off or reply inline.

## 1. Playtest (most important)

- [ ] Play three games at https://dragoonant.github.io/dead-of-winner/ (default table: you plus 3 Normal bots).
- [ ] Tell me whether the table feels alive: do the bots act sensibly, talk enough, vote for reasons you can follow?
- [ ] Tell me whether the betrayer is findable but not obvious. The recap screen at the end shows every hidden card.
- [ ] Note anything confusing in the prompts, panels or camera. Blunt and specific is best ("this prompt doesn't say
      what it's for").
- Tip: add `?seed=<any word>` to the URL to make a game repeatable, and include the seed in bug reports.
- Tip: `?tier=easy|normal|hard|random` sets every bot's difficulty (the start screen has it per bot).

## 2. Card data

The card data is complete. Every crisis, main objective (both faces), standard secret objective and survivor is verified
against clean scans of the real cards (Vassal module v1.1), and all 20 crisis names are official. Nothing is needed from
you here.

One small item is still unverified: the Vassal module censors the winning conditions on the betrayal objectives, so five
of the ten betrayal cards still rest on a fan sheet or a Spanish scan: Runaway, All for One, Trigger Happy, Cult Leader
and Serial Killers. A photo of those five real cards would close it (optional: the line counts and section numbers on the
scans already agree with our records, and the other five betrayal cards are verified from English photos).

## 3. Rules rulings to skim (optional, one sitting)

`docs/needs-rules-check.md` holds 196 `RULING:` lines; `docs/rulings-resolution.md` checked them against the
rulebooks, FAQ and the designer rulings digest. Of the 101 that were unsourced or fan-sourced, 15 are now confirmed
by an official source and 14 were corrected (the engine now follows the corrected ones). **72 are still open**: about
30 are fan-sourced card data, about 17 are engine or AI design conventions with no rules content, and the rest are
genuine gaps in the rulebook. Skim those and correct any your copy or table experience contradicts.

## 4. Decisions for the next push

- [ ] **Art (3D figures).** 30 survivors plus zombies through the Gemini + Hunyuan pipeline. This needs Claude in
      Chrome connected on this Windows PC (only the Mac's Chrome is connected right now). Start after the playtest?
- [ ] **Audio.** ElevenLabs sound effects, narrator, persona voices, first 20 voiced Crossroads, music (confirm
      before more than about 5k credits on music). Start after art, or alongside?
- [x] **AI depth.** Done (M4 complete): Easy, Normal, Hard and Random tiers, 6 personas with 63-71 own-words lines each (text-only, no
      new recordings), a log-odds suspicion model and the vote rules. Open question for you: the balance targets are only partly met
      (Normal ~26% against 30-40%, retargeted 2026-10-15 to the designer's 30% aim; betrayer wins ~9% against 25-40%, bots almost never exile anyone; details in STATUS.md, AI). Do you
      want me to keep pushing play strength, or is the current table good enough to playtest as it is?
- [ ] **Voice lines for the new personas.** Jojo Pruitt, Dr. Anand Rao and Silas Crane (and the 47 new lines of the first three) have no
      ElevenLabs recordings; the bubbles work without sound. About 330 short lines; confirm before spending credits.
- [x] **Variants.** Resolved in M7: the start screen now has co-op, two-player, hardcore objective side, betrayer
      variant, player elimination and a mature-Crossroads toggle (default ON, as in the original), with validation.
      Please try each once and tell me if any combination should be blocked or worded differently.
- [ ] **Token budget per push.** This push used about 1.8M of the 2.5M ceiling. Same ceiling next time?

## 5. Known weaknesses I will fix without being asked

- Bots win We Need More Samples about 26-30% of the time (target 35%), and about half of all crises still fail. The exposure die decides the game (STATUS.md, AI).
- Leave It All Behind, Stockpile and Winter Has Come have never been completed by bots.
- ~~Some prompts (Crossroads choice, exile placement, keep-which-card after a search) have not been exercised by the
  automated browser test yet.~~ Resolved in M7: the browser test now reaches the Crossroads choice and group vote,
  keep-which-card, a vote, exile placement and the exiled first player's tie-break ballot.
- ~~No snow effect.~~ Resolved in M7: snowfall, firelight, a frost vignette, hit flashes and a dice tumble, with a Low
  graphics switch. Placeholder figures remain.

## 6. Resolved in M7 (client polish)

- The exiled first player used to answer a vote tie with a silent "no". They now get a ballot of their own.
- Crossroads group votes showed the exile wording; they now show the card and its two answers.
- The feed is grouped by round and turn, with the crisis reveal, every exposure roll (with its odds), zombie placement
  and votes as breakdowns, and a header per colony-phase step.
- The recap tells each seat's story (objective met or not, betrayer, hidden crisis cards, Crossroads choices).
- Settings: seat colours including a colour-blind-safe set, the rails on [ and ], tutorial tips and a replay switch.
- Still open for you: the recap shows the table's suspicion of each seat only if the AI exposes it (it does not
  yet), and the start screen lists whatever tiers the AI exports (Easy, Normal, Hard, Random now). Please look at the
  colour-blind-safe palette if that matters to you, and at the flicker of the firelight (it is deliberately subtle).
