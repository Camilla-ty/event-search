const COMPANY_LOGO_BUCKET = "company-logos";

/** Canonical bucket-relative logo paths after the logo_url migration. */
export const BUCKET_RELATIVE_STORAGE_LOGO_PATTERN =
  /^(companies|event-series|venues)\/[^/]+\/logo\.[a-z0-9]+$/i;

/** Any non-URL path under a known company-logos prefix (includes legacy folders). */
const BUCKET_RELATIVE_PREFIX_PATTERN = /^(companies|event-series|venues)\//;

export function isBucketRelativeStorageLogoPath(value: string | null | undefined): boolean {
  const trimmed = value?.trim() ?? "";
  if (trimmed === "" || trimmed.includes("://")) return false;
  return BUCKET_RELATIVE_PREFIX_PATTERN.test(trimmed);
}

function readSupabasePublicBaseUrl(override?: string | null): string | null {
  const base = (override ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  return base !== "" ? base.replace(/\/+$/, "") : null;
}

/**
 * Resolve a stored logo_url for display in <img src>.
 * Full URLs and external URLs pass through unchanged.
 * Bucket-relative paths become public Storage URLs.
 */
export function resolveStorageLogoDisplayUrl(
  logoUrl: string | null | undefined,
  supabasePublicUrl?: string | null,
): string | null {
  const trimmed = logoUrl?.trim() ?? "";
  if (trimmed === "") return null;

  if (!isBucketRelativeStorageLogoPath(trimmed)) {
    return trimmed;
  }

  const base = readSupabasePublicBaseUrl(supabasePublicUrl);
  if (!base) return null;

  return `${base}/storage/v1/object/public/${COMPANY_LOGO_BUCKET}/${trimmed}`;
}
