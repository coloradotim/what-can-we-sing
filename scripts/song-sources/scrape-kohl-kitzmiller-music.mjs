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
const sourceName = "Kohl Kitzmiller Music";
const sitemapIndexUrl = "https://kohlkitzmillermusic.com/sitemap.xml";
const productApiUrl = "https://kohlkitzmillermusic.com/wp-json/wp/v2/product";
const defaultOutputPath = path.join(
  repoRoot,
  "data/sources/kohl_kitzmiller_music_song_suggestions.psv"
);
const skippedRowsPath = path.join(
  repoRoot,
  "tmp/song-sources/kohl-kitzmiller-music-skipped.json"
);
const debugDir = path.join(repoRoot, "tmp/song-sources/kohl-kitzmiller-music");
const productTypeTokens = new Set([
  "full",
  "mix",
  "learning",
  "track",
  "tracks",
]);

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

function extractXmlLocs(xml) {
  return Array.from(String(xml ?? "").matchAll(/<loc>(.*?)<\/loc>/g)).map((match) =>
    decodeHtmlEntities(match[1])
  );
}

function slugWordsToText(words) {
  const text = words
    .map((word) => {
      const lower = word.toLowerCase();
      if (lower === "ive") return "I've";
      if (lower === "im") return "I'm";
      if (lower === "youre") return "You're";
      if (lower === "youve") return "You've";
      if (lower === "cant") return "Can't";
      if (lower === "dont") return "Don't";
      if (lower === "thats") return "That's";
      if (lower === "theres") return "There's";
      if (lower === "whats") return "What's";
      if (lower === "wont") return "Won't";
      if (lower === "isnt") return "Isn't";
      if (lower === "doesnt") return "Doesn't";
      if (lower === "couldnt") return "Couldn't";
      if (lower === "wouldnt") return "Wouldn't";
      if (lower === "shouldnt") return "Shouldn't";
      if (lower === "til") return "'Til";
      return lower
        .split(/\s+/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
    })
    .join(" ");

  return cleanSourceText(text);
}

function slugFromUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.pathname.split("/").filter(Boolean).at(-1) ?? "";
  } catch {
    return "";
  }
}

function stripTrailingDuplicateNumber(tokens) {
  if (/^\d+$/.test(tokens.at(-1) ?? "")) return tokens.slice(0, -1);
  return tokens;
}

export function parseKohlKitzmillerProductSlug(slugOrUrl) {
  const slug = slugFromUrl(slugOrUrl) || String(slugOrUrl ?? "");
  const tokens = stripTrailingDuplicateNumber(
    decodeURIComponent(slug).toLowerCase().split("-").filter(Boolean)
  );
  const arrIndex = tokens.indexOf("arr");

  if (tokens.length === 0) {
    return { candidate: null, skipped: { sourceUrl: slugOrUrl, reason: "missing_title" } };
  }

  if (tokens.includes("authorized")) {
    return {
      candidate: null,
      skipped: {
        sourceUrl: slugOrUrl,
        slug,
        reason: "private_authorized_copy",
      },
    };
  }

  if (arrIndex <= 0 || arrIndex === tokens.length - 1) {
    return {
      candidate: {
        sourceUrl: slugOrUrl,
        title: slugWordsToText(tokens),
        voicingText: tokens.find((token) => ["ttbb", "ssaa", "satb"].includes(token)),
        arranger: null,
      },
      skipped: null,
    };
  }

  const titleTokens = [...tokens.slice(0, arrIndex)];
  let voicingText = null;
  const voicingIndex = titleTokens.findIndex((token) =>
    ["ttbb", "ssaa", "satb"].includes(token)
  );
  if (voicingIndex >= 0) {
    voicingText = titleTokens[voicingIndex].toUpperCase();
    titleTokens.splice(voicingIndex, 1);
  }

  while (titleTokens.length > 0 && productTypeTokens.has(titleTokens.at(-1))) {
    titleTokens.pop();
  }

  const arrangerTokens = [];
  for (const token of tokens.slice(arrIndex + 1)) {
    if (productTypeTokens.has(token)) break;
    arrangerTokens.push(token);
  }

  return {
    candidate: {
      sourceUrl: slugOrUrl,
      title: slugWordsToText(titleTokens),
      voicingText,
      arranger: slugWordsToText(arrangerTokens),
    },
    skipped: null,
  };
}

