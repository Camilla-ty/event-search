import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mapSponsorDiscoverySuggestItems } from "@/src/features/sponsors/server/mapSponsorDiscoverySuggestItems";
import type { SponsorDiscoveryInternalRow } from "@/src/features/sponsors/server/sponsorDiscoveryTypes";
import {
  emptySponsorSuggestResult,
  isSponsorDiscoverySuggestQueryEligible,
  parseSponsorDiscoverySuggestLimit,
  parseSponsorDiscoverySuggestQuery,
  SPONSOR_SUGGEST_DEFAULT_LIMIT,
  SPONSOR_SUGGEST_MAX_LIMIT,
} from "@/src/features/sponsors/server/sponsorDiscoverySuggestParams";

describe("parseSponsorDiscoverySuggestQuery", () => {
  it("trims and preserves eligible query text", () => {
    assert.equal(parseSponsorDiscoverySuggestQuery("  CK  "), "CK");
    assert.equal(parseSponsorDiscoverySuggestQuery("ČKMA"), "ČKMA");
  });
});

describe("isSponsorDiscoverySuggestQueryEligible", () => {
  it("requires at least two characters", () => {
    assert.equal(isSponsorDiscoverySuggestQueryEligible(""), false);
    assert.equal(isSponsorDiscoverySuggestQueryEligible("C"), false);
    assert.equal(isSponsorDiscoverySuggestQueryEligible("CK"), true);
  });
});

describe("parseSponsorDiscoverySuggestLimit", () => {
  it("defaults to 8", () => {
    assert.equal(parseSponsorDiscoverySuggestLimit(null), SPONSOR_SUGGEST_DEFAULT_LIMIT);
    assert.equal(parseSponsorDiscoverySuggestLimit(""), SPONSOR_SUGGEST_DEFAULT_LIMIT);
    assert.equal(parseSponsorDiscoverySuggestLimit("not-a-number"), SPONSOR_SUGGEST_DEFAULT_LIMIT);
  });

  it("clamps valid limits between 1 and 10", () => {
    assert.equal(parseSponsorDiscoverySuggestLimit("8"), 8);
    assert.equal(parseSponsorDiscoverySuggestLimit(10), SPONSOR_SUGGEST_MAX_LIMIT);
    assert.equal(parseSponsorDiscoverySuggestLimit("11"), SPONSOR_SUGGEST_DEFAULT_LIMIT);
    assert.equal(parseSponsorDiscoverySuggestLimit("0"), SPONSOR_SUGGEST_DEFAULT_LIMIT);
  });
});

describe("emptySponsorSuggestResult", () => {
  it("returns an empty payload for short queries", () => {
    assert.deepEqual(emptySponsorSuggestResult("C"), {
      query: "C",
      items: [],
      total: 0,
    });
  });
});

describe("mapSponsorDiscoverySuggestItems", () => {
  it("maps discovery rows to slim suggest items", () => {
    const rows: SponsorDiscoveryInternalRow[] = [
      {
        id: "company-1",
        slug: "ckma",
        name: "CKMA",
        domain: "ckma.cz",
        website: "https://www.ckma.cz/",
        logo_url: "https://example.com/logo.png",
        logo_source: null,
        logo_status: null,
        short_description: "Example",
        sponsored_edition_count: 3,
        latest_activity_at: "2026-01-01",
        event_tier: null,
      },
    ];

    assert.deepEqual(mapSponsorDiscoverySuggestItems(rows), [
      {
        id: "company-1",
        slug: "ckma",
        name: "CKMA",
        domain: "ckma.cz",
        logo_url: "https://example.com/logo.png",
      },
    ]);
  });

  it("skips rows missing required identity fields", () => {
    const rows: SponsorDiscoveryInternalRow[] = [
      {
        id: "",
        slug: "ckma",
        name: "CKMA",
        domain: null,
        website: null,
        logo_url: null,
        logo_source: null,
        logo_status: null,
        short_description: null,
        sponsored_edition_count: 1,
        latest_activity_at: null,
        event_tier: null,
      },
    ];

    assert.deepEqual(mapSponsorDiscoverySuggestItems(rows), []);
  });
});
