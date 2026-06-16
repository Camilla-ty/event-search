const COMPANY_LOGO_BUCKET = "company-logos";

/** True when the URL points at a public object in the company-logos Storage bucket. */
export function isCompanyLogoStorageUrl(url: string | null | undefined): boolean {
  const trimmed = url?.trim();
  if (!trimmed) return false;

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
