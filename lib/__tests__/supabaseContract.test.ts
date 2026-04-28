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

describe("Supabase contract guardrails", () => {
  const tables = [
    "profiles",
    "user_repertoire",
    "sessions",
    "session_participants",
    "sung_song_events",
  ];

  it("documents every app-owned Supabase table", () => {
    for (const table of tables) {
      expect(contract).toContain(table);
    }
  });

  it("keeps schema and RLS policies in migrations for browser-written tables", () => {
    for (const table of tables) {
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
});
