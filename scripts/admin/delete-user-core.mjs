export const userOwnedTables = [
  {
    table: "session_participants",
    column: "user_id",
    label: "Session participant rows",
  },
  {
    table: "sung_song_events",
    column: "user_id",
    label: "Sung song events",
  },
  {
    table: "user_repertoire",
    column: "user_id",
    label: "Repertoire entries",
  },
  {
    table: "profiles",
    column: "id",
    label: "Profile rows",
  },
];

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readFlagValue(args, flag) {
  const equalsPrefix = `${flag}=`;
  const equalsValue = args.find((arg) => arg.startsWith(equalsPrefix));

  if (equalsValue) return equalsValue.slice(equalsPrefix.length).trim();

  const index = args.indexOf(flag);
  if (index === -1) return null;

  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return value.trim();
}

function rejectUnknownFlags(args) {
  const flagsWithValues = new Set(["--email", "--user-id"]);
  const booleanFlags = new Set([
    "--confirm",
    "--confirm-production",
    "--dry-run",
  ]);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) continue;

    const flag = arg.includes("=") ? arg.split("=")[0] : arg;

    if (booleanFlags.has(flag)) continue;

    if (flagsWithValues.has(flag)) {
      if (!arg.includes("=")) index += 1;
      continue;
    }

    throw new Error(`Unknown option: ${flag}.`);
  }
}

export function isProductionEnvironment(env = process.env) {
  return env.WCWS_ADMIN_ENV === "production" || env.VERCEL_ENV === "production";
}

export function parseDeleteUserArgs(argv, env = process.env) {
  const args = [...argv];
  rejectUnknownFlags(args);

  const email = readFlagValue(args, "--email");
  const userId = readFlagValue(args, "--user-id");
  const confirm = args.includes("--confirm");
  const dryRun = args.includes("--dry-run") || !confirm;
  const confirmProduction = args.includes("--confirm-production");
  const production = isProductionEnvironment(env);

  if (email && userId) {
    throw new Error("Use either --email or --user-id, not both.");
  }

  if (!email && !userId) {
    throw new Error("Provide an exact --email or --user-id.");
  }

  if (email && /[*?]/.test(email)) {
    throw new Error("Email matching must be exact; wildcards are not allowed.");
  }

  if (userId && !uuidPattern.test(userId)) {
    throw new Error("User ID must be an exact Supabase auth UUID.");
  }

  if (production && confirm && !confirmProduction) {
    throw new Error(
      "Production deletion requires --confirm-production in addition to --confirm."
    );
  }

  return {
    identifier: email
      ? { type: "email", value: email.toLowerCase() }
      : { type: "user-id", value: userId },
    confirm,
    dryRun,
    confirmProduction,
    production,
  };
}

export function formatDeletionSummary({
  user,
  counts,
  dryRun,
  production,
}) {
  const lines = [
    `Mode: ${dryRun ? "DRY RUN (no changes)" : "CONFIRMED DELETE"}`,
    `Environment: ${production ? "production" : "non-production/unspecified"}`,
    `Auth user: ${user.id}`,
  ];

  if (user.email) lines.push(`Email: ${user.email}`);

  for (const item of userOwnedTables) {
    lines.push(`${item.label}: ${counts[item.table] ?? 0}`);
  }

  lines.push("Preserved: sessions");
  lines.push("Preserved: song_suggestion_catalog");
  lines.push("Feedback: no Supabase feedback table is used");

  return lines.join("\n");
}

export function deletionOrder() {
  return userOwnedTables.map((item) => item.table);
}
