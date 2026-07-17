import {
  companyMatchesAdminSearchByAliasOnly,
  isAdminCompanySearchQueryValid,
  normalizeAdminCompanySearchQuery,
  rankCompanySearchHits,
} from "@/src/lib/companies/companyIdentitySearch";
import { parseCompanyAliasesFromRow } from "@/src/lib/companies/companyAliases";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { fetchAllPaginatedSupabaseRows } from "@/src/lib/supabase/fetchAllPaginatedRows";

import type { CompanyAdminRow } from "./companyAdmin";

const COMPANY_ADMIN_SEARCH_SELECT =
  "id, name, slug, domain, website, logo_url, logo_source, logo_status, logo_fetched_at, logo_fetch_error, city_id, created_at, aliases, status, merged_into_company_id, merged_at, restricted_at";

function mapCompanyAdminRow(row: Record<string, unknown>): CompanyAdminRow {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    domain: typeof row.domain === "string" ? row.domain : null,
    website: typeof row.website === "string" ? row.website : null,
    logo_url: typeof row.logo_url === "string" ? row.logo_url : null,
    logo_source: typeof row.logo_source === "string" ? row.logo_source : null,
    logo_status: typeof row.logo_status === "string" ? row.logo_status : null,
    logo_fetched_at: typeof row.logo_fetched_at === "string" ? row.logo_fetched_at : null,
    logo_fetch_error: typeof row.logo_fetch_error === "string" ? row.logo_fetch_error : null,
    city_id: typeof row.city_id === "string" ? row.city_id : null,
    created_at: typeof row.created_at === "string" ? row.created_at : null,
    aliases: parseCompanyAliasesFromRow(row.aliases),
    status: typeof row.status === "string" ? row.status : "active",
    merged_into_company_id:
      typeof row.merged_into_company_id === "string" ? row.merged_into_company_id : null,
    merged_at: typeof row.merged_at === "string" ? row.merged_at : null,
    restricted_at: typeof row.restricted_at === "string" ? row.restricted_at : null,
  };
}

export type AdminCompanySearchHit = CompanyAdminRow & {
  matched_alias: string | null;
};

export type SearchCompaniesAdminOptions = {
  query: string;
  limit?: number;
  excludeIds?: readonly string[];
};

async function fetchPrimarySearchCandidates(term: string): Promise<CompanyAdminRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("companies")
    .select(COMPANY_ADMIN_SEARCH_SELECT)
    .eq("status", "active")
    .or(
      `name.ilike.%${term}%,slug.ilike.%${term}%,domain.ilike.%${term}%,website.ilike.%${term}%`,
    );

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapCompanyAdminRow(row as Record<string, unknown>));
}

async function fetchAliasSearchCandidates(
  term: string,
  excludeIds: ReadonlySet<string>,
): Promise<CompanyAdminRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("companies")
    .select(COMPANY_ADMIN_SEARCH_SELECT)
    .eq("status", "active");

  if (error) throw new Error(error.message);

  const matches: CompanyAdminRow[] = [];
  for (const row of data ?? []) {
    const company = mapCompanyAdminRow(row as Record<string, unknown>);
    if (excludeIds.has(company.id)) continue;
    if (company.aliases.length === 0) continue;
    if (!companyMatchesAdminSearchByAliasOnly(company, term)) continue;
    matches.push(company);
  }

  return matches;
}

async function fetchCompanyDomainSearchCandidates(
  term: string,
  excludeIds: ReadonlySet<string>,
): Promise<{
  companies: CompanyAdminRow[];
  verifiedDomainsByCompanyId: Map<string, string[]>;
}> {
  const supabase = createAdminClient();
  const domainRows = await fetchAllPaginatedSupabaseRows<{
    company_id: unknown;
    domain: unknown;
  }>(async ({ from, to }) =>
    supabase
      .from("company_domains")
      .select("company_id, domain")
      .ilike("domain", `%${term}%`)
      .range(from, to),
  );

  const verifiedDomainsByCompanyId = new Map<string, string[]>();
  const companyIds: string[] = [];

  for (const row of domainRows) {
    const companyId = String(row.company_id);
    if (excludeIds.has(companyId)) continue;

    const domain = typeof row.domain === "string" ? row.domain.trim() : "";
    if (domain === "") continue;

    if (!verifiedDomainsByCompanyId.has(companyId)) {
      companyIds.push(companyId);
    }

    const existing = verifiedDomainsByCompanyId.get(companyId) ?? [];
    if (!existing.includes(domain)) {
      existing.push(domain);
      verifiedDomainsByCompanyId.set(companyId, existing);
    }
  }

  if (companyIds.length === 0) {
    return { companies: [], verifiedDomainsByCompanyId };
  }

  const { data, error } = await supabase
    .from("companies")
    .select(COMPANY_ADMIN_SEARCH_SELECT)
    .eq("status", "active")
    .in("id", companyIds);

  if (error) throw new Error(error.message);

  return {
    companies: (data ?? []).map((row) => mapCompanyAdminRow(row as Record<string, unknown>)),
    verifiedDomainsByCompanyId,
  };
}

export function mergeCompaniesById(companies: readonly CompanyAdminRow[]): CompanyAdminRow[] {
  const byId = new Map<string, CompanyAdminRow>();
  for (const company of companies) {
    byId.set(company.id, company);
  }
  return Array.from(byId.values());
}

export function attachVerifiedDomainsForAdminSearch<T extends CompanyAdminRow>(
  companies: readonly T[],
  verifiedDomainsByCompanyId: ReadonlyMap<string, readonly string[]>,
): (T & { verified_domains: readonly string[] })[] {
  return companies.map((company) => ({
    ...company,
    verified_domains: verifiedDomainsByCompanyId.get(company.id) ?? [],
  }));
}

/** Shared admin company identity search: name, aliases, domain, slug, website, company_domains. */
export async function searchCompaniesAdmin(
  options: SearchCompaniesAdminOptions,
): Promise<AdminCompanySearchHit[]> {
  const query = normalizeAdminCompanySearchQuery(options.query);
  if (!isAdminCompanySearchQueryValid(query)) {
    return [];
  }

  const primaryMatches = await fetchPrimarySearchCandidates(query);
  const primaryIds = new Set(primaryMatches.map((company) => company.id));
  const aliasMatches = await fetchAliasSearchCandidates(query, primaryIds);
  const candidateIds = new Set([
    ...primaryIds,
    ...aliasMatches.map((company) => company.id),
  ]);
  const { companies: domainMatches, verifiedDomainsByCompanyId } =
    await fetchCompanyDomainSearchCandidates(query, candidateIds);
  const candidates = mergeCompaniesById([
    ...primaryMatches,
    ...aliasMatches,
    ...domainMatches,
  ]);

  const excludeIds = new Set(options.excludeIds ?? []);
  const filteredCandidates = candidates.filter((company) => !excludeIds.has(company.id));
  const candidatesForRanking = attachVerifiedDomainsForAdminSearch(
    filteredCandidates,
    verifiedDomainsByCompanyId,
  );

  let ranked = rankCompanySearchHits(candidatesForRanking, query).map((hit) => ({
    ...hit.company,
    matched_alias: hit.matched_alias,
  }));

  if (typeof options.limit === "number" && options.limit > 0) {
    ranked = ranked.slice(0, options.limit);
  }

  return ranked;
}
