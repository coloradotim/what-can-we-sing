import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();
const contract = readFileSync(
  join(repoRoot, "docs/supabase-contract.md"),
  "utf8"
);
const appFlows = readFileSync(join(repoRoot, "docs/app-flows.md"), "utf8");
const analyticsDocs = readFileSync(join(repoRoot, "docs/analytics.md"), "utf8");
const migration = readFileSync(
  join(
    repoRoot,
    "supabase/migrations/20260428060000_supabase_contract_alignment.sql"
  ),
  "utf8"
);
const partConfidenceMigration = readFileSync(
  join(
    repoRoot,
    "supabase/migrations/20260428142000_add_part_confidences_to_repertoire.sql"
  ),
  "utf8"
);
const sungMetadataMigration = readFileSync(
  join(
    repoRoot,
    "supabase/migrations/20260428145000_add_repertoire_sung_metadata.sql"
  ),
  "utf8"
);
const nullableSungSessionMigration = readFileSync(
  join(
    repoRoot,
    "supabase/migrations/20260501210000_allow_repertoire_mark_sung_without_session.sql"
  ),
  "utf8"
);
const participantRemovalMigration = readFileSync(
  join(
    repoRoot,
    "supabase/migrations/20260428151000_add_participant_removal_function.sql"
  ),
  "utf8"
);
const songSuggestionsMigration = readFileSync(
  join(
    repoRoot,
    "supabase/migrations/20260428223000_add_global_song_suggestions.sql"
  ),
  "utf8"
);
const songSuggestionCatalogMigration = readFileSync(
  join(
    repoRoot,
    "supabase/migrations/20260429060000_add_song_suggestion_catalog.sql"
  ),
  "utf8"
);
const songSuggestionSupportedVoicingMigration = readFileSync(
  join(
    repoRoot,
    "supabase/migrations/20260429162000_limit_song_suggestions_to_supported_voicings.sql"
  ),
  "utf8"
);
const welcomeSeenMigration = readFileSync(
  join(
    repoRoot,
    "supabase/migrations/20260501133000_add_profile_welcome_seen.sql"
  ),
  "utf8"
);
const quartetNudgeDismissalMigration = readFileSync(
  join(
    repoRoot,
    "supabase/migrations/20260501154500_add_quartet_nudge_dismissal.sql"
  ),
  "utf8"
);
const repertoireSharesMigration = readFileSync(
  join(
    repoRoot,
    "supabase/migrations/20260501190000_add_repertoire_shares.sql"
  ),
  "utf8"
);
const harmonyBrigadeMigration = readFileSync(
  join(
    repoRoot,
    "supabase/migrations/20260501200000_add_harmony_brigade_reference_tables.sql"
  ),
  "utf8"
);
const eventModeMigration = readFileSync(
  join(
    repoRoot,
    "supabase/migrations/20260502080000_add_event_mode_events.sql"
  ),
  "utf8"
);
const eventModeAvailabilityMigration = readFileSync(
  join(
    repoRoot,
    "supabase/migrations/20260502100000_add_event_mode_availability.sql"
  ),
  "utf8"
);

