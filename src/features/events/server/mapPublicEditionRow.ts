import type {
  PublicEditionSummary,
  PublicEventSeriesSummary,
} from "@/src/features/events/types/publicEdition";
import { resolveEditionDisplayLogo } from "@/src/lib/events/resolveEditionDisplayLogo";
import { formatLocationLabel } from "@/src/lib/location/formatLocationLabel";

function readCityEmbed(raw: unknown): {
  name?: string | null;
  states?: { name?: string | null } | null;
  countries?: { name?: string | null } | null;
} | null {
  if (raw === null || typeof raw !== "object") return null;
  return raw as {
    name?: string | null;
    states?: { name?: string | null } | null;
    countries?: { name?: string | null } | null;
  };
}

export function mapPublicEventSeries(raw: unknown): PublicEventSeriesSummary | null {
  if (raw === null || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id.trim() : "";
  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (id === "" || name === "") return null;

  const slug = typeof row.slug === "string" ? row.slug.trim() : "";
  return {
    id,
    slug: slug !== "" ? slug : id,
    name,
    description: typeof row.description === "string" ? row.description : null,
    website_url: typeof row.website_url === "string" ? row.website_url : null,
    logo_url: typeof row.logo_url === "string" ? row.logo_url : null,
  };
}

export function mapPublicEditionRow(raw: unknown): PublicEditionSummary | null {
  if (raw === null || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id.trim() : "";
  const name = typeof row.name === "string" ? row.name.trim() : "";
  const slug = typeof row.slug === "string" ? row.slug.trim() : "";
  if (id === "" || name === "" || slug === "") return null;

  const series = mapPublicEventSeries(row.event_series);
  const cities = readCityEmbed(row.cities);
  const yearRaw = row.year;
  const year =
    typeof yearRaw === "number" && Number.isInteger(yearRaw)
      ? yearRaw
      : typeof yearRaw === "string" && yearRaw.trim() !== ""
        ? Number(yearRaw)
        : null;

  return {
    id,
    slug,
    name,
    year: year !== null && Number.isInteger(year) ? year : null,
    start_date: typeof row.start_date === "string" ? row.start_date : null,
    end_date: typeof row.end_date === "string" ? row.end_date : null,
    locationLabel: formatLocationLabel({
      city: cities?.name ?? null,
      state: cities?.states?.name ?? null,
      country: cities?.countries?.name ?? null,
    }),
    display_logo_url: resolveEditionDisplayLogo({
      logo_url: typeof row.logo_url === "string" ? row.logo_url : null,
      event_series: series,
    }),
    event_series: series
      ? { name: series.name, logo_url: series.logo_url }
      : null,
  };
}
