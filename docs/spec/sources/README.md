# Per-value source files

Every value in `src/data/` cites an entry in one of these files (spec 20 §20.11). The validator
(`npm run validate:data`, rules DATA-020 and DATA-021) resolves every citation.

## Files

One file per content kind, named `<x>-sources.md`:

| File | Backs |
|---|---|
| `survivors-sources.md` | `src/data/survivors/*.json` |
| `items-sources.md` | `src/data/items/*.json` (starting deck and the six location decks) |
| `locations-sources.md` | `src/data/core/locations.json` (space counts, symbol rows, tracks) |
| `crises-sources.md` | `src/data/crisis/*.json` |
| `crossroads-sources.md` | `src/data/crossroads/*.json` |
| `objectives-sources.md` | `src/data/objectives/*.json` |

## Citation format (in the data)

A record's `src` maps field paths to refs: `{"*": "survivors#daniel-smith", "attack":
"survivors#unverified-stats"}`. A ref `<x>#<entry>` points at the heading `### <entry>` in
`<x>-sources.md`. `"*"` covers every field not listed; the most specific path wins.

## File format

```markdown
# Survivors: sources

## Source keys
- R: official rulebook (local copy only, gitignored), cited as R pN.
- F: official FAQ v1.1 (local copy only), cited as F x.y.
- W1: <url> (read YYYY-MM-DD, how it was read: WebFetch / browser)

## Entries

### daniel-smith
- Status: Confirmed
- Refs: R p7
- Values: influence 66; attack 2+; search 5+
- Mechanics: (4+) kill 2 zombies at his location with a single exposure roll
- Notes: optional; disagreements between sources and how they were settled

### unverified-stats
- Status: Placeholder
- Refs: none
- Values: any stat cited here was invented to keep work moving
- Notes: replace per survivor as sources are found
```

## Rules

1. Entry ids are lowercase kebab-case, unique within the file. Headings are exactly
   `### <entry-id>`; the validator parses only `## Source keys` and `### ` headings plus the
   `- Status:` line.
2. **Status** is one word: `Confirmed` (rulebook or FAQ), `Corrected` (an earlier value was wrong and
   was fixed from a primary source), `Fan-source` (wiki, BGG, fan summary, store photo; cite two
   when possible), `Unsourced` (our reading or inference; say why in Notes), `Placeholder`
   (invented). These match the status words in `docs/needs-rules-check.md`.
3. **Refs** cite source keys with page or entry: `R p7`, `F 1.1.1`, `W2 "Survivors" table`. Every
   URL appears once under Source keys with its read date. Pages that block scripts (Fandom,
   BoardGameGeek) are read once in a real browser; record the values here and nobody re-fetches.
4. **Values** lists the numbers and enums the entry backs. **Mechanics** is one line in our own
   words. Never paste card text, flavour text or long rulebook sentences (IP rule). Never commit the
   rulebook, FAQ or community data files themselves (`docs/sources/` is gitignored).
5. A record with `status: "verified"` may only cite Confirmed or Corrected entries; any Placeholder
   entry forces `status: "placeholder"` (DATA-021).
6. When a source changes a value, update the data and the entry in the same commit, set the status
   to `Corrected` and note the old value.
7. Optional local file `denylist.txt` (gitignored) may hold original card sentences for the IP smoke
   check DATA-030; it is never committed.
