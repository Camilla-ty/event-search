import type { LogoStatus } from "@/src/lib/companies/logoTypes";
import { normalizeStoredCompanyLogoUrl } from "@/src/features/companies/server/companyLogoStorage";

export type CompanyLogoIngestStatus = LogoStatus;

export type CompanyLogoIngestResult = {
  status: CompanyLogoIngestStatus;
  logoUrl: string | null;
  strategy: string | null;
  error: string | null;
  preview: string | null;
};

export function companyLogoMetadataPatch(
  result: CompanyLogoIngestResult,
  companyId?: string,
): Record<string, unknown> {
  const now = new Date().toISOString();

  if (result.status === "ok" && result.logoUrl) {
    return {
      logo_url:
        normalizeStoredCompanyLogoUrl(result.logoUrl, companyId) ?? result.logoUrl,
      logo_source: "storage",
      logo_status: "ok",
      logo_fetched_at: now,
      logo_fetch_error: null,
    };
  }

  if (result.status === "missing") {
    return {
      logo_source: "storage",
      logo_status: "missing",
      logo_fetched_at: now,
      logo_fetch_error: null,
    };
  }

  if (result.status === "error") {
    return {
      logo_source: "storage",
      logo_status: "error",
      logo_fetched_at: now,
      logo_fetch_error: result.error ?? "unknown_error",
    };
  }

  if (result.status === "skipped") {
    return {
      logo_source: "none",
      logo_status: "skipped",
      logo_fetched_at: null,
      logo_fetch_error: null,
    };
  }

  return {
    logo_source: "storage",
    logo_status: "pending",
    logo_fetched_at: null,
    logo_fetch_error: null,
  };
}
