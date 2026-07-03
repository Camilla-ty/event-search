import Link from "next/link";

import { EventExplorerPage } from "@/src/features/events/components/explorer/EventExplorerPage";
import type { EventRecord } from "@/src/features/events/components/explorer/types";
import { sortEventExplorerResults } from "@/src/features/events/lib/eventExplorerOrdering";
import { parseEventExplorerFiltersFromSearchParams } from "@/src/features/events/lib/eventExplorerQuery";
import { getEventExplorerData } from "@/src/features/events/server/getEventExplorerData";
import { createPageMetadata } from "@/src/lib/metadata/site";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "Events",
  description: "Discover and analyze events, sponsors, and opportunities across the industry.",
  path: "/events",
});

type EventsPageProps = {
  searchParams: Promise<{
    q?: string;
    industry?: string;
    region?: string | string[];
    type?: string;
    start?: string;
    end?: string;
    topic?: string | string[];
    view?: string;
    month?: string;
  }>;
};

function toEventExplorerSearchParams(
  raw: Awaited<EventsPageProps["searchParams"]>,
): URLSearchParams {
  const params = new URLSearchParams();

  const entries: Array<[string, string | string[] | undefined]> = [
    ["q", raw.q],
    ["industry", raw.industry],
    ["type", raw.type],
    ["start", raw.start],
    ["end", raw.end],
    ["view", raw.view],
    ["month", raw.month],
  ];

  for (const [key, value] of entries) {
    if (typeof value !== "string" || value === "") continue;
    params.set(key, value);
  }

  const regionValues =
    raw.region === undefined ? [] : Array.isArray(raw.region) ? raw.region : [raw.region];
  for (const region of regionValues) {
    if (region !== "") params.append("region", region);
  }

  const topicValues = raw.topic === undefined ? [] : Array.isArray(raw.topic) ? raw.topic : [raw.topic];
  for (const topic of topicValues) {
    params.append("topic", topic);
  }

  return params;
}

export default async function EventsPageRoute({ searchParams }: EventsPageProps) {
  const raw = await searchParams;
  const filters = parseEventExplorerFiltersFromSearchParams(toEventExplorerSearchParams(raw));
  const data = await getEventExplorerData({
    query: filters.query,
    regions: filters.regions,
    startDate: filters.startDate,
    endDate: filters.endDate,
    topics: filters.topics,
  });
  const events: EventRecord[] = sortEventExplorerResults(
    (data.editions ?? []).map((edition) => ({
      id: String(edition.id),
      slug: edition.slug ?? null,
      name: edition.name ?? null,
      website_url: edition.website_url ?? null,
      sponsor_count:
        typeof (edition as { sponsor_count?: unknown }).sponsor_count === "number"
          ? (edition as { sponsor_count: number }).sponsor_count
          : 0,
      last_reviewed_at:
        typeof (edition as { last_reviewed_at?: unknown }).last_reviewed_at === "string"
          ? (edition as { last_reviewed_at: string }).last_reviewed_at
          : null,
      start_date: edition.start_date ?? null,
      end_date: edition.end_date ?? null,
      event_series: edition.event_series
        ? {
            name: edition.event_series.name ?? null,
            logo_url: edition.event_series.logo_url ?? null,
            website_url: edition.event_series.website_url ?? null,
          }
        : null,
      series_keywords: Array.isArray(
        (edition as { series_keywords?: unknown }).series_keywords,
      )
        ? (
            (edition as { series_keywords: { id: string; name: string; slug: string }[] })
              .series_keywords
          ).map((keyword) => ({
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
    })),
    {
      query: data.filters.query ?? "",
      sortMode: "recommended",
    },
  );

  return (
    <EventExplorerPage
      events={events}
      initialFilters={{
        query: data.filters.query ?? "",
        regions: data.filters.regions ?? [],
        startDate: data.filters.startDate ?? "",
        endDate: data.filters.endDate ?? "",
        topics: data.filters.topics ?? [],
      }}
      filterFacets={data.filterFacets}
    />
  );
}
