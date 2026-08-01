import {
  COMPANY_NOT_LINKABLE_MESSAGE,
  isCompanyLinkable,
  type CompanyLinkabilityRow,
} from "@/src/lib/companies/assertCompanyLinkable";
import {
  EVENT_BRAND_PUBLIC_PROFILE_UNLINK_BLOCKED_MESSAGE,
  isEventBrandPublicProfileApproved,
} from "@/src/lib/companies/eventBrandPublicProfile";

/** Admin warning when linking a restricted company as same-brand (ADR-004 / SB1). */
export const SAME_BRAND_RESTRICTED_COMPANY_WARNING =
  "This company is restricted from public profiles. The same-brand link will be saved for admin use, but the public Event Brand page will not show a link to this company until it is unrestricted.";

export const SAME_BRAND_COMPANY_MISSING_MESSAGE =
  "Company not found. Choose an existing company profile.";

export const SAME_BRAND_SERIES_MERGED_MESSAGE =
  "Cannot link a same-brand company profile on a merged event series. Link on the successor series instead.";

export const SAME_BRAND_STALE_LINK_MESSAGE =
  "The linked company profile is no longer active (merged or unavailable). Unlink or replace it with an active company.";

export type SameBrandCompanyRow = CompanyLinkabilityRow & {
  id: string;
  name?: string | null;
  restricted_at?: string | null;
};

export type SameBrandOccupyingSeries = {
  id: string;
  name: string;
};

export function sameBrandUniquenessConflictMessage(seriesName: string): string {
  const label = seriesName.trim() || "another event series";
  return (
    `This company is already linked as the same-brand profile for event series “${label}”. ` +
    "Unlink it there first, or choose a different company."
  );
}

export function isCompanyRestrictedForSameBrand(
  company: Pick<SameBrandCompanyRow, "restricted_at"> | null | undefined,
): boolean {
  return typeof company?.restricted_at === "string" && company.restricted_at.trim() !== "";
}

/** True when a stored link points at a company that should not remain linked. */
export function isSameBrandCompanyProfileStale(
  company: SameBrandCompanyRow | null | undefined,
): boolean {
  return !isCompanyLinkable(company);
}

export type ValidateSameBrandCompanyProfileAssignmentInput = {
  seriesId: string;
  seriesLifecycleStatus: string | null | undefined;
  /** `null` = unlink. */
  companyProfileId: string | null;
  company: SameBrandCompanyRow | null;
  /** Another series that already owns this company_profile_id, if any. */
  occupyingSeries: SameBrandOccupyingSeries | null;
  /**
   * Currently linked company on this series (before the change), if any.
   * Used to block unlink/replace while Event Brand public-profile approval is active (ADR-005 EB0).
   */
  currentlyLinkedCompanyId?: string | null;
  currentlyLinkedCompanyApprovedAt?: string | null;
};

export type ValidateSameBrandCompanyProfileAssignmentResult =
  | { ok: true; warnings: string[] }
  | { ok: false; error: string };

/**
 * Validates Admin link / replace / unlink for `event_series.company_profile_id`.
 * Unlink/replace is blocked while the currently linked company has Event Brand
 * public-profile approval (revoke approval first).
 */
export function validateSameBrandCompanyProfileAssignment(
  input: ValidateSameBrandCompanyProfileAssignmentInput,
): ValidateSameBrandCompanyProfileAssignmentResult {
  const currentlyLinkedId =
    typeof input.currentlyLinkedCompanyId === "string" &&
    input.currentlyLinkedCompanyId.trim() !== ""
      ? input.currentlyLinkedCompanyId.trim()
      : null;
  const nextId = input.companyProfileId;
  const removesOrReplacesCurrent =
    currentlyLinkedId !== null && currentlyLinkedId !== nextId;

  if (
    removesOrReplacesCurrent &&
    isEventBrandPublicProfileApproved(input.currentlyLinkedCompanyApprovedAt)
  ) {
    return { ok: false, error: EVENT_BRAND_PUBLIC_PROFILE_UNLINK_BLOCKED_MESSAGE };
  }

  if (input.companyProfileId === null) {
    return { ok: true, warnings: [] };
  }

  const lifecycle =
    typeof input.seriesLifecycleStatus === "string"
      ? input.seriesLifecycleStatus.trim().toLowerCase()
      : "";
  if (lifecycle === "merged") {
    return { ok: false, error: SAME_BRAND_SERIES_MERGED_MESSAGE };
  }

  if (input.company === null) {
    return { ok: false, error: SAME_BRAND_COMPANY_MISSING_MESSAGE };
  }

  if (input.company.id !== input.companyProfileId) {
    return { ok: false, error: SAME_BRAND_COMPANY_MISSING_MESSAGE };
  }

  if (!isCompanyLinkable(input.company)) {
    return { ok: false, error: COMPANY_NOT_LINKABLE_MESSAGE };
  }

  if (
    input.occupyingSeries !== null &&
    input.occupyingSeries.id !== input.seriesId
  ) {
    return {
      ok: false,
      error: sameBrandUniquenessConflictMessage(input.occupyingSeries.name),
    };
  }

  const warnings: string[] = [];
  if (isCompanyRestrictedForSameBrand(input.company)) {
    warnings.push(SAME_BRAND_RESTRICTED_COMPANY_WARNING);
  }

  return { ok: true, warnings };
}
