import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  mapSponsorDiscoveryPublicResult,
} from "@/src/features/sponsors/server/mapSponsorDiscoveryPublicRow";
import { parseSponsorDiscoveryParams } from "@/src/features/sponsors/server/sponsorDiscoveryParams";
import type { SponsorDiscoveryInternalResult } from "@/src/features/sponsors/server/sponsorDiscoveryTypes";

const FORBIDDEN_PUBLIC_ROW_KEYS = [
  "short_description",
  "location_label",
  "latest_activity_at",
  "domain",
  "website",
  "event_tier",
  "tier_rank",
] as const;

function internalFixture(): SponsorDiscoveryInternalResult {
  return {
    rows: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        slug: "acme-corp",
        name: "Acme Corp",
        domain: "acme.com",
        website: "https://acme.com",
        logo_url: null,
        logo_source: null,
        logo_status: null,
        sponsored_edition_count: 4,
        latest_activity_at: "2026-05-01",
        event_tier: { tier_rank: 1, tier_label: "Gold Sponsor" },
      },
    ],
    total: 1,
    params: parseSponsorDiscoveryParams({ event: "btc-prague-2026" }),
    eventContext: {
      id: "22222222-2222-4222-8222-222222222222",
      slug: "btc-prague-2026",
      name: "BTC Prague 2026",
    },
    eventUnknown: false,
  };
}

describe("Sponsor Discovery public payload", () => {
  it("omits forbidden row fields from the public API shape", () => {
    const result = mapSponsorDiscoveryPublicResult(internalFixture());
    const serialized = JSON.stringify(result.rows[0]);

    for (const key of FORBIDDEN_PUBLIC_ROW_KEYS) {
      assert.equal(key in (result.rows[0] ?? {}), false, `expected ${key} to be absent`);
      assert.equal(serialized.includes(`"${key}"`), false, `expected ${key} absent from JSON`);
    }

    assert.equal(result.rows[0]?.sponsored_edition_count, 4);
    assert.equal(typeof result.rows[0]?.href, "string");
  });

  it("getSponsorDiscoveryPage maps RPC output to the public result", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/features/sponsors/server/getSponsorDiscoveryPage.ts"),
      "utf8",
    );

    assert.match(source, /mapSponsorDiscoveryPublicResult/);
    assert.doesNotMatch(source, /getCompaniesByIds/);
    assert.doesNotMatch(source, /location_label/);
  });

  it("RPC migration clamps page_size to a maximum of 50", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "supabase/migrations/20260717120000_sponsor_discovery_page_size_max_50.sql",
      ),
      "utf8",
    );

    assert.match(source, /least\(greatest\(coalesce\(p_page_size, 20\), 1\), 50\)/);
    assert.doesNotMatch(source, /, 100\) AS page_size/);
  });

  it("restricted companies remain excluded in sponsor discovery RPC", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "supabase/migrations/20260717120000_sponsor_discovery_page_size_max_50.sql",
      ),
      "utf8",
    );

    assert.match(source, /c\.restricted_at IS NULL/);
  });
});

describe("Sponsor suggest minimal payload", () => {
  it("maps only id, slug, name, domain, and logo_url", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/features/sponsors/server/mapSponsorDiscoverySuggestItems.ts"),
      "utf8",
    );

    assert.match(source, /id,/);
    assert.match(source, /slug,/);
    assert.match(source, /name,/);
    assert.match(source, /domain:/);
    assert.match(source, /logo_url:/);
    assert.doesNotMatch(source, /sponsored_edition_count/);
    assert.doesNotMatch(source, /latest_activity_at/);
  });
});

describe("Sponsor detail auth exposure", () => {
  it("returns an empty event list for anonymous users", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/features/sponsors/server/getSponsorDetailData.ts"),
      "utf8",
    );

    assert.match(source, /if \(!isAuthenticated\)/);
    assert.match(source, /eventSeriesGroups: \[\]/);
    assert.match(source, /sponsoredEditionCount/);
  });

  it("loads sponsor edition links only for authenticated users", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/features/sponsors/server/getSponsorDetailData.ts"),
      "utf8",
    );

    assert.match(source, /getSponsorLinksWithEditionsForCompany/);
    assert.match(source, /groupEditionsBySeries/);
  });

  it("SponsorDetailView shows count for anonymous users and hides edition lists", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/features/sponsors/components/detail/SponsorDetailView.tsx"),
      "utf8",
    );

    assert.match(source, /!isAuthenticated/);
    assert.match(source, /formatSponsoredEditionCount\(summary\.sponsoredEditionCount\)/);
    assert.match(source, /Sign in to view full sponsorship history/);
    assert.match(source, /eventSeriesGroups\.map/);
  });
});
