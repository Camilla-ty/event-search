import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildEventCardKeywordPreview } from "@/src/features/events/lib/eventCardKeywordPreview";

describe("buildEventCardKeywordPreview", () => {
  it("returns up to three keyword chips and an overflow count", () => {
    const preview = buildEventCardKeywordPreview([
      { id: "1", name: "DeFi", slug: "defi" },
      { id: "2", name: "Web3", slug: "web3" },
      { id: "3", name: "NFTs", slug: "nfts" },
      { id: "4", name: "Gaming", slug: "gaming" },
      { id: "5", name: "AI", slug: "ai" },
    ]);

    assert.ok(preview);
    assert.deepEqual(
      preview.visibleKeywords.map((keyword) => keyword.label),
      ["DeFi", "Web3", "NFTs"],
    );
    assert.equal(preview.overflowCount, 2);
  });

  it("returns null when there are no keywords", () => {
    assert.equal(buildEventCardKeywordPreview([]), null);
    assert.equal(buildEventCardKeywordPreview(undefined), null);
  });

  it("deduplicates keywords by id", () => {
    const preview = buildEventCardKeywordPreview([
      { id: "1", name: "DeFi", slug: "defi" },
      { id: "1", name: "DeFi", slug: "defi" },
    ]);

    assert.ok(preview);
    assert.deepEqual(preview.visibleKeywords, [{ key: "1", label: "DeFi" }]);
    assert.equal(preview.overflowCount, 0);
  });
});
