import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatActiveFilterDateChip } from "@/src/features/events/lib/formatActiveFilterMonthYear";

describe("formatActiveFilterDateChip", () => {
  it("formats a full-month exact date range", () => {
    assert.deepEqual(formatActiveFilterDateChip("2026-08-01", "2026-08-31"), {
      label: "Date",
      value: "Aug 1 – Aug 31, 2026",
    });
  });

  it("formats a same-month partial range", () => {
    assert.deepEqual(formatActiveFilterDateChip("2026-08-10", "2026-08-20"), {
      label: "Date",
      value: "Aug 10 – Aug 20, 2026",
    });
  });

  it("formats a cross-month range", () => {
    assert.deepEqual(formatActiveFilterDateChip("2026-08-15", "2026-09-04"), {
      label: "Date",
      value: "Aug 15 – Sep 4, 2026",
    });
  });

  it("formats From-only and Until-only labels", () => {
    assert.deepEqual(formatActiveFilterDateChip("2026-08-15", ""), {
      label: "From",
      value: "Aug 15, 2026",
    });
    assert.deepEqual(formatActiveFilterDateChip("", "2026-09-04"), {
      label: "Until",
      value: "Sep 4, 2026",
    });
  });

  it("returns null for empty or invalid dates so no misleading chip is created", () => {
    assert.equal(formatActiveFilterDateChip("", ""), null);
    assert.equal(formatActiveFilterDateChip("bad", "also-bad"), null);
    assert.equal(formatActiveFilterDateChip("2026-02-30", "2026-03-01"), null);
    assert.equal(formatActiveFilterDateChip("2026-08-01", "not-a-date"), null);
  });
});
