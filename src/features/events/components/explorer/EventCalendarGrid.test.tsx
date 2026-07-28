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
    assert.match(stretched, /<div class="flex-1">/);
    assert.equal(defaultGrid.includes("flex min-h-0 flex-1 flex-col"), false);
    assert.equal(defaultGrid.includes('<div class="flex-1">'), false);
  });

  it("renders one spanning week-row capsule with one label and stable colors", () => {
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
    assert.equal(persistentBlueMatches?.length, 1);
    assert.equal((html.match(/>Persistent Summit</g) ?? []).length, 1);
    assert.match(html, /grid-column:2 \/ 4;grid-row:1/);
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

  it("keeps three visible lanes, rolls overflow into +N more, and preserves event links", () => {
    const bounds = getMonthGridBounds("2026-11");
    assert.ok(bounds);

    const events = [
      makeEvent({ id: "alpha", name: "Alpha", startDate: "2026-11-04" }),
      makeEvent({ id: "beta", name: "Beta", startDate: "2026-11-04" }),
      makeEvent({ id: "gamma", name: "Gamma", startDate: "2026-11-04" }),
      makeEvent({ id: "omega", name: "Omega", startDate: "2026-11-04" }),
    ];

    const html = renderToStaticMarkup(
      <EventCalendarGrid
        bounds={bounds}
        eventsByDay={groupEventsByDay(events, bounds.gridStart, bounds.gridEnd)}
      />,
    );

    assert.match(html, /href="\/events\/alpha"/);
    assert.match(html, /href="\/events\/beta"/);
    assert.match(html, /href="\/events\/gamma"/);
    assert.doesNotMatch(html, /href="\/events\/omega"/);
    assert.match(html, /\+1 more/);
  });

  it("does not render +N more when three or fewer lanes are visible", () => {
    const bounds = getMonthGridBounds("2026-11");
    assert.ok(bounds);

    const html = renderToStaticMarkup(
      <EventCalendarGrid
        bounds={bounds}
        eventsByDay={groupEventsByDay(
          [
            makeEvent({ id: "alpha", name: "Alpha", startDate: "2026-11-04" }),
            makeEvent({ id: "beta", name: "Beta", startDate: "2026-11-04" }),
            makeEvent({ id: "gamma", name: "Gamma", startDate: "2026-11-04" }),
          ],
          bounds.gridStart,
          bounds.gridEnd,
        )}
        variant="compact"
      />,
    );

    assert.match(html, /href="\/events\/alpha"/);
    assert.match(html, /href="\/events\/beta"/);
    assert.match(html, /href="\/events\/gamma"/);
    assert.doesNotMatch(html, /\+\d+ more/);
  });

  it("renders a rounded right edge for a row-ending capsule", () => {
    const bounds = getMonthGridBounds("2026-11");
    assert.ok(bounds);

    const html = renderToStaticMarkup(
      <EventCalendarGrid
        bounds={bounds}
        eventsByDay={groupEventsByDay(
          [
            makeEvent({
              id: "carry-over",
              name: "Carry Over",
              startDate: "2026-11-01",
              endDate: "2026-11-04",
            }),
          ],
          bounds.gridStart,
          bounds.gridEnd,
        )}
      />,
    );

    assert.match(
      html,
      /grid-column:1 \/ 4;grid-row:1"><a class="[^"]*(rounded-full|rounded-r-full rounded-l-none)[^"]*" title="Carry Over"/,
    );
  });

  it("keeps a Sunday row capsule open on the right when it continues into Monday", () => {
    const bounds = getMonthGridBounds("2026-11");
    assert.ok(bounds);

    const html = renderToStaticMarkup(
      <EventCalendarGrid
        bounds={bounds}
        eventsByDay={groupEventsByDay(
          [
            makeEvent({
              id: "boundary-continue",
              name: "Boundary Continue",
              startDate: "2026-11-08",
              endDate: "2026-11-09",
            }),
          ],
          bounds.gridStart,
          bounds.gridEnd,
        )}
      />,
    );

    assert.match(
      html,
      /grid-column:7 \/ 8;grid-row:1"><a class="[^"]*rounded-l-full rounded-r-none[^"]*" title="Boundary Continue"/,
    );
  });

  it("keeps a Monday row capsule open on the left when it continues from Sunday", () => {
    const bounds = getMonthGridBounds("2026-11");
    assert.ok(bounds);

    const html = renderToStaticMarkup(
      <EventCalendarGrid
        bounds={bounds}
        eventsByDay={groupEventsByDay(
          [
            makeEvent({
              id: "boundary-continue",
              name: "Boundary Continue",
              startDate: "2026-11-08",
              endDate: "2026-11-09",
            }),
          ],
          bounds.gridStart,
          bounds.gridEnd,
        )}
      />,
    );

    assert.match(
      html,
      /grid-column:1 \/ 2;grid-row:1"><a class="[^"]*rounded-r-full rounded-l-none[^"]*" title="Boundary Continue"/,
    );
    assert.equal((html.match(/>Boundary Continue<\/a>/g) ?? []).length, 2);
  });

  it("keeps a true Sunday end visually closed on the right", () => {
    const bounds = getMonthGridBounds("2026-11");
    assert.ok(bounds);

    const html = renderToStaticMarkup(
      <EventCalendarGrid
        bounds={bounds}
        eventsByDay={groupEventsByDay(
          [
            makeEvent({
              id: "true-sunday-end",
              name: "True Sunday End",
              startDate: "2026-11-06",
              endDate: "2026-11-08",
            }),
          ],
          bounds.gridStart,
          bounds.gridEnd,
        )}
      />,
    );

    assert.match(
      html,
      /grid-column:5 \/ 8;grid-row:1"><a class="[^"]*rounded-full[^"]*" title="True Sunday End"/,
    );
  });

  it("keeps a true Monday start visually closed on the left", () => {
    const bounds = getMonthGridBounds("2026-11");
    assert.ok(bounds);

    const html = renderToStaticMarkup(
      <EventCalendarGrid
        bounds={bounds}
        eventsByDay={groupEventsByDay(
          [
            makeEvent({
              id: "true-monday-start",
              name: "True Monday Start",
              startDate: "2026-11-09",
              endDate: "2026-11-11",
            }),
          ],
          bounds.gridStart,
          bounds.gridEnd,
        )}
      />,
    );

    assert.match(
      html,
      /grid-column:1 \/ 4;grid-row:1"><a class="[^"]*rounded-full[^"]*" title="True Monday Start"/,
    );
  });

  it("keeps the full spanning capsule link clickable and preserves its href", () => {
    const bounds = getMonthGridBounds("2026-11");
    assert.ok(bounds);

    const html = renderToStaticMarkup(
      <EventCalendarGrid
        bounds={bounds}
        eventsByDay={groupEventsByDay(
          [
            makeEvent({
              id: "persistent",
              name: "Persistent Summit",
              startDate: "2026-11-03",
              endDate: "2026-11-04",
            }),
          ],
          bounds.gridStart,
          bounds.gridEnd,
        )}
      />,
    );

    assert.match(html, /class="pointer-events-auto" style="grid-column:2 \/ 4;grid-row:1"/);
    assert.match(html, /href="\/events\/persistent"/);
    assert.match(html, /aria-label="Persistent Summit"/);
  });
});
