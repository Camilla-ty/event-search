import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveEditionDisplayLogo } from "@/src/lib/events/resolveEditionDisplayLogo";

describe("resolveEditionDisplayLogo", () => {
  it("prefers edition logo over series logo", () => {
    assert.equal(
      resolveEditionDisplayLogo({
        logo_url: "https://cdn.example/hk.png",
        event_series: { logo_url: "https://cdn.example/series.png" },
      }),
      "https://cdn.example/hk.png",
    );
  });

  it("falls back to series logo when edition logo is empty", () => {
    assert.equal(
      resolveEditionDisplayLogo({
        logo_url: null,
        event_series: { logo_url: "https://cdn.example/series.png" },
      }),
      "https://cdn.example/series.png",
    );
  });

  it("returns null when neither logo is set", () => {
    assert.equal(
      resolveEditionDisplayLogo({
        logo_url: "",
        event_series: { logo_url: "  " },
      }),
      null,
    );
  });
});
