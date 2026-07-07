import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isCompanyLogoStorageUrl } from "@/src/lib/companies/isCompanyLogoStorageUrl";

describe("isCompanyLogoStorageUrl", () => {
  it("returns true for a legacy domain-based company-logos public object URL", () => {
    assert.equal(
      isCompanyLogoStorageUrl(
        "https://example.supabase.co/storage/v1/object/public/company-logos/companies/acme.com/logo.png",
      ),
      true,
    );
  });

  it("returns true for a companyId-based company-logos public object URL", () => {
    assert.equal(
      isCompanyLogoStorageUrl(
        "https://example.supabase.co/storage/v1/object/public/company-logos/companies/550e8400-e29b-41d4-a716-446655440000/logo.png",
      ),
      true,
    );
  });

  it("returns true for bucket-relative company logo paths", () => {
    assert.equal(
      isCompanyLogoStorageUrl(
        "companies/550e8400-e29b-41d4-a716-446655440000/logo.png",
      ),
      true,
    );
  });

  it("returns false for external URLs", () => {
    assert.equal(isCompanyLogoStorageUrl("https://cdn.example.com/logo.png"), false);
  });

  it("returns false for empty values", () => {
    assert.equal(isCompanyLogoStorageUrl(null), false);
    assert.equal(isCompanyLogoStorageUrl(""), false);
  });
});
