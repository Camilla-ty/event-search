import { normalizeDomain } from "@/src/lib/domain/normalizeDomain";

import type { ExhibitorImportRow } from "./client/types";

export type BulkCreateNewBlockReason =
  | "resolved"
  | "excluded"
  | "blocking_validation"
  | "missing_company_name"
  | "missing_domain"
  | "not_loaded";

export function resolveRowCompanyName(row: ExhibitorImportRow): string {
  return (row.normalized_company_name ?? row.raw_company_name ?? "").trim();
}

export function resolveRowDomain(row: ExhibitorImportRow): string {
  const fromNormalized = (row.normalized_domain ?? "").trim();
  if (fromNormalized !== "") return fromNormalized;

  const website = (row.normalized_website ?? row.raw_website ?? "").trim();
  if (website === "") return "";

  return normalizeDomain(website).trim();
}

export function hasBlockingValidation(row: ExhibitorImportRow): boolean {
  return row.has_blocking_validation === true;
}

export function getBulkCreateNewBlockReason(row: ExhibitorImportRow): BulkCreateNewBlockReason | null {
  if (row.status === "resolved") return "resolved";
  if (row.status === "excluded") return "excluded";
  if (hasBlockingValidation(row)) return "blocking_validation";
  if (resolveRowCompanyName(row) === "") return "missing_company_name";
  return null;
}

/** Rows that can receive bulk create-new (resolved at import-to-draft). */
export function isEligibleForBulkCreateNew(row: ExhibitorImportRow): boolean {
  return getBulkCreateNewBlockReason(row) === null;
}

/** Rows that can receive bulk exclude. */
export function isEligibleForBulkExclude(row: ExhibitorImportRow): boolean {
  return row.status !== "resolved" && row.status !== "excluded";
}

/** Rows that show a selectable checkbox in the review queue. */
export function isSelectableReviewRow(row: ExhibitorImportRow): boolean {
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
  rows: ExhibitorImportRow[],
  options: { loading: boolean; actionLoading: boolean },
): BulkCreateNewButtonState {
  const selectedCount = selectedIds.size;
  const rowById = new Map(rows.map((r) => [r.id, r]));

  const selectedRows: ExhibitorImportRow[] = [];
  let notLoaded = 0;
  for (const id of selectedIds) {
    const row = rowById.get(id);
    if (row) selectedRows.push(row);
    else notLoaded += 1;
  }

  const eligibleCount = selectedRows.filter(isEligibleForBulkCreateNew).length;

  if (options.loading || options.actionLoading) {
    return {
      enabled: false,
      eligibleCount,
      selectedCount,
      disabledReason: null,
    };
  }

  if (selectedCount === 0) {
    return {
      enabled: false,
      eligibleCount: 0,
      selectedCount: 0,
      disabledReason: "Select rows first",
    };
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
    return {
      enabled: true,
      eligibleCount,
      selectedCount,
      disabledReason: null,
    };
  }

  const reasonCounts: Record<BulkCreateNewBlockReason, number> = {
    resolved: 0,
    excluded: 0,
    blocking_validation: 0,
    missing_company_name: 0,
    missing_domain: 0,
    not_loaded: 0,
  };

  for (const row of selectedRows) {
    const reason = getBulkCreateNewBlockReason(row);
    if (reason) reasonCounts[reason] += 1;
  }

  let disabledReason = "Selected rows are not eligible for create_new";

  if (reasonCounts.blocking_validation > 0) {
    disabledReason = "Rows have blocking validation issues";
  } else if (reasonCounts.missing_domain > 0) {
    disabledReason = "Missing website/domain on selected rows";
  } else if (reasonCounts.missing_company_name > 0) {
    disabledReason = "Missing company name on selected rows";
  } else if (reasonCounts.resolved > 0 || reasonCounts.excluded > 0) {
    disabledReason = "Selected rows are already resolved or excluded";
  }

  return {
    enabled: false,
    eligibleCount: 0,
    selectedCount,
    disabledReason,
  };
}
