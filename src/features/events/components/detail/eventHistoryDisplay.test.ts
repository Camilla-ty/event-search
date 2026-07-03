import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildEventHistoryRows } from "@/src/features/events/components/detail/eventHistoryDisplay";

describe("buildEventHistoryRows", () => {
  it("renders status only for active", () => {
    const rows = buildEventHistoryRows({
      lifecycleStatus: "active",
      lifecycleNote: "Should not appear",
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
      lifecycleNote: "Internal note only",
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

  it("does not render lifecycle_note publicly", () => {
    const rows = buildEventHistoryRows({
      lifecycleStatus: "active",
      lifecycleNote: "Absorbed into HK FinTech Week",
    });

    assert.equal(
      rows?.some((row) => JSON.stringify(row).includes("Absorbed into HK FinTech Week")),
      false,
    );
  });

  it("returns null when no lifecycle status is set", () => {
    assert.equal(buildEventHistoryRows({ lifecycleStatus: null }), null);
  });
});
