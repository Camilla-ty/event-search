import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  attachCompaniesToEventSponsorLinks,
  resolvePublicCompanyProfileQueryResult,
  type CompanyPublicRow,
} from "@/src/lib/queries/companies";

const PUBLIC_COMPANY: CompanyPublicRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Acme Events",
  slug: "acme-events",
  domain: "acme.example",
  website: "https://acme.example",
  logo_url: null,
  logo_source: null,
  logo_status: null,
  logo_fetched_at: null,
  logo_fetch_error: null,
  city_id: null,
  created_at: "2026-01-01T00:00:00.000Z",
  restricted_at: null,
  event_brand_public_profile_approved_at: null,
};

describe("ARC-001 Phase 1 public company reads", () => {
  it("resolvePublicCompanyProfileQueryResult returns a valid public company", () => {
    const row = resolvePublicCompanyProfileQueryResult({ ...PUBLIC_COMPANY }, null);
    assert.ok(row);
    assert.equal(row.id, PUBLIC_COMPANY.id);
    assert.equal(row.slug, PUBLIC_COMPANY.slug);
  });

  it("resolvePublicCompanyProfileQueryResult fails closed on query error", () => {
    assert.equal(
      resolvePublicCompanyProfileQueryResult(null, { message: "rls denied" }),
      null,
    );
  });

  it("resolvePublicCompanyProfileQueryResult fails closed when no row", () => {
    assert.equal(resolvePublicCompanyProfileQueryResult(null, null), null);
  });

  it("resolvePublicCompanyProfileQueryResult fails closed for restricted companies", () => {
    assert.equal(
      resolvePublicCompanyProfileQueryResult(
        {
          ...PUBLIC_COMPANY,
          restricted_at: "2026-07-01T00:00:00.000Z",
        },
        null,
      ),
      null,
    );
  });

  it("attachCompaniesToEventSponsorLinks leaves missing companies null (no admin fill)", () => {
    const missingId = "22222222-2222-4222-8222-222222222222";
    const hydrated = attachCompaniesToEventSponsorLinks(
      [
        { id: "link-1", company_id: PUBLIC_COMPANY.id },
        { id: "link-2", company_id: missingId },
      ],
      [{ ...PUBLIC_COMPANY }],
      new Map(),
    );

    assert.equal(hydrated.length, 2);
    assert.ok(hydrated[0]?.companies);
    assert.equal(hydrated[0]?.companies?.id, PUBLIC_COMPANY.id);
    assert.equal(hydrated[1]?.companies, null);
  });

  it("attachCompaniesToEventSponsorLinks fails closed when the company batch is empty", () => {
    const hydrated = attachCompaniesToEventSponsorLinks(
      [{ id: "link-1", company_id: PUBLIC_COMPANY.id }],
      [],
      new Map(),
    );

    assert.equal(hydrated.length, 1);
    assert.equal(hydrated[0]?.companies, null);
  });
});
