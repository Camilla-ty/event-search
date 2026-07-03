import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyEventExplorerFilters,
  buildEventExplorerFilterKey,
  buildEventExplorerSearchParams,
  eventExplorerClientUrlMatchesDraft,
  isEventExplorerFiltersApplying,
  matchesEventExplorerFilters,
  normalizeEventExplorerFilters,
  parseEventExplorerFiltersFromSearchParams,
} from "@/src/features/events/lib/eventExplorerQuery";

const baseFilters = {
  query: "",
  regions: [] as string[],
  startDate: "",
  endDate: "",
  topics: [] as string[],
};

describe("parseEventExplorerFiltersFromSearchParams topics", () => {
  it("returns an empty topics array when no topic params are present", () => {
    const filters = parseEventExplorerFiltersFromSearchParams(new URLSearchParams());
    assert.deepEqual(filters.topics, []);
  });

  it("parses a single legacy topic param", () => {
    const filters = parseEventExplorerFiltersFromSearchParams(
      new URLSearchParams("topic=bitcoin"),
    );
    assert.deepEqual(filters.topics, ["bitcoin"]);
  });

  it("parses repeated topic params in order", () => {
    const filters = parseEventExplorerFiltersFromSearchParams(
      new URLSearchParams("topic=bitcoin&topic=ai"),
    );
    assert.deepEqual(filters.topics, ["bitcoin", "ai"]);
  });

  it("deduplicates repeated topic slugs while preserving first order", () => {
    const filters = parseEventExplorerFiltersFromSearchParams(
      new URLSearchParams("topic=bitcoin&topic=ai&topic=bitcoin"),
    );
    assert.deepEqual(filters.topics, ["bitcoin", "ai"]);
  });

  it("supports legacy object input with a single topic field", () => {
    const filters = parseEventExplorerFiltersFromSearchParams({ topic: "bitcoin" });
    assert.deepEqual(filters.topics, ["bitcoin"]);
  });
});

describe("buildEventExplorerSearchParams topics", () => {
  it("writes repeated topic params from the topics array", () => {
    const params = buildEventExplorerSearchParams({
      ...baseFilters,
      topics: ["bitcoin", "ai"],
    });

    assert.deepEqual(params.getAll("topic"), ["bitcoin", "ai"]);
  });

  it("omits topic params when topics is empty", () => {
    const params = buildEventExplorerSearchParams({
      ...baseFilters,
      topics: [],
    });

    assert.equal(params.has("topic"), false);
  });
});

describe("normalizeEventExplorerFilters topics", () => {
  it("prefers topics array input over legacy topic string", () => {
    const filters = normalizeEventExplorerFilters({
      topic: "legacy",
      topics: ["bitcoin"],
    });

    assert.deepEqual(filters.topics, ["bitcoin"]);
  });
});

describe("buildEventExplorerFilterKey topics", () => {
  it("treats topic param order as equivalent", () => {
    const bitcoinAi = buildEventExplorerFilterKey({
      ...baseFilters,
      topics: ["bitcoin", "ai"],
    });
    const aiBitcoin = buildEventExplorerFilterKey({
      ...baseFilters,
      topics: ["ai", "bitcoin"],
    });

    assert.equal(bitcoinAi, aiBitcoin);
    assert.equal(bitcoinAi, "topic=ai&topic=bitcoin");
  });

  it("deduplicates repeated topic slugs in the comparison key", () => {
    const key = buildEventExplorerFilterKey({
      ...baseFilters,
      topics: ["bitcoin", "bitcoin", "ai"],
    });

    assert.equal(key, "topic=ai&topic=bitcoin");
  });

  it("parses repeated URL topic params into the same key regardless of order", () => {
    const fromUrl = buildEventExplorerFilterKey(
      parseEventExplorerFiltersFromSearchParams(
        new URLSearchParams("topic=ai&topic=bitcoin&topic=ai"),
      ),
    );

    assert.equal(fromUrl, "topic=ai&topic=bitcoin");
  });
});

