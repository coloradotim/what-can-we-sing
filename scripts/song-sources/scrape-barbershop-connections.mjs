#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { formatSourcePsv } from "./psv.mjs";
import {
  cleanSourceText,
  dedupeSourceRows,
  normalizeArrangerName,
  normalizeSourceVoicings,
  normalizeTitleArticle,
} from "./source-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const defaultOutputPath = path.join(
  repoRoot,
  "data/sources/barbershop_connections_song_suggestions.psv"
);
const failedRowsPath = path.join(
  repoRoot,
  "tmp/song-sources/barbershop-connections-failed.json"
);
const sourceUrl = "https://www.barbershopconnections.com/arrangements/";

function optionValue(name) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

export function normalizeBarbershopConnectionsArranger(value) {
  return normalizeArrangerName(value, { flipCommaName: true });
}

export function normalizeBarbershopConnectionsVoices(value) {
  return normalizeSourceVoicings(value, { noneSpecifiedAsTTBB: true });
}

export function normalizeBarbershopConnectionsRecord(record) {
  const title = normalizeTitleArticle(record.Title ?? record.title);
  const arranger = normalizeBarbershopConnectionsArranger(
    record.Arranger ?? record.arranger
  );
  const voicings = normalizeBarbershopConnectionsVoices(
    record.Voices ?? record.voices
  );

  if (!title || voicings.length === 0) {
    return { rows: [], skipped: { record, reason: !title ? "missing_title" : "unknown_voicing" } };
  }

  return {
    rows: voicings.map((voicing) => ({
      title,
      voicing,
      arranger,
      source: "Barbershop Connections",
    })),
    skipped: null,
  };
}

function readArrangementRowsFromDom() {
  const records = [];
  const rows = Array.from(document.querySelectorAll("table tr"));

  for (const row of rows) {
    const cells = Array.from(row.querySelectorAll("td, th"))
      .map((cell) => cell.textContent?.replace(/\s+/g, " ").trim() || "")
      .filter(Boolean);

    if (cells.length < 2) continue;

    const record = {};
    for (let index = 0; index < cells.length - 1; index += 2) {
      const key = cells[index].replace(/:$/, "");
      const value = cells[index + 1];
      if (key && value) record[key] = value;
    }

    if (record.Title || record.Arranger || record.Voices) records.push(record);
  }

  return records;
}

async function selectArranger(page, arrangerValue) {
  await page.evaluate((value) => {
    const select = document.querySelector('select[name="arranger_select"]');
    if (!select) throw new Error("Missing arranger_select");
    select.value = value;
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
    if (window.jQuery) window.jQuery(select).trigger("change");
    if (typeof window.getArrangements === "function") {
      window.getArrangements("by_arranger");
    }
  }, arrangerValue);
}

async function scrapeArranger(page, arranger) {
  await selectArranger(page, arranger.value);
  await page.waitForTimeout(700);
  const records = await page.evaluate(readArrangementRowsFromDom);
  return records.map((record) => ({
    ...record,
    Arranger: cleanSourceText(record.Arranger) ?? arranger.label,
  }));
}

async function scrapeBarbershopConnections({ limit = null, headed = false } = {}) {
  const browser = await chromium.launch({ headless: !headed });
  const page = await browser.newPage();

  try {
    await page.goto(sourceUrl, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForSelector('select[name="arranger_select"]', { timeout: 30_000 });
    const arrangers = await page.$$eval(
      'select[name="arranger_select"] option',
      (options) =>
        options
          .map((option) => ({
            value: option.value,
            label: option.textContent?.replace(/\s+/g, " ").trim() || option.value,
          }))
          .filter((option) => option.value && !/^select/i.test(option.label))
    );

    const selectedArrangers = limit ? arrangers.slice(0, limit) : arrangers;
    const rawRecords = [];

    for (const arranger of selectedArrangers) {
      rawRecords.push(...(await scrapeArranger(page, arranger)));
    }

    return { rawRecords, arrangers: selectedArrangers.length };
  } finally {
    await browser.close();
  }
}

export function transformBarbershopConnectionsRecords(records) {
  const rows = [];
  const skipped = [];

  for (const record of records) {
    const transformed = normalizeBarbershopConnectionsRecord(record);
    rows.push(...transformed.rows);
    if (transformed.skipped) skipped.push(transformed.skipped);
  }

  const deduped = dedupeSourceRows(rows);
  return {
    rows: deduped.rows,
    report: {
      sourceRows: records.length,
      importedRows: deduped.rows.length,
      duplicateRows: deduped.duplicateRows,
      skippedRows: skipped.length,
      skipped,
    },
  };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const outputPath = path.resolve(optionValue("output") ?? defaultOutputPath);
  const limitValue = optionValue("limit");
  const limit = limitValue ? Number(limitValue) : null;
  const headed = args.has("--headed");

  const scrape = await scrapeBarbershopConnections({ limit, headed });
  const { rows, report } = transformBarbershopConnectionsRecords(scrape.rawRecords);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, formatSourcePsv(rows), "utf8");

  if (report.skippedRows > 0) {
    await mkdir(path.dirname(failedRowsPath), { recursive: true });
    await writeFile(failedRowsPath, JSON.stringify(report.skipped, null, 2), "utf8");
  }

  console.log(`Barbershop Connections arrangers scraped: ${scrape.arrangers}`);
  console.log(`Barbershop Connections source rows: ${report.sourceRows}`);
  console.log(`Barbershop Connections imported rows: ${report.importedRows}`);
  console.log(`Barbershop Connections duplicates collapsed: ${report.duplicateRows}`);
  console.log(`Barbershop Connections skipped rows: ${report.skippedRows}`);
  console.log(`Wrote ${path.relative(repoRoot, outputPath)}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}

