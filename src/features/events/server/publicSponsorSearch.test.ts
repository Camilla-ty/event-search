import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  mapPublicSponsorSearchItem,
} from "@/src/features/events/server/publicSponsorSearch";
import {
  PUBLIC_SPONSOR_SEARCH_MAX_QUERY_LENGTH,
  PUBLIC_SPONSOR_SEARCH_MAX_RESULTS,
  PUBLIC_SPONSOR_SEARCH_MIN_QUERY_LENGTH,
  parsePublicSponsorSearchQuery,
} from "@/src/features/events/server/publicSponsorSearchParams";
import { RESTRICTED_COMPANY_ROSTER_LABEL } from "@/src/lib/companies/companyPublicRestriction";

describe("parsePublicSponsorSearchQuery", () => {
  it("trims and accepts queries of at least 3 characters", () => {
    const parsed = parsePublicSponsorSearchQuery("  abc  ");
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.query, "abc");
    assert.equal(parsed.tooShort, false);
  });

  it("marks queries shorter than 3 as tooShort without rejecting", () => {
    const parsed = parsePublicSponsorSearchQuery("ab");
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.query, "ab");
    assert.equal(parsed.tooShort, true);
    assert.equal(PUBLIC_SPONSOR_SEARCH_MIN_QUERY_LENGTH, 3);
  });

  it("rejects queries longer than 200 characters", () => {
    const long = "a".repeat(PUBLIC_SPONSOR_SEARCH_MAX_QUERY_LENGTH + 1);
    const parsed = parsePublicSponsorSearchQuery(long);
    assert.equal(parsed.ok, false);
    if (parsed.ok) return;
    assert.equal(parsed.error, "query_too_long");
  });
});

describe("mapPublicSponsorSearchItem", () => {
  const baseRow = {
    id: "link-1",
    company_id: "co-1",
    tier_rank: 1,
    tier_label: "Gold",
    display_order: 2,
    company: {
      id: "co-1",
      name: "Acme",
      slug: "acme",
      domain: "acme.com",
      website: "https://acme.com",
      logo_url: "https://cdn.example/logo.png",
      logo_source: "upload",
      logo_status: "ok",
      restricted_at: null,
    },
  };

  it("maps unrestricted companies with profile href and logo fields", () => {
    const item = mapPublicSponsorSearchItem(baseRow);
    assert.ok(item);
    assert.equal(item?.company.restricted, false);
    assert.equal(item?.company.domain, "acme.com");
    assert.equal(item?.company.href, "/sponsors/acme");
    assert.equal(item?.tier_rank, 1);
    assert.equal(item?.tier_label, "Gold");
    assert.equal(
      Object.prototype.hasOwnProperty.call(item?.company ?? {}, "aliases"),
      false,
    );
  });

  it("preserves the exact stored tier_label and omits blank labels", () => {
    const titled = mapPublicSponsorSearchItem({
      ...baseRow,
      tier_label: "Title Partner",
    });
    assert.equal(titled?.tier_label, "Title Partner");

    const blank = mapPublicSponsorSearchItem({
      ...baseRow,
      tier_label: "   ",
    });
    assert.equal(blank?.tier_label, null);

    const missing = mapPublicSponsorSearchItem({
      ...baseRow,
      tier_label: null,
    });
    assert.equal(missing?.tier_label, null);
  });

  it("scrubs restricted company fields but keeps tier_rank and tier_label", () => {
    const item = mapPublicSponsorSearchItem({
      ...baseRow,
      tier_label: "Title Partner",
      company: {
        ...baseRow.company,
        restricted_at: "2026-07-01T00:00:00Z",
      },
    });
    assert.ok(item);
    assert.equal(item?.company.restricted, true);
    assert.equal(item?.company.restricted_label, RESTRICTED_COMPANY_ROSTER_LABEL);
    assert.equal(item?.company.name, "Acme");
    assert.equal(item?.company.domain, null);
    assert.equal(item?.company.website, null);
    assert.equal(item?.company.logo_url, null);
    assert.equal(item?.company.logo_source, null);
    assert.equal(item?.company.logo_status, null);
    assert.equal(item?.company.slug, null);
    assert.equal(item?.company.href, null);
    assert.equal(item?.tier_rank, 1);
    assert.equal(item?.tier_label, "Title Partner");
  });

  it("returns null when required identity fields are missing", () => {
    assert.equal(
      mapPublicSponsorSearchItem({
        id: "link-1",
        company: { name: "Acme" },
      }),
      null,
    );
  });
});

describe("sponsor search wiring", () => {
  it("exposes the search route with no-store and the locked response shape", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/app/api/events/[id]/sponsors/search/route.ts",
      ),
      "utf8",
    );
    assert.match(source, /searchPublicEditionSponsors/);
    assert.match(source, /Cache-Control": "no-store"/);
    assert.match(source, /ok: true, query: result\.query, items: result\.items/);
    assert.doesNotMatch(source, /hasMore|total|page_size|discovery/);
    assert.doesNotMatch(source, /createAdminClient|searchCompaniesAdmin/);
  });

  it("uses authenticated session + INVOKER RPC and hard-caps results", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/features/events/server/publicSponsorSearch.ts",
      ),
      "utf8",
    );
    assert.match(source, /createClient/);
    assert.match(source, /auth\.getUser/);
    assert.match(source, /Authentication required/);
    assert.match(source, /status: 401/);
    assert.match(source, /event_edition_sponsor_search/);
    assert.match(source, /PUBLIC_SPONSOR_SEARCH_MAX_RESULTS/);
    assert.match(source, /tier_rank/);
    assert.match(source, /tier_label/);
    assert.equal(PUBLIC_SPONSOR_SEARCH_MAX_RESULTS, 20);
    assert.doesNotMatch(source, /createAdminClient/);
    assert.doesNotMatch(source, /sponsors\/discovery|getSponsorDiscovery/);
  });

  it("migration is authenticated-only INVOKER search with limit 20 and no totals", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "supabase/migrations/20260727120000_event_edition_sponsor_search.sql",
      ),
      "utf8",
    );
    assert.match(source, /CREATE OR REPLACE FUNCTION public\.event_edition_sponsor_search/);
    assert.match(source, /SECURITY INVOKER/);
    assert.match(source, /LIMIT 20/);
    assert.match(source, /es\.tier_rank/);
    assert.match(source, /es\.tier_label/);
    assert.match(source, /'tier_rank', m\.tier_rank/);
    assert.match(source, /'tier_label', m\.tier_label/);
    assert.match(source, /__company_matches_verified_domain_search/);
    assert.match(
      source,
      /GRANT EXECUTE ON FUNCTION public\.event_edition_sponsor_search\(uuid, text\)\s*\n\s*TO authenticated, service_role/,
    );
    assert.match(
      source,
      /REVOKE EXECUTE ON FUNCTION public\.event_edition_sponsor_search\(uuid, text\) FROM anon/,
    );
    assert.doesNotMatch(
      source,
      /GRANT EXECUTE ON FUNCTION public\.__company_matches_verified_domain_search/,
    );
    assert.doesNotMatch(
      source,
      /GRANT EXECUTE ON FUNCTION public\.event_edition_sponsor_search\([\s\S]*TO anon/,
    );
    assert.doesNotMatch(source, /\btotal\b|has_more|page_size/);
    assert.doesNotMatch(source, /SECURITY DEFINER/);
  });
});
