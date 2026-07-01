import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildEventExplorerSearchParams,
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
