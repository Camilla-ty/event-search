import { isCompanyLogoStorageUrl } from "@/src/lib/companies/isCompanyLogoStorageUrl";

import {
  isCompanyIdLogoStorageSegment,
  parseCompanyLogoStoragePathFromUrl,
} from "./companyLogoStorage";

export type LegacyCompanyLogoCleanupRow = {
  id: string;
  name: string | null;
  domain: string | null;
  logo_url: string | null;
};

export type LegacyCompanyLogoCleanupSkipReason =
  | "missing_logo_url"
  | "not_storage_url"
  | "unparseable_path"
  | "logo_url_not_company_id_path"
  | "missing_domain"
  | "active_object_missing"
  | "active_object_empty"
  | "legacy_same_as_active"
  | "legacy_still_referenced"
  | "no_legacy_candidates";

export type LegacyCompanyLogoCleanupPlan = {
  companyId: string;
  companyName: string | null;
  activeLogoUrl: string;
  activeStoragePath: string;
  legacyStoragePath: string;
};

export type LegacyCompanyLogoCleanupPlanItem =
  | { kind: "delete"; plan: LegacyCompanyLogoCleanupPlan }
  | {
      kind: "skip";
      reason: LegacyCompanyLogoCleanupSkipReason;
      legacyStoragePath?: string;
      detail?: string;
    };

export type LegacyCompanyLogoCleanupAuditStatus =
  | "dry_run_planned"
  | "deleted"
  | "skipped"
  | "failed";

export type LegacyCompanyLogoCleanupAuditRecord = {
  companyId: string;
  companyName: string | null;
  activeLogoUrl: string | null;
  activeStoragePath: string | null;
  legacyStoragePath: string | null;
  status: LegacyCompanyLogoCleanupAuditStatus;
  skipReason: LegacyCompanyLogoCleanupSkipReason | null;
  error: string | null;
  cleanedAt: string;
};

const LEGACY_LOGO_FILE_PATTERN = /^logo\.[a-z0-9]+$/i;

export function normalizeLegacyLogoDomain(domain: string | null | undefined): string | null {
  const trimmed = domain?.trim().toLowerCase() ?? "";
  return trimmed || null;
}

export function isLegacyCompanyLogoStoragePath(storagePath: string): boolean {
  const match = /^companies\/([^/]+)\/logo\.[a-z0-9]+$/i.exec(storagePath.trim());
  if (!match) return false;
  const segment = match[1] ?? "";
  return segment !== "" && !isCompanyIdLogoStorageSegment(segment);
}

export function legacyLogoPathsForDomain(domain: string, fileNames: readonly string[]): string[] {
  const normalizedDomain = normalizeLegacyLogoDomain(domain);
  if (!normalizedDomain) return [];

  const paths: string[] = [];
  for (const fileName of fileNames) {
    const trimmed = fileName.trim();
    if (!LEGACY_LOGO_FILE_PATTERN.test(trimmed)) continue;
    paths.push(`companies/${normalizedDomain}/${trimmed}`);
  }
  return paths;
}

export function buildLogoUrlReferenceCounts(
  rows: readonly LegacyCompanyLogoCleanupRow[],
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const logoUrl = row.logo_url?.trim() ?? "";
    if (!isCompanyLogoStorageUrl(logoUrl)) continue;

    const parsed = parseCompanyLogoStoragePathFromUrl(logoUrl);
    if (!parsed) continue;

    counts.set(parsed.bucketRelativePath, (counts.get(parsed.bucketRelativePath) ?? 0) + 1);
  }

  return counts;
}

