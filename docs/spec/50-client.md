# 50. Client

The 3D table, the DOM overlay and the store. The client is a renderer and an input device: it never
decides a rule and never computes a game number.

**Source keys.** `C.n`, `D.n`, `J` = brief sections (`docs/DEAD-OF-WINTER-HANDOFF.md`). `10.x` =
spec `10-rules-core.md`. `00` = spec `00-architecture.md` (engine contracts). `[UBG]`, `[RP]` as in
spec `10`. `[RPAL]` = https://rulespal.com/dead-of-winter/rulebook, `[ZATU]` =
https://zatu.com/products/dead-of-winter (both read 2026-10-10 via search).

---

## 50.1 Hard rules

- 50.1.1 **Only the store calls the engine.** `src/client/store/` is the only module that imports
  `engine.step`. Components read state; they dispatch intents to the store. (C.2)
- 50.1.2 **The client renders only `view(state, humanSeat)`.** No component, hook or selector reads
  the full `GameState`. The only exception is the `?test=1` debug API (50.10.1), which never feeds
  the UI. (C.4; CLAUDE.md)
- 50.1.3 **The engine supplies every number.** Crisis totals, food needed, cards added to the crisis,
  dice targets, exposure odds, kill odds, objective progress, vote counts and hand counts come from
  the view, the `ViewDecision` or its action annotations (50.6). The client does no
  arithmetic on game values; formatting only (percent, plural). (C.5; J "UI arithmetic")
- 50.1.4 **Read from the current state, never a cached roll.** A prompt's target or a tray's dice
  come from the presented state at the animation cursor, not from a previous event. (J)
- 50.1.5 **Generic N seats.** No hard-coded seat count, seat order or "four players". Seats come
  from the view; layout is computed (50.3). (C.5)
- 50.1.6 All prose (prompts, feed lines, tooltips, recap) is our own words, built from templates in
  `src/client/ui/text.ts`. (IP)

## 50.2 Table geometry (world units: 1 unit = 1 inch, y up) (C.6)

- 50.2.1 Ground plane y = 0; table top is a 64 × 64 in square centred at the origin. `+z` points at
  the human (near edge); `-z` is far; `+x` is the human's right.
- 50.2.2 Colony board: 20 × 20 in, centred at the origin, top face at y = 0.05. Its local layout
  (gates 1–6, survivor area, morale and round sliders, food supply, waste pile, crisis deck and
  contribution area, main objective slot) is a data table `src/client/table/colonyLayout.ts`
  with positions in board-local inches. Gate 1 is at the near-left corner, numbering clockwise
  seen from above. (Ruling R-CLIENT-COLONYDIM)
- 50.2.3 Location cards: 6 × 8.5 in tiles, long axis pointing at the colony. Six slots, clockwise
  seen from above, starting at left-far, in engine location order (10.2.1):
  | Slot | Location | Centre (x, z) | Yaw (deg) |
  |---|---|---|---|
  | L0 | police | (-16, -5) | 90 |
  | L1 | grocery | (-5, -16) | 0 |
  | L2 | school | (5, -16) | 0 |
  | L3 | gas | (16, -5) | -90 |
  | L4 | library | (16, 6) | -90 |
  | L5 | hospital | (-16, 6) | 90 |
  The near side (z > 10) stays free for the human's hand, dice tray and prompts. Slots are a
  constant table `LOCATION_SLOTS` in `src/client/table/layout.ts`; replacing it with the rulebook
  arrangement is a one-file change. (Ruling R-CLIENT-LOCLAYOUT)
- 50.2.4 Per location tile (tile-local, inches, origin at tile centre, `-z'` toward the colony):
  entrance row at the colony-facing end (one zombie or barricade per space, 10.2.4), survivor
  slots in a grid in the middle (1.4 in pitch), 4 noise slots along the outer edge, item deck at
  the outer-right corner. Counts come from `view.board` (10.2.5).
- 50.2.5 Figures stand on round 1.18 in bases, about 1.2 in tall (30.1.4). Slot index for a figure is
  its index in the view's location occupant list; the client never re-sorts.
