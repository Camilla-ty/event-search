import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildEventExplorerFilterKey,
  buildEventExplorerSearchParams,
  eventExplorerClientUrlMatchesDraft,
  isEventExplorerFiltersApplying,
  normalizeEventExplorerFilters,
  parseEventExplorerFiltersFromSearchParams,
} from "@/src/features/events/lib/eventExplorerQuery";

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
      query: "",
      series: "all",
      region: "all",
      startDate: "",
      endDate: "",
      topics: ["bitcoin", "ai"],
    });

    assert.deepEqual(params.getAll("topic"), ["bitcoin", "ai"]);
  });

  it("omits topic params when topics is empty", () => {
    const params = buildEventExplorerSearchParams({
      query: "",
      series: "all",
      region: "all",
      startDate: "",
      endDate: "",
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
  const baseFilters = {
    query: "",
    series: "all",
    region: "all",
    startDate: "",
    endDate: "",
    topics: [] as string[],
  };

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
  const baseFilters = {
    query: "",
    series: "all",
    region: "all",
    startDate: "",
    endDate: "",
    topics: ["bitcoin", "ai"],
  };

  it("matches when only topic param order differs", () => {
    const params = new URLSearchParams("topic=ai&topic=bitcoin");
    assert.equal(eventExplorerClientUrlMatchesDraft(params, baseFilters), true);
  });

  it("does not match when topic selection differs", () => {
    const params = new URLSearchParams("topic=bitcoin");
    assert.equal(eventExplorerClientUrlMatchesDraft(params, baseFilters), false);
  });
});

const stableFilters = {
  query: "",
  series: "all",
  region: "all",
  startDate: "",
  endDate: "",
  topics: [] as string[],
};

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
