# Handoff

**Current state:** M4 landed (slim AI colonists, see "AI (M4)" in `STATUS.md`); before it, M3 landed: playable on GitHub Pages (https://dragoonant.github.io/dead-of-winner/) as one human against
1-4 bots (Normal AI by default, Random selectable), 2-5 seats, on the real card data in `src/data/` (30 survivors, 39 items, 20 crises, 20 Crossroads, 10 main and
27 secret-type objectives). The client (`src/client/`) drives the engine only through `view` + `legalActions` + `query`; the store
(`store/gameStore.ts`) is the only caller of `step`. Gates: typecheck clean, `npm test` green, `validate-data` 0 errors,
`npm run sim -- --games 20 --seed 4` 0 violations / 0 leaks, `npm run e2e` plays a full game through UI clicks to the recap.
See "Client (M3)" in `STATUS.md` for URL params, screenshots and known gaps.

## Next
1. **Owner playtest gate (M4):** play 3 games on https://dragoonant.github.io/dead-of-winner/ (default Normal bots, three personas; try one game with a
   Random bot via the start screen). Answer: does the table feel alive (do the bots take sensible turns, feed the colony, defend the gate, talk at
   sensible moments without repeating), do games last long enough (Normal averages about 4-5 rounds, most losses are by morale), and is the betrayer
   findable but not obvious (the recap lists every contribution and secret objective; check whether the bots' votes pointed at the right seat).
   Note any line that reads wrong, a bot that does something silly, and the forms that feel clumsy (the generic option list for itemTarget / effectChoice).
2. Possible M4 follow-ups from that feedback: a betrayer that works toward its own win condition, Easy/Hard tiers, objective contribution actions
   (Find a Cure, Stockpile and Leave It All Behind cannot be completed by anyone until the engine has them), more personas (41).
3. Art (30) after the playtest.

## Owner ask
Play on Pages and report. Card data is verified against the Vassal v1.1 scans (crises, main objectives, standard secret objectives, survivors); still open: 5 betrayal texts the module censors
(Runaway, All for One, Trigger Happy, Cult Leader, Serial Killers). A photo of those five real cards is the fastest way to close them.
