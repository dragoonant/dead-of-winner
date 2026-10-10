# Status

## What exists
- Scaffold (2026-10-09): Vite 8, TS 7, React 19, Vitest 5, Playwright, Pages deploy workflow, copied
  from Whirr Machine. Placeholder title screen in `src/client/App.tsx`. One smoke test.
- `docs/DEAD-OF-WINTER-HANDOFF.md`: the full brief (Parts A–K).
- `docs/sources/` (gitignored, PC only): the official rulebook and FAQ v1.1 PDFs with extracted text.
- `docs/needs-rules-check.md`: rulings log, 89 M0 lines for the owner.
- Workflows: `tools/workflows/w0-foundation.js` (specs + contracts), `w0-review.js` (adversarial
  review + routed fixes), `w0-sync.js` (cross-owner leftovers).

## Spec status (M0 done 2026-10-10)
- `docs/spec/00`–`60` written, reviewed once adversarially (50 findings, all applied).
- Frozen engine contracts: `src/engine/{types,actions,events,hooks,rng,decider,view,index}.ts`, plus
  non-frozen `odds.ts`. `rng.ts` (sfc32 + scripted mode) and `odds.ts` are implemented; engine methods
  throw `NotImplementedError` until M1. `tests/engine/contracts.test.ts`: 8 pass, 1 todo.
- `21-card-effects-dsl.md` is DRAFT; it freezes after the M2 dry run. JSON Schemas in `docs/spec/schemas/`.
- Checklist `12`: 255 rules rows + non-rules prefixes (ARCH/SIM/DSL/DATA/AI/UI/E2E/GOLD), 325 total.

## Known gaps
- Written without the rulebook PDF (cloud session; PDF over the WebFetch limit). Sources used:
  brief Part E, rulespal.com rulebook page, Order of Gamers v1.2 summary.
- GOLD-01..06 use rebuilt fixture numbers (`fidelity: rebuilt`); reconcile with R p9–13 on the PC.
- Placeholders: board space counts, location arrangement (R p5), item card effects, some survivor stats.
- 21.5 Binds column may drift from `DSL_EVENT_BINDINGS` in `events.ts`; the code map wins (21.5.0).

## Next
- M1 engine + sim.
