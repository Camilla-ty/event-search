import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  mapSponsorDiscoveryPublicResult,
  mapSponsorDiscoveryPublicRow,
} from "@/src/features/sponsors/server/mapSponsorDiscoveryPublicRow";
import { parseSponsorDiscoveryParams } from "@/src/features/sponsors/server/sponsorDiscoveryParams";
import type { SponsorDiscoveryInternalResult } from "@/src/features/sponsors/server/sponsorDiscoveryTypes";

const globalParams = parseSponsorDiscoveryParams({});

function internalResult(
  overrides: Partial<SponsorDiscoveryInternalResult> = {},
): SponsorDiscoveryInternalResult {
  return {
    rows: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        slug: "acme-corp",
        name: "Acme Corp",
        domain: "acme.com",
        website: "https://acme.com",
        logo_url: null,
        logo_source: "none",
        logo_status: "skipped",
        short_description: "Hidden description",
        sponsored_edition_count: 12,
        latest_activity_at: "2026-05-01",
        event_tier: null,
      },
    ],
    total: 1,
    params: globalParams,
    eventContext: null,
    eventUnknown: false,
    ...overrides,
  };
}

describe("mapSponsorDiscoveryPublicRow", () => {
  it("maps only UI-needed fields and precomputes href and website_label", () => {
    const row = mapSponsorDiscoveryPublicRow(internalResult().rows[0]!, {
      hasEventFilter: false,
    });

    assert.equal(row.href, "/sponsors/acme-corp");
    assert.equal(row.website_label, "acme.com");
    assert.equal(row.sponsored_edition_count, 12);
    assert.equal(row.event_tier_label, null);
    assert.equal("short_description" in row, false);
    assert.equal("latest_activity_at" in row, false);
    assert.equal("domain" in row, false);
    assert.equal("website" in row, false);
    assert.equal("event_tier" in row, false);
  });

  it("includes event_tier_label only when an event filter is active", () => {
    const row = mapSponsorDiscoveryPublicRow(
      {
        ...internalResult().rows[0]!,
        event_tier: { tier_rank: 1, tier_label: "Gold Sponsor" },
      },
      { hasEventFilter: true },
    );

    assert.equal(row.event_tier_label, "Gold Sponsor");
    assert.equal("tier_rank" in row, false);
  });
});

describe("mapSponsorDiscoveryPublicResult", () => {
  it("strips internal row fields and edition ids from event context", () => {
    const result = mapSponsorDiscoveryPublicResult(
      internalResult({
        params: parseSponsorDiscoveryParams({ event: "btc-prague-2026" }),
        eventContext: {
          id: "22222222-2222-4222-8222-222222222222",
          slug: "btc-prague-2026",
          name: "BTC Prague 2026",
        },
      }),
    );

    assert.equal(result.rows.length, 1);
    assert.deepEqual(result.eventContext, {
      slug: "btc-prague-2026",
      name: "BTC Prague 2026",
    });
    assert.equal("id" in (result.eventContext ?? {}), false);
    assert.equal(result.rows[0]?.sponsored_edition_count, 12);
  });
});