describe("eventExplorerClientUrlMatchesDraft", () => {
  const topicFilters = {
    ...baseFilters,
    topics: ["bitcoin", "ai"],
  };

  it("matches when only topic param order differs", () => {
    const params = new URLSearchParams("topic=ai&topic=bitcoin");
    assert.equal(eventExplorerClientUrlMatchesDraft(params, topicFilters), true);
  });

  it("does not match when topic selection differs", () => {
    const params = new URLSearchParams("topic=bitcoin");
    assert.equal(eventExplorerClientUrlMatchesDraft(params, topicFilters), false);
  });
});

const stableFilters = baseFilters;

describe("isEventExplorerFiltersApplying", () => {
  it("returns false when draft, applied, and server filters match", () => {
    assert.equal(
      isEventExplorerFiltersApplying({
        draftFilters: stableFilters,
        appliedFilters: stableFilters,
        serverFilters: stableFilters,
      }),
      false,
    );
  });

  it("returns true when draft filters differ from applied filters", () => {
    assert.equal(
      isEventExplorerFiltersApplying({
        draftFilters: { ...stableFilters, topics: ["bitcoin"] },
        appliedFilters: stableFilters,
        serverFilters: stableFilters,
      }),
      true,
    );
  });

  it("returns true when URL filters differ from server results filters", () => {
    assert.equal(
      isEventExplorerFiltersApplying({
        draftFilters: { ...stableFilters, topics: ["bitcoin"] },
        appliedFilters: { ...stableFilters, topics: ["bitcoin"] },
        serverFilters: stableFilters,
      }),
      true,
    );
  });

  it("returns true when a router transition is pending", () => {
    assert.equal(
      isEventExplorerFiltersApplying({
        draftFilters: stableFilters,
        appliedFilters: stableFilters,
        serverFilters: stableFilters,
        isTransitionPending: true,
      }),
      true,
    );
  });

  it("returns false once server filters catch up to applied filters", () => {
    const topicFilters = { ...stableFilters, topics: ["bitcoin", "ai"] };

    assert.equal(
      isEventExplorerFiltersApplying({
        draftFilters: topicFilters,
        appliedFilters: topicFilters,
        serverFilters: topicFilters,
      }),
      false,
    );
  });

  it("returns false when only topic order differs between draft and applied", () => {
    assert.equal(
      isEventExplorerFiltersApplying({
        draftFilters: { ...stableFilters, topics: ["bitcoin", "ai"] },
        appliedFilters: { ...stableFilters, topics: ["ai", "bitcoin"] },
        serverFilters: { ...stableFilters, topics: ["ai", "bitcoin"] },
      }),
      false,
    );
  });

  it("returns false when server topics match applied but in different order", () => {
    assert.equal(
      isEventExplorerFiltersApplying({
        draftFilters: { ...stableFilters, topics: ["bitcoin", "ai"] },
        appliedFilters: { ...stableFilters, topics: ["bitcoin", "ai"] },
        serverFilters: { ...stableFilters, topics: ["ai", "bitcoin"] },
      }),
      false,
    );
  });
});

describe("parseEventExplorerFiltersFromSearchParams regions", () => {
  it("returns an empty regions array when no region params are present", () => {
    const filters = parseEventExplorerFiltersFromSearchParams(new URLSearchParams());
    assert.deepEqual(filters.regions, []);
  });

  it("parses a single region param", () => {
    const filters = parseEventExplorerFiltersFromSearchParams(
      new URLSearchParams("region=Singapore"),
    );
    assert.deepEqual(filters.regions, ["Singapore"]);
  });

  it("parses repeated region params in order", () => {
    const filters = parseEventExplorerFiltersFromSearchParams(
      new URLSearchParams("region=Singapore&region=United%20States"),
    );
    assert.deepEqual(filters.regions, ["Singapore", "United States"]);
  });

  it("deduplicates repeated region values while preserving first order", () => {
    const filters = parseEventExplorerFiltersFromSearchParams(
      new URLSearchParams("region=Singapore&region=Japan&region=Singapore"),
    );
    assert.deepEqual(filters.regions, ["Singapore", "Japan"]);
  });

  it("supports legacy object input with a single region field", () => {
    const filters = parseEventExplorerFiltersFromSearchParams({ region: "Singapore" });
    assert.deepEqual(filters.regions, ["Singapore"]);
  });

  it("maps legacy region=all to an empty regions array", () => {
    const filters = parseEventExplorerFiltersFromSearchParams({ region: "all" });
    assert.deepEqual(filters.regions, []);
  });
});

