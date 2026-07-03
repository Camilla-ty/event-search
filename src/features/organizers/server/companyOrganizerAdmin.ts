import { createAdminClient } from "@/src/lib/supabase/admin";

const ORGANIZER_ROLE_SELECT = `
  id,
  role_label,
  display_order,
  event_editions (
    id,
    name,
    year,
    slug,
    event_series ( id, name )
  )
`;

export type CompanyOrganizerRoleRow = {
  id: string;
  role_label: string;
  edition: {
    id: string;
    name: string;
    year: number | null;
    slug: string | null;
  } | null;
  series: {
    id: string;
    name: string;
  } | null;
};

function toOrganizerRoleRow(raw: Record<string, unknown>): CompanyOrganizerRoleRow {
  const editionRaw =
    raw.event_editions && typeof raw.event_editions === "object"
      ? (raw.event_editions as Record<string, unknown>)
      : null;
  const seriesRaw =
    editionRaw && editionRaw.event_series && typeof editionRaw.event_series === "object"
      ? (editionRaw.event_series as Record<string, unknown>)
      : null;

  return {
    id: String(raw.id),
    role_label: typeof raw.role_label === "string" ? raw.role_label : "Organizer",
    edition: editionRaw
      ? {
          id: String(editionRaw.id),
          name: typeof editionRaw.name === "string" ? editionRaw.name : "—",
          year: typeof editionRaw.year === "number" ? editionRaw.year : null,
          slug: typeof editionRaw.slug === "string" ? editionRaw.slug : null,
        }
      : null,
    series: seriesRaw
      ? {
          id: String(seriesRaw.id),
          name: typeof seriesRaw.name === "string" ? seriesRaw.name : "—",
        }
      : null,
  };
}

/** Read-only organizer roles for a company (admin company detail). */
export async function listOrganizerRolesForCompanyAdmin(
  companyId: string,
): Promise<CompanyOrganizerRoleRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("event_edition_organizers")
    .select(ORGANIZER_ROLE_SELECT)
    .eq("company_id", companyId);

  if (error) throw new Error(error.message);

  const rows = (data ?? []).map((row) =>
    toOrganizerRoleRow(row as Record<string, unknown>),
  );

  rows.sort((a, b) => {
    const yearA = a.edition?.year ?? 0;
    const yearB = b.edition?.year ?? 0;
    if (yearA !== yearB) return yearB - yearA;
    const nameA = a.edition?.name ?? "";
    const nameB = b.edition?.name ?? "";
    return nameA.localeCompare(nameB);
  });

  return rows;
}
