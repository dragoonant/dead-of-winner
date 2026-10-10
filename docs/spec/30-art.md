# 30: Art

The look of the table, the figures, the board, the icons and the card faces. Rules never read a mesh: every slot,
count and capacity comes from the engine view (`LocationView.capacity`, `entrances[]`, `noise`, `deckCount`), and the
client lays geometry out from those numbers. Pipeline detail (Gemini via Claude in Chrome, Hunyuan stages) is in the
brief Part D.2–D.3 and the memory note `hunyuan3d-model-pipeline`; this file is the game-side contract. IP posture
(PLAN.md): names may match the real cards; every stroke of art, every icon and every line of text is ours.

## 1. Look

| Aspect | Rule |
|---|---|
| Mood | winter at the end of the world: snow on every surface, cold blue-grey daylight, warm sodium and firelight at the colony |
| Lighting | one low cold key light (winter sun, long shadows), blue hemisphere ambient, warm point lights at the colony fire and the gas-station lamps; light snowfall particles (off in Low graphics) |
| UI | dark and gold on frost blue (§9 tokens); panels are translucent dark cards with a 1 px gold rule; no textures in DOM panels |
| Figures | mildly stylized heroic proportions, about four and a half heads tall, detailed clothing and gear, never cute (owner rule; say it in those words in every prompt; never "SD", "chibi", "Gundam", "mecha kit") |
| Trade dress | none of the publisher's: no logos, no card frames, no icon shapes, no title lettering; our own portraits, symbols and title art from day one |

## 2. Table layout (inches)

1 world unit = 1 inch, y up, the colony board centred at the origin, the human seat at the near (+z) edge (brief C.6).

| Object | Size (in) | Centre (x, z) | Notes |
|---|---|---|---|
| Table top | 60 × 40 | (0, 0) | dark wood under a thin snow dusting at the edges; seats sit on its rim (50 §13) |
| Colony board | 22 × 12 | (0, 0) | long axis along x; gates 1–6 counter-clockwise, seen from above, starting at the far-left corner (verify the start corner from a board photo; R p5 numbers them, R p13 walks them counter-clockwise 1 → 6 → 1) |
| Tile 1 Police Station | 6 × 4 | (−17, −12) | far row, left |
| Tile 2 Grocery Store | 6 × 4 | (0, −14) | far row, centre |
| Tile 3 School | 6 × 4 | (17, −12) | far row, right |
| Tile 4 (verify) Library | 6 × 4 | (−21, 2) | left side |
| Tile 5 (verify) Hospital | 6 × 4 | (0, 9) | near side, between the board and the hand fan; nothing else sits in front of it |
| Tile 6 (verify) Gas Station | 6 × 4 | (21, 2) | right side |
| Dice tray | 7 × 5 | (22, 11) | near right; the exposure d12 has its own pocket |
| Food supply | 3 × 3 | on the board at (8, 3) | stacked food discs |
| Waste pile, crisis deck, contributions, main objective, survivor deck | card size | on the board, far edge | R p5 parts 7–11; crossroads deck off-board at (−26, −4) |
| Bot hand stacks | card size | at each seat's rim position | face down, count badge (50 §7) |

- Tile numbers 1–6 are the "random location" numbers (`RULING` below) and also the client's display order; the engine's
  `locationOrder` (zombie-step order, E.4) is the source of truth for anything rules-related.
- Tiles never move; the view's `locationOrder` is matched to tiles by location id, so a bundle with other locations
  (M9 expansions) only adds rows to `TILE_LAYOUT` in `src/client/table/layout.ts`.
- Slots on every tile and on the board are generated from `capacity` at mount: `capacity.survivors` dashed discs
  (1.3 in pitch), `capacity.entranceSpaces` squares per entrance (1.2 in), `capacity.noiseSpaces` small circles,
  one deck footprint. A data correction to a count never needs a remodel.
