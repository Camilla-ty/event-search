import {
  applyEventExplorerFilters,
  normalizeEventExplorerFilters,
  readExplorerSeriesId,
} from "@/src/features/events/lib/eventExplorerQuery";
import {
  buildEventExplorerFilterFacetsFromEditions,
  getEventExplorerFacetEditions,
  type EventExplorerFilterFacets,
} from "@/src/features/events/lib/eventExplorerFilterFacets";
import { getPublicKeywordsForSeriesIds } from "@/src/features/events/server/seriesKeywordsPublic";
import {
  getPublicKeywordBySlug,
  getSeriesIdsForKeywordId,
} from "@/src/features/events/server/topicHubPublic";
import { getEventEditions } from "@/src/lib/queries/events";
import {
  getSponsorCountsByEditionIds,
  readSponsorCountForEdition,
} from "@/src/lib/queries/companies";
import { mapEventEditionSeriesEmbedForDisplay } from "@/src/lib/storage/mapPublicLogoUrl";

type EventExplorerFilters = {
  query?: string;
  regions?: readonly string[];
  /** @deprecated Use `regions`. */
  region?: string;
  startDate?: string;
  endDate?: string;
  /** @deprecated Use `topics`. */
  topic?: string;
  topics?: readonly string[];
};

export type EventExplorerActiveTopic = {
  slug: string;
  name: string;
};

export type EventExplorerData = {
  /** Full public catalog with keywords and sponsor counts (client-filterable). */
  catalog: Awaited<ReturnType<typeof getEventEditions>>;
  filteredCount: number;
  filters: {
    query: string;
    regions: string[];
    startDate: string;
    endDate: string;
    topics: string[];
  };
  filterFacets: EventExplorerFilterFacets;
  activeTopic: EventExplorerActiveTopic | null;
  topicUnknown: boolean;
};

const EMPTY_EVENT_EXPLORER_FILTER_FACETS: EventExplorerFilterFacets = {
  countries: [],
  topics: [],
};

export {
  editionMatchesTopicSeriesIds,
  readExplorerSeriesId as readEditionSeriesId,
} from "@/src/features/events/lib/eventExplorerQuery";

export type TopicSeriesResolution = {
  slug: string;
  keyword: EventExplorerActiveTopic | null;
  seriesIds: readonly string[];
};

export function mergeTopicSeriesResolutions(
  resolutions: readonly TopicSeriesResolution[],
): {
  activeTopic: EventExplorerActiveTopic | null;
  topicUnknown: boolean;
  topicSeriesIds: Set<string> | null;
} {
  if (resolutions.length === 0) {
    return {
      activeTopic: null,
      topicUnknown: false,
      topicSeriesIds: null,
    };
  }

  const topicSeriesIds = new Set<string>();
  for (const resolution of resolutions) {
    for (const seriesId of resolution.seriesIds) {
      const trimmed = seriesId.trim();
      if (trimmed !== "") {
        topicSeriesIds.add(trimmed);
      }
    }
  }

  const primary = resolutions[0];
  return {
    activeTopic: primary.keyword,
    topicUnknown: primary.keyword === null,
    topicSeriesIds,
  };
}

async function resolveTopicFilters(topicSlugs: readonly string[]): Promise<{
  activeTopic: EventExplorerActiveTopic | null;
  topicUnknown: boolean;
  topicSeriesIds: Set<string> | null;
}> {
  if (topicSlugs.length === 0) {
    return {
      activeTopic: null,
      topicUnknown: false,
      topicSeriesIds: null,
    };
  }

  const resolutions = await Promise.all(
    topicSlugs.map(async (slug): Promise<TopicSeriesResolution> => {
      const keyword = await getPublicKeywordBySlug(slug);
      if (!keyword) {
        return { slug, keyword: null, seriesIds: [] };
      }

      return {
        slug,
        keyword: { slug: keyword.slug, name: keyword.name },
        seriesIds: await getSeriesIdsForKeywordId(keyword.id),
      };
    }),
  );

  return mergeTopicSeriesResolutions(resolutions);
}

export async function getEventExplorerData(
  filters: EventExplorerFilters = {},
): Promise<EventExplorerData> {
  const normalizedFilters = normalizeEventExplorerFilters(filters);
  const editions = ((await getEventEditions()) ?? []).map(
    (edition) =>
      mapEventEditionSeriesEmbedForDisplay(
        edition as Record<string, unknown>,
      ) as typeof edition,
  );
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

  const { activeTopic, topicUnknown, topicSeriesIds } =
    await resolveTopicFilters(normalizedFilters.topics);

  const facetEditions = getEventExplorerFacetEditions(editionsWithKeywords, topicSeriesIds);
  const filterFacets =
    editionsWithKeywords.length === 0
      ? EMPTY_EVENT_EXPLORER_FILTER_FACETS
      : buildEventExplorerFilterFacetsFromEditions(
          facetEditions,
          editionsWithKeywords,
        );
  const filtered = applyEventExplorerFilters(editionsWithKeywords, normalizedFilters, {
    topicSeriesIds,
  });
  const sponsorCountsByEditionId = await getSponsorCountsByEditionIds(
    editionsWithKeywords.map((edition) => String(edition.id)),
  );
  const catalog = editionsWithKeywords.map((edition) => ({
    ...edition,
    sponsor_count: readSponsorCountForEdition(sponsorCountsByEditionId, String(edition.id)),
  }));

  return {
    catalog,
    filteredCount: filtered.length,
    filters: normalizedFilters,
    filterFacets,
    activeTopic,
    topicUnknown,
  };
}
