import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildEventExplorerCollectionSearchParams,
  buildEventExplorerParamsKey,
  buildEventExplorerPath,
  clampEventExplorerPage,
  EVENT_EXPLORER_MIN_PAGE,
  EVENT_EXPLORER_PAGE_SIZE,
  parseEventExplorerPage,
  parseEventExplorerParams,
  parseEventExplorerParamsFromSearchParams,
  parseEventExplorerSort,
} from "@/src/features/events/server/eventExplorerParams";
import { DEFAULT_EVENT_EXPLORER_FILTERS } from "@/src/features/events/lib/eventExplorerQuery";

describe("parseEventExplorerPage", () => {
  it("defaults invalid values to page 1", () => {
    assert.equal(parseEventExplorerPage(null), EVENT_EXPLORER_MIN_PAGE);
    assert.equal(parseEventExplorerPage("0"), EVENT_EXPLORER_MIN_PAGE);
    assert.equal(parseEventExplorerPage("-3"), EVENT_EXPLORER_MIN_PAGE);
    assert.equal(parseEventExplorerPage("abc"), EVENT_EXPLORER_MIN_PAGE);
  });

  it("accepts valid page numbers", () => {
    assert.equal(parseEventExplorerPage("2"), 2);
    assert.equal(parseEventExplorerPage(5), 5);
  });
});

describe("parseEventExplorerSort", () => {
  it("defaults unknown sort modes to recommended", () => {
    assert.equal(parseEventExplorerSort(null), "recommended");
    assert.equal(parseEventExplorerSort("unknown"), "recommended");
  });

  it("accepts known sort modes", () => {
    assert.equal(parseEventExplorerSort("name"), "name");
    assert.equal(parseEventExplorerSort("DATE_DESC"), "date_desc");
  });
});

describe("URL serialization", () => {
  it("omits default sort and page values", () => {
    const params = parseEventExplorerParams({
      q: "token",
      sort: "recommended",
      page: "1",
    });
    const search = buildEventExplorerCollectionSearchParams(params);

    assert.equal(search.get("q"), "token");
    assert.equal(search.get("sort"), null);
    assert.equal(search.get("page"), null);
    assert.equal(search.get("page_size"), null);
  });

  it("includes non-default sort and page", () => {
    const params = parseEventExplorerParams({
      sort: "name",
      page: "3",
    });
    const search = buildEventExplorerCollectionSearchParams(params);

    assert.equal(search.get("sort"), "name");
    assert.equal(search.get("page"), "3");
  });

  it("round-trips filters, sort, and page through search params", () => {
    const input = {
      q: "token",
      regions: ["Singapore"],
      start: "2026-01-01",
      end: "2026-12-31",
      topics: ["bitcoin", "ai"],
      sort: "date_desc",
      page: "2",
    };
    const parsed = parseEventExplorerParams(input);
    const search = buildEventExplorerCollectionSearchParams(parsed);
    const roundTrip = parseEventExplorerParamsFromSearchParams(search);

    assert.equal(
      buildEventExplorerParamsKey(roundTrip),
      buildEventExplorerParamsKey(parsed),
    );
  });

  it("builds explorer paths without trailing question marks", () => {
    assert.equal(
      buildEventExplorerPath({
        filters: { ...DEFAULT_EVENT_EXPLORER_FILTERS },
        sort: "recommended",
        page: 1,
      }),
      "/events",
    );
  });
});

describe("clampEventExplorerPage", () => {
  it("clamps page to the available total", () => {
    assert.equal(clampEventExplorerPage(9, 35, EVENT_EXPLORER_PAGE_SIZE), 2);
    assert.equal(clampEventExplorerPage(1, 0, EVENT_EXPLORER_PAGE_SIZE), 1);
  });
});
