import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(__dirname, "../..");

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const equalsIndex = trimmed.indexOf("=");
  if (equalsIndex === -1) return null;

  const name = trimmed.slice(0, equalsIndex).trim();
  let value = trimmed.slice(equalsIndex + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return name ? { name, value } : null;
}

export async function loadSongSourcesEnv({
  envPath = path.join(repoRoot, ".env.song-sources.local"),
  override = false,
} = {}) {
  let contents;
  try {
    contents = await readFile(envPath, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") return { loaded: false, envPath };
    throw error;
  }

  let loadedVariables = 0;
  for (const line of contents.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;
    if (!override && process.env[parsed.name] !== undefined) continue;
    process.env[parsed.name] = parsed.value;
    loadedVariables += 1;
  }

  return { loaded: true, envPath, loadedVariables };
}

export function requiredEnv(name, detail = "") {
  const value = process.env[name];
  if (!value) {
    const suffix = detail ? ` ${detail}` : "";
    throw new Error(`Missing ${name}.${suffix}`);
  }
  return value;
}

