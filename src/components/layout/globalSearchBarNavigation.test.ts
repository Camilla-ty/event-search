import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  applyEventExplorerQueryChange,
  buildEventExplorerSearchParams,
  parseEventExplorerFiltersFromSearchParams,
} from "@/src/features/events/lib/eventExplorerQuery";
import { readSearchParamsFromWindow } from "@/src/lib/navigation/historyUrl";
import { buildPathWithSearchParams } from "@/src/lib/navigation/urlPath";
import { buildEventExplorerUrl } from "@/src/lib/routes/explorerUrls";

describe("applyEventExplorerQueryChange", () => {
  it("updates query while preserving topic, region, and date filters", () => {
    const current = {
      query: "old",
      regions: ["Singapore"],
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      topics: ["bitcoin"],
    };

    const next = applyEventExplorerQueryChange(current, "  token  ");
    assert.equal(next.query, "token");
    assert.deepEqual(next.regions, ["Singapore"]);
    assert.equal(next.startDate, "2026-01-01");
    assert.equal(next.endDate, "2026-12-31");
    assert.deepEqual(next.topics, ["bitcoin"]);

    const serialized = buildEventExplorerSearchParams(next);
    assert.equal(
      serialized.toString(),
      "q=token&region=Singapore&start=2026-01-01&end=2026-12-31&topic=bitcoin",
    );
  });
});

describe("GlobalSearchBar navigation policy", () => {
  it("uses Event Explorer bridge on /events instead of router.push", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/components/layout/GlobalSearchBar.tsx"),
      "utf8",
    );
    assert.match(source, /if \(isEventExplorerPage && eventExplorerBridge !== null\)/);
    assert.match(source, /eventExplorerBridge\.setFilters/);
    assert.match(source, /applyEventExplorerQueryChange/);
    assert.match(source, /router\.push\(buildEventExplorerUrl\(query\)\)/);
  });

  it("falls back to router.push when not on /events", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/components/layout/GlobalSearchBar.tsx"),
      "utf8",
    );
    assert.match(source, /router\.push\(buildEventExplorerUrl\(query\)\)/);
  });

  it("syncs search input from Event Explorer bridge and popstate", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/components/layout/GlobalSearchBar.tsx"),
      "utf8",
    );
    assert.match(source, /syncValue=\{isEventExplorerPage \? eventQuerySync/);
    assert.match(source, /handlePopState/);
    assert.match(source, /readSearchParamsFromWindow/);
  });
});

describe("Event Explorer bridge wiring", () => {
  it("EventExplorerPage publishes filters to the bridge", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/features/events/components/explorer/EventExplorerPage.tsx",
      ),
      "utf8",
    );
    assert.match(source, /useEventExplorerFilterBridgePublisher\(filters, setFilters\)/);
    assert.match(source, /useUrlSyncedState/);
  });

  it("BrowseMarketingChrome provides the bridge around GlobalSearchBar", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/components/layout/BrowseMarketingChrome.tsx"),
      "utf8",
    );
    assert.match(source, /EventExplorerFilterBridgeProvider/);
    assert.match(source, /<GlobalSearchBar \/>/);
  });
});

describe("cross-route event search URL", () => {
  it("still builds /events?q= for navigation from non-events routes", () => {
    assert.equal(buildEventExplorerUrl("token"), "/events?q=token");
    assert.equal(buildEventExplorerUrl(""), "/events");
  });
});

describe("popstate restoration for global search sync", () => {
  it("restores query from window search params", () => {
    const originalWindow = globalThis.window;

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: {
          search: "?q=restored&topic=bitcoin&region=Singapore&start=2026-01-01",
        },
      },
    });

    try {
      const restored = parseEventExplorerFiltersFromSearchParams(readSearchParamsFromWindow());
      assert.equal(restored.query, "restored");
      assert.deepEqual(restored.topics, ["bitcoin"]);
      assert.deepEqual(restored.regions, ["Singapore"]);
      assert.equal(restored.startDate, "2026-01-01");
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
  });

  it("builds shareable replaceState URLs for in-page search updates", () => {
    const href = buildPathWithSearchParams(
      "/events",
      buildEventExplorerSearchParams({
        query: "token",
        regions: ["Singapore"],
        startDate: "",
        endDate: "",
        topics: ["bitcoin"],
      }),
    );
    assert.equal(href, "/events?q=token&region=Singapore&topic=bitcoin");
  });
});
