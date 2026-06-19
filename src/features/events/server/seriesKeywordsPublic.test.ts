import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getPublicKeywordsForSeriesId,
  mapPublicKeywordsFromSeriesKeywordLinks,
  sortPublicKeywordsByName,
} from "@/src/features/events/server/seriesKeywordsPublic";

describe("mapPublicKeywordsFromSeriesKeywordLinks", () => {
  it("maps valid links and sorts by name ASC", () => {
    const result = mapPublicKeywordsFromSeriesKeywordLinks([
      {
        keyword_id: "2",
        keyword: { id: "2", name: "Web3", slug: "web3" },
      },
      {
        keyword_id: "1",
        keyword: [{ id: "1", name: "Crypto", slug: "crypto" }],
      },
      {
        keyword_id: "3",
        keyword: null,
      },
      {
        keyword_id: "4",
        keyword: { id: "4", name: "", slug: "broken" },
      },
    ]);

    assert.deepEqual(result, [
      { id: "1", name: "Crypto", slug: "crypto" },
      { id: "2", name: "Web3", slug: "web3" },
    ]);
  });
});

describe("sortPublicKeywordsByName", () => {
  it("sorts by name ascending", () => {
    const sorted = sortPublicKeywordsByName([
      { id: "2", name: "NFTs", slug: "nfts" },
      { id: "1", name: "AI", slug: "ai" },
      { id: "3", name: "Crypto", slug: "crypto" },
    ]);

    assert.deepEqual(
      sorted.map((keyword) => keyword.name),
      ["AI", "Crypto", "NFTs"],
    );
  });
});

describe("getPublicKeywordsForSeriesId", () => {
  it("returns an empty array for blank seriesId without querying", async () => {
    assert.deepEqual(await getPublicKeywordsForSeriesId(""), []);
    assert.deepEqual(await getPublicKeywordsForSeriesId("   "), []);
  });
});
