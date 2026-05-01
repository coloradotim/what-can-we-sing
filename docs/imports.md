# Data Imports

What Can We Sing uses controlled metadata imports for optional song-entry
suggestions. Imports must not add songs to any user's repertoire and must not
store lyrics, sheet music contents, preview images, pricing, cart data, or
full product descriptions in user-facing suggestion data.

## Song Suggestion Catalog

The deployed suggestion catalog is `data/song_suggestion_catalog.psv`.
It contains only:

```text
Song Title|Voicing|Arranger
```

The Supabase import script parses that PSV file, normalizes title and arranger
text, expands comma-separated supported voicings, deduplicates by
`normalized_title + voicing + normalized_arranger`, and replaces
`song_suggestion_catalog` using a server-side service role key:

```bash
npm run song-suggestions:import -- --dry-run
SUPABASE_SERVICE_ROLE_KEY=... npm run song-suggestions:import
```

Blank arranger and literal `Unknown` are intentionally distinct. Do not rewrite
blank arranger values to `Unknown`, and do not rewrite `Unknown` to blank.

## BHS Published Music Refresh

The BHS Published Music source file is committed at:

```text
data/bhs_published_music_catalog.csv
```

To refresh it, export the BHS Published Music Google Sheet tab as CSV and
replace that file:

```text
https://docs.google.com/spreadsheets/d/1EB2-THNpk_fa2GgRJcwkFnslxd7dAW0kUf-5eZknIKo/export?format=csv&gid=668272030
```

Then inspect the transform without changing the PSV catalog:

```bash
npm run bhs-published-music:import
```

After reviewing the report and any sample rows, merge the BHS rows into the
PSV catalog:

```bash
npm run bhs-published-music:import -- --write-catalog
```

Finally, dry-run and apply the Supabase catalog import:

```bash
npm run song-suggestions:import -- --dry-run
SUPABASE_SERVICE_ROLE_KEY=... npm run song-suggestions:import
```

## BHS Transform Rules

The BHS CSV columns are:

```text
Product Code/SKU, Product Name, Product Description, Arranger, Difficulty, Ensemble
```

The transform imports only clearly voiced four-part suggestions for the app's
supported voicings: `TTBB`, `SSAA`, and `SATB`.

Voicing detection is conservative:

- Product Name explicit voicing wins when present, for example `(TTBB)`,
  `(SSAA)`, `(SATB)`, or a clearly multi-voicing value such as `(TTBB/SSAA)`.
- Product Description is checked next, using the first pipe-delimited segment.
  Explicit `TTBB`, `SSAA`, and `SATB` are accepted.
- Product Description phrases map only when clear:
  - `mixed voices` -> `SATB`
  - `female voices`, `women's voices`, or `high voices` -> `SSAA`
  - `male voices`, `men's voices`, or `low voices` -> `TTBB`
- Ensemble is used last because the BHS sheet often leaves it blank or gives
  incomplete values.
- If multiple supported voicings are clearly present in Product Name, the row
  is split into one suggestion row per voicing.

Rows are skipped when voicing is missing or ambiguous, or when the product is
not a normal four-part arrangement. Examples of skipped non-four-part or
collection signals include 8-part products, double quartets, soloist products,
songbooks, and digital/download bundles.

Arranger detection uses the `Arranger` column first. If it is blank, the
transform attempts to parse a clear `arranged by` or `arr.` value from Product
Description or Product Name. Product Description is used only as import signal;
it is not stored in `song_suggestion_catalog`.
