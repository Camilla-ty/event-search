import type { SponsorImportRow } from "@/src/features/sponsor-import/client/types";

import type { PartnerAlumniImportRow } from "./client/types";

export function asSponsorImportRow(row: PartnerAlumniImportRow): SponsorImportRow {
  return row as unknown as SponsorImportRow;
}

export function duplicateClusterSize(row: PartnerAlumniImportRow): number | null {
  const size = row.duplicate_cluster_size ?? null;
  return typeof size === "number" && size > 1 ? size : null;
}

export function duplicateHelperText(row: PartnerAlumniImportRow): string | null {
  const size = duplicateClusterSize(row);
  if (!size) return null;
  if (row.status === "excluded") {
    return "Excluded automatically. Use this row instead only if its details are correct.";
  }
  if (row.duplicate_resolution === "kept") {
    return "Selected automatically by display order, then spreadsheet order.";
  }
  const otherCount = size - 1;
  const noun = otherCount === 1 ? "duplicate" : "duplicates";
  return `Choosing this row excludes the other ${otherCount} ${noun}.`;
}

export function duplicateStatusLabel(
  row: PartnerAlumniImportRow,
): { primary: string; secondary: string | null } | null {
  if (!duplicateClusterSize(row)) return null;
  if (row.status === "excluded") {
    return { primary: "Excluded", secondary: "automatic duplicate" };
  }
  if (row.duplicate_resolution === "kept") {
    if (row.status === "resolved") return { primary: "Selected", secondary: "will import" };
    if (row.status === "auto_ready") return { primary: "Selected", secondary: "auto-ready" };
    return { primary: "Selected", secondary: "needs review" };
  }
  return { primary: "Duplicate", secondary: "needs choice" };
}

export function formatMatchMethodLabel(method: string | null): string {
  switch (method) {
    case "domain":
      return "Domain";
    case "alias":
      return "Alias";
    case "website":
      return "Website";
    case "exact_name":
      return "Exact name";
    case "manual":
      return "Manual";
    case "create_new":
      return "Create new";
    default:
      return "—";
  }
}

export function formatMatchConfidenceLabel(confidence: string | null): string | null {
  if (!confidence) return null;
  if (confidence === "high") return "High confidence";
  return confidence;
}

export function spreadsheetWebsiteLabel(row: PartnerAlumniImportRow): string | null {
  const raw = (row.raw_website ?? "").trim();
  if (raw === "") return null;
  return raw;
}

export function spreadsheetCompanyLabel(row: PartnerAlumniImportRow): {
  primary: string;
  secondary: string | null;
} {
  const raw = (row.raw_company_name ?? "").trim();
  const normalized = (row.normalized_company_name ?? "").trim();
  if (normalized !== "" && normalized.toLowerCase() !== raw.toLowerCase()) {
    return { primary: raw || normalized || "—", secondary: `Normalized: ${normalized}` };
  }
  return { primary: raw || "—", secondary: null };
}