- Camera presets (50 §12) frame this box: the default "seat" view sees the whole board and all six tiles at 1280×760.

## 3. Survivor figures

**One sentence that goes into every concept prompt:** full body, front three-quarter view, standing, mildly stylized
heroic proportions about four and a half heads tall, detailed clothing and gear, winter apocalypse setting, plain white
background, even soft lighting, no shadows, no text, no logos. Check head-to-height on every image before the shape stage.

| Step | Where | Output |
|---|---|---|
| 1 Concept | Gemini through Claude in Chrome on the PC, one chat per batch of about 8 (style consistency); refs through the file input, never the clipboard | `art/unit-concepts/<slug>.png` + `art/unit-concepts/PROMPTS.md` (our description per survivor) |
| 2 Picks | `picks.json` with absolute concept paths | contact sheet reviewed before the shape stage |
| 3 Cutout → shape → paint → finalize | the two Hunyuan venvs, `--only <slugs>`, decimate to about 6k triangles | `public/assets/models/<slug>.glb` on a round black 30 mm base, mesh about 1.2 in tall |
| 4 Wire | add the slug to `ENABLED_GLB_SLUGS`; `git mv` any replaced GLB to `art/archive/` in the same commit | `?gallery` screenshot, commit, push |

- Batches: 30 survivors in four batches of about 8 (first batch = the 12-survivor M2 slice minus 4, then the rest in M8
  order). A 5-model batch takes about 12 minutes per stage.
- Slug = the survivor's data id without its prefix, kebab-case (`alexis-grey`, `sparky`). One GLB per slug.
- `src/client/figures/`: `glbModels.ts` (`GLB_SLUG_BY_SURVIVOR`, `ENABLED_GLB_SLUGS`), `glbLoader.ts` (shared cache,
  `${import.meta.env.BASE_URL}assets/models/<slug>.glb`, draco off, 1024 textures), `GlbBody.tsx`, `Procedural.tsx`.
- A survivor renders its GLB only if its slug is enabled **and** the file exists; otherwise the procedural figure. A test
  asserts `ENABLED_GLB_SLUGS` ⊆ files on disk, so a missing GLB never breaks a build.
- **Procedural fallback** (M3 placeholder, permanent fallback): capsule body, sphere head at one quarter height, a flat
  "prop" box tinted by the survivor's occupation group, seat-coloured base ring; one shared geometry per part, one
  material per (seat colour, part). Leaders get a thin gold ring over the base; followers none.
- Base: 30 mm = 1.181 in diameter, 0.12 in tall, matte near-black. Survivor standees stand on a slot disc centre.
- Status visuals come from state: wound pips (red) and frostbite pips (blue) float over the base; a dead survivor plays
  a 600 ms fall and is removed when the presented state removes it; a bitten one flashes purple first; a leader badge
  moves on `LeaderChosen`; a moving survivor tweens along a straight line in ≤600 ms.

## 4. Zombies

| Variant | Silhouette | Used where |
|---|---|---|
| shambler | upright, one arm forward | default, 55% of placements |
| crawler | on hands, low | 15% |
| bloated | wide, slumped | 15% |
| frozen | upright, rimed, stiff | 15% |

- 3–4 Hunyuan GLBs on 30 mm bases, about 6k triangles each, through the same stages (one Gemini concept each, same
  proportion sentence with "gaunt" added, grey-blue winter clothing).
- Rendered with `InstancedMesh` per variant; one instance per occupied entrance space. The variant for a space is a
  stable hash of (location, entrance, space index), so a zombie never changes shape between frames or rounds.
- A zombie appears with a 300 ms rise; a killed one plays a 400 ms collapse and the instance is freed; an overrun drops
  the arriving zombie through the gate with a red flash on the killed survivor (50 §4).
- Procedural fallback: the survivor fallback body in grey with a hunched tilt.

## 5. Board and dioramas

