import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260721120000_sponsor_discovery_company_domains_search.sql",
);

describe("sponsor discovery company_domains search migration", () => {
  const sql = readFileSync(migrationPath, "utf8");

  it("uses a scoped SECURITY DEFINER helper with fixed search_path", () => {
    assert.match(sql, /CREATE OR REPLACE FUNCTION public\.__company_matches_verified_domain_search/);
    assert.match(sql, /SECURITY DEFINER/);
    assert.match(sql, /SET search_path = public/);
    assert.match(sql, /FROM public\.company_domains cd/);
    assert.match(
      sql,
      /REVOKE ALL ON FUNCTION public\.__company_matches_verified_domain_search\(uuid, text\) FROM PUBLIC;/,
    );
  });

  it("keeps sponsor_discovery_page as SECURITY INVOKER with restricted public eligibility", () => {
    assert.match(sql, /CREATE OR REPLACE FUNCTION public\.sponsor_discovery_page/);
    assert.match(sql, /SECURITY INVOKER/);

    const globalEligible = sql.slice(
      sql.indexOf("global_eligible AS ("),
      sql.indexOf("visible_links AS ("),
    );
    const eventEligible = sql.slice(
      sql.indexOf("event_eligible AS ("),
      sql.indexOf("  eligible AS (\n    SELECT * FROM global_eligible"),
    );

    assert.match(globalEligible, /c\.restricted_at IS NULL/);
    assert.match(eventEligible, /c\.restricted_at IS NULL/);
    assert.match(globalEligible, /__company_matches_verified_domain_search\(c\.id, p\.query_term\)/);
    assert.match(eventEligible, /__company_matches_verified_domain_search\(c\.id, p\.query_term\)/);
  });

  it("does not grant anon or authenticated SELECT on company_domains", () => {
    assert.doesNotMatch(sql, /GRANT SELECT ON TABLE public\.company_domains TO (anon|authenticated)/);
    assert.doesNotMatch(sql, /GRANT SELECT ON public\.company_domains TO (anon|authenticated)/);
  });

  it("preserves the public RPC row payload keys", () => {
    assert.match(sql, /'domain', pg\.domain/);
    assert.match(sql, /'website', pg\.website/);
    assert.doesNotMatch(sql, /'verified_domains'/);
    assert.doesNotMatch(sql, /'company_domains'/);
    assert.doesNotMatch(sql, /'short_description', pg\.short_description/);
    assert.doesNotMatch(sql, /'tier_rank', pg\.tier_rank/);
  });
});
