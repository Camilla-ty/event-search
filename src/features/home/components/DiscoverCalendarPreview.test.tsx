import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";

import type { EventRecord } from "@/src/features/events/components/explorer/types";
import { DiscoverCalendarPreview } from "@/src/features/home/components/DiscoverCalendarPreview";

function makeEvent(overrides: Partial<EventRecord> & Pick<EventRecord, "id">): EventRecord {
  return {
    series_id: "series-1",
    name: "Sample Event",
    slug: overrides.id,
    start_date: "2027-09-10",
    end_date: "2027-09-12",
    ...overrides,
  };
}

describe("DiscoverCalendarPreview month CTA", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    container?.remove();
    container = null;
    root = null;
  });

  it("always renders the month CTA when the displayed month has no events", () => {
    const html = renderToStaticMarkup(
      <DiscoverCalendarPreview events={[]} initialMonth="2027-09" />,
    );

    assert.doesNotMatch(html, /No events this month/);
    assert.match(html, /Browse events in September 2027/);
    assert.match(html, /href="\/events\?start=2027-09-01&amp;end=2027-09-30"/);
    assert.match(html, /rounded-b-xl border border-t-0/);
    assert.doesNotMatch(html, /overflow-hidden border border-t-0 border-slate-200 bg-white rounded-b-xl/);
  });

  it("always renders the month CTA when the displayed month has events", () => {
    const html = renderToStaticMarkup(
      <DiscoverCalendarPreview
        events={[makeEvent({ id: "evt-1" })]}
        initialMonth="2027-09"
      />,
    );

    assert.doesNotMatch(html, /No events this month/);
    assert.match(html, /Browse events in September 2027/);
    assert.match(html, /href="\/events\?start=2027-09-01&amp;end=2027-09-30"/);
    assert.match(html, /Sample Event/);
  });

  it("updates the footer label and href when the displayed month changes", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <DiscoverCalendarPreview events={[]} initialMonth="2027-09" />,
      );
    });

    assert.match(container.innerHTML, /Browse events in September 2027/);
    assert.match(
      container.innerHTML,
      /href="\/events\?start=2027-09-01&amp;end=2027-09-30"/,
    );

    const nextButton = Array.from(container.querySelectorAll("button")).find((button) =>
      /next month/i.test(button.getAttribute("aria-label") ?? ""),
    );
    assert.ok(nextButton);

    act(() => {
      nextButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    assert.match(container.innerHTML, /Browse events in October 2027/);
    assert.match(
      container.innerHTML,
      /href="\/events\?start=2027-10-01&amp;end=2027-10-31"/,
    );
    assert.doesNotMatch(container.innerHTML, /Browse events in September 2027/);
  });

  it("preserves the invalid-month fallback", () => {
    const html = renderToStaticMarkup(
      <DiscoverCalendarPreview events={[]} initialMonth="2027-13" />,
    );

    assert.match(html, /Invalid calendar month/);
    assert.doesNotMatch(html, /Browse events in/);
  });
});
