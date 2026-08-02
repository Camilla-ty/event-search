import { normalizeCompanyNameKey } from "@/src/lib/companies/companyAliases";
import { importWebsiteMatchKey } from "@/src/lib/domain/importWebsiteMatchKey";
import type { ImportMatchCompanyCatalog } from "@/src/lib/companies/importMatchCandidateLoader/catalog";
import {
  sortImportMatchCompanies,
  sortImportMatchCompanyDomains,
} from "@/src/lib/companies/importMatchCandidateLoader/catalog";
import type { ImportMatchCandidateSource } from "@/src/lib/companies/importMatchCandidateLoader/load";

/**
 * In-memory candidate source over an active company catalog.
 * Mirrors the predicates the Supabase-backed source must apply.
 */
export function createMemoryImportMatchCandidateSource(
  catalog: ImportMatchCompanyCatalog,
): ImportMatchCandidateSource {
  const activeById = new Map(catalog.companies.map((company) => [company.id, company]));

  function idsMatchingPrimaryDomains(domains: readonly string[]): string[] {
    const want = new Set(domains.map((d) => d.trim().toLowerCase()).filter(Boolean));
    if (want.size === 0) return [];
    const ids: string[] = [];
    for (const company of catalog.companies) {
      const primary = company.domain?.trim().toLowerCase() ?? "";
      if (primary !== "" && want.has(primary)) ids.push(company.id);
    }
    return ids;
  }

  return {
    async findActiveCompanyIdsByPrimaryDomains(domains) {
      return idsMatchingPrimaryDomains(domains);
    },

    async findActiveCompanyIdsByVerifiedDomains(domains) {
      const want = new Set(domains.map((d) => d.trim().toLowerCase()).filter(Boolean));
      if (want.size === 0) return [];
      const ids: string[] = [];
      for (const entry of catalog.companyDomains) {
        const domain = entry.domain.trim().toLowerCase();
        if (domain === "" || !want.has(domain)) continue;
        if (!activeById.has(entry.company_id)) continue;
        ids.push(entry.company_id);
      }
      return ids;
    },

    async findActiveCompanyIdsByExactNameKeys(nameKeys) {
      const want = new Set(nameKeys.filter(Boolean));
      if (want.size === 0) return [];
      return catalog.companies
        .filter((company) => want.has(normalizeCompanyNameKey(company.name)))
        .map((company) => company.id);
    },

    async findActiveCompanyIdsByExactAliasKeys(nameKeys) {
      const want = new Set(nameKeys.filter(Boolean));
      if (want.size === 0) return [];
      return catalog.companies
        .filter((company) =>
          company.aliases.some((alias) => want.has(normalizeCompanyNameKey(alias))),
        )
        .map((company) => company.id);
    },

    async findActiveCompanyIdsByWebsiteMatchKeys(websiteKeys) {
      const want = new Set(websiteKeys.filter(Boolean));
      if (want.size === 0) return [];
      return catalog.companies
        .filter((company) => {
          const website = company.website?.trim() ?? "";
          if (website === "") return false;
          const key = importWebsiteMatchKey(website);
          return key !== null && want.has(key);
        })
        .map((company) => company.id);
    },

    async findActiveCompaniesByIds(ids) {
      const want = new Set(ids);
      return sortImportMatchCompanies(
        catalog.companies.filter((company) => want.has(company.id)),
      );
    },

    async findCompanyDomainsByCompanyIds(companyIds) {
      const want = new Set(companyIds);
      return sortImportMatchCompanyDomains(
        catalog.companyDomains.filter((entry) => want.has(entry.company_id)),
      );
    },
  };
}
