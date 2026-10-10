# 50: Client

React 19 + R3F 9 + drei + zustand. The client never mutates `GameState` and never computes a rules number: every
die requirement, exposure chance, crisis total, food need and vote count comes from `engine.query.*`,
`pending.context`/`pending.options[].odds` or an event, and `describe.*` formats it. Deciders (the human prompt
included) receive `view(state, seat)` only. Generic over seats (2–5) from day one: no seat-count or seat-order literal
outside `src/client/table/seats.ts`. Art and layout numbers are in `30-art`; test hooks are exercised by `60-testing`.

## 1. Modules

```
src/client/
  store/          gameStore (true state, pending, event ring 2000; the ONLY caller of engine.step), presentedStore,
                  uiStore (rails, panels, selection), settingsStore (localStorage `dow.settings`), runner.ts (deciders, watchdog)
  presentation/   director.ts (events → timed beats), beats.ts, apply.ts, feed.ts (redaction + breakdown lines), talk.ts (bubbles)
  table/          Table, ColonyBoard, LocationTile, layout.ts, seats.ts, Tokens, Lights, Camera, Snow
  figures/        glbModels, glbLoader, GlbBody, Procedural, Zombies (instanced), Gallery
  cards/          cardFace.ts, CardMesh, Deck, HandFan, CardPanel (DOM face)
  dice/           DiceTray, DieChip, ExposureDie, DiceLog
  interaction/    per-decision controllers, picking, drag, keyboard
  ui/             StartScreen, TopBar, SeatRail, FeedRail, PromptDock, ObjectivePanel, Settings, Recap, Collapsible
  vfx/            pooled particles (snow, blood puff, barricade splinters, noise ring); icons in Low
  audio/          (M6; eventSounds.ts is the one map audio and vfx both read)
  testing/        testHooks.ts (window.__game), DomProxies.tsx
```

## 2. Start screen

| Element | Behaviour |
|---|---|
| Title art | `30-art` §8; scales by height, never crops the title; the panel fits above the fold at 1280×760 |
| Seats | rows for the human (name) plus 1–4 bots, each a persona picker (`41-personas-and-talk`) and a tier (`random easy normal hard`); add/remove rows; order = clockwise seating, the human is always row 1 |
| Main objective | list from the bundle (name, time rating, short our-words blurb) or Random |
| Variants | toggles for `betrayer hardcore coop twoPlayer playerElimination removeMature` (`GameVariants`); co-op greys the betrayer toggle; two-player forces 2 seats |
| Animation speed | instant / fast / normal / slow (`settingsStore.speed`, also in game) |
| Settings | popover (§14) |
| Start | calls `createGame(setup, seed, bundle)`; a rejection (`E_BAD_SETUP`) shows its `message` inline under the panel, never a throw |
| Seed | `?seed=<word>` or a random word shown beside Start, copyable (bug reports repeat, brief Part A) |
| Resume | lists `localStorage` saves (`dow.save.<slot>`), loads through `engine.load` |

`?seats=human,bot,bot,bot&objective=samples&seed=x` skips the screen (§16). Theme tokens: `30-art` §9.

## 3. In-game layout

| Region | Where | Shows |
|---|---|---|
| Table | centre canvas | the board, six tiles, figures, zombies, tokens, decks, bot hand stacks (`30-art` §2) |
| Hand fan | bottom centre | the human's `me.hand` as DOM card faces, fanned; hover lifts; §7 |
| Dice tray | bottom right, own rail, never under a prompt | the seat's dice, food tokens, the exposure die, the roll log; §8 |
| Top bar | top, slim, one line | morale, rounds left, food, waste count, crisis name with "cards added: n" (`query.crisis(view).cardsIn`), zombies at the gate (sum over colony entrances), first seat, active seat, the secret objective button |
| Seat rail | left, collapsible `[` | one card per seat in clockwise order from the human; §9 |
| Feed rail | right, collapsible `]` | the event feed with breakdowns and the table-talk bubbles; §10 |
| Prompt dock | floats beside its subject (a survivor, a tile, the tray, a seat card); falls back to bottom centre above the fan | the open decision; §5 |
| Objective panel | key `O` or the top-bar button; one click away at all times | main objective and the human's secret (or exiled) objective with engine progress (`query.objectiveProgress`), e.g. "2 of 3 medicine cards; the main objective is not complete yet" |
| Crossroads panel | modal over the table when `crossroads.active` names the human, or when the human holds a card (`me.crossroadsHeld`) at turn start, face up as at the table | the card face (`30-art` §7) |

