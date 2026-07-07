import { isBucketRelativeStorageLogoPath } from "@/src/lib/storage/resolveStorageLogoDisplayUrl";

const COMPANY_LOGO_BUCKET = "company-logos";

/** True when the value points at a public object in the company-logos Storage bucket. */
export function isCompanyLogoStorageUrl(url: string | null | undefined): boolean {
  const trimmed = url?.trim();
  if (!trimmed) return false;

  if (isBucketRelativeStorageLogoPath(trimmed)) return true;

  try {
    const parsed = new URL(trimmed);
    const path = parsed.pathname;
    return (
      path.includes(`/storage/v1/object/public/${COMPANY_LOGO_BUCKET}/`) ||
      path.includes(`/object/public/${COMPANY_LOGO_BUCKET}/`)
    );
  } catch {
    return false;
  }
}
