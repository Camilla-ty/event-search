import type { EventFilters } from "@/src/features/events/components/explorer/types";

import {
  eventExplorerDomainMatchesQuery,
} from "@/src/features/events/lib/eventExplorerDomain";
import { readEventIsoDate } from "@/src/features/events/lib/readEventIsoDate";

export type EventExplorerSeriesKeyword = {
  name?: string | null;
  slug?: string | null;
};

/** Minimal fields required for explorer text/date/region filtering. */
export type EventExplorerMatchable = {
  name?: string | null;
  website_url?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  series_id?: string | null;
  event_series?: {
    name?: string | null;
    website_url?: string | null;
  } | null;
  series_keywords?: readonly EventExplorerSeriesKeyword[] | null;
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
  regions: [],
  startDate: "",
  endDate: "",
  topics: [],
};

export type EventExplorerSearchParamsInput = {
  q?: string | null;
  /** @deprecated Ignored; legacy series filter removed. */
  series?: string | null;
  /** @deprecated Ignored; legacy series filter removed. */
  industry?: string | null;
  /** @deprecated Use repeated `region` URL params / `regions` array. */
  region?: string | null;
  regions?: readonly string[] | null;
  /** @deprecated Ignored; legacy series filter removed. */
  type?: string | null;
  start?: string | null;
  end?: string | null;
  /** @deprecated Use repeated `topic` URL params / `topics` array. */
  topic?: string | null;
  topics?: readonly string[] | null;
};

export type EventExplorerFilterOptions = {
  /** When set, only editions whose series_id is in this set match. Null = no topic constraint. */
  topicSeriesIds?: ReadonlySet<string> | null;
  /** Match selected topic slugs against edition series_keywords (client catalog). */
  matchTopicsByKeywords?: boolean;
};

export function normalizeExplorerText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export type SeriesKeywordQueryMatchMode = "includes" | "exact" | "prefix";

function readNormalizedSeriesKeywords(
  item: EventExplorerMatchable,
): { name: string; slug: string }[] {
  const keywords = item.series_keywords ?? [];
  const normalized: { name: string; slug: string }[] = [];

  for (const keyword of keywords) {
    const name = normalizeExplorerText(keyword.name);
    const slug = normalizeExplorerText(keyword.slug);
    if (name === "" && slug === "") continue;
    normalized.push({ name, slug });
  }

  return normalized;
}

export function seriesKeywordsMatchQuery(
  item: EventExplorerMatchable,
  query: string,
  match: SeriesKeywordQueryMatchMode,
): boolean {
  const normalizedQuery = normalizeExplorerText(query);
  if (normalizedQuery === "") return false;

  for (const keyword of readNormalizedSeriesKeywords(item)) {
    if (match === "exact") {
      if (keyword.name === normalizedQuery || keyword.slug === normalizedQuery) {
        return true;
      }
      continue;
    }

    if (match === "prefix") {
      if (
        keyword.name.startsWith(normalizedQuery) ||
        keyword.slug.startsWith(normalizedQuery)
      ) {
        return true;
      }
      continue;
    }

    if (keyword.name.includes(normalizedQuery) || keyword.slug.includes(normalizedQuery)) {
      return true;
    }
  }

  return false;
}

export function readExplorerSeriesId(item: { series_id?: unknown }): string {
  if (typeof item.series_id !== "string") return "";
  const trimmed = item.series_id.trim();
  return trimmed !== "" ? trimmed : "";
}

export function editionMatchesEventExplorerTopicSlugs(
  item: Pick<EventExplorerMatchable, "series_keywords">,
  topicSlugs: readonly string[],
): boolean {
  const selectedTopics = normalizeEventExplorerTopics({ topics: topicSlugs });
  if (selectedTopics.length === 0) return true;

  const eventTopicSlugs = new Set<string>();
  for (const keyword of item.series_keywords ?? []) {
    const slug = (keyword.slug ?? "").trim();
    if (slug !== "") {
      eventTopicSlugs.add(slug);
    }
  }

  return selectedTopics.some((slug) => eventTopicSlugs.has(slug));
}

