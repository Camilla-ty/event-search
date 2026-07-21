import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { EventCalendarGrid } from "@/src/features/events/components/explorer/EventCalendarGrid";
import { getMonthGridBounds } from "@/src/features/events/lib/eventCalendarGrouping";

describe("EventCalendarGrid", () => {
  it("stretches its rows only when requested", () => {
    const bounds = getMonthGridBounds("2026-07");
    assert.ok(bounds);

    const stretched = renderToStaticMarkup(
      <EventCalendarGrid bounds={bounds} eventsByDay={new Map()} stretch />,
    );
    const defaultGrid = renderToStaticMarkup(
      <EventCalendarGrid bounds={bounds} eventsByDay={new Map()} />,
    );

    assert.match(stretched, /flex min-h-0 flex-1 flex-col/);
    assert.match(stretched, /flex-1 auto-rows-fr/);
    assert.equal(defaultGrid.includes("flex min-h-0 flex-1 flex-col"), false);
    assert.equal(defaultGrid.includes("flex-1 auto-rows-fr"), false);
  });
});
