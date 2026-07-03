import {
  editionMatchesTopicSeriesIds,
  type EventExplorerMatchable,
} from "@/src/features/events/lib/eventExplorerQuery";

export type EventExplorerTopicFacet = {
  slug: string;
  name: string;
};

export type EventExplorerFilterFacets = {
  countries: string[];
  topics: EventExplorerTopicFacet[];
};

export type EventExplorerTopicFacetSource = {
  series_keywords?: readonly { name?: string | null; slug?: string | null }[] | null;
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
  const countryNames = new Set<string>();

  for (const edition of editions) {
    const countryName = edition.cities?.countries?.name?.trim();
    if (countryName) {
      countryNames.add(countryName);
    }
  }

  const sortLabels = (values: Set<string>) =>
    Array.from(values).sort((a, b) => a.localeCompare(b));

  return {
    countries: sortLabels(countryNames),
    topics: [],
  };
}

export function buildEventExplorerTopicFacets(
  editions: readonly EventExplorerTopicFacetSource[],
): EventExplorerTopicFacet[] {
  const bySlug = new Map<string, EventExplorerTopicFacet>();

  for (const edition of editions) {
    for (const keyword of edition.series_keywords ?? []) {
      const slug = (keyword.slug ?? "").trim();
      if (slug === "") continue;

      if (!bySlug.has(slug)) {
        const name = (keyword.name ?? "").trim();
        bySlug.set(slug, { slug, name: name !== "" ? name : slug });
      }
    }
  }

  return Array.from(bySlug.values()).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

export function buildEventExplorerFilterFacetsFromEditions(
  editions: readonly EventExplorerMatchable[],
  topicFacetSources: readonly EventExplorerTopicFacetSource[] = editions,
): EventExplorerFilterFacets {
  const base = buildEventExplorerFilterFacets(editions);
  return {
    ...base,
    topics: buildEventExplorerTopicFacets(topicFacetSources),
  };
}
