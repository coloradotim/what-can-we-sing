import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();
const contract = readFileSync(
  join(repoRoot, "docs/supabase-contract.md"),
  "utf8"
);
const migration = readFileSync(
  join(
    repoRoot,
    "supabase/migrations/20260428060000_supabase_contract_alignment.sql"
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
  });
});
