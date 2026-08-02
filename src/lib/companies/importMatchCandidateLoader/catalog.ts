import { normalizeCompanyNameKey } from "@/src/lib/companies/companyAliases";
import type {
  ImportMatchCompany,
  ImportMatchCompanyDomain,
} from "@/src/lib/companies/companyImportMatching";
import { importWebsiteMatchKey } from "@/src/lib/domain/importWebsiteMatchKey";
import type { ImportMatchLookupKeys } from "@/src/lib/companies/importMatchCandidateLoader/keys";

/** Active company directory slice used to resolve candidates (in-memory or hydrated from DB). */
export type ImportMatchCompanyCatalog = {
  companies: readonly ImportMatchCompany[];
  companyDomains: readonly ImportMatchCompanyDomain[];
};

function compareId(a: string, b: string): number {
  return a.localeCompare(b);
}

/** Deterministic company order for candidate catalogs / context builds. */
export function sortImportMatchCompanies(
  companies: readonly ImportMatchCompany[],
): ImportMatchCompany[] {
  return [...companies].sort((a, b) => compareId(a.id, b.id));
}

/** Deterministic domain-row order. */
export function sortImportMatchCompanyDomains(
  domains: readonly ImportMatchCompanyDomain[],
): ImportMatchCompanyDomain[] {
  return [...domains].sort((a, b) => {
    const byCompany = compareId(a.company_id, b.company_id);
    if (byCompany !== 0) return byCompany;
    return a.domain.localeCompare(b.domain);
  });
}

/**
 * Resolve candidate company ids from a catalog using the same predicates a DB
 * candidate loader must apply (active companies only; verified domains only when
 * the owning company is present in the active catalog).
 */
export function resolveImportMatchCandidateCompanyIds(
  keys: ImportMatchLookupKeys,
  catalog: ImportMatchCompanyCatalog,
): string[] {
  const activeById = new Map(catalog.companies.map((company) => [company.id, company]));
  const ids = new Set<string>();

  const domainSet = new Set(keys.domains);
  const primaryHostSet = new Set(keys.primaryHosts);
  const websiteKeySet = new Set(keys.websiteKeys);
  const nameKeySet = new Set(keys.nameKeys);

  for (const company of catalog.companies) {
    const primary = company.domain?.trim().toLowerCase() ?? "";
    if (primary !== "" && (domainSet.has(primary) || primaryHostSet.has(primary))) {
      ids.add(company.id);
    }

    const nameKey = normalizeCompanyNameKey(company.name);
    if (nameKey !== "" && nameKeySet.has(nameKey)) {
      ids.add(company.id);
    }

    for (const alias of company.aliases) {
      const aliasKey = normalizeCompanyNameKey(alias);
      if (aliasKey !== "" && nameKeySet.has(aliasKey)) {
        ids.add(company.id);
        break;
      }
    }

    const website = company.website?.trim() ?? "";
    if (website !== "") {
      const websiteKey = importWebsiteMatchKey(website);
      if (websiteKey && websiteKeySet.has(websiteKey)) {
        ids.add(company.id);
      }
    }
  }

  for (const entry of catalog.companyDomains) {
    const domain = entry.domain.trim().toLowerCase();
    if (domain === "" || !domainSet.has(domain)) continue;
    if (!activeById.has(entry.company_id)) continue;
    ids.add(entry.company_id);
  }

  return [...ids].sort(compareId);
}

/**
 * Build a candidate-only catalog: matched companies (sorted) plus all of their
 * company_domains rows (sorted). Inactive / missing owners stay excluded.
 */
export function selectImportMatchCandidateCatalog(
  keys: ImportMatchLookupKeys,
  catalog: ImportMatchCompanyCatalog,
): ImportMatchCompanyCatalog {
  const candidateIds = new Set(resolveImportMatchCandidateCompanyIds(keys, catalog));
  const companies = sortImportMatchCompanies(
    catalog.companies.filter((company) => candidateIds.has(company.id)),
  );
  const companyDomains = sortImportMatchCompanyDomains(
    catalog.companyDomains.filter((entry) => candidateIds.has(entry.company_id)),
  );
  return { companies, companyDomains };
}
