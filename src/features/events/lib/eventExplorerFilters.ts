import type { EventFilters, EventRecord } from "@/src/features/events/components/explorer/types";

import { eventExplorerDomainMatchesQuery } from "@/src/features/events/lib/eventExplorerDomain";
import { readEventIsoDate } from "@/src/features/events/lib/readEventIsoDate";

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function filterEventRecords(
  events: readonly EventRecord[],
  filters: EventFilters,
): EventRecord[] {
  const query = normalize(filters.query);
  const series = normalize(filters.series);
  const region = normalize(filters.region);
  const startDate = filters.startDate.trim();
  const endDate = filters.endDate.trim();

  return events.filter((event) => {
    const eventName = normalize(event.name);
    const seriesName = normalize(event.event_series?.name);
    const regionName = normalize(event.cities?.countries?.name);

    const queryMatch =
      query === "" ||
      eventName.includes(query) ||
      seriesName.includes(query) ||
      eventExplorerDomainMatchesQuery(event, filters.query, "includes");
    const seriesMatch = series === "" || series === "all" || seriesName === series;
    const regionMatch = region === "" || region === "all" || regionName === region;

    const startValue = readEventIsoDate(event.start_date);
    const endValue = readEventIsoDate(event.end_date ?? event.start_date);
    const afterStart = startDate === "" || endValue === "" || endValue >= startDate;
    const beforeEnd = endDate === "" || startValue === "" || startValue <= endDate;

    return queryMatch && seriesMatch && regionMatch && afterStart && beforeEnd;
  });
}
