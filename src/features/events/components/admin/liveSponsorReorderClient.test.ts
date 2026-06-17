import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { reorderLinkIdsByDrag } from "@/src/features/events/components/admin/liveSponsorReorderClient";

describe("reorderLinkIdsByDrag", () => {
  const orderedIds = ["a", "b", "c", "d"];

  it("moves an item down within the tier", () => {
    assert.deepEqual(reorderLinkIdsByDrag(orderedIds, "b", "d"), ["a", "c", "d", "b"]);
  });

  it("moves an item up within the tier", () => {
    assert.deepEqual(reorderLinkIdsByDrag(orderedIds, "d", "a"), ["d", "a", "b", "c"]);
  });

  it("returns null when dropping on the same row", () => {
    assert.equal(reorderLinkIdsByDrag(orderedIds, "b", "b"), null);
  });

  it("returns null when an id is missing", () => {
    assert.equal(reorderLinkIdsByDrag(orderedIds, "missing", "b"), null);
  });
});
