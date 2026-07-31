import {
  COMPANY_NOT_LINKABLE_MESSAGE,
  isCompanyLinkable,
  type CompanyLinkabilityRow,
} from "@/src/lib/companies/assertCompanyLinkable";

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
};

export type ValidateSameBrandCompanyProfileAssignmentResult =
  | { ok: true; warnings: string[] }
  | { ok: false; error: string };

/**
 * Validates Admin link / replace / unlink for `event_series.company_profile_id`.
 * Unlink (`companyProfileId === null`) always succeeds.
 */
export function validateSameBrandCompanyProfileAssignment(
  input: ValidateSameBrandCompanyProfileAssignmentInput,
): ValidateSameBrandCompanyProfileAssignmentResult {
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
