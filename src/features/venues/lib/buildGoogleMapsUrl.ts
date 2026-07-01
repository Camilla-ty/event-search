export function buildVenueGoogleMapsUrl(params: {
  name: string;
  addressText?: string | null;
  cityLabel?: string | null;
}): string | null {
  const name = params.name.trim();
  if (name === "") return null;

  const parts = [
    params.addressText?.trim() || null,
    name,
    params.cityLabel?.trim() || null,
  ].filter((part): part is string => Boolean(part));

  if (parts.length === 0) return null;

  const query = parts.join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
