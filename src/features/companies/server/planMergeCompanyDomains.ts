/**
 * Pure planning for merge-time company_domains reconciliation.
 * Primary Identity = winner of field_resolutions.domain.
 * Website identity (resolveCompanyWebsiteIdentity) must not disagree with Primary.
 */

import { resolveCompanyWebsiteIdentity } from "@/src/lib/domain/hostedPlatformWebsite";

export type MergeDomainRow = {
  id: string;
  company_id: string;
  domain: string;
  is_primary: boolean;
};

export type MergeTextFieldStrategy = "canonical" | "duplicate" | "non_empty";

export type MergeCompanyDomainsBlockerCode =
  | "merge_company_domain_third_party"
  | "merge_website_primary_identity_mismatch"
  | "merge_website_unparseable"
  | "merge_website_no_identity_with_primary"
  | "merge_website_identity_without_primary";

export type MergeCompanyDomainsBlocker = {
  code: MergeCompanyDomainsBlockerCode;
  message: string;
  identity?: string;
  ownerCompanyId?: string;
};

export type MergeCompanyDomainsPlan = {
  winnerDomain: string | null;
  winnerWebsite: string | null;
  websiteIdentityKey: string | null;
  websiteIdentityStatus: "domain" | "no_identity" | "blank" | "unparseable";
  blockers: MergeCompanyDomainsBlocker[];
  /** Duplicate rows to delete because canonical already owns the same lower(domain). */
  deleteDuplicateRowIds: string[];
  /** Duplicate rows to reassign to canonical. */
  moveDuplicateRowIds: string[];
  /** After moves: set all primary=false then promote/insert this key (null → demote all). */
  primaryDomain: string | null;
};

function normalizeKey(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized === "" ? null : normalized;
}

export function pickMergeTextField(
  canonical: string | null | undefined,
  duplicate: string | null | undefined,
  strategy: MergeTextFieldStrategy,
): string | null {
  const c = canonical?.trim() ? canonical.trim() : null;
  const d = duplicate?.trim() ? duplicate.trim() : null;
  if (strategy === "duplicate") return d;
  if (strategy === "non_empty") return c ?? d;
  return c;
}

function blockerMessage(code: MergeCompanyDomainsBlockerCode, identity?: string): string {
  switch (code) {
    case "merge_company_domain_third_party":
      return identity
        ? `Identity "${identity}" is owned by another company. Resolve that conflict before merging.`
        : "A verified identity is owned by another company. Resolve that conflict before merging.";
    case "merge_website_primary_identity_mismatch":
      return "Resolved website identity must match the selected Primary Identity (domain).";
    case "merge_website_unparseable":
      return "Selected website is not a usable URL. Fix the website before merging.";
    case "merge_website_no_identity_with_primary":
      return "Selected website has no Match Key, but a Primary Identity is selected. Align website and domain before merging.";
    case "merge_website_identity_without_primary":
      return "Selected website resolves to a Match Key, but Primary Identity (domain) is empty. Align website and domain before merging.";
  }
}

/**
 * Plan company_domains transfer + Primary sync for a merge.
 * `foreignOwners` = companies other than canonical/duplicate that own an identity
 * via company_domains OR active companies.domain.
 */
