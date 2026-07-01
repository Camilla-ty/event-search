import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildActiveTopicChips } from "@/src/features/events/lib/activeTopicChips";
import { toggleTopicSelection } from "@/src/features/events/lib/filterPanelTopics";

const topicOptions = [
  { slug: "bitcoin", name: "Bitcoin" },
  { slug: "ai", name: "AI" },
  { slug: "fintech", name: "Fintech" },
];

describe("buildActiveTopicChips", () => {
  it("returns no chips when no topics are active", () => {
    assert.deepEqual(buildActiveTopicChips([], topicOptions), []);
  });

  it("renders one chip per active topic in selection order", () => {
    const chips = buildActiveTopicChips(["bitcoin", "ai", "fintech"], topicOptions);

    assert.equal(chips.length, 3);
    assert.deepEqual(
      chips.map((chip) => chip.label),
      ["Bitcoin", "AI", "Fintech"],
    );
    assert.deepEqual(
      chips.map((chip) => chip.hubPath),
      ["/topics/bitcoin", "/topics/ai", "/topics/fintech"],
    );
  });

  it("deduplicates repeated slugs in the selection", () => {
    const chips = buildActiveTopicChips(["bitcoin", "bitcoin"], topicOptions);
    assert.equal(chips.length, 1);
    assert.equal(chips[0]?.slug, "bitcoin");
  });

  it("labels unknown topic slugs as not found", () => {
    const chips = buildActiveTopicChips(["missing"], topicOptions);

    assert.deepEqual(chips, [
      {
        slug: "missing",
        label: "missing (not found)",
        unknown: true,
        hubPath: null,
      },
    ]);
  });

  it("mixes known and unknown topic chips", () => {
    const chips = buildActiveTopicChips(["bitcoin", "missing", "ai"], topicOptions);

    assert.deepEqual(
      chips.map((chip) => chip.label),
      ["Bitcoin", "missing (not found)", "AI"],
    );
  });
});

describe("active topic chip removal", () => {
  it("removes only the targeted topic slug", () => {
    const nextTopics = toggleTopicSelection(["bitcoin", "ai", "fintech"], "ai", false);
    const chips = buildActiveTopicChips(nextTopics, topicOptions);

    assert.deepEqual(
      chips.map((chip) => chip.slug),
      ["bitcoin", "fintech"],
    );
  });

  it("clears all chips when topics become empty", () => {
    const nextTopics = toggleTopicSelection(["bitcoin", "ai"], "bitcoin", false);
    const afterSecond = toggleTopicSelection(nextTopics, "ai", false);

    assert.deepEqual(afterSecond, []);
    assert.deepEqual(buildActiveTopicChips(afterSecond, topicOptions), []);
  });
});