export function planLegacyCompanyLogoCleanup(params: {
  row: LegacyCompanyLogoCleanupRow;
  activeObjectExists: boolean;
  activeObjectByteLength: number;
  legacyCandidatePaths: readonly string[];
  logoUrlReferenceCounts: ReadonlyMap<string, number>;
}): LegacyCompanyLogoCleanupPlanItem[] {
  const logoUrl = params.row.logo_url?.trim() ?? "";
  if (!logoUrl) {
    return [{ kind: "skip", reason: "missing_logo_url" }];
  }

  if (!isCompanyLogoStorageUrl(logoUrl)) {
    return [{ kind: "skip", reason: "not_storage_url" }];
  }

  const parsedActive = parseCompanyLogoStoragePathFromUrl(logoUrl);
  if (!parsedActive) {
    return [{ kind: "skip", reason: "unparseable_path" }];
  }

  if (
    parsedActive.isLegacyPath ||
    parsedActive.companyId !== params.row.id.trim()
  ) {
    return [{ kind: "skip", reason: "logo_url_not_company_id_path" }];
  }

  const domain = normalizeLegacyLogoDomain(params.row.domain);
  if (!domain) {
    return [{ kind: "skip", reason: "missing_domain" }];
  }

  if (!params.activeObjectExists) {
    return [{ kind: "skip", reason: "active_object_missing" }];
  }

  if (params.activeObjectByteLength <= 0) {
    return [{ kind: "skip", reason: "active_object_empty" }];
  }

  const activeStoragePath = parsedActive.bucketRelativePath;
  const deletePlans: LegacyCompanyLogoCleanupPlanItem[] = [];

  for (const legacyStoragePath of params.legacyCandidatePaths) {
    if (!isLegacyCompanyLogoStoragePath(legacyStoragePath)) {
      continue;
    }

    if (legacyStoragePath === activeStoragePath) {
      deletePlans.push({
        kind: "skip",
        reason: "legacy_same_as_active",
        legacyStoragePath,
      });
      continue;
    }

    const referenceCount = params.logoUrlReferenceCounts.get(legacyStoragePath) ?? 0;
    if (referenceCount > 0) {
      deletePlans.push({
        kind: "skip",
        reason: "legacy_still_referenced",
        legacyStoragePath,
        detail: `${referenceCount}`,
      });
      continue;
    }

    deletePlans.push({
      kind: "delete",
      plan: {
        companyId: params.row.id,
        companyName: params.row.name,
        activeLogoUrl: logoUrl,
        activeStoragePath,
        legacyStoragePath,
      },
    });
  }

  if (deletePlans.length === 0) {
    return [{ kind: "skip", reason: "no_legacy_candidates" }];
  }

  return deletePlans;
}

export function auditRecordForLegacyCleanupSkip(params: {
  row: LegacyCompanyLogoCleanupRow;
  reason: LegacyCompanyLogoCleanupSkipReason;
  legacyStoragePath?: string | null;
  cleanedAt: string;
  detail?: string;
}): LegacyCompanyLogoCleanupAuditRecord {
  const logoUrl = params.row.logo_url?.trim() || null;
  const parsed = logoUrl ? parseCompanyLogoStoragePathFromUrl(logoUrl) : null;

  return {
    companyId: params.row.id,
    companyName: params.row.name,
    activeLogoUrl: logoUrl,
    activeStoragePath: parsed?.bucketRelativePath ?? null,
    legacyStoragePath: params.legacyStoragePath ?? null,
    status: "skipped",
    skipReason: params.reason,
    error: params.detail ?? null,
    cleanedAt: params.cleanedAt,
  };
}

export function auditRecordForLegacyCleanupDelete(params: {
  plan: LegacyCompanyLogoCleanupPlan;
  status: Extract<LegacyCompanyLogoCleanupAuditStatus, "dry_run_planned" | "deleted">;
  cleanedAt: string;
}): LegacyCompanyLogoCleanupAuditRecord {
  return {
    companyId: params.plan.companyId,
    companyName: params.plan.companyName,
    activeLogoUrl: params.plan.activeLogoUrl,
    activeStoragePath: params.plan.activeStoragePath,
    legacyStoragePath: params.plan.legacyStoragePath,
    status: params.status,
    skipReason: null,
    error: null,
    cleanedAt: params.cleanedAt,
  };
}

export function auditRecordForLegacyCleanupFailure(params: {
  row: LegacyCompanyLogoCleanupRow;
  plan: LegacyCompanyLogoCleanupPlan | null;
  error: string;
  cleanedAt: string;
}): LegacyCompanyLogoCleanupAuditRecord {
  return {
    companyId: params.row.id,
    companyName: params.row.name,
    activeLogoUrl: params.plan?.activeLogoUrl ?? params.row.logo_url,
    activeStoragePath: params.plan?.activeStoragePath ?? null,
    legacyStoragePath: params.plan?.legacyStoragePath ?? null,
    status: "failed",
    skipReason: null,
    error: params.error,
    cleanedAt: params.cleanedAt,
  };
}
