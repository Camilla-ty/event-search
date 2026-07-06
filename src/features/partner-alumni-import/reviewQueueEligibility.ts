import { normalizeDomain } from "@/src/lib/domain/normalizeDomain";

import type { PartnerAlumniImportRow } from "./client/types";

export type BulkCreateNewBlockReason =
  | "resolved"
  | "excluded"
  | "blocking_validation"
  | "missing_company_name"
  | "not_loaded";

export function resolveRowCompanyName(row: PartnerAlumniImportRow): string {
  return (row.normalized_company_name ?? row.raw_company_name ?? "").trim();
}

export function resolveRowDomain(row: PartnerAlumniImportRow): string {
  const fromNormalized = (row.normalized_domain ?? "").trim();
  if (fromNormalized !== "") return fromNormalized;

  const website = (row.normalized_website ?? row.raw_website ?? "").trim();
  if (website === "") return "";

  return normalizeDomain(website).trim();
}

export function hasBlockingValidation(row: PartnerAlumniImportRow): boolean {
  return row.has_blocking_validation === true;
}

export function getBulkCreateNewBlockReason(
  row: PartnerAlumniImportRow,
): BulkCreateNewBlockReason | null {
  if (row.status === "resolved") return "resolved";
  if (row.status === "excluded") return "excluded";
  if (hasBlockingValidation(row)) return "blocking_validation";
  if (resolveRowCompanyName(row) === "") return "missing_company_name";
  return null;
}

export function isEligibleForBulkCreateNew(row: PartnerAlumniImportRow): boolean {
  return getBulkCreateNewBlockReason(row) === null;
}

export function isEligibleForBulkExclude(row: PartnerAlumniImportRow): boolean {
  return row.status !== "resolved" && row.status !== "excluded";
}

export function isSelectableReviewRow(row: PartnerAlumniImportRow): boolean {
  return isEligibleForBulkExclude(row);
}

export type BulkCreateNewButtonState = {
  enabled: boolean;
  eligibleCount: number;
  selectedCount: number;
  disabledReason: string | null;
};

export function getBulkCreateNewButtonState(
  selectedIds: Set<string>,
  rows: PartnerAlumniImportRow[],
  options: { loading: boolean; actionLoading: boolean },
): BulkCreateNewButtonState {
  const selectedCount = selectedIds.size;
  const rowById = new Map(rows.map((r) => [r.id, r]));

  const selectedRows: PartnerAlumniImportRow[] = [];
  let notLoaded = 0;
  for (const id of selectedIds) {
    const row = rowById.get(id);
    if (row) selectedRows.push(row);
    else notLoaded += 1;
  }

  const eligibleCount = selectedRows.filter(isEligibleForBulkCreateNew).length;

  if (options.loading || options.actionLoading) {
    return { enabled: false, eligibleCount, selectedCount, disabledReason: null };
  }

  if (selectedCount === 0) {
    return { enabled: false, eligibleCount: 0, selectedCount: 0, disabledReason: "Select rows first" };
  }

  if (notLoaded > 0) {
    return {
      enabled: false,
      eligibleCount,
      selectedCount,
      disabledReason: "Selected rows are not loaded — use Select all matching filter again",
    };
  }

  if (eligibleCount > 0) {
    return { enabled: true, eligibleCount, selectedCount, disabledReason: null };
  }

  return {
    enabled: false,
    eligibleCount: 0,
    selectedCount,
    disabledReason: "Selected rows are already resolved, excluded, or blocked",
  };
}
