import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mapSponsorDiscoveryRpcResponse } from "@/src/features/sponsors/server/mapSponsorDiscoveryRpcResponse";
import { parseSponsorDiscoveryParams } from "@/src/features/sponsors/server/sponsorDiscoveryParams";
import {
  assertSponsorDiscoveryRpcEventShape,
  assertSponsorDiscoveryRpcRowShape,
} from "@/src/features/sponsors/server/sponsorDiscoveryRpcPublicPayload";

const globalParams = parseSponsorDiscoveryParams({});
const eventParams = parseSponsorDiscoveryParams({ event: "btc-prague-2026" });

describe("sponsorDiscoveryRpcPublicPayload (P4A)", () => {
  it("accepts the trimmed global RPC row shape", () => {
    const row = {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Acme Corp",
      slug: "acme-corp",
      domain: "acme.com",
      website: "https://acme.com",
      logo_url: null,
      logo_source: "none",
      logo_status: "skipped",
      sponsored_edition_count: 3,
      latest_activity_at: "2026-05-01",
      event_tier_label: null,
    };

    assertSponsorDiscoveryRpcRowShape(row);

    const result = mapSponsorDiscoveryRpcResponse(
      {
        rows: [row],
        total: 1,
        page: 1,
        page_size: 20,
        sort: "activity",
        event_unknown: false,
        event: null,
      },
      globalParams,
    );

    assert.equal(result.rows[0]?.event_tier, null);
    assert.equal(result.rows[0]?.short_description, null);
  });

  it("accepts event-filter RPC rows with event_tier_label only", () => {
    const row = {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Acme Corp",
      slug: "acme-corp",
      domain: null,
      website: null,
      logo_url: null,
      logo_source: null,
      logo_status: null,
      sponsored_edition_count: 1,
      latest_activity_at: "2026-05-01",
      event_tier_label: "Gold Sponsor",
    };

    assertSponsorDiscoveryRpcRowShape(row);

    const payload = {
      rows: [row],
      total: 1,
      page: 1,
      page_size: 20,
      sort: "tier",
      event_unknown: false,
      event: {
        slug: "btc-prague-2026",
        name: "BTC Prague 2026",
      },
    };

    assertSponsorDiscoveryRpcEventShape(payload.event);

    const result = mapSponsorDiscoveryRpcResponse(payload, eventParams);

    assert.deepEqual(result.eventContext, {
      id: null,
      slug: "btc-prague-2026",
      name: "BTC Prague 2026",
    });
    assert.deepEqual(result.rows[0]?.event_tier, {
      tier_rank: null,
      tier_label: "Gold Sponsor",
    });
  });
});
