import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { EventRecord } from "@/src/features/events/components/explorer/types";
import {
  applyEventExplorerFilters,
  buildEventExplorerSearchParams,
  DEFAULT_EVENT_EXPLORER_FILTERS,
  editionMatchesTopicSeriesIds,
  eventOverlapsDateRange,
  matchesEventExplorerFilters,
  normalizeEventExplorerFilters,
  parseEventExplorerFiltersFromSearchParams,
  resolveEventExplorerSeriesFilter,
} from "@/src/features/events/lib/eventExplorerQuery";
import { readEventIsoDate } from "@/src/features/events/lib/readEventIsoDate";

const defaultFilters = DEFAULT_EVENT_EXPLORER_FILTERS;

function makeEvent(
  overrides: Partial<EventRecord> & Pick<EventRecord, "id">,
): EventRecord {
  return {
    slug: null,
    name: overrides.name ?? "Sample Event",
    start_date: overrides.start_date ?? "2026-06-15",
    end_date: overrides.end_date ?? "2026-06-15",
    event_series: overrides.event_series ?? { name: "Sample Series", logo_url: null },
    cities: overrides.cities ?? {
      name: "Singapore",
      states: null,
      countries: { name: "Singapore" },
    },
    ...overrides,
  };
}

describe("normalizeEventExplorerFilters", () => {
  it("maps URL param aliases to canonical filter state", () => {
    assert.deepEqual(
      normalizeEventExplorerFilters({
        q: " bitcoin ",
        industry: "FinTech",
        start: "2026-06-01",
        end: "2026-06-30",
        topic: "crypto",
      }),
      {
        query: " bitcoin ",
        series: "FinTech",
        region: "all",
        startDate: "2026-06-01",
        endDate: "2026-06-30",
        topic: "crypto",
      },
    );
  });

  it("defaults empty selects to all", () => {
    assert.deepEqual(normalizeEventExplorerFilters({}), defaultFilters);
  });
});

describe("resolveEventExplorerSeriesFilter", () => {
  it("prefers series, then industry, then deprecated type", () => {
    assert.equal(
      resolveEventExplorerSeriesFilter({
        series: "Series A",
        industry: "Industry B",
        type: "Type C",
      }),
      "Series A",
    );
    assert.equal(
      resolveEventExplorerSeriesFilter({
        industry: "Industry B",
        type: "Type C",
      }),
      "Industry B",
    );
    assert.equal(
      resolveEventExplorerSeriesFilter({
        type: "Type C",
      }),
      "Type C",
    );
    assert.equal(resolveEventExplorerSeriesFilter({}), "all");
  });
});

describe("parseEventExplorerFiltersFromSearchParams", () => {
  it("reads URLSearchParams", () => {
    const params = new URLSearchParams("q=token&region=Singapore&start=2026-07-01");
    assert.deepEqual(parseEventExplorerFiltersFromSearchParams(params), {
      query: "token",
      series: "all",
      region: "Singapore",
      startDate: "2026-07-01",
      endDate: "",
      topic: "",
    });
  });

  it("maps legacy industry and type params into series", () => {
    assert.deepEqual(
      parseEventExplorerFiltersFromSearchParams(
        new URLSearchParams("industry=TOKEN2049"),
      ),
      {
        ...defaultFilters,
        series: "TOKEN2049",
      },
    );
    assert.deepEqual(
      parseEventExplorerFiltersFromSearchParams(new URLSearchParams("type=TOKEN2049")),
      {
        ...defaultFilters,
        series: "TOKEN2049",
      },
    );
    assert.deepEqual(
      parseEventExplorerFiltersFromSearchParams(
        new URLSearchParams("series=EthCC&industry=TOKEN2049"),
      ),
      {
        ...defaultFilters,
        series: "EthCC",
      },
    );
  });
});

