import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveSeriesDisplayLogo } from "@/src/lib/events/resolveSeriesDisplayLogo";

describe("resolveSeriesDisplayLogo", () => {
  it("returns the series logo when set", () => {
    assert.equal(
      resolveSeriesDisplayLogo({ logo_url: "https://cdn.example/series.png" }),
      "https://cdn.example/series.png",
    );
  });

  it("returns null when series logo is empty", () => {
    assert.equal(resolveSeriesDisplayLogo({ logo_url: null }), null);
    assert.equal(resolveSeriesDisplayLogo({ logo_url: "  " }), null);
    assert.equal(resolveSeriesDisplayLogo(null), null);
    assert.equal(resolveSeriesDisplayLogo(undefined), null);
  });

  it("uses series logo only (edition overrides are not part of this API)", () => {
    const seriesLogo = "https://cdn.example/series.png";
    const editionOverride = "https://cdn.example/edition-only.png";
    assert.equal(resolveSeriesDisplayLogo({ logo_url: seriesLogo }), seriesLogo);
    assert.notEqual(
      resolveSeriesDisplayLogo({ logo_url: seriesLogo }),
      editionOverride,
    );
  });

  it("resolves bucket-relative series logo paths", () => {
    const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";

    try {
      const seriesId = "622665d9-ff74-4e68-8ec7-25551590c435";
      assert.equal(
        resolveSeriesDisplayLogo({ logo_url: `event-series/${seriesId}/logo.svg` }),
        `https://example.supabase.co/storage/v1/object/public/company-logos/event-series/${seriesId}/logo.svg`,
      );
    } finally {
      if (originalSupabaseUrl === undefined) {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      } else {
        process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
      }
    }
  });
});
