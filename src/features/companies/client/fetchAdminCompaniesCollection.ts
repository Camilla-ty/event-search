import type { AdminCompaniesCollectionResult } from "@/src/features/companies/server/adminCompaniesCollection";
import { buildCompaniesListSearchParams } from "@/src/features/companies/server/companiesListParams";
import type { CompaniesListParams } from "@/src/features/companies/server/companiesListParams";

type CompaniesApiError = {
  ok?: boolean;
  error?: string;
};

export function buildAdminCompaniesApiUrl(params: CompaniesListParams): string {
  const query = buildCompaniesListSearchParams(params).toString();
  return query !== "" ? `/api/admin/companies?${query}` : "/api/admin/companies";
}

export async function fetchAdminCompaniesCollection(
  params: CompaniesListParams,
  signal?: AbortSignal,
): Promise<AdminCompaniesCollectionResult> {
  const response = await fetch(buildAdminCompaniesApiUrl(params), {
    method: "GET",
    signal,
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let message = "Failed to load companies.";
    try {
      const payload = (await response.json()) as CompaniesApiError;
      if (typeof payload.error === "string" && payload.error.trim() !== "") {
        message = payload.error;
      }
    } catch {
      // Keep default message when error body is not JSON.
    }
    throw new Error(message);
  }

  const payload = (await response.json()) as {
    ok: boolean;
    error?: string;
    companies?: AdminCompaniesCollectionResult["companies"];
    total?: number;
    params?: CompaniesListParams;
  };

  if (!payload.ok || !Array.isArray(payload.companies) || payload.params === undefined) {
    throw new Error(payload.error ?? "Failed to load companies.");
  }

  return {
    companies: payload.companies,
    total: payload.total ?? payload.companies.length,
    params: payload.params,
  };
}
