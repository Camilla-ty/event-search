import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { EventRecord } from "@/src/features/events/components/explorer/types";
import {
  buildEventExplorerClientFilterFacets,
  buildEventExplorerDisplayEvents,
  filterEventExplorerCatalog,
} from "@/src/features/events/lib/eventExplorerClient";
import {
  buildEventExplorerFilterKey,
  buildEventExplorerSearchParams,
  DEFAULT_EVENT_EXPLORER_FILTERS,
  parseEventExplorerFiltersFromSearchParams,
} from "@/src/features/events/lib/eventExplorerQuery";

function event(input: Partial<EventRecord> & { id: string }): EventRecord {
  return {
    name: input.name ?? input.id,
    series_id: input.series_id ?? null,
    website_url: input.website_url ?? null,
    sponsor_count: input.sponsor_count ?? 0,
    last_reviewed_at: input.last_reviewed_at ?? null,
    start_date: input.start_date ?? null,
    end_date: input.end_date ?? null,
    event_series: input.event_series ?? null,
    series_keywords: input.series_keywords ?? [],
    cities: input.cities ?? null,
    ...input,
  };
}

const catalog: EventRecord[] = [
  event({
    id: "btc-prague",
    name: "BTC Prague",
    website_url: "https://btcprague.com",
    start_date: "2026-06-01",
    end_date: "2026-06-03",
    series_keywords: [{ id: "k1", name: "Bitcoin", slug: "bitcoin" }],
    cities: {
      name: "Prague",
      countries: { name: "Czech Republic" },
    },
  }),
  event({
    id: "ai-summit",
    name: "AI Summit",
    start_date: "2026-09-01",
    end_date: "2026-09-02",
    series_keywords: [{ id: "k2", name: "AI", slug: "ai" }],
    cities: {
      name: "London",
      countries: { name: "United Kingdom" },
    },
  }),
  event({
    id: "token2049",
    name: "TOKEN2049",
    website_url: "https://token2049.com",
    start_date: "2026-03-01",
    end_date: "2026-03-02",
    series_keywords: [
      { id: "k1", name: "Bitcoin", slug: "bitcoin" },
      { id: "k3", name: "Crypto", slug: "crypto" },
    ],
    cities: {
      name: "Singapore",
      countries: { name: "Singapore" },
    },
  }),
];

describe("filterEventExplorerCatalog", () => {
  it("filters by query against name and domain", () => {
    const result = filterEventExplorerCatalog(catalog, {
      ...DEFAULT_EVENT_EXPLORER_FILTERS,
      query: "token",
    });

    assert.deepEqual(
      result.map((item) => item.id),
      ["token2049"],
    );
  });

  it("filters by region with OR semantics", () => {
    const result = filterEventExplorerCatalog(catalog, {
      ...DEFAULT_EVENT_EXPLORER_FILTERS,
      regions: ["Singapore", "Czech Republic"],
    });

    assert.deepEqual(
      result.map((item) => item.id),
      ["btc-prague", "token2049"],
    );
  });

  it("filters by overlapping date range", () => {
    const result = filterEventExplorerCatalog(catalog, {
      ...DEFAULT_EVENT_EXPLORER_FILTERS,
      startDate: "2026-06-01",
      endDate: "2026-08-31",
    });

    assert.deepEqual(
      result.map((item) => item.id),
      ["btc-prague"],
    );
  });

  it("filters by a single topic slug", () => {
    const result = filterEventExplorerCatalog(catalog, {
      ...DEFAULT_EVENT_EXPLORER_FILTERS,
      topics: ["bitcoin"],
    });

    assert.deepEqual(
      result.map((item) => item.id),
      ["btc-prague", "token2049"],
    );
  });

  it("filters by multiple topics with OR semantics", () => {
    const result = filterEventExplorerCatalog(catalog, {
      ...DEFAULT_EVENT_EXPLORER_FILTERS,
      topics: ["bitcoin", "ai"],
    });

    assert.deepEqual(
      result.map((item) => item.id),
      ["btc-prague", "ai-summit", "token2049"],
    );
  });

  it("returns no rows for an unknown topic slug", () => {
    const result = filterEventExplorerCatalog(catalog, {
      ...DEFAULT_EVENT_EXPLORER_FILTERS,
      topics: ["unknown-topic"],
    });

    assert.deepEqual(result, []);
  });

  it("returns the full catalog when filters are cleared", () => {
    const result = filterEventExplorerCatalog(catalog, DEFAULT_EVENT_EXPLORER_FILTERS);
    assert.equal(result.length, catalog.length);
  });
});

describe("buildEventExplorerDisplayEvents", () => {
  it("keeps sort client-only and orders by name", () => {
    const sorted = buildEventExplorerDisplayEvents(
      catalog,
      DEFAULT_EVENT_EXPLORER_FILTERS,
      "name",
    );

    assert.deepEqual(
      sorted.map((item) => item.id),
      ["ai-summit", "btc-prague", "token2049"],
    );
  });
});

describe("buildEventExplorerClientFilterFacets", () => {
  it("scopes country facets to the active topic selection", () => {
    const facets = buildEventExplorerClientFilterFacets(catalog, {
      ...DEFAULT_EVENT_EXPLORER_FILTERS,
      topics: ["ai"],
    });

    assert.deepEqual(facets.countries, ["United Kingdom"]);
    assert.ok(facets.topics.some((topic) => topic.slug === "bitcoin"));
  });
});

describe("URL serialization", () => {
  it("round-trips filters through search params", () => {
    const filters = {
      query: "token",
      regions: ["Singapore"],
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      topics: ["bitcoin", "ai"],
    };

    const params = buildEventExplorerSearchParams(filters);
    const parsed = parseEventExplorerFiltersFromSearchParams(params);

    assert.equal(buildEventExplorerFilterKey(parsed), buildEventExplorerFilterKey(filters));
  });

  it("treats topic order as equivalent in filter keys", () => {
    const left = buildEventExplorerFilterKey({
      ...DEFAULT_EVENT_EXPLORER_FILTERS,
      topics: ["bitcoin", "ai"],
    });
    const right = buildEventExplorerFilterKey({
      ...DEFAULT_EVENT_EXPLORER_FILTERS,
      topics: ["ai", "bitcoin"],
    });

    assert.equal(left, right);
  });
});

describe("pagination reset key", () => {
  it("changes when any filter dimension changes", () => {
    const baseKey = buildEventExplorerFilterKey(DEFAULT_EVENT_EXPLORER_FILTERS);
    const queryKey = buildEventExplorerFilterKey({
      ...DEFAULT_EVENT_EXPLORER_FILTERS,
      query: "token",
    });

    assert.notEqual(baseKey, queryKey);
  });
});

describe("EventExplorerPage navigation policy", () => {
  it("does not import next/navigation router APIs", async () => {
    const { readFile } = await import("node:fs/promises");
    const source = await readFile(
      new URL("../components/explorer/EventExplorerPage.tsx", import.meta.url),
      "utf8",
    );

    assert.doesNotMatch(source, /useRouter/);
    assert.doesNotMatch(source, /router\.(replace|push|refresh)/);
    assert.doesNotMatch(source, /useSearchParams/);
    assert.match(source, /useEventExplorerCollection/);
  });
});
