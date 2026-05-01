#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  deletionOrder,
  formatDeletionSummary,
  parseDeleteUserArgs,
  userOwnedTables,
} from "./admin/delete-user-core.mjs";

function usage() {
  return [
    "Usage:",
    "  npm run admin:delete-user -- --email singer@example.com [--dry-run]",
    "  npm run admin:delete-user -- --user-id 00000000-0000-0000-0000-000000000000 [--dry-run]",
    "  npm run admin:delete-user -- --email singer@example.com --confirm",
    "",
    "Production deletes also require --confirm-production when WCWS_ADMIN_ENV=production or VERCEL_ENV=production.",
  ].join("\n");
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function createAdminClient() {
  const supabaseUrl =
    process.env.SUPABASE_URL || requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function findUserByEmail(supabase, email) {
  const perPage = 1000;

  for (let page = 1; page < 1000; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) throw error;

    const users = data?.users ?? [];
    const exactMatches = users.filter(
      (user) => user.email?.toLowerCase() === email
    );

    if (exactMatches.length > 1) {
      throw new Error(`Multiple auth users matched email ${email}.`);
    }

    if (exactMatches.length === 1) return exactMatches[0];

    if (users.length < perPage) break;
  }

  throw new Error(`No Supabase auth user matched email ${email}.`);
}

async function findUser(supabase, identifier) {
  if (identifier.type === "email") {
    return findUserByEmail(supabase, identifier.value);
  }

  const { data, error } = await supabase.auth.admin.getUserById(
    identifier.value
  );

  if (error) throw error;
  if (!data?.user) {
    throw new Error(`No Supabase auth user matched ID ${identifier.value}.`);
  }

  return data.user;
}

async function countRows(supabase, userId) {
  const counts = {};

  for (const item of userOwnedTables) {
    const { count, error } = await supabase
      .from(item.table)
      .select(item.column, { count: "exact", head: true })
      .eq(item.column, userId);

    if (error) throw error;

    counts[item.table] = count ?? 0;
  }

  return counts;
}

async function deleteRows(supabase, userId) {
  const byTable = new Map(userOwnedTables.map((item) => [item.table, item]));

  for (const table of deletionOrder()) {
    const item = byTable.get(table);
    const { error } = await supabase
      .from(item.table)
      .delete()
      .eq(item.column, userId);

    if (error) throw error;
  }
}

function remainingRows(counts) {
  return Object.entries(counts).filter(([, count]) => count > 0);
}

export async function deleteUserFromSupabase(argv = process.argv.slice(2)) {
  const options = parseDeleteUserArgs(argv);
  const supabase = createAdminClient();
  const user = await findUser(supabase, options.identifier);
  const counts = await countRows(supabase, user.id);

  console.log(
    formatDeletionSummary({
      user,
      counts,
      dryRun: options.dryRun,
      production: options.production,
    })
  );

  if (options.dryRun) {
    console.log("\nNo changes made. Re-run with --confirm to delete.");
    return { deleted: false, userId: user.id, counts };
  }

  await deleteRows(supabase, user.id);

  const verificationCounts = await countRows(supabase, user.id);
  const remaining = remainingRows(verificationCounts);

  if (remaining.length > 0) {
    throw new Error(
      `Deleted app rows, but some user-owned rows remain: ${remaining
        .map(([table, count]) => `${table}=${count}`)
        .join(", ")}. Auth user was not deleted.`
    );
  }

  const { error } = await supabase.auth.admin.deleteUser(user.id);
  if (error) throw error;

  console.log("\nDeleted user-owned app rows and Supabase auth user.");
  return { deleted: true, userId: user.id, counts };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  deleteUserFromSupabase().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    console.error("");
    console.error(usage());
    process.exitCode = 1;
  });
}
