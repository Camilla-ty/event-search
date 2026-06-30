import Link from "next/link";

import { EventExplorerPage } from "@/src/features/events/components/explorer/EventExplorerPage";
import type { EventRecord } from "@/src/features/events/components/explorer/types";
import { sortEventExplorerResults } from "@/src/features/events/lib/eventExplorerOrdering";
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
    region?: string;
    type?: string;
    start?: string;
    end?: string;
    topic?: string;
    view?: string;
    month?: string;
  }>;
};

export default async function EventsPageRoute({ searchParams }: EventsPageProps) {
  const { q, industry, region, type, start, end, topic } = await searchParams;
  const data = await getEventExplorerData({
    query: q,
    industry,
    region,
    type,
    startDate: start,
    endDate: end,
    topic,
  });
  const events: EventRecord[] = sortEventExplorerResults(
    (data.editions ?? []).map((edition) => ({
      id: String(edition.id),
      slug: edition.slug ?? null,
      name: edition.name ?? null,
      start_date: edition.start_date ?? null,
      end_date: edition.end_date ?? null,
      event_series: edition.event_series
        ? {
            name: edition.event_series.name ?? null,
            logo_url: edition.event_series.logo_url ?? null,
          }
        : null,
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
        industry: data.filters.industry ?? "all",
        region: data.filters.region ?? "all",
        type: data.filters.type ?? "all",
        startDate: data.filters.startDate ?? "",
        endDate: data.filters.endDate ?? "",
        topic: data.filters.topic ?? "",
      }}
      activeTopic={data.activeTopic}
      topicUnknown={data.topicUnknown}
    />
  );
}
