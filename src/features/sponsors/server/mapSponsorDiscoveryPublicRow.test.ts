import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mapSponsorDiscoveryPublicRow } from "@/src/features/sponsors/server/mapSponsorDiscoveryPublicRow";
import type { SponsorDiscoveryInternalRow } from "@/src/features/sponsors/server/sponsorDiscoveryTypes";

function baseRow(
  overrides: Partial<SponsorDiscoveryInternalRow> = {},
): SponsorDiscoveryInternalRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    slug: "acme-corp",
    name: "Acme Corp",
    domain: "acme.com",
    website: "https://www.acme.com",
    logo_url: null,
    logo_source: null,
    logo_status: null,
    sponsored_edition_count: 2,
    latest_activity_at: "2026-05-01",
    event_tier: null,
    ...overrides,
  };
}

describe("mapSponsorDiscoveryPublicRow", () => {
  it("derives website_label from domain when present", () => {
    const row = mapSponsorDiscoveryPublicRow(baseRow(), { hasEventFilter: false });
    assert.equal(row.website_label, "acme.com");
  });

  it("derives website_label from website when domain is absent", () => {
    const row = mapSponsorDiscoveryPublicRow(
      baseRow({ domain: null, website: "https://shop.example.org" }),
      { hasEventFilter: false },
    );
    assert.equal(row.website_label, "shop.example.org");
  });

  it("returns null website_label when domain and website are absent", () => {
    const row = mapSponsorDiscoveryPublicRow(
      baseRow({ domain: null, website: null }),
      { hasEventFilter: false },
    );
    assert.equal(row.website_label, null);
  });

  it("exposes event_tier_label only when event filter is active", () => {
    const withTier = mapSponsorDiscoveryPublicRow(
      baseRow({
        event_tier: { tier_rank: null, tier_label: "Gold Sponsor" },
      }),
      { hasEventFilter: true },
    );
    assert.equal(withTier.event_tier_label, "Gold Sponsor");

    const withoutTier = mapSponsorDiscoveryPublicRow(
      baseRow({
        event_tier: { tier_rank: null, tier_label: "Gold Sponsor" },
      }),
      { hasEventFilter: false },
    );
    assert.equal(withoutTier.event_tier_label, null);
  });
});