describe("buildEventExplorerSearchParams", () => {
  it("round-trips applied filters", () => {
    const filters = {
      ...defaultFilters,
      query: "bitcoin",
      region: "Singapore",
      startDate: "2026-06-01",
      topic: "web3",
    };
    const params = buildEventExplorerSearchParams(filters, {
      view: "calendar",
      month: "2026-06",
    });
    assert.equal(params.get("q"), "bitcoin");
    assert.equal(params.get("region"), "Singapore");
    assert.equal(params.get("start"), "2026-06-01");
    assert.equal(params.get("topic"), "web3");
    assert.equal(params.get("view"), "calendar");
    assert.equal(params.get("month"), "2026-06");
    assert.equal(params.get("industry"), null);
  });

  it("writes legacy industry param for canonical series until URL migration", () => {
    const params = buildEventExplorerSearchParams({
      ...defaultFilters,
      series: "TOKEN2049",
    });
    assert.equal(params.get("industry"), "TOKEN2049");
    assert.equal(params.get("series"), null);
    assert.equal(params.get("type"), null);
  });
});

describe("applyEventExplorerFilters", () => {
  const events = [
    makeEvent({
      id: "1",
      name: "TOKEN2049 Singapore",
      event_series: { name: "TOKEN2049", logo_url: null },
    }),
    makeEvent({
      id: "2",
      name: "FinTech Week",
      event_series: { name: "FinTech Week", logo_url: null },
      start_date: "2026-07-01",
      end_date: "2026-07-03",
      cities: {
        name: "London",
        states: null,
        countries: { name: "United Kingdom" },
      },
    }),
  ];

  it("matches search against event and series names only", () => {
    assert.deepEqual(
      applyEventExplorerFilters(events, { ...defaultFilters, query: "token" }).map(
        (event) => event.id,
      ),
      ["1"],
    );
    assert.deepEqual(
      applyEventExplorerFilters(events, { ...defaultFilters, query: "fintech week" }).map(
        (event) => event.id,
      ),
      ["2"],
    );
    assert.deepEqual(
      applyEventExplorerFilters(events, { ...defaultFilters, query: "london" }).map(
        (event) => event.id,
      ),
      [],
    );
    assert.deepEqual(
      applyEventExplorerFilters(
        [
          makeEvent({
            id: "3",
            name: "Singapore Edition 2026",
            event_series: { name: "UniqueSeriesName", logo_url: null },
          }),
        ],
        { ...defaultFilters, query: "uniqueseriesname" },
      ).map((event) => event.id),
      ["3"],
    );
  });

  it("does not match city, country, or series keywords in q search", () => {
    const keywordTagged = makeEvent({
      id: "ethcc",
      name: "EthCC Paris",
      event_series: { name: "EthCC", logo_url: null },
      series_keywords: [{ id: "kw-1", name: "DeFi", slug: "defi" }],
      cities: {
        name: "Paris",
        states: null,
        countries: { name: "France" },
      },
    });

    assert.deepEqual(
      applyEventExplorerFilters([keywordTagged], { ...defaultFilters, query: "defi" }).map(
        (event) => event.id,
      ),
      [],
    );
    assert.deepEqual(
      applyEventExplorerFilters([keywordTagged], { ...defaultFilters, query: "france" }).map(
        (event) => event.id,
      ),
      [],
    );
    assert.deepEqual(
      applyEventExplorerFilters(
        [
          makeEvent({
            id: "local",
            name: "Regional Conference",
            event_series: { name: "Summit Series", logo_url: null },
            cities: {
              name: "Paris",
              states: null,
              countries: { name: "France" },
            },
          }),
        ],
        { ...defaultFilters, query: "paris" },
      ).map((event) => event.id),
      [],
    );
    assert.deepEqual(
      applyEventExplorerFilters([keywordTagged], { ...defaultFilters, query: "ethcc" }).map(
        (event) => event.id,
      ),
      ["ethcc"],
    );
  });

  it("matches edition and series website domains in q search", () => {
    const blockworks = makeEvent({
      id: "bw",
      name: "Permissionless",
      website_url: "https://www.blockworks.com/events",
      event_series: { name: "Blockworks", logo_url: null },
    });
    const tokenSeries = makeEvent({
      id: "token",
      name: "Singapore Edition",
      event_series: {
        name: "TOKEN2049",
        logo_url: null,
        website_url: "https://token2049.com",
      },
    });

    for (const query of [
      "blockworks.com",
      "www.blockworks.com",
      "https://blockworks.com/",
      "https://blockworks.com/events",
    ]) {
      assert.deepEqual(
        applyEventExplorerFilters([blockworks], { ...defaultFilters, query }).map(
          (event) => event.id,
        ),
        ["bw"],
        `expected blockworks match for ${query}`,
      );
    }

    assert.deepEqual(
      applyEventExplorerFilters([tokenSeries], { ...defaultFilters, query: "token2049.com" }).map(
        (event) => event.id,
      ),
      ["token"],
    );
  });

  it("filters by event series once using canonical series filter", () => {
    assert.deepEqual(
      applyEventExplorerFilters(events, { ...defaultFilters, series: "TOKEN2049" }).map(
        (event) => event.id,
      ),
      ["1"],
    );
  });

  it("applies region and date overlap filters", () => {
    assert.deepEqual(
      applyEventExplorerFilters(events, { ...defaultFilters, region: "Singapore" }).map(
        (event) => event.id,
      ),
      ["1"],
    );
    assert.deepEqual(
      applyEventExplorerFilters(events, { ...defaultFilters, startDate: "2026-07-02" }).map(
        (event) => event.id,
      ),
      ["2"],
    );
    assert.deepEqual(
      applyEventExplorerFilters(events, { ...defaultFilters, endDate: "2026-06-20" }).map(
        (event) => event.id,
      ),
      ["1"],
    );
  });

  it("filters by topic series ids when provided", () => {
    const withSeries = [
      { ...events[0], series_id: "series-a" },
      { ...events[1], series_id: "series-b" },
    ];
    assert.deepEqual(
      applyEventExplorerFilters(withSeries, defaultFilters, {
        topicSeriesIds: new Set(["series-a"]),
      }).map((event) => event.id),
      ["1"],
    );
  });
});

