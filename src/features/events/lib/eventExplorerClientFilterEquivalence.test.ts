import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { EventExplorerMatchable } from "@/src/features/events/lib/eventExplorerQuery";
import {
  applyEventExplorerFilters,
  DEFAULT_EVENT_EXPLORER_FILTERS,
} from "@/src/features/events/lib/eventExplorerQuery";

type FixtureEdition = EventExplorerMatchable & { id: string };

function edition(input: Partial<FixtureEdition> & { id: string }): FixtureEdition {
  return {
    name: input.name ?? input.id,
    website_url: input.website_url ?? null,
    start_date: input.start_date ?? null,
    end_date: input.end_date ?? null,
    series_id: input.series_id ?? null,
    event_series: input.event_series ?? null,
    series_keywords: input.series_keywords ?? [],
    cities: input.cities ?? null,
    ...input,
  };
}

const catalog: FixtureEdition[] = [
  edition({
    id: "btc-only",
    series_id: "series-btc",
    series_keywords: [{ slug: "bitcoin", name: "Bitcoin" }],
    cities: { countries: { name: "Czech Republic" } },
  }),
  edition({
    id: "ai-only",
    series_id: "series-ai",
    series_keywords: [{ slug: "ai", name: "AI" }],
    cities: { countries: { name: "United Kingdom" } },
  }),
  edition({
    id: "shared-series",
    series_id: "series-shared",
    series_keywords: [
      { slug: "bitcoin", name: "Bitcoin" },
      { slug: "ai", name: "AI" },
    ],
    cities: { countries: { name: "Singapore" } },
  }),
  edition({
    id: "unlabeled-series",
    series_id: "series-none",
    series_keywords: [],
    cities: { countries: { name: "United States" } },
  }),
];

function serverFilter(
  filters: Parameters<typeof applyEventExplorerFilters>[1],
  topicSeriesIds: ReadonlySet<string> | null,
) {
  return applyEventExplorerFilters(catalog, filters, { topicSeriesIds }).map((item) => item.id);
}

function clientFilter(filters: Parameters<typeof applyEventExplorerFilters>[1]) {
  return applyEventExplorerFilters(catalog, filters, { matchTopicsByKeywords: true }).map(
    (item) => item.id,
  );
}

function assertEquivalent(
  label: string,
  filters: Parameters<typeof applyEventExplorerFilters>[1],
  topicSeriesIds: ReadonlySet<string> | null,
) {
  const server = serverFilter(filters, topicSeriesIds);
  const client = clientFilter(filters);
  assert.deepEqual(client, server, label);
}

describe("server/client topic filter equivalence", () => {
  it("matches with no topics selected", () => {
    assertEquivalent("no topics", DEFAULT_EVENT_EXPLORER_FILTERS, null);
  });

  it("matches a single known topic", () => {
    assertEquivalent(
      "bitcoin",
      { ...DEFAULT_EVENT_EXPLORER_FILTERS, topics: ["bitcoin"] },
      new Set(["series-btc", "series-shared"]),
    );
  });

  it("matches multiple topics with OR semantics", () => {
    assertEquivalent(
      "bitcoin + ai",
      { ...DEFAULT_EVENT_EXPLORER_FILTERS, topics: ["bitcoin", "ai"] },
      new Set(["series-btc", "series-ai", "series-shared"]),
    );
  });

  it("matches nothing for an unknown topic slug", () => {
    assertEquivalent(
      "unknown topic",
      { ...DEFAULT_EVENT_EXPLORER_FILTERS, topics: ["unknown-topic"] },
      new Set(),
    );
  });
});

describe("server/client non-topic filter equivalence", () => {
  it("matches query and region filters", () => {
    const filters = {
      ...DEFAULT_EVENT_EXPLORER_FILTERS,
      query: "ai",
      regions: ["United Kingdom"],
    };

    assert.deepEqual(
      serverFilter(filters, null),
      clientFilter(filters),
    );
  });

  it("matches date range filters", () => {
    const datedCatalog = catalog.map((item) =>
      item.id === "btc-only"
        ? { ...item, start_date: "2026-06-01", end_date: "2026-06-03" }
        : item,
    );

    const filters = {
      ...DEFAULT_EVENT_EXPLORER_FILTERS,
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    };

    const server = applyEventExplorerFilters(datedCatalog, filters, {
      topicSeriesIds: null,
    }).map((item) => item.id);
    const client = applyEventExplorerFilters(datedCatalog, filters, {
      matchTopicsByKeywords: true,
    }).map((item) => item.id);

    assert.deepEqual(client, server);
  });
});
