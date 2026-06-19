import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mapKeywordRow } from "@/src/features/events/server/mapKeywordRow";

describe("mapKeywordRow", () => {
  it("maps valid keyword rows", () => {
    assert.deepEqual(
      mapKeywordRow({
        id: "  fb6999d0-43fa-4ec8-b8d5-955b91ea2304  ",
        name: " Crypto ",
        slug: " crypto ",
      }),
      {
        id: "fb6999d0-43fa-4ec8-b8d5-955b91ea2304",
        name: "Crypto",
        slug: "crypto",
      },
    );
  });

  it("ignores malformed or null embedded keyword rows", () => {
    assert.equal(mapKeywordRow(null), null);
    assert.equal(mapKeywordRow(undefined), null);
    assert.equal(mapKeywordRow("crypto"), null);
    assert.equal(mapKeywordRow({ id: "", name: "Crypto", slug: "crypto" }), null);
    assert.equal(mapKeywordRow({ id: "id", name: "", slug: "crypto" }), null);
    assert.equal(mapKeywordRow({ id: "id", name: "Crypto", slug: "" }), null);
  });
});
