import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { EventExplorerMatchable } from "@/src/features/events/lib/eventExplorerQuery";
import {
  buildEventExplorerFilterFacets,
  buildEventExplorerFilterFacetsFromEditions,
  buildEventExplorerTopicFacets,
  getEventExplorerFacetEditions,
} from "@/src/features/events/lib/eventExplorerFilterFacets";

function makeEdition(
  overrides: Partial<EventExplorerMatchable> & { series_id?: string },
): EventExplorerMatchable & { series_id?: string } {
  return {
    name: overrides.name ?? "Sample Event",
    event_series: overrides.event_series ?? { name: "Sample Series" },
    cities: overrides.cities ?? {
      name: "Singapore",
      countries: { name: "Singapore" },
    },
    ...overrides,
  };
}

describe("getEventExplorerFacetEditions", () => {
  const editions = [
    makeEdition({ series_id: "series-a", event_series: { name: "Series A" } }),
    makeEdition({ series_id: "series-b", event_series: { name: "Series B" } }),
  ];

  it("returns all editions when topic filter is inactive", () => {
    assert.equal(getEventExplorerFacetEditions(editions, null).length, 2);
  });

  it("scopes editions to the active topic series ids", () => {
    const scoped = getEventExplorerFacetEditions(editions, new Set(["series-a"]));
    assert.equal(scoped.length, 1);
    assert.equal(scoped[0]?.event_series?.name, "Series A");
  });
});

describe("buildEventExplorerFilterFacets", () => {
  it("collects unique sorted series and country labels", () => {
    const facets = buildEventExplorerFilterFacets([
      makeEdition({
        event_series: { name: "TOKEN2049" },
        cities: { name: "Singapore", countries: { name: "Singapore" } },
      }),
      makeEdition({
        event_series: { name: "FinTech Week" },
        cities: { name: "London", countries: { name: "United Kingdom" } },
      }),
      makeEdition({
        event_series: { name: "TOKEN2049" },
        cities: { name: "Dubai", countries: { name: "United Arab Emirates" } },
      }),
    ]);

    assert.deepEqual(facets.series, ["FinTech Week", "TOKEN2049"]);
    assert.deepEqual(facets.countries, [
      "Singapore",
      "United Arab Emirates",
      "United Kingdom",
    ]);
    assert.deepEqual(facets.topics, []);
  });

  it("ignores blank series and country names", () => {
    const facets = buildEventExplorerFilterFacets([
      makeEdition({
        event_series: { name: "  " },
        cities: { name: "Nowhere", countries: { name: "" } },
      }),
      makeEdition({
        event_series: { name: "EthCC" },
        cities: { name: "Paris", countries: { name: "France" } },
      }),
    ]);

    assert.deepEqual(facets.series, ["EthCC"]);
    assert.deepEqual(facets.countries, ["France"]);
    assert.deepEqual(facets.topics, []);
  });
});

describe("buildEventExplorerTopicFacets", () => {
  it("collects unique sorted topic labels from series keywords", () => {
    const topics = buildEventExplorerTopicFacets([
      {
        series_keywords: [
          { name: "DeFi", slug: "defi" },
          { name: "Web3", slug: "web3" },
        ],
      },
      {
        series_keywords: [
          { name: "DeFi", slug: "defi" },
          { name: "NFTs", slug: "nfts" },
        ],
      },
    ]);

    assert.deepEqual(topics, [
      { slug: "defi", name: "DeFi" },
      { slug: "nfts", name: "NFTs" },
      { slug: "web3", name: "Web3" },
    ]);
  });
});

describe("buildEventExplorerFilterFacetsFromEditions", () => {
  it("builds series, country, and topic facets together", () => {
    const facets = buildEventExplorerFilterFacetsFromEditions(
      [
        makeEdition({
          event_series: { name: "EthCC" },
          cities: { name: "Paris", countries: { name: "France" } },
          series_keywords: [{ name: "DeFi", slug: "defi" }],
        }),
      ],
      [
        {
          series_keywords: [
            { name: "DeFi", slug: "defi" },
            { name: "Web3", slug: "web3" },
          ],
        },
      ],
    );

    assert.deepEqual(facets.series, ["EthCC"]);
    assert.deepEqual(facets.countries, ["France"]);
    assert.deepEqual(facets.topics, [
      { slug: "defi", name: "DeFi" },
      { slug: "web3", name: "Web3" },
    ]);
  });
});
