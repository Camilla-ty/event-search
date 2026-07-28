import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { EventRecord } from "@/src/features/events/components/explorer/types";
import { getMonthGridBounds } from "@/src/features/events/lib/eventCalendarGrouping";
import { buildCalendarLaneLayout } from "@/src/features/events/lib/eventCalendarLanes";

function makeEvent({
  id,
  name,
  startDate,
  endDate = null,
}: {
  id: string;
  name: string;
  startDate: string;
  endDate?: string | null;
}): EventRecord {
  return {
    id,
    series_id: null,
    slug: id,
    name,
    start_date: startDate,
    end_date: endDate,
    event_series: { name: "Series", logo_url: null },
    cities: null,
  };
}

describe("buildCalendarLaneLayout", () => {
  it("keeps a multi-day event in one stable lane across its visible span", () => {
    const bounds = getMonthGridBounds("2026-11");
    assert.ok(bounds);

    const layout = buildCalendarLaneLayout(
      [
        makeEvent({
          id: "long",
          name: "Long Event",
          startDate: "2026-11-03",
          endDate: "2026-11-06",
        }),
        makeEvent({
          id: "short",
          name: "Short Event",
          startDate: "2026-11-04",
          endDate: "2026-11-04",
        }),
      ],
      bounds,
    );

    assert.equal(layout.assignmentsByEventId.get("long")?.lane, 0);
    assert.equal(layout.assignmentsByEventId.get("short")?.lane, 1);
    assert.deepEqual(
      layout.assignmentsByDay.get("2026-11-04")?.map((assignment) => [
        assignment.eventId,
        assignment.lane,
      ]),
      [
        ["long", 0],
        ["short", 1],
      ],
    );
    assert.deepEqual(
      layout.assignmentsByDay.get("2026-11-06")?.map((assignment) => [
        assignment.eventId,
        assignment.lane,
      ]),
      [["long", 0]],
    );
  });

  it("uses the canonical ordering when overlapping events compete for lanes", () => {
    const bounds = getMonthGridBounds("2026-11");
    assert.ok(bounds);

    const layout = buildCalendarLaneLayout(
      [
        makeEvent({
          id: "later-start",
          name: "Zeta Summit",
          startDate: "2026-11-05",
          endDate: "2026-11-06",
        }),
        makeEvent({
          id: "longest",
          name: "Beta Week",
          startDate: "2026-11-04",
          endDate: "2026-11-08",
        }),
        makeEvent({
          id: "alpha",
          name: "Alpha Forum",
          startDate: "2026-11-03",
          endDate: "2026-11-04",
        }),
        makeEvent({
          id: "omega",
          name: "Omega Forum",
          startDate: "2026-11-03",
          endDate: "2026-11-04",
        }),
      ],
      bounds,
    );

    assert.deepEqual(
      layout.assignments.map((assignment) => [assignment.eventId, assignment.lane]),
      [
        ["longest", 0],
        ["alpha", 1],
        ["omega", 2],
        ["later-start", 1],
      ],
    );
  });

  it("reuses lanes whenever possible and minimizes the total lane count", () => {
    const bounds = getMonthGridBounds("2026-11");
    assert.ok(bounds);

    const layout = buildCalendarLaneLayout(
      [
        makeEvent({
          id: "first",
          name: "First Event",
          startDate: "2026-11-03",
          endDate: "2026-11-05",
        }),
        makeEvent({
          id: "second",
          name: "Second Event",
          startDate: "2026-11-06",
          endDate: "2026-11-07",
        }),
        makeEvent({
          id: "overlap",
          name: "Overlap Event",
          startDate: "2026-11-04",
          endDate: "2026-11-06",
        }),
      ],
      bounds,
    );

    assert.equal(layout.laneCount, 2);
    assert.equal(layout.assignmentsByEventId.get("first")?.lane, 0);
    assert.equal(layout.assignmentsByEventId.get("overlap")?.lane, 1);
    assert.equal(layout.assignmentsByEventId.get("second")?.lane, 0);
  });

  it("clips events to the visible grid while keeping deterministic lane state", () => {
    const bounds = getMonthGridBounds("2026-11");
    assert.ok(bounds);

    const layout = buildCalendarLaneLayout(
      [
        makeEvent({
          id: "cross-month",
          name: "Cross Month",
          startDate: "2026-10-28",
          endDate: "2026-11-03",
        }),
      ],
      bounds,
    );

    assert.deepEqual(layout.assignments.map((assignment) => assignment.eventId), ["cross-month"]);
    assert.equal(layout.assignments[0]?.visibleStart, "2026-10-28");
    assert.equal(layout.assignments[0]?.visibleEnd, "2026-11-03");
  });
});
