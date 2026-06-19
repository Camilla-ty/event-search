import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  readEventDateRange,
  readEventIsoDate,
} from "@/src/features/events/lib/readEventIsoDate";

describe("readEventIsoDate", () => {
  it("returns a normalized YYYY-MM-DD value", () => {
    assert.equal(readEventIsoDate("2026-06-15"), "2026-06-15");
    assert.equal(readEventIsoDate(" 2026-06-15T10:00:00Z "), "2026-06-15");
  });

  it("returns an empty string for missing or invalid values", () => {
    assert.equal(readEventIsoDate(null), "");
    assert.equal(readEventIsoDate(""), "");
    assert.equal(readEventIsoDate("not-a-date"), "");
    assert.equal(readEventIsoDate("2026-13-01"), "");
    assert.equal(readEventIsoDate("2026-02-30"), "");
  });
});

describe("readEventDateRange", () => {
  it("treats a missing end date as same-day", () => {
    assert.deepEqual(readEventDateRange({ start_date: "2026-06-15" }), {
      start: "2026-06-15",
      end: "2026-06-15",
    });
  });

  it("returns a multi-day inclusive range", () => {
    assert.deepEqual(
      readEventDateRange({ start_date: "2026-06-15", end_date: "2026-06-17" }),
      { start: "2026-06-15", end: "2026-06-17" },
    );
  });

  it("excludes events without a valid start date", () => {
    assert.equal(readEventDateRange({ start_date: null }), null);
    assert.equal(readEventDateRange({ start_date: "invalid" }), null);
  });

  it("ignores an invalid end date and falls back to the start date", () => {
    assert.deepEqual(
      readEventDateRange({ start_date: "2026-06-15", end_date: "invalid" }),
      { start: "2026-06-15", end: "2026-06-15" },
    );
  });

  it("falls back to a single day when end precedes start", () => {
    assert.deepEqual(
      readEventDateRange({ start_date: "2026-06-15", end_date: "2026-06-10" }),
      { start: "2026-06-15", end: "2026-06-15" },
    );
  });
});
