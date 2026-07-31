import { isCompanyRestricted } from "@/src/lib/companies/companyPublicRestriction";
import {
  buildSeriesHubPath,
  buildSponsorProfilePath,
} from "@/src/lib/routes/explorerUrls";
import { normalizeSeriesLifecycle } from "@/src/lib/seo/indexability";

/**
 * Safe public payload for Event Series ↔ Company same-brand reciprocal links (ADR-004 SB2).
 * Never include restricted / unavailable target fields in server props.
 */
export type PublicSameBrandLink = {
  href: string;
  name: string;
};

export type SameBrandCompanyCandidate = {
  id?: string | null;
  slug?: string | null;
  name?: string | null;
  status?: string | null;
  restricted_at?: string | null;
  merged_into_company_id?: string | null;
};

export type SameBrandSeriesCandidate = {
  id?: string | null;
  slug?: string | null;
  name?: string | null;
  lifecycle_status?: string | null;
};

function readName(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed !== "" ? trimmed : null;
}

/**
 * Series hub → Company profile. Returns null when the company must stay hidden.
 * Callers must not fall back to admin/restricted rows when this returns null.
 */
export function buildPublicSameBrandCompanyLink(
  company: SameBrandCompanyCandidate | null | undefined,
): PublicSameBrandLink | null {
  if (company === null || company === undefined) return null;
  if (isCompanyRestricted(company)) return null;

  const status =
    typeof company.status === "string" ? company.status.trim().toLowerCase() : "";
  if (status !== "" && status !== "active") return null;
  if (
    typeof company.merged_into_company_id === "string" &&
    company.merged_into_company_id.trim() !== ""
  ) {
    return null;
  }

  const href = buildSponsorProfilePath(company);
  if (href === null) return null;

  const name = readName(company.name);
  if (name === null) return null;

  return { href, name };
}

/**
 * Company profile → Event Brand (Series) hub. Hides merged / non-destination series.
 */
export function buildPublicSameBrandSeriesLink(
  series: SameBrandSeriesCandidate | null | undefined,
): PublicSameBrandLink | null {
  if (series === null || series === undefined) return null;
  if (normalizeSeriesLifecycle(series.lifecycle_status) === "merged") return null;

  const href = buildSeriesHubPath(series);
  if (href === null) return null;

  const name = readName(series.name);
  if (name === null) return null;

  return { href, name };
}
