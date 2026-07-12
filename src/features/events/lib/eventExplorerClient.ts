import type { EventRecord } from "@/src/features/events/components/explorer/types";
import type { EventExplorerFilterFacets } from "@/src/features/events/lib/eventExplorerFilterFacets";
import {
  buildEventExplorerFilterFacetsFromEditions,
} from "@/src/features/events/lib/eventExplorerFilterFacets";
import {
  applyEventExplorerFilters,
  editionMatchesEventExplorerTopicSlugs,
  normalizeEventExplorerFilters,
  type EventExplorerFilterState,
} from "@/src/features/events/lib/eventExplorerQuery";
import {
  DEFAULT_EVENT_EXPLORER_SORT_MODE,
  sortEventExplorerResults,
  type EventExplorerSortMode,
} from "@/src/features/events/lib/eventExplorerOrdering";

export function filterEventExplorerCatalog(
  catalog: readonly EventRecord[],
  filters: EventExplorerFilterState,
): EventRecord[] {
  return applyEventExplorerFilters(catalog, filters, { matchTopicsByKeywords: true });
}

export function buildEventExplorerClientFilterFacets(
  catalog: readonly EventRecord[],
  filters: EventExplorerFilterState,
): EventExplorerFilterFacets {
  const normalized = normalizeEventExplorerFilters(filters);
  const topicScoped =
    normalized.topics.length === 0
      ? catalog
      : catalog.filter((item) =>
          editionMatchesEventExplorerTopicSlugs(item, normalized.topics),
        );

  return buildEventExplorerFilterFacetsFromEditions(topicScoped, catalog);
}

export function buildEventExplorerDisplayEvents(
  catalog: readonly EventRecord[],
  filters: EventExplorerFilterState,
  sort: EventExplorerSortMode = DEFAULT_EVENT_EXPLORER_SORT_MODE,
): EventRecord[] {
  const filtered = filterEventExplorerCatalog(catalog, filters);
  return sortEventExplorerResults(filtered, {
    query: normalizeEventExplorerFilters(filters).query,
    sortMode: sort,
  });
}
