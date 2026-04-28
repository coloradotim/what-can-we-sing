import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ANALYTICS_EVENT_NAMES } from "../analytics";

const repoRoot = process.cwd();
const dashboardSpec = JSON.parse(
  readFileSync(join(repoRoot, "analytics/posthog/dashboards.json"), "utf8")
) as {
  version: number;
  dashboards: Array<{
    key: string;
    name: string;
    insights: Array<{
      key: string;
      name: string;
      type: string;
      series: Array<{ event: string }>;
    }>;
  }>;
};
const analyticsDocs = readFileSync(join(repoRoot, "docs/analytics.md"), "utf8");

describe("PostHog dashboard spec", () => {
  it("defines the expected managed dashboards", () => {
    expect(dashboardSpec.version).toBe(1);
    expect(dashboardSpec.dashboards.map((dashboard) => dashboard.key)).toEqual([
      "product-health",
      "quartet-funnel",
      "repertoire-matching",
      "reliability-errors",
      "browser-mobile-compatibility",
    ]);
  });

  it("keeps dashboard and insight keys unique", () => {
    const dashboardKeys = dashboardSpec.dashboards.map(
      (dashboard) => dashboard.key
    );
    const insightKeys = dashboardSpec.dashboards.flatMap((dashboard) =>
      dashboard.insights.map((insight) => insight.key)
    );

    expect(new Set(dashboardKeys).size).toBe(dashboardKeys.length);
    expect(new Set(insightKeys).size).toBe(insightKeys.length);
  });

  it("documents every event used by managed dashboards", () => {
    const events = new Set(
      dashboardSpec.dashboards.flatMap((dashboard) =>
        dashboard.insights.flatMap((insight) =>
          insight.series.map((series) => series.event)
        )
      )
    );

    for (const event of events) {
      expect(analyticsDocs).toContain(`\`${event}\``);
    }
  });

  it("only uses events emitted by the app analytics contract", () => {
    const emittedEvents = new Set(ANALYTICS_EVENT_NAMES);
    const dashboardEvents = new Set(
      dashboardSpec.dashboards.flatMap((dashboard) =>
        dashboard.insights.flatMap((insight) =>
          insight.series.map((series) => series.event)
        )
      )
    );

    for (const event of dashboardEvents) {
      expect(emittedEvents.has(event)).toBe(true);
    }
  });
});
