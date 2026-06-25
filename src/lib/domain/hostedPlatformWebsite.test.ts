import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  companyNeedsLogoReview,
  isCommunityPlatformWebsite,
  isHostedPlatformIdentityKey,
  isHostedPlatformWebsite,
  isSocialPlatformWebsite,
  normalizeCompanyIdentityFromWebsite,
  resolveCompanyWebsiteIdentity,
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

describe("resolveCompanyWebsiteIdentity", () => {
  it("treats Discord invite/community URLs as no_identity", () => {
    assert.deepEqual(
      resolveCompanyWebsiteIdentity("https://discord.com/invite/qx2Vy5GCZ7"),
      { status: "no_identity" },
    );
    assert.deepEqual(resolveCompanyWebsiteIdentity("https://discord.gg/qx2Vy5GCZ7"), {
      status: "no_identity",
    });
    assert.deepEqual(
      resolveCompanyWebsiteIdentity("https://discordapp.com/invite/abc"),
      { status: "no_identity" },
    );
    assert.deepEqual(resolveCompanyWebsiteIdentity("https://discord.com"), {
      status: "no_identity",
    });
  });

  it("treats Instagram, TikTok, and GitHub URLs as no_identity", () => {
    assert.deepEqual(resolveCompanyWebsiteIdentity("https://instagram.com/acme"), {
      status: "no_identity",
    });
    assert.deepEqual(resolveCompanyWebsiteIdentity("https://www.instagram.com"), {
      status: "no_identity",
    });
    assert.deepEqual(resolveCompanyWebsiteIdentity("https://tiktok.com/@acme"), {
      status: "no_identity",
    });
    assert.deepEqual(resolveCompanyWebsiteIdentity("https://github.com/acme"), {
      status: "no_identity",
    });
  });

  it("treats multi-tenant directory / publishing / link-in-bio hosts as no_identity", () => {
    for (const url of [
      "https://gitlab.com/acme",
      "https://medium.com/@acme",
      "https://www.crunchbase.com/organization/acme",
      "https://wellfound.com/company/acme",
      "https://angel.co/company/acme",
      "https://beacons.ai/acme",
      "https://bio.site/acme",
      "https://www.reddit.com/r/acme",
      "https://substack.com/@acme",
    ]) {
      assert.deepEqual(
        resolveCompanyWebsiteIdentity(url),
        { status: "no_identity" },
        `expected no_identity for ${url}`,
      );
    }
  });

  it("treats bare social hosts as no_identity but keeps path-aware handles", () => {
    for (const bare of [
      "https://x.com",
      "https://twitter.com/",
      "https://www.facebook.com",
      "https://youtube.com/",
    ]) {
      assert.deepEqual(
        resolveCompanyWebsiteIdentity(bare),
        { status: "no_identity" },
        `expected no_identity for bare ${bare}`,
      );
    }
    // Path-bearing handles keep their existing path-aware identity.
    assert.deepEqual(resolveCompanyWebsiteIdentity("https://x.com/acme"), {
      status: "domain",
      domain: "x.com/acme",
    });
    assert.deepEqual(resolveCompanyWebsiteIdentity("https://www.youtube.com/@acme"), {
      status: "domain",
      domain: "youtube.com/@acme",
    });
  });

  it("keeps publishing subdomains as distinct identities (not collapsed to the root)", () => {
    assert.deepEqual(resolveCompanyWebsiteIdentity("https://acme.substack.com"), {
      status: "domain",
      domain: "acme.substack.com",
    });
    assert.deepEqual(resolveCompanyWebsiteIdentity("https://acme.medium.com"), {
      status: "domain",
      domain: "acme.medium.com",
    });
  });

  it("preserves website while producing no domain for two different directory profiles", () => {
    // Two distinct companies on the same directory host must NOT collapse to a
    // shared bare-host identity key.
    const a = normalizeCompanyIdentityFromWebsite("https://www.crunchbase.com/organization/alpha");
    const b = normalizeCompanyIdentityFromWebsite("https://www.crunchbase.com/organization/beta");
    assert.equal(a, "");
    assert.equal(b, "");
  });

  it("treats LinkedIn personal profiles and bare host as no_identity", () => {
    assert.deepEqual(resolveCompanyWebsiteIdentity("https://www.linkedin.com/in/jane"), {
      status: "no_identity",
    });
    assert.deepEqual(resolveCompanyWebsiteIdentity("https://linkedin.com"), {
      status: "no_identity",
    });
  });

  it("keeps LinkedIn company pages as a path-aware identity", () => {
    assert.deepEqual(
      resolveCompanyWebsiteIdentity("https://www.linkedin.com/company/atlantic-hpc/"),
      { status: "domain", domain: "linkedin.com/company/atlantic-hpc" },
    );
  });

  it("applies B1 Telegram rules: handles keep identity, invites do not", () => {
    assert.deepEqual(resolveCompanyWebsiteIdentity("https://t.me/acmecorp"), {
      status: "domain",
      domain: "t.me/acmecorp",
    });
    assert.deepEqual(resolveCompanyWebsiteIdentity("https://telegram.me/acmecorp"), {
      status: "domain",
      domain: "telegram.me/acmecorp",
    });
    assert.deepEqual(resolveCompanyWebsiteIdentity("https://t.me/+AbC123xyz"), {
      status: "no_identity",
    });
    assert.deepEqual(resolveCompanyWebsiteIdentity("https://t.me/joinchat/AbC123"), {
      status: "no_identity",
    });
  });

  it("keeps corporate and existing hosted identities unchanged", () => {
    assert.deepEqual(resolveCompanyWebsiteIdentity("https://www.acme.com/about"), {
      status: "domain",
      domain: "acme.com",
    });
    assert.deepEqual(resolveCompanyWebsiteIdentity("https://x.com/somecompany"), {
      status: "domain",
      domain: "x.com/somecompany",
    });
    assert.deepEqual(
      resolveCompanyWebsiteIdentity("https://opensea.io/collection/nekocore"),
      { status: "domain", domain: "opensea.io/collection/nekocore" },
    );
  });

  it("treats empty input as unparseable", () => {
    assert.deepEqual(resolveCompanyWebsiteIdentity(""), { status: "unparseable" });
    assert.deepEqual(resolveCompanyWebsiteIdentity("   "), { status: "unparseable" });
  });

  it("normalizeCompanyIdentityFromWebsite returns empty for community URLs", () => {
    assert.equal(
      normalizeCompanyIdentityFromWebsite("https://discord.com/invite/abc"),
      "",
    );
    assert.equal(normalizeCompanyIdentityFromWebsite("https://instagram.com/acme"), "");
    assert.equal(normalizeCompanyIdentityFromWebsite("https://www.acme.com/about"), "acme.com");
  });
});

