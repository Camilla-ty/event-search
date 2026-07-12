import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildEventExplorerSearchParams,
  parseEventExplorerFiltersFromSearchParams,
} from "@/src/features/events/lib/eventExplorerQuery";
import { buildPathWithSearchParams } from "@/src/lib/navigation/urlPath";

describe("useUrlSyncedState popstate contract", () => {
  it("restores filters from the URL search string", () => {
    const params = buildEventExplorerSearchParams({
      query: "token",
      regions: ["Singapore"],
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      topics: ["bitcoin"],
    });

    const restored = parseEventExplorerFiltersFromSearchParams(params);
    assert.equal(restored.query, "token");
    assert.deepEqual(restored.regions, ["Singapore"]);
    assert.equal(restored.startDate, "2026-01-01");
    assert.equal(restored.endDate, "2026-12-31");
    assert.deepEqual(restored.topics, ["bitcoin"]);
  });

  it("builds stable replaceState URLs without duplicate writes", () => {
    const params = buildEventExplorerSearchParams({
      query: "",
      regions: [],
      startDate: "",
      endDate: "",
      topics: ["bitcoin"],
    });

    const href = buildPathWithSearchParams("/events", params);
    const again = buildPathWithSearchParams("/events", params);
    assert.equal(href, again);
    assert.equal(href, "/events?topic=bitcoin");
  });
});
