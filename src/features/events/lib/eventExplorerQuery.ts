import type { EventFilters } from "@/src/features/events/components/explorer/types";

import { readEventIsoDate } from "@/src/features/events/lib/readEventIsoDate";

/** Minimal fields required for explorer text/date/region filtering. */
export type EventExplorerMatchable = {
  name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  series_id?: string | null;
  event_series?: {
    name?: string | null;
  } | null;
  cities?: {
    name?: string | null;
    countries?: {
      name?: string | null;
    } | null;
  } | null;
};

export type EventExplorerFilterState = EventFilters;

export const DEFAULT_EVENT_EXPLORER_FILTERS: EventExplorerFilterState = {
  query: "",
  industry: "all",
  region: "all",
  type: "all",
  startDate: "",
  endDate: "",
  topic: "",
};

export type EventExplorerSearchParamsInput = {
  q?: string | null;
  industry?: string | null;
  region?: string | null;
  type?: string | null;
  start?: string | null;
  end?: string | null;
  topic?: string | null;
};

export type EventExplorerFilterOptions = {
  /** When set, only editions whose series_id is in this set match. Null = no topic constraint. */
  topicSeriesIds?: ReadonlySet<string> | null;
};

export type BuildEventExplorerSearchParamsOptions = {
  view?: "list" | "calendar";
  month?: string;
};

export function normalizeExplorerText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function readExplorerSeriesId(item: { series_id?: unknown }): string {
  if (typeof item.series_id !== "string") return "";
  const trimmed = item.series_id.trim();
  return trimmed !== "" ? trimmed : "";
}

export function editionMatchesTopicSeriesIds(
  item: { series_id?: unknown },
  seriesIds: ReadonlySet<string> | null,
): boolean {
  if (seriesIds === null) return true;
  const seriesId = readExplorerSeriesId(item);
  return seriesId !== "" && seriesIds.has(seriesId);
}

function normalizeFilterSelect(value: string | null | undefined, fallback = "all"): string {
  const trimmed = (value ?? "").trim();
  return trimmed !== "" ? trimmed : fallback;
}

function normalizeFilterDate(value: string | null | undefined): string {
  return (value ?? "").trim();
}

/** Coerce partial / URL / server inputs into canonical filter state. */
export function normalizeEventExplorerFilters(
  input: EventExplorerSearchParamsInput &
    Partial<{
      query: string | null;
      industry: string | null;
      region: string | null;
      type: string | null;
      startDate: string | null;
      endDate: string | null;
      topic: string | null;
    }> = {},
): EventExplorerFilterState {
  const query =
    input.query !== undefined
      ? String(input.query)
      : input.q !== undefined
        ? String(input.q ?? "")
        : "";

  return {
    query,
    industry: normalizeFilterSelect(input.industry),
    region: normalizeFilterSelect(input.region),
    type: normalizeFilterSelect(input.type),
    startDate:
      input.startDate !== undefined
        ? normalizeFilterDate(input.startDate)
        : normalizeFilterDate(input.start),
    endDate:
      input.endDate !== undefined
        ? normalizeFilterDate(input.endDate)
        : normalizeFilterDate(input.end),
    topic: (input.topic ?? "").trim(),
  };
}

export function parseEventExplorerFiltersFromSearchParams(
  params: EventExplorerSearchParamsInput | URLSearchParams,
): EventExplorerFilterState {
  if (params instanceof URLSearchParams) {
    return normalizeEventExplorerFilters({
      q: params.get("q") ?? undefined,
      industry: params.get("industry") ?? undefined,
      region: params.get("region") ?? undefined,
      type: params.get("type") ?? undefined,
      start: params.get("start") ?? undefined,
      end: params.get("end") ?? undefined,
      topic: params.get("topic") ?? undefined,
    });
  }

  return normalizeEventExplorerFilters(params);
}

export function buildEventExplorerSearchParams(
  filters: EventExplorerFilterState,
  options: BuildEventExplorerSearchParamsOptions = {},
): URLSearchParams {
  const next = new URLSearchParams();
  const normalized = normalizeEventExplorerFilters(filters);

  if (normalized.query.trim() !== "") {
    next.set("q", normalized.query.trim());
  }

  if (normalized.industry !== "all") {
    next.set("industry", normalized.industry);
  }

  if (normalized.region !== "all") {
    next.set("region", normalized.region);
  }

  if (normalized.type !== "all") {
    next.set("type", normalized.type);
  }

  if (normalized.startDate !== "") {
    next.set("start", normalized.startDate);
  }

  if (normalized.endDate !== "") {
    next.set("end", normalized.endDate);
  }

  if (normalized.topic !== "") {
    next.set("topic", normalized.topic);
  }

  if (options.view === "calendar") {
    next.set("view", "calendar");
    if (options.month?.trim()) {
      next.set("month", options.month.trim());
    }
  }

  return next;
}

/** True when the event's date range overlaps [filterStart, filterEnd] (inclusive). */
export function eventOverlapsDateRange(
  event: Pick<EventExplorerMatchable, "start_date" | "end_date">,
  filterStartDate: string,
  filterEndDate: string,
): boolean {
  const startDate = filterStartDate.trim();
  const endDate = filterEndDate.trim();

  const startValue = readEventIsoDate(event.start_date);
  const endValue = readEventIsoDate(event.end_date ?? event.start_date);

  const afterStart = startDate === "" || endValue === "" || endValue >= startDate;
  const beforeEnd = endDate === "" || startValue === "" || startValue <= endDate;

  return afterStart && beforeEnd;
}

export function matchesEventExplorerFilters(
  item: EventExplorerMatchable,
  filters: EventExplorerFilterState,
  options: EventExplorerFilterOptions = {},
): boolean {
  const normalized = normalizeEventExplorerFilters(filters);

  const query = normalizeExplorerText(normalized.query);
  const industry = normalizeExplorerText(normalized.industry);
  const region = normalizeExplorerText(normalized.region);
  const type = normalizeExplorerText(normalized.type);

  const eventName = normalizeExplorerText(item.name);
  const cityName = normalizeExplorerText(item.cities?.name);
  const countryName = normalizeExplorerText(item.cities?.countries?.name);
  const seriesName = normalizeExplorerText(item.event_series?.name);

  const queryMatch =
    query === "" ||
    eventName.includes(query) ||
    cityName.includes(query) ||
    countryName.includes(query) ||
    seriesName.includes(query);

  const industryMatch = industry === "" || industry === "all" || seriesName === industry;
  const regionMatch = region === "" || region === "all" || countryName === region;
  const typeMatch = type === "" || type === "all" || seriesName === type;

  const topicSeriesIds =
    options.topicSeriesIds === undefined ? null : options.topicSeriesIds;
  const topicMatch = editionMatchesTopicSeriesIds(item, topicSeriesIds);

  const dateMatch = eventOverlapsDateRange(item, normalized.startDate, normalized.endDate);

  return queryMatch && industryMatch && regionMatch && typeMatch && topicMatch && dateMatch;
}

export function applyEventExplorerFilters<T extends EventExplorerMatchable>(
  items: readonly T[],
  filters: EventExplorerFilterState,
  options: EventExplorerFilterOptions = {},
): T[] {
  return items.filter((item) => matchesEventExplorerFilters(item, filters, options));
}
