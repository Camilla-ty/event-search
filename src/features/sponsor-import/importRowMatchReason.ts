import { resolveRowCompanyName, resolveRowDomain } from "./reviewQueueEligibility";
import type { SponsorImportRow } from "./client/types";

function resolveRowWebsite(row: SponsorImportRow): string {
  return (row.normalized_website ?? row.raw_website ?? "").trim();
}

export type ImportRowMatchReasonKind =
  | "domain"
  | "website"
  | "exact_name"
  | "alias"
  | "domain_name_mismatch"
  | "multiple_candidates";

export type ImportRowMatchReasonView = {
  kind: ImportRowMatchReasonKind;
  domain?: string;
  website?: string;
  alias?: string;
  importName?: string;
};

export function getImportRowMatchedAlias(row: SponsorImportRow): string | null {
  if (row.match_method !== "alias") {
    return null;
  }

  const alias = resolveRowCompanyName(row);
  return alias === "" ? null : alias;
}

export function resolveImportRowMatchReason(
  row: SponsorImportRow,
): ImportRowMatchReasonView | null {
  if (row.conflict_type === "domain_name_mismatch") {
    const domain = resolveRowDomain(row);
    const importName = resolveRowCompanyName(row);
    return {
      kind: "domain_name_mismatch",
      ...(domain !== "" ? { domain } : {}),
      ...(importName !== "" ? { importName } : {}),
    };
  }

  if (row.conflict_type === "multiple_candidates") {
    return { kind: "multiple_candidates" };
  }

  if (row.match_method === "domain") {
    const domain = resolveRowDomain(row);
    if (domain === "") {
      return { kind: "domain" };
    }
    return { kind: "domain", domain };
  }

  if (row.match_method === "website") {
    const website = resolveRowWebsite(row);
    if (website === "") {
      return { kind: "website" };
    }
    return { kind: "website", website };
  }

  if (row.match_method === "exact_name") {
    return { kind: "exact_name" };
  }

  if (row.match_method === "alias") {
    const alias = getImportRowMatchedAlias(row);
    if (!alias) {
      return { kind: "alias" };
    }
    return { kind: "alias", alias };
  }

  return null;
}

export function hasImportRowMatchReason(row: SponsorImportRow): boolean {
  return resolveImportRowMatchReason(row) !== null;
}
