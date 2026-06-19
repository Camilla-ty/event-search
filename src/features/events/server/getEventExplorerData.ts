import { getEventEditions } from "@/src/lib/queries/events";

import {
  getPublicKeywordBySlug,
  getSeriesIdsForKeywordId,
} from "@/src/features/events/server/topicHubPublic";

type EventExplorerFilters = {
  query?: string;
  industry?: string;
  region?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  topic?: string;
};

export type EventExplorerActiveTopic = {
  slug: string;
  name: string;
};

export type EventExplorerData = {
  editions: Awaited<ReturnType<typeof getEventEditions>>;
  total: number;
  filters: {
    query: string;
    industry: string;
    region: string;
    type: string;
    startDate: string;
    endDate: string;
    topic: string;
  };
  activeTopic: EventExplorerActiveTopic | null;
  topicUnknown: boolean;
};

function normalize(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function toDateValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function readEditionSeriesId(edition: { series_id?: unknown }): string {
  if (typeof edition.series_id !== "string") return "";
  const trimmed = edition.series_id.trim();
  return trimmed !== "" ? trimmed : "";
}

export function editionMatchesTopicSeriesIds(
  edition: { series_id?: unknown },
  seriesIds: ReadonlySet<string> | null,
): boolean {
  if (seriesIds === null) return true;
  const seriesId = readEditionSeriesId(edition);
  return seriesId !== "" && seriesIds.has(seriesId);
}

export async function getEventExplorerData(
  filters: EventExplorerFilters = {},
): Promise<EventExplorerData> {
  const topicSlug = (filters.topic ?? "").trim();
  let activeTopic: EventExplorerActiveTopic | null = null;
  let topicUnknown = false;
  let topicSeriesIds: Set<string> | null = null;

  if (topicSlug !== "") {
    const keyword = await getPublicKeywordBySlug(topicSlug);
    if (!keyword) {
      topicUnknown = true;
      return {
        editions: [],
        total: 0,
        filters: {
          query: filters.query ?? "",
          industry: filters.industry ?? "all",
          region: filters.region ?? "all",
          type: filters.type ?? "all",
          startDate: filters.startDate ?? "",
          endDate: filters.endDate ?? "",
          topic: topicSlug,
        },
        activeTopic: null,
        topicUnknown: true,
      };
    }

    activeTopic = { slug: keyword.slug, name: keyword.name };
    topicSeriesIds = new Set(await getSeriesIdsForKeywordId(keyword.id));
  }

  const editions = (await getEventEditions()) ?? [];
  const query = normalize(filters.query);
  const industry = normalize(filters.industry);
  const region = normalize(filters.region);
  const type = normalize(filters.type);
  const startDate = filters.startDate ?? "";
  const endDate = filters.endDate ?? "";

  const filtered = editions.filter((edition) => {
    const eventName = normalize(edition.name);
    const cityName = normalize(edition.cities?.name);
    const countryName = normalize(edition.cities?.countries?.name);
    const seriesName = normalize(edition.event_series?.name);

    const queryMatch =
      !query ||
      eventName.includes(query) ||
      cityName.includes(query) ||
      countryName.includes(query) ||
      seriesName.includes(query);
    const industryMatch = !industry || industry === "all" || seriesName === industry;
    const regionMatch = !region || region === "all" || countryName === region;
    const typeMatch = !type || type === "all" || seriesName === type;
    const topicMatch = editionMatchesTopicSeriesIds(edition, topicSeriesIds);

    const startValue = toDateValue(edition.start_date);
    const endValue = toDateValue(edition.end_date ?? edition.start_date);
    const afterStart = !startDate || !endValue || endValue >= startDate;
    const beforeEnd = !endDate || !startValue || startValue <= endDate;

    return (
      queryMatch &&
      industryMatch &&
      regionMatch &&
      typeMatch &&
      topicMatch &&
      afterStart &&
      beforeEnd
    );
  });

  return {
    editions: filtered,
    total: filtered.length,
    filters: {
      query: filters.query ?? "",
      industry: filters.industry ?? "all",
      region: filters.region ?? "all",
      type: filters.type ?? "all",
      startDate: filters.startDate ?? "",
      endDate: filters.endDate ?? "",
      topic: topicSlug,
    },
    activeTopic,
    topicUnknown,
  };
}
