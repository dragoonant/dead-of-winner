# 30. Art, icons, card faces and assets

The look of the game, how figures and props are made, how cards and icons are drawn, and the asset
manifest the client loads from. All wording here is ours.

**Source keys.** `D.n`, `C.n`, `J` = brief sections (`docs/DEAD-OF-WINTER-HANDOFF.md`). `IP` = the IP
rule in `CLAUDE.md`. `[WIN]` marks a step that runs **only on the owner's Windows PC with the GPU**
(never the Mac, never a cloud container, never the built-in browser). Cloud and Mac agents may
write prompts, manifests and wiring code, and must stop and hand off at every `[WIN]` step.

---

## 30.1 Look (D.1, D.5)

- 30.1.1 Theme: winter at the end of the world. Snow on every surface, cold blue-grey daylight, warm
  sodium and firelight at the colony. (D.1)
- 30.1.2 UI tokens (CSS custom properties on `:root`, the only colour source for DOM UI):
  `--bg:#14161a; --fg:#e8e6e1; --card:#1e2127; --accent:#c9a227; --frost:#7fb2d6`. Derived
  tokens (borders, muted text, danger) are mixes of these; no other hues in chrome. (D.1)
- 30.1.3 Lighting: one cold key light from a low winter sun, blue hemisphere ambient, warm point
  lights at the colony fire and the gas station lamps. Light snowfall particles; off in Low
  graphics. (D.5)
- 30.1.4 Scale: 1 world unit = 1 inch (C.6). Survivor and zombie figures stand about 1.2 in tall on
  round black 30 mm (1.18 in) bases. (D.1, D.3)
- 30.1.5 Title art: one Gemini image [WIN], scaled by viewport height, never cropped below the
  title. (D.5)

## 30.2 Figure prompt rules (D.1, D.2, J, owner rule)

- 30.2.1 Every figure prompt states proportions in plain words, verbatim:
  "mildly stylized heroic proportions, about four and a half heads tall, detailed clothing and
  gear, not cute". (D.1)
- 30.2.2 Banned words in any art prompt (a lint in `tools/validate-data.ts` over
  `art/unit-concepts/PROMPTS.md`): `MGSD`, `SD`, `chibi`, `Gundam`, `mecha kit`, `cute`
  (except inside "not cute"), any publisher or product name. (CLAUDE.md; J "plain words")
- 30.2.3 Every survivor description is our own: age, former occupation, winter clothing, one prop
  that tells the occupation. Write it from the survivor's name and profession only; never from the
  original card art. (IP)
- 30.2.4 Concept prompt template (fill the bracket; keep the rest word for word):
  > Generate an image of a [OUR DESCRIPTION], full body, front three-quarter view, standing,
  > mildly stylized heroic proportions about four and a half heads tall, detailed clothing and
  > gear, winter apocalypse setting, plain white background, even soft lighting, no shadows, no
  > text, no logos.
  (D.2)
- 30.2.5 `art/unit-concepts/PROMPTS.md` holds one row per concept: `slug | batch | description |
  full prompt | date | status (draft/picked/redo)`. File name of the image = `<slug>.png`. (D.2)
- 30.2.6 Before the shape stage, check head-to-height ratio on every concept (target 1:4–1:5);
  reject and regenerate outliers. (D.2)

## 30.3 Concept images: Gemini via Claude in Chrome [WIN] (D.2)

- 30.3.1 Browser: Claude in Chrome on the Windows PC, signed into the owner's Google account. First
  call `list_connected_browsers`; proceed only if a Windows browser is connected.
