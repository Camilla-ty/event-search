import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mapSponsorDiscoveryPublicRow } from "@/src/features/sponsors/server/mapSponsorDiscoveryPublicRow";
import { mapSponsorDiscoveryRpcResponse } from "@/src/features/sponsors/server/mapSponsorDiscoveryRpcResponse";
import { mapSponsorDiscoverySuggestItems } from "@/src/features/sponsors/server/mapSponsorDiscoverySuggestItems";
import { parseSponsorDiscoveryParams } from "@/src/features/sponsors/server/sponsorDiscoveryParams";
import {
  assertSponsorDiscoveryRpcPublicEventShape,
  assertSponsorDiscoveryRpcPublicRowShape,
} from "@/src/features/sponsors/server/sponsorDiscoveryRpcPublicPayload";

const sampleRpcPayload = {
  rows: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Acme Corp",
      slug: "acme-corp",
      domain: "acme.com",
      website: "https://www.acme.com",
      logo_url: null,
      logo_source: "none",
      logo_status: "skipped",
      sponsored_edition_count: 3,
      latest_activity_at: "2026-05-01",
      event_tier_label: null,
    },
  ],
  total: 1,
  page: 1,
  page_size: 20,
  sort: "activity",
  event_unknown: false,
  event: null,
} as const;

describe("sponsorDiscoveryRpcPublicPayload", () => {
  it("accepts domain and website on RPC rows", () => {
    assert.doesNotThrow(() =>
      assertSponsorDiscoveryRpcPublicRowShape(sampleRpcPayload.rows[0] as Record<string, unknown>),
    );
  });

  it("rejects forbidden P4A row keys", () => {
    assert.throws(
      () =>
        assertSponsorDiscoveryRpcPublicRowShape({
          id: "1",
          name: "Acme",
          slug: "acme",
          short_description: "hidden",
        }),
      /Forbidden RPC row keys present: short_description/,
    );
    assert.throws(
      () =>
        assertSponsorDiscoveryRpcPublicRowShape({
          id: "1",
          name: "Acme",
          slug: "acme",
          tier_rank: 1,
        }),
      /Forbidden RPC row keys present: tier_rank/,
    );
  });

  it("rejects event.id in RPC event context", () => {
    assert.throws(
      () =>
        assertSponsorDiscoveryRpcPublicEventShape({
          id: "edition-id",
          slug: "btc-prague-2026",
          name: "BTC Prague 2026",
        }),
      /Forbidden event\.id present/,
    );
    assert.doesNotThrow(() =>
      assertSponsorDiscoveryRpcPublicEventShape({
        slug: "btc-prague-2026",
        name: "BTC Prague 2026",
      }),
    );
  });

  it("maps website_label for discovery rows and domain for suggest items", () => {
    const params = parseSponsorDiscoveryParams({});
    const mapped = mapSponsorDiscoveryRpcResponse(sampleRpcPayload, params);
    const publicRow = mapSponsorDiscoveryPublicRow(mapped.rows[0]!, { hasEventFilter: false });

    assert.equal(publicRow.website_label, "acme.com");

    const suggestItems = mapSponsorDiscoverySuggestItems(mapped.rows);
    assert.equal(suggestItems[0]?.domain, "acme.com");
  });
});
