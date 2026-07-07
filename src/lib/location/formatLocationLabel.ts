export type LocationLabelInput = {
  city?: string | null;
  state?: string | null;
  country?: string | null;
};

function normalizePart(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function partsEqual(a: string, b: string): boolean {
  if (a === "" || b === "") return false;
  return a.localeCompare(b, undefined, { sensitivity: "accent" }) === 0;
}

function isUnitedStatesCountry(country: string): boolean {
  const normalized = country.trim().toLowerCase();
  return (
    normalized === "united states" ||
    normalized === "united states of america" ||
    normalized === "usa" ||
    normalized === "u.s." ||
    normalized === "u.s.a."
  );
}

/**
 * Display label for a city FK embed.
 * - US events with state → "City, State"
 * - Non-US events with distinct country → "City, Country"
 * - City-state / same-name city and country → city only
 */
export function formatLocationLabel(input: LocationLabelInput): string {
  const city = normalizePart(input.city);
  if (city === "") return "";

  const state = normalizePart(input.state);
  const country = normalizePart(input.country);

  if (isUnitedStatesCountry(country)) {
    if (state !== "" && !partsEqual(state, city)) {
      return `${city}, ${state}`;
    }

    return city;
  }

  if (country !== "" && !partsEqual(country, city)) {
    return `${city}, ${country}`;
  }

  return city;
}
