import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  companyLogoObjectPath,
  extensionForContentType,
  isCompanyIdLogoStorageSegment,
  normalizeStoredCompanyLogoUrl,
  parseCompanyLogoStoragePathFromUrl,
  selectStaleCompanyLogoCleanupPaths,
  storedCompanyLogoUrlFromUpload,
} from "@/src/features/companies/server/companyLogoStorage";

const COMPANY_ID = "550e8400-e29b-41d4-a716-446655440000";
const BASE_URL = "https://example.supabase.co/storage/v1/object/public/company-logos";

describe("extensionForContentType", () => {
  it("maps common image content types", () => {
    assert.equal(extensionForContentType("image/png"), "png");
    assert.equal(extensionForContentType("image/jpeg"), "jpg");
    assert.equal(extensionForContentType("image/jpg"), "jpg");
    assert.equal(extensionForContentType("image/webp"), "webp");
    assert.equal(extensionForContentType("image/svg+xml"), "svg");
  });
});

describe("companyLogoObjectPath", () => {
  it("builds a companyId-based object path", () => {
    assert.equal(
      companyLogoObjectPath(COMPANY_ID, "png"),
      `companies/${COMPANY_ID}/logo.png`,
    );
  });
});

describe("isCompanyIdLogoStorageSegment", () => {
  it("accepts UUID company ids and rejects domain keys", () => {
    assert.equal(isCompanyIdLogoStorageSegment(COMPANY_ID), true);
    assert.equal(isCompanyIdLogoStorageSegment("acme.com"), false);
  });
});

describe("parseCompanyLogoStoragePathFromUrl", () => {
  it("parses a companyId-based logo URL", () => {
    const parsed = parseCompanyLogoStoragePathFromUrl(
      `${BASE_URL}/companies/${COMPANY_ID}/logo.webp`,
    );

    assert.deepEqual(parsed, {
      bucketRelativePath: `companies/${COMPANY_ID}/logo.webp`,
      companyId: COMPANY_ID,
      extension: "webp",
      isLegacyPath: false,
      legacyIdentityKey: null,
    });
  });

  it("parses storage/v1 public object URLs", () => {
    const parsed = parseCompanyLogoStoragePathFromUrl(
      `https://example.supabase.co/storage/v1/object/public/company-logos/companies/acme.com/logo.png`,
    );

    assert.equal(parsed?.bucketRelativePath, "companies/acme.com/logo.png");
    assert.equal(parsed?.isLegacyPath, true);
  });

  it("parses a legacy domain-based logo URL", () => {
    const parsed = parseCompanyLogoStoragePathFromUrl(
      `${BASE_URL}/companies/acme.com/logo.png`,
    );

    assert.deepEqual(parsed, {
      bucketRelativePath: "companies/acme.com/logo.png",
      companyId: null,
      extension: "png",
      isLegacyPath: true,
      legacyIdentityKey: "acme.com",
    });
  });

  it("returns null for non-company-logo URLs", () => {
    assert.equal(
      parseCompanyLogoStoragePathFromUrl("https://cdn.example.com/logo.png"),
      null,
    );
    assert.equal(parseCompanyLogoStoragePathFromUrl(null), null);
  });
});

describe("normalizeStoredCompanyLogoUrl", () => {
  it("converts full Supabase URLs to bucket-relative paths", () => {
    assert.equal(
      normalizeStoredCompanyLogoUrl(
        `${BASE_URL}/companies/${COMPANY_ID}/logo.webp`,
        COMPANY_ID,
      ),
      `companies/${COMPANY_ID}/logo.webp`,
    );
  });

  it("passes through bucket-relative paths unchanged", () => {
    assert.equal(
      normalizeStoredCompanyLogoUrl(`companies/${COMPANY_ID}/logo.png`, COMPANY_ID),
      `companies/${COMPANY_ID}/logo.png`,
    );
  });
});

describe("storedCompanyLogoUrlFromUpload", () => {
  it("returns the storage path for DB persistence", () => {
    assert.equal(
      storedCompanyLogoUrlFromUpload({
        storagePath: `companies/${COMPANY_ID}/logo.png`,
      }),
      `companies/${COMPANY_ID}/logo.png`,
    );
  });
});

describe("selectStaleCompanyLogoCleanupPaths", () => {
  it("returns sibling logo extensions except the active file", () => {
    const activeStoragePath = `companies/${COMPANY_ID}/logo.png`;
    const stalePaths = selectStaleCompanyLogoCleanupPaths({
      companyId: COMPANY_ID,
      activeStoragePath,
    });

    assert.ok(stalePaths.includes(`companies/${COMPANY_ID}/logo.jpg`));
    assert.ok(stalePaths.includes(`companies/${COMPANY_ID}/logo.webp`));
    assert.ok(stalePaths.includes(`companies/${COMPANY_ID}/logo.svg`));
    assert.equal(stalePaths.includes(activeStoragePath), false);
  });

  it("returns no candidates for legacy or mismatched paths", () => {
    assert.deepEqual(
      selectStaleCompanyLogoCleanupPaths({
        companyId: COMPANY_ID,
        activeStoragePath: "companies/acme.com/logo.png",
      }),
      [],
    );
  });
});
