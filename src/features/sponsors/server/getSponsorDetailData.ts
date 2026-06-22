import { getCompanyById, getCompanyBySlug } from "@/src/lib/queries/companies";
import {
  getCompanySponsorStats,
  getSponsorLinksWithEditionsForCompany,
} from "@/src/lib/queries/sponsors";

import type {
  SponsorDetailData,
  SponsorDetailEditionEntry,
  SponsorDetailEvent,
  SponsorDetailSeries,
  SponsorDetailSeriesGroup,
  SponsorDetailSummary,
} from "./types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type GetSponsorDetailDataOptions = {
  isAuthenticated?: boolean;
};

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

function extractEditionEntry(row: unknown): SponsorDetailEditionEntry | null {
  if (row === null || typeof row !== "object") return null;
  const edition = extractEdition(row);
  if (!edition) return null;

  const link = row as { tier_rank?: unknown; tier_label?: unknown };
  const tierRank =
    typeof link.tier_rank === "number" && Number.isFinite(link.tier_rank)
      ? link.tier_rank
      : null;
  const tierLabelRaw = link.tier_label;
  const tierLabel =
    typeof tierLabelRaw === "string" && tierLabelRaw.trim() !== ""
      ? tierLabelRaw.trim()
      : null;

  return { edition, tierRank, tierLabel };
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
  entries: readonly SponsorDetailEditionEntry[],
): SponsorDetailSeriesGroup[] {
  const groups = new Map<string, SponsorDetailSeriesGroup>();

  for (const entry of entries) {
    const series = extractSeries(entry.edition);
    if (!series) continue;

    const existing = groups.get(series.id);
    if (existing) {
      existing.editions.push(entry);
    } else {
      groups.set(series.id, { series, editions: [entry] });
    }
  }

  for (const group of groups.values()) {
    group.editions.sort((a, b) => {
      const da = editionStartDate(a.edition);
      const db = editionStartDate(b.edition);
      if (da !== db) return db.localeCompare(da);
      return editionYear(b.edition) - editionYear(a.edition);
    });
  }

  return [...groups.values()].sort((a, b) =>
    a.series.name.localeCompare(b.series.name),
  );
}

function buildSummary(
  stats: Awaited<ReturnType<typeof getCompanySponsorStats>>,
  isAuthenticated: boolean,
): SponsorDetailSummary {
  const sponsoredEditionCount = stats?.sponsored_edition_count ?? 0;

  if (!isAuthenticated) {
    return { sponsoredEditionCount };
  }

  return {
    sponsoredEditionCount,
    latestActivityAt: stats?.latest_activity_at ?? null,
  };
}

export async function getSponsorDetailData(
  identifier: string,
  options?: GetSponsorDetailDataOptions,
): Promise<SponsorDetailData | null> {
  const key = identifier.trim();
  if (!key) return null;

  const isAuthenticated = options?.isAuthenticated ?? false;

  let company = await getCompanyBySlug(key);

  if (!company && UUID_REGEX.test(key)) {
    company = await getCompanyById(key);
  }

  if (!company) {
    return null;
  }

  const stats = await getCompanySponsorStats(company.id);
  const summary = buildSummary(stats, isAuthenticated);

  if (!isAuthenticated) {
    return {
      company,
      isAuthenticated: false,
      summary,
      eventSeriesGroups: [],
    };
  }

  const links = await getSponsorLinksWithEditionsForCompany(company.id);
  const byEditionId = new Map<string, SponsorDetailEditionEntry>();

  for (const row of links ?? []) {
    const entry = extractEditionEntry(row);
    if (!entry) continue;
    const id =
      typeof entry.edition.id === "string"
        ? entry.edition.id
        : String(entry.edition.id);
    if (!byEditionId.has(id)) {
      byEditionId.set(id, entry);
    }
  }

  const eventSeriesGroups = groupEditionsBySeries([...byEditionId.values()]);

  return {
    company,
    isAuthenticated: true,
    summary,
    eventSeriesGroups,
  };
}
