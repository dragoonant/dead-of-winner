# Dead of Winner

A 3D browser tabletop game that ports the mechanics of *Dead of Winter: A Crossroads Game* 1:1, where one human
plays at a table of AI colonists who hold their own hands, their own secret objectives and, sometimes, a betrayal.

Play it: https://dragoonant.github.io/dead-of-winner/

**This is an unofficial fan project.** It is not affiliated with, endorsed by or connected to Plaid Hat Games,
Fantasy Flight Games or Asmodee. All card text, stories, voice lines and UI copy are written in our own words; all
art, figures, icons and sounds are our own. No publisher art, icons or trade dress is used. The rulebook and any
community data files are never committed to this repo.

## Fairness rules for the AI colonists
- Bots see only their own seat's view of the game: never another seat's hand, secret objective or face-down crisis
  contribution. A leak test proves it on every simulated game.
- Bots roll on the same seeded random number generator as the human, in turn order.
- The end-of-game recap reveals every hidden decision so the human can audit that the bots played fair.

## Development
```
npm install
npm run dev          # http://localhost:5181
npm run typecheck && npm test
npm run sim -- --games 6 --seed 1
npm run e2e
```
Add `?seed=<word>` to any game URL for a repeatable game.
