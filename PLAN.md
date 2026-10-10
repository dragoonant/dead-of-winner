# Dead of Winner: plan

## Decisions

Settled by the owner on 2026-10-09 (do not re-ask):
- **Title and repo:** Dead of Winner, `dragoonant/dead-of-winner`, deployed to
  https://dragoonant.github.io/dead-of-winner/.
- **IP posture:** Mallet posture. Real survivor, card and objective names may be used; all prose is
  ours; no publisher art, icons or trade dress; our own portraits, figures and icons.
- **Figures:** full 3D. All 30 survivors through the Gemini concept plus Hunyuan pipeline, one GLB
  each, plus 3–4 zombie GLBs and a 3D colony board. Batches of about 8; finalize, wire, commit, push.
- **Voiced Crossroads:** text for all 80 cards, narrator voice for the first 20 (verify TTS pricing on
  the first batch). Extend only when the owner asks after hearing them.

Carried over from Mallet 42k and Whirr Machine:
- Mechanics are ported 1:1. All prose is in our own words.
- Player vs AI comes first; multiplayer comes later.
- The repo is public on GitHub Pages.
- Music via ElevenLabs Music; confirm before spending more than about 5k credits on it.

## First release (M3 slice, brief Part G.7)
- Four seats (1 human + 3 bots), main objective *We Need More Samples*.
- The 6 locations with real deck compositions, 12 survivors, 8 crisis cards, 20 Crossroads cards,
  the standard secret objectives and 3 betrayal objectives.
- Everything else lands in M8 batches.

## Milestones (brief Part I)

| Milestone | Scope | Gate |
|---|---|---|
| M0 Foundation | Scaffold, specs 00–60, frozen contracts, rules checklist, adversarial spec review | Owner: the four decisions (settled) |
| M1 Engine + sim | Decks, dice, actions, exposure, colony phase, zombies, exile, votes, Crossroads, objectives, ending; golden tests; leak test; `npm run sim` | sim green |
| M2 First content slice (verify ON) | G.7 data with per-value sources, original prose, schema validation | verify agent |
| M3 Playable vertical slice on Pages | 3D table, placeholder figures, hands, dice tray, self-explaining prompts, feed, seat rail, secret objective panel, recap; Random bots | Owner playtest |
| M4 AI colonists (verify ON) | Planner, dice knapsack, crisis contribution, suspicion, votes, requests, betrayer, tiers, `bench:ai` | Owner plays 3 games |
| M5 Art | 30 survivor GLBs, zombies, board, icons, card faces, title art | Owner |
| M6 Audio | SFX, narrator, persona voices, 20 voiced Crossroads, music | `sounds.html` |
| M7 Polish | Feed breakdowns, settings, Low graphics, recap story | Owner |
| M8 Full content (verify ON) | Remaining survivors, crises, Crossroads, objectives; variants; more personas | verify agent |
| M9+ | The Long Night, multiplayer, voiced table talk | later |
