import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SAME_BRAND_RESTRICTED_COMPANY_WARNING,
  SAME_BRAND_SERIES_MERGED_MESSAGE,
  sameBrandUniquenessConflictMessage,
  validateSameBrandCompanyProfileAssignment,
} from "@/src/lib/companies/sameBrandCompanyProfile";
import { COMPANY_NOT_LINKABLE_MESSAGE } from "@/src/lib/companies/assertCompanyLinkable";

const SERIES_A = "11111111-1111-4111-8111-111111111111";
const SERIES_B = "22222222-2222-4222-8222-222222222222";
const COMPANY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const COMPANY_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function activeCompany(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: "Acme Events",
    status: "active",
    merged_into_company_id: null,
    restricted_at: null,
    ...overrides,
  };
}

describe("same-brand Admin assignment (SB1 behaviors)", () => {
  it("links an active company with no warnings", () => {
    const result = validateSameBrandCompanyProfileAssignment({
      seriesId: SERIES_A,
      seriesLifecycleStatus: "active",
      companyProfileId: COMPANY_A,
      company: activeCompany(COMPANY_A),
      occupyingSeries: null,
    });
    assert.deepEqual(result, { ok: true, warnings: [] });
  });

  it("replaces by assigning a different free company", () => {
    const result = validateSameBrandCompanyProfileAssignment({
      seriesId: SERIES_A,
      seriesLifecycleStatus: "active",
      companyProfileId: COMPANY_B,
      company: activeCompany(COMPANY_B, { name: "Other Brand" }),
      occupyingSeries: null,
    });
    assert.equal(result.ok, true);
  });

  it("unlinks by accepting null company_profile_id", () => {
    const result = validateSameBrandCompanyProfileAssignment({
      seriesId: SERIES_A,
      seriesLifecycleStatus: "discontinued",
      companyProfileId: null,
      company: null,
      occupyingSeries: { id: SERIES_A, name: "Acme" },
    });
    assert.deepEqual(result, { ok: true, warnings: [] });
  });

  it("rejects uniqueness conflicts when another series owns the company", () => {
    const result = validateSameBrandCompanyProfileAssignment({
      seriesId: SERIES_A,
      seriesLifecycleStatus: "active",
      companyProfileId: COMPANY_A,
      company: activeCompany(COMPANY_A),
      occupyingSeries: { id: SERIES_B, name: "Other Series" },
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error, sameBrandUniquenessConflictMessage("Other Series"));
  });

  it("allows restricted companies with an explicit warning", () => {
    const result = validateSameBrandCompanyProfileAssignment({
      seriesId: SERIES_A,
      seriesLifecycleStatus: "active",
      companyProfileId: COMPANY_A,
      company: activeCompany(COMPANY_A, {
        restricted_at: "2026-07-31T00:00:00.000Z",
      }),
      occupyingSeries: null,
    });
    assert.deepEqual(result, {
      ok: true,
      warnings: [SAME_BRAND_RESTRICTED_COMPANY_WARNING],
    });
  });

  it("rejects merged companies and merged series destinations", () => {
    assert.deepEqual(
      validateSameBrandCompanyProfileAssignment({
        seriesId: SERIES_A,
        seriesLifecycleStatus: "active",
        companyProfileId: COMPANY_A,
        company: activeCompany(COMPANY_A, { status: "merged" }),
        occupyingSeries: null,
      }),
      { ok: false, error: COMPANY_NOT_LINKABLE_MESSAGE },
    );

    assert.deepEqual(
      validateSameBrandCompanyProfileAssignment({
        seriesId: SERIES_A,
        seriesLifecycleStatus: "merged",
        companyProfileId: COMPANY_A,
        company: activeCompany(COMPANY_A),
        occupyingSeries: null,
      }),
      { ok: false, error: SAME_BRAND_SERIES_MERGED_MESSAGE },
    );
  });
});
