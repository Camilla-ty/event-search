import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildImportMatchContext,
  findExactAliasOnCompany,
  matchImportRowIdentity,
  type ImportMatchCompany,
} from "@/src/lib/companies/companyImportMatching";

function company(overrides: Partial<ImportMatchCompany> & Pick<ImportMatchCompany, "id">): ImportMatchCompany {
  return {
    name: "Keel Infrastructure",
    domain: "keelinfra.com",
    website: null,
    aliases: ["Bitfarms"],
    ...overrides,
  };
}

const directory = buildImportMatchContext([
  company({ id: "keel-id" }),
  company({
    id: "other-id",
    name: "Other Corp",
    domain: "other.com",
    aliases: [],
  }),
]);

describe("companyImportMatching", () => {
  it("auto_ready on exact domain with exact canonical name", () => {
    const result = matchImportRowIdentity(
      {
        normalized_domain: "keelinfra.com",
        normalized_website: null,
        normalized_company_name: "Keel Infrastructure",
      },
      directory,
    );

    assert.equal(result.status, "auto_ready");
    assert.equal(result.match_method, "domain");
    assert.equal(result.proposed_company_id, "keel-id");
  });

  it("auto_ready on domain plus exact alias name", () => {
    const result = matchImportRowIdentity(
      {
        normalized_domain: "keelinfra.com",
        normalized_website: null,
        normalized_company_name: "Bitfarms",
      },
      directory,
    );

    assert.equal(result.status, "auto_ready");
    assert.equal(result.match_method, "alias");
    assert.equal(result.proposed_company_id, "keel-id");
    assert.equal(findExactAliasOnCompany("Bitfarms", company({ id: "x" })), "Bitfarms");
  });

  it("needs_review on domain with unrelated name", () => {
    const result = matchImportRowIdentity(
      {
        normalized_domain: "keelinfra.com",
        normalized_website: null,
        normalized_company_name: "Totally Different Co",
      },
      directory,
    );

    assert.equal(result.status, "needs_review");
    assert.equal(result.conflict_type, "domain_name_mismatch");
    assert.equal(result.proposed_company_id, "keel-id");
  });

  it("needs_review on fuzzy name similarity without exact match", () => {
    const result = matchImportRowIdentity(
      {
        normalized_domain: null,
        normalized_website: null,
        normalized_company_name: "Keel",
      },
      directory,
    );

    assert.equal(result.status, "needs_review");
    assert.equal(result.proposed_company_id, null);
    assert.equal(result.match_method, null);
  });

  it("needs_review on exact canonical name without domain", () => {
    const result = matchImportRowIdentity(
      {
        normalized_domain: null,
        normalized_website: null,
        normalized_company_name: "Keel Infrastructure",
      },
      directory,
    );

    assert.equal(result.status, "needs_review");
    assert.equal(result.match_method, "exact_name");
    assert.equal(result.match_confidence, null);
    assert.equal(result.proposed_company_id, "keel-id");
    assert.equal(result.conflict_type, null);
  });

  it("needs_review on exact alias without domain", () => {
    const result = matchImportRowIdentity(
      {
        normalized_domain: null,
        normalized_website: null,
        normalized_company_name: "Bitfarms",
      },
      directory,
    );

    assert.equal(result.status, "needs_review");
    assert.equal(result.match_method, "alias");
    assert.equal(result.match_confidence, null);
    assert.equal(result.proposed_company_id, "keel-id");
    assert.equal(result.conflict_type, null);
  });

  it("needs_review when multiple companies share a domain", () => {
    const context = buildImportMatchContext([
      company({ id: "a", domain: "shared.com" }),
      company({ id: "b", name: "Shared Two", domain: "shared.com", aliases: [] }),
    ]);

    const result = matchImportRowIdentity(
      {
        normalized_domain: "shared.com",
        normalized_website: null,
        normalized_company_name: "Anything",
      },
      context,
    );

    assert.equal(result.status, "needs_review");
    assert.equal(result.conflict_type, "multiple_candidates");
  });

  it("needs_review with no proposal when there is no match", () => {
    const result = matchImportRowIdentity(
      {
        normalized_domain: null,
        normalized_website: null,
        normalized_company_name: "Unknown Sponsor LLC",
      },
      directory,
    );

    assert.equal(result.status, "needs_review");
    assert.equal(result.proposed_company_id, null);
    assert.equal(result.match_method, null);
  });

  it("community rows without matching catalog website do not auto-match", () => {
    const context = buildImportMatchContext([
      company({ id: "existing", name: "Existing Discord Co", domain: null, aliases: [] }),
    ]);

    const communityA = matchImportRowIdentity(
      {
        normalized_domain: null,
        normalized_website: "https://discord.com/invite/example-a",
        normalized_company_name: "Community A",
      },
      context,
    );
    const communityB = matchImportRowIdentity(
      {
        normalized_domain: null,
        normalized_website: "https://discord.com/invite/example-b",
        normalized_company_name: "Community B",
      },
      context,
    );

    assert.equal(communityA.status, "needs_review");
    assert.equal(communityA.match_method, null);
    assert.equal(communityB.status, "needs_review");
    assert.equal(communityB.match_method, null);
  });

  it("auto_ready on exact company_domains.domain when primary companies.domain differs", () => {
    const context = buildImportMatchContext(
      [
        company({
          id: "bitlifi-id",
          name: "Bitlifi",
          domain: "bitlifi.com",
          aliases: [],
        }),
      ],
      [{ company_id: "bitlifi-id", domain: "bitlifi.jp" }],
    );

    const result = matchImportRowIdentity(
      {
        normalized_domain: "bitlifi.jp",
        normalized_website: null,
        normalized_company_name: "Bitlifi",
      },
      context,
    );

    assert.equal(result.status, "auto_ready");
    assert.equal(result.match_method, "domain");
    assert.equal(result.proposed_company_id, "bitlifi-id");
  });

  it("still auto_ready on primary companies.domain", () => {
    const context = buildImportMatchContext(
      [
        company({
          id: "bitlifi-id",
          name: "Bitlifi",
          domain: "bitlifi.com",
          aliases: [],
        }),
      ],
      [{ company_id: "bitlifi-id", domain: "bitlifi.jp" }],
    );

    const result = matchImportRowIdentity(
      {
        normalized_domain: "bitlifi.com",
        normalized_website: null,
        normalized_company_name: "Bitlifi",
      },
      context,
    );

    assert.equal(result.status, "auto_ready");
    assert.equal(result.match_method, "domain");
    assert.equal(result.proposed_company_id, "bitlifi-id");
  });

  it("does not auto-match similar but unstored domains", () => {
    const context = buildImportMatchContext(
      [
        company({
          id: "bitlifi-id",
          name: "Bitlifi",
          domain: "bitlifi.com",
          aliases: [],
        }),
      ],
      [{ company_id: "bitlifi-id", domain: "bitlifi.jp" }],
    );

    const unstoredTld = matchImportRowIdentity(
      {
        normalized_domain: "bitlifi.de",
        normalized_website: null,
        normalized_company_name: "Bitlifi",
      },
      context,
    );
    const fuzzySimilar = matchImportRowIdentity(
      {
        normalized_domain: "bitlifi.japan",
        normalized_website: null,
        normalized_company_name: "Bitlifi Japan GmbH",
      },
      context,
    );

    assert.equal(unstoredTld.status, "needs_review");
    assert.notEqual(unstoredTld.match_confidence, "high");
    assert.equal(unstoredTld.proposed_company_id, "bitlifi-id");
    assert.equal(unstoredTld.match_confidence, null);
    assert.equal(fuzzySimilar.status, "needs_review");
    assert.equal(fuzzySimilar.match_method, null);
    assert.equal(fuzzySimilar.proposed_company_id, null);
  });

  it("needs_review when company_domains and companies.domain disagree on owner", () => {
    const context = buildImportMatchContext(
      [
        company({ id: "a", name: "Company A", domain: "shared.jp", aliases: [] }),
        company({ id: "b", name: "Company B", domain: null, aliases: [] }),
      ],
      [{ company_id: "b", domain: "shared.jp" }],
    );

    const result = matchImportRowIdentity(
      {
        normalized_domain: "shared.jp",
        normalized_website: null,
        normalized_company_name: "Company A",
      },
      context,
    );

    assert.equal(result.status, "needs_review");
    assert.equal(result.conflict_type, "multiple_candidates");
    assert.equal(result.match_method, null);
  });

  it("dedupes company_domains row when domain already indexed from companies.domain", () => {
    const context = buildImportMatchContext(
      [
        company({
          id: "bitlifi-id",
          name: "Bitlifi",
          domain: "bitlifi.com",
          aliases: [],
        }),
      ],
      [{ company_id: "bitlifi-id", domain: "bitlifi.com" }],
    );

    const candidates = context.companiesByDomain.get("bitlifi.com") ?? [];
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0]?.id, "bitlifi-id");
  });

  it("auto_ready on exact no_identity website match (Discord)", () => {
    const discordUrl = "https://discord.com/invite/galactic-punks-881200105817010258";
    const context = buildImportMatchContext([
      company({
        id: "galacticpunks-id",
        name: "Galacticpunks",
        domain: null,
        website: discordUrl,
        aliases: [],
      }),
    ]);

    const result = matchImportRowIdentity(
      {
        normalized_domain: null,
        normalized_website: discordUrl,
        normalized_company_name: "Galacticpunks",
      },
      context,
    );

    assert.equal(result.status, "auto_ready");
    assert.equal(result.match_method, "website");
    assert.equal(result.proposed_company_id, "galacticpunks-id");
  });

  it("auto_ready on exact no_identity website match (Beacons)", () => {
    const beaconsUrl = "https://beacons.ai/nftfy";
    const context = buildImportMatchContext([
      company({
        id: "nftfy-id",
        name: "NFTFY",
        domain: null,
        website: beaconsUrl,
        aliases: [],
      }),
    ]);

    const result = matchImportRowIdentity(
      {
        normalized_domain: null,
        normalized_website: beaconsUrl,
        normalized_company_name: "NFTFY",
      },
      context,
    );

    assert.equal(result.status, "auto_ready");
    assert.equal(result.match_method, "website");
    assert.equal(result.proposed_company_id, "nftfy-id");
  });

  it("auto_ready on exact no_identity website match (games.gg)", () => {
    const gamesUrl = "https://games.gg/sorare/";
    const context = buildImportMatchContext([
      company({
        id: "sorare-id",
        name: "Sorare",
        domain: null,
        website: "https://games.gg/sorare",
        aliases: [],
      }),
    ]);

    const result = matchImportRowIdentity(
      {
        normalized_domain: null,
        normalized_website: gamesUrl,
        normalized_company_name: "Sorare",
      },
      context,
    );

    assert.equal(result.status, "auto_ready");
    assert.equal(result.match_method, "website");
    assert.equal(result.proposed_company_id, "sorare-id");
  });

  it("auto_ready on exact no_identity website match (link3.to)", () => {
    const link3Url = "https://link3.to/example";
    const context = buildImportMatchContext([
      company({
        id: "example-id",
        name: "Example Co",
        domain: null,
        website: link3Url,
        aliases: [],
      }),
    ]);

    const result = matchImportRowIdentity(
      {
        normalized_domain: null,
        normalized_website: link3Url,
        normalized_company_name: "Example Co",
      },
      context,
    );

    assert.equal(result.status, "auto_ready");
    assert.equal(result.match_method, "website");
    assert.equal(result.proposed_company_id, "example-id");
  });

  it("does not domain-match rows that only share polluted link3.to catalog domain", () => {
    const context = buildImportMatchContext([
      company({
        id: "polluted-id",
        name: "Polluted Co",
        domain: "link3.to",
        website: "https://link3.to/foo",
        aliases: [],
      }),
    ]);

    const result = matchImportRowIdentity(
      {
        normalized_domain: null,
        normalized_website: "https://link3.to/bar",
        normalized_company_name: "Different Co",
      },
      context,
    );

    assert.notEqual(result.match_method, "domain");
    assert.equal(result.status, "needs_review");
  });

  it("does not domain-match link3.to profiles that share only the host", () => {
    const context = buildImportMatchContext([
      company({
        id: "foo-id",
        name: "Foo Project",
        domain: null,
        website: "https://link3.to/foo",
        aliases: [],
      }),
      company({
        id: "bar-id",
        name: "Bar Project",
        domain: null,
        website: "https://link3.to/bar",
        aliases: [],
      }),
    ]);

    const fooMatch = matchImportRowIdentity(
      {
        normalized_domain: null,
        normalized_website: "https://link3.to/foo",
        normalized_company_name: "Foo Project",
      },
      context,
    );
    const barMatch = matchImportRowIdentity(
      {
        normalized_domain: null,
        normalized_website: "https://link3.to/bar",
        normalized_company_name: "Bar Project",
      },
      context,
    );

    assert.equal(fooMatch.status, "auto_ready");
    assert.equal(fooMatch.match_method, "website");
    assert.equal(fooMatch.proposed_company_id, "foo-id");
    assert.equal(barMatch.status, "auto_ready");
    assert.equal(barMatch.match_method, "website");
    assert.equal(barMatch.proposed_company_id, "bar-id");
  });

  it("does not website-match bare Discord host URLs", () => {
    const context = buildImportMatchContext([
      company({
        id: "galacticpunks-id",
        name: "Galacticpunks",
        domain: null,
        website: "https://discord.com/invite/galactic-punks-881200105817010258",
        aliases: [],
      }),
    ]);

    const result = matchImportRowIdentity(
      {
        normalized_domain: null,
        normalized_website: "https://discord.com",
        normalized_company_name: "Galacticpunks",
      },
      context,
    );

    assert.equal(result.status, "needs_review");
    assert.equal(result.match_method, "exact_name");
    assert.equal(result.proposed_company_id, "galacticpunks-id");
  });

  it("does not website-match bare link3.to host URLs", () => {
    const context = buildImportMatchContext([
      company({
        id: "example-id",
        name: "Example Co",
        domain: null,
        website: "https://link3.to/example",
        aliases: [],
      }),
    ]);

    const result = matchImportRowIdentity(
      {
        normalized_domain: null,
        normalized_website: "https://link3.to",
        normalized_company_name: "Example Co",
      },
      context,
    );

    assert.equal(result.status, "needs_review");
    assert.equal(result.match_method, "exact_name");
    assert.equal(result.proposed_company_id, "example-id");
  });

  it("prefers domain match when normalized_domain is present", () => {
    const result = matchImportRowIdentity(
      {
        normalized_domain: "keelinfra.com",
        normalized_website: "https://keelinfra.com",
        normalized_company_name: "Keel Infrastructure",
      },
      directory,
    );

    assert.equal(result.status, "auto_ready");
    assert.equal(result.match_method, "domain");
  });

  it("needs_review on website match with name mismatch", () => {
    const beaconsUrl = "https://beacons.ai/nftfy";
    const context = buildImportMatchContext([
      company({
        id: "nftfy-id",
        name: "NFTFY",
        domain: null,
        website: beaconsUrl,
        aliases: [],
      }),
    ]);

    const result = matchImportRowIdentity(
      {
        normalized_domain: null,
        normalized_website: beaconsUrl,
        normalized_company_name: "Totally Different Co",
      },
      context,
    );

    assert.equal(result.status, "needs_review");
    assert.equal(result.conflict_type, "domain_name_mismatch");
    assert.equal(result.proposed_company_id, "nftfy-id");
    assert.equal(result.match_method, null);
  });

  it("falls back to exact_name when catalog website URL differs", () => {
    const context = buildImportMatchContext([
      company({
        id: "sorare-id",
        name: "Sorare",
        domain: "sorare.com",
        website: "https://www.sorare.com",
        aliases: [],
      }),
    ]);

    const result = matchImportRowIdentity(
      {
        normalized_domain: null,
        normalized_website: "https://games.gg/sorare",
        normalized_company_name: "Sorare",
      },
      context,
    );

    assert.equal(result.status, "needs_review");
    assert.equal(result.match_method, "exact_name");
    assert.equal(result.proposed_company_id, "sorare-id");
  });
});

