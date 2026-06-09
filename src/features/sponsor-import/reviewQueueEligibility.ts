import type { SponsorImportRow } from "./client/types";

/** Rows that can receive bulk create-new (resolved at import-to-draft). */
export function isEligibleForBulkCreateNew(row: SponsorImportRow): boolean {
  if (row.status === "resolved" || row.status === "excluded") return false;
  if (row.has_blocking_validation) return false;
  const name = (row.normalized_company_name ?? row.raw_company_name ?? "").trim();
  const domain = (row.normalized_domain ?? "").trim();
  return name !== "" && domain !== "";
}

/** Rows that can receive bulk exclude. */
export function isEligibleForBulkExclude(row: SponsorImportRow): boolean {
  return row.status !== "resolved" && row.status !== "excluded";
}

/** Rows that show a selectable checkbox in the review queue. */
export function isSelectableReviewRow(row: SponsorImportRow): boolean {
  return isEligibleForBulkExclude(row);
}
