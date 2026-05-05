#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
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
const sourceName = "Sheet Music Plus Barbershop catalog";
const searchUrl =
  "https://www.sheetmusicplus.com/en/explore?q=barbershop&prefn1=genres&prefv1=Barbershop&sz=20";
const defaultPages = 5;
const defaultDelayMs = 1000;
const defaultOutputPath = path.join(
  repoRoot,
  "data/sources/sheet_music_plus_barbershop_song_suggestions.psv"
);
const skippedRowsPath = path.join(
  repoRoot,
  "tmp/song-sources/sheet-music-plus-skipped.json"
);
const debugPath = path.join(repoRoot, "tmp/song-sources/sheet-music-plus-debug.json");
const samplePagesDir = path.join(
  repoRoot,
  "tmp/song-sources/sheet-music-plus-sample-pages"
);

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
  return cleanSourceText(
    decodeHtmlEntities(String(value ?? "").replace(/<script[\s\S]*?<\/script>/gi, " "))
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]*>/g, " ")
  );
}

function stripDigitalSheetMusicSuffix(value) {
  return String(value ?? "")
    .replace(/\s*\|\s*Sheet Music Plus\s*$/i, "")
    .replace(
      /\s+-\s+(?:Voice|Choir),?\s*(?:SSAA|SATB|TTBB),?\s*4-Part\s+-\s*(?:(?:Late|Early)\s+)?(?:Intermediate\s+)?(?:Digital\s+)?Sheet Music$/i,
      ""
    )
    .replace(/\s+-\s+(?:Digital\s+)?Sheet Music$/i, "")
    .replace(/\s+-\s+(?:Late|Early)?\s*Intermediate\s+(?:Digital\s+)?Sheet Music$/i, "")
    .trim();
}

