import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getPublicKeywordBySlug,
  getSeriesIdsForKeywordId,
  readSeriesIdsFromKeywordLinks,
  sortPublicEditionsForTopicHub,
  sortPublicEventSeriesByName,
} from "@/src/features/events/server/topicHubPublic";
import type {
  PublicEditionSummary,
  PublicEventSeriesSummary,
} from "@/src/features/events/types/publicEdition";

describe("readSeriesIdsFromKeywordLinks", () => {
  it("extracts unique series ids and ignores malformed rows", () => {
    assert.deepEqual(
      readSeriesIdsFromKeywordLinks([
        { series_id: "series-a" },
        { series_id: "series-b" },
        { series_id: "series-a" },
        { series_id: "" },
        { series_id: null },
        null,
      ]),
      ["series-a", "series-b"],
    );
  });
});

describe("sortPublicEventSeriesByName", () => {
  it("sorts series by name ascending", () => {
    const series: PublicEventSeriesSummary[] = [
      {
        id: "2",
        slug: "token2049",
        name: "TOKEN2049",
        description: null,
        website_url: null,
        logo_url: null,
      },
      {
        id: "1",
        slug: "consensus",
        name: "Consensus",
        description: null,
        website_url: null,
        logo_url: null,
      },
    ];

    assert.deepEqual(
      sortPublicEventSeriesByName(series).map((item) => item.slug),
      ["consensus", "token2049"],
    );
  });
});

describe("sortPublicEditionsForTopicHub", () => {
  it("sorts editions by year desc then start date desc", () => {
    const editions: PublicEditionSummary[] = [
      {
        id: "1",
        slug: "event-2024",
        name: "Event 2024",
        year: 2024,
        start_date: "2024-03-01",
        end_date: null,
        locationLabel: "",
        display_logo_url: null,
        event_series: null,
      },
      {
        id: "2",
        slug: "event-2026-late",
        name: "Event 2026 Late",
        year: 2026,
        start_date: "2026-10-01",
        end_date: null,
        locationLabel: "",
        display_logo_url: null,
        event_series: null,
      },
      {
        id: "3",
        slug: "event-2026-early",
        name: "Event 2026 Early",
        year: 2026,
        start_date: "2026-06-01",
        end_date: null,
        locationLabel: "",
        display_logo_url: null,
        event_series: null,
      },
    ];

    assert.deepEqual(
      sortPublicEditionsForTopicHub(editions).map((item) => item.slug),
      ["event-2026-late", "event-2026-early", "event-2024"],
    );
  });
});

describe("getPublicKeywordBySlug", () => {
  it("returns null for blank slug without querying", async () => {
    assert.equal(await getPublicKeywordBySlug(""), null);
    assert.equal(await getPublicKeywordBySlug("   "), null);
  });
});

describe("getSeriesIdsForKeywordId", () => {
  it("returns an empty array for blank keywordId without querying", async () => {
    assert.deepEqual(await getSeriesIdsForKeywordId(""), []);
    assert.deepEqual(await getSeriesIdsForKeywordId("   "), []);
  });
});
