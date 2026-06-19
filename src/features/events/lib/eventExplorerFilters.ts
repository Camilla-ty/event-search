import type { EventFilters, EventRecord } from "@/src/features/events/components/explorer/types";

import { readEventIsoDate } from "@/src/features/events/lib/readEventIsoDate";

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function filterEventRecords(
  events: readonly EventRecord[],
  filters: EventFilters,
): EventRecord[] {
  const query = normalize(filters.query);
  const industry = normalize(filters.industry);
  const region = normalize(filters.region);
  const type = normalize(filters.type);
  const startDate = filters.startDate.trim();
  const endDate = filters.endDate.trim();

  return events.filter((event) => {
    const eventName = normalize(event.name);
    const cityName = normalize(event.cities?.name);
    const countryName = normalize(event.cities?.countries?.name);
    const seriesName = normalize(event.event_series?.name);
    const regionName = normalize(event.cities?.countries?.name);

    const queryMatch =
      query === "" ||
      eventName.includes(query) ||
      cityName.includes(query) ||
      countryName.includes(query) ||
      seriesName.includes(query);
    const industryMatch = industry === "" || industry === "all" || seriesName === industry;
    const regionMatch = region === "" || region === "all" || regionName === region;
    const typeMatch = type === "" || type === "all" || seriesName === type;

    const startValue = readEventIsoDate(event.start_date);
    const endValue = readEventIsoDate(event.end_date ?? event.start_date);
    const afterStart = startDate === "" || endValue === "" || endValue >= startDate;
    const beforeEnd = endDate === "" || startValue === "" || startValue <= endDate;

    return queryMatch && industryMatch && regionMatch && typeMatch && afterStart && beforeEnd;
  });
}
