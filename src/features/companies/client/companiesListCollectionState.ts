import {
  buildCompaniesListParamsKey,
  parseCompaniesListParams,
  type CompaniesListParams,
} from "@/src/features/companies/server/companiesListParams";

export { buildCompaniesListParamsKey };

export function parseCompaniesListParamsFromLocationSearch(
  searchParams: URLSearchParams,
): CompaniesListParams {
  return parseCompaniesListParams(searchParams);
}

export function applyCompaniesListFilterChange(
  params: CompaniesListParams,
  filter: CompaniesListParams["filter"],
): CompaniesListParams {
  return {
    ...params,
    filter,
  };
}

export function applyCompaniesListSearchChange(
  params: CompaniesListParams,
  search: string,
): CompaniesListParams {
  return {
    ...params,
    search: search.trim(),
  };
}

export function shouldApplyCompaniesListFetchResult(
  requestId: number,
  latestRequestId: number,
): boolean {
  return requestId === latestRequestId;
}
