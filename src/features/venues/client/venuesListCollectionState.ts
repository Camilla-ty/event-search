import {
  buildVenuesListParamsKey,
  parseVenuesListParams,
  type VenuesListParams,
} from "@/src/features/venues/server/venuesListParams";

export { buildVenuesListParamsKey };

export function parseVenuesListParamsFromLocationSearch(
  searchParams: URLSearchParams,
): VenuesListParams {
  return parseVenuesListParams(searchParams);
}

export function applyVenuesListSearchChange(
  params: VenuesListParams,
  search: string,
): VenuesListParams {
  return {
    ...params,
    search: search.trim(),
  };
}

export function applyVenuesListIncludeArchivedChange(
  params: VenuesListParams,
  includeArchived: boolean,
): VenuesListParams {
  return {
    ...params,
    includeArchived,
  };
}

export function toggleVenuesListIncludeArchived(params: VenuesListParams): VenuesListParams {
  return applyVenuesListIncludeArchivedChange(params, !params.includeArchived);
}

export function shouldApplyVenuesListFetchResult(
  requestId: number,
  latestRequestId: number,
): boolean {
  return requestId === latestRequestId;
}
