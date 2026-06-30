import {
  editionMatchesTopicSeriesIds,
  type EventExplorerMatchable,
} from "@/src/features/events/lib/eventExplorerQuery";

export type EventExplorerFilterFacets = {
  series: string[];
  countries: string[];
};

export function getEventExplorerFacetEditions<T extends EventExplorerMatchable & { series_id?: unknown }>(
  editions: readonly T[],
  topicSeriesIds: ReadonlySet<string> | null,
): T[] {
  if (topicSeriesIds === null) {
    return [...editions];
  }

  return editions.filter((edition) =>
    editionMatchesTopicSeriesIds(edition, topicSeriesIds),
  );
}

export function buildEventExplorerFilterFacets(
  editions: readonly EventExplorerMatchable[],
): EventExplorerFilterFacets {
  const seriesNames = new Set<string>();
  const countryNames = new Set<string>();

  for (const edition of editions) {
    const seriesName = edition.event_series?.name?.trim();
    if (seriesName) {
      seriesNames.add(seriesName);
    }

    const countryName = edition.cities?.countries?.name?.trim();
    if (countryName) {
      countryNames.add(countryName);
    }
  }

  const sortLabels = (values: Set<string>) =>
    Array.from(values).sort((a, b) => a.localeCompare(b));

  return {
    series: sortLabels(seriesNames),
    countries: sortLabels(countryNames),
  };
}
