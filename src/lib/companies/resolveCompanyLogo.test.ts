import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { resolveCompanyLogo } from "./resolveCompanyLogo";

const SUPABASE_BASE = "https://example.supabase.co";
const COMPANY_ID = "550e8400-e29b-41d4-a716-446655440000";

describe("resolveCompanyLogo", () => {
  const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  afterEach(() => {
    if (originalSupabaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
    }
  });

  it("resolves bucket-relative logo_url values for image display", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_BASE;

    const result = resolveCompanyLogo({
      name: "Acme",
      logo_url: `companies/${COMPANY_ID}/logo.png`,
      domain: null,
      logo_source: "storage",
      logo_status: "ok",
    });

    assert.deepEqual(result, {
      kind: "image",
      src: `${SUPABASE_BASE}/storage/v1/object/public/company-logos/companies/${COMPANY_ID}/logo.png`,
    });
  });

  it("passes through external logo URLs unchanged", () => {
    const result = resolveCompanyLogo({
      name: "Acme",
      logo_url: "https://cdn.example.com/logo.png",
      domain: null,
      logo_source: null,
      logo_status: null,
    });

    assert.deepEqual(result, {
      kind: "image",
      src: "https://cdn.example.com/logo.png",
    });
  });

  it("falls back to monogram when logo_url is empty", () => {
    const result = resolveCompanyLogo({
      name: "Acme",
      logo_url: null,
      domain: null,
      logo_source: null,
      logo_status: null,
    });

    assert.deepEqual(result, { kind: "monogram", letter: "A" });
  });
});
