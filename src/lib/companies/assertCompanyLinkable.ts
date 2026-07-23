/**
 * Shared gate for edition↔company link creates (exhibitors first; prefer reuse for
 * sponsors/organizers later). Search filtering alone is not sufficient.
 */

export const COMPANY_NOT_LINKABLE_MESSAGE =
  "Only active companies can be linked. Merged companies cannot be linked.";

export type CompanyLinkabilityRow = {
  status: string | null | undefined;
  merged_into_company_id?: string | null;
};

export function isCompanyLinkable(company: CompanyLinkabilityRow | null | undefined): boolean {
  if (company === null || company === undefined) return false;
  if (company.status !== "active") return false;
  if (company.merged_into_company_id) return false;
  return true;
}

export function assertCompanyLinkable(company: CompanyLinkabilityRow | null | undefined): void {
  if (!isCompanyLinkable(company)) {
    throw new Error(COMPANY_NOT_LINKABLE_MESSAGE);
  }
}
