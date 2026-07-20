import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { EventRecord } from "@/src/features/events/components/explorer/types";
import { DEFAULT_EVENT_EXPLORER_FILTERS } from "@/src/features/events/lib/eventExplorerQuery";
import { buildEventExplorerPageFromCatalog } from "@/src/features/events/server/getEventExplorerPage";
import { mapEditionToEventExplorerRow } from "@/src/features/events/server/mapEventExplorerRow";
import { EVENT_EXPLORER_PAGE_SIZE } from "@/src/features/events/server/eventExplorerParams";

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

const catalog: EventRecord[] = Array.from({ length: 25 }, (_, index) =>
  event({
    id: `event-${index + 1}`,
    name: `Event ${String(index + 1).padStart(2, "0")}`,
    start_date: `2026-01-${String((index % 28) + 1).padStart(2, "0")}`,
  }),
);

const emptyFacets = { countries: [], topics: [] };

describe("buildEventExplorerPageFromCatalog", () => {
  it("returns at most EVENT_EXPLORER_PAGE_SIZE rows", () => {
    const result = buildEventExplorerPageFromCatalog(
      catalog,
      {
        filters: { ...DEFAULT_EVENT_EXPLORER_FILTERS },
        sort: "name",
        page: 1,
      },
      {
        filterFacets: emptyFacets,
        activeTopic: null,
        topicUnknown: false,
        topicSeriesIds: null,
      },
    );

    assert.equal(result.rows.length, EVENT_EXPLORER_PAGE_SIZE);
    assert.equal(result.total, catalog.length);
    assert.equal(result.page_size, EVENT_EXPLORER_PAGE_SIZE);
  });

  it("paginates sorted results", () => {
    const page1 = buildEventExplorerPageFromCatalog(
      catalog,
      {
        filters: { ...DEFAULT_EVENT_EXPLORER_FILTERS },
        sort: "name",
        page: 1,
      },
      {
        filterFacets: emptyFacets,
        activeTopic: null,
        topicUnknown: false,
        topicSeriesIds: null,
      },
    );
    const page2 = buildEventExplorerPageFromCatalog(
      catalog,
      {
        filters: { ...DEFAULT_EVENT_EXPLORER_FILTERS },
        sort: "name",
        page: 2,
      },
      {
        filterFacets: emptyFacets,
        activeTopic: null,
        topicUnknown: false,
        topicSeriesIds: null,
      },
    );

    assert.notEqual(page1.rows[0]?.id, page2.rows[0]?.id);
    assert.equal(page1.rows.length + page2.rows.length, catalog.length);
  });

  it("filters before paginating", () => {
    const filteredCatalog = catalog.filter((item) => item.id === "event-3");
    const result = buildEventExplorerPageFromCatalog(
      filteredCatalog,
      {
        filters: { ...DEFAULT_EVENT_EXPLORER_FILTERS, query: "Event 03" },
        sort: "name",
        page: 1,
      },
      {
        filterFacets: emptyFacets,
        activeTopic: null,
        topicUnknown: false,
        topicSeriesIds: null,
      },
    );

    assert.equal(result.total, 1);
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0]?.id, "event-3");
  });

  it("marks pageWasClamped when requested page exceeds total pages", () => {
    const result = buildEventExplorerPageFromCatalog(
      catalog,
      {
        filters: { ...DEFAULT_EVENT_EXPLORER_FILTERS },
        sort: "name",
        page: 99,
      },
      {
        filterFacets: emptyFacets,
        activeTopic: null,
        topicUnknown: false,
        topicSeriesIds: null,
      },
    );

    assert.equal(result.page, 2);
    assert.equal(result.pageWasClamped, true);
  });
});

describe("mapEditionToEventExplorerRow", () => {
  it("does not expose website URLs, keyword IDs, or raw location objects", () => {
    const row = mapEditionToEventExplorerRow(
      event({
        id: "btc-prague",
        slug: "btc-prague",
        name: "BTC Prague",
        website_url: "https://btcprague.com",
        series_keywords: [{ id: "k1", name: "Bitcoin", slug: "bitcoin" }],
        cities: {
          name: "Prague",
          countries: { name: "Czech Republic" },
        },
        event_series: {
          name: "BTC Series",
          logo_url: "/logos/btc.png",
          website_url: "https://series.example.com",
        },
      }),
    );

    assert.equal(row.href.includes("btc-prague"), true);
    assert.equal(row.location_label.includes("Prague"), true);
    assert.equal("website_url" in row, false);
    assert.equal("cities" in row, false);
    assert.equal("last_reviewed_at" in row, false);
    assert.deepEqual(row.keyword_preview?.visible, ["Bitcoin"]);
    assert.equal(
      JSON.stringify(row).includes("k1"),
      false,
    );
  });
});