- Rails collapse to a 40 px strip with badges (unread feed lines, a speaking seat) and remember their state in `dow.settings`.
- Panels size to content; Confirm and Reset are never clipped (lesson J).
- Everything renders from `presentedStore` (§4): a top-bar number never runs ahead of its animation.

## 4. Presentation director, presented store, watchdog

- `gameStore` is written only by `runner.ts` after `step`. Each step's `{before, after, events}` is a batch for the director.
- `director` turns a batch into beats; `presentedStore.state` moves along with them; `presentedStore.idle` is true when
  nothing is queued or playing. Any click skips the current beat; speed `instant` drains synchronously.
- The human prompt opens only when idle. A bot decider is asked only when idle **and** it is that bot's decision (or
  `votes`). The runner's **watchdog**: if `pending` has not changed for 5 s and its seat is a bot (or `'all'` with
  only bots outstanding), it dispatches `legal[0]` with source `'watchdog'` and logs a warning; the sim counts these.
- Beats (durations at normal speed; `fast` halves, `slow` doubles):

| Events | Beat |
|---|---|
| `TurnStarted`, `RoundStarted`, `PhaseChanged` | banner 800 ms; a bot's turn start also shows its line bubble |
| `ActionDiceRolled`, `DiceRolled`, `NoiseRolled` | tray roll 700 ms (every `RollPurpose` has a renderer, §8) |
| `SurvivorMoved` | straight-line tween ≤600 ms |
| `ExposureRolled` → `ExposureFaceChanged`? → `WoundTaken` / `SurvivorKilled` | d12 roll 900 ms, pip pop 300 ms, fall 600 ms; the chain of `BiteSpreadStep` beats pauses on the owner's `biteSpreadOption` |
| `SearchDrawn`/`SearchKept`/`NoiseAdded` | card flip 400 ms (own seat shows the face; others a back), bell ring on noise |
| `CardContributed` | a face-down card slides to the contribution area 400 ms |
| `CrisisRevealed` | banner 1 200 ms with narration pause (M6) |
| `CrisisCardRevealed` ×n → `CrisisResolved` → `CrisisEffectApplied`/`MoraleChanged` | one flip per card 500 ms with the running total; result banner 1 000 ms |
| `ZombiesToAdd` → `ZombieAdded`/`BarricadeDestroyed`/`EntranceOverrun` | 250 ms per zombie, gate flash on overrun |
| `FoodPaid`, `Starvation`, `WasteChecked`, `MoraleChanged`, `RoundTicked`, `FirstSeatPassed` | slider/token tween 400 ms |
| `VoteCalled` → `VotesCast` → `VoteResult` → `SeatExiled` | 3-2-1 countdown 1 500 ms, thumbs reveal per seat 300 ms, exile badge |
| `CrossroadsTriggered`/`CrossroadsResolved` | panel 0 ms (waits for the human) / banner 800 ms |
| `GameEnded` | fade to the recap (§15) |

## 5. Decision prompts that explain themselves

A prompt names the actor, the target and the exact numbers, read from `pending.context`, `pending.options[].odds`
and `query.*` on the human's view; `describe.percent` formats. The example strings below are the contract for the
client unit test (`60-testing` §7); wording is ours.

