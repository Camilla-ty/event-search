import { buildSeriesHubPath } from "@/src/lib/routes/explorerUrls";
import { normalizeSeriesLifecycle } from "@/src/lib/seo/indexability";

/** Company has Event Brand public-profile approval (ADR-005 EB0). */
export function isEventBrandPublicProfileApproved(
  approvedAt: string | null | undefined,
): boolean {
  return typeof approvedAt === "string" && approvedAt.trim() !== "";
}

export const EVENT_BRAND_PUBLIC_PROFILE_NO_SERIES_MESSAGE =
  "Approve only after this company is linked as the same-brand profile for an Event Series. Manage the link on the Event Series admin page first.";

export const EVENT_BRAND_PUBLIC_PROFILE_SERIES_UNAVAILABLE_MESSAGE =
  "The linked Event Series is not publicly resolvable (for example merged without a public successor). Fix or relink the same-brand Series before approving.";

export const EVENT_BRAND_PUBLIC_PROFILE_UNLINK_BLOCKED_MESSAGE =
  "This company is approved to use its linked Event Series as the public profile. Revoke Event Brand public-profile approval on the Company admin page before unlinking or replacing the same-brand relationship.";

export const EVENT_BRAND_PUBLIC_PROFILE_ALREADY_APPROVED_MESSAGE =
  "Event Brand public-profile approval is already active for this company.";

export const EVENT_BRAND_PUBLIC_PROFILE_NOT_APPROVED_MESSAGE =
  "Event Brand public-profile approval is not active for this company.";

export type EventBrandPublicProfileSeriesCandidate = {
  id?: string | null;
  slug?: string | null;
  name?: string | null;
  lifecycle_status?: string | null;
};

/**
 * Series is a safe future public destination for Event Brand profile routing.
 * Active and discontinued hubs are OK; merged series are not (no tombstone target).
 */
export function isSeriesPubliclyResolvableForEventBrandProfile(
  series: EventBrandPublicProfileSeriesCandidate | null | undefined,
): boolean {
  if (series === null || series === undefined) return false;
  if (normalizeSeriesLifecycle(series.lifecycle_status) === "merged") return false;
  return buildSeriesHubPath(series) !== null;
}

export type ValidateEventBrandPublicProfileApprovalInput = {
  /** `approve` sets timestamptz; `revoke` clears to null. */
  action: "approve" | "revoke";
  currentApprovedAt: string | null | undefined;
  sameBrandSeries: EventBrandPublicProfileSeriesCandidate | null;
};

export type ValidateEventBrandPublicProfileApprovalResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Validates Admin approve / revoke for `companies.event_brand_public_profile_approved_at`.
 * Does not write the column. Does not change Sponsor/Organizer/Exhibitor data.
 */
export function validateEventBrandPublicProfileApproval(
  input: ValidateEventBrandPublicProfileApprovalInput,
): ValidateEventBrandPublicProfileApprovalResult {
  if (input.action === "revoke") {
    if (!isEventBrandPublicProfileApproved(input.currentApprovedAt)) {
      return { ok: false, error: EVENT_BRAND_PUBLIC_PROFILE_NOT_APPROVED_MESSAGE };
    }
    return { ok: true };
  }

  if (isEventBrandPublicProfileApproved(input.currentApprovedAt)) {
    return { ok: false, error: EVENT_BRAND_PUBLIC_PROFILE_ALREADY_APPROVED_MESSAGE };
  }

  if (input.sameBrandSeries === null) {
    return { ok: false, error: EVENT_BRAND_PUBLIC_PROFILE_NO_SERIES_MESSAGE };
  }

  if (!isSeriesPubliclyResolvableForEventBrandProfile(input.sameBrandSeries)) {
    return { ok: false, error: EVENT_BRAND_PUBLIC_PROFILE_SERIES_UNAVAILABLE_MESSAGE };
  }

  return { ok: true };
}
