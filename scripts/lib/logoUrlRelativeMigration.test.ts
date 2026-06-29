import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isBucketRelativeLogoPath,
  planCompanyLogoUrlToRelativePath,
  planEventSeriesLogoUrlToRelativePath,
} from "./logoUrlRelativeMigration";

const COMPANY_ID = "550e8400-e29b-41d4-a716-446655440000";
const SERIES_ID = "622665d9-ff74-4e68-8ec7-25551590c435";

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

describe("isBucketRelativeLogoPath", () => {
  it("accepts canonical company and event-series paths", () => {
    assert.equal(isBucketRelativeLogoPath(`companies/${COMPANY_ID}/logo.png`), true);
    assert.equal(isBucketRelativeLogoPath(`event-series/${SERIES_ID}/logo.jpg`), true);
    assert.equal(isBucketRelativeLogoPath("https://cdn.example.com/logo.png"), false);
  });
});
