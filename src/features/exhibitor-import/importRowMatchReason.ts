import { bareNoIdentityHost } from "@/src/lib/domain/importWebsiteMatchKey";
import { isBarePlatformOwnerMatchHost } from "@/src/lib/domain/barePlatformOwnerMatchHosts";

import { resolveRowCompanyName, resolveRowDomain } from "./reviewQueueEligibility";
import type { ExhibitorImportRow } from "./client/types";

function resolveRowWebsite(row: ExhibitorImportRow): string {
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

function resolveImportRowMatchDomain(row: ExhibitorImportRow): string {
  const fromNormalized = resolveRowDomain(row);
  if (fromNormalized !== "") {
    return fromNormalized;
  }

  const website = resolveRowWebsite(row);
  if (website === "") {
    return "";
  }

  const host = bareNoIdentityHost(website);
  if (host && isBarePlatformOwnerMatchHost(host)) {
    return host;
  }

  return "";
}

export function getImportRowMatchedAlias(row: ExhibitorImportRow): string | null {
  if (row.match_method !== "alias") {
    return null;
  }

  const alias = resolveRowCompanyName(row);
  return alias === "" ? null : alias;
}

export function resolveImportRowMatchReason(
  row: ExhibitorImportRow,
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
    const domain = resolveImportRowMatchDomain(row);
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

export function hasImportRowMatchReason(row: ExhibitorImportRow): boolean {
  return resolveImportRowMatchReason(row) !== null;
}
