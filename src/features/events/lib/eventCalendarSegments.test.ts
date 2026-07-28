import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { EventRecord } from "@/src/features/events/components/explorer/types";
import { buildCalendarColorLayout } from "@/src/features/events/lib/eventCalendarColors";
import { getMonthGridBounds } from "@/src/features/events/lib/eventCalendarGrouping";
import { buildCalendarLaneLayout } from "@/src/features/events/lib/eventCalendarLanes";
import { buildCalendarSegmentLayout } from "@/src/features/events/lib/eventCalendarSegments";

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

describe("buildCalendarSegmentLayout", () => {
  it("marks a single-day event as a single segment", () => {
    const bounds = getMonthGridBounds("2026-11");
    assert.ok(bounds);

    const laneLayout = buildCalendarLaneLayout(
      [makeEvent({ id: "single", name: "Single Day", startDate: "2026-11-03" })],
      bounds,
    );
    const colorLayout = buildCalendarColorLayout(laneLayout, bounds);
    const segmentLayout = buildCalendarSegmentLayout(colorLayout, bounds);

    assert.equal(segmentLayout.segmentsByDay.get("2026-11-03")?.[0]?.segmentType, "single");
  });

  it("marks multi-day segments as start, middle, and end within a week row", () => {
    const bounds = getMonthGridBounds("2026-11");
    assert.ok(bounds);

    const laneLayout = buildCalendarLaneLayout(
      [
        makeEvent({
          id: "multi",
          name: "Multi Day",
          startDate: "2026-11-03",
          endDate: "2026-11-05",
        }),
      ],
      bounds,
    );
    const colorLayout = buildCalendarColorLayout(laneLayout, bounds);
    const segmentLayout = buildCalendarSegmentLayout(colorLayout, bounds);

    assert.equal(segmentLayout.segmentsByDay.get("2026-11-03")?.[0]?.segmentType, "start");
    assert.equal(segmentLayout.segmentsByDay.get("2026-11-04")?.[0]?.segmentType, "middle");
    assert.equal(segmentLayout.segmentsByDay.get("2026-11-05")?.[0]?.segmentType, "end");
  });

  it("keeps continuation across Sunday to Monday week boundaries", () => {
    const bounds = getMonthGridBounds("2026-11");
    assert.ok(bounds);

    const laneLayout = buildCalendarLaneLayout(
      [
        makeEvent({
          id: "week-crossing",
          name: "Week Crossing",
          startDate: "2026-11-08",
          endDate: "2026-11-09",
        }),
      ],
      bounds,
    );
    const colorLayout = buildCalendarColorLayout(laneLayout, bounds);
    const segmentLayout = buildCalendarSegmentLayout(colorLayout, bounds);

    assert.equal(segmentLayout.segmentsByDay.get("2026-11-08")?.[0]?.segmentType, "start");
    assert.equal(segmentLayout.segmentsByDay.get("2026-11-09")?.[0]?.segmentType, "end");
  });

  it("keeps lane and color stable across all visible segments of an event", () => {
    const bounds = getMonthGridBounds("2026-11");
    assert.ok(bounds);

    const laneLayout = buildCalendarLaneLayout(
      [
        makeEvent({
          id: "persistent",
          name: "Persistent Summit",
          startDate: "2026-11-03",
          endDate: "2026-11-06",
        }),
        makeEvent({
          id: "overlap",
          name: "Overlap Forum",
          startDate: "2026-11-04",
          endDate: "2026-11-04",
        }),
      ],
      bounds,
    );
    const colorLayout = buildCalendarColorLayout(laneLayout, bounds);
    const segmentLayout = buildCalendarSegmentLayout(colorLayout, bounds);

    const persistentSegments = [
      segmentLayout.segmentsByDay.get("2026-11-03")?.find((segment) => segment.eventId === "persistent"),
      segmentLayout.segmentsByDay.get("2026-11-04")?.find((segment) => segment.eventId === "persistent"),
      segmentLayout.segmentsByDay.get("2026-11-05")?.find((segment) => segment.eventId === "persistent"),
      segmentLayout.segmentsByDay.get("2026-11-06")?.find((segment) => segment.eventId === "persistent"),
    ].filter((segment) => segment !== undefined);

    assert.ok(persistentSegments.length > 0);
    assert.deepEqual(
      new Set(persistentSegments.map((segment) => segment.lane)),
      new Set([0]),
    );
    assert.deepEqual(
      new Set(persistentSegments.map((segment) => segment.colorFamily)),
      new Set(["Blue"]),
    );
  });
});
