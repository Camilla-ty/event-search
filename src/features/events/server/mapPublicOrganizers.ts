import type { EventSponsorCompany } from "@/src/features/events/components/detail/types";

export type PublicOrganizerRow = {
  id: string;
  role_label: string;
  display_order: number;
  company: EventSponsorCompany | null;
};

function mapOrganizerCompany(raw: unknown): EventSponsorCompany | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const row = raw as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id : row.id != null ? String(row.id) : null;
  if (!id) return null;

  return {
    id,
    slug: typeof row.slug === "string" ? row.slug : null,
    name: typeof row.name === "string" ? row.name : null,
    logo_url: typeof row.logo_url === "string" ? row.logo_url : null,
    logo_source: typeof row.logo_source === "string" ? row.logo_source : null,
    logo_status: typeof row.logo_status === "string" ? row.logo_status : null,
  };
}

/** Maps edition embed rows to sorted public organizer list (empty when none). */
export function mapPublicOrganizersFromEditionRow(
  edition: Record<string, unknown>,
): PublicOrganizerRow[] {
  const raw = edition.event_edition_organizers;
  if (!Array.isArray(raw) || raw.length === 0) {
    return [];
  }

  const rows: PublicOrganizerRow[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const id =
      typeof record.id === "string"
        ? record.id
        : record.id != null
          ? String(record.id)
          : null;
    if (!id) continue;

    const roleLabel =
      typeof record.role_label === "string" && record.role_label.trim() !== ""
        ? record.role_label.trim()
        : "Organizer";
    const displayOrder =
      typeof record.display_order === "number" ? record.display_order : Number.MAX_SAFE_INTEGER;

    rows.push({
      id,
      role_label: roleLabel,
      display_order: displayOrder,
      company: mapOrganizerCompany(record.companies),
    });
  }

  rows.sort((a, b) => {
    if (a.display_order !== b.display_order) {
      return a.display_order - b.display_order;
    }
    return a.id.localeCompare(b.id);
  });

  return rows;
}