describe("Supabase contract guardrails", () => {
  const tables = [
    "profiles",
    "user_repertoire",
    "sessions",
    "session_participants",
    "sung_song_events",
    "repertoire_shares",
    "harmony_brigade_songs",
    "harmony_brigade_events",
    "harmony_brigade_event_songs",
    "event_mode_events",
    "event_mode_availability",
  ];
  const baseMigrationTables = tables.filter(
    (table) =>
      ![
        "repertoire_shares",
        "harmony_brigade_songs",
        "harmony_brigade_events",
        "harmony_brigade_event_songs",
        "event_mode_events",
        "event_mode_availability",
      ].includes(table)
  );

  it("documents every app-owned Supabase table", () => {
    for (const table of tables) {
      expect(contract).toContain(table);
    }
  });

  it("keeps schema and RLS policies in migrations for browser-written tables", () => {
    for (const table of baseMigrationTables) {
      expect(migration).toContain(`public.${table}`);
      expect(migration).toContain(
        `alter table public.${table} enable row level security`
      );
    }

    expect(migration).toContain("for insert");
    expect(migration).toContain("for update");
    expect(migration).toContain("for delete");
    expect(migration).toContain("auth.uid()");
  });

  it("protects the session participant upsert and realtime contract", () => {
    expect(migration).toContain(
      "session_participants_session_user_key"
    );
    expect(migration).toContain("(session_id, user_id)");
    expect(migration).toContain("supabase_realtime");
    expect(contract).toContain("join/rejoin");
    expect(contract).toContain("leave");
    expect(contract).toContain("repertoire snapshot");
    expect(contract).toContain("Match calculation source");
    expect(contract).toContain("App Flow Contract");
    expect(contract).toContain("Local active-quartet state is a shortcut");
    expect(appFlows).toContain("Source Of Truth");
    expect(appFlows).toContain("Rejoin Quartet");
    expect(appFlows).toContain("Remove Singer");
  });

  it("documents and migrates the first-login welcome flag", () => {
    expect(contract).toContain("has_seen_welcome");
    expect(contract).toContain("markWelcomeSeen");
    expect(welcomeSeenMigration).toContain("public.profiles");
    expect(welcomeSeenMigration).toContain("has_seen_welcome boolean");
  });

  it("documents and migrates the repertoire quartet nudge dismissal flag", () => {
    expect(contract).toContain("has_dismissed_quartet_nudge");
    expect(contract).toContain("dismissQuartetNudge");
    expect(quartetNudgeDismissalMigration).toContain("public.profiles");
    expect(quartetNudgeDismissalMigration).toContain(
      "has_dismissed_quartet_nudge boolean"
    );
  });

  it("documents the analytics privacy contract", () => {
    expect(analyticsDocs).toContain("Autocapture is disabled");
    expect(analyticsDocs).toContain("Do not send free-text user content");
    expect(analyticsDocs).toContain("feedback text");
    expect(analyticsDocs).toContain("song titles");
    expect(analyticsDocs).toContain("help_viewed");
    expect(analyticsDocs).toContain("quartet_member_removed");
  });

  it("documents and migrates participant removal by quartet members", () => {
    expect(contract).toContain("remove_session_participant_by_id");
    expect(participantRemovalMigration).toContain(
      "remove_session_participant_by_id"
    );
    expect(participantRemovalMigration).toContain("auth.uid()");
    expect(participantRemovalMigration).toContain("requester.session_id");
    expect(participantRemovalMigration).toContain("delete from public.session_participants");
    expect(participantRemovalMigration).toContain("to authenticated");
  });

  it("documents and migrates per-part repertoire confidence", () => {
    expect(contract).toContain("part_confidences");
    expect(partConfidenceMigration).toContain("part_confidences jsonb");
    expect(partConfidenceMigration).toContain("unnest(parts_known)");
    expect(partConfidenceMigration).toContain("confidence");
  });

  it("documents and migrates personal sung repertoire metadata", () => {
    expect(contract).toContain("last_sung_at");
    expect(contract).toContain("times_sung_count");
    expect(contract).toContain("mark_repertoire_sung");
    expect(contract).toContain("p_session_id uuid default null");
    expect(contract).toContain("My Songs marks pass `null`");
    expect(sungMetadataMigration).toContain("last_sung_at timestamptz");
    expect(sungMetadataMigration).toContain("times_sung_count integer");
    expect(sungMetadataMigration).toContain("times_sung_count + 1");
    expect(sungMetadataMigration).toContain("user_id = auth.uid()");
    expect(sungMetadataMigration).toContain("sung_song_events");
    expect(nullableSungSessionMigration).toContain(
      "alter column session_id drop not null"
    );
    expect(nullableSungSessionMigration).toContain(
      "p_session_id uuid default null"
    );
  });

  it("documents and migrates private repertoire share links", () => {
    expect(contract).toContain("repertoire_shares");
    expect(contract).toContain("get_shared_repertoire");
    expect(contract).toContain("six uppercase alphanumeric characters");
    expect(contract).toContain("must not expose owner email");
    expect(repertoireSharesMigration).toContain(
      "create table if not exists public.repertoire_shares"
    );
    expect(repertoireSharesMigration).toContain("owner_id = auth.uid()");
    expect(repertoireSharesMigration).toContain("enable row level security");
    expect(repertoireSharesMigration).toContain("security definer");
    expect(repertoireSharesMigration).toContain("grant execute");
    expect(repertoireSharesMigration).toContain("to anon");
    expect(repertoireSharesMigration).toContain("song_title");
    expect(repertoireSharesMigration).toContain("voicing");
    expect(repertoireSharesMigration).toContain("arranger_name");
    expect(repertoireSharesMigration).not.toContain("email");
    expect(repertoireSharesMigration).not.toContain("notes");
    expect(repertoireSharesMigration).not.toContain("part_confidences");
    expect(repertoireSharesMigration).not.toContain("last_sung_at");
  });

  it("documents and migrates global song identity suggestions", () => {
    expect(contract).toContain("search_repertoire_song_suggestions");
    expect(contract).toContain("distinct global song identity suggestions");
    expect(contract).toContain("song_suggestion_catalog");
    expect(contract).toContain("must not return `user_id`");
    expect(songSuggestionsMigration).toContain(
      "search_repertoire_song_suggestions"
    );
    expect(songSuggestionCatalogMigration).toContain(
      "song_suggestion_catalog"
    );
    expect(songSuggestionCatalogMigration).toContain("pg_trgm");
    expect(songSuggestionCatalogMigration).toContain(
      "song_suggestion_catalog_unique_idx"
    );
    expect(songSuggestionCatalogMigration).toContain(
      "song_suggestion_catalog_title_trgm_idx"
    );
    expect(songSuggestionCatalogMigration).toContain("enable row level security");
    expect(songSuggestionCatalogMigration).toContain(
      "search_repertoire_song_suggestions"
    );
    expect(songSuggestionsMigration).toContain("security definer");
    expect(songSuggestionCatalogMigration).toContain("security definer");
    expect(songSuggestionsMigration).toContain("auth.role() = 'authenticated'");
    expect(songSuggestionCatalogMigration).toContain(
      "auth.role() = 'authenticated'"
    );
    expect(songSuggestionsMigration).toContain("song_title text");
    expect(songSuggestionsMigration).toContain("voicing text");
    expect(songSuggestionsMigration).toContain("arranger_name text");
    expect(songSuggestionsMigration).toContain("grant execute");
    expect(songSuggestionCatalogMigration).toContain("grant execute");
    expect(songSuggestionsMigration).not.toContain("returns table (\n  user_id");
    expect(songSuggestionCatalogMigration).not.toContain(
      "returns table (\n  user_id"
    );
    expect(contract).toContain(
      "single voicing values: `TTBB`, `SATB`, and `SSAA`"
    );
    expect(contract).toContain(
      "Import expands comma-separated source voicings"
    );
    expect(songSuggestionSupportedVoicingMigration).toContain(
      "song_suggestion_catalog_supported_voicing_chk"
    );
    expect(songSuggestionSupportedVoicingMigration).toContain(
      "voicing in ('TTBB', 'SATB', 'SSAA')"
    );
    expect(songSuggestionSupportedVoicingMigration).toContain(
      "user_repertoire.voicing in ('TTBB', 'SATB', 'SSAA')"
    );
    expect(songSuggestionSupportedVoicingMigration).toContain(
      "song_suggestion_catalog.voicing in ('TTBB', 'SATB', 'SSAA')"
    );
  });

  it("documents and migrates Harmony Brigade reference tables", () => {
    expect(contract).toContain("Harmony Brigade Reference Tables");
    expect(contract).toContain("scripts/export-harmony-brigade-source.mjs");
    expect(contract).toContain("scripts/import-harmony-brigade-songs.mjs");
    expect(contract).toContain("default_voicing = 'TTBB'");
    expect(contract).toContain("No authenticated insert/update/delete policies");
    expect(harmonyBrigadeMigration).toContain(
      "create table if not exists public.harmony_brigade_songs"
    );
    expect(harmonyBrigadeMigration).toContain(
      "create table if not exists public.harmony_brigade_events"
    );
    expect(harmonyBrigadeMigration).toContain(
      "create table if not exists public.harmony_brigade_event_songs"
    );
    expect(harmonyBrigadeMigration).toContain("source_song_id integer not null unique");
    expect(harmonyBrigadeMigration).toContain("year_held integer not null");
    expect(harmonyBrigadeMigration).toContain("brigade_abbr text not null");
    expect(harmonyBrigadeMigration).toContain(
      "harmony_brigade_songs_default_voicing_chk"
    );
    expect(harmonyBrigadeMigration).toContain("default_voicing = 'TTBB'");
    expect(harmonyBrigadeMigration).toContain("enable row level security");
    expect(harmonyBrigadeMigration).toContain("for select");
    expect(harmonyBrigadeMigration).toContain("to authenticated");
    expect(harmonyBrigadeMigration).not.toContain("for insert");
    expect(harmonyBrigadeMigration).not.toContain("for update");
    expect(harmonyBrigadeMigration).not.toContain("for delete");
  });

  it("documents and migrates Event Mode event discovery", () => {
    expect(contract).toContain("Event Mode Events");
    expect(contract).toContain("event_mode_events");
    expect(contract).toContain("get_event_mode_event_by_code");
    expect(contract).toContain("listed");
    expect(contract).toContain("unlisted");
    expect(contract).toContain("Event creators can update");
    expect(eventModeMigration).toContain(
      "create table if not exists public.event_mode_events"
    );
    expect(eventModeMigration).toContain("visibility in ('listed', 'unlisted')");
    expect(eventModeMigration).toContain("join_code ~ '^[A-Z0-9]{6}$'");
    expect(eventModeMigration).toContain("end_at > start_at");
    expect(eventModeMigration).toContain("enable row level security");
    expect(eventModeMigration).toContain("visibility = 'listed'");
    expect(eventModeMigration).toContain("created_by_user_id = auth.uid()");
    expect(eventModeMigration).toContain("get_event_mode_event_by_code");
    expect(eventModeMigration).toContain("security definer");
    expect(eventModeMigration).toContain("grant execute");
    expect(eventModeMigration).toContain("to anon");
    expect(eventModeMigration).not.toContain("event_mode_availability");
    expect(eventModeMigration).not.toContain("event_mode_messages");
  });

  it("documents and migrates Event Mode singer availability", () => {
    expect(contract).toContain("Event Mode Availability");
    expect(contract).toContain("event_mode_availability");
    expect(contract).toContain("get_event_mode_availability_by_code");
    expect(contract).toContain("profiles.display_name");
    expect(contract).toContain("TTBB Lead");
    expect(contract).toContain("SATB Tenor");
    expect(contract).toContain("SSAA Alto 1");
    expect(contract).toContain("must not expose repertoire");
    expect(eventModeAvailabilityMigration).toContain(
      "create table if not exists public.event_mode_availability"
    );
    expect(eventModeAvailabilityMigration).toContain(
      "event_id uuid not null references public.event_mode_events(id)"
    );
    expect(eventModeAvailabilityMigration).toContain(
      "user_id uuid not null references auth.users(id)"
    );
    expect(eventModeAvailabilityMigration).toContain(
      "event_mode_availability_event_user_key"
    );
    expect(eventModeAvailabilityMigration).toContain("(event_id, user_id)");
    expect(eventModeAvailabilityMigration).toContain(
      "event_mode_availability_voice_parts_supported_chk"
    );
    expect(eventModeAvailabilityMigration).toContain("'TTBB Lead'");
    expect(eventModeAvailabilityMigration).toContain("'SATB Tenor'");
    expect(eventModeAvailabilityMigration).toContain("'SSAA Alto 1'");
    expect(eventModeAvailabilityMigration).toContain(
      "alter table public.event_mode_availability enable row level security"
    );
    expect(eventModeAvailabilityMigration).toContain("user_id = auth.uid()");
    expect(eventModeAvailabilityMigration).toContain("available_until > now()");
    expect(eventModeAvailabilityMigration).toContain("turned_off_at is null");
    expect(eventModeAvailabilityMigration).toContain(
      "get_event_mode_availability_by_code"
    );
    expect(eventModeAvailabilityMigration).toContain("security definer");
    expect(eventModeAvailabilityMigration).toContain("auth.role() = 'authenticated'");
    expect(eventModeAvailabilityMigration).toContain("profiles.display_name");
    expect(eventModeAvailabilityMigration).toContain("grant execute");
    expect(eventModeAvailabilityMigration).toContain("to authenticated");
    expect(eventModeAvailabilityMigration).not.toContain("to anon");
    expect(eventModeAvailabilityMigration).not.toContain("user_repertoire");
    expect(eventModeAvailabilityMigration).not.toContain("session_participants");
  });
});