- 50.2.6 Seat anchors: on a circle of radius 27 in. The human is always at angle 90° (point
  `(0, 0, 27)`, near edge). The other seats follow clockwise in turn order at
  `90° + i·360°/N` (i = 1..N-1), measured in the x–z plane from `+x` toward `+z`. Each anchor holds
  that seat's survivor cards (leader first), a face-down hand stack with a count label, and its
  exiled badge.
- 50.2.7 Dice tray at the human's edge: 8 × 4 in at `(12, 0, 17)`; food tokens beside it at
  `(12, 0, 20.5)`. The tray has its own screen rail; no prompt may cover it. (J)
- 50.2.8 Card piles in the world: waste pile, crisis deck, crisis contributions (face down), each
  location deck, and a search-reveal spot hovering 3 in above the searched location.
- 50.2.9 Camera: default perspective, fov 40°, position `(0, 40, 36)`, target `(0, 0, 2)`. Orbit
  limited to polar 15°–70°, distance 18–70 in. Focus moves (location, seat, colony) tween ≤ 600 ms.
  Only left-drag orbits; right or middle click and Alt or Space never start a drag of a piece. (J)

## 50.3 Screen layout (D.5)

- 50.3.1 Centre: the canvas. Top: a slim bar mirroring the colony tracks (morale, round, food,
  waste, "cards added: n", zombies at the colony gates), all from the view.
- 50.3.2 Left rail (`[` toggles): seat rail, one row per seat in turn order: leader portrait,
  followers, unused dice values (public, Ruling A-DICE), hand count, first-player mark, exiled badge, persona name and
  difficulty for bots, "thinking" indicator.
- 50.3.3 Right rail (`]` toggles): event feed (50.7) and table-talk bubbles.
- 50.3.4 Bottom: the human's hand as a fan (DOM, card faces from 30.7), scrollable when long;
  equipped items shown on their survivor's card. Bottom right: the dice tray rail.
- 50.3.5 Rails collapse to a 28 px strip; panels size to their content and never hide their own
  Confirm or Reset buttons. Minimum target viewport 1280 × 760 with nothing important below the
  fold. (J)
- 50.3.6 Bots' hands are face-down 3D stacks at their seat anchors with a count; never faces.

## 50.4 Store (`src/client/store/`, zustand 5)

- 50.4.1 `gameStore`: holds the authoritative `GameState` privately (not exported to components),
  the event log, the RNG seed and the seat→decider map. `dispatch(action)` validates against
  the decision's `legal` answers, calls `engine.step`, appends events, then hands events to the director.
- 50.4.2 `presentedStore`: the view as of the presentation cursor (`view(stateAtCursor, humanSeat)`)
  plus the event being animated. **All UI reads this store.** (C.5)
- 50.4.3 Presentation director: a queue of events; each event type maps to a presenter
  (animation, sound and feed line via `eventSounds.ts`, 30.9.6) with a duration scaled by the
  animation-speed setting (`slow | normal | fast | instant`). `instant` presents with zero delay.
- 50.4.4 Bot turns: when the open decision belongs to a bot seat and presentation is idle, the
  store calls that seat's decider with `view(state, seat)` only. A 5 s no-progress watchdog
  force-answers a stalled bot-owned decision with the first legal action and logs a warning.
  Never for human decisions. (C.5)
- 50.4.5 Simultaneous decisions (`seat: 'all'`, e.g. `vote`): bots answer in the background; the
  human's prompt opens; results present together when all answers are in.
- 50.4.6 The store persists nothing game-critical in `localStorage`. Settings (volumes, graphics,
  speed, rail state) persist per browser, wrapped in try/catch.

## 50.5 Decision prompts that explain themselves (C.5)

- 50.5.1 Exactly one prompt is open at a time, for the one `PendingDecision` (00), seen as `view.decision` (`ViewDecision`). If the decision
  is not the human's, the prompt area shows "Waiting for <seat name>…".
- 50.5.2 A prompt docks next to its subject (a location, a figure, a card, the crisis pile), placed
  by projecting the subject's world position to the screen, clamped away from the rails and the
  dice tray. (J)
- 50.5.3 Every option line says what will happen and quotes engine numbers, e.g.:
  "Search the Hospital with <survivor>? Needs a 3+: you have 4, 5. Exposure after the move:
  25% wound, 17% frostbite, 8% bite." (C.5)
