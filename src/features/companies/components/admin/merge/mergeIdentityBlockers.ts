import type {
  CompanyMergeFieldResolutions,
  CompanyMergePreviewSnapshot,
} from "@/src/features/companies/server/companyMerge";
import {
  mergeCompanyDomainsBlockerStrings,
  planMergeCompanyDomains,
  type MergeDomainRow,
} from "@/src/features/companies/server/planMergeCompanyDomains";

type PreviewWithDomains = CompanyMergePreviewSnapshot & {
  verified_domains?: {
    canonical: Array<{ id: string; domain: string; is_primary: boolean }>;
    duplicate: Array<{ id: string; domain: string; is_primary: boolean }>;
  };
  identity_foreign_owners?: Record<string, string>;
};

function toRows(
  companyId: string,
  rows: Array<{ id: string; domain: string; is_primary: boolean }> | undefined,
): MergeDomainRow[] {
  return (rows ?? []).map((row) => ({
    id: row.id,
    company_id: companyId,
    domain: row.domain,
    is_primary: row.is_primary,
  }));
}

/** Recompute identity blockers for the current field resolution choices. */
export function recomputeMergeIdentityBlockerMessages(
  preview: PreviewWithDomains,
  fieldResolutions: CompanyMergeFieldResolutions,
): string[] {
  const foreignOwnerByIdentity = new Map<string, string>(
    Object.entries(preview.identity_foreign_owners ?? {}),
  );

  const plan = planMergeCompanyDomains({
    canonicalCompanyId: preview.canonical_company_id,
    duplicateCompanyId: preview.duplicate_company_id,
    canonicalDomain: preview.companies.canonical.domain,
    duplicateDomain: preview.companies.duplicate.domain,
    canonicalWebsite: preview.companies.canonical.website,
    duplicateWebsite: preview.companies.duplicate.website,
    domainStrategy: fieldResolutions.domain,
    websiteStrategy: fieldResolutions.website,
    canonicalDomainRows: toRows(
      preview.canonical_company_id,
      preview.verified_domains?.canonical,
    ),
    duplicateDomainRows: toRows(
      preview.duplicate_company_id,
      preview.verified_domains?.duplicate,
    ),
    foreignOwnerByIdentity,
  });

  // Keep SQL/RPC third-party messages that are not resolution-dependent, then
  // replace resolution-dependent website/Primary messages with the live plan.
  const staticBlockers = preview.blockers.filter(
    (message) =>
      message.includes("owned by another company") ||
      message.includes("merge_company_domain_third_party"),
  );

  const live = mergeCompanyDomainsBlockerStrings(plan.blockers);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const message of [...staticBlockers, ...live]) {
    if (seen.has(message)) continue;
    seen.add(message);
    out.push(message);
  }
  return out;
}
