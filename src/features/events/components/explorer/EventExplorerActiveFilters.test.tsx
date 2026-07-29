import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";

import { EventExplorerActiveFilters } from "@/src/features/events/components/explorer/EventExplorerActiveFilters";

const topicOptions = [
  { slug: "bitcoin", name: "Bitcoin" },
  { slug: "ai", name: "AI" },
];

const countryOptions = ["Singapore", "Japan"];

describe("EventExplorerActiveFilters", () => {
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

  function mount(props: {
    query?: string;
    topics?: readonly string[];
    regions?: readonly string[];
    startDate?: string;
    endDate?: string;
    onRemoveSearch?: () => void;
    onRemoveKeywords?: () => void;
    onRemoveCountries?: () => void;
    onRemoveDates?: () => void;
    onClearAll?: () => void;
  }) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <EventExplorerActiveFilters
          query={props.query ?? ""}
          topics={props.topics ?? []}
          topicOptions={topicOptions}
          regions={props.regions ?? []}
          countryOptions={countryOptions}
          startDate={props.startDate ?? ""}
          endDate={props.endDate ?? ""}
          onRemoveSearch={props.onRemoveSearch ?? (() => undefined)}
          onRemoveKeywords={props.onRemoveKeywords ?? (() => undefined)}
          onRemoveCountries={props.onRemoveCountries ?? (() => undefined)}
          onRemoveDates={props.onRemoveDates ?? (() => undefined)}
          onClearAll={props.onClearAll ?? (() => undefined)}
        />,
      );
    });
  }

  it("renders one labeled chip per filter group", () => {
    const html = renderToStaticMarkup(
      <EventExplorerActiveFilters
        query="custody"
        topics={["ai", "bitcoin"]}
        topicOptions={topicOptions}
        regions={["Singapore"]}
        countryOptions={countryOptions}
        startDate="2027-01-01"
        endDate="2027-03-31"
        onRemoveSearch={() => undefined}
        onRemoveKeywords={() => undefined}
        onRemoveCountries={() => undefined}
        onRemoveDates={() => undefined}
        onClearAll={() => undefined}
      />,
    );

    assert.match(html, /Search: custody/);
    assert.match(html, /Keyword: AI, Bitcoin/);
    assert.match(html, /Country: Singapore/);
    assert.match(html, /Date: Jan 2027 – Mar 2027/);
    assert.doesNotMatch(html, /From: Jan/);
    assert.doesNotMatch(html, /Until: Mar/);
  });

  it("formats start-only and end-only date chips", () => {
    const startOnly = renderToStaticMarkup(
      <EventExplorerActiveFilters
        query=""
        topics={[]}
        topicOptions={topicOptions}
        regions={[]}
        countryOptions={countryOptions}
        startDate="2027-01-01"
        endDate=""
        onRemoveSearch={() => undefined}
        onRemoveKeywords={() => undefined}
        onRemoveCountries={() => undefined}
        onRemoveDates={() => undefined}
        onClearAll={() => undefined}
      />,
    );
    assert.match(startOnly, /Date: From Jan 2027/);

    const endOnly = renderToStaticMarkup(
      <EventExplorerActiveFilters
        query=""
        topics={[]}
        topicOptions={topicOptions}
        regions={[]}
        countryOptions={countryOptions}
        startDate=""
        endDate="2027-03-31"
        onRemoveSearch={() => undefined}
        onRemoveKeywords={() => undefined}
        onRemoveCountries={() => undefined}
        onRemoveDates={() => undefined}
        onClearAll={() => undefined}
      />,
    );
    assert.match(endOnly, /Date: Until Mar 2027/);
  });

  it("shows Active Filters for query-only state", () => {
    const html = renderToStaticMarkup(
      <EventExplorerActiveFilters
        query="token"
        topics={[]}
        topicOptions={topicOptions}
        regions={[]}
        countryOptions={countryOptions}
        startDate=""
        endDate=""
        onRemoveSearch={() => undefined}
        onRemoveKeywords={() => undefined}
        onRemoveCountries={() => undefined}
        onRemoveDates={() => undefined}
        onClearAll={() => undefined}
      />,
    );
    assert.match(html, /Active Filters/);
    assert.match(html, /Search: token/);
  });

  it("returns null when no filters are applied", () => {
    const html = renderToStaticMarkup(
      <EventExplorerActiveFilters
        query=""
        topics={[]}
        topicOptions={topicOptions}
        regions={[]}
        countryOptions={countryOptions}
        startDate=""
        endDate=""
        onRemoveSearch={() => undefined}
        onRemoveKeywords={() => undefined}
        onRemoveCountries={() => undefined}
        onRemoveDates={() => undefined}
        onClearAll={() => undefined}
      />,
    );
    assert.equal(html, "");
  });

  it("removes whole groups via chip actions and clears all applied filters", () => {
    const removals: string[] = [];

    mount({
      query: "custody",
      topics: ["ai"],
      regions: ["Singapore"],
      startDate: "2027-01-01",
      endDate: "2027-03-31",
      onRemoveSearch: () => removals.push("search"),
      onRemoveKeywords: () => removals.push("keywords"),
      onRemoveCountries: () => removals.push("countries"),
      onRemoveDates: () => removals.push("dates"),
      onClearAll: () => removals.push("clear-all"),
    });

    const removeSearch = container!.querySelector(
      'button[aria-label="Remove search custody"]',
    );
    const removeKeywords = container!.querySelector(
      'button[aria-label="Remove keyword filters"]',
    );
    const removeCountries = container!.querySelector(
      'button[aria-label="Remove country filters"]',
    );
    const removeDates = container!.querySelector(
      'button[aria-label="Remove date filter Jan 2027 – Mar 2027"]',
    );
    const clearAll = Array.from(container!.querySelectorAll("button")).find(
      (button) => button.textContent === "Clear all",
    );

    assert.ok(removeSearch);
    assert.ok(removeKeywords);
    assert.ok(removeCountries);
    assert.ok(removeDates);
    assert.ok(clearAll);

    act(() => {
      removeSearch!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      removeKeywords!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      removeCountries!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      removeDates!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      clearAll!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    assert.deepEqual(removals, [
      "search",
      "keywords",
      "countries",
      "dates",
      "clear-all",
    ]);
  });
});