function cleanMarketplaceTitle(value) {
  let title = stripDigitalSheetMusicSuffix(value)
    .replace(/\s+(SSAA|SATB|TTBB)\s*$/i, "")
    .replace(/\s+(?:Choir|Voice),?\s*(SSAA|SATB|TTBB),?\s*4-Part.*$/i, "")
    .replace(/\s+-\s+Choir,\s*Voice,?\s*(?:4-Part)?\s*$/i, "")
    .replace(/,\s*Vocal Score\s*\(Barbershop Quartet\)/i, "")
    .replace(/\s+-\s*(?:Men's|Women's|Female)\s+Barbershop(?:\s+Arrangement)?$/i, "")
    .replace(/,\s*(?:Men's|Women's|Female)\s+Barbershop$/i, "")
    .replace(/\s+for\s+(?:Men's|Women's|Female)\s+Barbershop$/i, "")
    .replace(/\s+-\s*(?:SSAA|SATB|TTBB)\s+barbershop$/i, "")
    .replace(/\s+-\s*Barbershop Quartet$/i, "")
    .replace(/\s*\(arr\.\s*[^)]+\)\s*/i, " ")
    .replace(/\s*\((?:novello\s+)?(?:ladies'?\s+)?barbershop\)\s*/i, " ")
    .replace(/\s+/g, " ")
    .trim();

  const byArtist = title.match(/^(.+?)\s+by\s+[^|]+$/i);
  if (byArtist) title = byArtist[1].trim();

  return normalizeTitleArticle(title);
}

function isCollectionLikeTitle(value) {
  return /\b(collection|collections|songbook|song book|anthology|fake book|fakebook|favorites|favourites|album|bundle|package|event invite)\b/i.test(
    String(value ?? "")
  );
}

function isCollectionLikeProduct(value) {
  return (
    isCollectionLikeTitle(value) ||
    /\bFormat:\s*Collection\s*\/\s*Songbook\b/i.test(String(value ?? "")) ||
    /\b_Collection_\b/i.test(String(value ?? ""))
  );
}

function isPlaceholderArranger(value) {
  return /^(?:various|unknown|n\/a)$/i.test(String(value ?? "").trim());
}

function normalizeSheetMusicPlusVoicing(value) {
  const text = cleanSourceText(value);
  if (!text) return [];

  const explicit = Array.from(text.matchAll(/\b(SSAA|SATB|TTBB)\b/gi)).map((match) =>
    match[1].toUpperCase()
  );
  if (explicit.length > 0) return Array.from(new Set(explicit));

  const normalized = text
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  if (/\bbarbershop\b/i.test(text)) {
    if (/\bwomens barbershop\b|\bwomen s barbershop\b/.test(normalized)) return ["SSAA"];
    if (/\bmens barbershop\b|\bmen s barbershop\b/.test(normalized)) return ["TTBB"];
  }

  return normalizeSourceVoicings(text).filter((voicing) => /\bbarbershop\b/i.test(text));
}

function extractArranger(value) {
  const text = cleanSourceText(value);
  if (!text) return null;

  const arrangedBy = text.match(/\bArranged by\s+(.+?)(?:\.|;| This edition:| Barbershop,| A Cappella,|$)/i);
  if (!arrangedBy) return null;

  const arranger = arrangedBy[1]
    .replace(/\b(?:and\s+)?(?:Published|Composed|Edited|By)\s+.*$/i, "")
    .trim();
  return normalizeArrangerName(arranger);
}

function textBetween(text, label, nextLabels) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nextPattern = nextLabels
    .map((nextLabel) => nextLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const match = text.match(new RegExp(`${escapedLabel}:?\\s+([\\s\\S]*?)(?=\\s+(?:${nextPattern}):?\\s+|$)`, "i"));
  return cleanSourceText(match?.[1]);
}

function firstTextLine(value) {
  return cleanSourceText(
    String(value ?? "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean)
  );
}

function firstMarkdownHeading(value) {
  const heading = String(value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => /^#\s+/.test(line) && !/^\s*#\s*Sheet Music Plus\b/i.test(line));
  return cleanSourceText(heading?.replace(/^#+\s*/, ""));
}

function extractTitleFromHtml(html, fallbackText) {
  const h1 = String(html ?? "").match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const titleTag = String(html ?? "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return textFromHtml(h1?.[1] ?? titleTag?.[1] ?? fallbackText);
}

function productMainText({ html = "", text = "" }) {
  const raw = text || textFromHtml(html);
  const [main] = String(raw ?? "").split(
    /\n\s*(?:##\s+You may also like|##\s+Recommended Products Based|##\s+Top-selling|See Similar Sheet Music and Digital Downloads)\b/i
  );
  return cleanSourceText(main);
}

export function productUrlsFromSearchPage(pageText) {
  const urls = new Set();
  for (const match of String(pageText ?? "").matchAll(/href=["']([^"']*\/en\/product\/[^"']+\.html[^"']*)["']/gi)) {
    const url = new URL(decodeHtmlEntities(match[1]), "https://www.sheetmusicplus.com");
    url.hash = "";
    urls.add(url.href);
  }
  for (const match of String(pageText ?? "").matchAll(/\]\((https:\/\/www\.sheetmusicplus\.com\/en\/product\/[^)\s]+\.html[^)\s]*)\)/gi)) {
    const url = new URL(decodeHtmlEntities(match[1]));
    url.hash = "";
    urls.add(url.href);
  }
  return Array.from(urls);
}

function readerUrlFor(url) {
  return `https://r.jina.ai/${String(url).replaceAll("&", "%26")}`;
}

function searchUrlForPage(page) {
  const url = new URL(searchUrl);
  if (page > 1) url.searchParams.set("page", String(page));
  return url.href;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isCloudflareChallenge(response, body) {
  return (
    response?.status === 403 &&
    (/cf-mitigated/i.test(response.headers.get("cf-mitigated") ?? "") ||
      /Just a moment|challenges\.cloudflare\.com|cf-ray/i.test(body ?? ""))
  );
}

export function parseSheetMusicPlusProduct({ html = "", text = "", sourceUrl = null }) {
  const bodyText = productMainText({ html, text });
  const rawTitle = text
    ? firstMarkdownHeading(text) || firstTextLine(text)
    : extractTitleFromHtml(html, bodyText?.split(/\n/)[0] ?? "");
  const title = cleanMarketplaceTitle(rawTitle);
  const arranger = extractArranger(bodyText);
  const details = textBetween(bodyText ?? "", "Details", [
    "Detailed Description",
    "Preview",
    "Tell A Friend",
  ]);
  const ensembles = textBetween(bodyText ?? "", "Ensembles", [
    "Genres",
    "Composers",
    "Publishers",
    "Series",
    "Format",
    "Item types",
    "Level",
  ]);
  const detailedDescription = textBetween(bodyText ?? "", "Detailed Description", [
    "About Digital Downloads",
    "Customers Who Bought",
    "Reviews",
  ]);
  const voicings = normalizeSheetMusicPlusVoicing(
    [rawTitle, ensembles, detailedDescription].filter(Boolean).join(" ")
  );

  if (!title) return { rows: [], skipped: { sourceUrl, reason: "missing_title" } };
  if (isCollectionLikeTitle(title) || isCollectionLikeProduct(`${details} ${detailedDescription}`)) {
    return { rows: [], skipped: { sourceUrl, title, reason: "collection_or_book" } };
  }
  if (!/\bbarbershop\b/i.test(bodyText ?? "")) {
    return { rows: [], skipped: { sourceUrl, title, reason: "non_barbershop_product" } };
  }
  if (!arranger) {
    return { rows: [], skipped: { sourceUrl, title, reason: "missing_arranger" } };
  }
  if (voicings.length === 0) {
    return { rows: [], skipped: { sourceUrl, title, arranger, reason: "missing_voicing" } };
  }
  if (isPlaceholderArranger(arranger)) {
    return { rows: [], skipped: { sourceUrl, title, arranger, reason: "placeholder_arranger" } };
  }
  if (voicings.length > 1) {
    return {
      rows: [],
      skipped: { sourceUrl, title, arranger, voicings, reason: "ambiguous_voicing" },
    };
  }

  return {
    rows: voicings.map((voicing) => ({ title, voicing, arranger, source: sourceName })),
    skipped: null,
  };
}

export function transformSheetMusicPlusProducts(products) {
  const rows = [];
  const skipped = [];

  for (const product of products) {
    const transformed = parseSheetMusicPlusProduct(product);
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

async function fetchText(url, { retries = 3 } = {}) {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
  const body = await response.text();
  if (response.status === 429 && retries > 0) {
    await delay((4 - retries) * 2500);
    return fetchText(url, { retries: retries - 1 });
  }
  if (isCloudflareChallenge(response, body)) {
    const error = new Error("Sheet Music Plus returned a Cloudflare challenge.");
    error.code = "cloudflare_challenge";
    error.status = response.status;
    error.url = url;
    throw error;
  }
  if (!response.ok) {
    throw new Error(`Sheet Music Plus request failed: ${response.status} ${url}`);
  }
  return body;
}

async function discoverProductRecords({
  limit = null,
  debug = false,
  fixturePath = null,
  pages = defaultPages,
  delayMs = defaultDelayMs,
} = {}) {
  if (fixturePath) {
    const text = await readFile(fixturePath, "utf8");
    return {
      products: [{ text, sourceUrl: fixturePath }],
      searchPages: [],
      productUrls: [fixturePath],
      retrieval: "fixture",
    };
  }

  const searchPages = [];
  const productUrlSet = new Set();

  for (let page = 1; page <= pages; page += 1) {
    const canonicalUrl = searchUrlForPage(page);
    const text = await fetchText(readerUrlFor(canonicalUrl));
    searchPages.push({ page, sourceUrl: canonicalUrl, readerUrl: readerUrlFor(canonicalUrl) });
    for (const productUrl of productUrlsFromSearchPage(text)) {
      productUrlSet.add(productUrl);
    }
    await delay(Math.min(delayMs, 500));
  }

  const productUrls = Array.from(productUrlSet);
  const limitedUrls = limit ? productUrls.slice(0, limit) : productUrls;
  const products = [];
  const fetchSkipped = [];

  for (const [index, productUrl] of limitedUrls.entries()) {
    try {
      const text = await fetchText(readerUrlFor(productUrl));
      products.push({ text, sourceUrl: productUrl });
      if (debug && index < 10) {
        await mkdir(samplePagesDir, { recursive: true });
        await writeFile(path.join(samplePagesDir, `${index + 1}.md`), text, "utf8");
      }
    } catch (error) {
      fetchSkipped.push({
        sourceUrl: productUrl,
        reason: "fetch_failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
    await delay(delayMs);
  }

  return { products, searchPages, productUrls, fetchSkipped, retrieval: "jina_reader" };
}

async function writeJson(filePath, payload) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function main() {
  const debug = hasOption("debug");
  const headed = hasOption("headed");
  const outputPath = path.resolve(optionValue("output") ?? defaultOutputPath);
  const fixturePath = optionValue("fixture");
  const limitValue = optionValue("limit");
  const pagesValue = optionValue("pages");
  const delayValue = optionValue("delay-ms");
  const limit = limitValue ? Number(limitValue) : null;
  const pages = pagesValue ? Number(pagesValue) : defaultPages;
  const delayMs = delayValue ? Number(delayValue) : defaultDelayMs;
  if (limit !== null && (!Number.isInteger(limit) || limit < 1)) {
    throw new Error("--limit must be a positive integer.");
  }
  if (!Number.isInteger(pages) || pages < 1) {
    throw new Error("--pages must be a positive integer.");
  }
  if (!Number.isInteger(delayMs) || delayMs < 0) {
    throw new Error("--delay-ms must be a non-negative integer.");
  }
  if (headed) {
    console.log("Sheet Music Plus importer uses text-rendered HTTP discovery; --headed is ignored.");
  }

  let discovery = {
    products: [],
    searchPages: [],
    productUrls: [],
    fetchSkipped: [],
    retrieval: null,
  };
  let blocked = null;
  try {
    discovery = await discoverProductRecords({ limit, debug, fixturePath, pages, delayMs });
  } catch (error) {
    if (error?.code !== "cloudflare_challenge") throw error;
    blocked = {
      reason: error.code,
      status: error.status,
      url: error.url,
      note:
        "Sheet Music Plus is behind a Cloudflare challenge from this environment. " +
        "No source PSV was written because importing from challenged pages would be brittle.",
    };
  }

  if (blocked) {
    await writeJson(debugPath, {
      searchUrl,
      blocked,
      feasible: false,
      retrieval: discovery.retrieval,
      importedRows: 0,
    });
    await writeJson(skippedRowsPath, []);
    console.log("Sheet Music Plus discovery blocked by Cloudflare challenge.");
    console.log(`Wrote ${path.relative(repoRoot, debugPath)}.`);
    console.log(`Wrote ${path.relative(repoRoot, skippedRowsPath)}.`);
    return;
  }

  const { rows, report } = transformSheetMusicPlusProducts(discovery.products);
  const skipped = [...discovery.fetchSkipped, ...report.skipped];
  await writeJson(skippedRowsPath, skipped);

  if (debug) {
    await writeJson(debugPath, {
      searchUrl,
      retrieval: discovery.retrieval,
      pagesRequested: fixturePath ? 0 : pages,
      searchPages: discovery.searchPages,
      discoveredProductUrls: discovery.productUrls.length,
      inspectedProductUrls: discovery.products.length,
      fetchSkippedRows: discovery.fetchSkipped.length,
      feasible: rows.length > 0,
      sourceRows: report.sourceRows,
      importedRows: report.importedRows,
      duplicateRows: report.duplicateRows,
      skippedRows: skipped.length,
    });
  }

  if (rows.length === 0) {
    console.log("Sheet Music Plus discovery produced no high-confidence rows.");
    console.log(`Wrote ${path.relative(repoRoot, skippedRowsPath)}.`);
    if (debug) console.log(`Wrote ${path.relative(repoRoot, debugPath)}.`);
    return;
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, formatSourcePsv(rows), "utf8");

  console.log(`Sheet Music Plus source rows inspected: ${report.sourceRows}`);
  console.log(`Sheet Music Plus product URLs discovered: ${discovery.productUrls.length}`);
  console.log(`Sheet Music Plus imported suggestion rows: ${report.importedRows}`);
  console.log(`Sheet Music Plus duplicate rows collapsed: ${report.duplicateRows}`);
  console.log(`Sheet Music Plus skipped rows: ${skipped.length}`);
  console.log(`Wrote ${path.relative(repoRoot, outputPath)}.`);
  console.log(`Wrote ${path.relative(repoRoot, skippedRowsPath)}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
