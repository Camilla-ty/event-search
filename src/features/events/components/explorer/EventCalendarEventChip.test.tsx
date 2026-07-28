import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { EventCalendarEventChip } from "@/src/features/events/components/explorer/EventCalendarEventChip";
import type { EventRecord } from "@/src/features/events/components/explorer/types";

function makeEvent(name: string): EventRecord {
  return {
    id: name.toLowerCase().replace(/\s+/g, "-"),
    series_id: null,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    start_date: "2026-11-04",
    end_date: "2026-11-04",
    event_series: { name: "Series", logo_url: null },
    cities: null,
  };
}

describe("EventCalendarEventChip", () => {
  it("renders connected segments without internal vertical side borders", () => {
    const startHtml = renderToStaticMarkup(
      <EventCalendarEventChip event={makeEvent("Start")} segmentType="start" />,
    );
    const middleHtml = renderToStaticMarkup(
      <EventCalendarEventChip event={makeEvent("Middle")} segmentType="middle" />,
    );
    const endHtml = renderToStaticMarkup(
      <EventCalendarEventChip event={makeEvent("End")} segmentType="end" />,
    );
    const singleHtml = renderToStaticMarkup(
      <EventCalendarEventChip event={makeEvent("Single")} segmentType="single" />,
    );

    assert.match(startHtml, /border-y border-l border-r-0/);
    assert.match(middleHtml, /border-y border-x-0/);
    assert.match(endHtml, /border-y border-r border-l-0/);
    assert.match(singleHtml, /rounded-full border/);

    assert.doesNotMatch(startHtml, /border-x-0/);
    assert.doesNotMatch(middleHtml, /border-l(?!-0)|border-r(?!-0)/);
    assert.doesNotMatch(endHtml, /border-x-0/);
  });

  it("keeps labels visible for row-level continuation capsules", () => {
    const middleHtml = renderToStaticMarkup(
      <EventCalendarEventChip event={makeEvent("Middle")} segmentType="middle" />,
    );
    const endHtml = renderToStaticMarkup(
      <EventCalendarEventChip event={makeEvent("End")} segmentType="end" />,
    );

    assert.match(middleHtml, />Middle</);
    assert.match(endHtml, />End</);
    assert.doesNotMatch(middleHtml, /sr-only/);
    assert.doesNotMatch(endHtml, /sr-only/);
  });
});