| Kind | Example text |
|---|---|
| `turnAction` (search) | `Search the Hospital with Olivia Brown? Needs a 4+: you have 4, 5 (the 2 needs 2 food). Found-a-medicine chance next card: 35%.` |
| `turnAction` (attack zombie) | `Attack the zombie at gate 3 with Daniel Smith? Needs a 2+: any die. Then exposure: 25% wound, 17% frostbite, 8% bite (dies 8%).` |
| `turnAction` (attack survivor) | `Attack Mike Cho with Sparky? Spend the 5; a hit needs a roll of 2 or less: 33%. No exposure roll. A hit wounds him and steals a random card.` |
| `turnAction` (move) | `Move Forest Plum to the Library? 2 empty spaces, 1 zombie there. Exposure after the move: 25% wound, 17% frostbite, 8% bite.` |
| `turnAction` (barricade / clean waste / attract) | `Barricade gate 5 with Ashley Ross? Any die (she can also do it free once per round).` / `Clean waste with Gabriel Diaz? Removes the top 3 of 14 waste cards; at 10 or more the colony loses 1 morale next phase (2 at 20).` / `Attract 2 zombies to the Gas Station with Thomas Heart? From: gate 2 (3 zombies), School (1). Only into empty spaces.` |
| `turnAction` (spend food) | `Raise this 3 to a 4 for 1 food? Food after: 5. The colony needs 3 next phase.` (`query.foodNeeded`) |
| `turnAction` (contribute) | `Add cards to the crisis (Blizzard needs Fuel or Tool)? Prevent at 3, bonus at 5. In so far: 2 cards (yours 1, Rook 1). Your total if they match: 1 to 3.` (`query.crisis`) |
| `turnAction` (request / hand off / call vote) | `Ask Rook for a Food card? They have 5 cards.` / `Hand the Shotgun from Daniel to Olivia (same location)?` / `Call a vote to exile Rook? 4 can vote, 3 yes needed; you break ties.` (`query.voteForecast`) |
| `searchKeepOrNoise` | `Keep the Medicine or make noise for another? Noise spaces left: 2 of 4. Each noise token adds a zombie on a 3 or less (50%) next phase.` |
| `searchKeepWhich` | `Keep one: Medicine, Canned Beans, Crowbar. The others go under the deck.` |
| `crisisContribution` | same as contribute, plus `End your turn after this.` |
| `requestResponse` | `Rook asks you for a Fuel card for the crisis. Give the Gasoline or decline.` |
| `crossroadsOption` | card title, our vignette, both options with their effect lines; an impossible option is not offered |
| `biteSpreadOption` | `The bite reaches Sparky (lowest influence here). Kill Sparky to stop it, or roll: 50% blank and safe, 50% Sparky dies and it spreads to Olivia.` |
| `newLeader` / `chooseLeader` / `chooseSurvivors` | portraits with influence / attack / search and ability text; `Pick 2 of 4` with the count enforced |
| `exilePlacement` | `Exiled. Place Daniel and Olivia at non-colony locations (exposure after each move). A full location bumps someone back to the colony.` |
| `votes` | `Exile Rook? Yes / No. Eligible: 4; needed: 3; the first seat breaks ties.` with each bot's stated lean (§11) |
| `objectiveChoice` / `effectChoice` / `itemTarget` | the option labels from `pending.options`, the card face, and `context.data.code` only in `?test=1` |
| `gameOver` | the recap (§15) |

- Dock rules: near the subject (`context.survivorId` → its figure; `context.location` → the tile; dice → the tray; a
  seat → its rail card); never over the tray or the fan; Enter = the first option, Esc = `pass` when `canPass`, else close
  the sub-prompt back to the action list.
- The `turnAction` controller is a two-level prompt: an action list (only actions with a legal candidate, from
  `legalActions`, grouped by survivor) and the sub-prompt above once a target is picked; `End turn` is always present.
- Odds text reads from the view at prompt open; the prompt re-renders when `pending.id` changes (never a stale target, lesson J).

## 6. Interaction per decision

