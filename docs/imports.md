# Data Imports

What Can We Sing uses controlled source-data transforms for optional song-entry
suggestions and My Songs-building helpers. Catalog imports must not add songs
to any user's My Songs. Singer-facing add flows may add songs only to the
current authenticated user's My Songs after the user previews the songs and
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

## International Songs With Arranger Refresh

The International Songs source workbook was inspected and committed as a
cleaned CSV at:

```text
data/international_songs_with_arranger.csv
```

Workbook inspection notes:

- Workbook name: `International Songs with Arranger.xlsx`
- Sheet: `Sheet1`
- Columns: `Title`, `Arranger`, `Voicing`
- Inspected source row count: 745 data rows
- Source voicings in the uploaded workbook: `TTBB`
- No blank title, arranger, or voicing values were found in the uploaded
  workbook.

To refresh the source file, export or save the workbook to CSV with the same
three headers:

```text
Title, Arranger, Voicing
```

Then inspect the transform without changing the PSV catalog:

```bash
npm run international-songs:import
```

After reviewing the report, merge the International rows into the PSV catalog:

```bash
npm run international-songs:import -- --write-catalog
```

Finally, dry-run and apply the Supabase catalog import:

```bash
npm run song-suggestions:import -- --dry-run
SUPABASE_SERVICE_ROLE_KEY=... npm run song-suggestions:import
```

The transform imports only title, voicing, and arranger. It does not import
lyrics, sheet music, notes, or source-only descriptive fields. Supported
voicings are `TTBB`, `SSAA`, and `SATB`; clearly multi-voicing rows are split
into one suggestion row per supported voicing. Missing, unsupported, or mixed
supported/unsupported voicing values are skipped and counted in the report.

Arranger handling follows the app-wide semantics: blank arranger stays blank,
and literal `Unknown` stays `Unknown`. Dedupe uses normalized title + voicing +
normalized arranger. This import adds optional suggestions only; it never writes
to any user's My Songs.

## Harmony Brigade Songs

Harmony Brigade data comes from Ross Wilkins' read-only Harmony Brigade MySQL
history database. The normal WCWS app runtime must not connect to that MySQL
database. Instead, a local/admin export script creates controlled CSV snapshots,
and a separate import script loads those snapshots into dedicated Supabase
reference tables.

The inspected upstream objects are:

- `SongData`: 477 rows. Contains `SongID`, `SongTitle`, `KeyName`, `Arranger`,
  `AsSungBy`, `LT_Provider`, `SongStyle`, `SongLength`, `Difficulty`, `Genre`,
  `Tempo`, and `StartingWords`.
- `ViewHistory`: 1907 rows. Contains `SongID`, `YearHeld`, `BrigadeAbbr`,
  `SongTitle`, `KeyName`, `CDTrackNum`, `Arranger`, `AsSungBy`, `LT_Provider`,
  `SongStyle`, `SongLength`, and `StartingWords`.
- `ViewSongHistory`: 1907 rows. Contains `SongID`, `YearHeld`, `BrigadeAbbr`,
  `SongTitle`, and `CDTrackNum`.
- `WalletCard`: 1907 rows. Contains `SongID`, `SongTitle`, `KeyName`,
  `StartingWords`, `YearHeld`, `BrigadeAbbr`, and `CD_Order`.
- `XQ_Brigades`: 15 rows. Contains `BrigadeAbbr`, `BrigadeName`, `MonthHeld`,
  and `Website`.
- `AHBClassicsList`: 23 rows. A smaller AHB classics list, not used by the
  main event-history picker.

`ViewHistory` supplies the year and brigade/event scope. `SongData` supplies the
song identity and metadata. `XQ_Brigades` supplies friendly brigade names.

The committed snapshots are:

```text
data/harmony-brigade/song_data.csv
data/harmony-brigade/view_history.csv
data/harmony-brigade/brigades.csv
```

To refresh the snapshots from the read-only upstream database:

```bash
HB_MYSQL_PASSWORD=... npm run harmony-brigade:export-source
```

Optional connection variables are:

```text
HB_MYSQL_HOST=gud2brabah.com
HB_MYSQL_PORT=3306
HB_MYSQL_DATABASE=XQHistory
HB_MYSQL_USER=XQMember
HB_MYSQL_PASSWORD=...
```

The script prints row counts, distinct years, distinct brigade abbreviations,
and missing arranger count.

After Supabase migrations are applied, import the committed snapshots into the
Harmony Brigade reference tables:

```bash
SUPABASE_SERVICE_ROLE_KEY=... npm run harmony-brigade:import
```

Use a dry run to parse and summarize without writing:

```bash
npm run harmony-brigade:import -- --dry-run
```

Both dry runs and imports print per-event song counts. Counts below 10 are
flagged as suspicious so missing or truncated event-song data is visible before
using the picker, while still allowing historical/special events that may
legitimately have fewer than a standard 12-song list.

The import creates or updates:

- `harmony_brigade_songs`
- `harmony_brigade_events`
- `harmony_brigade_event_songs`

The user-facing flow appears under **More ways to build My Songs** as
**Add Harmony Brigade songs**. Users can choose:

- `All years` or a real `YearHeld` value
- `All brigades` or a real brigade abbreviation/name from `XQ_Brigades`

The picker reads event-song appearances from `ViewHistory`, then groups visible
cards by normalized title + `TTBB` + normalized arranger. If the same song
appears in multiple brigades for the selected scope, users see one card with the
event/track appearances listed on it. Songs default to `TTBB`. Before adding,
the user chooses any TTBB parts they know for each song and a confidence value
for each selected part. If multiple appearances of the same normalized title +
arranger are selected, they are saved as one My Songs row with the combined part
confidences. Adding Harmony Brigade songs writes only to the current user's
`user_repertoire`; it does not expose the user's Brigade selection publicly. The
picker fetches event-song rows for the selected year/brigade scope and paginates
Supabase reads so complete event lists are not truncated by PostgREST response
caps.

Duplicate detection uses normalized title + `TTBB` + normalized arranger,
preserving the distinction between a blank arranger and literal `Unknown`.
