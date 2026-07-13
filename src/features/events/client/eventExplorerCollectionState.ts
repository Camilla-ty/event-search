import {
  applyEventExplorerQueryChange,
  DEFAULT_EVENT_EXPLORER_FILTERS,
  type EventExplorerFilterState,
} from "@/src/features/events/lib/eventExplorerQuery";
import {
  DEFAULT_EVENT_EXPLORER_SORT_MODE,
  type EventExplorerSortMode,
} from "@/src/features/events/lib/eventExplorerOrdering";
import {
  buildEventExplorerParamsKey,
  EVENT_EXPLORER_MIN_PAGE,
  parseEventExplorerParamsFromSearchParams,
  type EventExplorerParams,
} from "@/src/features/events/server/eventExplorerParams";

export { buildEventExplorerParamsKey };

export function parseEventExplorerParamsFromLocationSearch(
  searchParams: URLSearchParams,
): EventExplorerParams {
  return parseEventExplorerParamsFromSearchParams(searchParams);
}

export function applyEventExplorerFiltersChange(
  params: EventExplorerParams,
  filters: EventExplorerFilterState,
): EventExplorerParams {
  return {
    ...params,
    filters,
    page: EVENT_EXPLORER_MIN_PAGE,
  };
}

export function applyEventExplorerSortChange(
  params: EventExplorerParams,
  sort: EventExplorerSortMode,
): EventExplorerParams {
  return {
    ...params,
    sort,
    page: EVENT_EXPLORER_MIN_PAGE,
  };
}

export function applyEventExplorerPageChange(
  params: EventExplorerParams,
  page: number,
): EventExplorerParams {
  return {
    ...params,
    page,
  };
}

export function applyEventExplorerQueryChangeToParams(
  params: EventExplorerParams,
  query: string,
): EventExplorerParams {
  return applyEventExplorerFiltersChange(
    params,
    applyEventExplorerQueryChange(params.filters, query),
  );
}

export function applyEventExplorerReset(): EventExplorerParams {
  return {
    filters: { ...DEFAULT_EVENT_EXPLORER_FILTERS },
    sort: DEFAULT_EVENT_EXPLORER_SORT_MODE,
    page: EVENT_EXPLORER_MIN_PAGE,
  };
}

export function shouldApplyEventExplorerFetchResult(
  requestId: number,
  latestRequestId: number,
): boolean {
  return requestId === latestRequestId;
}
