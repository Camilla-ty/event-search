import {
  buildEditionsListParamsKey,
  parseEditionsListParams,
  type EditionsListFilter,
  type EditionsListParams,
} from "@/src/features/events/server/editionsListParams";

export { buildEditionsListParamsKey };

export function parseEditionsListParamsFromLocationSearch(
  searchParams: URLSearchParams,
): EditionsListParams {
  return parseEditionsListParams(searchParams);
}

export function deriveEditionsListFilter(params: EditionsListParams): EditionsListFilter {
  if (params.missingWebsite) {
    return "missingWebsite";
  }
  if (params.missingDates) {
    return "missingDates";
  }
  if (params.missingCity) {
    return "missingCity";
  }
  return "all";
}

export function applyEditionsListFilterChange(
  _params: EditionsListParams,
  filter: EditionsListFilter,
): EditionsListParams {
  return {
    missingWebsite: filter === "missingWebsite",
    missingDates: filter === "missingDates",
    missingCity: filter === "missingCity",
  };
}

export function shouldApplyEditionsListFetchResult(
  requestId: number,
  latestRequestId: number,
): boolean {
  return requestId === latestRequestId;
}
