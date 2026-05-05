#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
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
const sourceName = "Melody Hine Arrangements";
const arrangerName = "Melody Hine";
const productApiUrl =
  "https://melodyhinearrangements.com/index.php?rest_route=/wp/v2/product";
const voicingCategoryIds = new Map([
  [33, "Upper Voices"],
  [65, "Mixed Voices"],
  [40, "Lower Voices"],
]);
const defaultOutputPath = path.join(
  repoRoot,
  "data/sources/melody_hine_arrangements_song_suggestions.psv"
);
const skippedRowsPath = path.join(
  repoRoot,
  "tmp/song-sources/melody-hine-arrangements-skipped.json"
);
const debugDir = path.join(repoRoot, "tmp/song-sources/melody-hine-arrangements");

function optionValue(name) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function hasOption(name) {
  return process.argv.includes(`--${name}`);
}

function decodeHtmlEntities(value) {
  return String(value ?? "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    )
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&ndash;/g, "-")
    .replace(/&mdash;/g, "-")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"');
}

function textFromHtml(value) {
  return cleanSourceText(decodeHtmlEntities(String(value ?? "").replace(/<[^>]*>/g, " ")));
}

function voicingTextFromCategories(productCat = []) {
  return productCat
    .map((categoryId) => voicingCategoryIds.get(categoryId))
    .filter(Boolean)
    .join(", ");
}

function cleanMelodyHineVoicingText(value) {
  return cleanSourceText(
    String(value ?? "")
      .replace(/\bBarbershop\b/gi, "")
      .replace(/\bYouth\b/gi, "")
      .replace(/\bBundle\b/gi, "")
  );
}

function cleanMelodyHineTitleText(value, { stripDescriptors = false } = {}) {
  let title = String(value ?? "").replace(/\bLearning Tracks?\b/gi, "");
  if (stripDescriptors) {
    title = title
      .replace(/\bBarbershop\b/gi, "")
      .replace(/\bYouth\b/gi, "")
      .replace(/\bUpper Voices Bundle\b/gi, "")
      .replace(/\bMixed Voices Bundle\b/gi, "")
      .replace(/\bLower Voices Bundle\b/gi, "")
      .replace(/\bUpper Voices\b/gi, "")
      .replace(/\bMixed Voices\b/gi, "")
      .replace(/\bLower Voices\b/gi, "")
      .replace(/\s+[–-]\s*$/g, "");
  }

  return title.trim();
}

export function parseMelodyHineProduct(product) {
  const sourceUrl = product?.link ?? product?.sourceUrl ?? null;
  const title = textFromHtml(product?.title?.rendered ?? product?.title ?? "");
  const productCat = Array.isArray(product?.product_cat) ? product.product_cat : [];

  if (!title) {
    return { candidate: null, skipped: { sourceUrl, reason: "missing_title" } };
  }

  const titleParts = title.split(/\s+[–-]\s+/);
  const voicingText =
    voicingTextFromCategories(productCat) || cleanMelodyHineVoicingText(titleParts.at(-1));
  const titleText =
    titleParts.length > 1
      ? cleanMelodyHineTitleText(titleParts.slice(0, -1).join(" - "))
      : cleanMelodyHineTitleText(title, { stripDescriptors: true });

  return {
    candidate: {
      sourceUrl,
      title: titleText,
      voicingText,
      arranger: arrangerName,
    },
    skipped: null,
  };
}

export function transformMelodyHineCandidate(candidate) {
  const sourceUrl = candidate.sourceUrl ?? null;
  const title = normalizeTitleArticle(textFromHtml(candidate.title));
  const arranger = normalizeArrangerName(candidate.arranger);
  const voicings = normalizeSourceVoicings(candidate.voicingText);

  if (!title) {
    return {
      rows: [],
      skipped: { sourceUrl, reason: "missing_title" },
    };
  }

  if (!arranger) {
    return {
      rows: [],
      skipped: { sourceUrl, title, reason: "missing_arranger" },
    };
  }

  if (!cleanSourceText(candidate.voicingText)) {
    return {
      rows: [],
      skipped: { sourceUrl, title, arranger, reason: "missing_voicing" },
    };
  }

  if (voicings.length === 0) {
    return {
      rows: [],
      skipped: {
        sourceUrl,
        title,
        arranger,
        voicing: cleanSourceText(candidate.voicingText),
        reason: "unknown_voicing",
      },
    };
  }

  return {
    rows: voicings.map((voicing) => ({
      title,
      voicing,
      arranger,
      source: sourceName,
    })),
    skipped: null,
  };
}

