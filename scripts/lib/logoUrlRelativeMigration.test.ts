import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isBucketRelativeLogoPath,
  planCompanyLogoUrlToRelativePath,
  planEventSeriesLogoUrlToRelativePath,
  planVenueLogoUrlToRelativePath,
} from "./logoUrlRelativeMigration";

const COMPANY_ID = "550e8400-e29b-41d4-a716-446655440000";
const SERIES_ID = "622665d9-ff74-4e68-8ec7-25551590c435";
const VENUE_ID = "f83647f2-cec7-4cb7-9435-8cdb997c1e98";

describe("planCompanyLogoUrlToRelativePath", () => {
  it("converts a full Supabase storage URL to a bucket-relative path", () => {
    const before = `https://example.supabase.co/storage/v1/object/public/company-logos/companies/${COMPANY_ID}/logo.png`;
    const result = planCompanyLogoUrlToRelativePath({
      id: COMPANY_ID,
      logo_url: before,
    });

    assert.equal(result.kind, "convert");
    if (result.kind === "convert") {
      assert.equal(result.before, before);
      assert.equal(result.after, `companies/${COMPANY_ID}/logo.png`);
    }
  });

  it("converts legacy storage paths using the row company id", () => {
    const before =
      "https://example.supabase.co/storage/v1/object/public/company-logos/companies/acme.com/logo.png";
    const result = planCompanyLogoUrlToRelativePath({
      id: COMPANY_ID,
      logo_url: before,
    });

    assert.equal(result.kind, "convert");
    if (result.kind === "convert") {
      assert.equal(result.after, `companies/${COMPANY_ID}/logo.png`);
    }
  });

  it("skips external URLs and existing relative paths", () => {
    assert.equal(
      planCompanyLogoUrlToRelativePath({
        id: COMPANY_ID,
        logo_url: "https://cdn.example.com/logo.png",
      }).kind,
      "skip",
    );
    assert.equal(
      planCompanyLogoUrlToRelativePath({
        id: COMPANY_ID,
        logo_url: `companies/${COMPANY_ID}/logo.webp`,
      }).kind,
      "skip",
    );
  });
});

describe("planEventSeriesLogoUrlToRelativePath", () => {
  it("converts a full Supabase storage URL to a bucket-relative path", () => {
    const before = `https://example.supabase.co/storage/v1/object/public/company-logos/event-series/${SERIES_ID}/logo.svg`;
    const result = planEventSeriesLogoUrlToRelativePath({
      id: SERIES_ID,
      logo_url: before,
    });

    assert.equal(result.kind, "convert");
    if (result.kind === "convert") {
      assert.equal(result.before, before);
      assert.equal(result.after, `event-series/${SERIES_ID}/logo.svg`);
    }
  });
});

describe("planVenueLogoUrlToRelativePath", () => {
  it("converts a full Supabase storage URL to a bucket-relative path", () => {
    const before = `https://example.supabase.co/storage/v1/object/public/company-logos/venues/${VENUE_ID}/logo.webp`;
    const result = planVenueLogoUrlToRelativePath({
      id: VENUE_ID,
      logo_url: before,
    });

    assert.equal(result.kind, "convert");
    if (result.kind === "convert") {
      assert.equal(result.after, `venues/${VENUE_ID}/logo.webp`);
    }
  });

  it("skips external URLs unchanged", () => {
    const result = planVenueLogoUrlToRelativePath({
      id: VENUE_ID,
      logo_url: "https://pvaexpo.cz/cdn/image/logo.svg",
    });
    assert.equal(result.kind, "skip");
    if (result.kind === "skip") {
      assert.equal(result.reason, "external_url");
    }
  });
});

describe("isBucketRelativeLogoPath", () => {
  it("accepts canonical company, event-series, and venue paths", () => {
    assert.equal(isBucketRelativeLogoPath(`companies/${COMPANY_ID}/logo.png`), true);
    assert.equal(isBucketRelativeLogoPath(`event-series/${SERIES_ID}/logo.jpg`), true);
    assert.equal(isBucketRelativeLogoPath(`venues/${VENUE_ID}/logo.webp`), true);
    assert.equal(isBucketRelativeLogoPath("https://cdn.example.com/logo.png"), false);
  });
});
