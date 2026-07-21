import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { EventCalendarHeader } from "@/src/features/events/components/explorer/EventCalendarHeader";

describe("EventCalendarHeader", () => {
  it("renders accessible arrow navigation without a Today button", () => {
    const html = renderToStaticMarkup(
      <EventCalendarHeader month="2026-07" onMonthChange={() => undefined} />,
    );

    assert.equal(html.match(/<button/g)?.length, 2);
    assert.match(html, /aria-label="Previous month"/);
    assert.match(html, /aria-label="Next month"/);
    assert.equal(html.includes(">Previous month<"), false);
    assert.equal(html.includes(">Next month<"), false);
    assert.equal(html.includes(">Today<"), false);
    assert.match(html, /July 2026/);
    assert.match(html, /grid-cols-\[2\.25rem_minmax\(0,1fr\)_2\.25rem\]/);
    assert.match(html, /text-center text-lg font-semibold/);
    assert.match(
      html,
      /aria-label="Previous month"[\s\S]*July 2026[\s\S]*aria-label="Next month"/,
    );
  });
});
