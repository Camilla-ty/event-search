import { normalizeCompanyNameKey } from "@/src/lib/companies/companyAliases";
import type { ImportMatchableRow } from "@/src/lib/companies/companyImportMatching";
import {
  barePlatformOwnerRootHost,
  importWebsiteMatchKey,
} from "@/src/lib/domain/importWebsiteMatchKey";

/**
 * Lookup keys a candidate loader must resolve to build a sufficient ImportMatchContext.
 * Mirrors the key families consulted by matchImportRowIdentity / listImportMatchCandidateCompanyIds.
 */
export type ImportMatchLookupKeys = {
  /** lowercased normalized_domain values */
  domains: readonly string[];
  /** importWebsiteMatchKey results (only relevant when domain is empty) */
  websiteKeys: readonly string[];
  /** barePlatformOwnerRootHost results (only relevant when domain is empty) */
  primaryHosts: readonly string[];
  /** normalizeCompanyNameKey results */
  nameKeys: readonly string[];
};

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].filter((value) => value !== "").sort((a, b) => a.localeCompare(b));
}

/**
 * Extract deterministic lookup keys from one or more import rows.
 * Website / primary-host keys are collected only when the row has no domain
 * (matching engine short-circuits website when domain is present).
 */
export function extractImportMatchLookupKeys(
  rows: readonly ImportMatchableRow[],
): ImportMatchLookupKeys {
  const domains: string[] = [];
  const websiteKeys: string[] = [];
  const primaryHosts: string[] = [];
  const nameKeys: string[] = [];

  for (const row of rows) {
    const domain = row.normalized_domain?.trim().toLowerCase() ?? "";
    if (domain !== "") {
      domains.push(domain);
    } else {
      const website = row.normalized_website?.trim() ?? "";
      if (website !== "") {
        const websiteKey = importWebsiteMatchKey(website);
        if (websiteKey) websiteKeys.push(websiteKey);
        const host = barePlatformOwnerRootHost(website);
        if (host) primaryHosts.push(host);
      }
    }

    const nameKey = normalizeCompanyNameKey(row.normalized_company_name ?? "");
    if (nameKey !== "") nameKeys.push(nameKey);
  }

  return {
    domains: uniqueSorted(domains),
    websiteKeys: uniqueSorted(websiteKeys),
    primaryHosts: uniqueSorted(primaryHosts),
    nameKeys: uniqueSorted(nameKeys),
  };
}
