import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { EventRecord } from "@/src/features/events/components/explorer/types";
import {
  applyOptimisticCountryDisplayFilter,
  areRegionSelectionsEqual,
  eventMatchesDraftRegionFilter,
  isRegionOptimisticDisplaySufficient,
} from "@/src/features/events/lib/eventOptimisticCountryFilter";
import {
  applyOptimisticTopicDisplayFilter,
  isTopicOptimisticDisplaySufficient,
} from "@/src/features/events/lib/eventOptimisticTopicFilter";

function eventWithCountry(id: string, country: string): EventRecord {
  return {
    id,
    series_id: null,
    cities: {
      name: country,
      countries: { name: country },
    },
  };
}

describe("areRegionSelectionsEqual", () => {
  it("treats normalized region order as equal", () => {
    assert.equal(
      areRegionSelectionsEqual(["Singapore", "Japan"], ["Singapore", "Japan"]),
      true,
    );
    assert.equal(
      areRegionSelectionsEqual(["Singapore", "Japan"], ["Japan", "Singapore"]),
      true,
    );
    assert.equal(areRegionSelectionsEqual(["Singapore"], ["Japan"]), false);
  });
});

describe("eventMatchesDraftRegionFilter", () => {
  it("matches when the event country is in draft regions", () => {
    const event = eventWithCountry("1", "United States");

    assert.equal(eventMatchesDraftRegionFilter(event, ["Japan"]), false);
    assert.equal(eventMatchesDraftRegionFilter(event, ["United States"]), true);
    assert.equal(
      eventMatchesDraftRegionFilter(event, ["United States", "Japan"]),
      true,
    );
  });

  it("passes all events when draft regions are empty", () => {
    const event = eventWithCountry("1", "Singapore");
    assert.equal(eventMatchesDraftRegionFilter(event, []), true);
  });
});

describe("applyOptimisticCountryDisplayFilter", () => {
  const events = [
    eventWithCountry("us-only", "United States"),
    eventWithCountry("uk-only", "United Kingdom"),
    eventWithCountry("both", "United States"),
  ];

  it("returns server events unchanged when filters are stable", () => {
    const result = applyOptimisticCountryDisplayFilter(events, {
      draftRegions: ["United States", "United Kingdom"],
      serverRegions: ["United States", "United Kingdom"],
      isFiltersApplying: false,
    });

    assert.deepEqual(
      result.map((event) => event.id),
      ["us-only", "uk-only", "both"],
    );
  });

  it("narrows stale results when a draft country is removed", () => {
    const result = applyOptimisticCountryDisplayFilter(events, {
      draftRegions: ["United States"],
      serverRegions: ["United States", "United Kingdom"],
      isFiltersApplying: true,
    });

    assert.deepEqual(
      result.map((event) => event.id),
      ["us-only", "both"],
    );
  });

  it("does not expand stale results when draft regions are cleared", () => {
    const narrowed = [eventWithCountry("us-only", "United States")];
    const result = applyOptimisticCountryDisplayFilter(narrowed, {
      draftRegions: [],
      serverRegions: ["United States"],
      isFiltersApplying: true,
    });

    assert.deepEqual(
      result.map((event) => event.id),
      ["us-only"],
    );
  });

  it("does not add new events when draft regions are expanded", () => {
    const narrowed = [eventWithCountry("us-only", "United States")];
    const result = applyOptimisticCountryDisplayFilter(narrowed, {
      draftRegions: ["United States", "United Kingdom"],
      serverRegions: ["United States"],
      isFiltersApplying: true,
    });

    assert.deepEqual(
      result.map((event) => event.id),
      ["us-only"],
    );
  });
});

describe("isRegionOptimisticDisplaySufficient", () => {
  it("returns true when draft regions are a strict subset of server regions", () => {
    assert.equal(
      isRegionOptimisticDisplaySufficient(
        ["United States"],
        ["United States", "United Kingdom"],
      ),
      true,
    );
  });

  it("returns false when adding regions or clearing all regions", () => {
    assert.equal(
      isRegionOptimisticDisplaySufficient(
        ["United States", "United Kingdom"],
        ["United States"],
      ),
      false,
    );
    assert.equal(isRegionOptimisticDisplaySufficient([], ["United States"]), false);
  });
});

describe("applying UX for optimistic country removal", () => {
  it("hides applying state when optimistic country display is sufficient", () => {
    const isFiltersApplying = true;
    const draftRegions = ["United States"];
    const serverRegions = ["United States", "United Kingdom"];

    const showResultsApplyingState =
      isFiltersApplying &&
      !isTopicOptimisticDisplaySufficient([], []) &&
      !isRegionOptimisticDisplaySufficient(draftRegions, serverRegions);

    assert.equal(showResultsApplyingState, false);
  });

  it("still hides applying state for topic-only narrowing", () => {
    const isFiltersApplying = true;

    const showResultsApplyingState =
      isFiltersApplying &&
      !isTopicOptimisticDisplaySufficient(["bitcoin"], ["bitcoin", "ai"]) &&
      !isRegionOptimisticDisplaySufficient([], []);

    assert.equal(showResultsApplyingState, false);
  });
});

describe("topic behavior still passes with country optimistic filtering", () => {
  it("applies topic optimistic filtering before country optimistic filtering", () => {
    const events = [
      {
        id: "bitcoin-us",
        series_id: null,
        series_keywords: [{ id: "bitcoin", name: "Bitcoin", slug: "bitcoin" }],
        cities: { countries: { name: "United States" } },
      },
      {
        id: "bitcoin-uk",
        series_id: null,
        series_keywords: [{ id: "bitcoin", name: "Bitcoin", slug: "bitcoin" }],
        cities: { countries: { name: "United Kingdom" } },
      },
      {
        id: "ai-us",
        series_id: null,
        series_keywords: [{ id: "ai", name: "AI", slug: "ai" }],
        cities: { countries: { name: "United States" } },
      },
    ];

    const afterTopic = applyOptimisticTopicDisplayFilter(events, {
      draftTopics: ["bitcoin"],
      serverTopics: ["bitcoin", "ai"],
      isFiltersApplying: true,
    });

    const result = applyOptimisticCountryDisplayFilter(afterTopic, {
      draftRegions: ["United States"],
      serverRegions: ["United States", "United Kingdom"],
      isFiltersApplying: true,
    });

    assert.deepEqual(
      result.map((event) => event.id),
      ["bitcoin-us"],
    );
  });
});
