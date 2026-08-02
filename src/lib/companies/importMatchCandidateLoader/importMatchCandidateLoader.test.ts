import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildImportMatchContext,
  matchImportRowIdentity,
} from "@/src/lib/companies/companyImportMatching";
import {
  createMemoryImportMatchCandidateSource,
  extractImportMatchLookupKeys,
  loadImportMatchContextFromCandidateCatalog,
  loadImportMatchContextFromCandidateSource,
  resolveImportMatchCandidateCompanyIds,
  selectImportMatchCandidateCatalog,
  sortImportMatchCompanies,
} from "@/src/lib/companies/importMatchCandidateLoader";
import type { ImportMatchCompanyCatalog } from "@/src/lib/companies/importMatchCandidateLoader";
import { listImportMatchCandidateCompanyIds } from "@/src/lib/companies/importMatchParity/candidates";

const CATALOG: ImportMatchCompanyCatalog = {
  companies: sortImportMatchCompanies([
    {
      id: "keel-id",
      name: "Keel Infrastructure",
      domain: "keelinfra.com",
      website: "https://keelinfra.com",
      aliases: ["Bitfarms", "Keel Infra"],
    },
    {
      id: "other-id",
      name: "Other Corp",
      domain: "other.com",
      website: null,
      aliases: [],
    },
    {
      id: "galacticpunks-id",
      name: "Galacticpunks",
      domain: null,
      website: "https://discord.com/invite/galactic-punks-881200105817010258",
      aliases: [],
    },
    {
      id: "coingecko-id",
      name: "CoinGecko",
      domain: "coingecko.com",
      website: "https://www.coingecko.com/",
      aliases: ["CG"],
    },
  ]),
  companyDomains: [
    { company_id: "keel-id", domain: "keelinfra.com" },
    { company_id: "keel-id", domain: "keelinfra.io" },
    { company_id: "other-id", domain: "other.com" },
    { company_id: "coingecko-id", domain: "coingecko.com" },
    // Inactive / missing owner — must not become a candidate.
    { company_id: "inactive-id", domain: "inactiveco.com" },
  ],
};

describe("importMatchCandidateLoader keys + catalog", () => {
  it("extracts deterministic sorted lookup keys", () => {
    const keys = extractImportMatchLookupKeys([
      {
        normalized_domain: "KeelInfra.COM",
        normalized_website: "https://ignored-when-domain-present.example",
        normalized_company_name: "Keel Infrastructure",
      },
      {
        normalized_domain: null,
        normalized_website: "https://discord.com/invite/galactic-punks-881200105817010258",
        normalized_company_name: "Galacticpunks",
      },
    ]);

    assert.deepEqual(keys.domains, ["keelinfra.com"]);
    assert.equal(keys.websiteKeys.length, 1);
    assert.ok(keys.websiteKeys[0]?.startsWith("website:discord.com/"));
    assert.deepEqual(keys.nameKeys, ["galacticpunks", "keel infrastructure"]);
    // Website ignored for the domain-bearing row.
    assert.equal(keys.primaryHosts.length, 0);
  });

  it("collects bare platform primary hosts only when domain is empty", () => {
    const keys = extractImportMatchLookupKeys([
      {
        normalized_domain: null,
        normalized_website: "https://www.coingecko.com/",
        normalized_company_name: "CoinGecko",
      },
    ]);
    assert.deepEqual(keys.primaryHosts, ["coingecko.com"]);
    assert.deepEqual(keys.websiteKeys, []);
  });

  it("resolves domain + verified-domain candidates and excludes inactive owners", () => {
    const keys = extractImportMatchLookupKeys([
      {
        normalized_domain: "keelinfra.io",
        normalized_website: null,
        normalized_company_name: "Keel Infrastructure",
      },
    ]);
    const ids = resolveImportMatchCandidateCompanyIds(keys, CATALOG);
    assert.deepEqual(ids, ["keel-id"]);

    const inactiveKeys = extractImportMatchLookupKeys([
      {
        normalized_domain: "inactiveco.com",
        normalized_website: null,
        normalized_company_name: "Inactive Co",
      },
    ]);
    assert.deepEqual(resolveImportMatchCandidateCompanyIds(inactiveKeys, CATALOG), []);
  });

  it("hydrates all company_domains for selected companies", () => {
    const keys = extractImportMatchLookupKeys([
      {
        normalized_domain: "keelinfra.com",
        normalized_website: null,
        normalized_company_name: "Keel Infrastructure",
      },
    ]);
    const selected = selectImportMatchCandidateCatalog(keys, CATALOG);
    assert.deepEqual(
      selected.companyDomains.map((row) => row.domain).sort(),
      ["keelinfra.com", "keelinfra.io"],
    );
  });
});

describe("importMatchCandidateLoader context build", () => {
  it("builds a context whose decisions match the full-directory context", () => {
    const row = {
      normalized_domain: "keelinfra.com",
      normalized_website: null,
      normalized_company_name: "Keel Infrastructure",
    };
    const full = buildImportMatchContext(CATALOG.companies, CATALOG.companyDomains);
    const candidate = loadImportMatchContextFromCandidateCatalog([row], CATALOG);

    assert.deepEqual(matchImportRowIdentity(row, candidate), matchImportRowIdentity(row, full));
    assert.deepEqual(
      listImportMatchCandidateCompanyIds(row, candidate),
      listImportMatchCandidateCompanyIds(row, full),
    );
  });

  it("memory source matches pure catalog selection", async () => {
    const row = {
      normalized_domain: null,
      normalized_website: "https://discord.com/invite/galactic-punks-881200105817010258",
      normalized_company_name: "Galacticpunks",
    };
    const source = createMemoryImportMatchCandidateSource(CATALOG);
    const fromSource = await loadImportMatchContextFromCandidateSource(source, [row]);
    const fromCatalog = loadImportMatchContextFromCandidateCatalog([row], CATALOG);

    assert.deepEqual(
      matchImportRowIdentity(row, fromSource),
      matchImportRowIdentity(row, fromCatalog),
    );
  });

  it("preserves multiple-candidate conflict when both owners are selected", () => {
    const catalog: ImportMatchCompanyCatalog = {
      companies: [
        { id: "a", name: "Company A", domain: "shared.jp", website: null, aliases: [] },
        { id: "b", name: "Company B", domain: null, website: null, aliases: [] },
        { id: "c", name: "Unrelated", domain: "other.com", website: null, aliases: [] },
      ],
      companyDomains: [
        { company_id: "a", domain: "shared.jp" },
        { company_id: "b", domain: "shared.jp" },
        { company_id: "c", domain: "other.com" },
      ],
    };
    const row = {
      normalized_domain: "shared.jp",
      normalized_website: null,
      normalized_company_name: "Company A",
    };
    const full = buildImportMatchContext(catalog.companies, catalog.companyDomains);
    const candidate = loadImportMatchContextFromCandidateCatalog([row], catalog);

    assert.deepEqual(matchImportRowIdentity(row, candidate), matchImportRowIdentity(row, full));
    assert.equal(matchImportRowIdentity(row, candidate).conflict_type, "multiple_candidates");
    // Unrelated company must not be hydrated.
    assert.equal(
      resolveImportMatchCandidateCompanyIds(extractImportMatchLookupKeys([row]), catalog).includes(
        "c",
      ),
      false,
    );
  });
});
