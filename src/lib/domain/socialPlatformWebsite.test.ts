import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  companyNeedsLogoReview,
  isSocialPlatformWebsite,
  normalizeCompanyIdentityFromWebsite,
} from "./socialPlatformWebsite";

describe("isSocialPlatformWebsite", () => {
  it("detects LinkedIn company pages", () => {
    assert.equal(
      isSocialPlatformWebsite("https://www.linkedin.com/company/atlantic-hpc/"),
      true,
    );
  });

  it("rejects bare LinkedIn hostnames", () => {
    assert.equal(isSocialPlatformWebsite("https://www.linkedin.com/"), false);
  });

  it("detects YouTube and X profile URLs", () => {
    assert.equal(isSocialPlatformWebsite("https://www.youtube.com/@somechannel"), true);
    assert.equal(isSocialPlatformWebsite("https://x.com/somecompany"), true);
  });

  it("detects Linktree pages", () => {
    assert.equal(isSocialPlatformWebsite("https://linktr.ee/somebrand"), true);
  });

  it("rejects corporate websites", () => {
    assert.equal(isSocialPlatformWebsite("https://www.acme.com/about"), false);
  });
});

describe("normalizeCompanyIdentityFromWebsite", () => {
  it("preserves path for social URLs", () => {
    assert.equal(
      normalizeCompanyIdentityFromWebsite("https://www.linkedin.com/company/atlantic-hpc/"),
      "linkedin.com/company/atlantic-hpc",
    );
    assert.equal(
      normalizeCompanyIdentityFromWebsite("https://www.youtube.com/@somechannel"),
      "youtube.com/@somechannel",
    );
  });

  it("keeps distinct identities for different social pages", () => {
    const a = normalizeCompanyIdentityFromWebsite(
      "https://www.linkedin.com/company/atlantic-hpc/",
    );
    const b = normalizeCompanyIdentityFromWebsite(
      "https://www.linkedin.com/company/other-co/",
    );
    assert.notEqual(a, b);
  });

  it("uses hostname only for corporate websites", () => {
    assert.equal(normalizeCompanyIdentityFromWebsite("https://www.acme.com/about"), "acme.com");
  });
});

describe("companyNeedsLogoReview", () => {
  it("flags social companies without a manual logo", () => {
    assert.equal(
      companyNeedsLogoReview({
        website: "https://www.linkedin.com/company/atlantic-hpc/",
        logo_url: null,
        logo_source: "none",
      }),
      true,
    );
  });

  it("clears review once logo_source is manual", () => {
    assert.equal(
      companyNeedsLogoReview({
        website: "https://www.linkedin.com/company/atlantic-hpc/",
        logo_url: "https://cdn.example/logo.png",
        logo_source: "manual",
      }),
      false,
    );
  });

  it("ignores corporate companies", () => {
    assert.equal(
      companyNeedsLogoReview({
        website: "https://acme.com",
        logo_url: null,
        logo_source: "none",
      }),
      false,
    );
  });

  it("flags marketplace companies without a manual logo", () => {
    assert.equal(
      companyNeedsLogoReview({
        website: "https://opensea.io/collection/nekocore",
        logo_url: null,
        logo_source: "none",
      }),
      true,
    );
  });
});
