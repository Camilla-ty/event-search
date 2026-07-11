export const RESTRICTED_COMPANY_PUBLIC_MESSAGE =
  "This company is not publicly displayed in accordance with EventPixels' content policy.";

/** Short label for sponsor roster rows (domain column position). */
export const RESTRICTED_COMPANY_ROSTER_LABEL =
  "This company is not publicly displayed.";

export function isCompanyRestricted(company: {
  restricted_at?: string | null;
} | null | undefined): boolean {
  if (company === null || company === undefined) return false;
  return company.restricted_at !== null && company.restricted_at !== undefined;
}