describe("buildEventExplorerSearchParams regions", () => {
  it("writes repeated region params from the regions array", () => {
    const params = buildEventExplorerSearchParams({
      ...baseFilters,
      regions: ["Singapore", "United States"],
    });

    assert.deepEqual(params.getAll("region"), ["Singapore", "United States"]);
  });

  it("omits region params when regions is empty", () => {
    const params = buildEventExplorerSearchParams(baseFilters);
    assert.equal(params.has("region"), false);
  });
});

describe("normalizeEventExplorerFilters regions", () => {
  it("prefers regions array input over legacy region string", () => {
    const filters = normalizeEventExplorerFilters({
      region: "Legacy",
      regions: ["Singapore"],
    });

    assert.deepEqual(filters.regions, ["Singapore"]);
  });
});

describe("buildEventExplorerFilterKey regions", () => {
  it("treats region param order as equivalent", () => {
    const singaporeJapan = buildEventExplorerFilterKey({
      ...baseFilters,
      regions: ["Singapore", "Japan"],
    });
    const japanSingapore = buildEventExplorerFilterKey({
      ...baseFilters,
      regions: ["Japan", "Singapore"],
    });

    assert.equal(singaporeJapan, japanSingapore);
    assert.equal(singaporeJapan, "region=Japan&region=Singapore");
  });

  it("deduplicates repeated region values in the comparison key", () => {
    const key = buildEventExplorerFilterKey({
      ...baseFilters,
      regions: ["Singapore", "Singapore", "Japan"],
    });

    assert.equal(key, "region=Japan&region=Singapore");
  });

  it("parses repeated URL region params into the same key regardless of order", () => {
    const fromUrl = buildEventExplorerFilterKey(
      parseEventExplorerFiltersFromSearchParams(
        new URLSearchParams("region=Japan&region=Singapore&region=Japan"),
      ),
    );

    assert.equal(fromUrl, "region=Japan&region=Singapore");
  });
});

describe("isEventExplorerFiltersApplying regions", () => {
  it("returns false when only region order differs between draft and applied", () => {
    assert.equal(
      isEventExplorerFiltersApplying({
        draftFilters: { ...stableFilters, regions: ["Singapore", "Japan"] },
        appliedFilters: { ...stableFilters, regions: ["Japan", "Singapore"] },
        serverFilters: { ...stableFilters, regions: ["Japan", "Singapore"] },
      }),
      false,
    );
  });

  it("returns false when server regions match applied but in different order", () => {
    assert.equal(
      isEventExplorerFiltersApplying({
        draftFilters: { ...stableFilters, regions: ["Singapore", "Japan"] },
        appliedFilters: { ...stableFilters, regions: ["Singapore", "Japan"] },
        serverFilters: { ...stableFilters, regions: ["Japan", "Singapore"] },
      }),
      false,
    );
  });
});

