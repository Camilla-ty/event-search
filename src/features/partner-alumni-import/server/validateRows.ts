import { resolveCompanyWebsiteIdentity } from "@/src/lib/domain/hostedPlatformWebsite";
import { slugify } from "@/src/lib/slugify";

import type { ValidationIssue } from "../types";
import {
  duplicateClusterKey,
  finalizeImportRowWebsites,
} from "@/src/features/sponsor-import/server/importWebsiteSelection";

export type RowValidationInput = {
  id: string;
  excel_row_number: number;
  raw_company_name: string | null;
  raw_website: string | null;
  raw_display_order: string | null;
  status: string;
};

export type RowValidationOutput = {
  normalized_company_name: string | null;
  normalized_website: string | null;
  normalized_domain: string | null;
  proposed_slug: string | null;
  mapped_display_order: number | null;
  validation_issues: ValidationIssue[];
  has_blocking_validation: boolean;
  duplicate_cluster_key: string | null;
  duplicate_role: "canonical" | "duplicate" | null;
  duplicate_of_row_id: string | null;
  duplicate_resolution: "pending" | "kept" | "excluded" | null;
};

function parseDisplayOrder(raw: string | null): number | null {
  if (!raw?.trim()) return null;
  const n = Number(raw.trim());
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

function buildIssues(input: RowValidationInput): {
  issues: ValidationIssue[];
  normalized_company_name: string | null;
  normalized_website: string | null;
  normalized_domain: string | null;
  proposed_slug: string | null;
  mapped_display_order: number | null;
} {
  const issues: ValidationIssue[] = [];
  const name = input.raw_company_name?.trim() ?? "";
  const websiteRaw = input.raw_website?.trim() ?? "";
  const normalized_company_name = name || null;
  const normalized_website = websiteRaw || null;
  const websiteIdentity = websiteRaw ? resolveCompanyWebsiteIdentity(websiteRaw) : null;
  const normalized_domain =
    websiteIdentity?.status === "domain" ? websiteIdentity.domain : null;
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
      severity: "warning",
      message: "No website — matching may rely on exact name only.",
    });
  } else if (websiteIdentity?.status === "unparseable") {
    issues.push({
      type: "invalid_website",
      severity: "blocking",
      message: "Website could not be parsed into a domain.",
    });
  } else if (websiteIdentity?.status === "no_identity") {
    issues.push({
      type: "community_website",
      severity: "warning",
      message:
        "Community/social link has no company domain — needs manual review before import.",
    });
  }

  let mapped_display_order: number | null = parseDisplayOrder(input.raw_display_order);
  if (input.raw_display_order?.trim() && mapped_display_order === null) {
    issues.push({
      type: "invalid_display_order",
      severity: "warning",
      message: "Display order must be an integer >= 1; will assign on materialize.",
    });
  }

  return {
    issues,
    normalized_company_name,
    normalized_website,
    normalized_domain,
    proposed_slug,
    mapped_display_order,
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

/** Assign duplicate-in-file clusters by identity domain, else normalized website, else company name. */
export function assignDuplicateClusters(rows: ValidatedImportRow[]): ValidatedImportRow[] {
  const eligible = rows.filter((r) => !r.has_blocking_validation && r.status !== "excluded");
  const clusterMap = new Map<string, string[]>();

  for (const row of eligible) {
    const key = duplicateClusterKey(row);
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
      const orderA = rowA?.mapped_display_order ?? Number.POSITIVE_INFINITY;
      const orderB = rowB?.mapped_display_order ?? Number.POSITIVE_INFINITY;
      if (orderA !== orderB) return orderA - orderB;
      return (rowA?.excel_row_number ?? 0) - (rowB?.excel_row_number ?? 0);
    });
    const canonicalId = sorted[0];
    if (!canonicalId) continue;
    for (const id of sorted) {
      canonicalByRow.set(id, { clusterKey, canonicalId });
    }
  }

  const clustered = rows.map((row) => {
    const cluster = canonicalByRow.get(row.id);
    if (!cluster) {
      return {
        ...row,
        duplicate_cluster_key: duplicateClusterKey(row),
        duplicate_role: null,
        duplicate_of_row_id: null,
        duplicate_resolution: null,
      };
    }

    const isCanonical = row.id === cluster.canonicalId;
    return {
      ...row,
      duplicate_cluster_key: cluster.clusterKey,
      duplicate_role: isCanonical ? ("canonical" as const) : ("duplicate" as const),
      duplicate_of_row_id: isCanonical ? null : cluster.canonicalId,
      duplicate_resolution: isCanonical ? ("kept" as const) : ("excluded" as const),
    };
  });

  return finalizeImportRowWebsites(clustered);
}
