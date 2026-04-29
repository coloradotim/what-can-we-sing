#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const specPath = path.join(repoRoot, "analytics/posthog/dashboards.json");

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");
const skipRefresh = args.has("--skip-refresh");
const trendDisplayTypes = new Set([
  "ActionsLineGraph",
  "ActionsTable",
  "ActionsPie",
  "ActionsBar",
  "ActionsBarValue",
  "WorldMap",
  "BoldNumber",
]);

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function apiBaseUrl() {
  return (
    process.env.POSTHOG_HOST ||
    process.env.POSTHOG_API_HOST ||
    "https://us.posthog.com"
  ).replace(/\/$/, "");
}

function environmentId() {
  return (
    process.env.POSTHOG_ENVIRONMENT_ID ||
    process.env.POSTHOG_PROJECT_ID ||
    ""
  );
}

function asArray(value, message) {
  if (!Array.isArray(value)) {
    throw new Error(message);
  }
  return value;
}

function validateSpec(spec) {
  if (spec.version !== 1) {
    throw new Error("Dashboard spec version must be 1.");
  }

  const dashboards = asArray(spec.dashboards, "Spec must include dashboards.");
  const dashboardKeys = new Set();
  const insightKeys = new Set();

  for (const dashboard of dashboards) {
    if (!dashboard.key || !dashboard.name) {
      throw new Error("Every dashboard needs a key and name.");
    }

    if (dashboardKeys.has(dashboard.key)) {
      throw new Error(`Duplicate dashboard key: ${dashboard.key}`);
    }
    dashboardKeys.add(dashboard.key);

    const insights = asArray(
      dashboard.insights,
      `Dashboard ${dashboard.key} must include insights.`
    );

    for (const insight of insights) {
      if (!insight.key || !insight.name || !insight.type) {
        throw new Error(`Every insight in ${dashboard.key} needs key/name/type.`);
      }

      if (insightKeys.has(insight.key)) {
        throw new Error(`Duplicate insight key: ${insight.key}`);
      }
      insightKeys.add(insight.key);

      if (!["trend", "funnel"].includes(insight.type)) {
        throw new Error(`Unsupported insight type for ${insight.key}.`);
      }

      if (
        insight.type === "trend" &&
        (!insight.display || !trendDisplayTypes.has(insight.display))
      ) {
        throw new Error(
          `Trend insight ${insight.key} must include a supported display.`
        );
      }

      if (insight.breakdown && insight.breakdowns) {
        throw new Error(
          `Insight ${insight.key} must use either breakdown or breakdowns, not both.`
        );
      }

      if (insight.breakdowns) {
        const breakdowns = asArray(
          insight.breakdowns,
          `Insight ${insight.key} breakdowns must be an array.`
        );

        for (const breakdown of breakdowns) {
          if (!breakdown.property) {
            throw new Error(
              `Insight ${insight.key} has a breakdown without property.`
            );
          }
        }
      }

      const series = asArray(
        insight.series,
        `Insight ${insight.key} must include event series.`
      );

      for (const event of series) {
        if (!event.event) {
          throw new Error(`Insight ${insight.key} has a series without event.`);
        }
      }
    }
  }
}

async function readSpec() {
  const spec = JSON.parse(await readFile(specPath, "utf8"));
  validateSpec(spec);
  return spec;
}

function eventToQueryNode(event) {
  const node = {
    kind: "EventsNode",
    event: event.event,
    name: event.event,
    math: event.math || "total",
  };

  if (event.mathProperty) {
    node.math_property = event.mathProperty;
  }

  return node;
}

function breakdownsForInsight(insight) {
  if (insight.breakdowns) {
    return insight.breakdowns.map((breakdown) => ({
      property: breakdown.property,
      type: breakdown.type || "event",
    }));
  }

  if (!insight.breakdown) {
    return [];
  }

  return [
    {
      property: insight.breakdown,
      type: insight.breakdownType || "event",
    },
  ];
}

