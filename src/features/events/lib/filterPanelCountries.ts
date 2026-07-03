export type CountryCheckboxOption = {
  value: string;
  label: string;
};

export function buildCountryCheckboxOptions(
  countryOptions: readonly string[],
  selectedRegions: readonly string[],
): CountryCheckboxOption[] {
  const knownCountries = new Set(countryOptions);
  const unknownSelected: CountryCheckboxOption[] = [];
  const seenUnknown = new Set<string>();

  for (const region of selectedRegions) {
    if (knownCountries.has(region) || seenUnknown.has(region)) continue;
    seenUnknown.add(region);
    unknownSelected.push({ value: region, label: `${region} (not found)` });
  }

  return [
    ...unknownSelected,
    ...countryOptions.map((country) => ({ value: country, label: country })),
  ];
}

export function toggleCountrySelection(
  selectedRegions: readonly string[],
  country: string,
  checked: boolean,
): string[] {
  if (checked) {
    return selectedRegions.includes(country) ? [...selectedRegions] : [...selectedRegions, country];
  }

  return selectedRegions.filter((region) => region !== country);
}
