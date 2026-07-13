/**
 * Live verification for alias-domain search after migration 20260721120000.
 * Run: npx tsx --env-file=.env.local scripts/verify-alias-domain-search.ts
 */
import assert from "node:assert/strict";

import { createClient } from "@supabase/supabase-js";

import { searchCompaniesAdmin } from "@/src/features/companies/server/companyAdminSearch";
import {
  assertSponsorDiscoveryRpcPublicEventShape,
  assertSponsorDiscoveryRpcPublicRowShape,
} from "@/src/features/sponsors/server/sponsorDiscoveryRpcPublicPayload";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  throw new Error("Missing Supabase env vars in .env.local");
}

const anon = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const service = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Fixture = {
  companyId: string;
  companyName: string;
  primaryDomain: string | null;
  aliasDomain: string;
};

async function pickAliasOnlyFixture(): Promise<Fixture> {
  const { data, error } = await service
    .from("companies")
    .select("id, name, domain, company_domains!inner(domain, is_primary)")
    .eq("status", "active")
    .is("restricted_at", null)
    .eq("company_domains.is_primary", false)
    .limit(200);

  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const domains = (row.company_domains ?? []) as { domain: string; is_primary: boolean }[];
    const alias = domains.find((d) => !d.is_primary)?.domain?.trim();
    const primary = typeof row.domain === "string" ? row.domain.trim() : "";
    if (!alias || alias === "") continue;
    if (primary.toLowerCase() === alias.toLowerCase()) continue;
    if (primary.toLowerCase().includes(alias.toLowerCase())) continue;

    const { count, error: statsError } = await service
      .from("company_sponsor_stats")
      .select("company_id", { count: "exact", head: true })
      .eq("company_id", row.id);
    if (statsError) throw new Error(statsError.message);
    if ((count ?? 0) === 0) continue;

    return {
      companyId: String(row.id),
      companyName: String(row.name),
      primaryDomain: primary || null,
      aliasDomain: alias,
    };
  }

  throw new Error("No alias-only discovery fixture found");
}

async function pickRestrictedFixture(): Promise<{ aliasDomain: string; companyName: string }> {
  const { data, error } = await service
    .from("companies")
    .select("id, name, company_domains!inner(domain)")
    .eq("status", "active")
    .not("restricted_at", "is", null)
    .limit(50);

  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const domains = (row.company_domains ?? []) as { domain: string }[];
    const alias = domains[0]?.domain?.trim();
    if (!alias) continue;

    const { count, error: statsError } = await service
      .from("company_sponsor_stats")
      .select("company_id", { count: "exact", head: true })
      .eq("company_id", row.id);
    if (statsError) throw new Error(statsError.message);
    if ((count ?? 0) === 0) continue;

    return { aliasDomain: alias, companyName: String(row.name) };
  }

  throw new Error("No restricted discovery fixture found");
}

function logSection(title: string) {
  console.log(`\n=== ${title} ===`);
}

