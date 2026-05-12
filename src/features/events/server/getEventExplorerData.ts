import { getEventEditions } from "@/src/lib/queries/events";

type EventExplorerFilters = {
  query?: string;
  industry?: string;
  region?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
};

function normalize(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function toDateValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export async function getEventExplorerData(filters: EventExplorerFilters = {}) {
  const editions = (await getEventEditions()) ?? [];
  const query = normalize(filters.query);
  const industry = normalize(filters.industry);
  const region = normalize(filters.region);
  const type = normalize(filters.type);
  const startDate = filters.startDate ?? "";
  const endDate = filters.endDate ?? "";

  const filtered = editions.filter((edition) => {
    const eventName = normalize(edition.name);
    const cityName = normalize(edition.cities?.name);
    const countryName = normalize(edition.cities?.countries?.name);
    const seriesName = normalize(edition.event_series?.name);

    const queryMatch =
      !query ||
      eventName.includes(query) ||
      cityName.includes(query) ||
      countryName.includes(query) ||
      seriesName.includes(query);
    const industryMatch = !industry || industry === "all" || seriesName === industry;
    const regionMatch = !region || region === "all" || countryName === region;
    const typeMatch = !type || type === "all" || seriesName === type;

    const startValue = toDateValue(edition.start_date);
    const endValue = toDateValue(edition.end_date ?? edition.start_date);
    const afterStart = !startDate || !endValue || endValue >= startDate;
    const beforeEnd = !endDate || !startValue || startValue <= endDate;

    return queryMatch && industryMatch && regionMatch && typeMatch && afterStart && beforeEnd;
  });

  return {
    editions: filtered,
    total: filtered.length,
    filters: {
      query: filters.query ?? "",
      industry: filters.industry ?? "all",
      region: filters.region ?? "all",
      type: filters.type ?? "all",
      startDate: filters.startDate ?? "",
      endDate: filters.endDate ?? "",
    },
  };
}
