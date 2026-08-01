import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  resolveEventBrandSponsorProfileRedirect,
  resolvePublicCompanyDestination,
} from "@/src/lib/companies/resolvePublicCompanyDestination";

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

const PAGE = "src/app/(marketing)/sponsors/[slug]/page.tsx";

describe("resolveEventBrandSponsorProfileRedirect (ADR-005 EB3)", () => {
  it("redirects approved Singapore FinTech Festival to Series hub root", () => {
    const href = resolveEventBrandSponsorProfileRedirect({
      company: SFF_COMPANY,
      sameBrandSeries: SFF_SERIES,
    });
    assert.equal(href, "/events/series/singapore-fintech-festival");
    assert.doesNotMatch(href!, /\?/);
  });

  it("does not redirect a normal Company (profile still renders)", () => {
    assert.equal(
      resolveEventBrandSponsorProfileRedirect({
        company: NORMAL_COMPANY,
        sameBrandSeries: null,
      }),
      null,
    );
    assert.equal(
      resolvePublicCompanyDestination({
        company: NORMAL_COMPANY,
      })?.kind,
      "sponsor_profile",
    );
  });

  it("falls back to no redirect when Series is invalid or missing", () => {
    assert.equal(
      resolveEventBrandSponsorProfileRedirect({
        company: SFF_COMPANY,
        sameBrandSeries: { ...SFF_SERIES, lifecycle_status: "merged" },
      }),
      null,
    );
    assert.equal(
      resolveEventBrandSponsorProfileRedirect({
        company: SFF_COMPANY,
        sameBrandSeries: null,
      }),
      null,
    );
    assert.equal(
      resolveEventBrandSponsorProfileRedirect({
        company: SFF_COMPANY,
        sameBrandSeries: { id: "", slug: "", lifecycle_status: "active" },
      }),
      null,
    );
  });

  it("does not redirect restricted, merged, or inactive Companies", () => {
    assert.equal(
      resolveEventBrandSponsorProfileRedirect({
        company: {
          ...SFF_COMPANY,
          restricted_at: "2026-08-01T00:00:00.000Z",
        },
        sameBrandSeries: SFF_SERIES,
      }),
      null,
    );
    assert.equal(
      resolveEventBrandSponsorProfileRedirect({
        company: {
          ...SFF_COMPANY,
          status: "merged",
          merged_into_company_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        },
        sameBrandSeries: SFF_SERIES,
      }),
      null,
    );
    assert.equal(
      resolveEventBrandSponsorProfileRedirect({
        company: {
          ...NORMAL_COMPANY,
          status: "inactive",
        },
      }),
      null,
    );
  });

  it("wires temporary redirect on the public sponsor detail page", () => {
    const source = readFileSync(PAGE, "utf8");
    assert.match(source, /resolveEventBrandSponsorProfileRedirect/);
    assert.match(source, /redirect\(seriesHubRedirect\)/);
    assert.match(source, /from "next\/navigation"/);
    assert.match(source, /notFound, redirect/);
    assert.doesNotMatch(source, /permanentRedirect/);
    assert.doesNotMatch(source, /\?tab=participated/);
  });
});