async function main() {
  const fixture = await pickAliasOnlyFixture();
  const restricted = await pickRestrictedFixture();

  logSection("Fixture");
  console.log(JSON.stringify({ publicFixture: fixture, restrictedFixture: restricted }, null, 2));

  logSection("2. Public Sponsor Discovery (anon RPC)");
  const { data: discoveryData, error: discoveryError } = await anon.rpc("sponsor_discovery_page", {
    p_query: fixture.aliasDomain,
    p_event_slug: null,
    p_sort: "activity",
    p_page: 1,
    p_page_size: 20,
  });
  if (discoveryError) throw new Error(discoveryError.message);

  const discovery = discoveryData as {
    rows: Record<string, unknown>[];
    total: number;
    event: Record<string, unknown> | null;
  };
  const discoveryIds = discovery.rows.map((row) => String(row.id));
  console.log(
    JSON.stringify(
      {
        query: fixture.aliasDomain,
        total: discovery.total,
        matchedIds: discoveryIds,
        matchedNames: discovery.rows.map((row) => row.name),
      },
      null,
      2,
    ),
  );
  assert.ok(
    discoveryIds.includes(fixture.companyId),
    `Expected company ${fixture.companyId} in discovery for alias ${fixture.aliasDomain}`,
  );
  assert.equal(
    discoveryIds.filter((id) => id === fixture.companyId).length,
    1,
    "Discovery should return canonical company once",
  );

  logSection("3. Sponsor Suggest (anon RPC, slim payload)");
  const { data: suggestData, error: suggestError } = await anon.rpc("sponsor_discovery_page", {
    p_query: fixture.aliasDomain,
    p_event_slug: null,
    p_sort: "activity",
    p_page: 1,
    p_page_size: 10,
  });
  if (suggestError) throw new Error(suggestError.message);
  const suggest = suggestData as { rows: Record<string, unknown>[]; total: number };
  const suggestIds = suggest.rows.map((row) => String(row.id));
  console.log(
    JSON.stringify(
      {
        query: fixture.aliasDomain,
        total: suggest.total,
        matchedIds: suggestIds,
        matchedNames: suggest.rows.map((row) => row.name),
      },
      null,
      2,
    ),
  );
  assert.ok(
    suggestIds.includes(fixture.companyId),
    `Expected company ${fixture.companyId} in suggest for alias ${fixture.aliasDomain}`,
  );

  logSection("4. Admin Companies search (service role)");
  const adminHits = await searchCompaniesAdmin({ query: fixture.aliasDomain, limit: 20 });
  console.log(
    JSON.stringify(
      {
        query: fixture.aliasDomain,
        hits: adminHits.map((hit) => ({
          id: hit.id,
          name: hit.name,
          domain: hit.domain,
          restricted_at: hit.restricted_at,
        })),
      },
      null,
      2,
    ),
  );
  assert.ok(
    adminHits.some((hit) => hit.id === fixture.companyId),
    `Expected admin search to find ${fixture.companyName}`,
  );

  logSection("5. Public RPC excludes restricted companies");
  const { data: restrictedData, error: restrictedError } = await anon.rpc("sponsor_discovery_page", {
    p_query: restricted.aliasDomain,
    p_event_slug: null,
    p_sort: "activity",
    p_page: 1,
    p_page_size: 20,
  });
  if (restrictedError) throw new Error(restrictedError.message);
  const restrictedResult = restrictedData as { rows: Record<string, unknown>[]; total: number };
  console.log(
    JSON.stringify(
      {
        query: restricted.aliasDomain,
        restrictedCompany: restricted.companyName,
        total: restrictedResult.total,
        matchedNames: restrictedResult.rows.map((row) => row.name),
      },
      null,
      2,
    ),
  );
  assert.equal(
    restrictedResult.total,
    0,
    `Restricted company should not appear for query ${restricted.aliasDomain}`,
  );

  logSection("6. Public RPC payload shape (no alias-domain lists)");
  for (const row of discovery.rows) {
    assert.doesNotThrow(() => assertSponsorDiscoveryRpcPublicRowShape(row));
    assert.equal("verified_domains" in row, false);
    assert.equal("company_domains" in row, false);
    assert.equal("aliases" in row, false);
    assert.equal(row.domain, fixture.primaryDomain);
  }
  assert.doesNotThrow(() => assertSponsorDiscoveryRpcPublicEventShape(discovery.event));
  console.log(
    JSON.stringify(
      {
        firstRowKeys: Object.keys(discovery.rows[0] ?? {}).sort(),
        canonicalDomainReturned: discovery.rows[0]?.domain,
        aliasDomainQueried: fixture.aliasDomain,
      },
      null,
      2,
    ),
  );

  logSection("7. anon/authenticated cannot SELECT company_domains");
  const { error: anonSelectError } = await anon.from("company_domains").select("id").limit(1);
  const { error: authSelectError } = await service.auth.getSession().then(async () => {
    const authed = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return authed.from("company_domains").select("id").limit(1);
  });
  const { data: serviceRows, error: serviceSelectError } = await service
    .from("company_domains")
    .select("company_id, domain")
    .eq("domain", fixture.aliasDomain)
    .limit(1);

  console.log(
    JSON.stringify(
      {
        anonSelectError: anonSelectError?.message ?? null,
        authSelectError: authSelectError?.message ?? null,
        serviceSelectOk: !serviceSelectError && (serviceRows?.length ?? 0) > 0,
      },
      null,
      2,
    ),
  );
  assert.ok(anonSelectError, "anon should not SELECT company_domains");
  assert.ok(authSelectError, "authenticated client without session should not SELECT company_domains");
  assert.ok(!serviceSelectError && (serviceRows?.length ?? 0) > 0, "service role can read fixture domain");

  console.log("\nALL CHECKS PASSED");
}

main().catch((error) => {
  console.error("\nVERIFICATION FAILED");
  console.error(error);
  process.exit(1);
});
