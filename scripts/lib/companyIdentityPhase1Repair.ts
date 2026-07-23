/**
 * Pure planning for Company Identity Phase 1 legacy repair.
 * Uses resolveCompanyWebsiteIdentity as the only normalizer.
 */

import { resolveCompanyWebsiteIdentity } from "@/src/lib/domain/hostedPlatformWebsite";
import {
  planSyncCompanyPrimaryDomain,
  type CompanyDomainSyncRow,
  type SyncCompanyPrimaryDomainPlan,
} from "@/src/features/companies/server/syncCompanyPrimaryDomain";

export type Phase1RepairCompany = {
  id: string;
  name: string;
  website: string | null;
  domain: string | null;
};

export type Phase1RepairDomainRow = CompanyDomainSyncRow;

export type Phase1PrimaryAction = Extract<
  SyncCompanyPrimaryDomainPlan,
  | { action: "promote_existing" }
  | { action: "insert_primary" }
  | { action: "demote_then_insert" }
>;

export type Phase1RepairDecision =
  | {
      status: "repair";
      companyId: string;
      name: string;
      /** Exact stored website string — never rewritten. */
      website: string;
      beforeDomain: string | null;
      afterDomain: string;
      setCompanyDomain: boolean;
      beforePrimaryDomain: string | null;
      afterPrimaryDomain: string;
      /** Null when primary already matches and only companies.domain needs update. */
      primaryAction: Phase1PrimaryAction | null;
      beforeDomainRows: Phase1RepairDomainRow[];
    }
  | {
      status: "unchanged";
      companyId: string;
      name: string;
      website: string | null;
      domain: string | null;
    }
  | {
      status:
        | "skipped_blank_website"
        | "skipped_no_identity"
        | "skipped_unparseable"
        | "skipped_multi_primary"
        | "skipped_conflict";
      companyId: string;
      name: string;
      website: string | null;
      domain: string | null;
      reason: string;
      resolved?: string;
    };

function normalizeKey(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized === "" ? null : normalized;
}

/**
 * Plan a single active company repair against current resolver rules.
 * `foreignOwnersOfDesiredIdentity` must include other companies that already
 * own the desired key via companies.domain OR any company_domains row.
 */
export function planCompanyIdentityPhase1Repair(input: {
  company: Phase1RepairCompany;
  companyDomainRows: readonly Phase1RepairDomainRow[];
  foreignOwnersOfDesiredIdentity: readonly { company_id: string }[];
}): Phase1RepairDecision {
  const { company, companyDomainRows } = input;
  const websiteRaw = company.website;
  const website = websiteRaw?.trim() ?? "";

  if (website === "") {
    return {
      status: "skipped_blank_website",
      companyId: company.id,
      name: company.name,
      website: websiteRaw,
      domain: company.domain,
      reason: "No website to derive an identity from.",
    };
  }

  const identity = resolveCompanyWebsiteIdentity(website);
  if (identity.status === "unparseable") {
    return {
      status: "skipped_unparseable",
      companyId: company.id,
      name: company.name,
      website: websiteRaw,
      domain: company.domain,
      reason: "Website is unparseable under resolveCompanyWebsiteIdentity.",
    };
  }
  if (identity.status === "no_identity") {
    return {
      status: "skipped_no_identity",
      companyId: company.id,
      name: company.name,
      website: websiteRaw,
      domain: company.domain,
      reason: "Website resolves to no_identity; left unchanged.",
    };
  }

  const desiredDomain = identity.domain;
  const desiredKey = normalizeKey(desiredDomain);
  if (!desiredKey) {
    return {
      status: "skipped_unparseable",
      companyId: company.id,
      name: company.name,
      website: websiteRaw,
      domain: company.domain,
      reason: "Resolved identity key was empty.",
    };
  }

  const primaries = companyDomainRows.filter((row) => row.is_primary);
  if (primaries.length > 1) {
    return {
      status: "skipped_multi_primary",
      companyId: company.id,
      name: company.name,
      website: websiteRaw,
      domain: company.domain,
      reason: `Company has ${primaries.length} primary company_domains rows.`,
      resolved: desiredDomain,
    };
  }

  if (input.foreignOwnersOfDesiredIdentity.length > 0) {
    return {
      status: "skipped_conflict",
      companyId: company.id,
      name: company.name,
      website: websiteRaw,
      domain: company.domain,
      reason: `Identity "${desiredDomain}" is owned by another company.`,
      resolved: desiredDomain,
    };
  }

  const setCompanyDomain = normalizeKey(company.domain) !== desiredKey;
  const syncPlan = planSyncCompanyPrimaryDomain({
    desiredDomain,
    companyDomainRows,
    foreignOwnersOfDesiredDomain: [],
  });

  if (syncPlan.action === "conflict") {
    return {
      status: "skipped_conflict",
      companyId: company.id,
      name: company.name,
      website: websiteRaw,
      domain: company.domain,
      reason: `Identity "${desiredDomain}" conflicts on company_domains.`,
      resolved: desiredDomain,
    };
  }

  if (syncPlan.action === "demote_all_primary") {
    return {
      status: "skipped_unparseable",
      companyId: company.id,
      name: company.name,
      website: websiteRaw,
      domain: company.domain,
      reason: "Unexpected demote_all_primary for a non-null identity.",
      resolved: desiredDomain,
    };
  }

  if (!setCompanyDomain && syncPlan.action === "noop") {
    return {
      status: "unchanged",
      companyId: company.id,
      name: company.name,
      website: websiteRaw,
      domain: company.domain,
    };
  }

  return {
    status: "repair",
    companyId: company.id,
    name: company.name,
    website: websiteRaw as string,
    beforeDomain: company.domain,
    afterDomain: desiredDomain,
    setCompanyDomain,
    beforePrimaryDomain: primaries[0]?.domain ?? null,
    afterPrimaryDomain: desiredDomain,
    primaryAction: syncPlan.action === "noop" ? null : syncPlan,
    beforeDomainRows: companyDomainRows.map((row) => ({ ...row })),
  };
}

/**
 * Build ownership index: lower(identity) → company ids claiming it via
 * companies.domain or any company_domains row.
 */
export function buildIdentityOwnerIndex(input: {
  companies: readonly Phase1RepairCompany[];
  domainRows: readonly (Phase1RepairDomainRow & { company_id: string })[];
}): Map<string, string[]> {
  const owners = new Map<string, string[]>();
  function claim(identity: string, companyId: string) {
    const key = normalizeKey(identity);
    if (!key) return;
    const list = owners.get(key) ?? [];
    if (!list.includes(companyId)) list.push(companyId);
    owners.set(key, list);
  }
  for (const company of input.companies) {
    if (company.domain) claim(company.domain, company.id);
  }
  for (const row of input.domainRows) {
    claim(row.domain, row.company_id);
  }
  return owners;
}

export function foreignOwnersForIdentity(
  owners: Map<string, string[]>,
  identity: string,
  companyId: string,
): { company_id: string }[] {
  const key = normalizeKey(identity);
  if (!key) return [];
  return (owners.get(key) ?? [])
    .filter((id) => id !== companyId)
    .map((company_id) => ({ company_id }));
}
