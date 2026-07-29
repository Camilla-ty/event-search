import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { EventRecord } from "@/src/features/events/components/explorer/types";
import { buildCalendarColorLayout } from "@/src/features/events/lib/eventCalendarColors";
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

describe("buildCalendarColorLayout", () => {
  it("assigns one stable color family per visible capsule unit", () => {
    const bounds = getMonthGridBounds("2026-11");
    assert.ok(bounds);

    const laneLayout = buildCalendarLaneLayout(
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

    const colorLayout = buildCalendarColorLayout(laneLayout, bounds);

    assert.equal(colorLayout.colorByEventId.get("long"), "Blue");
    assert.equal(colorLayout.colorByEventId.get("short"), "Green");
    assert.deepEqual(
      colorLayout.assignmentsByDay.get("2026-11-04")?.map((assignment) => [
        assignment.eventId,
        assignment.colorFamily,
      ]),
      [
        ["long", "Blue"],
        ["short", "Green"],
      ],
    );
    assert.deepEqual(
      colorLayout.assignmentsByDay.get("2026-11-06")?.map((assignment) => [
        assignment.eventId,
        assignment.colorFamily,
      ]),
      [["long", "Blue"]],
    );
  });

  it("reuses colors for distant capsules when no adjacency conflict exists", () => {
    const bounds = getMonthGridBounds("2026-11");
    assert.ok(bounds);

    const laneLayout = buildCalendarLaneLayout(
      [
        makeEvent({
          id: "first",
          name: "First Event",
          startDate: "2026-11-03",
          endDate: "2026-11-04",
        }),
        makeEvent({
          id: "second",
          name: "Second Event",
          startDate: "2026-11-20",
          endDate: "2026-11-21",
        }),
      ],
      bounds,
    );

    const colorLayout = buildCalendarColorLayout(laneLayout, bounds);

    assert.equal(colorLayout.colorByEventId.get("first"), "Blue");
    assert.equal(colorLayout.colorByEventId.get("second"), "Blue");
  });

  it("avoids reusing a color for horizontally touching capsules in the same lane", () => {
    const bounds = getMonthGridBounds("2026-11");
    assert.ok(bounds);

    const laneLayout = buildCalendarLaneLayout(
      [
        makeEvent({
          id: "tuesday",
          name: "Tuesday Event",
          startDate: "2026-11-03",
          endDate: "2026-11-03",
        }),
        makeEvent({
          id: "wednesday",
          name: "Wednesday Event",
          startDate: "2026-11-04",
          endDate: "2026-11-04",
        }),
      ],
      bounds,
    );

    const colorLayout = buildCalendarColorLayout(laneLayout, bounds);

    assert.equal(laneLayout.assignmentsByEventId.get("tuesday")?.lane, 0);
    assert.equal(laneLayout.assignmentsByEventId.get("wednesday")?.lane, 0);
    assert.equal(colorLayout.colorByEventId.get("tuesday"), "Blue");
    assert.equal(colorLayout.colorByEventId.get("wednesday"), "Green");
  });

  it("avoids reusing a color for cross-lane neighbouring events on adjacent days", () => {
    const bounds = getMonthGridBounds("2026-10");
    assert.ok(bounds);

    const laneLayout = buildCalendarLaneLayout(
      [
        makeEvent({
          id: "dasummit",
          name: "Digital Assets Summit (DASummit) 2026",
          startDate: "2026-10-06",
          endDate: "2026-10-06",
        }),
        // Alphabetically earlier so it occupies lane 0 on Oct 7 and pushes Asia to lane 1.
        makeEvent({
          id: "token2049",
          name: "AAA TOKEN2049 Singapore 2026",
          startDate: "2026-10-07",
          endDate: "2026-10-07",
        }),
        makeEvent({
          id: "dasummit-asia",
          name: "Digital Asset Summit Asia 2026",
          startDate: "2026-10-07",
          endDate: "2026-10-07",
        }),
      ],
      bounds,
    );

    assert.equal(laneLayout.assignmentsByEventId.get("dasummit")?.lane, 0);
    assert.equal(laneLayout.assignmentsByEventId.get("token2049")?.lane, 0);
    assert.equal(laneLayout.assignmentsByEventId.get("dasummit-asia")?.lane, 1);

    const first = buildCalendarColorLayout(laneLayout, bounds);
    const second = buildCalendarColorLayout(laneLayout, bounds);

    assert.equal(first.colorByEventId.get("dasummit"), "Blue");
    assert.equal(first.colorByEventId.get("dasummit-asia"), "Green");
    assert.equal(first.colorByEventId.get("token2049"), "Orange");
    assert.notEqual(
      first.colorByEventId.get("dasummit"),
      first.colorByEventId.get("dasummit-asia"),
    );
    assert.notEqual(
      first.colorByEventId.get("token2049"),
      first.colorByEventId.get("dasummit-asia"),
    );
    assert.deepEqual(
      [...first.colorByEventId.entries()],
      [...second.colorByEventId.entries()],
    );
  });

  it("uses the deterministic fallback when all five palette families are forbidden", () => {
    const bounds = getMonthGridBounds("2026-11");
    assert.ok(bounds);

    const laneLayout = buildCalendarLaneLayout(
      [
        makeEvent({ id: "event-a", name: "A", startDate: "2026-11-04", endDate: "2026-11-04" }),
        makeEvent({ id: "event-b", name: "B", startDate: "2026-11-04", endDate: "2026-11-04" }),
        makeEvent({ id: "event-c", name: "C", startDate: "2026-11-04", endDate: "2026-11-04" }),
        makeEvent({ id: "event-d", name: "D", startDate: "2026-11-04", endDate: "2026-11-04" }),
        makeEvent({ id: "event-e", name: "E", startDate: "2026-11-04", endDate: "2026-11-04" }),
        makeEvent({ id: "event-fallback", name: "F", startDate: "2026-11-04", endDate: "2026-11-04" }),
      ],
      bounds,
    );

    const first = buildCalendarColorLayout(laneLayout, bounds);
    const second = buildCalendarColorLayout(laneLayout, bounds);

    assert.deepEqual(
      first.assignments.slice(0, 5).map((assignment) => assignment.colorFamily),
      ["Blue", "Green", "Orange", "Purple", "Grey"],
    );
    assert.equal(
      first.colorByEventId.get("event-fallback"),
      second.colorByEventId.get("event-fallback"),
    );
    assert.deepEqual(
      [...first.colorByEventId.entries()],
      [...second.colorByEventId.entries()],
    );
    assert.ok(
      ["Blue", "Green", "Orange", "Purple", "Grey"].includes(
        first.colorByEventId.get("event-fallback") ?? "",
      ),
    );
  });
});
