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

/**
 * Display label for a city FK embed.
 * - state ≠ city → "city, state"
 * - else country ≠ city → "city, country"
 * - else → city only
 */
export function formatLocationLabel(input: LocationLabelInput): string {
  const city = normalizePart(input.city);
  if (city === "") return "";

  const state = normalizePart(input.state);
  if (state !== "" && !partsEqual(state, city)) {
    return `${city}, ${state}`;
  }

  const country = normalizePart(input.country);
  if (country !== "" && !partsEqual(country, city)) {
    return `${city}, ${country}`;
  }

  return city;
}
