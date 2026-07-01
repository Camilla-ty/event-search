import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { EventRecord } from "@/src/features/events/components/explorer/types";
import {
  applyOptimisticTopicDisplayFilter,
  areTopicSlugSelectionsEqual,
  eventMatchesDraftTopicFilter,
  isTopicOptimisticDisplaySufficient,
} from "@/src/features/events/lib/eventOptimisticTopicFilter";

function eventWithTopics(id: string, slugs: string[]): EventRecord {
  return {
    id,
    series_keywords: slugs.map((slug) => ({ id: slug, name: slug, slug })),
  };
}

describe("areTopicSlugSelectionsEqual", () => {
  it("treats normalized topic order as equal", () => {
    assert.equal(areTopicSlugSelectionsEqual(["bitcoin", "ai"], ["bitcoin", "ai"]), true);
    assert.equal(areTopicSlugSelectionsEqual(["bitcoin", "ai"], ["ai", "bitcoin"]), true);
    assert.equal(areTopicSlugSelectionsEqual(["bitcoin"], ["ai"]), false);
  });
});

describe("eventMatchesDraftTopicFilter", () => {
  it("matches when any draft topic slug is on the event series keywords", () => {
    const event = eventWithTopics("1", ["bitcoin", "fintech"]);

    assert.equal(eventMatchesDraftTopicFilter(event, ["ai"]), false);
    assert.equal(eventMatchesDraftTopicFilter(event, ["bitcoin"]), true);
    assert.equal(eventMatchesDraftTopicFilter(event, ["bitcoin", "ai"]), true);
  });

  it("passes all events when draft topics are empty", () => {
    const event = eventWithTopics("1", ["bitcoin"]);
    assert.equal(eventMatchesDraftTopicFilter(event, []), true);
  });
});

describe("applyOptimisticTopicDisplayFilter", () => {
  const events = [
    eventWithTopics("bitcoin-only", ["bitcoin"]),
    eventWithTopics("ai-only", ["ai"]),
    eventWithTopics("both", ["bitcoin", "ai"]),
  ];

  it("returns server events unchanged when filters are stable", () => {
    const result = applyOptimisticTopicDisplayFilter(events, {
      draftTopics: ["bitcoin", "ai"],
      serverTopics: ["bitcoin", "ai"],
      isFiltersApplying: false,
    });

    assert.deepEqual(
      result.map((event) => event.id),
      ["bitcoin-only", "ai-only", "both"],
    );
  });

  it("narrows stale results when a draft topic is removed", () => {
    const result = applyOptimisticTopicDisplayFilter(events, {
      draftTopics: ["bitcoin"],
      serverTopics: ["bitcoin", "ai"],
      isFiltersApplying: true,
    });

    assert.deepEqual(
      result.map((event) => event.id),
      ["bitcoin-only", "both"],
    );
  });

  it("does not expand stale results when draft topics are cleared", () => {
    const narrowed = [eventWithTopics("bitcoin-only", ["bitcoin"])];
    const result = applyOptimisticTopicDisplayFilter(narrowed, {
      draftTopics: [],
      serverTopics: ["bitcoin"],
      isFiltersApplying: true,
    });

    assert.deepEqual(
      result.map((event) => event.id),
      ["bitcoin-only"],
    );
  });

  it("does not add new events when draft topics are expanded", () => {
    const narrowed = [eventWithTopics("bitcoin-only", ["bitcoin"])];
    const result = applyOptimisticTopicDisplayFilter(narrowed, {
      draftTopics: ["bitcoin", "ai"],
      serverTopics: ["bitcoin"],
      isFiltersApplying: true,
    });

    assert.deepEqual(
      result.map((event) => event.id),
      ["bitcoin-only"],
    );
  });
});

describe("isTopicOptimisticDisplaySufficient", () => {
  it("returns true when draft topics are a strict subset of server topics", () => {
    assert.equal(isTopicOptimisticDisplaySufficient(["bitcoin"], ["bitcoin", "ai"]), true);
  });

  it("returns false when adding topics or clearing all topics", () => {
    assert.equal(isTopicOptimisticDisplaySufficient(["bitcoin", "ai"], ["bitcoin"]), false);
    assert.equal(isTopicOptimisticDisplaySufficient([], ["bitcoin"]), false);
  });
});
