import { createAdminClient } from "@/src/lib/supabase/admin";

const SPONSORSHIP_SELECT = `
  id,
  tier_rank,
  tier_label,
  event_editions (
    id,
    name,
    year,
    slug,
    event_series ( id, name )
  )
`;

export type CompanySponsorshipRow = {
  id: string;
  tier_rank: number | null;
  tier_label: string | null;
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

function toSponsorshipRow(raw: Record<string, unknown>): CompanySponsorshipRow {
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
    tier_rank: typeof raw.tier_rank === "number" ? raw.tier_rank : null,
    tier_label: typeof raw.tier_label === "string" ? raw.tier_label : null,
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

/** All live sponsorship links for a company, newest edition year first. */
export async function listSponsorshipsForCompanyAdmin(
  companyId: string,
): Promise<CompanySponsorshipRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("event_sponsors")
    .select(SPONSORSHIP_SELECT)
    .eq("company_id", companyId);

  if (error) throw new Error(error.message);

  const rows = (data ?? []).map((row) =>
    toSponsorshipRow(row as Record<string, unknown>),
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