describe("bare platform owner primary-domain fallback", () => {
  const COINGECKO_ID = "2d81d427-ad48-4e4f-8217-95fc50487f2a";

  function coingeckoContext(overrides: Partial<ImportMatchCompany> = {}) {
    return buildImportMatchContext(
      [
        company({
          id: COINGECKO_ID,
          name: "CoinGecko",
          domain: "coingecko.com",
          website: "https://www.coingecko.com/",
          aliases: ["CG"],
          ...overrides,
        }),
      ],
      [
        { company_id: COINGECKO_ID, domain: "coingecko.com" },
        { company_id: COINGECKO_ID, domain: "coingecko" },
      ],
    );
  }

  it("auto_ready on bare CoinGecko URL with exact company name", () => {
    for (const website of ["https://www.coingecko.com/", "https://coingecko.com"]) {
      const result = matchImportRowIdentity(
        {
          normalized_domain: null,
          normalized_website: website,
          normalized_company_name: "CoinGecko",
        },
        coingeckoContext(),
      );

      assert.equal(result.status, "auto_ready", website);
      assert.equal(result.match_method, "domain", website);
      assert.equal(result.match_confidence, "high", website);
      assert.equal(result.proposed_company_id, COINGECKO_ID, website);
      assert.equal(result.conflict_type, null, website);
    }
  });

  it("auto_ready on bare CoinGecko URL with exact alias", () => {
    const result = matchImportRowIdentity(
      {
        normalized_domain: null,
        normalized_website: "https://www.coingecko.com/",
        normalized_company_name: "CG",
      },
      coingeckoContext(),
    );

    assert.equal(result.status, "auto_ready");
    assert.equal(result.match_method, "alias");
    assert.equal(result.proposed_company_id, COINGECKO_ID);
  });

  it("falls through on bare CoinGecko URL with mismatched name", () => {
    const result = matchImportRowIdentity(
      {
        normalized_domain: null,
        normalized_website: "https://www.coingecko.com/",
        normalized_company_name: "SomeToken",
      },
      coingeckoContext(),
    );

    assert.equal(result.status, "needs_review");
    assert.equal(result.match_method, null);
    assert.equal(result.proposed_company_id, null);
    assert.equal(result.conflict_type, null);
  });

  it("falls through on bare CoinGecko URL with empty name", () => {
    const result = matchImportRowIdentity(
      {
        normalized_domain: null,
        normalized_website: "https://www.coingecko.com/",
        normalized_company_name: "",
      },
      coingeckoContext(),
    );

    assert.equal(result.status, "needs_review");
    assert.equal(result.match_method, null);
    assert.equal(result.proposed_company_id, null);
  });

  it("does not apply fallback to path-bearing CoinGecko listing URLs", () => {
    const result = matchImportRowIdentity(
      {
        normalized_domain: null,
        normalized_website: "https://www.coingecko.com/en/coins/bitcoin",
        normalized_company_name: "CoinGecko",
      },
      coingeckoContext(),
    );

    assert.equal(result.status, "needs_review");
    assert.equal(result.match_method, "exact_name");
    assert.equal(result.proposed_company_id, COINGECKO_ID);
  });

  it("does not apply fallback when host is only in company_domains", () => {
    const context = buildImportMatchContext(
      [company({ id: COINGECKO_ID, name: "CoinGecko", domain: null, aliases: [] })],
      [{ company_id: COINGECKO_ID, domain: "coingecko.com" }],
    );

    const result = matchImportRowIdentity(
      {
        normalized_domain: null,
        normalized_website: "https://www.coingecko.com/",
        normalized_company_name: "CoinGecko",
      },
      context,
    );

    assert.equal(result.status, "needs_review");
    assert.equal(result.match_method, "exact_name");
    assert.equal(result.proposed_company_id, COINGECKO_ID);
  });

  it("falls through when multiple companies share the primary domain", () => {
    const context = buildImportMatchContext([
      company({ id: "a", name: "CoinGecko", domain: "coingecko.com", aliases: [] }),
      company({ id: "b", name: "CoinGecko Clone", domain: "coingecko.com", aliases: [] }),
    ]);

    const result = matchImportRowIdentity(
      {
        normalized_domain: null,
        normalized_website: "https://www.coingecko.com/",
        normalized_company_name: "CoinGecko",
      },
      context,
    );

    assert.equal(result.status, "needs_review");
    assert.equal(result.match_method, "exact_name");
    assert.equal(result.proposed_company_id, "a");
    assert.equal(result.conflict_type, null);
  });

  it("does not apply fallback for bare x.com URLs", () => {
    const context = buildImportMatchContext([
      company({
        id: "x-owner",
        name: "X Corp",
        domain: "x.com",
        website: "https://x.com",
        aliases: [],
      }),
    ]);

    const result = matchImportRowIdentity(
      {
        normalized_domain: null,
        normalized_website: "https://x.com",
        normalized_company_name: "X Corp",
      },
      context,
    );

    assert.equal(result.status, "needs_review");
    assert.equal(result.match_method, "exact_name");
    assert.equal(result.proposed_company_id, "x-owner");
  });

  it("does not apply fallback for bare medium.com URLs", () => {
    const context = buildImportMatchContext([
      company({
        id: "medium-owner",
        name: "Medium",
        domain: "medium.com",
        website: "https://medium.com",
        aliases: [],
      }),
    ]);

    const result = matchImportRowIdentity(
      {
        normalized_domain: null,
        normalized_website: "https://www.medium.com/",
        normalized_company_name: "Medium",
      },
      context,
    );

    assert.equal(result.status, "needs_review");
    assert.equal(result.match_method, "exact_name");
    assert.equal(result.proposed_company_id, "medium-owner");
  });

  it("auto_ready on bare CoinMarketCap URL with exact company name", () => {
    const context = buildImportMatchContext([
      company({
        id: "cmc-id",
        name: "CoinMarketCap",
        domain: "coinmarketcap.com",
        website: "https://coinmarketcap.com/",
        aliases: [],
      }),
    ]);

    const result = matchImportRowIdentity(
      {
        normalized_domain: null,
        normalized_website: "https://www.coinmarketcap.com/",
        normalized_company_name: "CoinMarketCap",
      },
      context,
    );

    assert.equal(result.status, "auto_ready");
    assert.equal(result.match_method, "domain");
    assert.equal(result.proposed_company_id, "cmc-id");
  });

  it("prefers normal domain matching when normalized_domain is present", () => {
    const result = matchImportRowIdentity(
      {
        normalized_domain: "coingecko.com",
        normalized_website: "https://www.coingecko.com/",
        normalized_company_name: "CoinGecko",
      },
      coingeckoContext(),
    );

    assert.equal(result.status, "auto_ready");
    assert.equal(result.match_method, "domain");
    assert.equal(result.proposed_company_id, COINGECKO_ID);
  });
});
