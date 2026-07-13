import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  applyEventExplorerFiltersChange,
  applyEventExplorerPageChange,
  applyEventExplorerQueryChangeToParams,
  applyEventExplorerReset,
  applyEventExplorerSortChange,
  shouldApplyEventExplorerFetchResult,
} from "@/src/features/events/client/eventExplorerCollectionState";
import { DEFAULT_EVENT_EXPLORER_FILTERS } from "@/src/features/events/lib/eventExplorerQuery";
import {
  EVENT_EXPLORER_MIN_PAGE,
  parseEventExplorerParams,
} from "@/src/features/events/server/eventExplorerParams";

describe("event explorer collection state", () => {
  const baseParams = parseEventExplorerParams({
    q: "token",
    page: "3",
    sort: "name",
  });

  it("resets page when filters change", () => {
    const next = applyEventExplorerFiltersChange(baseParams, {
      ...DEFAULT_EVENT_EXPLORER_FILTERS,
      query: "ai",
    });
    assert.equal(next.page, EVENT_EXPLORER_MIN_PAGE);
    assert.equal(next.filters.query, "ai");
  });

  it("resets page when sort changes", () => {
    const next = applyEventExplorerSortChange(baseParams, "date_desc");
    assert.equal(next.page, EVENT_EXPLORER_MIN_PAGE);
    assert.equal(next.sort, "date_desc");
  });

  it("keeps page when only page changes", () => {
    const next = applyEventExplorerPageChange(baseParams, 4);
    assert.equal(next.page, 4);
    assert.equal(next.sort, baseParams.sort);
  });

  it("resets page when query changes", () => {
    const next = applyEventExplorerQueryChangeToParams(baseParams, "bitcoin");
    assert.equal(next.page, EVENT_EXPLORER_MIN_PAGE);
    assert.equal(next.filters.query, "bitcoin");
  });

  it("resets filters, sort, and page together", () => {
    const next = applyEventExplorerReset();
    assert.deepEqual(next.filters, DEFAULT_EVENT_EXPLORER_FILTERS);
    assert.equal(next.sort, "recommended");
    assert.equal(next.page, EVENT_EXPLORER_MIN_PAGE);
  });
});

describe("shouldApplyEventExplorerFetchResult", () => {
  it("accepts only the latest request id", () => {
    assert.equal(shouldApplyEventExplorerFetchResult(2, 2), true);
    assert.equal(shouldApplyEventExplorerFetchResult(1, 2), false);
  });
});

describe("no-full-catalog regression", () => {
  it("EventExplorerPage does not accept a catalog prop", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/features/events/components/explorer/EventExplorerPage.tsx"),
      "utf8",
    );

    assert.equal(source.includes("catalog"), false);
    assert.match(source, /useEventExplorerCollection/);
  });

  it("events page SSR uses getEventExplorerPage", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/(marketing)/events/page.tsx"),
      "utf8",
    );

    assert.match(source, /getEventExplorerPage/);
    assert.doesNotMatch(source, /getEventExplorerData/);
    assert.doesNotMatch(source, /mapEditionToEventRecord/);
  });

  it("explorer API route does not accept page_size", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/api/events/explorer/route.ts"),
      "utf8",
    );

    assert.doesNotMatch(source, /page_size/);
    assert.match(source, /getEventExplorerPage/);
  });
});
