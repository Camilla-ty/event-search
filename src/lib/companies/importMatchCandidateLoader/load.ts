import {
  buildImportMatchContext,
  type ImportMatchableRow,
  type ImportMatchCompany,
  type ImportMatchCompanyDomain,
  type ImportMatchContext,
} from "@/src/lib/companies/companyImportMatching";
import {
  selectImportMatchCandidateCatalog,
  sortImportMatchCompanies,
  sortImportMatchCompanyDomains,
  type ImportMatchCompanyCatalog,
} from "@/src/lib/companies/importMatchCandidateLoader/catalog";
import { extractImportMatchLookupKeys } from "@/src/lib/companies/importMatchCandidateLoader/keys";

/**
 * Injectable DB / memory backend for ARC-003 Phase 1 candidate loading.
 * Not wired into production importers.
 */
export type ImportMatchCandidateSource = {
  findActiveCompanyIdsByPrimaryDomains(domains: readonly string[]): Promise<string[]>;
  findActiveCompanyIdsByVerifiedDomains(domains: readonly string[]): Promise<string[]>;
  findActiveCompanyIdsByExactNameKeys(nameKeys: readonly string[]): Promise<string[]>;
  findActiveCompanyIdsByExactAliasKeys(nameKeys: readonly string[]): Promise<string[]>;
  findActiveCompanyIdsByWebsiteMatchKeys(websiteKeys: readonly string[]): Promise<string[]>;
  findActiveCompaniesByIds(ids: readonly string[]): Promise<ImportMatchCompany[]>;
  findCompanyDomainsByCompanyIds(
    companyIds: readonly string[],
  ): Promise<ImportMatchCompanyDomain[]>;
};

function uniqueSortedIds(ids: Iterable<string>): string[] {
  return [...new Set([...ids].filter((id) => id !== ""))].sort((a, b) => a.localeCompare(b));
}

/**
 * Resolve candidate company ids via the injectable source (DB or memory).
 */
export async function resolveImportMatchCandidateIdsFromSource(
  source: ImportMatchCandidateSource,
  rows: readonly ImportMatchableRow[],
): Promise<string[]> {
  const keys = extractImportMatchLookupKeys(rows);
  const batches = await Promise.all([
    keys.domains.length > 0
      ? source.findActiveCompanyIdsByPrimaryDomains(keys.domains)
      : Promise.resolve([]),
    keys.domains.length > 0
      ? source.findActiveCompanyIdsByVerifiedDomains(keys.domains)
      : Promise.resolve([]),
    keys.primaryHosts.length > 0
      ? source.findActiveCompanyIdsByPrimaryDomains(keys.primaryHosts)
      : Promise.resolve([]),
    keys.nameKeys.length > 0
      ? source.findActiveCompanyIdsByExactNameKeys(keys.nameKeys)
      : Promise.resolve([]),
    keys.nameKeys.length > 0
      ? source.findActiveCompanyIdsByExactAliasKeys(keys.nameKeys)
      : Promise.resolve([]),
    keys.websiteKeys.length > 0
      ? source.findActiveCompanyIdsByWebsiteMatchKeys(keys.websiteKeys)
      : Promise.resolve([]),
  ]);

  return uniqueSortedIds(batches.flat());
}

/**
 * Hydrate companies + all of their company_domains rows, then build ImportMatchContext.
 */
export async function loadImportMatchContextFromCandidateSource(
  source: ImportMatchCandidateSource,
  rows: readonly ImportMatchableRow[],
): Promise<ImportMatchContext> {
  const candidateIds = await resolveImportMatchCandidateIdsFromSource(source, rows);
  if (candidateIds.length === 0) {
    return buildImportMatchContext([], []);
  }

  const [companies, companyDomains] = await Promise.all([
    source.findActiveCompaniesByIds(candidateIds),
    source.findCompanyDomainsByCompanyIds(candidateIds),
  ]);

  return buildImportMatchContext(
    sortImportMatchCompanies(companies),
    sortImportMatchCompanyDomains(companyDomains),
  );
}

/**
 * Pure (no I/O) path: select candidates from an in-memory catalog and build context.
 * Used by Phase 0/0.1 parity verification.
 */
export function loadImportMatchContextFromCandidateCatalog(
  rows: readonly ImportMatchableRow[],
  catalog: ImportMatchCompanyCatalog,
): ImportMatchContext {
  const keys = extractImportMatchLookupKeys(rows);
  const candidateCatalog = selectImportMatchCandidateCatalog(keys, catalog);
  return buildImportMatchContext(
    candidateCatalog.companies,
    candidateCatalog.companyDomains,
  );
}

export function buildImportMatchContextFromCandidateCatalog(
  catalog: ImportMatchCompanyCatalog,
): ImportMatchContext {
  return buildImportMatchContext(
    sortImportMatchCompanies(catalog.companies),
    sortImportMatchCompanyDomains(catalog.companyDomains),
  );
}