| Piece | Content | Budget |
|---|---|---|
| Colony board | low walls with six numbered gate openings (gate numerals 1–6 stencilled on the wall counter-clockwise, our own font), a watchtower, barrels, a fire pit with the warm light, the colony occupants area as dashed discs, morale and round tracks as physical sliders with a brass marker, the food supply, waste pile, crisis deck, contribution area and main objective footprints (R p5) | ≤30k triangles, 2048 texture |
| Location tiles | a 6 × 4 in base with a small diorama per place: police station (cruiser, cells), grocery store (shelves, carts), school (bus, swings), library (shelves, steps), hospital (ambulance, red cross on a sign, no publisher iconography), gas station (pumps, canopy with the warm lamps); each tile shows the survivor discs, its single entrance squares, four noise circles, the deck footprint and the item symbol row from data (`20-data-schema`) | ≤8k triangles each, 1024 texture |
| Props | snow drifts, wrecked cars, fencing, lamp posts, instanced | ≤10k in total |
| Tokens | barricade (planks), noise (a bell), food (a can), starvation (a cracked bowl), helpless survivor (a bundled figure), first-player token (a brass compass), wound and frostbite (pips, §3) | shared low-poly meshes, instanced |

- Dioramas are made through the same pipeline (one Gemini concept per tile, top-down three-quarter), then decimated;
  the board walls and tracks are modelled procedurally in `src/client/table/ColonyBoard.tsx` so slot positions are exact.
- Tracks read the presented state: the morale slider sits at `morale`, the round slider at `roundsLeft`, food discs
  count `food`, starvation bowls count `starvation`, barrel-mounted waste cards count `waste.length`.
- Low graphics: tiles keep their base and slots, dioramas and props hide, the board drops to its walls and tracks.

## 6. Original icons

Single-colour SVGs on a 24 px grid in `public/assets/ui/icons/`, drawn by us, used in DOM panels, card faces and as
decals on the symbol rows. Each icon has a one-line description so a later agent redraws it without seeing the original game's.

| Icon | Our design |
|---|---|
| weapon | a hand axe head over a short haft |
| fuel | a jerry can with a spout |
| education | an open book with a bookmark |
| food | a tin can with a pull ring |
| medicine | a pill bottle with a cross-free label band |
| tool | a wrench crossed with a screwdriver |
| survivor | a bust in a hooded parka |
| wound / frostbite | a red drop / a blue six-point frost star |
| bite | a purple jaw mark |
| morale / round | a flame / an hourglass |
| noise / barricade / food token | a bell / three planks / a can (same as the symbol, smaller) |
| die / exposure die | a d6 face / a d12 outline |
| exiled / eliminated / first player | a gate with a bar / a cracked disc / a compass |
| seat kinds | human: a chair; bot: a small radio |

## 7. Card faces from data

Cards are first-class objects (C.6): every card def has a face rendered **from its JSON**, never art with baked text.

| Card kind | Face layout | Mesh |
|---|---|---|
| item (starter and location decks) | name, symbol row (icons), our rules text, optional art panel, Equip / Outsider mark | 2.5 × 3.5 in, deck back by location |
| survivor | portrait panel (Gemini, ours), name and occupation, influence / attack / search, ability text | 2.5 × 3.5 in, used for `?gallery` and the seat rail |
| crisis | name, prevent symbols, fail text, optional bonus line | 2.5 × 3.5 in, face up on the board |
| crossroads | title, our vignette, two option blocks, trigger shown only after it fires | 3.5 × 5 in, shown as a DOM panel; the 3D deck is backs only |
| objective (main, secret, betrayal, exiled) | title, our text, engine-computed progress bar | DOM panel; main objective also a 3D card on the board |

- `src/client/cards/cardFace.ts`: `faceTexture(defId, bundle)` draws to an offscreen canvas (512 × 716, DPR-aware) and
  caches a `CanvasTexture` per def; DOM panels use the same renderer to an `<svg>` so a card reads identically in 3D
  and in a prompt.
