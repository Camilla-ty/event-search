import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";

import { EventCalendarHeader } from "@/src/features/events/components/explorer/EventCalendarHeader";

describe("EventCalendarHeader", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  const monthChanges: string[] = [];

  afterEach(() => {
    monthChanges.length = 0;
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    container?.remove();
    container = null;
    root = null;
  });

  function mount(month = "2026-07") {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <EventCalendarHeader
          month={month}
          onMonthChange={(nextMonth) => {
            monthChanges.push(nextMonth);
          }}
        />,
      );
    });
  }

  it("renders only the year as an extra interactive heading control", () => {
    const html = renderToStaticMarkup(
      <EventCalendarHeader month="2026-07" onMonthChange={() => undefined} />,
    );

    assert.equal(html.match(/<button/g)?.length, 3);
    assert.match(html, /aria-label="Previous month"/);
    assert.match(html, /aria-label="Next month"/);
    assert.match(html, /aria-haspopup="dialog"/);
    assert.equal(html.includes(">Previous month<"), false);
    assert.equal(html.includes(">Next month<"), false);
    assert.equal(html.includes(">Today<"), false);
    assert.match(html, />July <\/span><button/);
    assert.match(html, />2026<\/button>/);
    assert.match(html, /grid-cols-\[2\.25rem_minmax\(0,1fr\)_2\.25rem\]/);
  });

  it("opens and closes the year picker popover", () => {
    mount();

    const yearButton = container?.querySelector<HTMLButtonElement>('[aria-haspopup="dialog"]');
    assert.ok(yearButton);
    assert.equal(yearButton.getAttribute("aria-expanded"), "false");

    act(() => {
      yearButton.click();
    });

    assert.equal(yearButton.getAttribute("aria-expanded"), "true");
    assert.ok(container?.querySelector('[role="dialog"]'));

    act(() => {
      yearButton.click();
    });

    assert.equal(yearButton.getAttribute("aria-expanded"), "false");
    assert.equal(container?.querySelector('[role="dialog"]'), null);
  });

  it("highlights the selected year", () => {
    mount("2026-07");

    const yearButton = container?.querySelector<HTMLButtonElement>('[aria-haspopup="dialog"]');
    assert.ok(yearButton);

    act(() => {
      yearButton.click();
    });

    const selectedYearButton = [...(container?.querySelectorAll("button") ?? [])].find(
      (button) => button.textContent?.trim() === "2026" && button.getAttribute("aria-current") === "true",
    );
    assert.ok(selectedYearButton);
    assert.match(selectedYearButton.className, /bg-brand-primary text-white/);
  });

  it("choosing a year preserves the current month and closes the popover", () => {
    mount("2026-07");

    const yearButton = container?.querySelector<HTMLButtonElement>('[aria-haspopup="dialog"]');
    assert.ok(yearButton);

    act(() => {
      yearButton.click();
    });

    const targetYearButton = [...(container?.querySelectorAll("button") ?? [])].find(
      (button) => button.textContent?.trim() === "2028",
    );
    assert.ok(targetYearButton);

    act(() => {
      targetYearButton.click();
    });

    assert.deepEqual(monthChanges, ["2028-07"]);
    assert.equal(container?.querySelector('[role="dialog"]'), null);
  });

  it("closes the year picker on outside click", () => {
    mount();

    const yearButton = container?.querySelector<HTMLButtonElement>('[aria-haspopup="dialog"]');
    assert.ok(yearButton);

    act(() => {
      yearButton.click();
    });
    assert.ok(container?.querySelector('[role="dialog"]'));

    act(() => {
      document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });

    assert.equal(container?.querySelector('[role="dialog"]'), null);
  });

  it("closes the year picker on Escape", () => {
    mount();

    const yearButton = container?.querySelector<HTMLButtonElement>('[aria-haspopup="dialog"]');
    assert.ok(yearButton);

    act(() => {
      yearButton.click();
    });
    assert.ok(container?.querySelector('[role="dialog"]'));

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    assert.equal(container?.querySelector('[role="dialog"]'), null);
  });

  it("keeps previous and next month buttons working", () => {
    mount("2026-07");

    const previousButton = container?.querySelector<HTMLButtonElement>(
      'button[aria-label="Previous month"]',
    );
    const nextButton = container?.querySelector<HTMLButtonElement>('button[aria-label="Next month"]');
    assert.ok(previousButton);
    assert.ok(nextButton);

    act(() => {
      previousButton.click();
    });
    act(() => {
      nextButton.click();
    });

    assert.deepEqual(monthChanges, ["2026-06", "2026-08"]);
  });
});
