import type { EventFilters } from "@/src/features/events/components/explorer/types";
import {
  buildEventExplorerSearchParams,
  normalizeEventExplorerFilters,
  parseEventExplorerFiltersFromSearchParams,
  sortRegionsForComparison,
  sortTopicSlugsForComparison,
  type EventExplorerSearchParamsInput,
} from "@/src/features/events/lib/eventExplorerQuery";
import {
  DEFAULT_EVENT_EXPLORER_SORT_MODE,
  type EventExplorerSortMode,
} from "@/src/features/events/lib/eventExplorerOrdering";

export const EVENT_EXPLORER_PAGE_SIZE = 20;
export const EVENT_EXPLORER_MIN_PAGE = 1;
export const EVENT_EXPLORER_MAX_PAGE = 9999;

const VALID_SORTS = new Set<EventExplorerSortMode>([
  "recommended",
  "reviewed",
  "date_asc",
  "date_desc",
  "name",
]);

export type EventExplorerParams = {
  filters: EventFilters;
  sort: EventExplorerSortMode;
  page: number;
};

export type EventExplorerSearchInput = EventExplorerSearchParamsInput & {
  sort?: string | null;
  page?: string | number | null;
};

export function parseEventExplorerSort(
  raw: string | null | undefined,
): EventExplorerSortMode {
  const normalized = (raw ?? "").trim().toLowerCase();
  if (VALID_SORTS.has(normalized as EventExplorerSortMode)) {
    return normalized as EventExplorerSortMode;
  }
  return DEFAULT_EVENT_EXPLORER_SORT_MODE;
}

export function parseEventExplorerPage(raw: string | number | null | undefined): number {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const value = Math.floor(raw);
    if (value >= EVENT_EXPLORER_MIN_PAGE && value <= EVENT_EXPLORER_MAX_PAGE) {
      return value;
    }
    return EVENT_EXPLORER_MIN_PAGE;
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "") return EVENT_EXPLORER_MIN_PAGE;
    const parsed = Number.parseInt(trimmed, 10);
    if (
      Number.isFinite(parsed) &&
      parsed >= EVENT_EXPLORER_MIN_PAGE &&
      parsed <= EVENT_EXPLORER_MAX_PAGE
    ) {
      return parsed;
    }
  }

  return EVENT_EXPLORER_MIN_PAGE;
}

export function eventExplorerTotalPages(total: number, pageSize: number): number {
  if (total <= 0) return 1;
  const safePageSize = pageSize > 0 ? pageSize : 1;
  return Math.max(1, Math.ceil(total / safePageSize));
}

export function clampEventExplorerPage(
  page: number,
  total: number,
  pageSize: number,
): number {
  const totalPages = eventExplorerTotalPages(total, pageSize);
  const safePage = page >= EVENT_EXPLORER_MIN_PAGE ? page : EVENT_EXPLORER_MIN_PAGE;
  return Math.min(safePage, totalPages);
}

export function parseEventExplorerParams(input: EventExplorerSearchInput = {}): EventExplorerParams {
  return {
    filters: normalizeEventExplorerFilters(input),
    sort: parseEventExplorerSort(input.sort),
    page: parseEventExplorerPage(input.page),
  };
}

export function parseEventExplorerParamsFromSearchParams(
  searchParams: URLSearchParams,
): EventExplorerParams {
  return {
    filters: parseEventExplorerFiltersFromSearchParams(searchParams),
    sort: parseEventExplorerSort(searchParams.get("sort")),
    page: parseEventExplorerPage(searchParams.get("page")),
  };
}

export function buildEventExplorerCollectionSearchParams(
  params: EventExplorerParams,
): URLSearchParams {
  const search = buildEventExplorerSearchParams(params.filters);

  if (params.sort !== DEFAULT_EVENT_EXPLORER_SORT_MODE) {
    search.set("sort", params.sort);
  }

  if (params.page !== EVENT_EXPLORER_MIN_PAGE) {
    search.set("page", String(params.page));
  }

  return search;
}

export function buildEventExplorerPath(params: EventExplorerParams): string {
  const query = buildEventExplorerCollectionSearchParams(params).toString();
  return query !== "" ? `/events?${query}` : "/events";
}

export function buildEventExplorerParamsKey(params: EventExplorerParams): string {
  const normalizedFilters = normalizeEventExplorerFilters(params.filters);
  return buildEventExplorerCollectionSearchParams({
    filters: {
      ...normalizedFilters,
      regions: sortRegionsForComparison(normalizedFilters.regions),
      topics: sortTopicSlugsForComparison(normalizedFilters.topics),
    },
    sort: params.sort,
    page: params.page,
  }).toString();
}
