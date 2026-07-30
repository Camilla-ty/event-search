import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatResearchPagePublicPath,
  formatResearchPageYearLabel,
} from "@/src/features/research-pages/lib/formatResearchPagePublicPath";

describe("formatResearchPagePublicPath", () => {
  it("builds all-years path when year is null", () => {
    assert.equal(
      formatResearchPagePublicPath("bitcoin", "asia", null),
      "/events/topics/bitcoin/regions/asia",
    );
  });

  it("appends year when provided", () => {
    assert.equal(
      formatResearchPagePublicPath("bitcoin", "asia", 2026),
      "/events/topics/bitcoin/regions/asia/2026",
    );
  });

  it("defaults to all-years when year omitted", () => {
    assert.equal(
      formatResearchPagePublicPath("blockchain", "north-america"),
      "/events/topics/blockchain/regions/north-america",
    );
  });
});

describe("formatResearchPageYearLabel", () => {
  it("labels null as All years", () => {
    assert.equal(formatResearchPageYearLabel(null), "All years");
  });

  it("labels a year as its string", () => {
    assert.equal(formatResearchPageYearLabel(2026), "2026");
  });
});
