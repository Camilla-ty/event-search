import {
  applyEventExplorerFilters,
  normalizeEventExplorerFilters,
  readExplorerSeriesId,
} from "@/src/features/events/lib/eventExplorerQuery";
import { getPublicKeywordsForSeriesIds } from "@/src/features/events/server/seriesKeywordsPublic";
import {
  getPublicKeywordBySlug,
  getSeriesIdsForKeywordId,
} from "@/src/features/events/server/topicHubPublic";
import { getEventEditions } from "@/src/lib/queries/events";

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
  const filtered = applyEventExplorerFilters(editionsWithKeywords, normalizedFilters, {
    topicSeriesIds,
  });

  return {
    editions: filtered,
    total: filtered.length,
    filters: normalizedFilters,
    activeTopic,
    topicUnknown,
  };
}
