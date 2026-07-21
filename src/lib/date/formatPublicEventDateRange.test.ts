import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatPublicEventDateRange } from "@/src/lib/date/formatPublicEventDateRange";

describe("formatPublicEventDateRange", () => {
  it("formats a single day", () => {
    assert.equal(
      formatPublicEventDateRange("2026-07-29", "2026-07-29"),
      "July 29, 2026",
    );
  });

  it("formats a same-month range with both month names", () => {
    assert.equal(
      formatPublicEventDateRange("2026-07-29", "2026-07-31"),
      "July 29 – July 31, 2026",
    );
  });

  it("formats a cross-month range", () => {
    assert.equal(
      formatPublicEventDateRange("2026-07-29", "2026-08-02"),
      "July 29 – August 2, 2026",
    );
  });

  it("formats a cross-year range", () => {
    assert.equal(
      formatPublicEventDateRange("2026-12-29", "2027-01-02"),
      "December 29, 2026 – January 2, 2027",
    );
  });

  it("formats a start date without an end date", () => {
    assert.equal(formatPublicEventDateRange("2026-07-29", null), "July 29, 2026");
  });

  it("preserves end-only date behavior", () => {
    assert.equal(formatPublicEventDateRange(null, "2026-07-29"), "July 29, 2026");
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
      "July 29 – July 31, 2026",
    );
  });

  it("uses the date-only prefix without timezone conversion", () => {
    assert.equal(
      formatPublicEventDateRange(
        "2026-07-29T23:30:00-11:00",
        "2026-07-31T00:30:00+14:00",
      ),
      "July 29 – July 31, 2026",
    );
  });
});
