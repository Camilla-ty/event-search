import { describe, expect, it } from "vitest";

import { isCompanyLogoStorageUrl } from "@/src/lib/companies/isCompanyLogoStorageUrl";

describe("isCompanyLogoStorageUrl", () => {
  it("returns true for a company-logos public object URL", () => {
    expect(
      isCompanyLogoStorageUrl(
        "https://example.supabase.co/storage/v1/object/public/company-logos/companies/acme.com/logo.png",
      ),
    ).toBe(true);
  });

  it("returns false for external URLs", () => {
    expect(isCompanyLogoStorageUrl("https://cdn.example.com/logo.png")).toBe(false);
  });

  it("returns false for empty values", () => {
    expect(isCompanyLogoStorageUrl(null)).toBe(false);
    expect(isCompanyLogoStorageUrl("")).toBe(false);
  });
});
