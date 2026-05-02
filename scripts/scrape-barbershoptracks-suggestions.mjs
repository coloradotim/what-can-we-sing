#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  dedupeBarbershopTracksRows,
  formatBarbershopTracksPsv,
  pageCountFromRenderedText,
  parseBarbershopTracksRenderedText,
} from "./barbershoptracks-parser.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const sourceOutputPath = path.join(
  repoRoot,
  "data/sources/barbershoptracks_song_suggestions.psv"
);
const skippedOutputPath = path.join(
  repoRoot,
  "tmp/barbershoptracks-skipped.json"
);
const debugOutputDir = path.join(repoRoot, "tmp/barbershoptracks-debug");
const fallbackPages = 159;
const userAgent =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36";

function argValue(name) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function pageUrl(pageNumber) {
  const url = new URL("http://barbershoptracks.com/database.html");
  url.searchParams.set("limit", "50");
  url.searchParams.set("order", "name");
  url.searchParams.set("dir", "asc");
  if (pageNumber > 1) url.searchParams.set("p", String(pageNumber));
  return url.toString();
}

async function importPlaywright() {
  try {
    return await import("playwright");
  } catch {
    throw new Error(
      "Missing Playwright. Run `npm install` and, if needed, `npx playwright install chromium`."
    );
  }
}

async function scrapePage(page, pageNumber, { debug }) {
  const url = pageUrl(pageNumber);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("body", { timeout: 30000 });
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
  const text = await page.locator("body").innerText({ timeout: 30000 });

  if (debug) {
    await mkdir(debugOutputDir, { recursive: true });
    await writeFile(
      path.join(debugOutputDir, `page-${String(pageNumber).padStart(3, "0")}.txt`),
      text,
      "utf8"
    );
  }

  return text;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has("--help") || args.has("-h")) {
    console.log(`Usage: node scripts/scrape-barbershoptracks-suggestions.mjs [options]

Options:
  --headed       Show the Chromium browser while scraping.
  --max-pages=N  Scrape only the first N rendered pages.
  --debug        Write rendered page text snapshots to tmp/barbershoptracks-debug/.
  --help         Show this help text.
`);
    return;
  }

  const headed = args.has("--headed");
  const debug = args.has("--debug");
  const maxPagesArg = argValue("max-pages");
  const maxPages = maxPagesArg ? Number(maxPagesArg) : null;

  if (maxPages !== null && (!Number.isInteger(maxPages) || maxPages < 1)) {
    throw new Error("--max-pages must be a positive integer.");
  }

  const { chromium } = await importPlaywright();
  const browser = await chromium.launch({ headless: !headed });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    userAgent,
  });
  const page = await context.newPage();

  try {
    const allRows = [];
    const allSkipped = [];

    const firstPageText = await scrapePage(page, 1, { debug });
    const totalPages = pageCountFromRenderedText(firstPageText, { fallbackPages });
    const pageLimit = Math.min(totalPages, maxPages ?? totalPages);
    const firstPageParsed = parseBarbershopTracksRenderedText(firstPageText);
    allRows.push(...firstPageParsed.rows);
    allSkipped.push(...firstPageParsed.skipped.map((skip) => ({ page: 1, ...skip })));

    for (let pageNumber = 2; pageNumber <= pageLimit; pageNumber += 1) {
      const text = await scrapePage(page, pageNumber, { debug });
      const parsed = parseBarbershopTracksRenderedText(text);
      allRows.push(...parsed.rows);
      allSkipped.push(...parsed.skipped.map((skip) => ({ page: pageNumber, ...skip })));
      console.log(`Scraped page ${pageNumber} of ${pageLimit}.`);
    }

    const deduped = dedupeBarbershopTracksRows(allRows);
    await mkdir(path.dirname(sourceOutputPath), { recursive: true });
    await writeFile(sourceOutputPath, formatBarbershopTracksPsv(deduped.rows), "utf8");

    await mkdir(path.dirname(skippedOutputPath), { recursive: true });
    await writeFile(
      skippedOutputPath,
      `${JSON.stringify(allSkipped, null, 2)}\n`,
      "utf8"
    );

    const voicingCounts = deduped.rows.reduce((counts, row) => {
      counts[row.voicing] = (counts[row.voicing] ?? 0) + 1;
      return counts;
    }, {});

    console.log(`Detected pages: ${totalPages}. Scraped pages: ${pageLimit}.`);
    console.log(`Raw imported rows: ${allRows.length}.`);
    console.log(`Duplicate rows collapsed: ${deduped.duplicateRows}.`);
    console.log(`Skipped rows: ${allSkipped.length}.`);
    console.log(
      `Imported rows by voicing: ${Object.entries(voicingCounts)
        .sort()
        .map(([voicing, count]) => `${voicing} ${count}`)
        .join(", ")}`
    );
    console.log(`Wrote ${sourceOutputPath}.`);
    console.log(`Wrote ${skippedOutputPath}.`);
  } finally {
    await browser.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
