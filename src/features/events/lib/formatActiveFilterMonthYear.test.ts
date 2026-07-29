import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatActiveFilterDateChipBody,
  formatActiveFilterMonthYear,
} from "@/src/features/events/lib/formatActiveFilterMonthYear";

describe("formatActiveFilterMonthYear", () => {
  it("formats ISO date-only values as month year", () => {
    assert.equal(formatActiveFilterMonthYear("2027-01-15"), "Jan 2027");
    assert.equal(formatActiveFilterMonthYear("2026-12-01"), "Dec 2026");
  });

  it("returns null for empty or invalid values", () => {
    assert.equal(formatActiveFilterMonthYear(""), null);
    assert.equal(formatActiveFilterMonthYear("  "), null);
    assert.equal(formatActiveFilterMonthYear(null), null);
    assert.equal(formatActiveFilterMonthYear("not-a-date"), null);
    assert.equal(formatActiveFilterMonthYear("2026-02-30"), null);
  });
});

describe("formatActiveFilterDateChipBody", () => {
  it("formats both bounds as a compact range", () => {
    assert.equal(
      formatActiveFilterDateChipBody("2027-01-01", "2027-03-31"),
      "Jan 2027 – Mar 2027",
    );
  });

  it("formats start-only and end-only bounds", () => {
    assert.equal(formatActiveFilterDateChipBody("2027-01-01", ""), "From Jan 2027");
    assert.equal(formatActiveFilterDateChipBody("", "2027-03-31"), "Until Mar 2027");
  });

  it("returns null when neither bound is valid", () => {
    assert.equal(formatActiveFilterDateChipBody("", ""), null);
    assert.equal(formatActiveFilterDateChipBody("bad", "also-bad"), null);
  });
});
