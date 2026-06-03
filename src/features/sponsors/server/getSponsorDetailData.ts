import { getCompanyById, getCompanyBySlug } from "@/src/lib/queries/companies";
import { getSponsorLinksWithEditionsForCompany } from "@/src/lib/queries/sponsors";

import type {
  SponsorDetailData,
  SponsorDetailEvent,
  SponsorDetailSeries,
  SponsorDetailSeriesGroup,
} from "./types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractEdition(row: unknown): SponsorDetailEvent | null {
  if (row === null || typeof row !== "object") return null;
  const link = row as {
    event_editions?: SponsorDetailEvent | SponsorDetailEvent[] | null;
  };
  const raw = link.event_editions;
  if (raw === null || raw === undefined) return null;
  if (Array.isArray(raw)) {
    const first = raw[0];
    return first ?? null;
  }
  return raw;
}

/**
 * Pull `event_series.id` / `event_series.name` off the embedded relation.
 * Mirrors `extractEdition`: tolerates both single-object and array-shaped joins.
 * Editions with no usable series are excluded from grouping by the caller.
 */
function extractSeries(edition: SponsorDetailEvent): SponsorDetailSeries | null {
  const ref = edition as {
    event_series?:
      | { id?: unknown; name?: unknown }
      | Array<{ id?: unknown; name?: unknown }>
      | null;
  };
  const raw = ref.event_series;
  if (raw === null || raw === undefined) return null;

  const candidate = Array.isArray(raw) ? raw[0] : raw;
  if (!candidate) return null;

  const { id, name } = candidate;
  if (typeof id !== "string" || id.trim() === "") return null;
  if (typeof name !== "string" || name.trim() === "") return null;

  return { id: id.trim(), name: name.trim() };
}

function editionStartDate(edition: SponsorDetailEvent): string {
  const raw = (edition as { start_date?: unknown }).start_date;
  return typeof raw === "string" ? raw : "";
}

function editionYear(edition: SponsorDetailEvent): number {
  const raw = (edition as { year?: unknown }).year;
  return typeof raw === "number" && Number.isFinite(raw)
    ? raw
    : Number.NEGATIVE_INFINITY;
}

function groupEditionsBySeries(
  editions: readonly SponsorDetailEvent[],
): SponsorDetailSeriesGroup[] {
  const groups = new Map<string, SponsorDetailSeriesGroup>();

  for (const edition of editions) {
    const series = extractSeries(edition);
    if (!series) continue;

    const existing = groups.get(series.id);
    if (existing) {
      existing.editions.push(edition);
    } else {
      groups.set(series.id, { series, editions: [edition] });
    }
  }

  for (const group of groups.values()) {
    group.editions.sort((a, b) => {
      const da = editionStartDate(a);
      const db = editionStartDate(b);
      if (da !== db) return db.localeCompare(da);
      return editionYear(b) - editionYear(a);
    });
  }

  return [...groups.values()].sort((a, b) =>
    a.series.name.localeCompare(b.series.name),
  );
}

export async function getSponsorDetailData(
  identifier: string,
): Promise<SponsorDetailData | null> {
  const key = identifier.trim();
  if (!key) return null;

  let company = await getCompanyBySlug(key);

  if (!company && UUID_REGEX.test(key)) {
    company = await getCompanyById(key);
  }

  if (!company) {
    return null;
  }

  const links = await getSponsorLinksWithEditionsForCompany(company.id);
  const byEditionId = new Map<string, SponsorDetailEvent>();

  for (const row of links ?? []) {
    const edition = extractEdition(row);
    if (!edition) continue;
    const id = typeof edition.id === "string" ? edition.id : String(edition.id);
    if (!byEditionId.has(id)) {
      byEditionId.set(id, edition);
    }
  }

  const eventSeriesGroups = groupEditionsBySeries([...byEditionId.values()]);

  return { company, eventSeriesGroups };
}
