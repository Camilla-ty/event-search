import type { EventFilters, EventRecord } from "@/src/features/events/components/explorer/types";

import { eventExplorerDomainMatchesQuery } from "@/src/features/events/lib/eventExplorerDomain";
import {
  editionMatchesEventExplorerRegions,
  eventOverlapsDateRange,
} from "@/src/features/events/lib/eventExplorerQuery";

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function filterEventRecords(
  events: readonly EventRecord[],
  filters: EventFilters,
): EventRecord[] {
  const query = normalize(filters.query);
  const startDate = filters.startDate.trim();
  const endDate = filters.endDate.trim();

  return events.filter((event) => {
    const eventName = normalize(event.name);
    const seriesName = normalize(event.event_series?.name);

    const queryMatch =
      query === "" ||
      eventName.includes(query) ||
      seriesName.includes(query) ||
      eventExplorerDomainMatchesQuery(event, filters.query, "includes");
    const regionMatch = editionMatchesEventExplorerRegions(event, filters.regions);
    const dateMatch = eventOverlapsDateRange(event, startDate, endDate);

    return queryMatch && regionMatch && dateMatch;
  });
}
