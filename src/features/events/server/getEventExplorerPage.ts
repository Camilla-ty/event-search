import type { EventRecord } from "@/src/features/events/components/explorer/types";
import {
  buildEventExplorerFilterFacetsFromEditions,
  getEventExplorerFacetEditions,
  type EventExplorerFilterFacets,
} from "@/src/features/events/lib/eventExplorerFilterFacets";
import { mapEditionToEventRecord } from "@/src/features/events/lib/mapEditionToEventRecord";
import {
  applyEventExplorerFilters,
  normalizeEventExplorerFilters,
  readExplorerSeriesId,
} from "@/src/features/events/lib/eventExplorerQuery";
import { sortEventExplorerResults } from "@/src/features/events/lib/eventExplorerOrdering";
import { getPublicKeywordsForSeriesIds } from "@/src/features/events/server/seriesKeywordsPublic";
import {
  clampEventExplorerPage,
  EVENT_EXPLORER_PAGE_SIZE,
  parseEventExplorerParams,
  type EventExplorerParams,
  type EventExplorerSearchInput,
} from "@/src/features/events/server/eventExplorerParams";
import { mapEditionToEventExplorerRow } from "@/src/features/events/server/mapEventExplorerRow";
import type { EventExplorerPageResult } from "@/src/features/events/server/eventExplorerTypes";
import {
  getEventExplorerData,
  resolveTopicFilters,
  type EventExplorerActiveTopic,
} from "@/src/features/events/server/getEventExplorerData";
import { getEventEditions } from "@/src/lib/queries/events";
import {
  getSponsorCountsByEditionIds,
  readSponsorCountForEdition,
} from "@/src/lib/queries/companies";
import { mapEventEditionSeriesEmbedForDisplay } from "@/src/lib/storage/mapPublicLogoUrl";

const EMPTY_EVENT_EXPLORER_FILTER_FACETS: EventExplorerFilterFacets = {
  countries: [],
  topics: [],
};

export type EventExplorerCatalogContext = {
  catalog: EventRecord[];
  filterFacets: EventExplorerFilterFacets;
  activeTopic: EventExplorerActiveTopic | null;
  topicUnknown: boolean;
  topicSeriesIds: Set<string> | null;
};

export async function loadEventExplorerCatalogContext(
  topicSlugs: readonly string[],
): Promise<EventExplorerCatalogContext> {
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
    await resolveTopicFilters(topicSlugs);

  const facetEditions = getEventExplorerFacetEditions(editionsWithKeywords, topicSeriesIds);
  const filterFacets =
    editionsWithKeywords.length === 0
      ? EMPTY_EVENT_EXPLORER_FILTER_FACETS
      : buildEventExplorerFilterFacetsFromEditions(
          facetEditions,
          editionsWithKeywords,
        );

  const sponsorCountsByEditionId = await getSponsorCountsByEditionIds(
    editionsWithKeywords.map((edition) => String(edition.id)),
  );
  const catalog = editionsWithKeywords.map((edition) =>
    mapEditionToEventRecord({
      ...edition,
      sponsor_count: readSponsorCountForEdition(
        sponsorCountsByEditionId,
        String(edition.id),
      ),
    }),
  );

  return {
    catalog,
    filterFacets,
    activeTopic,
    topicUnknown,
    topicSeriesIds,
  };
}

export function buildEventExplorerPageFromCatalog(
  catalog: readonly EventRecord[],
  params: EventExplorerParams,
  context: Pick<
    EventExplorerCatalogContext,
    "filterFacets" | "activeTopic" | "topicUnknown" | "topicSeriesIds"
  >,
): EventExplorerPageResult {
  const normalizedFilters = normalizeEventExplorerFilters(params.filters);
  const filtered = applyEventExplorerFilters(catalog, normalizedFilters, {
    topicSeriesIds: context.topicSeriesIds,
  });
  const sorted = sortEventExplorerResults(filtered, {
    query: normalizedFilters.query,
    sortMode: params.sort,
  });

  const total = sorted.length;
  const page = clampEventExplorerPage(params.page, total, EVENT_EXPLORER_PAGE_SIZE);
  const offset = (page - 1) * EVENT_EXPLORER_PAGE_SIZE;
  const rows = sorted
    .slice(offset, offset + EVENT_EXPLORER_PAGE_SIZE)
    .map(mapEditionToEventExplorerRow);

  const resolvedParams: EventExplorerParams = {
    filters: normalizedFilters,
    sort: params.sort,
    page,
  };

  return {
    rows,
    total,
    page,
    page_size: EVENT_EXPLORER_PAGE_SIZE,
    sort: params.sort,
    filters: normalizedFilters,
    facets: context.filterFacets,
    activeTopic: context.activeTopic,
    topicUnknown: context.topicUnknown,
    params: resolvedParams,
    pageWasClamped: page !== params.page,
  };
}

async function fetchEventExplorerPage(
  params: EventExplorerParams,
): Promise<EventExplorerPageResult> {
  const context = await loadEventExplorerCatalogContext(params.filters.topics);
  return buildEventExplorerPageFromCatalog(context.catalog, params, context);
}

export async function getEventExplorerPage(
  input: EventExplorerSearchInput = {},
): Promise<EventExplorerPageResult> {
  const params = parseEventExplorerParams(input);
  const result = await fetchEventExplorerPage(params);

  const shouldClampPage =
    result.total > 0 &&
    result.rows.length === 0 &&
    params.page > 1 &&
    !result.topicUnknown;

  if (!shouldClampPage) {
    return result;
  }

  const clampedPage = clampEventExplorerPage(
    params.page,
    result.total,
    EVENT_EXPLORER_PAGE_SIZE,
  );

  if (clampedPage === params.page) {
    return result;
  }

  return fetchEventExplorerPage({
    ...params,
    page: clampedPage,
  });
}