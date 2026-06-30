import { describe, expect, it } from "vitest";

import {
  formatSponsorGroupCount,
  groupEventSponsorsByTier,
  publicTierGroupLabel,
} from "./eventSponsorGrouping";
import type { EventSponsorRow } from "./types";

function sponsor(
  id: string,
  tierRank: number | null,
  tierLabel: string | null = null,
  displayOrder: number | null = null,
): EventSponsorRow {
  return {
    id,
    tier_rank: tierRank,
    tier_label: tierLabel,
    display_order: displayOrder,
    company_id: `company-${id}`,
  };
}

describe("groupEventSponsorsByTier", () => {
  it("orders groups by tier_rank and sponsors by display_order", () => {
    const sponsors = [
      sponsor("b", 1, "Gold Sponsor", 2),
      sponsor("a", 1, "Gold Sponsor", 1),
      sponsor("c", 2, "Silver Sponsor", 1),
    ];

    const groups = groupEventSponsorsByTier(sponsors);

    expect(groups).toHaveLength(2);
    expect(groups[0].tierRank).toBe(1);
    expect(groups[0].sponsors.map((row) => row.id)).toEqual(["a", "b"]);
    expect(groups[1].tierRank).toBe(2);
    expect(groups[1].sponsors.map((row) => row.id)).toEqual(["c"]);
  });

  it("groups null tier_rank sponsors last", () => {
    const sponsors = [sponsor("a", null), sponsor("b", 1), sponsor("c", null)];

    const groups = groupEventSponsorsByTier(sponsors);

    expect(groups).toHaveLength(2);
    expect(groups[0].tierRank).toBe(1);
    expect(groups[1].tierRank).toBeNull();
    expect(groups[1].sponsors.map((row) => row.id)).toEqual(["a", "c"]);
  });
});

describe("publicTierGroupLabel", () => {
  it("prefers tier_label when present", () => {
    expect(publicTierGroupLabel(1, "Presenting Sponsor")).toBe("Presenting Sponsor");
  });

  it("falls back to tier rank when label is missing", () => {
    expect(publicTierGroupLabel(2, null)).toBe("Tier 2");
  });

  it("falls back to untitled tier when both are missing", () => {
    expect(publicTierGroupLabel(null, null)).toBe("Untitled tier");
  });
});

describe("formatSponsorGroupCount", () => {
  it("uses singular company for one sponsor", () => {
    expect(formatSponsorGroupCount(1)).toBe("1 company");
  });

  it("uses plural companies for multiple sponsors", () => {
    expect(formatSponsorGroupCount(4)).toBe("4 companies");
  });
});
