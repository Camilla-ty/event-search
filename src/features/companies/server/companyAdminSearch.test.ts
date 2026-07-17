import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { rankCompanySearchHits } from "@/src/lib/companies/companyIdentitySearch";

import type { CompanyAdminRow } from "./companyAdmin";
import {
  attachVerifiedDomainsForAdminSearch,
  mergeCompaniesById,
} from "./companyAdminSearch";

function adminCompany(
  overrides: Partial<CompanyAdminRow> & Pick<CompanyAdminRow, "id" | "name">,
): CompanyAdminRow {
  return {
    slug: "acme",
    domain: "acme.com",
    website: "https://acme.com",
    logo_url: null,
    logo_source: null,
    logo_status: null,
    logo_fetched_at: null,
    logo_fetch_error: null,
    city_id: null,
    created_at: null,
    aliases: [],
    status: "active",
    merged_into_company_id: null,
    merged_at: null,
    restricted_at: null,
    ...overrides,
  };
}

describe("companyAdminSearch", () => {
  it("mergeCompaniesById deduplicates candidates by company id", () => {
    const first = adminCompany({ id: "company-1", name: "Acme" });
    const second = adminCompany({ id: "company-1", name: "Acme Updated" });

    const merged = mergeCompaniesById([first, second, adminCompany({ id: "company-2", name: "Beta" })]);

    assert.equal(merged.length, 2);
    assert.equal(merged[0]?.id, "company-1");
    assert.equal(merged[0]?.name, "Acme Updated");
    assert.equal(merged[1]?.id, "company-2");
  });

  it("ranks restricted companies when matched by non-primary verified domain", () => {
    const restricted = adminCompany({
      id: "restricted-id",
      name: "Hidden Sponsor",
      slug: "hidden-sponsor",
      domain: "hidden.com",
      restricted_at: "2026-01-01T00:00:00.000Z",
    });

    const candidates = attachVerifiedDomainsForAdminSearch(
      [restricted],
      new Map([["restricted-id", ["legacy-hidden.com"]]]),
    );

    const ranked = rankCompanySearchHits(candidates, "legacy-hidden.com");
    assert.equal(ranked.length, 1);
    assert.equal(ranked[0]?.company.id, "restricted-id");
    assert.equal(ranked[0]?.company.restricted_at, "2026-01-01T00:00:00.000Z");
    assert.equal(ranked[0]?.match_kind, "exact_domain");
  });

  it("ranks primary domain matches from companies.domain", () => {
    const company = adminCompany({
      id: "primary-id",
      name: "Acme",
      slug: "acme",
      domain: "acme.com",
    });

    const ranked = rankCompanySearchHits(
      attachVerifiedDomainsForAdminSearch([company], new Map()),
      "acme.com",
    );

    assert.equal(ranked.length, 1);
    assert.equal(ranked[0]?.match_kind, "exact_domain");
  });
});