describe("editionMatchesTopicSeriesIds", () => {
  it("allows all editions when topic filter is inactive", () => {
    assert.equal(editionMatchesTopicSeriesIds({ series_id: "a" }, null), true);
  });

  it("requires membership when topic series ids are set", () => {
    const ids = new Set(["series-a"]);
    assert.equal(editionMatchesTopicSeriesIds({ series_id: "series-a" }, ids), true);
    assert.equal(editionMatchesTopicSeriesIds({ series_id: "series-b" }, ids), false);
    assert.equal(editionMatchesTopicSeriesIds({ series_id: null }, ids), false);
  });
});

describe("eventOverlapsDateRange", () => {
  it("uses readEventIsoDate for calendar dates (not UTC conversion)", () => {
    const offsetTimestamp = "2026-06-01T23:30:00-04:00";
    assert.equal(readEventIsoDate(offsetTimestamp), "2026-06-01");
    assert.equal(
      new Date(offsetTimestamp).toISOString().slice(0, 10),
      "2026-06-02",
      "legacy server parser differed on this input",
    );

    assert.equal(
      eventOverlapsDateRange(
        { start_date: offsetTimestamp, end_date: offsetTimestamp },
        "2026-06-02",
        "",
      ),
      false,
    );
    assert.equal(
      matchesEventExplorerFilters(
        makeEvent({
          id: "offset",
          name: "Offset Event",
          start_date: offsetTimestamp,
          end_date: offsetTimestamp,
        }),
        { ...defaultFilters, startDate: "2026-06-02" },
      ),
      false,
    );
  });
});

describe("parse and build round-trip", () => {
  it("preserves filter fields through URL helpers", () => {
    const original = {
      ...defaultFilters,
      query: "eth",
      series: "DeFi",
      region: "United States",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      topic: "defi",
    };
    const parsed = parseEventExplorerFiltersFromSearchParams(
      buildEventExplorerSearchParams(original),
    );
    assert.deepEqual(parsed, original);
  });
});
