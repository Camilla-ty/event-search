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
        normalized_company_name: "Unknown Sponsor LLC",
      },
      directory,
    );

    assert.equal(result.status, "needs_review");
    assert.equal(result.proposed_company_id, null);
    assert.equal(result.match_method, null);
  });

  it("community rows (null domain) never auto-match and never collapse together", () => {
    // Two unrelated communities that previously would both normalize to a bare
    // host (e.g. discord.com) now carry a null domain and cannot domain-match.
    const context = buildImportMatchContext([
      company({ id: "existing", name: "Existing Discord Co", domain: null, aliases: [] }),
    ]);

    const communityA = matchImportRowIdentity(
      { normalized_domain: null, normalized_company_name: "Community A" },
      context,
    );
    const communityB = matchImportRowIdentity(
      { normalized_domain: null, normalized_company_name: "Community B" },
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
        normalized_company_name: "Bitlifi",
      },
      context,
    );
    const fuzzySimilar = matchImportRowIdentity(
      {
        normalized_domain: "bitlifi.japan",
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
});
