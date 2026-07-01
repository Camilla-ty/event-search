export type PublicVenueSummary = {
  id: string;
  name: string;
  website_url: string | null;
  address_text: string | null;
  logo_url: string | null;
  archived_at: string | null;
};

function hasVenueId(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const trimmed = String(value).trim();
  return trimmed !== "";
}

export function mapPublicVenueFromEditionRow(
  edition: Record<string, unknown>,
): PublicVenueSummary | null {
  if (!hasVenueId(edition.venue_id)) return null;

  const venues = edition.venues;
  if (!venues || typeof venues !== "object" || Array.isArray(venues)) {
    return null;
  }

  const row = venues as Record<string, unknown>;
  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (name === "") return null;

  return {
    id: typeof row.id === "string" ? row.id : String(row.id ?? edition.venue_id),
    name,
    website_url: typeof row.website_url === "string" ? row.website_url : null,
    address_text: typeof row.address_text === "string" ? row.address_text : null,
    logo_url: typeof row.logo_url === "string" ? row.logo_url : null,
    archived_at: typeof row.archived_at === "string" ? row.archived_at : null,
  };
}

export function editionHasVenueId(edition: Record<string, unknown>): boolean {
  return hasVenueId(edition.venue_id);
}
