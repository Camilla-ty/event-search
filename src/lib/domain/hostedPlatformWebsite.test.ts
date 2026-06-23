import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  companyNeedsLogoReview,
  isHostedPlatformIdentityKey,
  isHostedPlatformWebsite,
  isSocialPlatformWebsite,
  normalizeCompanyIdentityFromWebsite,
} from "./hostedPlatformWebsite";

describe("isHostedPlatformWebsite", () => {
  it("detects OpenSea collection URLs", () => {
    assert.equal(
      isHostedPlatformWebsite("https://opensea.io/collection/nekocore"),
      true,
    );
    assert.equal(
      isHostedPlatformWebsite("https://www.opensea.io/collection/nekocore/"),
      true,
    );
  });

  it("rejects bare OpenSea hostnames", () => {
    assert.equal(isHostedPlatformWebsite("https://opensea.io/"), false);
    assert.equal(isHostedPlatformWebsite("https://www.opensea.io"), false);
  });

  it("detects Magic Eden marketplace and collections URLs", () => {
    assert.equal(
      isHostedPlatformWebsite("https://magiceden.io/marketplace/nekocore"),
      true,
    );
    assert.equal(
      isHostedPlatformWebsite("https://www.magiceden.io/collections/cryptocats"),
      true,
    );
  });

  it("rejects bare Magic Eden hostnames", () => {
    assert.equal(isHostedPlatformWebsite("https://magiceden.io/"), false);
  });

  it("detects existing social platform URLs", () => {
    assert.equal(
      isHostedPlatformWebsite("https://www.linkedin.com/company/atlantic-hpc/"),
      true,
    );
    assert.equal(isHostedPlatformWebsite("https://www.youtube.com/@somechannel"), true);
    assert.equal(isHostedPlatformWebsite("https://x.com/somecompany"), true);
    assert.equal(isHostedPlatformWebsite("https://linktr.ee/somebrand"), true);
  });

  it("rejects corporate websites", () => {
    assert.equal(isHostedPlatformWebsite("https://www.acme.com/about"), false);
  });
});

describe("isSocialPlatformWebsite", () => {
  it("still detects social URLs only", () => {
    assert.equal(
      isSocialPlatformWebsite("https://www.linkedin.com/company/atlantic-hpc/"),
      true,
    );
    assert.equal(isSocialPlatformWebsite("https://x.com/somecompany"), true);
  });

  it("does not treat Tier 1 marketplace URLs as social", () => {
    assert.equal(
      isSocialPlatformWebsite("https://opensea.io/collection/nekocore"),
      false,
    );
    assert.equal(
      isSocialPlatformWebsite("https://magiceden.io/marketplace/nekocore"),
      false,
    );
  });
});

describe("normalizeCompanyIdentityFromWebsite", () => {
  it("preserves path for OpenSea collection URLs", () => {
    assert.equal(
      normalizeCompanyIdentityFromWebsite("https://opensea.io/collection/nekocore"),
      "opensea.io/collection/nekocore",
    );
  });

  it("keeps distinct identities for different OpenSea collections", () => {
    const nekocore = normalizeCompanyIdentityFromWebsite(
      "https://opensea.io/collection/nekocore",
    );
    const cryptocats = normalizeCompanyIdentityFromWebsite(
      "https://opensea.io/collection/cryptocats",
    );
    assert.notEqual(nekocore, cryptocats);
  });

  it("preserves path for Magic Eden marketplace URLs", () => {
    assert.equal(
      normalizeCompanyIdentityFromWebsite("https://magiceden.io/marketplace/nekocore"),
      "magiceden.io/marketplace/nekocore",
    );
    assert.equal(
      normalizeCompanyIdentityFromWebsite("https://magiceden.io/collections/cryptocats"),
      "magiceden.io/collections/cryptocats",
    );
  });

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

  it("collapses bare marketplace hosts to hostname only", () => {
    assert.equal(normalizeCompanyIdentityFromWebsite("https://opensea.io/"), "opensea.io");
    assert.equal(normalizeCompanyIdentityFromWebsite("https://magiceden.io"), "magiceden.io");
  });
});

describe("isHostedPlatformIdentityKey", () => {
  it("detects stored OpenSea and Magic Eden collection identities", () => {
    assert.equal(isHostedPlatformIdentityKey("opensea.io/collection/nekocore"), true);
    assert.equal(isHostedPlatformIdentityKey("magiceden.io/marketplace/nekocore"), true);
    assert.equal(isHostedPlatformIdentityKey("magiceden.io/collections/cryptocats"), true);
  });

  it("detects stored social platform identities", () => {
    assert.equal(isHostedPlatformIdentityKey("linkedin.com/company/atlantic-hpc"), true);
    assert.equal(isHostedPlatformIdentityKey("x.com/somecompany"), true);
  });

  it("rejects hostname-only and corporate identities", () => {
    assert.equal(isHostedPlatformIdentityKey("opensea.io"), false);
    assert.equal(isHostedPlatformIdentityKey("acme.com"), false);
    assert.equal(isHostedPlatformIdentityKey("acme.com/about"), false);
  });
});

describe("companyNeedsLogoReview", () => {
  it("flags hosted-platform companies without a manual logo", () => {
    assert.equal(
      companyNeedsLogoReview({
        website: "https://www.linkedin.com/company/atlantic-hpc/",
        logo_url: null,
        logo_source: "none",
      }),
      true,
    );
    assert.equal(
      companyNeedsLogoReview({
        website: "https://opensea.io/collection/nekocore",
        logo_url: null,
        logo_source: "none",
      }),
      true,
    );
    assert.equal(
      companyNeedsLogoReview({
        website: "https://magiceden.io/marketplace/nekocore",
        logo_url: null,
        logo_source: "storage",
      }),
      true,
    );
  });

  it("clears review once logo_source is manual", () => {
    assert.equal(
      companyNeedsLogoReview({
        website: "https://opensea.io/collection/nekocore",
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
});
