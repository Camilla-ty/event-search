import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mapSponsorDiscoveryRpcResponse } from "@/src/features/sponsors/server/mapSponsorDiscoveryRpcResponse";
import { parseSponsorDiscoveryParams } from "@/src/features/sponsors/server/sponsorDiscoveryParams";

const globalParams = parseSponsorDiscoveryParams({});
const eventParams = parseSponsorDiscoveryParams({ event: "btc-prague-2026" });

describe("mapSponsorDiscoveryRpcResponse", () => {
  it("maps a global discovery payload", () => {
    const result = mapSponsorDiscoveryRpcResponse(
      {
        rows: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            name: "Acme Corp",
            slug: "acme-corp",
            domain: "acme.com",
            website: "https://acme.com",
            logo_url: null,
            logo_source: "none",
            logo_status: "skipped",
            short_description: "Example sponsor",
            sponsored_edition_count: 3,
            latest_activity_at: "2026-05-01",
            tier_rank: null,
            tier_label: null,
          },
        ],
        total: 1,
        page: 1,
        page_size: 20,
        sort: "activity",
        event_unknown: false,
        event: null,
      },
      globalParams,
    );

    assert.equal(result.total, 1);
    assert.equal(result.eventUnknown, false);
    assert.equal(result.eventContext, null);
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0]?.name, "Acme Corp");
    assert.equal(result.rows[0]?.location_label, null);
    assert.equal(result.rows[0]?.event_tier, null);
  });

  it("maps event-filter rows with tier context", () => {
    const result = mapSponsorDiscoveryRpcResponse(
      {
        rows: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            name: "Acme Corp",
            slug: "acme-corp",
            domain: null,
            website: null,
            logo_url: null,
            logo_source: null,
            logo_status: null,
            short_description: null,
            sponsored_edition_count: 1,
            latest_activity_at: "2026-05-01",
            tier_rank: 1,
            tier_label: "Gold Sponsor",
          },
        ],
        total: 1,
        page: 1,
        page_size: 20,
        sort: "tier",
        event_unknown: false,
        event: {
          id: "22222222-2222-4222-8222-222222222222",
          slug: "btc-prague-2026",
          name: "BTC Prague 2026",
        },
      },
      eventParams,
    );

    assert.equal(result.eventUnknown, false);
    assert.deepEqual(result.eventContext, {
      id: "22222222-2222-4222-8222-222222222222",
      slug: "btc-prague-2026",
      name: "BTC Prague 2026",
    });
    assert.deepEqual(result.rows[0]?.event_tier, {
      tier_rank: 1,
      tier_label: "Gold Sponsor",
    });
  });

  it("surfaces event_unknown for UI consumption", () => {
    const params = parseSponsorDiscoveryParams({ event: "missing-edition" });
    const result = mapSponsorDiscoveryRpcResponse(
      {
        rows: [],
        total: 0,
        page: 1,
        page_size: 20,
        sort: "activity",
        event_unknown: true,
        event: { slug: "missing-edition" },
      },
      params,
    );

    assert.equal(result.eventUnknown, true);
    assert.deepEqual(result.eventContext, {
      slug: "missing-edition",
      id: null,
      name: null,
    });
    assert.equal(result.total, 0);
    assert.equal(result.rows.length, 0);
  });
});
