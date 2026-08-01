import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EVENT_BRAND_PUBLIC_PROFILE_ALREADY_APPROVED_MESSAGE,
  EVENT_BRAND_PUBLIC_PROFILE_NOT_APPROVED_MESSAGE,
  EVENT_BRAND_PUBLIC_PROFILE_NO_SERIES_MESSAGE,
  EVENT_BRAND_PUBLIC_PROFILE_SERIES_UNAVAILABLE_MESSAGE,
  EVENT_BRAND_PUBLIC_PROFILE_UNLINK_BLOCKED_MESSAGE,
  isEventBrandPublicProfileApproved,
  isSeriesPubliclyResolvableForEventBrandProfile,
  validateEventBrandPublicProfileApproval,
} from "@/src/lib/companies/eventBrandPublicProfile";
import { validateSameBrandCompanyProfileAssignment } from "@/src/lib/companies/sameBrandCompanyProfile";

const SERIES = {
  id: "78232c5b-7ef2-4cda-a23a-941387e1a9c1",
  name: "Singapore Fintech Festival",
  slug: "singapore-fintech-festival",
  lifecycle_status: "active",
};

const COMPANY_ID = "f85bff6d-f25a-40c5-839f-4a395fbb3d37";
const SERIES_ID = SERIES.id;

describe("eventBrandPublicProfile (ADR-005 EB0)", () => {
  it("treats null approval as not approved (normal Company unchanged)", () => {
    assert.equal(isEventBrandPublicProfileApproved(null), false);
    assert.equal(isEventBrandPublicProfileApproved(undefined), false);
    assert.equal(isEventBrandPublicProfileApproved(""), false);
    assert.equal(isEventBrandPublicProfileApproved("2026-08-01T00:00:00.000Z"), true);
  });

  it("approves when same-brand Series is publicly resolvable", () => {
    const result = validateEventBrandPublicProfileApproval({
      action: "approve",
      currentApprovedAt: null,
      sameBrandSeries: SERIES,
    });
    assert.deepEqual(result, { ok: true });
  });

  it("rejects approve without same-brand link", () => {
    const result = validateEventBrandPublicProfileApproval({
      action: "approve",
      currentApprovedAt: null,
      sameBrandSeries: null,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, EVENT_BRAND_PUBLIC_PROFILE_NO_SERIES_MESSAGE);
    }
  });

  it("rejects approve when Series is unavailable (merged)", () => {
    assert.equal(
      isSeriesPubliclyResolvableForEventBrandProfile({
        ...SERIES,
        lifecycle_status: "merged",
      }),
      false,
    );
    const result = validateEventBrandPublicProfileApproval({
      action: "approve",
      currentApprovedAt: null,
      sameBrandSeries: { ...SERIES, lifecycle_status: "merged" },
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, EVENT_BRAND_PUBLIC_PROFILE_SERIES_UNAVAILABLE_MESSAGE);
    }
  });

  it("allows revoke when approved", () => {
    const result = validateEventBrandPublicProfileApproval({
      action: "revoke",
      currentApprovedAt: "2026-08-01T12:00:00.000Z",
      sameBrandSeries: SERIES,
    });
    assert.deepEqual(result, { ok: true });
  });

  it("rejects revoke when not approved", () => {
    const result = validateEventBrandPublicProfileApproval({
      action: "revoke",
      currentApprovedAt: null,
      sameBrandSeries: SERIES,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, EVENT_BRAND_PUBLIC_PROFILE_NOT_APPROVED_MESSAGE);
    }
  });

  it("rejects duplicate approve", () => {
    const result = validateEventBrandPublicProfileApproval({
      action: "approve",
      currentApprovedAt: "2026-08-01T12:00:00.000Z",
      sameBrandSeries: SERIES,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, EVENT_BRAND_PUBLIC_PROFILE_ALREADY_APPROVED_MESSAGE);
    }
  });

  it("blocks same-brand unlink while approved", () => {
    const result = validateSameBrandCompanyProfileAssignment({
      seriesId: SERIES_ID,
      seriesLifecycleStatus: "active",
      companyProfileId: null,
      company: null,
      occupyingSeries: null,
      currentlyLinkedCompanyId: COMPANY_ID,
      currentlyLinkedCompanyApprovedAt: "2026-08-01T12:00:00.000Z",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, EVENT_BRAND_PUBLIC_PROFILE_UNLINK_BLOCKED_MESSAGE);
    }
  });

  it("blocks same-brand replace while approved", () => {
    const result = validateSameBrandCompanyProfileAssignment({
      seriesId: SERIES_ID,
      seriesLifecycleStatus: "active",
      companyProfileId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      company: {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        name: "Other",
        status: "active",
        merged_into_company_id: null,
        restricted_at: null,
      },
      occupyingSeries: null,
      currentlyLinkedCompanyId: COMPANY_ID,
      currentlyLinkedCompanyApprovedAt: "2026-08-01T12:00:00.000Z",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, EVENT_BRAND_PUBLIC_PROFILE_UNLINK_BLOCKED_MESSAGE);
    }
  });

  it("allows unlink when not approved (normal linked Company)", () => {
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
});
