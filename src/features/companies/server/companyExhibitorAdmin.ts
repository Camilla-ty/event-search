import { fetchAllPaginatedSupabaseRows } from "@/src/lib/supabase/fetchAllPaginatedRows";
import { createAdminClient } from "@/src/lib/supabase/admin";

const EXHIBITOR_SELECT = `
  id,
  company_id,
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

export type CompanyExhibitorEdition = {
  id: string;
  name: string;
  year: number | null;
  slug: string | null;
};

export type CompanyExhibitorSeries = {
  id: string;
  name: string;
};

export type CompanyExhibitorRow = {
  id: string;
  tier_rank: number | null;
  tier_label: string | null;
  edition: CompanyExhibitorEdition | null;
  series: CompanyExhibitorSeries | null;
};

export function exhibitorEditionAdminHref(editionId: string): string {
  return `/admin/events/editions/${editionId}?tab=exhibitors`;
}

export function eventSeriesAdminHref(seriesId: string): string {
  return `/admin/events/series/${seriesId}`;
}

function embedRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    const first = value[0];
    return first && typeof first === "object" ? (first as Record<string, unknown>) : null;
  }
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function editionYear(row: CompanyExhibitorRow): number | null {
  return row.edition?.year ?? null;
}

/** Oldest year first. Undated editions follow dated ones. Name, then id, breaks ties. */
export function compareCompanyExhibitorRows(
  a: CompanyExhibitorRow,
  b: CompanyExhibitorRow,
): number {
  const yearA = editionYear(a);
  const yearB = editionYear(b);
  if (yearA === null && yearB !== null) return 1;
  if (yearA !== null && yearB === null) return -1;
  if (yearA !== null && yearB !== null && yearA !== yearB) return yearA - yearB;
  const nameA = a.edition?.name ?? "";
  const nameB = b.edition?.name ?? "";
  const byName = nameA.localeCompare(nameB);
  if (byName !== 0) return byName;
  return a.id.localeCompare(b.id);
}

export function mapExhibitorAdminRows(
  companyId: string,
  rawRows: readonly Record<string, unknown>[],
): CompanyExhibitorRow[] {
  const requestedId = companyId.trim();
  const rows: CompanyExhibitorRow[] = [];

  for (const raw of rawRows) {
    const rowCompanyId = typeof raw.company_id === "string" ? raw.company_id.trim() : "";
    if (rowCompanyId !== requestedId) continue;
    const id = typeof raw.id === "string" ? raw.id : "";
    if (id === "") continue;

    const editionRaw = embedRecord(raw.event_editions);
    const seriesRaw = editionRaw ? embedRecord(editionRaw.event_series) : null;

    rows.push({
      id,
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
    });
  }

  rows.sort(compareCompanyExhibitorRows);
  return rows;
}

/** All live exhibitor links for one company. Pages past the 1,000-row default. */
export async function listExhibitorsForCompanyAdmin(
  companyId: string,
): Promise<CompanyExhibitorRow[]> {
  const supabase = createAdminClient();
  const rawRows = await fetchAllPaginatedSupabaseRows<Record<string, unknown>>(
    async ({ from, to }) =>
      supabase
        .from("event_exhibitors")
        .select(EXHIBITOR_SELECT)
        .eq("company_id", companyId)
        .range(from, to),
  );

  return mapExhibitorAdminRows(companyId, rawRows);
}