- 30.3.2 One Gemini chat per batch of about 8 concepts, for style consistency.
- 30.3.3 Reference images go in through the page's hidden file input, never the system clipboard.
  Refs live in `WarMForge\refs-local\`, outside the repo. (D.2; brief Part A)
- 30.3.4 Download with in-page JS: canvas for `blob:` images, or
  `fetch(src.split('?')[0] + '?alr=yes', {credentials:'include'})` for lh3 images, following text
  redirects until the blob type is `image/*`. Bundle `{slug: dataURL}` into one JSON download per
  tab. `javascript_tool` times out at 45 s: start loops un-awaited and poll `window._log`.
  Screenshot a background tab to bring it forward before polling.
- 30.3.5 Then write each concept's absolute path into `picks.json` for the 3D pipeline.

## 30.4 3D pipeline [WIN] (D.3)

- 30.4.1 Scope: all 30 survivors, 3–4 zombie types (shambler, crawler, bloated, frozen), board
  props and the six location dioramas.
- 30.4.2 Folders: `C:\Users\antho\Hunyuan3D-2` (Python 3.11 venv: cutout, paint) and
  `C:\Users\antho\Hunyuan3D-2.1` (Python 3.10 venv: shape, finalize). `uv` at
  `~\.local\bin\uv.exe` with `UV_SYSTEM_CERTS=1`.
- 30.4.3 Stages, per batch of about 8:
  `stage_cutout.py` → `stage_shape.py --only <slugs>` → `stage_paint.py --only <slugs>` →
  `stage_finalize.py <repo>\public\assets\models <slugs>`. About 12 min per 5 models.
- 30.4.4 Paint with `--style 0.2 --avoid`; without it the style reference turns everything blue. (J)
- 30.4.5 Decimate every GLB to about 6k triangles (figures, zombies and terrain alike). (D.3; J)
- 30.4.6 Pinned: `transformers` 4.48.3, `diffusers` 0.32.2. Never upgrade. Weights are plain files
  under `~\.cache\hy3dgen`. PowerShell 5.1 writes JSON with a BOM: strip it before parsing.
- 30.4.7 Look at the contact sheets before wiring any model.
- 30.4.8 After finalize: wire, commit, push, one batch at a time. Before overwriting a GLB, `git mv`
  the old file to `art/archive/` in the same commit.
- 30.4.9 Game side (any machine): copy Whirr's `src/client/figures/{glbModels,GlbBody,glbLoader}.ts`
  and the `?gallery` view. A **procedural fallback figure** (capsule body, sphere head, base disc,
  tinted by seat colour) renders whenever a GLB is missing or fails to load; a missing GLB never
  blocks a build or a test.
- 30.4.10 Zombies render instanced (one `InstancedMesh` per zombie type). One zombie per entrance
  space. (D.1)

## 30.5 Board and table art (D.1, D.5)

- 30.5.1 Colony board: a 3D model with walls, gate entrances numbered 1–6, a watchtower, barrels,
  and the morale and round tracks as physical sliders. Numbers on the gates are geometry or a
  generated texture; never a scanned board.
- 30.5.2 Six location tiles, each with a small diorama (police station, grocery store, school, gas
  station, library, hospital), its survivor slots, its single entrance, 4 noise slots and its
  item-deck spot. Slot counts come from `src/data/core/locations.json` (spec `20` §20.2; spec `10`
  10.2.5), never from art.
- 30.5.3 Until a diorama GLB exists, a location renders as a flat generated card face (30.7) with
  procedural slot markers.

## 30.6 Icons (D.1, IP)

- 30.6.1 Seven item symbols, all our own SVGs in `public/assets/ui/icons/<id>.svg`, 24×24 viewBox,
  single-colour (`currentColor`), readable at 16 px:
  | id | Concept (our design) |
  |---|---|
  | `weapon` | crossed hatchet and pipe |
  | `fuel` | jerry can |
  | `education` | open book with a pencil |
  | `food` | tin can with a pull ring |
  | `medicine` | pill bottle |
  | `tool` | wrench over a hammer |
  | `survivor` | head-and-shoulders silhouette with a plus |
- 30.6.2 Other game icons, same rules: `noise`, `barricade`, `wound`, `frostbite`, `bite`,
  `helpless`, `starvation`, `morale`, `round`, `food-token`, `zombie`, `influence`, `attack`,
  `search`, `exile`, `betrayer`, `mature`.
- 30.6.3 No icon traces, redraws or approximates a Plaid Hat, Fantasy Flight or Asmodee icon. If a
  concept is close by necessity (a book for education), change shape and line style. (IP)
- 30.6.4 Icons are referenced by id from data; data never holds a path.

## 30.7 Card faces (C.6, IP)

- 30.7.1 Every card is drawn from its JSON at runtime: name, type, symbol icon(s), stats, rules
  text, optional art. **No raster has baked text.** (C.6)
- 30.7.2 One React component per card type renders the face to DOM (hand, prompts, recap) and the
  same layout to a `CanvasTexture` (atlas, 512×716 px per face at High, 256×358 at Low) for the 3D
  card mesh (search reveal, crisis pile, waste pile, location decks).
- 30.7.3 Layouts (top to bottom):
  - Item: name; symbol icon top-right; art band (optional); rules text; source location tag.
  - Survivor: name and profession; influence badge; attack and search values with icons;
    portrait (rendered from the GLB or the concept image); ability text.
  - Crisis: name; prevent symbol; failure effect; bonus line (if any).
  - Crossroads: name; trigger condition; vignette (our words); options as numbered lines; mature
    mark if flagged.
  - Objectives (main, secret, betrayal, exiled): name; goal text; setup values (main); betrayer
    or exiled mark.
- 30.7.4 Card backs: one generated back per deck (colour band + deck icon + deck name), no
  publisher trade dress.
- 30.7.5 Text sizing: fit by shrinking the rules-text font in 0.5 px steps to a floor (9 px at
  High); if it still overflows, `validate:data` fails with the card id.
- 30.7.6 Card size in the world: 2.5 × 3.5 in (standard), location cards per 50.2.3.

## 30.8 Asset manifest (`public/assets/asset-manifest.json`)

- 30.8.1 One JSON file lists every non-audio runtime asset. The client never builds an asset path
  by hand; it looks up an id and prefixes `import.meta.env.BASE_URL`. (C.1)
- 30.8.2 Entry shape:
  ```json
  {
    "id": "survivor.forest-plum",
    "kind": "figure | zombie | prop | board | location | icon | portrait | title | texture",
    "path": "models/forest-plum.glb",
    "fallback": "procedural-figure",
    "tris": 5980,
    "scale": 1.0,
    "heightIn": 1.2,
    "concept": "art/unit-concepts/forest-plum.png",
    "pipeline": "hunyuan-2.1 | svg | gemini | procedural",
    "status": "placeholder | concept | model | final",
    "batch": 1
  }
  ```
  `path` is relative to `public/assets/`. `fallback` is required for kinds `figure`, `zombie`,
  `prop`, `board`, `location`.
- 30.8.3 `validate:data` checks: every asset id derived from data exists in the manifest (Ruling D-ARTID in 20:
  the id derives from the record id, also `icon.<symbol>` and `location.<id>`; survivors carry no `art` field); every `path` exists on disk unless `status` is `placeholder`; `tris` ≤ 7000 for
  `figure`, `zombie`, `prop`; no `path` under `docs/sources/`. The JSON Schema lives at
  `docs/spec/schemas/asset-manifest.schema.json` (owned by spec `20`).
- 30.8.4 Audio uses its own manifest (30.9.2); the two never overlap ids.

## 30.9 Sound, voice and music (D.4)

- 30.9.1 Generation [WIN or any machine with the key]: ElevenLabs sound generation
  (`POST https://api.elevenlabs.io/v1/sound-generation`, `{text, duration_seconds,
  prompt_influence}`, header `xi-api-key`) and TTS `eleven_flash_v2_5`. The key is read only from
  `ELEVENLABS_API_KEY`; never written, logged or committed. (CLAUDE.md)
- 30.9.2 `tools/audio-manifest.json` items: `{id, kind: "sfx"|"voice"|"music", prompt|text,
  voiceId?, durationSeconds, promptInfluence, loop?}`, mirrored in `src/client/audio/manifest.ts`.
  All narrator and persona text lives here, in our own words, so a regenerate is one command.
- 30.9.3 `tools/gen-audio.ts`: idempotent, skips existing files, per-run credit ceiling, music only
  with `--kind=music`. `tools/measure-audio.ts` prints RMS, peak and crest; target RMS 0.15–0.18;
  trims ship in `src/client/audio/trims.ts` with the first batch. `public/sounds.html` is the
  audition page.
- 30.9.4 Prompt rules: describe the mechanism, state exclusions ("no music", "no clicks"),
  `promptInfluence` 0.45–0.75, durations 0.5–1.5 s, deaths 1.2–3 s.
- 30.9.5 One narrator voice; one distinct voice per persona (4–6); about 60 lines per persona;
  the first 20 Crossroads cards voiced, the rest text only.
- 30.9.6 Every location and every item symbol has its own search and reveal sound; the event →
  sound/VFX map lives in one file, `src/client/presentation/eventSounds.ts`, read by audio and VFX.
  (J)
- 30.9.7 Music: title theme, two colony loops, one tension loop, betrayal sting, victory and defeat
  stingers; no vocals, no drums outside the tension loop. Confirm cost with the owner before
  passing 5k credits.

## 30.10 Asset work order

1. Placeholders first: procedural figures, generated card faces, SVG icons. Game is playable.
2. Icons (any machine). 3. Board and locations [WIN]. 4. Survivors in batches of 8 [WIN].
5. Zombies [WIN]. 6. SFX, then narrator and personas, then music.

## Rulings

- RULING: card face layouts | our own field order and styling per 30.7.3, no reference to original card layouts | IP rule forbids trade dress; mechanics need only the fields | Confirmed (IP rule)
- RULING: figure height 1.2 in on 30 mm base | used for all survivors and zombies | brief D.1/D.3 numbers | Confirmed (brief)
- RULING: in-world card size 2.5 × 3.5 in | standard poker size for items, survivors, crisis, Crossroads | physical card size not in this container | Unsourced
