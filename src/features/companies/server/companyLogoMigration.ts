import { isCompanyLogoStorageUrl } from "@/src/lib/companies/isCompanyLogoStorageUrl";

import {
  companyLogoObjectPath,
  parseCompanyLogoStoragePathFromUrl,
} from "./companyLogoStorage";

export type CompanyLogoMigrationRow = {
  id: string;
  name: string | null;
  logo_url: string | null;
};

export type CompanyLogoMigrationPlan = {
  companyId: string;
  companyName: string | null;
  oldLogoUrl: string;
  oldStoragePath: string;
  newStoragePath: string;
  newPublicUrl: string;
  extension: string;
};

export type CompanyLogoMigrationSkipReason =
  | "missing_logo_url"
  | "not_storage_url"
  | "unparseable_path"
  | "already_company_id_path";

export type CompanyLogoMigrationPlanResult =
  | { kind: "plan"; plan: CompanyLogoMigrationPlan }
  | { kind: "skip"; reason: CompanyLogoMigrationSkipReason };

export type CompanyLogoMigrationAuditStatus =
  | "dry_run_planned"
  | "migrated"
  | "skipped"
  | "failed";

export type CompanyLogoMigrationAuditRecord = {
  companyId: string;
  companyName: string | null;
  oldLogoUrl: string | null;
  newLogoUrl: string | null;
  oldStoragePath: string | null;
  newStoragePath: string | null;
  status: CompanyLogoMigrationAuditStatus;
  skipReason: CompanyLogoMigrationSkipReason | null;
  error: string | null;
  migratedAt: string;
};

export function contentTypeForLogoExtension(extension: string): string {
  switch (extension.trim().toLowerCase()) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    case "gif":
      return "image/gif";
    case "ico":
      return "image/x-icon";
    default:
      return "application/octet-stream";
  }
}

export function planCompanyLogoMigration(
  row: CompanyLogoMigrationRow,
  buildPublicUrl: (storagePath: string) => string,
): CompanyLogoMigrationPlanResult {
  const logoUrl = row.logo_url?.trim() ?? "";
  if (!logoUrl) {
    return { kind: "skip", reason: "missing_logo_url" };
  }

  if (!isCompanyLogoStorageUrl(logoUrl)) {
    return { kind: "skip", reason: "not_storage_url" };
  }

  const parsed = parseCompanyLogoStoragePathFromUrl(logoUrl);
  if (!parsed) {
    return { kind: "skip", reason: "unparseable_path" };
  }

  const newStoragePath = companyLogoObjectPath(row.id, parsed.extension);
  if (parsed.bucketRelativePath === newStoragePath) {
    return { kind: "skip", reason: "already_company_id_path" };
  }

  return {
    kind: "plan",
    plan: {
      companyId: row.id,
      companyName: row.name,
      oldLogoUrl: logoUrl,
      oldStoragePath: parsed.bucketRelativePath,
      newStoragePath,
      newPublicUrl: buildPublicUrl(newStoragePath),
      extension: parsed.extension,
    },
  };
}

export function auditRecordForSkip(params: {
  row: CompanyLogoMigrationRow;
  reason: CompanyLogoMigrationSkipReason;
  migratedAt: string;
}): CompanyLogoMigrationAuditRecord {
  const logoUrl = params.row.logo_url?.trim() || null;
  const parsed = logoUrl ? parseCompanyLogoStoragePathFromUrl(logoUrl) : null;

  return {
    companyId: params.row.id,
    companyName: params.row.name,
    oldLogoUrl: logoUrl,
    newLogoUrl: null,
    oldStoragePath: parsed?.bucketRelativePath ?? null,
    newStoragePath: null,
    status: "skipped",
    skipReason: params.reason,
    error: null,
    migratedAt: params.migratedAt,
  };
}

export function auditRecordForPlan(params: {
  plan: CompanyLogoMigrationPlan;
  status: Extract<CompanyLogoMigrationAuditStatus, "dry_run_planned" | "migrated">;
  migratedAt: string;
}): CompanyLogoMigrationAuditRecord {
  return {
    companyId: params.plan.companyId,
    companyName: params.plan.companyName,
    oldLogoUrl: params.plan.oldLogoUrl,
    newLogoUrl: params.plan.newPublicUrl,
    oldStoragePath: params.plan.oldStoragePath,
    newStoragePath: params.plan.newStoragePath,
    status: params.status,
    skipReason: null,
    error: null,
    migratedAt: params.migratedAt,
  };
}

export function auditRecordForFailure(params: {
  row: CompanyLogoMigrationRow;
  plan: CompanyLogoMigrationPlan | null;
  error: string;
  migratedAt: string;
}): CompanyLogoMigrationAuditRecord {
  return {
    companyId: params.row.id,
    companyName: params.row.name,
    oldLogoUrl: params.plan?.oldLogoUrl ?? params.row.logo_url,
    newLogoUrl: params.plan?.newPublicUrl ?? null,
    oldStoragePath: params.plan?.oldStoragePath ?? null,
    newStoragePath: params.plan?.newStoragePath ?? null,
    status: "failed",
    skipReason: null,
    error: params.error,
    migratedAt: params.migratedAt,
  };
}
