import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { EventCalendarDayCell } from "@/src/features/events/components/explorer/EventCalendarDayCell";
import type { EventRecord } from "@/src/features/events/components/explorer/types";
import { compareCalendarEvents } from "@/src/features/events/lib/eventCalendarOrdering";

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

describe("EventCalendarDayCell", () => {
  it("uses the canonical calendar comparator for lane ordering", () => {
    const sorted = [
      makeEvent({
        id: "alphabetical-later",
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
        id: "earlier-start",
        name: "Omega Forum",
        startDate: "2026-11-03",
        endDate: "2026-11-04",
      }),
      makeEvent({
        id: "alphabetical-earlier",
        name: "Alpha Forum",
        startDate: "2026-11-03",
        endDate: "2026-11-04",
      }),
    ].sort(compareCalendarEvents);

    assert.deepEqual(
      sorted.map((event) => event.id),
      ["longest", "alphabetical-earlier", "earlier-start", "alphabetical-later"],
    );
  });

  it("renders visible events in canonical calendar order", () => {
    const html = renderToStaticMarkup(
      <EventCalendarDayCell
        isoDate="2026-11-05"
        isCurrentMonth
        events={[
          makeEvent({
            id: "longest",
            name: "Beta Week",
            startDate: "2026-11-04",
            endDate: "2026-11-08",
          }),
          makeEvent({
            id: "earlier-start",
            name: "Omega Forum",
            startDate: "2026-11-03",
            endDate: "2026-11-04",
          }),
          makeEvent({
            id: "alphabetical-earlier",
            name: "Alpha Forum",
            startDate: "2026-11-03",
            endDate: "2026-11-04",
          }),
        ]}
      />,
    );

    const longestIndex = html.indexOf("Beta Week");
    const earlierStartAlphaIndex = html.indexOf("Alpha Forum");
    const earlierStartOmegaIndex = html.indexOf("Omega Forum");

    assert.notEqual(longestIndex, -1);
    assert.notEqual(earlierStartAlphaIndex, -1);
    assert.notEqual(earlierStartOmegaIndex, -1);

    assert.ok(longestIndex < earlierStartAlphaIndex);
    assert.ok(earlierStartAlphaIndex < earlierStartOmegaIndex);
  });

  it("preserves the existing overflow behavior", () => {
    const html = renderToStaticMarkup(
      <EventCalendarDayCell
        isoDate="2026-11-05"
        isCurrentMonth
        events={[
          makeEvent({
            id: "one",
            name: "One",
            startDate: "2026-11-05",
          }),
          makeEvent({
            id: "two",
            name: "Two",
            startDate: "2026-11-05",
          }),
          makeEvent({
            id: "three",
            name: "Three",
            startDate: "2026-11-05",
          }),
          makeEvent({
            id: "four",
            name: "Four",
            startDate: "2026-11-05",
          }),
        ]}
      />,
    );

    assert.equal((html.match(/title="/g) ?? []).length, 3);
    assert.match(html, /\+1 more/);
  });
});
