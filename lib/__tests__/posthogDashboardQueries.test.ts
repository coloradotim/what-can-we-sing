import { describe, expect, it } from "vitest";
import { queryForInsight } from "../../scripts/posthog/sync-dashboards.mjs";

describe("PostHog dashboard query generation", () => {
  it("uses PostHog query breakdowns for event-property trend breakdowns", () => {
    expect(
      queryForInsight({
        key: "top-routes",
        name: "Top routes",
        type: "trend",
        display: "ActionsBarValue",
        dateFrom: "-30d",
        breakdown: "route",
        series: [{ event: "app_route_viewed" }],
      })
    ).toMatchObject({
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
        display: "ActionsBarValue",
      },
    });
  });

  it("keeps browser and device breakdowns in the same query shape", () => {
    expect(
      queryForInsight({
        key: "join-flow-by-device",
        name: "Join flow by device",
        type: "trend",
        display: "ActionsBarValue",
        breakdown: "$device_type",
        series: [{ event: "quartet_joined" }],
      })
    ).toMatchObject({
      breakdownFilter: {
        breakdowns: [
          {
            property: "$device_type",
            type: "event",
          },
        ],
      },
    });
  });
});
