import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { matchImportRowIdentity } from "@/src/lib/companies/companyImportMatching";

import {
  buildImportMatchContextFromDirectory,
  fetchAllPaginatedSupabaseRows,
  IMPORT_MATCH_CONTEXT_PAGE_SIZE,
  matchRow,
} from "./matchRows";

const NINE_CAT_ID = "022f74af-5615-4be2-8bf4-695fa124d315";
const VNTR_ID = "0b5409a3-c567-499b-be61-44afac457308";

function fillerCompanyDomain(index: number) {
  return {
    company_id: `filler-company-${index}`,
    domain: `filler-${index}.example`,
  };
}

function fillerCompany(index: number) {
  return {
    id: `filler-company-${index}`,
    name: `Filler Company ${index}`,
    domain: `filler-${index}.example`,
    website: null,
    aliases: [],
  };
}

describe("fetchAllPaginatedSupabaseRows", () => {
  it("loads rows beyond the first page", async () => {
    const allRows = Array.from({ length: 1001 }, (_, index) => ({ id: index }));

    const loaded = await fetchAllPaginatedSupabaseRows(async ({ from, to }) => ({
      data: allRows.slice(from, to + 1),
      error: null,
    }));

    assert.equal(loaded.length, 1001);
    assert.equal(loaded[1000]?.id, 1000);
  });

  it("uses IMPORT_MATCH_CONTEXT_PAGE_SIZE by default", async () => {
    let lastTo = -1;

    await fetchAllPaginatedSupabaseRows(async ({ to }) => {
      lastTo = to;
      return { data: [], error: null };
    });

    assert.equal(lastTo, IMPORT_MATCH_CONTEXT_PAGE_SIZE - 1);
  });
});

describe("buildImportMatchContextFromDirectory pagination regressions", () => {
  it("auto-readies alias domain beyond the first 1,000 company_domains rows", () => {
    const companies = [
      ...Array.from({ length: IMPORT_MATCH_CONTEXT_PAGE_SIZE }, (_, index) =>
        fillerCompany(index),
      ),
      {
        id: NINE_CAT_ID,
        name: "9 CAT DIGITAL",
        domain: "9catdigital.com",
        website: null,
        aliases: [],
      },
    ];

    const companyDomains = [
      ...Array.from({ length: IMPORT_MATCH_CONTEXT_PAGE_SIZE }, (_, index) =>
        fillerCompanyDomain(index),
      ),
      { company_id: NINE_CAT_ID, domain: "9catdigital.com" },
      { company_id: NINE_CAT_ID, domain: "9catgroup.com" },
    ];

    const truncatedContext = buildImportMatchContextFromDirectory(
      companies,
      companyDomains.slice(0, IMPORT_MATCH_CONTEXT_PAGE_SIZE),
    );
    const fullContext = buildImportMatchContextFromDirectory(companies, companyDomains);

    const truncated = matchImportRowIdentity(
      {
        normalized_domain: "9catgroup.com",
        normalized_website: null,
        normalized_company_name: "9 CAT DIGITAL",
      },
      truncatedContext,
    );
    const full = matchImportRowIdentity(
      {
        normalized_domain: "9catgroup.com",
        normalized_website: null,
        normalized_company_name: "9 CAT DIGITAL",
      },
      fullContext,
    );

    assert.equal(truncated.status, "needs_review");
    assert.equal(truncated.match_method, "exact_name");

    assert.equal(full.status, "auto_ready");
    assert.equal(full.match_method, "domain");
    assert.equal(full.proposed_company_id, NINE_CAT_ID);
    assert.notEqual(full.match_method, "exact_name");
  });

  it("auto-readies when companies.domain is null but company_domains has the domain", () => {
    const companies = [
      ...Array.from({ length: IMPORT_MATCH_CONTEXT_PAGE_SIZE }, (_, index) =>
        fillerCompany(index),
      ),
      {
        id: VNTR_ID,
        name: "VNTR Capital",
        domain: null,
        aliases: [],
      },
    ];

    const companyDomains = [
      ...Array.from({ length: IMPORT_MATCH_CONTEXT_PAGE_SIZE }, (_, index) =>
        fillerCompanyDomain(index),
      ),
      { company_id: VNTR_ID, domain: "vntr.vc" },
    ];

    const truncatedContext = buildImportMatchContextFromDirectory(
      companies,
      companyDomains.slice(0, IMPORT_MATCH_CONTEXT_PAGE_SIZE),
    );
    const fullContext = buildImportMatchContextFromDirectory(companies, companyDomains);

    const truncated = matchImportRowIdentity(
      {
        normalized_domain: "vntr.vc",
        normalized_website: null,
        normalized_company_name: "VNTR Capital",
      },
      truncatedContext,
    );
    const full = matchImportRowIdentity(
      {
        normalized_domain: "vntr.vc",
        normalized_website: null,
        normalized_company_name: "VNTR Capital",
      },
      fullContext,
    );

    assert.equal(truncated.status, "needs_review");
    assert.equal(truncated.match_method, "exact_name");

    assert.equal(full.status, "auto_ready");
    assert.equal(full.match_method, "domain");
    assert.equal(full.proposed_company_id, VNTR_ID);
    assert.notEqual(full.match_method, "exact_name");
  });

  it("does not fall back to exact_name when a domain match exists", () => {
    const context = buildImportMatchContextFromDirectory(
      [
        {
          id: NINE_CAT_ID,
          name: "9 CAT DIGITAL",
          domain: "9catdigital.com",
          aliases: [],
        },
      ],
      [
        { company_id: NINE_CAT_ID, domain: "9catdigital.com" },
        { company_id: NINE_CAT_ID, domain: "9catgroup.com" },
      ],
    );

    const result = matchImportRowIdentity(
      {
        normalized_domain: "9catgroup.com",
        normalized_website: null,
        normalized_company_name: "9 CAT DIGITAL",
      },
      context,
    );

    assert.equal(result.status, "auto_ready");
    assert.equal(result.match_method, "domain");
    assert.notEqual(result.match_method, "exact_name");
  });

  it("auto-readies bare CoinGecko URL via platform-owner fallback", async () => {
    const COINGECKO_ID = "2d81d427-ad48-4e4f-8217-95fc50487f2a";
    const context = buildImportMatchContextFromDirectory(
      [
        {
          id: COINGECKO_ID,
          name: "CoinGecko",
          domain: "coingecko.com",
          website: "https://www.coingecko.com/",
          aliases: [],
        },
      ],
      [{ company_id: COINGECKO_ID, domain: "coingecko.com" }],
    );

    const result = await matchRow(
      {
        id: "row-162",
        status: "needs_review",
        normalized_domain: null,
        normalized_website: "https://www.coingecko.com/",
        normalized_company_name: "CoinGecko",
        mapped_tier_rank: 1,
        has_blocking_validation: false,
      },
      context,
      new Map(),
    );

    assert.equal(result.status, "auto_ready");
    assert.equal(result.match_method, "domain");
    assert.equal(result.match_confidence, "high");
    assert.equal(result.proposed_company_id, COINGECKO_ID);
    assert.equal(result.conflict_type, null);
  });
});
