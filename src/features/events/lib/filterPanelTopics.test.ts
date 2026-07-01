import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildTopicCheckboxOptions,
  toggleTopicSelection,
} from "@/src/features/events/lib/filterPanelTopics";

const topicOptions = [
  { slug: "bitcoin", name: "Bitcoin" },
  { slug: "ai", name: "AI" },
];

describe("buildTopicCheckboxOptions", () => {
  it("preserves facet order when nothing is selected", () => {
    assert.deepEqual(buildTopicCheckboxOptions(topicOptions, []), topicOptions);
  });

  it("prepends unknown selected slugs before facet options", () => {
    assert.deepEqual(buildTopicCheckboxOptions(topicOptions, ["missing", "bitcoin"]), [
      { slug: "missing", name: "missing (not found)" },
      { slug: "bitcoin", name: "Bitcoin" },
      { slug: "ai", name: "AI" },
    ]);
  });
});

describe("toggleTopicSelection", () => {
  it("adds a slug when checked", () => {
    assert.deepEqual(toggleTopicSelection([], "bitcoin", true), ["bitcoin"]);
    assert.deepEqual(toggleTopicSelection(["bitcoin"], "ai", true), ["bitcoin", "ai"]);
  });

  it("removes a slug when unchecked", () => {
    assert.deepEqual(toggleTopicSelection(["bitcoin", "ai"], "bitcoin", false), ["ai"]);
  });

  it("does not duplicate an already selected slug", () => {
    assert.deepEqual(toggleTopicSelection(["bitcoin"], "bitcoin", true), ["bitcoin"]);
  });
});