- 50.5.4 Every `decision.legal` entry has one control. Button text is the action's label template
  filled with engine values; E2E tests pick buttons by exact text (50.10.5).
- 50.5.5 Hover or focus on an option highlights its target in the world (figure, location, card).
- 50.5.6 Prompt kinds and their controls follow the decision kinds in 10.15: die pickers for
  `turnAction`, a card picker for `crisisContribution` (face down, with "cards added: n"), a
  keep/noise choice for `searchKeepOrNoise`, Crossroads options with the card face, a vote panel
  for `vote` (no timer; the narrator's "3, 2, 1" plays before results reveal), and so on.
- 50.5.7 Every roll type routes to the dice tray, the exposure roll included (larger d12). (J)

## 50.6 Engine numbers the client needs (contract input to `00`)

Every number the UI shows comes from one export below. The client adds, rounds or estimates
nothing (10.0.8). Paths are fields of `PlayerView` (`src/engine/view.ts`) unless marked.

- 50.6.1 View:

  | Number shown | Export |
  |---|---|
  | morale / max | `view.morale`, `view.moraleMax` |
  | round, rounds left | `view.round`, `view.roundsLeft` |
  | food supply, starvation tokens | `view.food`, `view.starvation` |
  | waste count, top waste card | `view.waste.count`, `view.waste.top` |
  | waste threshold and morale loss | `numbers.wasteMoraleStep`, `numbers.wasteMoraleLoss` |
  | cards added to the crisis (count only) | `view.crisis.contributed`, per seat `seats[i].contributed` |
  | zombies and barricades per entrance | `locations[i].entrances[j].zombies`, `.barricades` |
  | noise, helpless, free spaces, deck count | `locations[i].noise`, `.helpless`, `.freeSurvivorSpaces`, `.deckCount` |
  | occupants with wounds and frostbite | `survivors[i].location`, `.wounds`, `.frostbite` |
  | every seat's unused dice values | `seats[i].dice` filtered on `!used` (public at the table, Ruling A-DICE) |
  | hand counts, exiled flags | `seats[i].handCount`, `seats[i].exiled` |
  | main objective progress | `view.main.progress`, `view.main.target` |
  | own secret objective progress | `view.you.objectiveStatus[]` (`current`, `target`, `met`, `label` key) |

  Dice are rolled in the open, so every seat's unused dice show their values, not a count. The
  human's own dice are also the drag sources; other seats' dice are display only.
- 50.6.2 Per round: food needed this colony phase = `numbers.foodNeeded`; the waste count at which
  morale drops = `numbers.wasteMoraleStep`; zombies each location will receive =
  `numbers.zombiesIncoming[loc]` (`fromSurvivors`, `noiseTokens`); colony survivor count =
  `numbers.colonySurvivors`.
- 50.6.3 Crisis: prevent symbols = `view.crisis.prevent`; cards needed to prevent =
  `numbers.crisisPrevent` (the number of non-exiled players, no rounding; 10 crisis rules); bonus
  threshold = `numbers.crisisBonus`; after reveal, the total, per-symbol counts and outcome =
  `view.lastCrisis.total`, `.symbols`, `.outcome`. Never the face-down cards before reveal.
- 50.6.4 Per legal action: `decision.annotations[k]` (`ActionPreview`, same order as
  `decision.legal`) gives dice required = `dieMin`, exposure odds (wound, frostbite, bite) after a
  move = `exposure`, kill odds where a card has them = `hitOdds`, the location or target =
  `location` / `target`, and label parameters = `label`. For a hypothetical answer that is not in
  `legal` (drag preview), the store calls `engine.preview(view, answer)`, which returns the same
  `ActionPreview`. The client still computes nothing.

## 50.7 Event feed and table talk (D.5)

- 50.7.1 One line per presented event, newest at the bottom, auto-scroll unless the human scrolled
  up. Lines name seats and survivors, use icons from 30.6, and never reveal hidden information
  (they render from the presented view and public events only).
- 50.7.2 Colony phase gets a grouped summary block (food paid, waste, crisis result, zombies added,
  morale change).
- 50.7.3 Table-talk bubbles from bots (spec `41`) appear in the feed with the persona's colour and
  name, and as a short-lived bubble over that seat's anchor.

## 50.8 Secret objective panel and recap

- 50.8.1 The human's secret objective is one click (or key `O`) away from anywhere: a panel with the
  card face, the engine's progress string ("2 of 3 medicine cards; the main objective is not yet
  complete"), and the betrayer or exiled mark when it applies. (D.5)
- 50.8.2 Recap at game end: outcome; each seat's secret objective revealed with met/failed; who
  was the betrayer (if any); a morale-by-round line; per-round key events; per-bot "what I was
  thinking" lines from the AI (spec `40`). Buttons: "Play again (same seed)", "New game".

## 50.9 Start screen and settings (D.5)

- 50.9.1 Seats: the human plus 1–4 bots, each with persona and difficulty; main objective (or
  random); variants (standard, betrayer, hardcore, co-op, player elimination, mature cards on or
  off); animation speed; settings popover. Start button above the fold at 1280 × 760.
- 50.9.2 Settings: volumes (master, effects, narrator, voices, music) and mute; graphics
  (High/Low); colour options; animation speed.

## 50.10 Test hooks (C.5)

- 50.10.1 `?test=1` exposes `window.__game = { seed, state(), view(seat), decision(), legal(),
  dispatch(action), events(), presentIdle(), setSpeed(s) }`. Debug only; never read by the UI.
- 50.10.2 `?seats=human,bot,bot,bot&objective=<id>&seed=<n>` skips the start screen. Optional
  `&speed=instant`, `&personas=<id,...>`, `&difficulty=<tier>`.
- 50.10.3 `?gallery` shows every figure, zombie and prop from the asset manifest (30.8) with tri
  counts and fallback status. `?fps` shows a frame-time overlay.
- 50.10.4 Invisible DOM proxies: `figure-<id>` with `data-location` and `data-slot`;
  `location-<id>` with `data-zombies`, `data-noise`, `data-barricades`; `seat-<id>` with
  `data-hand`, `data-dice`, `data-exiled`; `prompt` with `data-kind` and `data-seat`.
- 50.10.5 E2E picks match exact visible text (`getByRole('button', { name, exact: true })`). (J)

## 50.11 Performance (C.5)

- 50.11.1 `frameloop="demand"`; invalidate on presenter ticks, camera moves and snow.
- 50.11.2 `dpr` capped at `[1, 1.75]` (High) and `1` (Low); shadows on-demand (`shadowMap.autoUpdate
  = false`, update when pieces move); snow off in Low.
- 50.11.3 Shared geometry and materials for figures; zombies instanced (30.4.10); card faces in a
  texture atlas.
- 50.11.4 Code split: engine, data, AI and client in separate chunks; AI in a Web Worker only if a
  measured decision blocks the main thread over 50 ms. (C.1)

## Rulings

- RULING: rulebook p5 location arrangement | six slots clockwise from left-far in engine order (50.2.3), constant table in one file | p5 diagram not in container; public summaries say only "six location cards around the colony board" ([RPAL], [ZATU]); positions unsourced | Unsourced
- RULING: colony board 20 × 20 in, location tile 6 × 8.5 in | used for world layout | physical dimensions not in container; only layout depends on them | Unsourced
- RULING: gate 1 at near-left, numbering clockwise | used for colonyLayout.ts | gate numbering exists (E.2) but positions are not stated | Unsourced
- RULING: vote timing | no timer on the human's vote; the "3, 2, 1" is presentation only, played when all votes are in | brief D.4 lists a narrator countdown but no rule imposes a time limit; a timer could force a human vote | Unsourced
- RULING: other seats' dice | every seat's unused dice values are shown, not a count; crisis cards needed = numbers.crisisPrevent (non-exiled players, no rounding), bonus = numbers.crisisBonus | dice are rolled openly (Ruling A-DICE; view.ts SeatPublic.dice) and 10.4.15 / R-CRISISPLAYERS | Unsourced for dice (follows 00 A-DICE); crisis threshold Confirmed via R-CRISISPLAYERS