export function planMergeCompanyDomains(input: {
  canonicalCompanyId: string;
  duplicateCompanyId: string;
  canonicalDomain: string | null;
  duplicateDomain: string | null;
  canonicalWebsite: string | null;
  duplicateWebsite: string | null;
  domainStrategy: MergeTextFieldStrategy;
  websiteStrategy: MergeTextFieldStrategy;
  canonicalDomainRows: readonly MergeDomainRow[];
  duplicateDomainRows: readonly MergeDomainRow[];
  /** Map of lower(identity) → owner company id (third parties only). */
  foreignOwnerByIdentity: ReadonlyMap<string, string>;
}): MergeCompanyDomainsPlan {
  const winnerDomainRaw = pickMergeTextField(
    input.canonicalDomain,
    input.duplicateDomain,
    input.domainStrategy,
  );
  const winnerWebsiteRaw = pickMergeTextField(
    input.canonicalWebsite,
    input.duplicateWebsite,
    input.websiteStrategy,
  );
  const winnerDomain = normalizeKey(winnerDomainRaw);
  // Preserve byte-for-byte website string for assertions / apply; identity uses trim.
  const winnerWebsite = winnerWebsiteRaw;
  const winnerWebsiteTrimmed = winnerWebsite?.trim() ?? "";

  const blockers: MergeCompanyDomainsBlocker[] = [];

  let websiteIdentityKey: string | null = null;
  let websiteIdentityStatus: MergeCompanyDomainsPlan["websiteIdentityStatus"] = "blank";

  if (winnerWebsiteTrimmed === "") {
    websiteIdentityStatus = "blank";
  } else {
    const resolved = resolveCompanyWebsiteIdentity(winnerWebsiteTrimmed);
    if (resolved.status === "unparseable") {
      websiteIdentityStatus = "unparseable";
      blockers.push({
        code: "merge_website_unparseable",
        message: blockerMessage("merge_website_unparseable"),
      });
    } else if (resolved.status === "no_identity") {
      websiteIdentityStatus = "no_identity";
      if (winnerDomain !== null) {
        blockers.push({
          code: "merge_website_no_identity_with_primary",
          message: blockerMessage("merge_website_no_identity_with_primary"),
        });
      }
    } else {
      websiteIdentityStatus = "domain";
      websiteIdentityKey = normalizeKey(resolved.domain);
      if (winnerDomain === null) {
        blockers.push({
          code: "merge_website_identity_without_primary",
          message: blockerMessage("merge_website_identity_without_primary"),
          identity: websiteIdentityKey ?? undefined,
        });
      } else if (websiteIdentityKey !== winnerDomain) {
        blockers.push({
          code: "merge_website_primary_identity_mismatch",
          message: blockerMessage("merge_website_primary_identity_mismatch"),
          identity: websiteIdentityKey ?? undefined,
        });
      }
    }
  }

  const identitiesToClaim = new Set<string>();
  for (const row of input.canonicalDomainRows) {
    const key = normalizeKey(row.domain);
    if (key) identitiesToClaim.add(key);
  }
  for (const row of input.duplicateDomainRows) {
    const key = normalizeKey(row.domain);
    if (key) identitiesToClaim.add(key);
  }
  if (winnerDomain) identitiesToClaim.add(winnerDomain);

  for (const identity of identitiesToClaim) {
    const owner = input.foreignOwnerByIdentity.get(identity);
    if (owner) {
      blockers.push({
        code: "merge_company_domain_third_party",
        message: blockerMessage("merge_company_domain_third_party", identity),
        identity,
        ownerCompanyId: owner,
      });
    }
  }

  const canonicalKeys = new Set(
    input.canonicalDomainRows
      .map((row) => normalizeKey(row.domain))
      .filter((key): key is string => key !== null),
  );

  const deleteDuplicateRowIds: string[] = [];
  const moveDuplicateRowIds: string[] = [];
  for (const row of input.duplicateDomainRows) {
    const key = normalizeKey(row.domain);
    if (!key) continue;
    if (canonicalKeys.has(key)) {
      deleteDuplicateRowIds.push(row.id);
    } else {
      moveDuplicateRowIds.push(row.id);
    }
  }

  return {
    winnerDomain: winnerDomainRaw?.trim() ? winnerDomainRaw.trim() : null,
    winnerWebsite: winnerWebsiteTrimmed === "" ? null : winnerWebsite,
    websiteIdentityKey,
    websiteIdentityStatus,
    blockers,
    deleteDuplicateRowIds,
    moveDuplicateRowIds,
    primaryDomain: winnerDomainRaw?.trim() ? winnerDomainRaw.trim() : null,
  };
}

/** Flatten blockers to preview string codes (stable, UI-friendly). */
export function mergeCompanyDomainsBlockerStrings(
  blockers: readonly MergeCompanyDomainsBlocker[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const blocker of blockers) {
    const token = blocker.identity
      ? `${blocker.code}:${blocker.identity}`
      : blocker.code;
    if (seen.has(token)) continue;
    seen.add(token);
    out.push(blocker.message);
  }
  return out;
}

export function buildForeignOwnerByIdentity(input: {
  canonicalCompanyId: string;
  duplicateCompanyId: string;
  /** All company_domains rows (any company). */
  allDomainRows: readonly { company_id: string; domain: string }[];
  /** Active companies with non-null domain. */
  activeCompanyDomains: readonly { id: string; domain: string | null }[];
}): Map<string, string> {
  const pair = new Set([input.canonicalCompanyId, input.duplicateCompanyId]);
  const map = new Map<string, string>();

  for (const row of input.allDomainRows) {
    if (pair.has(row.company_id)) continue;
    const key = normalizeKey(row.domain);
    if (!key || map.has(key)) continue;
    map.set(key, row.company_id);
  }

  for (const company of input.activeCompanyDomains) {
    if (pair.has(company.id)) continue;
    const key = normalizeKey(company.domain);
    if (!key || map.has(key)) continue;
    map.set(key, company.id);
  }

  return map;
}