| Decision | Controller | Preview | Commit |
|---|---|---|---|
| `turnAction` | click a survivor (own, alive) → action chips; click a zombie / tile / gate / card for the target; drag a die chip from the tray onto a chip to choose the die; drag a food token onto a die = `spendFood` | tile highlight for legal moves (`query.moveTargets`), red when invalid (`validate` at ≤30 Hz); die chips that qualify glow | the sub-prompt's Confirm, or Enter |
| `searchKeepOrNoise` / `searchKeepWhich` | the drawn faces fan above the tile | noise circles light as they would fill | click a card / Make noise |
| `crisisContribution` | drag cards from the fan or from an equipped slot to the contribution area; multi-select | the running `query.crisis` line | Confirm (also `[]`) |
| `requestResponse` | fan shows only matching cards lit | | click a card / Decline |
| `crossroadsOption` | modal panel | | click an option |
| `biteSpreadOption` | dock at the location | | Kill / Roll |
| `chooseSurvivors` / `chooseLeader` / `newLeader` | portrait grid | | Confirm |
| `exilePlacement` | drag each survivor to a tile | empty spaces per tile | Confirm |
| `votes` | thumbs panel | | Yes / No |
| `itemTarget` / `objectiveChoice` / `effectChoice` | click targets lit by `pending.options` or `context` | | Confirm |

Camera input (right or middle drag, Alt, Space, wheel) never starts a card or figure drag. All drags are previews; only a
dispatched `Action` changes anything.

## 7. Hands

- Human: DOM fan at the bottom, cards from `me.hand` as faces (`30-art` §7); hover lifts and shows the full text;
  click = play (`playCard`, with a target step if the card needs one); drag onto a survivor = equip; drag to the board's
  contribution area = contribute; right-click = inspect. Cards are sorted by symbol; the order is per-viewer only.
- Equipped cards sit as mini faces under a survivor in its tile slot and in the seat rail.
- Bots: a face-down stack beside the seat position with `handCount`; `CardDrawn`/`SearchKept`/`CardStolen` animate a back
  into or out of the stack; the face is never rendered for a card the view does not list (`cards` contains only visible instances).

## 8. Dice tray

- Own rail at bottom right; never under a prompt. The seat's `dice` as chips (value, `used` greyed, `foodSpent` as small
  can icons); food tokens in a pocket; the exposure d12 in its own larger pocket; a log of every roll this game.
- **Every `RollPurpose` routes here** (`actionDice exposure attackSurvivor noise objective crisis crossroads item ability
  other`) and so does `ExposureRolled`; a unit test asserts a renderer per purpose, an unknown one renders generically.
- Each row: the dice, `target` when the event carries one (never recomputed), the verdict word (`HIT / MISS / 4 ZOMBIES
  / BLANK / WOUND / FROSTBITE / BITE`) and the actor. Bots' rolls show too, tagged with the seat colour.
- Click a log row to replay its beat (presented state unchanged).

## 9. Seat rail

