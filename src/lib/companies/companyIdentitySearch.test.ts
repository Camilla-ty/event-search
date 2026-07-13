import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  companyMatchesAdminSearch,
  rankCompanySearchHits,
  resolveSearchMatchHint,
  scoreCompanyIdentityMatch,
} from "@/src/lib/companies/companyIdentitySearch";
import type { CompanyIdentitySearchFields } from "@/src/lib/companies/companyIdentitySearch";

function company(
  overrides: Partial<CompanyIdentitySearchFields> & Pick<CompanyIdentitySearchFields, "id" | "name">,
): CompanyIdentitySearchFields {
  return {
    slug: "keel-infrastructure",
    domain: "keelinfra.com",
    website: "https://keelinfra.com",
    aliases: ["Bitfarms"],
    ...overrides,
  };
}

const keel = company({
  id: "keel-id",
  name: "Keel Infrastructure",
  slug: "keel-infrastructure",
  domain: "keelinfra.com",
  aliases: ["Bitfarms"],
});

describe("companyIdentitySearch", () => {
  it("matches canonical name search", () => {
    assert.equal(companyMatchesAdminSearch(keel, "Keel"), true);
    assert.equal(scoreCompanyIdentityMatch(keel, "Keel")?.match_kind, "name_prefix");
    assert.deepEqual(resolveSearchMatchHint(keel, "Keel Infrastructure"), {
      matched_alias: null,
    });
  });

  it("matches alias search and returns alias hint", () => {
    assert.equal(companyMatchesAdminSearch(keel, "Bitfarms"), true);
    assert.equal(scoreCompanyIdentityMatch(keel, "Bitfarms")?.match_kind, "exact_alias");
    assert.deepEqual(resolveSearchMatchHint(keel, "Bitfarms"), {
      matched_alias: "Bitfarms",
    });
  });

  it("matches domain search", () => {
    assert.equal(companyMatchesAdminSearch(keel, "keelinfra.com"), true);
    assert.equal(scoreCompanyIdentityMatch(keel, "keelinfra.com")?.match_kind, "exact_domain");
    assert.deepEqual(resolveSearchMatchHint(keel, "keelinfra.com"), {
      matched_alias: null,
    });
  });

  it("matches slug search", () => {
    assert.equal(companyMatchesAdminSearch(keel, "keel-infrastructure"), true);
    assert.equal(
      scoreCompanyIdentityMatch(keel, "keel-infrastructure")?.match_kind,
      "slug_substring",
    );
  });

  it("ranks stronger identity matches ahead of weaker ones", () => {
    const weaker = company({
      id: "weaker-id",
      name: "Keel Partners",
      slug: "keel-partners",
      domain: "keelpartners.com",
      website: "https://keelpartners.com",
      aliases: [],
    });

    const ranked = rankCompanySearchHits([weaker, keel], "keelinfra.com");
    assert.equal(ranked.length, 1);
    assert.equal(ranked[0]?.company.id, "keel-id");
    assert.equal(ranked[0]?.match_kind, "exact_domain");
  });

  it("ranks exact name above substring name matches", () => {
    const exact = company({
      id: "exact-id",
      name: "Keel",
      slug: "keel",
      domain: "keel.com",
      aliases: [],
    });
    const partial = company({
      id: "partial-id",
      name: "Keel Infrastructure Group",
      slug: "keel-infrastructure-group",
      domain: "keelgroup.com",
      aliases: [],
    });

    const ranked = rankCompanySearchHits([partial, exact], "Keel");
    assert.equal(ranked[0]?.company.id, "exact-id");
    assert.equal(ranked[1]?.company.id, "partial-id");
  });

  it("returns matched alias hint only for alias-driven hits in ranked results", () => {
    const ranked = rankCompanySearchHits([keel], "Bitfarms");
    assert.equal(ranked[0]?.company.name, "Keel Infrastructure");
    assert.equal(ranked[0]?.matched_alias, "Bitfarms");
  });

  it("matches non-primary verified domain from company_domains", () => {
    const withAliasDomain = company({
      id: "alias-domain-id",
      name: "Acme Holdings",
      slug: "acme-holdings",
      domain: "acme.com",
      website: "https://acme.com",
      aliases: [],
      verified_domains: ["legacy-acme.com"],
    });

    assert.equal(companyMatchesAdminSearch(withAliasDomain, "legacy-acme.com"), true);
    assert.equal(
      scoreCompanyIdentityMatch(withAliasDomain, "legacy-acme.com")?.match_kind,
      "exact_domain",
    );
  });

  it("matches primary companies.domain before weaker verified-domain substring hits", () => {
    const primary = company({
      id: "primary-id",
      name: "Acme",
      slug: "acme",
      domain: "acme.com",
      website: "https://acme.com",
      aliases: [],
      verified_domains: ["shop.acme.com"],
    });

    const ranked = rankCompanySearchHits([primary], "acme.com");
    assert.equal(ranked.length, 1);
    assert.equal(ranked[0]?.match_kind, "exact_domain");
  });
});
