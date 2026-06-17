import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getDirtyTierOrders,
  isRosterOrderDirty,
  reorderLinkIdsByDrag,
} from "@/src/features/events/components/admin/liveSponsorReorderClient";
import type { LiveSponsorRow } from "@/src/features/events/components/admin/liveSponsorTypes";

function sponsor(
  id: string,
  tierRank: number | null,
  displayOrder: number | null,
): LiveSponsorRow {
  return {
    id,
    tier_rank: tierRank,
    tier_label: null,
    display_order: displayOrder,
    companies: null,
  };
}

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

describe("getDirtyTierOrders", () => {
  it("returns no dirty tiers when order matches", () => {
    const roster = [sponsor("a", 1, 1), sponsor("b", 1, 2), sponsor("c", 2, 1)];
    assert.deepEqual(getDirtyTierOrders(roster, roster), []);
    assert.equal(isRosterOrderDirty(roster, roster), false);
  });

  it("detects a dirty tier after local reorder", () => {
    const saved = [sponsor("a", 1, 1), sponsor("b", 1, 2), sponsor("c", 1, 3)];
    const draft = [sponsor("a", 1, 1), sponsor("c", 1, 2), sponsor("b", 1, 3)];

    assert.deepEqual(getDirtyTierOrders(saved, draft), [
      { tier_rank: 1, ordered_link_ids: ["a", "c", "b"] },
    ]);
    assert.equal(isRosterOrderDirty(saved, draft), true);
  });

  it("detects multiple dirty tiers independently", () => {
    const saved = [sponsor("a", 1, 1), sponsor("b", 1, 2), sponsor("c", 2, 1), sponsor("d", 2, 2)];
    const draft = [sponsor("b", 1, 1), sponsor("a", 1, 2), sponsor("d", 2, 1), sponsor("c", 2, 2)];

    assert.deepEqual(getDirtyTierOrders(saved, draft), [
      { tier_rank: 1, ordered_link_ids: ["b", "a"] },
      { tier_rank: 2, ordered_link_ids: ["d", "c"] },
    ]);
  });

  it("includes unranked tiers when their order changes", () => {
    const saved = [sponsor("a", null, 1), sponsor("b", null, 2)];
    const draft = [sponsor("b", null, 1), sponsor("a", null, 2)];

    assert.deepEqual(getDirtyTierOrders(saved, draft), [
      { tier_rank: null, ordered_link_ids: ["b", "a"] },
    ]);
  });
});
