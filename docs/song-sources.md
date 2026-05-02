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
- `data/sources/bhs_song_catalog_suggestions.psv`
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
npm run song-sources:import:bhs
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

BHS Published Music:

- Uses the repo-local CSV by default.
- Can use `BHS_CATALOG_CSV_PATH` or `BHS_CATALOG_CSV_URL`.

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

