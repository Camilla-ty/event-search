import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260731130000_admin_company_ids_matching_alias.sql",
);

const searchModulePath = join(
  process.cwd(),
  "src/features/companies/server/companyAdminSearch.ts",
);

describe("admin_company_ids_matching_alias migration (SCALE-001)", () => {
  const sql = readFileSync(migrationPath, "utf8");

  it("creates a bounded alias id lookup over companies.aliases", () => {
    assert.match(sql, /CREATE OR REPLACE FUNCTION public\.admin_company_ids_matching_alias/);
    assert.match(sql, /unnest\(c\.aliases\)/);
    assert.match(sql, /c\.status = 'active'/);
    assert.match(sql, /LIMIT \(SELECT lim FROM prepared\)/);
    assert.match(sql, /least\(greatest\(coalesce\(p_limit, 1000\), 1\), 1000\)/);
  });

  it("restricts execute to service_role", () => {
    assert.match(
      sql,
      /__restrict_rpc_execute_to_service_role\(\s*'public\.admin_company_ids_matching_alias\(text, integer\)'/,
    );
  });

  it("does not create a normalized alias table", () => {
    assert.doesNotMatch(sql, /CREATE TABLE.*company_aliases/i);
  });
});

describe("companyAdminSearch alias candidate fetch (SCALE-001)", () => {
  const source = readFileSync(searchModulePath, "utf8");

  it("uses admin_company_ids_matching_alias instead of loading all active companies", () => {
    assert.match(source, /admin_company_ids_matching_alias/);
    assert.match(source, /\.rpc\(\s*"admin_company_ids_matching_alias"/);

    const aliasFnStart = source.indexOf("async function fetchAliasSearchCandidates");
    const aliasFnEnd = source.indexOf(
      "async function fetchCompanyDomainSearchCandidates",
      aliasFnStart,
    );
    assert.ok(aliasFnStart >= 0 && aliasFnEnd > aliasFnStart);
    const aliasFn = source.slice(aliasFnStart, aliasFnEnd);

    assert.doesNotMatch(
      aliasFn,
      /\.from\("companies"\)\s*\n\s*\.select\(COMPANY_ADMIN_SEARCH_SELECT\)\s*\n\s*\.eq\("status", "active"\);/,
    );
    assert.match(aliasFn, /\.in\("id", matchedIds\)/);
    assert.match(aliasFn, /companyMatchesAdminSearchByAliasOnly/);
  });
});
