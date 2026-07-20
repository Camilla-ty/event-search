import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mapEditionToEventRecord } from "@/src/features/events/lib/mapEditionToEventRecord";
import {
  applyEventExplorerFilters,
  DEFAULT_EVENT_EXPLORER_FILTERS,
  normalizeEventExplorerFilters,
} from "@/src/features/events/lib/eventExplorerQuery";
import { buildEventExplorerPageFromCatalog } from "@/src/features/events/server/getEventExplorerPage";

/**
 * Regression coverage for the topic-filter zero-rows bug.
 *
 * Root cause: mapEditionToEventRecord dropped `series_id` while
 * editionMatchesTopicSeriesIds requires it, so every topic filter matched
 * nothing and returned total: 0. These tests exercise the REAL mapping path.
 */

const editions = [
  {
    id: "edition-bitcoin",
    series_id: "series-bitcoin",
    slug: "bitcoin-vegas-2026",
    name: "Bitcoin Vegas 2026",
    start_date: "2026-05-01",
    end_date: "2026-05-03",
  },
  {
    id: "edition-ai",
    series_id: "series-ai",
    slug: "ai-summit-2026",
    name: "AI Summit 2026",
    start_date: "2026-06-01",
    end_date: "2026-06-02",
  },
];

const EMPTY_FACETS = { countries: [], topics: [] };

describe("mapEditionToEventRecord — series_id preservation", () => {
  it("preserves series_id through the catalog mapping boundary", () => {
    const catalog = editions.map(mapEditionToEventRecord);
    assert.equal(catalog[0]?.series_id, "series-bitcoin");
    assert.equal(catalog[1]?.series_id, "series-ai");
  });

  it("maps a missing series_id to null rather than inventing one", () => {
    const record = mapEditionToEventRecord({
      id: "edition-orphan",
      name: "Orphan Edition",
      start_date: "2026-07-01",
      end_date: "2026-07-02",
    });
    assert.equal(record.series_id, null);
  });
});

describe("topic filtering through the real mapEditionToEventRecord path", () => {
  it("returns matching editions for a non-null topicSeriesIds set", () => {
    const catalog = editions.map(mapEditionToEventRecord);
    const topicSeriesIds = new Set(["series-bitcoin"]);

    const filtered = applyEventExplorerFilters(
      catalog,
      normalizeEventExplorerFilters({}),
      { topicSeriesIds },
    );

    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.id, "edition-bitcoin");
  });

  it("regression: a dropped series_id (null) yields zero matches", () => {
    const orphan = mapEditionToEventRecord({
      id: "edition-orphan",
      name: "Orphan Edition",
      start_date: "2026-07-01",
      end_date: "2026-07-02",
    });

    const filtered = applyEventExplorerFilters(
      [orphan],
      normalizeEventExplorerFilters({}),
      { topicSeriesIds: new Set(["series-bitcoin"]) },
    );

    assert.equal(filtered.length, 0);
  });
});

describe("buildEventExplorerPageFromCatalog — known topic filter returns non-zero", () => {
  it("returns a non-zero total for a known topic-filtered request", () => {
    const catalog = editions.map(mapEditionToEventRecord);

    const result = buildEventExplorerPageFromCatalog(
      catalog,
      { filters: { ...DEFAULT_EVENT_EXPLORER_FILTERS }, sort: "name", page: 1 },
      {
        filterFacets: EMPTY_FACETS,
        activeTopic: { slug: "bitcoin", name: "Bitcoin" },
        topicUnknown: false,
        topicSeriesIds: new Set(["series-bitcoin"]),
      },
    );

    assert.ok(result.total > 0, "expected a non-zero total for a known topic filter");
    assert.equal(result.total, 1);
    assert.equal(result.rows[0]?.id, "edition-bitcoin");
  });
});
