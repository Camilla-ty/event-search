import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildEventHistoryRows } from "@/src/features/events/components/detail/eventHistoryDisplay";

describe("buildEventHistoryRows", () => {
  it("renders status only for active", () => {
    const rows = buildEventHistoryRows({
      lifecycleStatus: "active",
    });

    assert.deepEqual(rows, [{ kind: "status", label: "Status", value: "Active" }]);
  });

  it("renders status only for discontinued", () => {
    const rows = buildEventHistoryRows({
      lifecycleStatus: "discontinued",
    });

    assert.deepEqual(rows, [
      { kind: "status", label: "Status", value: "Discontinued" },
    ]);
  });

  it("renders merged status and series hub link metadata", () => {
    const rows = buildEventHistoryRows({
      lifecycleStatus: "merged",
      mergedIntoSeries: {
        name: "Hong Kong FinTech Week",
        slug: "hong-kong-fintech-week",
      },
    });

    assert.deepEqual(rows, [
      { kind: "status", label: "Status", value: "Merged" },
      {
        kind: "merged_into",
        label: "Merged Into",
        destinationName: "Hong Kong FinTech Week",
        destinationHref: "/events/series/hong-kong-fintech-week",
      },
    ]);
  });

  it("returns null when no lifecycle status is set", () => {
    assert.equal(buildEventHistoryRows({ lifecycleStatus: null }), null);
  });
});