export function parseKohlKitzmillerProductTitle(product) {
  const title = textFromHtml(product.title?.rendered ?? product.title ?? "");
  const sourceUrl = product.link ?? product.sourceUrl ?? null;

  if (!title) {
    return { candidate: null, skipped: { sourceUrl, reason: "missing_title" } };
  }

  if (/\bauthorized for use by\b/i.test(title)) {
    return {
      candidate: null,
      skipped: {
        sourceUrl,
        title,
        reason: "private_authorized_copy",
      },
    };
  }

  const parentheticalVoicing = title.match(
    /^(.*?)\s*\((TTBB|SSAA|SATB)\)\s*(?:arr\.?|arranged by)\s+(.+?)(?:\s+[–-]\s+(?:Learning Tracks?|Full Mix|Mix).*)?$/i
  );
  if (parentheticalVoicing) {
    return {
      candidate: {
        sourceUrl,
        title: parentheticalVoicing[1],
        voicingText: parentheticalVoicing[2],
        arranger: parentheticalVoicing[3],
      },
      skipped: null,
    };
  }

  const productTypeBeforeVoicing = title.match(
    /^(.*?)\s+[–-]\s+(?:Learning Tracks?|Full Mix|Mix)\s*\((TTBB|SSAA|SATB)\)\s+[–-]\s*(?:arr\.?|arranged by)\s+(.+)$/i
  );
  if (productTypeBeforeVoicing) {
    return {
      candidate: {
        sourceUrl,
        title: productTypeBeforeVoicing[1],
        voicingText: productTypeBeforeVoicing[2],
        arranger: productTypeBeforeVoicing[3],
      },
      skipped: null,
    };
  }

  const plainVoicing = title.match(
    /^(.*?)\s+(TTBB|SSAA|SATB)\s+(?:arr\.?|arranged by)\s+(.+?)(?:\s+[–-]\s+(?:Learning Tracks?|Full Mix|Mix).*)?$/i
  );
  if (plainVoicing) {
    return {
      candidate: {
        sourceUrl,
        title: plainVoicing[1],
        voicingText: plainVoicing[2],
        arranger: plainVoicing[3],
      },
      skipped: null,
    };
  }

  const slugParsed = parseKohlKitzmillerProductSlug(sourceUrl ?? "");
  if (slugParsed.candidate) return slugParsed;

  return {
    candidate: null,
    skipped: { sourceUrl, title, reason: "malformed_record" },
  };
}

