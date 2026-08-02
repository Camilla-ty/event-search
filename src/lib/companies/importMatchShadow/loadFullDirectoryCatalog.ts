import { parseCompanyAliasesFromRow } from "@/src/lib/companies/companyAliases";
import type {
  ImportMatchCompany,
  ImportMatchCompanyDomain,
} from "@/src/lib/companies/companyImportMatching";
import type { ImportMatchCompanyCatalog } from "@/src/lib/companies/importMatchCandidateLoader";
import {
  fetchAllPaginatedSupabaseRows,
  SUPABASE_DEFAULT_PAGE_SIZE,
} from "@/src/lib/supabase/fetchAllPaginatedRows";
import type { SupabaseClient } from "@supabase/supabase-js";

type CompanyRow = {
  id: unknown;
  name: unknown;
  domain: unknown;
  website: unknown;
  aliases: unknown;
};

type CompanyDomainRow = {
  company_id: unknown;
  domain: unknown;
};

/**
 * Read-only full active company directory load (mirrors production import loaders).
 * Preserves fetch order — production loaders do not ORDER BY id.
 * Not a replacement for those loaders — used only by ARC-003 shadow comparison.
 */
export async function loadFullDirectoryCatalogForShadow(
  supabase: SupabaseClient,
): Promise<ImportMatchCompanyCatalog> {
  const [companies, companyDomains] = await Promise.all([
    fetchAllPaginatedSupabaseRows<CompanyRow>(
      async ({ from, to }) =>
        supabase
          .from("companies")
          .select("id, name, domain, website, aliases")
          .eq("status", "active")
          .range(from, to),
      SUPABASE_DEFAULT_PAGE_SIZE,
    ),
    fetchAllPaginatedSupabaseRows<CompanyDomainRow>(
      async ({ from, to }) =>
        supabase.from("company_domains").select("company_id, domain").range(from, to),
      SUPABASE_DEFAULT_PAGE_SIZE,
    ),
  ]);

  const mappedCompanies: ImportMatchCompany[] = companies.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    domain: typeof row.domain === "string" ? row.domain.trim().toLowerCase() : null,
    website: typeof row.website === "string" ? row.website.trim() : null,
    aliases: parseCompanyAliasesFromRow(row.aliases),
  }));

  const mappedDomains: ImportMatchCompanyDomain[] = companyDomains
    .map((row) => ({
      company_id: String(row.company_id),
      domain: typeof row.domain === "string" ? row.domain.trim().toLowerCase() : "",
    }))
    .filter((entry) => entry.domain !== "");

  return {
    companies: mappedCompanies,
    companyDomains: mappedDomains,
  };
}
