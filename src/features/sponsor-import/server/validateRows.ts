import { normalizeDomain } from "@/src/lib/domain/normalizeDomain";
import { slugify } from "@/src/lib/slugify";

import type { ValidationIssue } from "../types";

export type RowValidationInput = {
  id: string;
  excel_row_number: number;
  raw_company_name: string | null;
  raw_website: string | null;
  raw_tier_rank: number | null;
  status: string;
};

export type RowValidationOutput = {
  normalized_company_name: string | null;
  normalized_website: string | null;
  normalized_domain: string | null;
  proposed_slug: string | null;
  mapped_tier_rank: number | null;
  validation_issues: ValidationIssue[];
  has_blocking_validation: boolean;
  duplicate_cluster_key: string | null;
  duplicate_role: "canonical" | "duplicate" | null;
  duplicate_of_row_id: string | null;
  duplicate_resolution: "pending" | "kept" | "excluded" | null;
};

function buildIssues(input: RowValidationInput): {
  issues: ValidationIssue[];
  normalized_company_name: string | null;
  normalized_website: string | null;
  normalized_domain: string | null;
  proposed_slug: string | null;
  mapped_tier_rank: number | null;
} {
  const issues: ValidationIssue[] = [];
  const name = input.raw_company_name?.trim() ?? "";
  const websiteRaw = input.raw_website?.trim() ?? "";
  const normalized_company_name = name || null;
  const normalized_website = websiteRaw || null;
  const normalized_domain = websiteRaw ? normalizeDomain(websiteRaw) : null;
  const proposed_slug = name ? slugify(name) : null;

  if (!name) {
    issues.push({
      type: "missing_company_name",
      severity: "blocking",
      message: "Company name is required.",
    });
  }

  if (!websiteRaw) {
    issues.push({
      type: "missing_website",
      severity: "blocking",
      message: "Website is required.",
    });
  } else if (!normalized_domain) {
    issues.push({
      type: "invalid_website",
      severity: "blocking",
      message: "Website could not be parsed into a domain.",
    });
  }

  let mapped_tier_rank: number | null = null;
  if (input.raw_tier_rank === null) {
    issues.push({
      type: "missing_tier",
      severity: "blocking",
      message: "Tier rank is required and must be an integer.",
    });
  } else if (!Number.isInteger(input.raw_tier_rank) || input.raw_tier_rank < 1) {
    issues.push({
      type: "invalid_tier",
      severity: "blocking",
      message: "Tier rank must be an integer >= 1.",
    });
  } else {
    mapped_tier_rank = input.raw_tier_rank;
  }

  return {
    issues,
    normalized_company_name,
    normalized_website,
    normalized_domain,
    proposed_slug,
    mapped_tier_rank,
  };
}

export function validateRow(input: RowValidationInput): RowValidationOutput {
  const base = buildIssues(input);
  const has_blocking_validation = base.issues.some((i) => i.severity === "blocking");

  return {
    ...base,
    validation_issues: base.issues,
    has_blocking_validation,
    duplicate_cluster_key: null,
    duplicate_role: null,
    duplicate_of_row_id: null,
    duplicate_resolution: null,
  };
}

export type ValidatedImportRow = RowValidationOutput & {
  id: string;
  excel_row_number: number;
  status: string;
};

/** Assign duplicate-in-file clusters by normalized_domain (fallback: company name). */
export function assignDuplicateClusters(rows: ValidatedImportRow[]): ValidatedImportRow[] {
  const eligible = rows.filter((r) => !r.has_blocking_validation && r.status !== "excluded");
  const clusterMap = new Map<string, string[]>();

  for (const row of eligible) {
    const key =
      row.normalized_domain?.toLowerCase() ??
      row.normalized_company_name?.toLowerCase() ??
      `row-${row.excel_row_number}`;
    const list = clusterMap.get(key) ?? [];
    list.push(row.id);
    clusterMap.set(key, list);
  }

  const canonicalByRow = new Map<string, { clusterKey: string; canonicalId: string }>();
  for (const [clusterKey, ids] of clusterMap) {
    if (ids.length <= 1) continue;
    const sorted = [...ids].sort((a, b) => {
      const rowA = rows.find((r) => r.id === a);
      const rowB = rows.find((r) => r.id === b);
      return (rowA?.excel_row_number ?? 0) - (rowB?.excel_row_number ?? 0);
    });
    const canonicalId = sorted[0];
    if (!canonicalId) continue;
    for (const id of sorted) {
      canonicalByRow.set(id, { clusterKey, canonicalId });
    }
  }

  return rows.map((row) => {
    const cluster = canonicalByRow.get(row.id);
    if (!cluster) {
      return {
        ...row,
        duplicate_cluster_key: row.normalized_domain ?? null,
        duplicate_role: null,
        duplicate_of_row_id: null,
        duplicate_resolution: null,
      };
    }

    const isCanonical = row.id === cluster.canonicalId;
    return {
      ...row,
      duplicate_cluster_key: cluster.clusterKey,
      duplicate_role: isCanonical ? "canonical" : "duplicate",
      duplicate_of_row_id: isCanonical ? null : cluster.canonicalId,
      duplicate_resolution: isCanonical ? null : "pending",
    };
  });
}
