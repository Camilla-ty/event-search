export type ActiveCountryChip = {
  value: string;
  label: string;
  unknown: boolean;
};

export function buildActiveCountryChips(
  selectedRegions: readonly string[],
  countryOptions: readonly string[],
): ActiveCountryChip[] {
  const knownCountries = new Set(countryOptions);
  const seen = new Set<string>();
  const chips: ActiveCountryChip[] = [];

  for (const region of selectedRegions) {
    if (seen.has(region)) continue;
    seen.add(region);

    if (knownCountries.has(region)) {
      chips.push({ value: region, label: region, unknown: false });
      continue;
    }

    chips.push({ value: region, label: `${region} (not found)`, unknown: true });
  }

  return chips;
}
