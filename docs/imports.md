# Data Imports

What Can We Sing uses controlled source-data transforms for optional song-entry
suggestions and repertoire-building helpers. Catalog imports must not add songs
to any user's repertoire. Singer-facing add flows may add songs only to the
current authenticated user's repertoire after the user previews the songs and
chooses required personal fields. Source data must not store lyrics, sheet
music contents, preview images, pricing, cart data, or full product
descriptions in user-facing suggestion data.

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

## Harmony Brigade Songs

The Ross Wilkins Harmony Brigade source file is committed at:

```text
data/harmony_brigade_songs.csv
```

The CSV schema currently provided is:

```text
SongID, SongTitle, KeyName, Arranger, AsSungBy, LT_Provider, SongStyle, SongLength, Difficulty, Genre, Tempo, StartingWords
```

The source does not currently include Brigade year, location, or voicing
columns. The app therefore exposes the data as a single event bucket:

```text
Year: All years
Location / Event: Ross Wilkins song database
```

Every Harmony Brigade song defaults to `TTBB`. If a future source file includes
year/location columns, update `scripts/build-harmony-brigade-data.mjs` and
`lib/harmonyBrigade.ts` so those fields feed the existing Year and Location /
Event selectors.

To rebuild the app-readable JSON artifact after replacing the CSV, run:

```bash
npm run harmony-brigade:build-data
```

This writes:

```text
data/harmony_brigade_songs.json
```

The Harmony Brigade add flow is separate from the normal add-song typeahead and
does not write to Supabase until a signed-in user selects songs, chooses a TTBB
part and confidence, and confirms the add. Duplicate detection uses normalized
title + `TTBB` + normalized arranger, preserving the distinction between blank
arranger and literal `Unknown`.
