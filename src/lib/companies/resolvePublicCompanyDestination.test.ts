import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildPublicCompanyHref,
  isEventBrandCompanyPublicProfileSoftRetired,
  resolvePublicCompanyDestination,
} from "@/src/lib/companies/resolvePublicCompanyDestination";
import { buildSponsorProfilePath } from "@/src/lib/routes/explorerUrls";

const SFF_COMPANY = {
  id: "f85bff6d-f25a-40c5-839f-4a395fbb3d37",
  slug: "singapore-fintech-festival",
  status: "active",
  restricted_at: null,
  merged_into_company_id: null,
  event_brand_public_profile_approved_at: "2026-08-01T11:19:34.191394+00",
};

const SFF_SERIES = {
  id: "78232c5b-7ef2-4cda-a23a-941387e1a9c1",
  name: "Singapore Fintech Festival",
  slug: "singapore-fintech-festival",
  lifecycle_status: "active",
};

const NORMAL_COMPANY = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  slug: "acme-corp",
  status: "active",
  restricted_at: null,
  merged_into_company_id: null,
  event_brand_public_profile_approved_at: null,
};

describe("resolvePublicCompanyDestination (ADR-005 EB1)", () => {
  it("resolves a normal Company to /sponsors/{slug}", () => {
    const result = resolvePublicCompanyDestination({
      company: NORMAL_COMPANY,
      sameBrandSeries: null,
    });
    assert.deepEqual(result, {
      href: "/sponsors/acme-corp",
      kind: "sponsor_profile",
    });
    assert.equal(buildPublicCompanyHref({ company: NORMAL_COMPANY }), "/sponsors/acme-corp");
  });

  it("resolves approved Singapore FinTech Festival to Series hub root", () => {
    const result = resolvePublicCompanyDestination({
      company: SFF_COMPANY,
      sameBrandSeries: SFF_SERIES,
    });
    assert.deepEqual(result, {
      href: "/events/series/singapore-fintech-festival",
      kind: "event_series_hub",
    });
    assert.doesNotMatch(result!.href, /\?tab=/);
  });

  it("falls back to sponsor path when approved but Series is unavailable", () => {
    const merged = resolvePublicCompanyDestination({
      company: SFF_COMPANY,
      sameBrandSeries: { ...SFF_SERIES, lifecycle_status: "merged" },
    });
    assert.deepEqual(merged, {
      href: "/sponsors/singapore-fintech-festival",
      kind: "sponsor_profile",
    });

    const missing = resolvePublicCompanyDestination({
      company: SFF_COMPANY,
      sameBrandSeries: null,
    });
    assert.deepEqual(missing, {
      href: "/sponsors/singapore-fintech-festival",
      kind: "sponsor_profile",
    });

    const noPath = resolvePublicCompanyDestination({
      company: SFF_COMPANY,
      sameBrandSeries: { id: "", slug: "", lifecycle_status: "active" },
    });
    assert.deepEqual(noPath, {
      href: "/sponsors/singapore-fintech-festival",
      kind: "sponsor_profile",
    });
  });

  it("keeps unapproved same-brand Companies on sponsor profiles", () => {
    const result = resolvePublicCompanyDestination({
      company: {
        ...SFF_COMPANY,
        event_brand_public_profile_approved_at: null,
      },
      sameBrandSeries: SFF_SERIES,
    });
    assert.deepEqual(result, {
      href: "/sponsors/singapore-fintech-festival",
      kind: "sponsor_profile",
    });
  });

  it("returns null for restricted or merged Companies", () => {
    assert.equal(
      resolvePublicCompanyDestination({
        company: {
          ...NORMAL_COMPANY,
          restricted_at: "2026-08-01T00:00:00.000Z",
        },
      }),
      null,
    );
    assert.equal(
      resolvePublicCompanyDestination({
        company: {
          ...NORMAL_COMPANY,
          status: "merged",
          merged_into_company_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        },
      }),
      null,
    );
    assert.equal(
      resolvePublicCompanyDestination({
        company: {
          ...SFF_COMPANY,
          restricted_at: "2026-08-01T00:00:00.000Z",
        },
        sameBrandSeries: SFF_SERIES,
      }),
      null,
    );
  });

  it("handles missing slug via id and returns null when no path segment exists", () => {
    const byId = resolvePublicCompanyDestination({
      company: {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        slug: "",
        status: "active",
        restricted_at: null,
        merged_into_company_id: null,
        event_brand_public_profile_approved_at: null,
      },
    });
    assert.deepEqual(byId, {
      href: "/sponsors/cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      kind: "sponsor_profile",
    });

    assert.equal(
      resolvePublicCompanyDestination({
        company: {
          id: "",
          slug: "   ",
          status: "active",
          restricted_at: null,
          merged_into_company_id: null,
          event_brand_public_profile_approved_at: null,
        },
      }),
      null,
    );
  });

  it("does not change buildSponsorProfilePath behavior", () => {
    assert.equal(
      buildSponsorProfilePath(NORMAL_COMPANY),
      "/sponsors/acme-corp",
    );
    assert.equal(
      buildSponsorProfilePath(SFF_COMPANY),
      "/sponsors/singapore-fintech-festival",
    );
    assert.equal(
      buildSponsorProfilePath({
        ...NORMAL_COMPANY,
        restricted_at: "2026-08-01T00:00:00.000Z",
      }),
      null,
    );
  });

  it("marks soft-retired Event Brand profiles for EB2 SEO", () => {
    assert.equal(
      isEventBrandCompanyPublicProfileSoftRetired({
        company: SFF_COMPANY,
        sameBrandSeries: SFF_SERIES,
      }),
      true,
    );
    assert.equal(
      isEventBrandCompanyPublicProfileSoftRetired({
        company: SFF_COMPANY,
        sameBrandSeries: { ...SFF_SERIES, lifecycle_status: "merged" },
      }),
      false,
    );
    assert.equal(
      isEventBrandCompanyPublicProfileSoftRetired({
        company: NORMAL_COMPANY,
      }),
      false,
    );
  });
});
