import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatPublicExhibitorTierHeading,
  groupPublicExhibitorsByTier,
  shouldShowPublicExhibitorsTab,
  sortPublicExhibitorRows,
  type PublicExhibitorRow,
} from "@/src/features/exhibitors/server/exhibitorsPublic";
import { resolvePublicExhibitorWebPresence } from "@/src/features/exhibitors/lib/resolvePublicExhibitorWebPresence";

function row(
  overrides: Partial<PublicExhibitorRow> & Pick<PublicExhibitorRow, "id" | "company_id">,
): PublicExhibitorRow {
  const { company: companyOverrides, ...rest } = overrides;
  return {
    tier_rank: 1,
    tier_label: null,
    display_order: 1,
    ...rest,
    company: {
      id: overrides.company_id,
      name: "Acme",
      slug: "acme",
      domain: "acme.com",
      website: "https://acme.com",
      logo_url: null,
      logo_source: null,
      logo_status: null,
      restricted_at: null,
      ...companyOverrides,
    },
  };
}

describe("shouldShowPublicExhibitorsTab", () => {
  it("shows only when there is at least one displayable exhibitor", () => {
    assert.equal(shouldShowPublicExhibitorsTab([]), false);
    assert.equal(shouldShowPublicExhibitorsTab(null), false);
    assert.equal(shouldShowPublicExhibitorsTab([row({ id: "a", company_id: "c1" })]), true);
  });
});

describe("sortPublicExhibitorRows", () => {
  it("orders by tier_rank, display_order, then id with Unranked last", () => {
    const sorted = sortPublicExhibitorRows([
      row({ id: "z", company_id: "c1", tier_rank: 2, display_order: 1 }),
      row({ id: "b", company_id: "c2", tier_rank: 1, display_order: 2 }),
      row({ id: "a", company_id: "c3", tier_rank: 1, display_order: 1 }),
      row({ id: "n", company_id: "c4", tier_rank: null, display_order: 1 }),
    ]);

    assert.deepEqual(
      sorted.map((item) => item.id),
      ["a", "b", "z", "n"],
    );
  });
});

describe("groupPublicExhibitorsByTier", () => {
  it("groups by tier and formats Unranked headings", () => {
    const groups = groupPublicExhibitorsByTier([
      row({
        id: "a",
        company_id: "c1",
        tier_rank: 1,
        tier_label: "Gold",
        display_order: 1,
      }),
      row({
        id: "b",
        company_id: "c2",
        tier_rank: 1,
        tier_label: "Gold",
        display_order: 2,
      }),
      row({
        id: "c",
        company_id: "c3",
        tier_rank: null,
        tier_label: null,
        display_order: 1,
      }),
    ]);

    assert.equal(groups.length, 2);
    assert.equal(formatPublicExhibitorTierHeading(groups[0]!), "Tier 1 · Gold");
    assert.equal(formatPublicExhibitorTierHeading(groups[1]!), "Unranked");
    assert.deepEqual(
      groups[0]?.exhibitors.map((item) => item.id),
      ["a", "b"],
    );
  });
});

describe("resolvePublicExhibitorWebPresence", () => {
  it("prefers a clickable website when available", () => {
    assert.deepEqual(
      resolvePublicExhibitorWebPresence({
        website: "https://acme.com/about",
        domain: "acme.com",
      }),
      {
        kind: "website",
        href: "https://acme.com/about",
        label: "acme.com",
      },
    );
  });

  it("falls back to domain text when website is missing", () => {
    assert.deepEqual(
      resolvePublicExhibitorWebPresence({
        website: null,
        domain: "acme.com",
      }),
      { kind: "domain", label: "acme.com" },
    );
  });

  it("falls back to domain text when website is present but unparseable", () => {
    assert.deepEqual(
      resolvePublicExhibitorWebPresence({
        website: "not a url",
        domain: "acme.com",
      }),
      { kind: "domain", label: "acme.com" },
    );
  });

  it("returns null when neither website nor domain is usable", () => {
    assert.equal(resolvePublicExhibitorWebPresence({ website: "", domain: null }), null);
  });
});
