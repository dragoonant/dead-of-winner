# Handoff

**Current state:** M3 landed: playable on GitHub Pages (https://dragoonant.github.io/dead-of-winner/) as one human against
1-4 Random bots, 2-5 seats, on the real card data in `src/data/` (30 survivors, 39 items, 20 crises, 20 Crossroads, 10 main and
27 secret-type objectives). The client (`src/client/`) drives the engine only through `view` + `legalActions` + `query`; the store
(`store/gameStore.ts`) is the only caller of `step`. Gates: typecheck clean, `npm test` green, `validate-data` 0 errors,
`npm run sim -- --games 20 --seed 4` 0 violations / 0 leaks, `npm run e2e` plays a full game through UI clicks to the recap.
See "Client (M3)" in `STATUS.md` for URL params, screenshots and known gaps.

## Next
1. M4: slim AI (`docs/spec/40-ai.md`, `41-personas.md`): a tier above Random that feeds the colony, prevents crises and does not
   attack its own side, so games run their full length; hook it into `src/client/bot/deciders.ts` and `npm run bench:ai`.
2. Owner playtest gate before M5 polish/art: play a few games on Pages, note rules or text that read wrong, and the forms that
   feel clumsy (the generic option list for itemTarget / effectChoice is the weakest).
3. Art (30) after the playtest.

## Owner ask
Play on Pages and report. Still open: 9 standard secret objective texts, 7 betrayal texts and 17 official English crisis names;
photos of real cards (like the All I Need Is My Books and Talia Jones photos used in M3) are the fastest way to close them.
