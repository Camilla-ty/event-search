import { isBucketRelativeStorageLogoPath } from "@/src/lib/storage/resolveStorageLogoDisplayUrl";

const COMPANY_LOGO_BUCKET = "company-logos";

/**
 * Normalize a stored logo reference (full public URL or bucket-relative path)
 * to a bucket-relative path under company-logos.
 */
export function bucketRelativePathFromLogoReference(
  reference: string | null | undefined,
): string | null {
  const trimmed = reference?.trim();
  if (!trimmed) return null;

  if (isBucketRelativeStorageLogoPath(trimmed)) {
    return trimmed;
  }

  let pathname: string;
  try {
    pathname = new URL(trimmed).pathname;
  } catch {
    return null;
  }

  const markers = [
    `/storage/v1/object/public/${COMPANY_LOGO_BUCKET}/`,
    `/object/public/${COMPANY_LOGO_BUCKET}/`,
  ];

  for (const marker of markers) {
    const markerIndex = pathname.indexOf(marker);
    if (markerIndex !== -1) {
      return pathname.slice(markerIndex + marker.length);
    }
  }

  return null;
}
