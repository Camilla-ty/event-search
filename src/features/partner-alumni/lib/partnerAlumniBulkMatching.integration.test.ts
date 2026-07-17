import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseCompanyAliasesFromRow } from "@/src/lib/companies/companyAliases";
import {
  buildImportMatchContext,
  matchImportRowIdentity,
} from "@/src/lib/companies/companyImportMatching";
import { normalizeDomainFromWebsite } from "@/src/lib/domain/normalizeDomain";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { fetchAllPaginatedSupabaseRows } from "@/src/lib/supabase/fetchAllPaginatedRows";

function normalizeWebsiteDomain(website: string | null): string | null {
  if (website === null || website.trim() === "") return null;
  try {
    const domain = normalizeDomainFromWebsite(website.trim());
    return domain !== "" ? domain.trim().toLowerCase() : null;
  } catch {
    return null;
  }
}

function previewStatus(decision: ReturnType<typeof matchImportRowIdentity>): string {
  if (decision.status === "auto_ready" && decision.proposed_company_id) return "matched";
  if (decision.proposed_company_id) return "review";
  return "create_new";
}

describe("Partner Alumni bulk matching", () => {
  it("previews bare CoinGecko URL as matched when primary domain owner agrees", () => {
    const COINGECKO_ID = "2d81d427-ad48-4e4f-8217-95fc50487f2a";
    const matchContext = buildImportMatchContext(
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

    const decision = matchImportRowIdentity(
      {
        normalized_domain: null,
        normalized_website: "https://www.coingecko.com/",
        normalized_company_name: "CoinGecko",
      },
      matchContext,
    );

    assert.equal(previewStatus(decision), "matched");
    assert.equal(decision.match_method, "domain");
    assert.equal(decision.match_confidence, "high");
    assert.equal(decision.proposed_company_id, COINGECKO_ID);
  });

  it("does not preview bare x.com as matched via platform-owner fallback", () => {
    const matchContext = buildImportMatchContext(
      [
        {
          id: "x-owner",
          name: "X Corp",
          domain: "x.com",
          website: "https://x.com",
          aliases: [],
        },
      ],
      [],
    );

    const decision = matchImportRowIdentity(
      {
        normalized_domain: null,
        normalized_website: "https://x.com",
        normalized_company_name: "X Corp",
      },
      matchContext,
    );

    assert.equal(previewStatus(decision), "review");
    assert.equal(decision.match_method, "exact_name");
  });

  it("excludes merged tombstone company_domains from domain conflicts (Aptos)", () => {
    const APTOS_ID = "84374a2c-45cb-4ea5-aae3-75c5af47430b";
    const MERGED_TOMBSTONE_ID = "295ba537-ec49-424d-91a7-bdbb816b15fa";

    // loadImportMatchContext filters companies to status=active; stale tombstone
    // company_domains rows are then dropped because their company_id is absent.
    const matchContext = buildImportMatchContext(
      [
        {
          id: APTOS_ID,
          name: "Aptos",
          domain: "aptosnetwork.com",
          website: "https://aptosnetwork.com/",
          aliases: ["Aptos Foundation"],
        },
      ],
      [
        { company_id: APTOS_ID, domain: "aptosfoundation.org" },
        { company_id: MERGED_TOMBSTONE_ID, domain: "aptosnetwork.com" },
      ],
    );

    const decision = matchImportRowIdentity(
      {
        normalized_domain: "aptosnetwork.com",
        normalized_website: "https://aptosnetwork.com/",
        normalized_company_name: "Aptos",
      },
      matchContext,
    );

    assert.equal(previewStatus(decision), "matched");
    assert.equal(decision.match_method, "domain");
    assert.equal(decision.match_confidence, "high");
    assert.equal(decision.proposed_company_id, APTOS_ID);
    assert.equal(decision.conflict_type, null);
  });
});

describe("Partner Alumni bulk matching integration", { skip: !process.env.SUPABASE_SERVICE_ROLE_KEY }, () => {
  it("loads full directory and matches MoonPay by exact name", async () => {
    const supabase = createAdminClient();
    const [companies, companyDomains] = await Promise.all([
      fetchAllPaginatedSupabaseRows(async ({ from, to }) =>
        supabase.from("companies").select("id, name, domain, aliases").range(from, to),
      ),
      fetchAllPaginatedSupabaseRows(async ({ from, to }) =>
        supabase.from("company_domains").select("company_id, domain").range(from, to),
      ),
    ]);

    assert.ok(companies.length > 1000, `expected large directory, got ${companies.length}`);

    const importCompanies = companies.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      domain: typeof row.domain === "string" ? row.domain.trim().toLowerCase() : null,
      aliases: parseCompanyAliasesFromRow(row.aliases),
    }));
    const importCompanyDomains = companyDomains
      .map((row) => ({
        company_id: String(row.company_id),
        domain: typeof row.domain === "string" ? row.domain.trim().toLowerCase() : "",
      }))
      .filter((entry) => entry.domain !== "");

    const matchContext = buildImportMatchContext(importCompanies, importCompanyDomains);

    const moonpayDecision = matchImportRowIdentity(
      { normalized_domain: null, normalized_company_name: "MoonPay" },
      matchContext,
    );
    assert.equal(moonpayDecision.proposed_company_id, "911c2d26-6942-483b-9dc1-c47cf13f91fa");
    assert.equal(previewStatus(moonpayDecision), "review");
    assert.equal(moonpayDecision.match_method, "exact_name");

    const moonpayDomainDecision = matchImportRowIdentity(
      {
        normalized_domain: normalizeWebsiteDomain("moonpay.com"),
        normalized_company_name: "MoonPay",
      },
      matchContext,
    );
    assert.equal(previewStatus(moonpayDomainDecision), "matched");
    assert.equal(moonpayDomainDecision.match_method, "domain");
  });
});
