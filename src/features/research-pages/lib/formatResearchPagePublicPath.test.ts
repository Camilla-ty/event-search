import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatResearchPagePublicPath,
  formatResearchPageYearLabel,
} from "@/src/features/research-pages/lib/formatResearchPagePublicPath";

const ASIA = { type: "region" as const, slug: "asia" };
const SINGAPORE = { type: "country" as const, slug: "singapore" };

describe("formatResearchPagePublicPath", () => {
  it("builds all-years path when year is null", () => {
    assert.equal(
      formatResearchPagePublicPath("crypto-blockchain", ASIA, null),
      "/events/topics/crypto-blockchain/regions/asia",
    );
  });

  it("appends /years/{year} when year is provided", () => {
    assert.equal(
      formatResearchPagePublicPath("crypto-blockchain", ASIA, 2026),
      "/events/topics/crypto-blockchain/regions/asia/years/2026",
    );
  });

  it("defaults to all-years when year omitted", () => {
    assert.equal(
      formatResearchPagePublicPath("fintech", {
        type: "region",
        slug: "north-america",
      }),
      "/events/topics/fintech/regions/north-america",
    );
  });

  it("uses the countries segment for country locations", () => {
    assert.equal(
      formatResearchPagePublicPath("crypto-blockchain", SINGAPORE, null),
      "/events/topics/crypto-blockchain/countries/singapore",
    );
    assert.equal(
      formatResearchPagePublicPath("crypto-blockchain", SINGAPORE, 2026),
      "/events/topics/crypto-blockchain/countries/singapore/years/2026",
    );
  });

  it("keeps region and country namespaces distinct for the same slug", () => {
    const slug = "asia";
    assert.notEqual(
      formatResearchPagePublicPath("ai", { type: "region", slug }),
      formatResearchPagePublicPath("ai", { type: "country", slug }),
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
