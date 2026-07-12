import Link from "next/link";

import { EventExplorerPage } from "@/src/features/events/components/explorer/EventExplorerPage";
import { mapEditionToEventRecord } from "@/src/features/events/lib/mapEditionToEventRecord";
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
  const catalog = (data.catalog ?? []).map((edition) => mapEditionToEventRecord(edition));

  return (
    <EventExplorerPage
      catalog={catalog}
      initialFilters={{
        query: data.filters.query ?? "",
        regions: data.filters.regions ?? [],
        startDate: data.filters.startDate ?? "",
        endDate: data.filters.endDate ?? "",
        topics: data.filters.topics ?? [],
      }}
      initialFilterFacets={data.filterFacets}
    />
  );
}
