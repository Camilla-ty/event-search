import type { EventRecord } from "@/src/features/events/components/explorer/types";
import { readExplorerSeriesId } from "@/src/features/events/lib/eventExplorerQuery";

type EditionLike = {
  id: unknown;
  series_id?: unknown;
  slug?: string | null;
  name?: string | null;
  website_url?: string | null;
  sponsor_count?: unknown;
  last_reviewed_at?: unknown;
  start_date?: string | null;
  end_date?: string | null;
  event_series?: {
    name?: string | null;
    logo_url?: string | null;
    website_url?: string | null;
  } | null;
  series_keywords?: readonly { id: string; name: string; slug: string }[];
  cities?: {
    name?: string | null;
    states?: { name?: string | null } | null;
    countries?: { name?: string | null } | null;
  } | null;
};

export function mapEditionToEventRecord(edition: EditionLike): EventRecord {
  const seriesId = readExplorerSeriesId(edition);

  return {
    id: String(edition.id),
    series_id: seriesId !== "" ? seriesId : null,
    slug: edition.slug ?? null,
    name: edition.name ?? null,
    website_url: edition.website_url ?? null,
    sponsor_count:
      typeof edition.sponsor_count === "number" ? edition.sponsor_count : 0,
    last_reviewed_at:
      typeof edition.last_reviewed_at === "string" ? edition.last_reviewed_at : null,
    start_date: edition.start_date ?? null,
    end_date: edition.end_date ?? null,
    event_series: edition.event_series
      ? {
          name: edition.event_series.name ?? null,
          logo_url: edition.event_series.logo_url ?? null,
          website_url: edition.event_series.website_url ?? null,
        }
      : null,
    series_keywords: Array.isArray(edition.series_keywords)
      ? edition.series_keywords.map((keyword) => ({
          id: keyword.id,
          name: keyword.name,
          slug: keyword.slug,
        }))
      : [],
    cities: edition.cities
      ? {
          name: edition.cities.name ?? null,
          states:
            edition.cities.states && typeof edition.cities.states === "object"
              ? { name: edition.cities.states.name ?? null }
              : null,
          countries: edition.cities.countries
            ? {
                name: edition.cities.countries.name ?? null,
              }
            : null,
        }
      : null,
  };
}
