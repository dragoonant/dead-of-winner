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
- Tip: `?tier=random` plays against random bots, for comparison.

## 2. Card photos (only if you have the physical game)

Lay cards in a grid of about 9 per photo and drop them in `docs/sources/photos/` (gitignored, never published).
Most cards are now resolved from English photos found online. Still unknown:

- [ ] **Hoarder and Neat Freak** (standard secret objectives): no readable text. Both stay out of the deck.
- [ ] **Leave It All Behind**: the hidden part of the victory text (the weapon rule is kept from the earlier fan
      record) and its hardcore side.
- [ ] **Crisis names**: nine cards still use our own names: Despair, Empty Pantry, Endless Hordes, Killer Instinct,
      Legions of Death, No Waste, Reorganization, Sickness and We Are Being Watched (a photo shows a title ending
      "...hing Us"). Hailstorm and Food Spoilage have official names but blurred effect text. No Waste: which way do
      the Food cards move?
- [ ] **4 fan-sheet objectives** to confirm against a real card: Hope, Justice, All for One, Runaway.
- [ ] **Thomas Heart's die requirement**: the Spanish scan reads "(5-)", we implemented 5+ as you specified.

## 3. Rules rulings to skim (optional, one sitting)

`docs/needs-rules-check.md` holds 196 `RULING:` lines; `docs/rulings-resolution.md` checked them against the
rulebooks, FAQ and the designer rulings digest. Of the 101 that were unsourced or fan-sourced, 15 are now confirmed
by an official source and 14 were corrected (the engine now follows the corrected ones). **72 are still open**: about
30 are fan-sourced card data, about 17 are engine or AI design conventions with no rules content, and the rest are
genuine gaps in the rulebook. Skim those and correct any your copy or table experience contradicts.

## 4. Decisions for the next push

- [ ] **Remaining 60 Crossroads cards.** All are transcribed; each needs an original vignette and some need new
      engine hooks. Estimate 300-500k tokens with one Sonnet agent. Do now, or batch with playtest fixes?
- [ ] **Art (3D figures).** 30 survivors plus zombies through the Gemini + Hunyuan pipeline. This needs Claude in
      Chrome connected on this Windows PC (only the Mac's Chrome is connected right now). Start after the playtest?
- [ ] **Audio.** ElevenLabs sound effects, narrator, persona voices, first 20 voiced Crossroads, music (confirm
      before more than about 5k credits on music). Start after art, or alongside?
- [ ] **AI depth.** The bots are the slim version: one Normal tier, 3 personas with about 20 lines each. The full
      spec adds Easy and Hard tiers, 6 personas with about 60 lines each, and a deeper suspicion model. Wanted
      before art, after, or later?
- [ ] **Variants.** Co-op, two-player, hardcore objective sides, betrayer variant, player elimination, mature-card
      toggle. The engine supports the flags; the start screen exposes only some. Priority?
- [ ] **Token budget per push.** This push used about 1.8M of the 2.5M ceiling. Same ceiling next time?

## 5. Known weaknesses I will fix without being asked

- Bots win We Need More Samples about 24-30% of the time (target 35%), and about half of all crises still fail.
- Leave It All Behind, Stockpile and Winter Has Come have never been completed by bots.
- Some prompts (Crossroads choice, exile placement, keep-which-card after a search) have not been exercised by the
  automated browser test yet.
- Placeholder figures, no sound, no snow effect.