describe("matchesEventExplorerFilters regions", () => {
  const singaporeEvent = {
    name: "TOKEN2049 Singapore",
    event_series: { name: "TOKEN2049" },
    cities: { countries: { name: "Singapore" } },
    start_date: "2026-06-15",
    end_date: "2026-06-15",
  };
  const japanEvent = {
    name: "WebX Tokyo",
    event_series: { name: "WebX" },
    cities: { countries: { name: "Japan" } },
    start_date: "2026-08-01",
    end_date: "2026-08-03",
  };
  const ukEvent = {
    name: "FinTech Week",
    event_series: { name: "FinTech Week" },
    cities: { countries: { name: "United Kingdom" } },
    start_date: "2026-07-01",
    end_date: "2026-07-03",
  };
  const items = [singaporeEvent, japanEvent, ukEvent];

  it("returns all countries when regions is empty", () => {
    assert.deepEqual(
      applyEventExplorerFilters(items, baseFilters).map((item) => item.name),
      ["TOKEN2049 Singapore", "WebX Tokyo", "FinTech Week"],
    );
  });

  it("filters to a single country", () => {
    assert.deepEqual(
      applyEventExplorerFilters(items, { ...baseFilters, regions: ["Singapore"] }).map(
        (item) => item.name,
      ),
      ["TOKEN2049 Singapore"],
    );
  });

  it("matches any selected country with OR semantics", () => {
    assert.deepEqual(
      applyEventExplorerFilters(items, {
        ...baseFilters,
        regions: ["Singapore", "Japan"],
      }).map((item) => item.name),
      ["TOKEN2049 Singapore", "WebX Tokyo"],
    );
  });

  it("deduplicates repeated country selections before matching", () => {
    assert.deepEqual(
      applyEventExplorerFilters(items, {
        ...baseFilters,
        regions: ["Singapore", "Singapore", "Japan"],
      }).map((item) => item.name),
      ["TOKEN2049 Singapore", "WebX Tokyo"],
    );
  });

  it("matches country names case-insensitively", () => {
    assert.equal(
      matchesEventExplorerFilters(singaporeEvent, { ...baseFilters, regions: ["singapore"] }),
      true,
    );
    assert.equal(
      matchesEventExplorerFilters(japanEvent, { ...baseFilters, regions: ["JAPAN"] }),
      true,
    );
  });

  it("excludes all events when only unknown countries are selected", () => {
    assert.deepEqual(
      applyEventExplorerFilters(items, { ...baseFilters, regions: ["Atlantis"] }).map(
        (item) => item.name,
      ),
      [],
    );
  });

  it("produces the same matches regardless of selected country order", () => {
    const singaporeJapan = applyEventExplorerFilters(items, {
      ...baseFilters,
      regions: ["Singapore", "Japan"],
    }).map((item) => item.name);
    const japanSingapore = applyEventExplorerFilters(items, {
      ...baseFilters,
      regions: ["Japan", "Singapore"],
    }).map((item) => item.name);

    assert.deepEqual(singaporeJapan, japanSingapore);
    assert.deepEqual(singaporeJapan, ["TOKEN2049 Singapore", "WebX Tokyo"]);
  });
});

describe("legacy series URL params", () => {
  it("ignores industry, type, and series params when parsing filters", () => {
    const filters = parseEventExplorerFiltersFromSearchParams(
      new URLSearchParams("industry=TOKEN2049&type=FinTech&series=EthCC"),
    );

    assert.deepEqual(filters, baseFilters);
  });

  it("does not write industry to outbound search params", () => {
    const params = buildEventExplorerSearchParams(baseFilters);
    assert.equal(params.has("industry"), false);
    assert.equal(params.has("type"), false);
    assert.equal(params.has("series"), false);
  });
});

describe("matchesEventExplorerFilters q search", () => {
  it("matches event series names in q", () => {
    const item = {
      name: "Singapore Edition",
      event_series: { name: "TOKEN2049" },
      cities: { countries: { name: "Singapore" } },
      start_date: "2026-06-15",
      end_date: "2026-06-15",
    };

    assert.equal(matchesEventExplorerFilters(item, { ...baseFilters, query: "token" }), true);
    assert.equal(
      matchesEventExplorerFilters(item, { ...baseFilters, query: "TOKEN2049" }),
      true,
    );
    assert.equal(matchesEventExplorerFilters(item, { ...baseFilters, query: "fintech" }), false);
  });

  it("does not filter by legacy industry URL values", () => {
    const item = {
      name: "Singapore Edition",
      event_series: { name: "TOKEN2049" },
      cities: { countries: { name: "Singapore" } },
      start_date: "2026-06-15",
      end_date: "2026-06-15",
    };

    const parsed = parseEventExplorerFiltersFromSearchParams(
      new URLSearchParams("industry=FinTech Week"),
    );

    assert.equal(matchesEventExplorerFilters(item, parsed), true);
    assert.equal(
      matchesEventExplorerFilters(
        {
          ...item,
          event_series: { name: "FinTech Week" },
        },
        parsed,
      ),
      true,
    );
  });
});