export function queryForInsight(insight) {
  const query = {
    kind: insight.type === "funnel" ? "FunnelsQuery" : "TrendsQuery",
    dateRange: {
      date_from: insight.dateFrom || "-30d",
    },
    series: insight.series.map(eventToQueryNode),
  };

  if (insight.interval) {
    query.interval = insight.interval;
  }

  if (insight.type === "trend" && insight.display) {
    query.trendsFilter = {
      display: insight.display,
    };
  }

  const breakdowns = breakdownsForInsight(insight);
  if (breakdowns.length > 0) {
    query.breakdownFilter = {
      breakdowns,
    };
  }

  return query;
}

async function posthogFetch(endpoint, options = {}) {
  const apiKey = requiredEnv("POSTHOG_PERSONAL_API_KEY");
  const response = await fetch(`${apiBaseUrl()}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${options.method || "GET"} ${endpoint} failed: ${response.status} ${body}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

async function listAll(endpoint) {
  const results = [];
  let nextEndpoint = endpoint;

  while (nextEndpoint) {
    const page = await posthogFetch(nextEndpoint);
    results.push(...(page.results || []));
    if (!page.next) break;
    nextEndpoint = page.next.startsWith("http")
      ? page.next.replace(apiBaseUrl(), "")
      : page.next;
  }

  return results;
}

async function upsertDashboard(environment, dashboard, tags) {
  const dashboards = await listAll(
    `/api/environments/${environment}/dashboards/?limit=100`
  );
  const existing = dashboards.find((item) => item.name === dashboard.name);
  const body = {
    name: dashboard.name,
    description: dashboard.description,
    pinned: true,
    tags,
  };

  if (existing) {
    return posthogFetch(
      `/api/environments/${environment}/dashboards/${existing.id}/`,
      {
        method: "PATCH",
        body: JSON.stringify(body),
      }
    );
  }

  return posthogFetch(`/api/environments/${environment}/dashboards/`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function upsertInsight(environment, dashboardId, insight, tags) {
  const insights = await listAll(
    `/api/environments/${environment}/insights/?limit=100`
  );
  const existing = insights.find((item) => item.name === insight.name);
  const body = {
    name: insight.name,
    description: insight.description,
    query: queryForInsight(insight),
    dashboards: [dashboardId],
    saved: true,
    tags,
  };

  if (existing) {
    return posthogFetch(
      `/api/environments/${environment}/insights/${existing.id}/`,
      {
        method: "PATCH",
        body: JSON.stringify(body),
      }
    );
  }

  return posthogFetch(`/api/environments/${environment}/insights/`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function insightRefreshEndpoint(environment, dashboardId, insightId) {
  const params = new URLSearchParams({
    refresh: "true",
    refresh_method: "force_blocking",
    dashboard_id_context: String(dashboardId),
  });

  return `/api/environments/${environment}/insights/${insightId}/?${params.toString()}`;
}

async function refreshInsightResult(environment, dashboardId, insight) {
  const refreshed = await posthogFetch(
    insightRefreshEndpoint(environment, dashboardId, insight.id)
  );

  if (!refreshed) {
    throw new Error(`Insight ${insight.name} did not return refresh metadata.`);
  }

  return refreshed;
}

async function main() {
  const spec = await readSpec();

  if (checkOnly) {
    console.log(
      `Validated ${spec.dashboards.length} dashboards from ${path.relative(
        repoRoot,
        specPath
      )}.`
    );
    return;
  }

  const environment = environmentId();
  if (!environment) {
    throw new Error("Missing POSTHOG_ENVIRONMENT_ID or POSTHOG_PROJECT_ID");
  }

  const tags = spec.tags || [];

  for (const dashboardSpec of spec.dashboards) {
    const dashboard = await upsertDashboard(environment, dashboardSpec, tags);
    console.log(`Synced dashboard: ${dashboardSpec.name}`);

    for (const insight of dashboardSpec.insights) {
      const savedInsight = await upsertInsight(
        environment,
        dashboard.id,
        insight,
        tags
      );
      console.log(`  Synced insight: ${insight.name}`);

      if (!skipRefresh) {
        await refreshInsightResult(environment, dashboard.id, savedInsight);
        console.log(`  Refreshed insight result: ${insight.name}`);
      }
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
