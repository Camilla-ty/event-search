import type { CompanyListFilter } from "@/src/features/companies/server/companyAdmin";

export type CompaniesListParams = {
  filter: CompanyListFilter;
  search: string;
};

export function parseCompanyListFilter(value: string | null | undefined): CompanyListFilter {
  if (
    value === "social_website" ||
    value === "missing_logo" ||
    value === "needs_logo_review"
  ) {
    return value;
  }
  return "all";
}

export function parseCompaniesListParams(searchParams: URLSearchParams): CompaniesListParams {
  return {
    filter: parseCompanyListFilter(searchParams.get("filter")),
    search: (searchParams.get("search") ?? "").trim(),
  };
}

export function parseCompaniesListParamsFromRecord(
  raw: Record<string, string | undefined>,
): CompaniesListParams {
  const params = new URLSearchParams();
  if (raw.filter !== undefined) {
    params.set("filter", raw.filter);
  }
  if (raw.search !== undefined) {
    params.set("search", raw.search);
  }
  return parseCompaniesListParams(params);
}

export function buildCompaniesListSearchParams(params: CompaniesListParams): URLSearchParams {
  const searchParams = new URLSearchParams();
  if (params.filter !== "all") {
    searchParams.set("filter", params.filter);
  }
  const trimmedSearch = params.search.trim();
  if (trimmedSearch !== "") {
    searchParams.set("search", trimmedSearch);
  }
  return searchParams;
}

export function buildCompaniesListParamsKey(params: CompaniesListParams): string {
  return `${params.filter}\0${params.search.trim()}`;
}
