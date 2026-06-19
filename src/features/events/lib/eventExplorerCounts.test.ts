import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCalendarToolbarCounts } from "@/src/features/events/lib/eventExplorerCounts";

describe("buildCalendarToolbarCounts", () => {
  it("shows a secondary total when month count differs from filtered total", () => {
    assert.deepEqual(buildCalendarToolbarCounts(0, "June 2026", 12), {
      primaryLine: "0 events in June 2026",
      secondaryLine: "12 matching events total",
    });
    assert.deepEqual(buildCalendarToolbarCounts(3, "September 2026", 12), {
      primaryLine: "3 events in September 2026",
      secondaryLine: "12 matching events total",
    });
  });

  it("omits the secondary line when counts match", () => {
    assert.deepEqual(buildCalendarToolbarCounts(5, "October 2026", 5), {
      primaryLine: "5 events in October 2026",
      secondaryLine: null,
    });
  });
});