describe("isCommunityPlatformWebsite", () => {
  it("matches the non-identity platforms", () => {
    assert.equal(isCommunityPlatformWebsite("https://discord.gg/abc"), true);
    assert.equal(isCommunityPlatformWebsite("https://instagram.com/acme"), true);
    assert.equal(isCommunityPlatformWebsite("https://github.com/acme"), true);
    assert.equal(isCommunityPlatformWebsite("https://gitlab.com/acme"), true);
    assert.equal(isCommunityPlatformWebsite("https://medium.com/@acme"), true);
    assert.equal(isCommunityPlatformWebsite("https://beacons.ai/acme"), true);
    assert.equal(isCommunityPlatformWebsite("https://www.crunchbase.com/organization/acme"), true);
    assert.equal(isCommunityPlatformWebsite("https://x.com"), true);
    assert.equal(isCommunityPlatformWebsite("https://www.linkedin.com/in/jane"), true);
    assert.equal(isCommunityPlatformWebsite("https://t.me/+invite"), true);
  });

  it("does not match corporate or path-aware hosted identities", () => {
    assert.equal(isCommunityPlatformWebsite("https://acme.com"), false);
    assert.equal(
      isCommunityPlatformWebsite("https://www.linkedin.com/company/atlantic-hpc/"),
      false,
    );
    assert.equal(isCommunityPlatformWebsite("https://t.me/acmecorp"), false);
    assert.equal(isCommunityPlatformWebsite("https://opensea.io/collection/nekocore"), false);
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
