import {
  isEventBrandPublicProfileApproved,
  isSeriesPubliclyResolvableForEventBrandProfile,
  type EventBrandPublicProfileSeriesCandidate,
} from "@/src/lib/companies/eventBrandPublicProfile";
import { isCompanyRestricted } from "@/src/lib/companies/companyPublicRestriction";
import {
  buildSeriesHubPath,
  buildSponsorProfilePath,
} from "@/src/lib/routes/explorerUrls";

/**
 * Company inputs for ADR-005 EB1 public destination resolution.
 * Callers supply the reverse same-brand Series when known (or null).
 */
export type PublicCompanyDestinationCompany = {
  id?: string | null;
  slug?: string | null;
  status?: string | null;
  restricted_at?: string | null;
  merged_into_company_id?: string | null;
  event_brand_public_profile_approved_at?: string | null;
};

export type PublicCompanyDestinationKind = "sponsor_profile" | "event_series_hub";

export type PublicCompanyDestination = {
  href: string;
  kind: PublicCompanyDestinationKind;
};

export type ResolvePublicCompanyDestinationInput = {
  company: PublicCompanyDestinationCompany;
  /** Reverse same-brand Series (`event_series.company_profile_id = company.id`), if any. */
  sameBrandSeries?: EventBrandPublicProfileSeriesCandidate | null;
};

function isCompanyPubliclyUsable(
  company: PublicCompanyDestinationCompany,
): boolean {
  if (isCompanyRestricted(company)) return false;

  const status =
    typeof company.status === "string" ? company.status.trim().toLowerCase() : "";
  // Empty status treated as usable (matches lighter callers that only pass slug/id).
  if (status !== "" && status !== "active") return false;

  if (
    typeof company.merged_into_company_id === "string" &&
    company.merged_into_company_id.trim() !== ""
  ) {
    return false;
  }

  return true;
}

function sponsorDestination(
  company: PublicCompanyDestinationCompany,
): PublicCompanyDestination | null {
  const href = buildSponsorProfilePath(company);
  if (href === null) return null;
  return { href, kind: "sponsor_profile" };
}

/**
 * Central public destination for a Company profile (ADR-005 EB1).
 *
 * Rules:
 * - Restricted / merged / inactive / no sponsor path → `null`
 * - Not Event Brand–approved → `/sponsors/{slug|id}`
 * - Approved + publicly resolvable same-brand Series → `/events/series/{slug|id}` (root only)
 * - Approved but Series missing/unavailable → fall back to `/sponsors/{slug|id}`
 *
 * Does not change `buildSponsorProfilePath`. Not wired to public UI in EB1.
 */
export function resolvePublicCompanyDestination(
  input: ResolvePublicCompanyDestinationInput,
): PublicCompanyDestination | null {
  const { company } = input;
  if (!isCompanyPubliclyUsable(company)) return null;

  const sponsor = sponsorDestination(company);
  if (sponsor === null) return null;

  if (!isEventBrandPublicProfileApproved(company.event_brand_public_profile_approved_at)) {
    return sponsor;
  }

  const series = input.sameBrandSeries ?? null;
  if (
    series !== null &&
    isSeriesPubliclyResolvableForEventBrandProfile(series)
  ) {
    const seriesHref = buildSeriesHubPath(series);
    if (seriesHref !== null) {
      return { href: seriesHref, kind: "event_series_hub" };
    }
  }

  return sponsor;
}

/** Convenience: href only (or null). */
export function buildPublicCompanyHref(
  input: ResolvePublicCompanyDestinationInput,
): string | null {
  return resolvePublicCompanyDestination(input)?.href ?? null;
}

/**
 * EB2 soft retirement: approved Event Brand Company with a publicly resolvable
 * Series hub — Sponsor Profile should be noindex / sitemap-excluded.
 * EB3 uses the same gate for temporary `/sponsors/...` → Series hub redirects.
 */
export function isEventBrandCompanyPublicProfileSoftRetired(
  input: ResolvePublicCompanyDestinationInput,
): boolean {
  return resolvePublicCompanyDestination(input)?.kind === "event_series_hub";
}

/**
 * EB3: temporary redirect target for direct Sponsor Profile visits.
 * Returns Series hub root (no query) when soft-retired; otherwise `null` (render profile).
 */
export function resolveEventBrandSponsorProfileRedirect(
  input: ResolvePublicCompanyDestinationInput,
): string | null {
  const destination = resolvePublicCompanyDestination(input);
  if (destination?.kind !== "event_series_hub") return null;
  return destination.href;
}
