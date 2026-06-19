import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { EventRecord } from "@/src/features/events/components/explorer/types";
import {
  addDaysIso,
  eventsIntersectMonth,
  getMonthGridBounds,
  groupEventsByDay,
} from "@/src/features/events/lib/eventCalendarGrouping";

function makeEvent(
  id: string,
  start_date: string | null,
  end_date?: string | null,
): EventRecord {
  return {
    id,
    slug: id,
    name: `Event ${id}`,
    start_date,
    end_date: end_date ?? null,
    event_series: { name: "Series", logo_url: null },
    cities: null,
  };
}

describe("getMonthGridBounds", () => {
  it("returns Monday-based grid bounds for a month", () => {
    const bounds = getMonthGridBounds("2026-06");
    assert.deepEqual(bounds, {
      month: "2026-06",
      monthStart: "2026-06-01",
      monthEnd: "2026-06-30",
      gridStart: "2026-06-01",
      gridEnd: "2026-07-05",
    });
  });

  it("includes leading and trailing days from adjacent months", () => {
    const bounds = getMonthGridBounds("2026-05");
    assert.deepEqual(bounds, {
      month: "2026-05",
      monthStart: "2026-05-01",
      monthEnd: "2026-05-31",
      gridStart: "2026-04-27",
      gridEnd: "2026-05-31",
    });
  });

  it("returns null for invalid months", () => {
    assert.equal(getMonthGridBounds("2026-13"), null);
    assert.equal(getMonthGridBounds("bad"), null);
  });
});

describe("addDaysIso", () => {
  it("adds days without timezone drift", () => {
    assert.equal(addDaysIso("2026-06-30", 1), "2026-07-01");
    assert.equal(addDaysIso("2026-01-31", 1), "2026-02-01");
  });
});

describe("groupEventsByDay", () => {
  it("groups a single-day event on one day", () => {
    const events = [makeEvent("single", "2026-06-15")];
    const groups = groupEventsByDay(events, "2026-06-01", "2026-06-30");

    assert.deepEqual(Array.from(groups.keys()), ["2026-06-15"]);
    assert.equal(groups.get("2026-06-15")?.[0]?.id, "single");
  });

  it("spans multi-day events inclusively", () => {
    const events = [makeEvent("multi", "2026-06-15", "2026-06-17")];
    const groups = groupEventsByDay(events, "2026-06-01", "2026-06-30");

    assert.deepEqual(Array.from(groups.keys()), [
      "2026-06-15",
      "2026-06-16",
      "2026-06-17",
    ]);
    assert.equal(groups.get("2026-06-16")?.[0]?.id, "multi");
  });

  it("excludes events without a valid start date", () => {
    const events = [makeEvent("missing", null), makeEvent("invalid", "not-a-date")];
    const groups = groupEventsByDay(events, "2026-06-01", "2026-06-30");

    assert.equal(groups.size, 0);
  });

  it("clips multi-day events to the visible grid range", () => {
    const events = [makeEvent("cross", "2026-05-30", "2026-06-02")];
    const bounds = getMonthGridBounds("2026-06");
    assert(bounds !== null);

    const groups = groupEventsByDay(events, bounds.gridStart, bounds.gridEnd);

    assert.deepEqual(Array.from(groups.keys()), ["2026-06-01", "2026-06-02"]);
  });

  it("spans events across month boundaries within the grid range", () => {
    const events = [makeEvent("cross", "2026-05-30", "2026-06-02")];
    const groups = groupEventsByDay(events, "2026-05-30", "2026-06-02");

    assert.deepEqual(Array.from(groups.keys()), [
      "2026-05-30",
      "2026-05-31",
      "2026-06-01",
      "2026-06-02",
    ]);
  });

  it("ignores invalid grid bounds", () => {
    const events = [makeEvent("single", "2026-06-15")];
    const groups = groupEventsByDay(events, "invalid", "2026-06-30");
    assert.equal(groups.size, 0);
  });
});

describe("eventsIntersectMonth", () => {
  it("returns events that overlap the target month", () => {
    const events = [
      makeEvent("inside", "2026-06-10", "2026-06-12"),
      makeEvent("cross-start", "2026-05-28", "2026-06-02"),
      makeEvent("cross-end", "2026-06-28", "2026-07-03"),
      makeEvent("outside", "2026-07-01", "2026-07-02"),
      makeEvent("missing", null),
    ];

    assert.deepEqual(
      eventsIntersectMonth(events, "2026-06").map((event) => event.id),
      ["inside", "cross-start", "cross-end"],
    );
  });

  it("returns an empty array for invalid months", () => {
    assert.deepEqual(eventsIntersectMonth([makeEvent("single", "2026-06-01")], "2026-13"), []);
  });
});
