import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  bareNoIdentityHost,
  barePlatformOwnerRootHost,
  importWebsiteMatchKey,
  normalizeWebsiteClusterKey,
} from "./importWebsiteMatchKey";

describe("importWebsiteMatchKey", () => {
  it("returns path-aware keys for Discord invite URLs", () => {
    assert.equal(
      importWebsiteMatchKey(
        "https://discord.com/invite/galactic-punks-881200105817010258",
      ),
      "website:discord.com/invite/galactic-punks-881200105817010258",
    );
  });

  it("returns path-aware keys for Beacons URLs", () => {
    assert.equal(importWebsiteMatchKey("https://beacons.ai/nftfy"), "website:beacons.ai/nftfy");
  });

  it("returns path-aware keys for games.gg URLs", () => {
    assert.equal(
      importWebsiteMatchKey("https://games.gg/sorare/"),
      "website:games.gg/sorare",
    );
  });

  it("returns path-aware keys for link3.to profile URLs", () => {
    assert.equal(importWebsiteMatchKey("https://link3.to/foo"), "website:link3.to/foo");
    assert.equal(importWebsiteMatchKey("https://www.link3.to/bar/"), "website:link3.to/bar");
  });

  it("keeps distinct keys for different link3.to profiles", () => {
    const foo = importWebsiteMatchKey("https://link3.to/foo");
    const bar = importWebsiteMatchKey("https://link3.to/bar");
    assert.notEqual(foo, bar);
  });

  it("rejects bare Discord host URLs", () => {
    assert.equal(importWebsiteMatchKey("https://discord.com"), null);
    assert.equal(importWebsiteMatchKey("https://www.discord.com/"), null);
  });

  it("rejects bare link3.to host URLs", () => {
    assert.equal(importWebsiteMatchKey("https://link3.to"), null);
    assert.equal(importWebsiteMatchKey("https://www.link3.to/"), null);
  });

  it("rejects corporate domain identities", () => {
    assert.equal(importWebsiteMatchKey("https://www.sorare.com"), null);
    assert.equal(importWebsiteMatchKey("https://acme.com/about"), null);
  });
});

describe("bareNoIdentityHost", () => {
  it("returns null for bare platform-owner roots (they are domain identities)", () => {
    assert.equal(bareNoIdentityHost("https://www.coingecko.com/"), null);
    assert.equal(bareNoIdentityHost("https://coingecko.com"), null);
    assert.equal(bareNoIdentityHost("https://www.coinmarketcap.com/"), null);
  });

  it("returns the host for other bare no_identity multi-tenant URLs", () => {
    assert.equal(bareNoIdentityHost("https://discord.com/"), "discord.com");
    assert.equal(bareNoIdentityHost("https://www.crunchbase.com/"), "crunchbase.com");
  });

  it("returns null for path-bearing no_identity URLs", () => {
    assert.equal(
      bareNoIdentityHost("https://www.coingecko.com/en/coins/bitcoin"),
      null,
    );
    assert.equal(
      bareNoIdentityHost("https://www.crunchbase.com/organization/acme"),
      null,
    );
  });

  it("returns null for identity-domain URLs", () => {
    assert.equal(bareNoIdentityHost("https://www.acme.com/"), null);
    assert.equal(bareNoIdentityHost("https://acme.com/about"), null);
  });

  it("returns the host for other bare no_identity URLs regardless of allowlist", () => {
    assert.equal(bareNoIdentityHost("https://x.com"), "x.com");
    assert.equal(bareNoIdentityHost("https://www.medium.com/"), "medium.com");
    assert.equal(bareNoIdentityHost("https://discord.com"), "discord.com");
  });
});

describe("barePlatformOwnerRootHost", () => {
  it("returns the host for bare CoinGecko and CoinMarketCap roots", () => {
    assert.equal(barePlatformOwnerRootHost("https://www.coingecko.com/"), "coingecko.com");
    assert.equal(barePlatformOwnerRootHost("https://coingecko.com"), "coingecko.com");
    assert.equal(
      barePlatformOwnerRootHost("https://www.coinmarketcap.com/"),
      "coinmarketcap.com",
    );
  });

  it("returns null for listing paths and unrelated hosts", () => {
    assert.equal(
      barePlatformOwnerRootHost("https://www.coingecko.com/en/coins/bitcoin"),
      null,
    );
    assert.equal(
      barePlatformOwnerRootHost("https://coinmarketcap.com/currencies/bitcoin/"),
      null,
    );
    assert.equal(barePlatformOwnerRootHost("https://discord.com/"), null);
    assert.equal(barePlatformOwnerRootHost("https://acme.com/"), null);
  });
});

describe("normalizeWebsiteClusterKey", () => {
  it("still clusters bare no_identity hosts for duplicate detection", () => {
    assert.equal(normalizeWebsiteClusterKey("https://discord.com"), "website:discord.com");
  });

  it("normalizes trailing slashes on path-bearing no_identity URLs", () => {
    assert.equal(
      normalizeWebsiteClusterKey("https://games.gg/game/sorare/"),
      normalizeWebsiteClusterKey("https://www.games.gg/game/sorare"),
    );
  });
});
