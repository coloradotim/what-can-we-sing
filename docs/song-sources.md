# Song Suggestion Sources

The app's song-entry suggestions come from the Supabase
`song_suggestion_catalog` table. The repo-managed source pipeline keeps the raw
external sources separate, merges them into a single PSV catalog, and imports
that catalog into Supabase with a server-only service role key.

This pipeline must not write to `user_repertoire`. User repertoire remains owned
by individual singers.

## Files

- `data/sources/barbershop_connections_song_suggestions.psv`
- `data/sources/barbershoptracks_song_suggestions.psv`
- `data/sources/timtracks_song_suggestions.psv`
- `data/sources/bhs_song_catalog_suggestions.psv`
- `data/sources/sweet_adelines_published_music_song_suggestions.psv`
- `data/sources/sweet_adelines_arranged_music_song_suggestions.psv`
- `data/sources/harmony_brigade_song_suggestions.psv`
- `data/song_suggestion_catalog.psv`

Each source PSV uses this header:

```text
Song Title|Voicing|Arranger
```

Rows are deduped by normalized `title + voicing + arranger`. Different voicings
remain separate rows. Missing arranger remains blank and is not treated as the
same thing as explicit `Unknown`.

## Local Environment

Copy `.env.song-sources.example` to `.env.song-sources.local` for local imports.
The local file is gitignored and may contain:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BHS_CATALOG_CSV_PATH` or `BHS_CATALOG_CSV_URL`
- `HB_MYSQL_*` values for the Harmony Brigade legacy database

Never commit real credentials. Never expose `SUPABASE_SERVICE_ROLE_KEY` to
browser code.

## Commands

Scrape or import individual source files:

```bash
npm run song-sources:scrape:barbershop-connections
npm run song-sources:scrape:barbershoptracks
npm run song-sources:scrape:timtracks
npm run song-sources:import:bhs
npm run song-sources:import:sweet-adelines
npm run song-sources:import:sweet-adelines-arranged
npm run song-sources:import:harmony-brigade
```

Merge available source files into the final repo catalog:

```bash
npm run song-sources:merge
```

Import the merged catalog into Supabase:

```bash
npm run song-sources:import:supabase
```

`song-sources:merge` skips missing source files, backs up the previous catalog
under `data/backups/`, and writes `data/song_suggestion_catalog.psv`.

## Source Notes

Barbershop Connections:

- Uses the `Voices` field as the app voicing.
- Treats `None specified` as `TTBB`, matching the legacy source convention.
- Normalizes `Young SSAA` to `SSAA`.
- Normalizes arranger names like `Last, First` to `First Last`.

BarbershopTracks:

- Parses rendered page text.
- Normalizes `Mens Track` to `TTBB`, `Women’s Track` / `Ladies Track` to
  `SSAA`, and `Mixed Track` to `SATB`.

TimTracks:

- Reads the public TimTracks DataTables endpoint for men's, women's, mixed, and
  holiday track pages.
- Uses the men's, women's, and mixed source page type as the primary voicing
  signal.
- For holiday tracks, imports only rows that clearly identify a supported
  four-part voicing from male/female part counts: `4/0` as `TTBB`, `0/4` as
  `SSAA`, and `2/2` as `SATB`.
- Writes ambiguous holiday rows to `tmp/song-sources/timtracks-skipped.json`.

BHS Published Music:

- Uses the repo-local CSV by default.
- Can use `BHS_CATALOG_CSV_PATH` or `BHS_CATALOG_CSV_URL`.

Sweet Adelines published music:

- Downloads the public Sweet Adelines published music PDF by default.
- Can read a local PDF with
  `npm run song-sources:import:sweet-adelines -- --pdf-path=/path/to/PublishedMusic.pdf`.
- Treats every confidently parsed row as canonical `SSAA`.
- Removes source-only title markers such as `YW -`, `(SSAA)`, and
  `FREE DOWNLOAD`.
- Writes ambiguous rows to
  `tmp/song-sources/sweet-adelines-published-music-skipped.json`.

Sweet Adelines arranged music:

- Downloads the public Sweet Adelines arranged music PDF by default.
- Can read a local PDF with
  `npm run song-sources:import:sweet-adelines-arranged -- --pdf-path=/path/to/ArrangedMusic.pdf`.
- Treats every confidently parsed row as canonical `SSAA`.
- Tracks output separately from the published music source at
  `data/sources/sweet_adelines_arranged_music_song_suggestions.psv`.
- Writes ambiguous rows to
  `tmp/song-sources/sweet-adelines-arranged-music-skipped.json`.

Harmony Brigade:

- Uses a legacy MySQL connection only when the `HB_MYSQL_*` environment
  variables are set.
- Defaults rows to `TTBB` when the legacy source has no voicing column.
- Set `HB_MYSQL_VOICING_COLUMN` if the source database includes voicing data.

## GitHub Workflow

The `Song Suggestion Catalog Import` workflow is manual. It installs
dependencies, merges committed source files, and imports the merged catalog into
Supabase using GitHub secrets.

Required GitHub secrets for the import step:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

External scraper credentials remain local unless a future PR intentionally adds
safe CI support for a specific source.
