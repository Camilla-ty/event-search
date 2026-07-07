import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isBucketRelativeStorageLogoPath,
  resolveStorageLogoDisplayUrl,
} from "./resolveStorageLogoDisplayUrl";

const SUPABASE_BASE = "https://example.supabase.co";
const COMPANY_ID = "550e8400-e29b-41d4-a716-446655440000";
const SERIES_ID = "622665d9-ff74-4e68-8ec7-25551590c435";
const VENUE_ID = "f83647f2-cec7-4cb7-9435-8cdb997c1e98";

describe("isBucketRelativeStorageLogoPath", () => {
  it("accepts canonical company, event-series, and venue paths", () => {
    assert.equal(isBucketRelativeStorageLogoPath(`companies/${COMPANY_ID}/logo.png`), true);
    assert.equal(isBucketRelativeStorageLogoPath(`event-series/${SERIES_ID}/logo.svg`), true);
    assert.equal(isBucketRelativeStorageLogoPath(`venues/${VENUE_ID}/logo.webp`), true);
  });

  it("accepts legacy domain-based company paths", () => {
    assert.equal(isBucketRelativeStorageLogoPath("companies/acme.com/logo.png"), true);
  });

  it("rejects full URLs and external URLs", () => {
    assert.equal(
      isBucketRelativeStorageLogoPath(
        `https://example.supabase.co/storage/v1/object/public/company-logos/companies/${COMPANY_ID}/logo.png`,
      ),
      false,
    );
    assert.equal(isBucketRelativeStorageLogoPath("https://cdn.example.com/logo.png"), false);
  });
});

describe("resolveStorageLogoDisplayUrl", () => {
  it("resolves bucket-relative paths to public storage URLs", () => {
    assert.equal(
      resolveStorageLogoDisplayUrl(
        `companies/${COMPANY_ID}/logo.png`,
        SUPABASE_BASE,
      ),
      `${SUPABASE_BASE}/storage/v1/object/public/company-logos/companies/${COMPANY_ID}/logo.png`,
    );
    assert.equal(
      resolveStorageLogoDisplayUrl(
        `event-series/${SERIES_ID}/logo.jpg`,
        SUPABASE_BASE,
      ),
      `${SUPABASE_BASE}/storage/v1/object/public/company-logos/event-series/${SERIES_ID}/logo.jpg`,
    );
    assert.equal(
      resolveStorageLogoDisplayUrl(`venues/${VENUE_ID}/logo.webp`, SUPABASE_BASE),
      `${SUPABASE_BASE}/storage/v1/object/public/company-logos/venues/${VENUE_ID}/logo.webp`,
    );
  });

  it("passes through full and external URLs unchanged", () => {
    const fullUrl = `https://example.supabase.co/storage/v1/object/public/company-logos/companies/${COMPANY_ID}/logo.png`;
    assert.equal(resolveStorageLogoDisplayUrl(fullUrl, SUPABASE_BASE), fullUrl);
    assert.equal(
      resolveStorageLogoDisplayUrl("https://cdn.example.com/logo.png", SUPABASE_BASE),
      "https://cdn.example.com/logo.png",
    );
  });

  it("returns null for empty values", () => {
    assert.equal(resolveStorageLogoDisplayUrl(null, SUPABASE_BASE), null);
    assert.equal(resolveStorageLogoDisplayUrl("  ", SUPABASE_BASE), null);
  });

  it("returns null for bucket-relative paths when the Supabase base URL is missing", () => {
    assert.equal(
      resolveStorageLogoDisplayUrl(`companies/${COMPANY_ID}/logo.png`, ""),
      null,
    );
  });
});
