import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";

import {
  EventCalendarHiddenEventsPopover,
  type HiddenCalendarEvent,
} from "@/src/features/events/components/explorer/EventCalendarHiddenEventsPopover";
import type { EventRecord } from "@/src/features/events/components/explorer/types";

function makeEvent(id: string, name: string): EventRecord {
  return {
    id,
    series_id: null,
    slug: id,
    name,
    start_date: "2026-11-04",
    end_date: "2026-11-04",
    event_series: { name: "Series", logo_url: null },
    cities: null,
  };
}

function makeHiddenEvent(id: string, name: string, colorFamily: HiddenCalendarEvent["colorFamily"]): HiddenCalendarEvent {
  return {
    event: makeEvent(id, name),
    colorFamily,
  };
}

describe("EventCalendarHiddenEventsPopover", () => {
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

  function mount(hiddenEvents: readonly HiddenCalendarEvent[]) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(<EventCalendarHiddenEventsPopover hiddenEvents={hiddenEvents} />);
    });
  }

  it("renders +1 and +N trigger labels", () => {
    const singleHtml = renderToStaticMarkup(
      <EventCalendarHiddenEventsPopover
        hiddenEvents={[makeHiddenEvent("one", "One", "Blue")]}
      />,
    );
    const pluralHtml = renderToStaticMarkup(
      <EventCalendarHiddenEventsPopover
        hiddenEvents={[
          makeHiddenEvent("one", "One", "Blue"),
          makeHiddenEvent("two", "Two", "Green"),
        ]}
      />,
    );

    assert.match(singleHtml, />\+1 more</);
    assert.match(singleHtml, /aria-label="Show 1 more event"/);
    assert.match(pluralHtml, />\+2 more</);
    assert.match(pluralHtml, /aria-label="Show 2 more events"/);
  });

  it("opens the hidden-event list and preserves the correct links", () => {
    mount([
      makeHiddenEvent("one", "One Event", "Blue"),
      makeHiddenEvent("two", "Two Event", "Green"),
    ]);

    const button = container?.querySelector("button");
    assert.ok(button);
    assert.equal(button.getAttribute("aria-expanded"), "false");

    act(() => {
      button.click();
    });

    assert.equal(button.getAttribute("aria-expanded"), "true");
    assert.match(container?.textContent ?? "", /One Event/);
    assert.match(container?.textContent ?? "", /Two Event/);
    assert.ok(container?.querySelector('a[href="/events/one"]'));
    assert.ok(container?.querySelector('a[href="/events/two"]'));
  });

  it("closes on outside click and Escape while remaining keyboard accessible", () => {
    mount([makeHiddenEvent("one", "One Event", "Blue")]);

    const button = container?.querySelector("button");
    assert.ok(button);
    assert.equal(button.getAttribute("aria-haspopup"), "dialog");
    button.focus();
    assert.equal(document.activeElement, button);

    act(() => {
      button.click();
    });
    assert.equal(button.getAttribute("aria-expanded"), "true");
    assert.ok(container?.querySelector('[role="dialog"]'));

    act(() => {
      document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    assert.equal(button.getAttribute("aria-expanded"), "false");

    act(() => {
      button.click();
    });
    assert.equal(button.getAttribute("aria-expanded"), "true");

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    assert.equal(button.getAttribute("aria-expanded"), "false");
  });
});
