import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getCompanyIndexability,
  getEventEditionIndexability,
  getSeriesIndexability,
  getTopicIndexability,
} from "@/src/lib/seo/indexability";

/**
 * Sitemap membership mirrors indexability decisions (IR1).
 * Fetch helpers apply these predicates; unit-test the gate here without DB.
 */
describe("sitemap inclusion predicates", () => {
  it("excludes zero-sponsor companies and restricted companies", () => {
    assert.equal(
      getCompanyIndexability({
        restricted: false,
        sponsoredEditionCount: 0,
      }).includeInSitemap,
      false,
    );
    assert.equal(
      getCompanyIndexability({
        restricted: true,
        sponsoredEditionCount: 5,
      }).includeInSitemap,
      false,
    );
  });

  it("includes companies with 1+ sponsored editions", () => {
    assert.equal(
      getCompanyIndexability({
        restricted: false,
        sponsoredEditionCount: 2,
      }).includeInSitemap,
      true,
    );
  });

  it("excludes soft-retired Event Brand Companies from the company sitemap (EB2)", () => {
    assert.equal(
      getCompanyIndexability({
        restricted: false,
        sponsoredEditionCount: 5,
        slug: "singapore-fintech-festival",
        status: "active",
        eventBrandPublicProfileApprovedAt: "2026-08-01T11:19:34.191394+00",
        sameBrandSeries: {
          id: "78232c5b-7ef2-4cda-a23a-941387e1a9c1",
          slug: "singapore-fintech-festival",
          lifecycle_status: "active",
        },
      }).includeInSitemap,
      false,
    );
  });

  it("excludes zero-sponsor editions and includes editions with sponsors", () => {
    assert.equal(
      getEventEditionIndexability({ sponsorCount: 0 }).includeInSitemap,
      false,
    );
    assert.equal(
      getEventEditionIndexability({ sponsorCount: 1 }).includeInSitemap,
      true,
    );
  });

  it("includes active/discontinued series and excludes merged", () => {
    assert.equal(
      getSeriesIndexability({ lifecycleStatus: "active" }).includeInSitemap,
      true,
    );
    assert.equal(
      getSeriesIndexability({ lifecycleStatus: "discontinued" })
        .includeInSitemap,
      true,
    );
    assert.equal(
      getSeriesIndexability({
        lifecycleStatus: "merged",
        treatAsMergedNonDestination: true,
      }).includeInSitemap,
      false,
    );
  });

  it("includes topics and does not invent research routes", () => {
    assert.equal(getTopicIndexability().includeInSitemap, true);
  });
});