export function editionMatchesTopicSeriesIds(
  item: { series_id?: unknown },
  seriesIds: ReadonlySet<string> | null,
): boolean {
  if (seriesIds === null) return true;
  const seriesId = readExplorerSeriesId(item);
  return seriesId !== "" && seriesIds.has(seriesId);
}

function normalizeFilterDate(value: string | null | undefined): string {
  return (value ?? "").trim();
}

/** Normalize country names from URL arrays or legacy single `region` input. */
export function normalizeEventExplorerRegions(
  input: {
    regions?: readonly string[] | null;
    region?: string | null;
  } = {},
): string[] {
  const raw =
    input.regions !== undefined && input.regions !== null
      ? input.regions
      : input.region !== undefined && input.region !== null
        ? [input.region]
        : [];

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of raw) {
    const trimmed = String(value).trim();
    if (trimmed === "" || trimmed.toLowerCase() === "all" || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

/** Country names sorted for stable, order-insensitive filter comparison keys. */
export function sortRegionsForComparison(regions: readonly string[]): string[] {
  return normalizeEventExplorerRegions({ regions }).sort((a, b) => a.localeCompare(b));
}

export function areEventExplorerRegionsEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  const normalizedLeft = sortRegionsForComparison(left);
  const normalizedRight = sortRegionsForComparison(right);

  if (normalizedLeft.length !== normalizedRight.length) return false;

  return normalizedLeft.every((region, index) => region === normalizedRight[index]);
}

/** Deduped, lowercased country names for OR region filtering. Empty set = no constraint. */
export function buildNormalizedRegionNameSet(regions: readonly string[]): Set<string> {
  const set = new Set<string>();
  for (const region of normalizeEventExplorerRegions({ regions })) {
    set.add(normalizeExplorerText(region));
  }
  return set;
}

/** True when the edition country matches any selected region (OR), or when none are selected. */
export function editionMatchesEventExplorerRegions(
  item: EventExplorerMatchable,
  regions: readonly string[],
): boolean {
  const regionNames = buildNormalizedRegionNameSet(regions);
  if (regionNames.size === 0) return true;

  const countryName = normalizeExplorerText(item.cities?.countries?.name);
  return regionNames.has(countryName);
}

/** Normalize topic slugs from URL arrays or legacy single `topic` input. */
export function normalizeEventExplorerTopics(
  input: {
    topics?: readonly string[] | null;
    topic?: string | null;
  } = {},
): string[] {
  const raw =
    input.topics !== undefined && input.topics !== null
      ? input.topics
      : input.topic !== undefined && input.topic !== null
        ? [input.topic]
        : [];

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of raw) {
    const trimmed = String(value).trim();
    if (trimmed === "" || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

/** Topic slugs sorted for stable, order-insensitive filter comparison keys. */
export function sortTopicSlugsForComparison(topics: readonly string[]): string[] {
  return normalizeEventExplorerTopics({ topics }).sort((a, b) => a.localeCompare(b));
}

export function areEventExplorerTopicSlugsEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  const normalizedLeft = sortTopicSlugsForComparison(left);
  const normalizedRight = sortTopicSlugsForComparison(right);

  if (normalizedLeft.length !== normalizedRight.length) return false;

  return normalizedLeft.every((slug, index) => slug === normalizedRight[index]);
}

/** Coerce partial / URL / server inputs into canonical filter state. */
export function normalizeEventExplorerFilters(
  input: EventExplorerSearchParamsInput &
    Partial<{
      query: string | null;
      regions: readonly string[] | null;
      /** @deprecated Use `regions`. */
      region: string | null;
      startDate: string | null;
      endDate: string | null;
      topic: string | null;
      topics: readonly string[] | null;
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
    regions: normalizeEventExplorerRegions(input),
    startDate:
      input.startDate !== undefined
        ? normalizeFilterDate(input.startDate)
        : normalizeFilterDate(input.start),
    endDate:
      input.endDate !== undefined
        ? normalizeFilterDate(input.endDate)
        : normalizeFilterDate(input.end),
    topics: normalizeEventExplorerTopics(input),
  };
}

export function parseEventExplorerFiltersFromSearchParams(
  params: EventExplorerSearchParamsInput | URLSearchParams,
): EventExplorerFilterState {
  if (params instanceof URLSearchParams) {
    return normalizeEventExplorerFilters({
      q: params.get("q") ?? undefined,
      series: params.get("series") ?? undefined,
      industry: params.get("industry") ?? undefined,
      regions: params.getAll("region"),
      type: params.get("type") ?? undefined,
      start: params.get("start") ?? undefined,
      end: params.get("end") ?? undefined,
      topics: params.getAll("topic"),
    });
  }

  const topicValues: string[] =
    params.topics !== undefined && params.topics !== null
      ? [...params.topics]
      : params.topic !== undefined && params.topic !== null
        ? [params.topic]
        : [];

  const regionValues: string[] =
    params.regions !== undefined && params.regions !== null
      ? [...params.regions]
      : params.region !== undefined && params.region !== null
        ? [params.region]
        : [];

  return normalizeEventExplorerFilters({
    ...params,
    topics: topicValues,
    regions: regionValues,
  });
}

export function buildEventExplorerSearchParams(
  filters: EventExplorerFilterState,
): URLSearchParams {
  const next = new URLSearchParams();
  const normalized = normalizeEventExplorerFilters(filters);

  if (normalized.query.trim() !== "") {
    next.set("q", normalized.query.trim());
  }

  for (const region of normalized.regions) {
    next.append("region", region);
  }

  if (normalized.startDate !== "") {
    next.set("start", normalized.startDate);
  }

  if (normalized.endDate !== "") {
    next.set("end", normalized.endDate);
  }

  for (const topic of normalized.topics) {
    next.append("topic", topic);
  }

  return next;
}

export function applyEventExplorerQueryChange(
  filters: EventExplorerFilterState,
  query: string,
): EventExplorerFilterState {
  return {
    ...filters,
    query: query.trim(),
  };
}

/** Canonical filter-only URL key. Used to compare filter state. */
export function buildEventExplorerFilterKey(filters: EventExplorerFilterState): string {
  const normalized = normalizeEventExplorerFilters(filters);
  return buildEventExplorerSearchParams({
    ...normalized,
    regions: sortRegionsForComparison(normalized.regions),
    topics: sortTopicSlugsForComparison(normalized.topics),
  }).toString();
}

/** True when URL params already match draft filters (topic order ignored). */
export function eventExplorerClientUrlMatchesDraft(
  searchParams: URLSearchParams,
  draftFilters: EventExplorerFilterState,
): boolean {
  const applied = parseEventExplorerFiltersFromSearchParams(searchParams);
  return buildEventExplorerFilterKey(applied) === buildEventExplorerFilterKey(draftFilters);
}

export function isEventExplorerFiltersApplying(input: {
  draftFilters: EventExplorerFilterState;
  appliedFilters: EventExplorerFilterState;
  serverFilters: EventExplorerFilterState;
  isTransitionPending?: boolean;
}): boolean {
  if (input.isTransitionPending) return true;

  const draftKey = buildEventExplorerFilterKey(input.draftFilters);
  const appliedKey = buildEventExplorerFilterKey(input.appliedFilters);
  const serverKey = buildEventExplorerFilterKey(input.serverFilters);

  return draftKey !== appliedKey || appliedKey !== serverKey;
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

  const eventName = normalizeExplorerText(item.name);
  const seriesName = normalizeExplorerText(item.event_series?.name);

  const queryMatch =
    query === "" ||
    eventName.includes(query) ||
    seriesName.includes(query) ||
    eventExplorerDomainMatchesQuery(item, query, "includes");

  const regionMatch = editionMatchesEventExplorerRegions(item, normalized.regions);

  const topicMatch = options.matchTopicsByKeywords
    ? editionMatchesEventExplorerTopicSlugs(item, normalized.topics)
    : editionMatchesTopicSeriesIds(
        item,
        options.topicSeriesIds === undefined ? null : options.topicSeriesIds,
      );

  const dateMatch = eventOverlapsDateRange(item, normalized.startDate, normalized.endDate);

  return queryMatch && regionMatch && topicMatch && dateMatch;
}

export function applyEventExplorerFilters<T extends EventExplorerMatchable>(
  items: readonly T[],
  filters: EventExplorerFilterState,
  options: EventExplorerFilterOptions = {},
): T[] {
  return items.filter((item) => matchesEventExplorerFilters(item, filters, options));
}