export function transformMelodyHineProducts(products) {
  const rows = [];
  const skipped = [];

  for (const product of products) {
    const parsed = parseMelodyHineProduct(product);
    if (parsed.skipped) {
      skipped.push(parsed.skipped);
      continue;
    }
    if (!parsed.candidate) {
      skipped.push({ sourceUrl: product?.link ?? null, reason: "malformed_record" });
      continue;
    }

    const transformed = transformMelodyHineCandidate(parsed.candidate);
    rows.push(...transformed.rows);
    if (transformed.skipped) skipped.push(transformed.skipped);
  }

  const deduped = dedupeSourceRows(rows);
  return {
    rows: deduped.rows,
    report: {
      sourceRows: products.length,
      importedRows: deduped.rows.length,
      duplicateRows: deduped.duplicateRows,
      skippedRows: skipped.length,
      skipped,
    },
  };
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Melody Hine Arrangements request failed: ${response.status} ${url}`);
  }

  return {
    data: await response.json(),
    totalPages: Number(response.headers.get("x-wp-totalpages") ?? "1"),
  };
}

async function discoverProductRecords({ debug = false } = {}) {
  const products = [];
  let totalPages = 1;

  for (let page = 1; page <= totalPages; page += 1) {
    const url = `${productApiUrl}&per_page=100&page=${page}&_fields=id,link,title,product_cat`;
    const { data, totalPages: pageCount } = await fetchJson(url);
    if (!Array.isArray(data)) {
      throw new Error(`Melody Hine Arrangements product API page ${page} was not an array.`);
    }

    totalPages = pageCount;
    products.push(...data);
  }

  if (debug) {
    await mkdir(debugDir, { recursive: true });
    await writeFile(
      path.join(debugDir, "discovered-product-records.json"),
      `${JSON.stringify({ productApiUrl, products }, null, 2)}\n`,
      "utf8"
    );
  }

  return products;
}

async function main() {
  const debug = hasOption("debug");
  const headed = hasOption("headed");
  const outputPath = path.resolve(optionValue("output") ?? defaultOutputPath);
  const limitValue = optionValue("limit");
  const limit = limitValue ? Number(limitValue) : null;
  if (limit !== null && (!Number.isInteger(limit) || limit < 1)) {
    throw new Error("--limit must be a positive integer.");
  }

  if (headed) {
    console.log("Melody Hine Arrangements scraper uses HTTP discovery; --headed is ignored.");
  }

  const discoveredProducts = await discoverProductRecords({ debug });
  const products = limit ? discoveredProducts.slice(0, limit) : discoveredProducts;
  const { rows, report } = transformMelodyHineProducts(products);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, formatSourcePsv(rows), "utf8");

  await mkdir(path.dirname(skippedRowsPath), { recursive: true });
  await writeFile(skippedRowsPath, `${JSON.stringify(report.skipped, null, 2)}\n`, "utf8");

  if (debug) {
    await mkdir(debugDir, { recursive: true });
    await writeFile(
      path.join(debugDir, "parsed-report.json"),
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8"
    );
  }

  const voicingCounts = rows.reduce((counts, row) => {
    counts[row.voicing] = (counts[row.voicing] ?? 0) + 1;
    return counts;
  }, {});

  console.log(`Melody Hine Arrangements discovered product records: ${discoveredProducts.length}`);
  console.log(`Melody Hine Arrangements source rows inspected: ${report.sourceRows}`);
  console.log(`Melody Hine Arrangements imported suggestion rows: ${report.importedRows}`);
  console.log(`Melody Hine Arrangements duplicate rows collapsed: ${report.duplicateRows}`);
  console.log(`Melody Hine Arrangements skipped rows: ${report.skippedRows}`);
  console.log(
    `Melody Hine Arrangements imported rows by voicing: ${Object.entries(voicingCounts)
      .sort()
      .map(([voicing, count]) => `${voicing} ${count}`)
      .join(", ")}`
  );
  console.log(`Wrote ${path.relative(repoRoot, outputPath)}.`);
  console.log(`Wrote ${path.relative(repoRoot, skippedRowsPath)}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
