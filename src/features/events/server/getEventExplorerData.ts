import {
  applyEventExplorerFilters,
  normalizeEventExplorerFilters,
  readExplorerSeriesId,
} from "@/src/features/events/lib/eventExplorerQuery";
import {
  buildEventExplorerFilterFacets,
  getEventExplorerFacetEditions,
  type EventExplorerFilterFacets,
} from "@/src/features/events/lib/eventExplorerFilterFacets";
import { getPublicKeywordsForSeriesIds } from "@/src/features/events/server/seriesKeywordsPublic";
import {
  getPublicKeywordBySlug,
  getSeriesIdsForKeywordId,
} from "@/src/features/events/server/topicHubPublic";
import { getEventEditions } from "@/src/lib/queries/events";

type EventExplorerFilters = {
  query?: string;
  series?: string;
  /** @deprecated Resolved into `series` via normalizeEventExplorerFilters. */
  industry?: string;
  region?: string;
  /** @deprecated Resolved into `series` via normalizeEventExplorerFilters. */
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
    series: string;
    region: string;
    startDate: string;
    endDate: string;
    topic: string;
  };
  filterFacets: EventExplorerFilterFacets;
  activeTopic: EventExplorerActiveTopic | null;
  topicUnknown: boolean;
};

const EMPTY_EVENT_EXPLORER_FILTER_FACETS: EventExplorerFilterFacets = {
  series: [],
  countries: [],
};

export {
  editionMatchesTopicSeriesIds,
  readExplorerSeriesId as readEditionSeriesId,
} from "@/src/features/events/lib/eventExplorerQuery";

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
        filters: normalizeEventExplorerFilters({ ...filters, topic: topicSlug }),
        filterFacets: EMPTY_EVENT_EXPLORER_FILTER_FACETS,
        activeTopic: null,
        topicUnknown: true,
      };
    }

    activeTopic = { slug: keyword.slug, name: keyword.name };
    topicSeriesIds = new Set(await getSeriesIdsForKeywordId(keyword.id));
  }

  const editions = (await getEventEditions()) ?? [];
  const seriesIds = editions
    .map((edition) => readExplorerSeriesId(edition))
    .filter((seriesId) => seriesId !== "");
  const keywordsBySeriesId = await getPublicKeywordsForSeriesIds(seriesIds);
  const editionsWithKeywords = editions.map((edition) => {
    const seriesId = readExplorerSeriesId(edition);
    return {
      ...edition,
      series_keywords:
        seriesId !== "" ? (keywordsBySeriesId.get(seriesId) ?? []) : [],
    };
  });
  const normalizedFilters = normalizeEventExplorerFilters({ ...filters, topic: topicSlug });
  const facetEditions = getEventExplorerFacetEditions(editionsWithKeywords, topicSeriesIds);
  const filterFacets = buildEventExplorerFilterFacets(facetEditions);
  const filtered = applyEventExplorerFilters(editionsWithKeywords, normalizedFilters, {
    topicSeriesIds,
  });

  return {
    editions: filtered,
    total: filtered.length,
    filters: normalizedFilters,
    filterFacets,
    activeTopic,
    topicUnknown,
  };
}
