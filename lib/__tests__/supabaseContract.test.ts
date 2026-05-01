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

describe("Supabase contract guardrails", () => {
  const tables = [
    "profiles",
    "user_repertoire",
    "sessions",
    "session_participants",
    "sung_song_events",
    "repertoire_shares",
  ];
  const baseMigrationTables = tables.filter(
    (table) => table !== "repertoire_shares"
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
    expect(sungMetadataMigration).toContain("last_sung_at timestamptz");
    expect(sungMetadataMigration).toContain("times_sung_count integer");
    expect(sungMetadataMigration).toContain("times_sung_count + 1");
    expect(sungMetadataMigration).toContain("user_id = auth.uid()");
    expect(sungMetadataMigration).toContain("sung_song_events");
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
});