- Optional art: `art/card-art/<defId>.png` if a Gemini illustration exists; otherwise the symbol glyph at 40% opacity.
- Backs: one design per deck (six locations, starter, crisis, crossroads, survivor, objectives), each a frost pattern
  with the deck's icon; no publisher back.
- Text fits: names ≤24 characters at 28 px, body ≤180 characters at 18 px; `validate:data` warns above those limits.

## 8. Title art and start screen

- Gemini, our own lettering "Dead of Winner" cut into frosted glass over a snowed-in colony gate at dusk, 2 sizes
  (2048 × 1152 and 1024 × 576); no silhouettes that copy the original cover. Scales by height (50 §2).
- The start panel sits over the right third of the art; both fit one screen at 1280×760.

## 9. Palette tokens

```css
:root {
  --bg:#14161a; --fg:#e8e6e1; --card:#1e2127; --accent:#c9a227; --accent2:#7fb2d6;  /* gold, frost blue */
  --muted:#8b8f98; --rule:rgba(201,162,39,.35); --danger:#c0392b; --ok:#3f9a5d;
  --wound:#d64545; --frostbite:#7fb2d6; --bite:#8e44ad; --morale:#e67e22; --food:#c9a227; --zombie:#6b7a66;
  --seat-1:#c9a227; --seat-2:#7fb2d6; --seat-3:#d67d3e; --seat-4:#8ac46a; --seat-5:#b07cc6;
}
```
- Seat colours index by position in `seatOrder`, not by kind, so any N-seat table is distinct (50 §13).
- The same values drive 3D materials (base rings, tray dice) through `src/client/theme.ts`; an in-game colour option
  (M7) swaps the seat set only.
- Dark is the only theme; contrast of `--fg` on `--bg` is 13:1, `--accent` on `--card` 7:1.

## 10. Folders and budgets

| Path | Holds | Budget |
|---|---|---|
| `art/unit-concepts/`, `art/figure-sheets/`, `art/board/`, `art/card-art/`, `art/archive/` | sources and sheets (committed PNGs, ≤1 MB each) | repo ≤150 MB of art |
| `public/assets/models/` | survivor, zombie, tile and board GLBs | survivor/zombie ≤1.2 MB, tile ≤2 MB, board ≤4 MB |
| `public/assets/ui/` | icons, title art, card backs | ≤3 MB |
| scene | ≤200 draw calls, ≤600k triangles at High with 30 survivors and 60 zombies on the table | 60 fps on a mid GPU; Low halves it |

## 11. Owner gates

| Milestone | Shown | Decided |
|---|---|---|
| M3 | the table layout at 1280×760; 2 survivors and 1 zombie through the full pipeline beside their fallbacks in `?gallery` | readability, figure look |
| M5 | each batch's contact sheet and gallery screenshot; the board and six tiles; the icon sheet; a card face per kind; title art | per batch |

## Rulings

- RULING: arrangement of the six location tiles around the colony board | three along the far edge, one at each side, the hospital near the human edge (§2); R p6 says "as shown" but its diagram is an image and the fan sources give no layout | Unsourced
- RULING: location numbers 1–6 for random-location rolls (R2.5) and the zombie-step order (R20.2) | police 1, grocery 2, school 3, library 4, hospital 5, gas station 6 `(verify)` until a card photo settles it; the same as `locationOrder` (13 §0), the research index (`sources/items-sources.md`) and the R p7 setup picture; used as tile numbers and display order | Fan-source (fandom Locations page; R p7 picture agrees, R p2 components list differs)
- RULING: gate numeral direction | the colony's six gates are laid out counter-clockwise seen from above; only the board model changes, R9 placement order is unaffected | Confirmed (R p13 example)
- RULING: board and tile dimensions | 22 × 12 in board, 6 × 4 in tiles, 2.5 × 3.5 in cards, 30 mm bases; our own sizes, not measured from the product | Unsourced