Per seat, clockwise from the human: persona portrait and name (seat colour), leader portrait with influence, follower
portraits, dice left (`dice.filter(!used).length` from the view), `handCount`, `contributionCount` this round, first-seat
compass, active highlight, `exiled` and `eliminated` badges, `outcome` at the end. The human's card adds the secret-objective
button. Hover a survivor portrait → its card face. Buttons: Accuse (table talk only, no rules effect, H.5), Request
(opens the request prompt when it is the human's turn), Call vote.

## 10. Feed and talk bubbles

- The feed shows `redactEvent(event, humanSeat)` only (`null` = hidden), one line per event in our words from
  `presentation/feed.ts` (`feedLine(event, view)`; a test asserts every `GameEventType` has a line).
- Breakdowns are expandable groups: a crisis reveal card by card with the running total, an exposure roll with the odds
  that applied, zombie placement gate by gate with overruns, a vote with each ballot, a bite chain step by step.
- Talk lines come from the AI's line banks (`41-personas-and-talk`), keyed by event, through `talk.ts`: a bubble on the
  seat card for 4 s and a line in the feed; at most one line per bot per turn plus reactions (H.6); voiced lines (M6)
  play once and are never queued behind each other.
- The human's accusation posts a feed line and a bubble on the accused; the AI's suspicion reaction comes back as lines.

## 11. Votes (`pending.seat === 'all'`)

1. The runner asks every eligible bot decider with its own view and collects answers privately.
2. Each bot's lean line (`vote.lean.yes/no` or silence) shows before the human prompt opens.
3. The human votes in the prompt; the runner submits one `castVotes {votes}`. Bots never see the human's ballot first
   (C.4). `VotesCast` then reveals thumbs per seat in the tray order.

## 12. Camera

Orbit with right drag, pan with middle drag or WASD, zoom with the wheel. Presets: `1` seat view (default), `2` top
down, `3` colony close, `4` follow active survivor. Transitions ≤600 ms, eased; no auto-camera during a human drag;
auto-focus the active survivor only when it is off screen.

## 13. Generic N-seat

- `seats.ts` places seat `i` of `n` (clockwise, human at index 0) on the table rim at angle `π/2 + 2πi/n` from the
  near edge: the human is always the near edge, 2–5 seats are all distinct, and the bot hand stacks and tray
  positions derive from the angle.
- Seat colours index `seatOrder` (`30-art` §9). Nothing reads `'s1'`; everything reads `view.seatOrder` and `view.seat`.
- The seat rail, the vote panel, the recap and the top bar iterate `seatOrder`; exiled or eliminated seats stay listed with badges.

## 14. Settings, Low graphics, performance

| Setting | Values | Effect |
|---|---|---|
| Graphics | High / Low | Low: dpr 1, shadows off, no snow, dioramas and props hidden, particles become icons, 512 card textures |
| Animation speed | instant / fast / normal / slow | director scale (§4) |
| Narration | on / off | narration pauses and (M6) the narrator voice |
| Volumes | master, effects, narrator, voices, music, mute | M6 |
| Rails | left / right collapsed | `[` `]` |
| Seat colours | default / alt set | M7 |

- `<Canvas frameloop="demand">`; invalidate on presented-state change, tweens and camera input. `dpr={[1, 1.5]}`;
  shadows on demand, 1024 map. Shared geometries and materials; instanced zombies, tokens and props.
- Persisted in `localStorage` `dow.settings`; every read is try/catch and defaults apply without storage.
- Budgets: `00-architecture` §15 (initial chunk ≤350 KB gz, engine+data and ai as separate dynamic chunks; 60 fps at 1080p).

## 15. Recap screen

Opens on `GameEnded` from `view.recap` (present iff `phase === 'ended'`):
winners and the reason (`result.reason`), then per seat in `seatOrder`: secret (and exiled) objective with its
`query.objectiveProgress` parts and `outcome`; the contributions table by crisis and seat
(`recap.contributions[].revealed[].seat`); the Crossroads log with each card, holder, whether it triggered and the
option taken; every final hand; the per-seat "what they were really doing" story (M7, from the AI's own plan log).
Buttons: Play again, Same seed, Export save (`engine.save`), Copy seed. This is how the human audits the bots (C.4, H.9).

## 16. Test hooks

| Hook | Contract |
|---|---|
| `?test=1` | `window.__game = {state(), view(seat?), pending(), legal(), dispatch(action), presentedIdle(), seed, load(save), save(), speed(n), seatIds()}`; prompts also show `context.data.code` |
| `?seats=human,bot,bot,bot&objective=samples&seed=<word>&tier=random&persona=a,b,c` | skips the start screen; unknown ids → the start screen with the error inline |
| `?gallery` | every survivor and zombie, GLB beside fallback, card faces per kind, icon sheet, status toggles |
| `?fps` | perf overlay (fps, draw calls, triangles, presented idle, watchdog count) |
| DOM proxies | invisible `<div data-testid="figure-<survivorId>" data-location data-slot data-wounds data-frostbite data-status>` per survivor; `zombies-<location>-<entrance>` with `data-count`; `seat-<seatId>` with `data-hand data-dice-left data-exiled` |
| `data-testid` | `<area>-<element>[-<id>]`: `prompt-option-<optionId>`, `prompt-confirm`, `tray-roll-<rollId>`, `setup-objective-<id>`, `setup-seat-<i>-persona`, `topbar-morale`, `hand-card-<cardId>`, `recap-seat-<seatId>` |

E2E picks match exact text or a testid, never a substring. Asset URLs use `import.meta.env.BASE_URL`.

## 17. Keyboard

`Enter` first option · `Esc` pass/close · `E` end turn · `O` objectives · `[` `]` rails · `1–4` camera presets · `Space`
skip beat (held: fast-forward) · `S` save · `?` key list.
