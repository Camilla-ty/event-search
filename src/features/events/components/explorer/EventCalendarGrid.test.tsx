import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { EventCalendarGrid } from "@/src/features/events/components/explorer/EventCalendarGrid";
import type { EventRecord } from "@/src/features/events/components/explorer/types";
import {
  getMonthGridBounds,
  groupEventsByDay,
} from "@/src/features/events/lib/eventCalendarGrouping";

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

  it("propagates derived chip colors from the grid and keeps multi-day colors stable", () => {
    const bounds = getMonthGridBounds("2026-11");
    assert.ok(bounds);

    const events = [
      makeEvent({
        id: "persistent",
        name: "Persistent Summit",
        startDate: "2026-11-03",
        endDate: "2026-11-04",
      }),
      makeEvent({
        id: "overlap",
        name: "Overlap Forum",
        startDate: "2026-11-04",
        endDate: "2026-11-04",
      }),
    ];
    const eventsByDay = groupEventsByDay(events, bounds.gridStart, bounds.gridEnd);

    const html = renderToStaticMarkup(
      <EventCalendarGrid bounds={bounds} eventsByDay={eventsByDay} />,
    );

    const persistentBlueMatches = html.match(
      /border-brand-primary\/60 bg-brand-primary\/5 text-slate-900[^>]*title="Persistent Summit"/g,
    );
    assert.equal(persistentBlueMatches?.length, 2);
    assert.match(
      html,
      /border-brand-success\/50 bg-brand-success\/10 text-slate-900[^>]*title="Overlap Forum"/,
    );
  });

  it("produces deterministic chip colors after rerender and month navigation", () => {
    const novemberBounds = getMonthGridBounds("2026-11");
    const decemberBounds = getMonthGridBounds("2026-12");
    assert.ok(novemberBounds);
    assert.ok(decemberBounds);

    const novemberEvents = [
      makeEvent({
        id: "persistent",
        name: "Persistent Summit",
        startDate: "2026-11-30",
        endDate: "2026-12-02",
      }),
      makeEvent({
        id: "overlap",
        name: "Overlap Forum",
        startDate: "2026-11-30",
        endDate: "2026-11-30",
      }),
    ];

    const novemberGrid = renderToStaticMarkup(
      <EventCalendarGrid
        bounds={novemberBounds}
        eventsByDay={groupEventsByDay(
          novemberEvents,
          novemberBounds.gridStart,
          novemberBounds.gridEnd,
        )}
      />,
    );
    const decemberGrid = renderToStaticMarkup(
      <EventCalendarGrid
        bounds={decemberBounds}
        eventsByDay={groupEventsByDay(
          novemberEvents,
          decemberBounds.gridStart,
          decemberBounds.gridEnd,
        )}
      />,
    );
    const novemberGridRerender = renderToStaticMarkup(
      <EventCalendarGrid
        bounds={novemberBounds}
        eventsByDay={groupEventsByDay(
          novemberEvents,
          novemberBounds.gridStart,
          novemberBounds.gridEnd,
        )}
      />,
    );
    const decemberGridRerender = renderToStaticMarkup(
      <EventCalendarGrid
        bounds={decemberBounds}
        eventsByDay={groupEventsByDay(
          novemberEvents,
          decemberBounds.gridStart,
          decemberBounds.gridEnd,
        )}
      />,
    );

    assert.equal(novemberGrid, novemberGridRerender);
    assert.equal(decemberGrid, decemberGridRerender);
  });
});
