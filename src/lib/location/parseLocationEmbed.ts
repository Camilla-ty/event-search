import {
  formatLocationLabel,
  type LocationLabelInput,
} from "@/src/lib/location/formatLocationLabel";

function readName(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  if (!candidate || typeof candidate !== "object") return null;
  const name = (candidate as Record<string, unknown>).name;
  return typeof name === "string" ? name : null;
}

/** Parse Supabase `cities ( states, countries )` embed into formatter input. */
export function locationInputFromCityEmbed(raw: unknown): LocationLabelInput {
  if (raw === null || raw === undefined || typeof raw !== "object") {
    return { city: null, state: null, country: null };
  }

  const record = Array.isArray(raw) ? raw[0] : raw;
  if (!record || typeof record !== "object") {
    return { city: null, state: null, country: null };
  }

  const row = record as Record<string, unknown>;
  const city = typeof row.name === "string" ? row.name : null;

  return {
    city,
    state: readName(row.states),
    country: readName(row.countries),
  };
}

export function formatLocationFromCityEmbed(raw: unknown): string {
  return formatLocationLabel(locationInputFromCityEmbed(raw));
}
