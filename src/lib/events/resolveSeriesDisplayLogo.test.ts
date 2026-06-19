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
});
