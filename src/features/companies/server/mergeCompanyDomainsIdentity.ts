import { createAdminClient } from "@/src/lib/supabase/admin";
import type { CompanyMergeFieldResolutions } from "@/src/features/companies/server/companyMerge";
import type { CompanyMergePreviewSnapshot } from "@/src/features/companies/server/companyMerge";
import {
  buildForeignOwnerByIdentity,
  mergeCompanyDomainsBlockerStrings,
  planMergeCompanyDomains,
  type MergeDomainRow,
  type MergeTextFieldStrategy,
} from "@/src/features/companies/server/planMergeCompanyDomains";

export type MergeVerifiedDomainRow = {
  id: string;
  domain: string;
  is_primary: boolean;
};

export type MergeIdentityAssertions = {
  winner_domain: string | null;
  winner_website: string | null;
  website_identity_key: string | null;
  website_identity_status: "domain" | "no_identity" | "blank" | "unparseable";
};

export type CompanyMergePreviewWithIdentity = CompanyMergePreviewSnapshot & {
  verified_domains: {
    canonical: MergeVerifiedDomainRow[];
    duplicate: MergeVerifiedDomainRow[];
  };
  /** lower(identity) → third-party company id */
  identity_foreign_owners: Record<string, string>;
};

function asDomainStrategy(
  value: CompanyMergeFieldResolutions["domain"],
): MergeTextFieldStrategy {
  return value;
}

function asWebsiteStrategy(
  value: CompanyMergeFieldResolutions["website"],
): MergeTextFieldStrategy {
  return value;
}

export function planMergeIdentityFromPreview(input: {
  preview: CompanyMergePreviewSnapshot;
  fieldResolutions: CompanyMergeFieldResolutions;
  canonicalDomainRows: readonly MergeDomainRow[];
  duplicateDomainRows: readonly MergeDomainRow[];
  foreignOwnerByIdentity: ReadonlyMap<string, string>;
}) {
  return planMergeCompanyDomains({
    canonicalCompanyId: input.preview.canonical_company_id,
    duplicateCompanyId: input.preview.duplicate_company_id,
    canonicalDomain: input.preview.companies.canonical.domain,
    duplicateDomain: input.preview.companies.duplicate.domain,
    canonicalWebsite: input.preview.companies.canonical.website,
    duplicateWebsite: input.preview.companies.duplicate.website,
    domainStrategy: asDomainStrategy(input.fieldResolutions.domain),
    websiteStrategy: asWebsiteStrategy(input.fieldResolutions.website),
    canonicalDomainRows: input.canonicalDomainRows,
    duplicateDomainRows: input.duplicateDomainRows,
    foreignOwnerByIdentity: input.foreignOwnerByIdentity,
  });
}

export function mergeIdentityAssertionsFromPlan(plan: {
  winnerDomain: string | null;
  winnerWebsite: string | null;
  websiteIdentityKey: string | null;
  websiteIdentityStatus: MergeIdentityAssertions["website_identity_status"];
}): MergeIdentityAssertions {
  return {
    winner_domain: plan.winnerDomain,
    winner_website: plan.winnerWebsite,
    website_identity_key: plan.websiteIdentityKey,
    website_identity_status: plan.websiteIdentityStatus,
  };
}

export function applyIdentityBlockersToPreview(
  preview: CompanyMergePreviewSnapshot,
  plannerBlockerMessages: readonly string[],
): CompanyMergePreviewSnapshot {
  const merged = [...preview.blockers];
  const seen = new Set(merged);
  for (const message of plannerBlockerMessages) {
    if (seen.has(message)) continue;
    seen.add(message);
    merged.push(message);
  }
  const executable =
    preview.executable &&
    merged.length === 0 &&
    preview.required_resolutions.sponsorship_conflicts.length === 0 &&
    preview.required_resolutions.organizer_conflicts.length === 0 &&
    preview.required_resolutions.draft_link_conflicts.length === 0;

  return {
    ...preview,
    blockers: merged,
    executable,
    executable_in_phase: executable,
  };
}

export async function loadMergeDomainContext(input: {
  canonicalCompanyId: string;
  duplicateCompanyId: string;
}): Promise<{
  canonicalDomainRows: MergeDomainRow[];
  duplicateDomainRows: MergeDomainRow[];
  foreignOwnerByIdentity: Map<string, string>;
}> {
  const supabase = createAdminClient();
  const pair = [input.canonicalCompanyId, input.duplicateCompanyId];

  const [{ data: domainRows, error: domainError }, { data: activeCompanies, error: companyError }] =
    await Promise.all([
      supabase.from("company_domains").select("id, company_id, domain, is_primary"),
      supabase
        .from("companies")
        .select("id, domain")
        .eq("status", "active")
        .not("domain", "is", null),
    ]);

  if (domainError) throw new Error(domainError.message);
  if (companyError) throw new Error(companyError.message);

  const allRows: MergeDomainRow[] = (domainRows ?? []).map((row) => ({
    id: String(row.id),
    company_id: String(row.company_id),
    domain: String(row.domain),
    is_primary: row.is_primary === true,
  }));

  const canonicalDomainRows = allRows.filter(
    (row) => row.company_id === input.canonicalCompanyId,
  );
  const duplicateDomainRows = allRows.filter(
    (row) => row.company_id === input.duplicateCompanyId,
  );

  const foreignOwnerByIdentity = buildForeignOwnerByIdentity({
    canonicalCompanyId: input.canonicalCompanyId,
    duplicateCompanyId: input.duplicateCompanyId,
    allDomainRows: allRows,
    activeCompanyDomains: (activeCompanies ?? []).map((row) => ({
      id: String(row.id),
      domain: typeof row.domain === "string" ? row.domain : null,
    })),
  });

  void pair;

  return {
    canonicalDomainRows,
    duplicateDomainRows,
    foreignOwnerByIdentity,
  };
}

export function enrichPreviewWithIdentityPlan(input: {
  preview: CompanyMergePreviewSnapshot;
  fieldResolutions: CompanyMergeFieldResolutions;
  canonicalDomainRows: readonly MergeDomainRow[];
  duplicateDomainRows: readonly MergeDomainRow[];
  foreignOwnerByIdentity: ReadonlyMap<string, string>;
}): {
  preview: CompanyMergePreviewWithIdentity;
  plan: ReturnType<typeof planMergeCompanyDomains>;
} {
  const plan = planMergeIdentityFromPreview(input);
  const withBlockers = applyIdentityBlockersToPreview(
    input.preview,
    mergeCompanyDomainsBlockerStrings(plan.blockers),
  );

  const identity_foreign_owners: Record<string, string> = {};
  for (const [key, value] of input.foreignOwnerByIdentity) {
    identity_foreign_owners[key] = value;
  }

  return {
    plan,
    preview: {
      ...withBlockers,
      verified_domains: {
        canonical: input.canonicalDomainRows.map((row) => ({
          id: row.id,
          domain: row.domain,
          is_primary: row.is_primary,
        })),
        duplicate: input.duplicateDomainRows.map((row) => ({
          id: row.id,
          domain: row.domain,
          is_primary: row.is_primary,
        })),
      },
      identity_foreign_owners,
    },
  };
}
