import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatExhibitorPublicTierDisplay,
  formatExhibitorTierHeading,
  groupExhibitorsByTier,
} from "@/src/features/exhibitors/lib/groupExhibitorsByTier";
import { computeMoveOrderedLinkIds } from "@/src/features/exhibitors/lib/moveExhibitorOrder";
import type { LiveExhibitorRow } from "@/src/features/exhibitors/server/eventExhibitorAdmin";
import { validateTierReorderLinkIds } from "@/src/features/events/server/eventSponsorReorder";

function row(
  overrides: Partial<LiveExhibitorRow> & Pick<LiveExhibitorRow, "id" | "company_id">,
): LiveExhibitorRow {
  return {
    tier_rank: 1,
    tier_label: null,
    display_order: 1,
    companies: null,
    ...overrides,
  };
}

describe("groupExhibitorsByTier", () => {
  it("groups by tier_rank and preserves input order within each group", () => {
    const groups = groupExhibitorsByTier([
      row({ id: "a", company_id: "c1", tier_rank: 1, tier_label: "Gold", display_order: 1 }),
      row({ id: "b", company_id: "c2", tier_rank: 1, tier_label: "Gold", display_order: 2 }),
      row({ id: "c", company_id: "c3", tier_rank: 2, tier_label: "Silver", display_order: 1 }),
    ]);

    assert.equal(groups.length, 2);
    assert.deepEqual(
      groups[0]?.exhibitors.map((item) => item.id),
      ["a", "b"],
    );
    assert.equal(formatExhibitorTierHeading(groups[0]!), "Gold");
    assert.equal(formatExhibitorTierHeading(groups[1]!), "Silver");
  });
});

describe("formatExhibitorTierHeading", () => {
  it("prefers label only, defaults rank 1 to Exhibitor, and Tier N otherwise", () => {
    assert.equal(
      formatExhibitorTierHeading({ tierRank: 1, tierLabel: "  Gold  " }),
      "Gold",
    );
    assert.equal(
      formatExhibitorTierHeading({ tierRank: 1, tierLabel: null }),
      "Exhibitor",
    );
    assert.equal(
      formatExhibitorTierHeading({ tierRank: 1, tierLabel: "   " }),
      "Exhibitor",
    );
    assert.equal(
      formatExhibitorTierHeading({ tierRank: 2, tierLabel: null }),
      "Tier 2",
    );
    assert.equal(
      formatExhibitorTierHeading({ tierRank: null, tierLabel: null }),
      "Unranked",
    );
  });
});

describe("formatExhibitorPublicTierDisplay", () => {
  it("shares the public rule used by Event Detail and Company History", () => {
    assert.equal(formatExhibitorPublicTierDisplay(1, "Gold"), "Gold");
    assert.equal(formatExhibitorPublicTierDisplay(1, null), "Exhibitor");
    assert.equal(formatExhibitorPublicTierDisplay(3, null), "Tier 3");
    assert.equal(formatExhibitorPublicTierDisplay(null, null), null);
  });
});

describe("computeMoveOrderedLinkIds (exhibitor client)", () => {
  it("swaps within the tier and no-ops at boundaries", () => {
    assert.deepEqual(computeMoveOrderedLinkIds(["a", "b", "c"], "b", "up"), ["b", "a", "c"]);
    assert.equal(computeMoveOrderedLinkIds(["a", "b"], "a", "up"), null);
    assert.equal(computeMoveOrderedLinkIds(["a", "b"], "b", "down"), null);
  });
});

describe("validateTierReorderLinkIds exhibitor noun", () => {
  it("uses exhibitor wording in errors", () => {
    const result = validateTierReorderLinkIds(["a"], ["a", "b"], "exhibitor");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /every exhibitor in this tier/);
    }

    const outside = validateTierReorderLinkIds(["a", "x"], ["a", "b"], "exhibitor");
    assert.equal(outside.ok, false);
    if (!outside.ok) {
      assert.match(outside.error, /exhibitor link outside this tier/);
    }
  });
});