export function transformKohlKitzmillerCandidate(candidate) {
  const sourceUrl = candidate.sourceUrl ?? null;
  const title = normalizeTitleArticle(textFromHtml(candidate.title));
  const arranger = normalizeArrangerName(textFromHtml(candidate.arranger));
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

export function transformKohlKitzmillerProducts(products) {
  const rows = [];
  const skipped = [];

  for (const product of products) {
    const sourceUrl = typeof product === "string" ? product : product.link;
    const parsed =
      typeof product === "string"
        ? parseKohlKitzmillerProductSlug(product)
        : parseKohlKitzmillerProductTitle(product);
    if (parsed.skipped) {
      skipped.push(parsed.skipped);
      continue;
    }
    if (!parsed.candidate) {
      skipped.push({ sourceUrl, reason: "malformed_record" });
      continue;
    }

    const transformed = transformKohlKitzmillerCandidate(parsed.candidate);
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

async function fetchText(url, { optional = false } = {}) {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    if (optional && response.status === 404) return null;
    throw new Error(`Kohl Kitzmiller Music request failed: ${response.status} ${url}`);
  }

  return response.text();
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
    throw new Error(`Kohl Kitzmiller Music request failed: ${response.status} ${url}`);
  }

  return {
    data: await response.json(),
    totalPages: Number(response.headers.get("x-wp-totalpages") ?? "1"),
  };
}

async function discoverProductUrls({ debug = false } = {}) {
  const indexXml = await fetchText(sitemapIndexUrl);
  const sitemapUrls = extractXmlLocs(indexXml).filter((url) =>
    /wp-sitemap-posts-product-\d+\.xml$/.test(url)
  );
  const productUrls = new Set();
  const debugPayload = {
    sitemapIndexUrl,
    sitemapUrls,
    missingSitemaps: [],
    productsBySitemap: {},
  };

  for (const sitemapUrl of sitemapUrls) {
    const sitemapXml = await fetchText(sitemapUrl, { optional: true });
    if (!sitemapXml) {
      debugPayload.missingSitemaps.push(sitemapUrl);
      console.log(`Skipping missing source sitemap: ${sitemapUrl}`);
      continue;
    }
    const urls = extractXmlLocs(sitemapXml).filter((url) =>
      /^https:\/\/kohlkitzmillermusic\.com\/product\//.test(url)
    );
    debugPayload.productsBySitemap[sitemapUrl] = urls;
    for (const url of urls) productUrls.add(url);
  }

  if (debug) {
    await mkdir(debugDir, { recursive: true });
    await writeFile(
      path.join(debugDir, "discovered-products.json"),
      `${JSON.stringify(debugPayload, null, 2)}\n`,
      "utf8"
    );
  }

  return Array.from(productUrls);
}

async function discoverProductRecords({ debug = false } = {}) {
  const sitemapProductUrls = await discoverProductUrls({ debug });
  const productsByUrl = new Map(sitemapProductUrls.map((url) => [url, { link: url }]));
  let apiPages = 0;

  try {
    let totalPages = 1;
    for (let page = 1; page <= totalPages; page += 1) {
      const url = `${productApiUrl}?per_page=100&page=${page}&_fields=link,title`;
      const { data, totalPages: pageCount } = await fetchJson(url);
      if (!Array.isArray(data)) {
        throw new Error(`Kohl Kitzmiller Music product API page ${page} was not an array.`);
      }

      totalPages = pageCount;
      apiPages = page;
      for (const product of data) {
        if (product?.link) productsByUrl.set(product.link, product);
      }
    }
  } catch (error) {
    console.log(
      `Kohl Kitzmiller Music product API unavailable; falling back to sitemap slugs. ${
        error instanceof Error ? error.message : error
      }`
    );
  }

  const products = Array.from(productsByUrl.values());
  if (debug) {
    await mkdir(debugDir, { recursive: true });
    await writeFile(
      path.join(debugDir, "discovered-product-records.json"),
      `${JSON.stringify({ apiPages, products }, null, 2)}\n`,
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
    console.log("Kohl Kitzmiller Music scraper uses sitemap/HTTP discovery; --headed is ignored.");
  }

  const discoveredProducts = await discoverProductRecords({ debug });
  const products = limit ? discoveredProducts.slice(0, limit) : discoveredProducts;
  const { rows, report } = transformKohlKitzmillerProducts(products);

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

  console.log(
    `Kohl Kitzmiller Music discovered product records: ${discoveredProducts.length}`
  );
  console.log(`Kohl Kitzmiller Music source rows inspected: ${report.sourceRows}`);
  console.log(`Kohl Kitzmiller Music imported suggestion rows: ${report.importedRows}`);
  console.log(`Kohl Kitzmiller Music duplicate rows collapsed: ${report.duplicateRows}`);
  console.log(`Kohl Kitzmiller Music skipped rows: ${report.skippedRows}`);
  console.log(
    `Kohl Kitzmiller Music imported rows by voicing: ${Object.entries(voicingCounts)
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
