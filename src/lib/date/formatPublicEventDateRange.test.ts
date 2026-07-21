import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatPublicEventDateRange } from "@/src/lib/date/formatPublicEventDateRange";

describe("formatPublicEventDateRange", () => {
  it("formats a single day", () => {
    assert.equal(
      formatPublicEventDateRange("2026-07-29", "2026-07-29"),
      "Jul 29, 2026",
    );
  });

  it("formats a same-month range with both month names", () => {
    assert.equal(
      formatPublicEventDateRange("2026-07-29", "2026-07-31"),
      "Jul 29 – Jul 31, 2026",
    );
  });

  it("formats a cross-month range", () => {
    assert.equal(
      formatPublicEventDateRange("2026-09-29", "2026-10-01"),
      "Sep 29 – Oct 1, 2026",
    );
  });

  it("formats a cross-year range", () => {
    assert.equal(
      formatPublicEventDateRange("2026-12-29", "2027-01-02"),
      "Dec 29, 2026 – Jan 2, 2027",
    );
  });

  it("formats a start date without an end date", () => {
    assert.equal(formatPublicEventDateRange("2026-07-29", null), "Jul 29, 2026");
  });

  it("preserves end-only date behavior", () => {
    assert.equal(formatPublicEventDateRange(null, "2026-07-29"), "Jul 29, 2026");
  });

  it("returns null when dates are missing", () => {
    assert.equal(formatPublicEventDateRange(null, null), null);
    assert.equal(formatPublicEventDateRange("", "  "), null);
  });

  it("returns null for invalid dates", () => {
    assert.equal(formatPublicEventDateRange("2026-02-30", null), null);
    assert.equal(formatPublicEventDateRange("2026-13-01", null), null);
    assert.equal(formatPublicEventDateRange("not-a-date", null), null);
    assert.equal(formatPublicEventDateRange("2026-07-29", "2026-02-30"), null);
  });

  it("accepts ISO timestamps", () => {
    assert.equal(
      formatPublicEventDateRange(
        "2026-07-29T12:00:00.000Z",
        "2026-07-31T12:00:00.000Z",
      ),
      "Jul 29 – Jul 31, 2026",
    );
  });

  it("uses the date-only prefix without timezone conversion", () => {
    assert.equal(
      formatPublicEventDateRange(
        "2026-07-29T23:30:00-11:00",
        "2026-07-31T00:30:00+14:00",
      ),
      "Jul 29 – Jul 31, 2026",
    );
  });
});
