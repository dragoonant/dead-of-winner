# Handoff: a Dead of Winter browser game with AI colonists (sibling to Mallet 42k and Whirr Machine)

Written 2026-10-09 at the end of the Whirr Machine project (https://dragoonant.github.io/whirr-machine/,
repo `dragoonant/whirr-machine`, 50 commits from 2026-10-04 to 2026-10-09; Mallet 42k before it,
132 commits from 2026-09-12 to 2026-10-04).

Goal: a 3D browser tabletop game that ports **Dead of Winter: A Crossroads Game** (Plaid Hat Games,
2014; designers Jon Gilmour and Isaac Vega) mechanics 1:1, where **one human plays at a table of AI
colonists** who hold their own hands, their own secret objectives and, sometimes, a betrayal. Same
house look as the two earlier games: stylized figures, ElevenLabs sound and voice, dark-and-gold UI,
Pages deploy, and the same polish level.

Read this whole file once. After that, keep your own `HANDOFF.md`, `STATUS.md` and `PLAN.md` in the
new repo, and copy Part B (process rules) into the new repo's `CLAUDE.md` on day one.

Where facts come from:
- Rules facts come from the free official rulebook and FAQ v1.1 (Plaid Hat Games, 2014). Both are
  already downloaded to `WarMForge\refs-local\dow-sources\` (PDF plus extracted `.txt`), outside any
  repo. Copy them into the new repo's gitignored `docs/sources/` on day one. Page numbers below refer
  to the rulebook.
  - https://media.plaidhatgames.com/old_images/games/dead-of-winter/rules.pdf
  - https://media.plaidhatgames.com/old_images/games/dead-of-winter/dow-faq.pdf
- Card data (survivor stats, item decks, crisis cards, crossroads, objectives) is **not** in the
  rulebook. It must be gathered from fan databases and photos (Part G lists the sources). Everything
  in Part G marked **(verify)** is medium confidence or lower: check two sources before data entry,
  and record the source per value, as Whirr Machine's `docs/spec/factions/*-sources.md` did.

---

## Part A: the owner and how they work (read first)

**Priorities**
- **Playable first.** Something the owner can open on Pages and play beats test coverage. Every
  stage ends in something visible: a Pages deploy or screenshots.
- **Metered plan.** Token rules are mandatory, not style advice (see Part B).
- **The AI colonists are the product.** A Dead of Winter clone without convincing table-mates is a
  solitaire card game. Budget the AI milestone like a faction in Whirr Machine: verify loops ON,
  benchmarks, and an owner playtest gate.

**Communication**
- **Check-ins are ≤10 lines**, with a screenshot per milestone. Don't narrate options you won't
  pursue, and don't re-ask settled decisions.
- **Playtest loop.** The owner plays on Pages and gives blunt, specific feedback ("sounds like a
  silenced pistol", "prompts should say what they're about"). Fix it in small commits and push.
- **Rules ambiguities** never block work. The agent records a `RULING:` line (what the rule says,
  what we did, why) in `docs/needs-rules-check.md`, and the owner reconciles them in one sitting.
  Whirr Machine ended with 211 rulings; that volume is normal and fine.

**Lessons the owner taught during Whirr Machine (these are feedback, apply them)**
- **Do the legwork.** Free downloads, $0 guest checkouts and public pages are the agent's job. Stop
  only for passwords, payment or account creation. "Please don't make me do the work for you."
- **Research before assuming.** One blocked source is not the only source. When the official app
  could not show card data, Whirr marked everything "unverified" and built a stand-in figure; the
  owner was disappointed by both. Search fan databases, rulebooks, store listings and photos, cite
  each source, and only then fall back to a placeholder.
- **Figure prompts state proportions in plain words.** Never write "MGSD", "SD", "super deformed",
  "chibi", "Gundam" or "mecha kit". The target look is mildly stylized heroic proportions, about
  4–5 heads tall, detailed, not cute. Check head-to-height ratio on every image before 3D.
- **Never paste into Gemini from the system clipboard.** A failed copy once pasted the owner's
  private clipboard text into a Gemini prompt. Use the hidden `input[type=file]` under
  "Upload & tools" plus `file_upload` with a path inside the session folder (copy refs to
  `WarMForge\refs-local\` first). Verify the prompt box holds only the prompt before sending.
- **Seeds in URLs.** `?seed=<word>` made bug reports repeatable; keep it.

**Pre-approved actions**
- Pushing to `main` after each stage. Pages deploys from `main`.

**Machines and secrets**
- **The Windows PC with the GPU** does all asset work: Hunyuan3D, Claude in Chrome for Gemini, and
  ElevenLabs. Never route asset work through the Mac.
- **Secrets.** The ElevenLabs key lives in the untracked `WarMForge\Tokens.txt` as `EL=<key>`
  (strip the prefix: `sed s/^EL=//`) and is passed only through the `ELEVENLABS_API_KEY` env var.
  Never write, log or commit it; the repo is public. Gitignore `*.token*` and `Tokens.txt` patterns
  in the new repo on day one. The account is the Starter tier (about 59k credits per cycle in
  October 2026); a 502 is still charged.

**Settled carryovers (do not re-ask)**
- Mechanics are ported 1:1.
- All prose is in our own words.
- Player vs AI comes first; multiplayer comes later (it was put on hold for Whirr Machine too).
- The repo is public on GitHub Pages.
- Music via ElevenLabs Music; confirm before spending more than about 5k credits on it.

**Decisions settled by the owner on 2026-10-09 (do not re-ask):**
1. **IP posture: Mallet posture.** Real survivor, card and objective names may be used. All prose
   (card text, stories, lines, UI copy, docs) is in our own words; no Plaid Hat, Fantasy Flight or
   Asmodee art, icons or trade dress; portraits and figures are our own designs. See Part F.
2. **Title and repo: Dead of Winner**, `dragoonant/dead-of-winner`, deployed to
   https://dragoonant.github.io/dead-of-winner/.
3. **Figures: full 3D.** All 30 survivors go through the Gemini concept plus Hunyuan pipeline
   (Whirr Machine's method, Part D.2 and D.3), one GLB per survivor, plus 3–4 zombie GLBs and a 3D
   colony board. Batches of about 8 survivors; finalize, wire, commit and push per batch.
4. **Voiced Crossroads: text for all 80 cards, narrator voice for the first 20** (about 4.5k
   credits; **verify** TTS pricing on the first batch). Extend to more cards only when the owner
   asks after hearing them.

---

## Part B: process rules (copy into the new `CLAUDE.md`)

These are the rules that worked in Mallet 42k and Whirr Machine, tightened by their mistakes.

### B.1 Token rules
- **The main loop stays cheap.** It never reads whole source files or hand-writes bulk code. It
  writes Workflow scripts, reads structured JSON results, and checks in with the owner.
- **Model choice.**
  - Implementation and data entry run on Sonnet subagents (`model: 'sonnet'`).
  - Spec writing, card prose, and adversarial verification run on the session model at
    `effort: 'high'`.
  - Agents return schema-validated JSON, ≤300 tokens.
- **Stage size and cadence.** One workflow stage at a time, ≤8 agents per stage (the Workflow tool's
  default guideline is ≤10). Commit and push after every stage, so an interrupted run never loses
  finished work.
- **Resume.** Workflow resume (`resumeFromRunId`) works only in the same session.
- **Prompts point, they don't paste.** Specs live on disk. Prompts say "read spec section X, build
  Y", never with the spec pasted in.
- **Freeze interfaces before fan-out.** This was the number one rework sink in both games.
- **Cap research.** At most 3–6 WebFetches per agent, name the exact spec sections, and probe a new
  setup with one cheap agent before fanning out. Pages that block `curl` and WebFetch (Fandom behind
  Cloudflare, BoardGameGeek file downloads) are read through Claude in Chrome on the PC, once, by
  one agent, into a sources doc; nobody else re-fetches them.
- **Lean mode is the default** (`args.lean: true`): implement and commit, with no adversarial verify
  loop and about 10 focused tests. Turn verify loops on for rules-dense content: the card data
  batches (Part G), the AI colonists (Part H), or when the owner asks.
- **Token reference points from Mallet:**

  | Stage | Tokens |
  |---|---|
  | Foundation specs | ~1.2M |
  | Engine core | ~0.5M |
  | Data entry with verify | ~2M |
  | Main loops | ~0.35M |

  Whirr Machine's data entry for four factions with web verification was the most expensive stage
  again. Expect the same for 80 Crossroads cards.

### B.2 Workflow script pattern
This is the pattern behind `tools/workflows/*.js` in both games. Copy Whirr's `w1-engine.js`
(stage template), `w9-factions.js` (content batch with verify) and `w10-backlog.js` (overnight
backlog) as templates.

- **Header.** `export const meta = {name, description, phases}`, then
  `agent(prompt, {label, phase, schema, model|effort})`, `parallel([...])` and `phase('X')`.
- **Schemas.**
  - `RESULT = {ok, summary, files[], issues[]}`
  - `VERDICT = {verdict: 'ok'|'needs-fix', coverage:{covered,total}, failing:[{id,description,fix}], notes}`
  - `FINDINGS = {ok, findings:[{owner: 'spec'|'data'|'engine'|'ai'|'client', where, problem, fix}]}`
- **A `COMMON` preamble in every prompt.** It contains:
  - the absolute project root ("use absolute paths, the cwd resets");
  - "orient from STATUS.md only";
  - the IP rule;
  - the frozen-contract rule;
  - **"run long commands in the FOREGROUND"**. Sonnet agents that background `npm test` stall.
- **File ownership.**
  - Every agent prompt says "You own ONLY: …", and concurrent agents own disjoint files.
  - Verify agents never edit.
  - Each finding carries an `owner`, and you route it to the agent that owns that file. Narrow fix
    agents correctly refuse out-of-scope findings.
- **Full build loop** (non-lean): implement on Sonnet, then adversarial verify on the session model
  (high effort; it writes new `*.verify.test.ts`), then ≤2 fix rounds (first Sonnet, then the
  session model), then a Sonnet commit agent. "ok" requires green tests, no major fidelity issue,
  and ≥90% checklist coverage.
- **Shipping a content batch** (Whirr's `w9-factions`): checks, then
  `npm run sim -- --games 6 --seed 5`, then an e2e spec plus screenshots, then update STATUS.md,
  append rulings, rebase on origin/main, and push.

### B.3 Concurrency and git hygiene
- **Shared working tree.** Concurrent agents never run `npm install` or `git commit`, and never edit
  `package.json` or `STATUS.md`, unless told to. Concurrent installs corrupted `node_modules`. Only
  commit and integration agents install.
- **Parallel content batches run in git worktrees** (`.claude/worktrees/<name>`), one Workflow run
  each. Each agent must call `EnterWorktree` first, because a harness hook refuses Edit/Write into a
  sibling worktree even with a directory grant. Shared registries (STATUS, rulings, checklist, sound
  and figure maps, sim lists) merge by keeping both sides.
- **Stage files by exact path** when other sessions share the tree.
- **After an interrupted run:** run `git status`, then
  `npm run typecheck && npm test && npm run validate:data`, and commit by hand. Park
  half-finished work on a `wip/<stage>` branch.
- **Paths.** The repo must sit inside the session's working directory (`WarMForge\<repo>`). The
  Workflow tool rejects a `scriptPath` outside it. Workflow scripts stay LF (`.gitattributes`).
- **Commit messages.** `M<n>: <what>`, a blank line, then the Co-Authored-By line for the current
  model (today: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`).
- **CI runners are slow.** Whirr had to loosen the AI timing ceiling for GitHub's runners. Put
  per-decision time budgets behind an env var from the start.

### B.4 Verification (automated, lean)
- `npm run typecheck`, `npm test`, `npm run validate:data`, `npm run sim` (headless bots-only games
  with invariant checks), `npm run bench:ai`, and one Playwright full-game playthrough.
- **Name engine tests by checklist ID**, e.g. `it('EXPO-004 ...')`. Coverage is measured by test
  names against `docs/spec/12-rules-test-checklist.md`, not by line coverage.
- **Playwright serves the Pages sub-path.** It builds, then runs `vite preview --port 4173` at
  `/<repo>/`, so base-path bugs show up locally. `PW_PORT=4183` runs on another port.
- **Hidden-information leak test** (new, mandatory from M1): serialize every seat's view and assert
  it contains none of the other seats' hand ids, secret objective ids, the face-down crisis
  contributions, or the Crossroads card another seat drew. Run it inside the sim on every game.

---

## Part C: tech stack and architecture (reuse Whirr Machine's)

### C.1 Stack
- **Libraries:** Vite 8, TypeScript 7, React 19, three 0.186, @react-three/fiber 9, drei 10,
  zustand 5, Vitest 5, Playwright, ajv + ajv-formats, tsx, and `@breezystack/lamejs` for mp3 encoding.
- **Node 22 in CI.** Vitest 5 prints a harmless EBADENGINE warning on Node 25.
- **TS 7 config:** `paths` without `baseUrl`, with `@/` → `src/`.
- **Vite `base`** is `/<repo>/` in production only. Every asset URL uses `import.meta.env.BASE_URL`.
- **Deploy.** `.github/workflows/deploy.yml` runs on push to `main`: `npm ci`, typecheck, test,
  build, `upload-pages-artifact dist`, deploy. Copy it verbatim from Whirr.
- **Code-split** the client from the engine, data and AI from day one. Whirr's game chunks total
  about 1.1 MB; Mallet shipped one 1.6 MB chunk. The AI planner runs in a Web Worker if it ever
  blocks the main thread (less likely here than in a wargame; measure).

### C.2 Layout (copy the shape)
```
src/engine/        pure rules engine: (GameState, Action) -> events + new state + exactly ONE PendingDecision
  types.ts actions.ts events.ts hooks.ts rng.ts decider.ts view.ts index.ts   <- FROZEN after M0
  dice.ts decks.ts exposure.ts actions/{attack,search,barricade,clean,attract,move,play,crisis,request,handoff,vote}.ts
  crossroads.ts crisis.ts colony-phase.ts zombies.ts survivors.ts exile.ts objectives.ts effects.ts code-hooks.ts
  phases/{setup,player-turns,colony}.ts
src/data/          core/, survivors/*.json, items/{starter,police,grocery,school,gas,library,hospital}.json,
                   crisis/*.json, crossroads/*.json, objectives/{main,secret,betrayal,exiled}.json,
                   personas/*.json   (validated by tools/validate-data.ts against docs/spec/schemas/)
src/ai/            per-seat decider: turn planner, dice knapsack, risk math, suspicion model, persona, talk
src/client/        store/ (zustand, the ONLY caller of engine.step), table/ (board, locations, figures, zombies),
                   hand/, dice/, interaction/, presentation/ (director + presentedStore + feed + talk bubbles),
                   ui/, vfx/, audio/
tools/             sim.ts, sim-core.ts, ai-bench.ts, validate-data.ts, gen-audio.ts, compose-audio.ts,
                   measure-audio.ts, audio-manifest.json, audio-src/, workflows/*.js
docs/spec/         00-architecture 10-rules-core 11-objectives 12-rules-test-checklist 13-golden-examples
                   20-data-schema 21-card-effects-dsl 30-art 40-ai 41-personas-and-talk 50-client 60-testing
                   sources/*-sources.md schemas/
docs/needs-rules-check.md
art/unit-concepts/*.png + PROMPTS.md, art/figure-sheets/, art/board/, art/archive/
public/assets/{models,board,ui}, public/audio, public/sounds.html
tests/{engine,data,ai,client,e2e,fixtures}
```

### C.3 Engine principles that paid off (keep all of them)
- **Pure, seeded, replayable.** Seeded RNG, an action log, and `save/load/replay`. The engine never
  imports data; the data bundle is passed in.
- **Illegal input is rejected, never thrown.** `step` returns a rejection with a code.
- **The same Decider interface for the human and the bots.** `decide(view, decision)`; a decider
  only ever receives its **seat's view** (see C.4).
- **`legalActions` is never empty for an open decision.** Feasibility means "some candidate passes
  full validation". Mallet froze twice on this; the sim asserts it every step.
- **Data-driven cards.** Items, crises, crossroads options, objectives and survivor abilities are
  declarative JSON (triggers, conditions, effects, scopes, durations), with `{"code": "<hook>"}`
  escape hatches registered in `code-hooks.ts`. With 80 Crossroads, 20 crises, about 145 items and
  54 objectives, this is mandatory. Spec `21-card-effects-dsl.md` freezes the effect vocabulary
  before any card is entered.
- **One generic mechanism per concept.** One "kill a survivor" routine (morale, equipped cards to
  hand or shuffled into the location deck, new leader, last-survivor replacement, player
  elimination variant), one "add zombies one at a time" routine with overrun and barricade
  handling, one exposure routine with the bite chain. Everything else calls these.
- **The engine owns every number the UI shows.** Crisis point totals, food needed, zombies to add,
  die requirements, exposure odds, kill probabilities.
- **Read targets from state, not from events.**

### C.4 New for this game: hidden information and many seats
- **Seats.** `seat: {id, kind: 'human'|'bot', persona?, exiled, eliminated}`. 2–5 seats; the default
  table is 1 human + 3 bots.
- **Views.** `view(state, seatId)` is a frozen contract. It hides: other seats' hands (count only),
  other seats' secret objectives, every face-down crisis contribution (count only), the Crossroads
  card held by the seat to the right of the active player (unless the viewer is that seat), and
  deck orders. Bots receive views, never the state. The leak test in B.4 enforces it.
- **Exactly one PendingDecision** still holds, but a decision has a `seat` (who answers) and may be
  `seat: 'all'` for simultaneous votes: the client collects each seat's answer privately (the human
  through a prompt, each bot from its own view) and submits one `castVotes` action. Bots never see
  the human's vote before casting theirs.
- **Decision kinds** (freeze in M0): choose survivors at setup, choose leader, turn action (one
  action at a time, re-planned after each outcome), search keep-or-make-noise, search keep-which,
  crisis contribution, request response (give or decline), crossroads option, bite-spread option,
  new leader, exile placement, votes, objective-specific choices, and item targets.
- **Crossroads triggers are evaluated by the engine** after each resolved action (FAQ 2.1.1: the
  action must finish; a survivor who dies mid-move does not trigger a movement card). The human
  never has to remember a trigger. When the human is the seat to the right, the card is shown to
  them face up at the start of the turn, exactly as at the table.
- **The end-of-game recap reveals everything**: every secret objective, every face-down
  contribution by seat and crisis, every Crossroads card drawn and whether it triggered. This is
  how the human audits that the bots played fair.

### C.5 Client principles that paid off (build these in M3, not retrofitted)
- **A presentation director plus a presented-state store.** The UI shows state as of the animation
  cursor. Bots proceed only when presentation is idle, with a 5 s no-progress watchdog that
  force-answers bot-owned decisions.
- **Decision prompts that explain themselves.** "Search the Hospital with Dr. Okafor? Needs a 3+:
  you have 4, 5. Exposure after the move: 25% wound, 17% frostbite, 8% bite." Build it on day one.
- **Generic N-seat client.** No hard-coded seat count or seat order. Seats sit around the table;
  the human is always the near edge.
- **Performance from the start:** demand frameloop, dpr cap, on-demand shadows, shared figure
  geometry and materials, instanced zombies, a Low graphics setting.
- **Test hooks.** `?test=1` exposes `window.__game`; `?seats=human,bot,bot,bot&objective=samples&seed=`
  skips the start screen; `?gallery` shows the figures; `?fps` shows a perf overlay.
  Invisible DOM proxies `figure-<id>` carry `data-location` and `data-slot`.
- **E2E picks match exact text.**

### C.6 Conventions for this game
- **Table.** 1 world unit = 1 inch, y up, colony board centred at the origin, the six location
  cards around it in the rulebook's arrangement (p5). Figures on round bases; zombies on the
  entrance spaces; dice in a tray at the human's edge; hands as a fan at the bottom of the screen,
  bots' hands as face-down stacks with a count.
- **Cards are first-class objects.** Every card has an id, a face image generated from data (name,
  symbol, text) plus optional art, and a 3D card mesh for the table (search reveal, crisis pile,
  waste pile). Card text renders from JSON; there is no card art with baked text.

---

## Part D: art, sound and music direction

### D.1 Look
- **Winter at the end of the world.** Snow on everything, cold blue-grey daylight, warm sodium and
  firelight at the colony. The dark-and-gold UI stays (`--bg:#14161a; --fg:#e8e6e1;
  --card:#1e2127; --accent:#c9a227`), with a frost-blue second accent (`#7fb2d6`).
- **Figure proportions** (owner rule, see Part A): mildly stylized heroic proportions, about 4–5
  heads tall, detailed clothing and gear, never cute. Say it in those words in every prompt.
- **Survivor figures (settled: full 3D).** One Gemini concept per survivor (full body, front
  three-quarter view, plain white background, winter clothing, a prop that tells the occupation,
  no text, no logos), then the Hunyuan pipeline (D.3) to a GLB on a round black 30 mm base, about
  1.2" tall. 30 survivors in batches of about 8. Keep a procedural fallback figure so a missing GLB
  never blocks a build.
- **Zombies.** 3–4 Hunyuan GLBs (shambler, crawler, bloated, frozen) through the Whirr pipeline,
  instanced; about 6k triangles each. Entrance spaces hold one zombie each.
- **Board.** A 3D colony board (walls, gate entrances numbered 1–6, a watchtower, barrels, the
  morale and round tracks as physical sliders) and six location tiles with a small diorama each
  (police station, grocery store, school, gas station, library, hospital), each with its survivor
  slots, its single zombie entrance, its noise slots and its item deck.
- **Original markings from day one.** No Plaid Hat or Fantasy Flight art, icons or trade dress.
  Item symbols (weapon, fuel, education, food, medicine, tool, survivor) are our own icons.

### D.2 Concept images: Gemini via Claude in Chrome
- **Browser.** Claude in Chrome on the **Windows PC**, signed into the owner's Google account.
  First run `list_connected_browsers` and confirm a Windows browser is connected. Never the Mac,
  never the built-in browser.
- **One Gemini chat per batch of about 8 concepts**, for style consistency. File name = survivor
  slug (`art/unit-concepts/<slug>.png`).
- **Concept prompt template** (own words only):
  > Generate an image of a [OUR DESCRIPTION: e.g. "woman in her fifties, former school nurse, heavy
  > parka with a red cross armband, carrying a medical bag"], full body, front three-quarter view,
  > standing, mildly stylized heroic proportions about four and a half heads tall, detailed
  > clothing and gear, winter apocalypse setting, plain white background, even soft lighting, no
  > shadows, no text, no logos.
- **Reference images go in through the file input**, never the clipboard (Part A). Refs live in
  `WarMForge\refs-local\` outside the repo.
- **Download with in-page JS** (`javascript_tool`): canvas for `blob:` images, or
  `fetch(src.split('?')[0] + '?alr=yes', {credentials:'include'})` for lh3 images, following
  text-body redirects until the blob type is `image/*`. Bundle `{slug: dataURL}` into one JSON
  download per tab. `javascript_tool` times out at 45 s: start loops un-awaited and poll
  `window._log`. Background tabs throttle: screenshot the tab to bring it forward.
- **Then Hunyuan.** Put each concept's absolute path in `picks.json` and run the D.3 stages per
  batch. Look at the contact sheets before wiring, and check head-to-height ratio on every concept
  before the shape stage.

### D.3 3D pipeline (Windows PC, outside the repo)
All 30 survivors, the zombies and the board props go through it. Full detail is in Whirr's
`docs/WARMACHINE-HANDOFF.md` Part D.3 and the memory note `hunyuan3d-model-pipeline`.
- Folders: `C:\Users\antho\Hunyuan3D-2` (Python 3.11 venv, cutout and paint) and
  `C:\Users\antho\Hunyuan3D-2.1` (Python 3.10 venv, shape and finalize). `uv` is at
  `~\.local\bin\uv.exe` with `UV_SYSTEM_CERTS=1`.
- Stages: `stage_cutout.py` → `stage_shape.py --only <slugs>` → `stage_paint.py --only <slugs>` →
  `stage_finalize.py <repo>\public\assets\models <slugs>`. Look at the contact sheets before wiring.
- Gotchas: don't upgrade `transformers` 4.48.3 or `diffusers` 0.32.2; PowerShell 5.1 writes JSON
  with a BOM; weights are plain files under `~\.cache\hy3dgen`; decimate to about 6k triangles.
- Throughput: a 5-model batch takes about 12 minutes; one batch of about 8 survivors per stage,
  then finalize, wire, commit and push. Survivors are about 1.2" on 30 mm bases; zombies the same.
- Game side: copy Whirr's `src/client/figures/{glbModels,GlbBody,glbLoader}.ts` and the gallery
  (`?gallery`). Before overwriting GLBs, `git mv` the old ones to `art/archive/` in the same commit.

### D.4 Sound, voice and music
**SFX and voice pipeline (copy Whirr's tools verbatim):**
- `POST https://api.elevenlabs.io/v1/sound-generation` with `{text, duration_seconds,
  prompt_influence}` and an `xi-api-key` header. TTS uses `eleven_flash_v2_5`.
- `tools/audio-manifest.json` items are `{id, kind: sfx|voice|music, prompt|text, voiceId?,
  durationSeconds, promptInfluence, loop?}`, mirrored at runtime in `src/client/audio/manifest.ts`.
- `tools/gen-audio.ts` is idempotent, skips existing files, has a per-run credit ceiling and
  `--kind=music` opt-in. `measure-audio.ts` prints RMS, peak and crest; target RMS 0.15–0.18; trims
  in `src/client/audio/trims.ts`. `compose-audio.ts` layers clips from `tools/audio-src/`.
- `public/sounds.html` is the audition page. The owner names the ids to redo.
- Prompt lessons: describe the mechanism, state exclusions ("no music", "no clicks"),
  `promptInfluence` 0.45–0.75, durations 0.5–1.5 s, deaths 1.2–3 s.
- Audio manager: Web Audio unlocked on the first click; master, effects, narrator, voices and
  music volumes plus mute persisted; music bus about −14 dB under SFX, ducked −6 dB under speech,
  crossfades ≥1.5 s.

**Voices (new: this game talks).**
- **One narrator** (weary, cold, close-miked; audition 3 library voices, owner picks) reads
  Crossroads cards, crisis reveals, the colony phase summary, exile verdicts and the ending.
- **One voice per persona** (Part H.7): 4–6 distinct library voices, so the human can tell who is
  speaking with eyes on the board. Each persona has a bank of about 60 short lines (Part H.6),
  pre-generated once. Estimate: 6 personas × 60 lines × 50 characters = 18k characters, about 9k
  credits (**verify** pricing).
- **Crossroads narration:** the first 20 cards voiced, the rest text (settled, Part A).
- Keep all generated text in `tools/audio-manifest.json` so a regenerate is one command.

**Sound list to plan (first pass, about 50 files):**
- Ambience: winter wind loop, snow creak, a distant generator, a colony fire crackle, a far-off
  moan chorus that swells with zombie count.
- Dice: rattle and drop (3, 4, 5 dice), a single die flip for the exposure roll (a longer, heavier
  die), the food-token "bump" when a die is increased.
- Cards: draw, flip, shuffle, play to waste, slide face down into the crisis, equip click.
- Actions: search rummage (per location flavour: metal lockers, shelves, paper, pump handle),
  barricade hammering, attract (a whistle or a thrown bottle), clean waste (dragging bags).
- Combat: melee thud, gunshot, zombie drop; attack-a-survivor scuffle and a card snatched.
- Exposure: a wound grunt, frostbite shiver and teeth, the bite scream, the bite-spread heartbeat.
- Colony phase: a crisis bell, the crisis reveal shuffle and card flips, a morale drop (a low
  string and a wind gust), starvation stomach growl, zombies arriving at the gate, an overrun
  crash and scream, the round-tracker tick.
- Social: a vote countdown "3, 2, 1" (narrator), thumbs clack, an exile door slam, a request knock.
- Narrator lines in our own words: round start, crisis named, "the dead reach the gate", vote
  called, exiled, main objective complete, "the colony falls", winners and losers.

**Music (ElevenLabs Music, settled):**
- A title theme (60–90 s, loopable), two colony loops (2–3 min, low intensity, sparse piano and
  strings over wind), one tension loop for crises and votes (crossfaded in), a betrayal reveal
  sting, victory and defeat stingers. Direction: cold, intimate, no vocals, no drums until the
  tension loop. Music cost about 12.5 credits per second in Whirr; confirm before passing 5k.

### D.5 Table, lighting and UI
- **Lighting:** cold key from a low winter sun, blue ambient, warm point lights at the colony fire
  and the gas station lamps. Light snowfall particles at Low cost; off in Low graphics.
- **Start screen.** Title art (Gemini) that scales by height. Setup panel: seats (human plus 1–4
  bots, each with a persona and a difficulty), main objective (or random), variants (standard,
  betrayer, hardcore, co-op, player elimination, mature cards on or off), animation speed,
  settings popover. Start above the fold at 1280×760.
- **In game:** the table in the centre; the human's hand fanned at the bottom; the dice tray and
  food tokens at the bottom right; the colony tracks on the board and mirrored in a slim top bar
  (morale, round, food, waste, crisis points so far as "cards added: n", zombies at the gate);
  a right rail with the event feed and the table talk bubbles; a left rail with the seats (leader
  portrait, followers, dice left, hand count, exiled badge); prompts dock near what they are about.
- **Secret objective** is always one click away and its progress is computed by the engine
  ("2 of 3 medicine cards; the main objective is not yet complete").

---

## Part E: the Dead of Winter rules, as the engine must implement them

**Primary sources.** The rulebook (R) and FAQ v1.1 (F) in `refs-local\dow-sources\`. Write every
word of our docs in our own words; do not quote the rulebook or any card at length. Card text
always beats the rulebook (R p15). If two effects would trigger at once, the first player decides
the order. An item card cannot interrupt an effect in progress (a medicine card cannot stop a
third wound from killing).

### E.1 Components and quantities (R p2)
10 double-sided main objectives (normal and hardcore), 24 secret objectives, 10 betrayal secret
objectives, 10 exiled secret objectives, 30 survivors, 25 starting items, six location decks of 20
items (police station, grocery store, school, gas station, library, hospital), 20 crisis cards, 80
Crossroads cards, 25 wound tokens (wound on one side, frostbite on the other), 20 helpless
survivor tokens, 20 food, 20 noise, 20 barricade, 6 starvation, 30 zombie standees plus 30 zombie
tokens for overflow, 30 survivor standees, 30 action dice (d6), 1 exposure die (d12). Item symbol
types: Weapon, Fuel, Education, Food, Medicine, Tool, Survivor.

### E.2 Board (R p5)
- The colony board has six numbered entrances, each with zombie/barricade spaces, survivor spaces
  ("Colony Occupants"), the morale track, the round track, the food supply, the main objective slot,
  the waste pile, the crisis deck and the crisis contribution area. **(verify)** the number of
  spaces per entrance and the number of survivor spaces by counting them on board photos.
- Each location card has survivor spaces, one entrance with zombie/barricade spaces, 4 noise
  spaces, its item deck, and a row of item symbols ordered from most to least likely. **(verify)**
  the space counts and symbol order per location from photos; they differ per location.

### E.3 Setup (R p6–7)
1. Choose a main objective or draw one; set morale and the round track and add zombies as it says.
2. Secret objectives: shuffle the non-betrayal cards, set aside 2 per player face down, add 1
   betrayal card, shuffle those together, deal 1 per player, box the rest unseen. With n players
   the chance that a betrayer is at the table is n/(2n+1): 44% at four seats. Betrayer variant
   (R p15): 1 non-betrayal per player plus 1 betrayal, so n/(n+1).
3. Shuffle the crisis deck onto the board; make the survivor, exiled-objective and Crossroads decks.
   Mature-themed Crossroads cards carry a mark and may be removed before play.
4. Deal 5 starting items per player (7 in the two-player variant); box the rest.
5. Shuffle each location deck onto its card.
6. Deal 4 survivors per player; each keeps 2 (3 in the two-player variant), returns the rest, and
   the survivor deck is reshuffled. One kept survivor is the group leader; the others are followers.
   All start at the colony.
7. The player whose leader has the highest influence takes the first player token.

### E.4 Round order (R p8, p12–13)
**Player turns phase**
1. Reveal the top crisis card.
2. Each player discards all dice from last round and rolls 1 die + 1 per survivor they control
   (3 dice at the start). Dice belong to the player's group, not to a survivor; several dice may be
   spent on one survivor.
3. Turns clockwise from the first player. At the start of each turn the player to the **right**
   draws a Crossroads card and keeps it secret. The active player performs any number of actions
   until done or out of options.

**Colony phase**, in order:
1. **Pay food:** remove 1 food per 2 survivors at the colony (round up; helpless tokens count;
   survivors away don't). If short: remove no food, add 1 starvation token, lose morale equal to
   the number of starvation tokens now in the supply (F 6.1.1: no morale loss on rounds you *can*
   pay). Starvation tokens never leave unless a card says so.
2. **Check waste:** lose 1 morale per full 10 cards in the waste pile.
3. **Resolve crisis:** shuffle the face-down contributions, reveal one at a time. Each card with a
   matching prevent symbol is +1; each other card is −1. Total ≥ number of non-exiled players
   prevents the crisis; total ≥ players + 2 also gains 1 morale; otherwise the crisis effect
   happens. Some crises have an optional extra contribution for a bonus. Remove all contributed
   cards from the game.
4. **Add zombies** (F 6.2.1 order): all colony zombies, then a morale check; each non-colony
   location in order, then a morale check; then noise: for each noise token at a location, roll a
   d6 and add a zombie on 3 or less, then a morale check. Colony: 1 zombie per 2 survivors there
   (round up, helpless count). Non-colony: 1 per survivor there.
5. **Check main objective:** if complete, the game ends immediately.
6. **Move the round tracker** down 1; at 0 the game ends immediately (no objective check).
7. **Pass the first player token to the right.**

### E.5 Actions that need a die (R p8–10)
- **Attack.** Spend a die ≥ the survivor's attack value; target a zombie or survivor at the same
  location. Zombie: killed, removed; roll exposure on the attacker. Survivor: roll the spent die;
  if the result ≤ the target's **attack value**, the target takes 1 wound and the attacker steals a
  random card from the target's hand. No exposure roll when attacking a survivor. You cannot
  attack your own survivors or helpless survivors. A survivor may attack several times per turn,
  one qualifying die each.
- **Search.** Any location except the colony. Spend a die ≥ the search value; draw 1 card and look
  at it. Then either keep it (end), or place a noise token on an empty noise space to draw another;
  repeat while noise spaces remain (4 per location per round). Keep exactly 1 of the drawn cards;
  the rest go to the bottom of that deck. Several searches per turn are allowed.
- **Barricade.** Any die; place a barricade token on an empty entrance space at the survivor's
  location.
- **Clean waste.** Needs a survivor at the colony; any die; remove the top 3 waste cards from the
  game.
- **Attract.** Any die; move 2 zombies from any location(s) to empty entrance spaces at the
  survivor's location. Only into empty spaces: attract never overruns or breaks barricades
  (F 5.1.1; same for the Microphone item).
- **Survivor ability with a number** `(N+)`: a die ≥ N each use; repeatable unless the card says
  "once per round". (F 1.2.1: Loretta Clay's `(4)` is a misprint for `(4+)`.)

### E.6 Actions that need no die (R p10–11)
- **Play a card** (own turn only): to the waste pile, unless it has an Equip effect, in which case
  it is attached to one of your survivors and stays until contributed to a crisis or handed off. A
  survivor who dies at the colony returns equipped cards to the controller's hand; elsewhere they
  are shuffled into that location's deck. Food cards that add several food tokens still count as
  1 card in a crisis.
- **Add cards to the crisis:** any number, face down, from hand or from equipped items. Hidden
  from everyone until the colony phase (this is the betrayer's main tool).
- **Move a survivor:** each survivor once per turn, to any location with an empty survivor space;
  roll exposure after each move. A bite rolled on a move spreads at the destination.
- **Spend food tokens:** +1 to one unused die per token; not above 6; only if an unused die exists
  (F 5.3.1).
- **Request:** ask other players for item cards. A given card is revealed and played immediately
  (for its effect or to pay for an ability, F 5.2.1); the rulebook says it cannot go to the
  crisis, while F 3.1.2 lets Outsider cards be requested and played into a crisis.
  **RULING needed**; recommended: requested cards cannot be contributed to the crisis.
- **Hand off:** an equipped item to another survivor at the same location; a once-per-round
  ability already used this round stays used.
- **Vote to exile:** once per turn, name another player; everyone votes yes or no simultaneously;
  the first player breaks ties. Players may talk before voting (R p15).

### E.7 Exposure and bites (R p11)
- Roll after every move and every zombie kill. Faces: blank (nothing), wound (1 wound token),
  frostbite (1 frostbite token, which is a wound and adds 1 more wound at the start of each of your
  turns while any frostbite remains), bitten (the survivor dies and the bite spreads).
- Face counts on the d12 **(verify by counting a physical die; community sources say 6 blank,
  3 wound, 2 frostbite, 1 bite)**.
- **Spread:** the bite passes to the lowest-influence survivor at that location. Its controller
  chooses: kill that survivor (stops), or roll again: blank means safe and stops, anything else
  kills and spreads on. It ends on a kill-choice, a blank, or no survivors left there.
- 3 or more wounds kills. Every killed survivor, helpless ones included, costs 1 morale (not when
  the exiled player's survivor dies). Removing a survivor from the game by a card effect is not a
  kill and costs no morale unless the card says so.

### E.8 Zombies (R p13)
- Added one at a time. At the colony the first goes to any empty space at entrance 1, the second
  at entrance 2, and so on round to entrance 6 and back to 1. If an entrance has no empty space but
  has a barricade, destroy one barricade and drop that zombie. If it has neither, the entrance is
  overrun: drop the zombie and kill the lowest-influence survivor at the colony (a helpless one if
  only helpless remain; nothing if no survivors are there). Non-colony locations have one
  entrance; the same rules apply.
- Killing a zombie at the colony: choose any entrance's zombie. Run out of standees: use tokens.

### E.9 Survivors (R p14)
- Added survivors join the colony; the controller may use them this turn but gets their die only
  at the next roll step. If the colony has no empty survivor space, Crossroads and items that would
  add survivors (helpless ones too) cannot be triggered or played.
- Leader killed: pick a new leader from the following. Last survivor killed: discard your whole
  hand, draw a new survivor as leader at the colony (exiled: at a non-colony location of your
  choice, F 6.2.1). Player elimination variant: that player is out instead.

### E.10 Crossroads (R p12; F 2.x)
- Drawn by the seat to the right at the start of every turn, kept secret, revealed only if its
  trigger happens during the active player's turn, after the triggering action resolves. The
  active player chooses one option (the other if one is impossible); the card is removed from the
  game. Untriggered cards go to the bottom of the deck. Searching a deck for a card reshuffles it.
- Triggers reference events (a move, a search result, a wound type, a location, a survivor type)
  and are therefore declarative predicates in our DSL, evaluated by the engine.

### E.11 Exile (R p14; F 5.4)
- The exiled player draws 1 exiled secret objective (it adjusts their goal), then moves all their
  colony survivors to non-colony locations (normal movement rules including exposure; it does not
  use up their turn's move). From then on: no crisis contributions, no helpless tokens added, new
  survivors from items go to a non-colony location, no food-token die boosts (food cards give +1
  die each instead of their effect), no voting, no morale loss for their deaths, played cards leave
  the game instead of entering the waste pile. They may still request and give cards, contribute to
  the main objective, play food cards for food, and call votes.
- Two exiled players, neither a betrayer: morale drops to 0 immediately.
- No empty slot for an exiled survivor: move a non-exiled survivor back to the colony (no move, no
  exposure), then place the exile there (F 5.4.1).

### E.12 Ending and winning (R p14)
- The game ends immediately when morale reaches 0 or the round track reaches 0 (no objective
  check in either case), or when the main objective is found complete in colony phase step 5.
- Each player wins if and only if their secret objective is complete at that moment. Several can
  win; everyone can lose.

### E.13 Variants (R p15)
Co-op (hardcore side, no secret objectives, no exile, remove non-co-op cards), two-player (co-op
rules, 7 starting items, keep 3 of 4 survivors), betrayer variant (see E.3), hardcore (normal game
on the hardcore side), player elimination (see E.9). Build the standard game first; the variants are
flags on setup.

### E.14 Worked examples to turn into golden tests (spec `13-golden-examples.md`)
Attacking a zombie (R p9), attacking a survivor (R p9), searching with noise (R p10), resolving a
crisis with a wrong-symbol card (R p12), adding seven zombies with an overrun at entrance 3 (R p13),
and the three-round starvation example (F 6.1.1).

---

## Part F: IP and naming

- **Who owns what.** Dead of Winter was published by Plaid Hat Games (2014). Asmodee acquired
  Plaid Hat in 2015; when founder Colby Dauch bought the Plaid Hat brand back in February 2020, the
  Dead of Winter rights **stayed with Asmodee**, published by Fantasy Flight Games. Treat
  "Dead of Winter", "Crossroads" (the series mark) and the Plaid Hat and FFG marks as protected.
  The illustrations (Fernanda Suarez), the card text (Mr. Bistro) and the survivor characters are
  copyrighted expression. **(verify)** the 2026 status with one search before the README is written.
- **Mechanics and numbers aren't copyrightable.** Expression is: prose, card text, art, character
  names and portraits, and the stories.
- **Settled posture (owner, 2026-10-09): Mallet posture.**
  - Survivor, objective, crisis, Crossroads and item names may match the real cards; stats and
    mechanics are 1:1.
  - Every sentence of card text, story, persona line and UI copy is in our own words, written from
    a one-line mechanical summary, never by paraphrasing the original text sentence by sentence.
    Crossroads flavour text is rewritten as a new vignette that leads to the same two options.
  - Our own portraits, figures, icons and trade dress; no "Dead of Winter-compatible" wording.
- The specs keep the "source card" column (`docs/spec/sources/*-sources.md`) with the page or URL
  each value came from.
- **Community data** (fan wikis, the BoardGameGeek card spreadsheet) is a research aid only. Never
  commit it, and never commit the rulebook PDF. The README states: an unofficial fan project, not
  affiliated with Plaid Hat Games, Fantasy Flight Games or Asmodee.

---

## Part G: the first release content

Everything here is data entry with sources. Confidence: **R** = from the rulebook text (high),
**(verify)** = from fan sources or memory (medium or low; check two sources).

**Sources for card data (read once, into `docs/spec/sources/`):**
- The rulebook's own card examples: Forest Plum, Gabriel Diaz, Sophie Robinson, Alexis Grey,
  Daniel Smith, Brian Lee, Olivia Brown, Ashley Ross, Mike Cho (R p7, p9–10); the Blizzard, Fuel
  Shortage and Hunted cards (R p4, p12); the ten main objective and ten betrayal story titles
  (R p16–19).
- FAQ v1.1 for abilities of John Price, Loretta Clay, Edward White, Rod Miller, Harman Brooks,
  Sparky, Buddy Davis, Janet, Jenny and the Bev Russel, Old Divisions and Outbreak Crossroads.
- The Dead of Winter Fandom wiki (`deadofwinter.fandom.com`, pages Survivors, Cards, Main
  Objectives, Crisis Cards, Locations) and the BoardGameGeek files section for *Dead of Winter*
  (thing 150376; there is an "all crossroad cards" spreadsheet, filepage 160324). **Both block
  `curl` and WebFetch**; read them through Claude in Chrome on the PC. BGG downloads need a login:
  ask the owner for that one file.
- TV Tropes `Characters/DeadOfWinter` loads with a browser user agent and lists many stats in prose.
- Photos of the board and location cards from store listings, for space counts and symbol order.

**G.1 Survivors (30; stats as influence / attack / search).** Known so far:

| Source survivor | Influence | Attack | Search | Ability mechanics (our words) | Confidence |
|---|---|---|---|---|---|
| Alexis Grey, librarian | 68 | (verify) | (verify) | Library: once per round, when searching there, look at and keep 1 extra card | R p7 (number partly legible) |
| Daniel Smith, sheriff | 66 | 2+ | 5+ | Anywhere (4+): kill 2 zombies at his location with a single exposure roll | R p7 |
| Thomas Heart, soldier | 64 | 1+ | 3+ | Colony: once per round kill 2 zombies there without exposure (verify) | fan sources |
| Gabriel Diaz, fireman | 60 | 2+ | 3+ | Anywhere: once per round reveal the top 4 of a location deck; keep 1 Outsider card if any; shuffle the rest back | R p7 |
| Olivia Brown, doctor | 56 | (verify) | (verify) | Anywhere: once per round remove any wound token from a survivor at her location, herself included | R p7 |
| Ashley Ross, construction worker | 52 | 2+ | (verify) | Anywhere: once per round barricade without spending a die | R p9 |
| Mike Cho, ninja | 30 | 2+ | (verify) | No exposure roll when attacking | R p9 |
| Carla Thompson, police dispatcher | 22 | 4+ | 2+ | Police station: look at and keep 1 extra card when searching | fan sources |
| Forest Plum, mall Santa | 14 | (verify: 2+ or 3+) | 5+ | Anywhere: at the start of your turn remove him from the game to gain 1 morale | R p3, p10 |
| Sparky, stunt dog | 10 | 2+ | 2+ | A bitten exposure result is a wound instead | F 1.1.1, fan sources |
| Sophie Robinson, pilot | (verify) | (verify) | 1+ (verify) | Anywhere: once per round look at the top card of a location deck and put it back | R p7 |
| Brian Lee, mayor | (verify) | (verify) | (verify) | Anywhere: once per round increase one unused die by 1 | R p7 |
| Loretta Clay | (verify) | (verify) | (verify) | A (4+) ability involving food (verify) | F 1.2.1 |
| John Price | (verify) | (verify) | (verify) | Copies the abilities of survivors at his location while there | F 1.1 |
| Edward White | (verify) | (verify) | (verify) | Spend an attack die plus a medicine-symbol card for an extra effect (verify) | F 1.3 |
| Harman Brooks | (verify) | (verify) | (verify) | Frostbite results become wounds | F 1.1.1 |
| Rod Miller | (verify) | (verify) | (verify) | No exposure roll when moving | F 1.1.1 |
| Buddy Davis | (verify) | (verify) | (verify) | Survivors at his location need 4 wounds to die | F 1.1.5 |
| Janet (surname verify) | (verify) | (verify) | (verify) | Hospital: keep 1 extra card when searching | F 1.1.2 |
| Jenny (surname verify) | (verify) | (verify) | (verify) | Look at 3 extra cards when searching | F 1.1.2 |
| Remaining 10 survivors | | | | From the wiki survivor table | (verify) |

Names may be kept (Mallet posture). Each survivor gets our own concept, figure and ability text.

**G.2 Locations (6) and decks (6 × 20 plus 25 starting items).** Per location: survivor spaces,
entrance spaces, item symbol order, and the 20-card deck composition by type and the Equip and
Outsider cards in it. All **(verify)** from the wiki and photos. Starting items are a mixed deck of
the basic types.

**G.3 Main objectives (10, two sides each).** Source titles (R p16–17): X Weeks of Darkness, Kill
Them, Find a Cure, Home Sweet Home, Raiding Party, Leave it all Behind, Stockpile, Winter Has Come,
Too Many Mouths, We Need More Samples. Verified values:
- *We Need More Samples* (R p6, p15): morale 6, rounds 6, +1 zombie at each non-colony location;
  after every zombie kill roll a d6 and on 4+ place the zombie on the card; collect 3 per player
  who started. Hardcore: morale 6, rounds 5, +3 zombies at each non-colony location. Time: short.
- *Find a Cure* **(verify, BGG thread)**: morale 5, rounds 6; contribute 2 medicine cards per
  starting player (3 on hardcore); hardcore adds 12 zombies to the colony and 2 per location.
- The other eight: **(verify)** from the wiki. Each card also has a time rating (short 45–90 min,
  medium 90–120, long 120–210).

**G.4 Secret objectives (24 standard, 10 betrayal, 10 exiled).** Standard ones usually require the
main objective plus a private condition (for example "the main objective is complete and you hold
at least 3 food cards", R p3). Betrayal titles (R p18–19): Gluttony, Runaway, Take Over, All for
One, Accept Your Fate, Trigger Happy, Cult Leader, Serial Killers, Mad Scientist, Obsessed; their
mechanics **(verify)**. Exiled objectives adjust an exiled player's goal **(verify)**.

**G.5 Crisis cards (20).** Each: prevent symbols, fail effect, optional bonus. Known: Blizzard
(fail: non-exiled survivors cannot move until the end of next round, lose 1 morale; optional +2
cards for +1 morale), Fuel Shortage (fail: lose 2 morale; optional +2 cards for +1 morale) (R p4,
p12). The rest **(verify)**.

**G.6 Crossroads (80).** Each: a trigger predicate, flavour text, and two options with effects.
Known: Hunted (trigger: a non-frostbite wound from an exposure roll after moving; options: roll
exposure twice on each of your survivors, or for the rest of the game every move also rolls a d6
and wounds on 2 or less) (R p4); Bev Russel, Old Divisions, Outbreak (F 2.x). The rest from the
BGG spreadsheet **(verify)**. Mature cards carry the flag.

**G.7 The first slice (M3)**: four seats, *We Need More Samples*, the 6 locations with real deck
compositions, 12 survivors (the first 12 rows above), 8 crisis cards, 20 Crossroads cards, the
standard secret objectives and 3 betrayal objectives. Everything else lands in M8 batches.

---

## Part H: the AI colonists (the heart of this game)

### H.1 What a bot must do
Everything a human seat does: pick survivors and a leader; plan a turn from its rolled dice (which
survivor searches where, who fights, who barricades, when to spend food on a die); decide what to
put into the crisis face down; answer requests; make requests; choose Crossroads options; choose
in a bite chain; vote; and, when exiled, keep playing its adjusted goal. It does all this from its
**view only** (C.4).

### H.2 Turn planner
- **Goal vector** per seat, re-weighted by role: colony survival (morale, food after this round's
  pay, waste, zombies at the gate and at its own locations, crisis points so far), secret-objective
  progress, survivor safety (expected wounds from exposure rolls), hand quality, and **public
  image** (how its visible actions will read to the table).
- **Dice knapsack.** Enumerate assignments of rolled dice (plus food boosts) to candidate actions
  per survivor, score each full plan with closed-form odds (exposure face odds, search hit chance
  from the deck's known symbol order and the cards already seen, attack-a-survivor odds), take
  the best, then re-plan after every resolved action because searches and exposures change the
  state. Beam width 3–5 is enough; a turn has few dice.
- **Movement risk** is explicit: each move costs an exposure roll; bots keep survivors home when the
  die isn't worth it, and prefer the location whose symbol order matches the crisis and their
  objective.
- **Crisis contribution** is a separate decision at the end of the turn: a loyal bot contributes
  matching cards up to the colony's shortfall (estimating others' contributions from their visible
  behaviour and persona talk), never over-contributes its objective cards, and may say what it
  put in (truthfully or not, by persona).

### H.3 Betrayer play
- A betrayer's colony weight is **negative on hidden channels** (wrong-symbol cards into the crisis,
  hoarding the objective's needed items, declining requests with a plausible reason, choosing the
  morale-costing Crossroads option when it can be framed as unlucky) and **positive on visible
  channels** (killing zombies, barricading) to maintain cover.
- **Cover budget.** The betrayer tracks the suspicion it believes each other seat holds about it
  (H.4 run on itself) and stays under the exile threshold until the round where losing the vote no
  longer matters. Hard mode plays the long game; easy mode gets greedy early.
- **Tells the human can read:** crisis maths (cards contributed versus points revealed), who was
  where when zombies showed up, who always declines requests, who keeps the medicine when the
  objective needs it. The recap screen shows the betrayer's whole hidden log at the end.

### H.4 Suspicion model (every bot runs it on every other seat)
- Evidence per crisis: the revealed total versus what each seat's announced or implied
  contribution would produce; a shortfall is split over the seats that contributed under a
  "loyal seats contribute matching cards" prior. Also: refused requests when the card was likely
  held (seen through attacks' stolen cards or earlier plays), Crossroads choices that hurt the
  colony, attracting zombies to a location with other seats' survivors, leaving the colony hungry.
- A per-persona paranoia scalar scales the update, and a trust scalar scales how much a seat's
  own statements count.
- **Vote rule:** yes when suspicion exceeds the persona's threshold *and* the colony can afford to
  lose that seat's dice (or the round is late enough that the loss doesn't matter). A bot never
  votes to exile itself and never votes against its own hidden interest if it is the betrayer.
- **Benchmark metric:** exile accuracy (how often loyal bots exile the real betrayer, and how often
  they exile an innocent). Target for Normal: ≥60% correct, ≤15% innocent by game end.

### H.5 Social actions toward the human
- Bots **request** cards from the human with a prompt ("Rook asks you for a Fuel card for the
  crisis. Give one or decline."). Bots **answer** the human's requests by persona generosity,
  suspicion of the human, and need.
- Before any vote, each bot **states a lean** or stays silent (persona), so the human has something
  to read. The human can call a vote like anyone else, once per turn.
- The human can **accuse** a seat from the seat rail (table talk only, no rules effect): bots react
  with lines and a small suspicion update toward the accused and the accuser, by persona.

### H.6 Table talk
- **No runtime LLM.** The site is static on Pages with no API key, so all lines are pre-written.
  A **line bank per persona**, keyed by event (`crisis.revealed`, `crisis.prevented`,
  `crisis.failed`, `vote.called`, `vote.lean.yes`, `vote.lean.no`, `exiled.me`, `exiled.other`,
  `request.give`, `request.decline`, `search.found.<symbol>`, `exposure.bite`, `bite.chain.kill`,
  `morale.low`, `objective.progress`, `game.won`, `game.lost`, `accused.me`, ...), with slot fills
  (seat names, locations, numbers). About 60 lines per persona, written by the session model from
  a persona sheet, in our own words, then checked by a verify agent for copied text.
- Lines appear as speech bubbles on the seat portrait and in the feed; a subset is voiced (D.4).
  Betrayers draw from the same bank: their lines are not marked, but their *behaviour* is.
- Frequency is capped (about one line per bot per turn plus reactions) so the table doesn't babble.

### H.7 Personas (4–6; spec `41-personas-and-talk.md`)
A persona is the *player*, not the survivor; it keeps its voice when its leader dies. Each has:
name, voice id, portrait, and scalars for generosity, risk appetite, paranoia, trust, chattiness and
bluffing. First set: the Quartermaster (careful, counts food), the Optimist (generous, trusting,
talks a lot), the Hard Case (aggressive, blunt, votes early), the Kid (impulsive, risky searches,
loud), the Doctor (methodical, objective-minded, quiet), the Drifter (secretive, declines requests,
rarely votes). Personas are original characters; they do not reuse the real game's survivor names.

### H.8 Difficulty tiers and benchmark
Random (legal moves only), Easy (planner, no suspicion model, naive betrayer), Normal (full
planner, suspicion, cover budget), Hard (deeper beam, better crisis estimation, patient betrayer).
`npm run bench:ai -- --games 50 --seed 1 --seats bot,bot,bot,bot --objective samples` reports: colony
objective rate, betrayer win rate when present, mean rounds, exile accuracy, mean decision time.
Target: Normal loyal tables complete *We Need More Samples* roughly as often as a competent human
table (community reports put it around half the time); a Normal betrayer wins about a third of the
games it is in.

### H.9 Fairness rules (put them in the README)
- Bots see only their own view. The leak test proves it on every sim game.
- Bots roll on the same seeded RNG as the human, in turn order.
- The recap reveals every hidden decision at the end.

---

## Part I: milestone plan

Each milestone is one or more lean workflow stages, ending in a push and something visible.

**M0, Foundation (specs + skeleton)**
- Scaffold the repo (copy Whirr's Vite/TS/R3F/Playwright/deploy setup), `.gitignore` with
  `*.token*`, `Tokens.txt`, `docs/sources/`.
- Write `docs/spec/00`–`60`. Frozen contracts (`types`, `actions`, `events`, `hooks`, `rng`,
  `decider`, `view`, `index`) include from day one: seats and views; one PendingDecision with a
  `seat` (including `'all'`); the decision kinds in C.4; the card-effects DSL (`21`) with
  triggers, conditions, effects, scopes and durations; the kill, add-zombies and exposure
  routines as single mechanisms; engine-exported odds for every prompt.
- Rules checklist with IDs: `SETUP-`, `DICE-`, `ACT-`, `ATK-`, `SRCH-`, `MOVE-`, `EXPO-`, `CARD-`,
  `XRD-` (Crossroads), `CRIS-`, `COL-` (colony phase), `ZOM-`, `SURV-`, `OBJ-`, `EXIL-`, `VOTE-`,
  `END-`, `VIEW-` (hidden information).
- One adversarial review of the specs. **Owner gate:** the four decisions in Part A.

**M1, Engine core and the headless sim, together**
- Decks and dice, the action set, exposure and bite chains, the colony phase, zombies and overrun,
  survivors and leaders, exile, voting, Crossroads evaluation, objectives, the ending; the six
  golden examples (E.14); `validate-data`, the leak test, and `npm run sim` with Random bots and
  a per-game decision cap and stall detector.

**M2, First content slice with verify ON (G.7)**
- Data entry for the first slice with per-value sources; original names and prose under the chosen
  posture; schema validation; a verify agent that checks every mechanic against its source card
  summary and every sentence for copied text.

**M3, Playable vertical slice on Pages (the most important milestone)**
- The 3D table with procedural placeholder figures (coloured discs with a simple body), hands,
  the dice tray, self-explaining prompts with odds, the feed, the seat rail, the secret objective
  panel, the recap screen; Random bots so the owner can play a full game end to end.
- **Owner gates:** the table layout and readability; the figure look through the full pipeline
  on 2 survivors and 1 zombie; the first persona's lines on screen.

**M4, AI colonists (verify ON, benchmark)**
- H.2–H.5 and H.8: planner, dice knapsack, crisis contribution, suspicion, votes, requests,
  betrayer with cover budget, tiers, `bench:ai`. Playtest gate: the owner plays three games and
  says whether the table feels alive and whether the betrayer is findable but not obvious.

**M5, Art pass**
- 30 survivor GLBs (Gemini concepts in batches of 8, then Hunyuan), 3–4 zombie GLBs, the colony
  board and location dioramas, item icons, card faces, title art, start screen.

**M6, Audio, voice and music**
- SFX list, narrator, persona voices for the line banks, the first 20 voiced Crossroads, music;
  `sounds.html` audition and owner feedback rounds.

**M7, Polish**
- Feed with full breakdowns (crisis reveal card by card, exposure rolls with odds, zombie
  placement step by step), narration pauses, settings popover, Low graphics, end screen with the
  recap and a per-seat "what they were really doing" story.

**M8, Full content in batches (verify ON)**
- The remaining 18 survivors, 12 crises, 60 Crossroads, 8 main objectives, all secret and exiled
  objectives, in 3–4 batches; variants (betrayer, hardcore, co-op, two-player, player elimination,
  mature-cards toggle); more personas.

**M9+, Later**
- The Long Night expansion mechanics (only if the owner wants it), multiplayer, voiced table talk
  for all lines.

---

## Part J: bug and lesson list from Mallet 42k and Whirr Machine (avoid repeating these)

**Engine**
- `legalActions` empty for an open decision froze the bot. Keep the invariant in the sim.
- The planner's preferred arrangement was used as the feasibility test. Feasibility is "any
  candidate passes validation".
- Expiry overwrite instead of max on stacking durations. Here: "until the end of the next round"
  effects (Blizzard) must survive a second Blizzard correctly.
- Two of 3,700-decision games hit the 60 s cap. Add a per-game decision cap and a stall detector
  to the sim from M1.
- Whirr: a dozen "not built" card mechanics shipped as known gaps because the DSL lacked a verb.
  Freeze the DSL *after* a dry run that encodes every known card in the first slice.

**Data**
- Whirr marked four factions "unverified" when one source failed. Two sources per value, cited.
- Rulings were appended by many agents and reconciled late; fine, but keep the status words
  (Confirmed, Corrected, Unsourced, App) from day one so the owner can scan them.

**UI**
- The UI showed the previous roll's target; read from state.
- UI arithmetic ignored a modifier; the engine supplies every number.
- The dice tray sat behind the prompt; prompts dock near their subject, the tray has its own rail.
- Some roll types never reached the dice tray; every roll type routes there (exposure included).
- Deploy panel hid Confirm and Reset; panels size to content.
- Camera: right or middle click and Alt/Space never start a drag of a piece. Transitions ≤600 ms.
- Whirr: the owner asked for slimmer collapsible panels (`[` and `]`) and in-game colour options
  late; build collapsible rails in M3.
- E2E text picks must match exactly.

**Audio and art**
- Every weapon played one sound in Mallet; here, every *location* and *symbol* needs its own
  search and reveal sound, mapped in one place (`eventSounds.ts`) that both audio and VFX read.
- Measure loudness and ship trims with the first batch.
- Hunyuan's style reference turns everything blue without `--style 0.2 --avoid`.
- Prompts that named a style ("MGSD", "Gundam") produced the wrong proportions twice. Plain words.
- Whirr's first terrain GLBs were 12k triangles each and hurt frame time; decimate to about 6k.

**Process**
- Concurrent `npm install` corrupted `node_modules`.
- Agents that backgrounded `npm test` stalled.
- A sibling worktree needs `EnterWorktree` first.
- The clipboard incident (Part A). Never again.

---

## Part K: first actions for the next agent

1. Read this file. The four Part A decisions are settled; do not re-ask them.
2. Create the new repo inside `WarMForge\` (the session's working directory), copy Whirr's config
   files (`package.json`, `tsconfig*.json`, `vite.config.ts`, `playwright.config.ts`,
   `.github/workflows/deploy.yml`, `.gitattributes`, `.gitignore`), and write `CLAUDE.md` from
   Part B plus the decided IP rule. Add a `.claude/launch.json` entry next to `whirr-dev` for the
   new dev server on another port.
3. Copy `refs-local\dow-sources\*` into the repo's gitignored `docs/sources/`. Extract text with
   `/mingw64/bin/pdftotext -layout` into the scratchpad for agents to grep.
4. Spend one Claude in Chrome session (PC) reading the Fandom survivor, cards, objectives, crisis
   and location pages and the TV Tropes character page into `docs/spec/sources/` with citations.
   Ask the owner to download the BGG Crossroads spreadsheet (login needed) into `docs/sources/`.
5. Write the M0 workflow script, modelled on Whirr's `tools/workflows/w1-engine.js`, and run it
   lean.

**Whirr Machine files worth copying or reading** (all under
`C:\Users\antho\OneDrive\Documents\WarMForge\whirr-machine\`):
- `CLAUDE.md`, `HANDOFF.md`, `STATUS.md`, `PLAN.md`
- `tools/workflows/w1-engine.js`, `w9-factions.js`, `w10-backlog.js`
- `tools/{gen-audio,compose-audio,measure-audio}.ts`, `tools/audio-manifest.json`
- `src/client/audio/*`, `src/client/presentation/*`, `src/client/dice/*`, `src/client/figures/*`
- `src/engine/{types,actions,events,hooks,rng,decider,index}.ts` (shape of the frozen contracts)
- `docs/spec/00-architecture.md`, `docs/spec/12-rules-test-checklist.md`, `docs/spec/40-ai.md`,
  `docs/spec/factions/*-sources.md` (the per-value source format)
- `art/board-textures/gen.py`, `.github/workflows/deploy.yml`, `playwright.config.ts`,
  `public/sounds.html`

**Memory notes** (in `~\.claude\projects\C--Users-antho-OneDrive-Documents-WarMForge\memory\`):
`whirr-machine-decisions`, `audio-pipeline`, `hunyuan3d-model-pipeline`, `image-generation-browser`,
`do-the-legwork`, `research-before-assuming`, `gemini-clipboard-guard`, `figure-proportions`. The
new repo lives in the same working directory, so these load automatically; add a
`dead-of-winter-decisions` note after the first check-in.
