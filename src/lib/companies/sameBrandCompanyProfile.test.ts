import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { COMPANY_NOT_LINKABLE_MESSAGE } from "@/src/lib/companies/assertCompanyLinkable";
import {
  SAME_BRAND_COMPANY_MISSING_MESSAGE,
  SAME_BRAND_RESTRICTED_COMPANY_WARNING,
  SAME_BRAND_SERIES_MERGED_MESSAGE,
  SAME_BRAND_STALE_LINK_MESSAGE,
  isSameBrandCompanyProfileStale,
  sameBrandUniquenessConflictMessage,
  validateSameBrandCompanyProfileAssignment,
} from "@/src/lib/companies/sameBrandCompanyProfile";

const SERIES_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const COMPANY_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OTHER_SERIES_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const activeCompany = {
  id: COMPANY_ID,
  name: "TOKEN2049",
  status: "active",
  merged_into_company_id: null,
  restricted_at: null,
};

describe("validateSameBrandCompanyProfileAssignment", () => {
  it("allows unlink (null company_profile_id)", () => {
    const result = validateSameBrandCompanyProfileAssignment({
      seriesId: SERIES_ID,
      seriesLifecycleStatus: "active",
      companyProfileId: null,
      company: null,
      occupyingSeries: null,
      currentlyLinkedCompanyId: COMPANY_ID,
      currentlyLinkedCompanyApprovedAt: null,
    });
    assert.deepEqual(result, { ok: true, warnings: [] });
  });

  it("allows linking an active unrestricted company", () => {
    const result = validateSameBrandCompanyProfileAssignment({
      seriesId: SERIES_ID,
      seriesLifecycleStatus: "active",
      companyProfileId: COMPANY_ID,
      company: activeCompany,
      occupyingSeries: null,
    });
    assert.deepEqual(result, { ok: true, warnings: [] });
  });

  it("allows replace when the company is free or already owned by this series", () => {
    const free = validateSameBrandCompanyProfileAssignment({
      seriesId: SERIES_ID,
      seriesLifecycleStatus: null,
      companyProfileId: COMPANY_ID,
      company: activeCompany,
      occupyingSeries: null,
    });
    assert.equal(free.ok, true);

    const selfOwned = validateSameBrandCompanyProfileAssignment({
      seriesId: SERIES_ID,
      seriesLifecycleStatus: "active",
      companyProfileId: COMPANY_ID,
      company: activeCompany,
      occupyingSeries: { id: SERIES_ID, name: "TOKEN2049" },
    });
    assert.deepEqual(selfOwned, { ok: true, warnings: [] });
  });

  it("rejects uniqueness conflicts with another event series", () => {
    const result = validateSameBrandCompanyProfileAssignment({
      seriesId: SERIES_ID,
      seriesLifecycleStatus: "active",
      companyProfileId: COMPANY_ID,
      company: activeCompany,
      occupyingSeries: { id: OTHER_SERIES_ID, name: "ETHGlobal" },
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error, sameBrandUniquenessConflictMessage("ETHGlobal"));
  });

  it("allows restricted companies with a clear warning", () => {
    const result = validateSameBrandCompanyProfileAssignment({
      seriesId: SERIES_ID,
      seriesLifecycleStatus: "active",
      companyProfileId: COMPANY_ID,
      company: {
        ...activeCompany,
        restricted_at: "2026-07-01T00:00:00.000Z",
      },
      occupyingSeries: null,
    });
    assert.deepEqual(result, {
      ok: true,
      warnings: [SAME_BRAND_RESTRICTED_COMPANY_WARNING],
    });
  });

  it("rejects missing, inactive, and merged companies", () => {
    assert.deepEqual(
      validateSameBrandCompanyProfileAssignment({
        seriesId: SERIES_ID,
        seriesLifecycleStatus: "active",
        companyProfileId: COMPANY_ID,
        company: null,
        occupyingSeries: null,
      }),
      { ok: false, error: SAME_BRAND_COMPANY_MISSING_MESSAGE },
    );

    const inactive = validateSameBrandCompanyProfileAssignment({
      seriesId: SERIES_ID,
      seriesLifecycleStatus: "active",
      companyProfileId: COMPANY_ID,
      company: {
        ...activeCompany,
        status: "inactive",
      },
      occupyingSeries: null,
    });
    assert.deepEqual(inactive, { ok: false, error: COMPANY_NOT_LINKABLE_MESSAGE });

    const merged = validateSameBrandCompanyProfileAssignment({
      seriesId: SERIES_ID,
      seriesLifecycleStatus: "active",
      companyProfileId: COMPANY_ID,
      company: {
        ...activeCompany,
        status: "merged",
        merged_into_company_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      },
      occupyingSeries: null,
    });
    assert.deepEqual(merged, { ok: false, error: COMPANY_NOT_LINKABLE_MESSAGE });
  });

  it("rejects linking on a merged event series", () => {
    const result = validateSameBrandCompanyProfileAssignment({
      seriesId: SERIES_ID,
      seriesLifecycleStatus: "merged",
      companyProfileId: COMPANY_ID,
      company: activeCompany,
      occupyingSeries: null,
    });
    assert.deepEqual(result, { ok: false, error: SAME_BRAND_SERIES_MERGED_MESSAGE });
  });
});

describe("isSameBrandCompanyProfileStale", () => {
  it("flags merged or missing companies as stale", () => {
    assert.equal(isSameBrandCompanyProfileStale(null), true);
    assert.equal(isSameBrandCompanyProfileStale(activeCompany), false);
    assert.equal(
      isSameBrandCompanyProfileStale({
        ...activeCompany,
        status: "merged",
      }),
      true,
    );
  });

  it("exposes a stable stale-link message for admin UI", () => {
    assert.match(SAME_BRAND_STALE_LINK_MESSAGE, /no longer active/i);
  });
});
