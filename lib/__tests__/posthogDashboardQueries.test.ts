import { describe, expect, it } from "vitest";
import {
  insightRefreshEndpoint,
  queryForInsight,
  sandboxDashboardFromSpec,
  selectInsightEntries,
} from "../../scripts/posthog/sync-dashboards.mjs";

describe("PostHog dashboard query generation", () => {
  it("wraps trend query sources in a dashboard-renderable visualization node", () => {
    expect(
      queryForInsight({
        key: "top-routes",
        name: "Top routes",
        type: "trend",
        display: "ActionsBar",
        dateFrom: "-30d",
        breakdown: "route",
        series: [{ event: "app_route_viewed" }],
      })
    ).toMatchObject({
      kind: "InsightVizNode",
      source: {
        kind: "TrendsQuery",
        dateRange: {
          date_from: "-30d",
        },
        series: [
          {
            kind: "EventsNode",
            event: "app_route_viewed",
            math: "total",
          },
        ],
        breakdownFilter: {
          breakdowns: [
            {
              property: "route",
              type: "event",
            },
          ],
        },
        trendsFilter: {
          display: "ActionsBar",
        },
      },
    });
  });

  it("keeps browser and device breakdowns in the same query shape", () => {
    expect(
      queryForInsight({
        key: "join-flow-by-device",
        name: "Join flow by device",
        type: "trend",
        display: "ActionsBar",
        breakdown: "$device_type",
        series: [{ event: "quartet_joined" }],
      })
    ).toMatchObject({
      kind: "InsightVizNode",
      source: {
        breakdownFilter: {
          breakdowns: [
            {
              property: "$device_type",
              type: "event",
            },
          ],
        },
      },
    });
  });

  it("selects managed insights by key for narrow syncs", () => {
    const spec = {
      dashboards: [
        {
          key: "product-health",
          insights: [
            { key: "analytics-client-ready" },
            { key: "top-routes" },
          ],
        },
        {
          key: "reliability",
          insights: [{ key: "join-errors" }],
        },
      ],
    };

    expect(selectInsightEntries(spec, ["top-routes"])).toEqual([
      {
        dashboard: spec.dashboards[0],
        insight: { key: "top-routes" },
      },
    ]);
  });

  it("builds isolated sandbox insight names instead of overwriting production insights", () => {
    const sandboxDashboard = sandboxDashboardFromSpec(
      {
        dashboards: [
          {
            key: "product-health",
            name: "What Can We Sing - Product Health",
            insights: [
              {
                key: "top-routes",
                name: "Top routes",
                description: "Routes by normalized path.",
                type: "trend",
                display: "ActionsBar",
                breakdown: "route",
                series: [{ event: "app_route_viewed" }],
              },
            ],
          },
        ],
      },
      ["top-routes"]
    );

    expect(sandboxDashboard.name).toBe(
      "What Can We Sing - Dashboard Sync Sandbox"
    );
    expect(sandboxDashboard.insights).toHaveLength(1);
    expect(sandboxDashboard.insights[0]).toMatchObject({
      key: "sandbox-top-routes",
      name: "Sandbox - Top routes",
      breakdown: "route",
    });
  });

  it("refreshes saved insight results in dashboard context after sync", () => {
    expect(insightRefreshEndpoint("400013", 1521699, 12345)).toBe(
      "/api/environments/400013/insights/12345/?refresh=true&refresh_method=force_blocking&dashboard_id_context=1521699"
    );
  });
});
