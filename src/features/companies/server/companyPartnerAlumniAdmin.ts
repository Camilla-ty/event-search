import { fetchAllPaginatedSupabaseRows } from "@/src/lib/supabase/fetchAllPaginatedRows";
import { createAdminClient } from "@/src/lib/supabase/admin";

import { compareCompanyExhibitorRows, eventSeriesAdminHref } from "./companyExhibitorAdmin";
import type { CompanyExhibitorEdition } from "./companyExhibitorAdmin";

export { eventSeriesAdminHref };

export type CompanyPartnerAlumniEdition = CompanyExhibitorEdition;

export type CompanyPartnerAlumniRow = {
  programId: string;
  series: { id: string; name: string } | null;
  editions: CompanyPartnerAlumniEdition[];
};

type Membership = {
  company_id: string;
  event_partner_alumni_version_id: string;
};

type Program = {
  id: string;
  event_series_id: string | null;
  current_version_id: string | null;
};

type SeriesName = {
  id: string;
  name: string;
};

type EditionRecord = CompanyPartnerAlumniEdition & {
  series_id: string | null;
};

function textId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Current Partner Alumni rosters for one company.
 * Older versions are ignored. A series with no editions contributes no edition row.
 */
export function buildPartnerAlumniRows(input: {
  companyId: string;
  members: readonly Membership[];
  programs: readonly Program[];
  series: readonly SeriesName[];
  editions: readonly EditionRecord[];
}): CompanyPartnerAlumniRow[] {
  const requestedId = input.companyId.trim();
  const currentVersionIds = new Set(
    input.members
      .filter((member) => member.company_id.trim() === requestedId)
      .map((member) => member.event_partner_alumni_version_id.trim())
      .filter((versionId) => versionId !== ""),
  );
  if (currentVersionIds.size === 0) return [];

  const seriesById = new Map(input.series.map((row) => [row.id, row]));
  const editionsBySeries = new Map<string, CompanyPartnerAlumniEdition[]>();
  for (const edition of input.editions) {
    const seriesId = edition.series_id?.trim() ?? "";
    if (seriesId === "") continue;
    const list = editionsBySeries.get(seriesId) ?? [];
    list.push({
      id: edition.id,
      name: edition.name,
      year: edition.year,
      slug: edition.slug,
    });
    editionsBySeries.set(seriesId, list);
  }

  const rows: CompanyPartnerAlumniRow[] = [];
  const seenPrograms = new Set<string>();
  for (const program of input.programs) {
    const versionId = program.current_version_id?.trim() ?? "";
    if (versionId === "" || !currentVersionIds.has(versionId)) continue;
    if (seenPrograms.has(program.id)) continue;
    seenPrograms.add(program.id);

    const seriesId = program.event_series_id?.trim() ?? "";
    const series = seriesId === "" ? null : (seriesById.get(seriesId) ?? null);
    const editions = [...(seriesId === "" ? [] : (editionsBySeries.get(seriesId) ?? []))];
    editions.sort((a, b) =>
      compareCompanyExhibitorRows(
        { id: a.id, tier_rank: null, tier_label: null, edition: a, series: null },
        { id: b.id, tier_rank: null, tier_label: null, edition: b, series: null },
      ),
    );

    rows.push({ programId: program.id, series, editions });
  }

  rows.sort((a, b) => {
    const nameA = a.series?.name ?? "";
    const nameB = b.series?.name ?? "";
    const byName = nameA.localeCompare(nameB);
    if (byName !== 0) return byName;
    return a.programId.localeCompare(b.programId);
  });
  return rows;
}

async function fetchByIds<TRow extends Record<string, unknown>>(
  table: "event_partner_alumni" | "event_series" | "event_editions",
  column: string,
  ids: readonly string[],
  select: string,
): Promise<TRow[]> {
  if (ids.length === 0) return [];
  const supabase = createAdminClient();
  const uniqueIds = [...new Set(ids)];
  const rows: TRow[] = [];
  const chunkSize = 100;
  for (let index = 0; index < uniqueIds.length; index += chunkSize) {
    const chunk = uniqueIds.slice(index, index + chunkSize);
    const page = await fetchAllPaginatedSupabaseRows<TRow>(async ({ from, to }) => {
      const result = await supabase.from(table).select(select).in(column, chunk).range(from, to);
      return {
        data: (result.data ?? null) as TRow[] | null,
        error: result.error ? { message: result.error.message } : null,
      };
    });
    rows.push(...page);
  }
  return rows;
}

/** Current Partner Alumni series for one company, with that series' editions. */
export async function listPartnerAlumniForCompanyAdmin(
  companyId: string,
): Promise<CompanyPartnerAlumniRow[]> {
  const supabase = createAdminClient();
  const memberRows = await fetchAllPaginatedSupabaseRows<{
    company_id: unknown;
    event_partner_alumni_version_id: unknown;
  }>(async ({ from, to }) =>
    supabase
      .from("event_partner_alumni_version_companies")
      .select("company_id, event_partner_alumni_version_id")
      .eq("company_id", companyId)
      .range(from, to),
  );

  const members: Membership[] = [];
  for (const row of memberRows) {
    const memberCompanyId = textId(row.company_id);
    const versionId = textId(row.event_partner_alumni_version_id);
    if (!memberCompanyId || !versionId) continue;
    members.push({
      company_id: memberCompanyId,
      event_partner_alumni_version_id: versionId,
    });
  }
  const versionIds = [
    ...new Set(
      members
        .filter((member) => member.company_id === companyId.trim())
        .map((member) => member.event_partner_alumni_version_id),
    ),
  ];
  if (versionIds.length === 0) return [];

  const programRows = await fetchByIds<{
    id: unknown;
    event_series_id: unknown;
    current_version_id: unknown;
  }>(
    "event_partner_alumni",
    "current_version_id",
    versionIds,
    "id, event_series_id, current_version_id",
  );
  const programs: Program[] = programRows.flatMap((row) => {
    const id = textId(row.id);
    if (!id) return [];
    return [
      {
        id,
        event_series_id: textId(row.event_series_id),
        current_version_id: textId(row.current_version_id),
      },
    ];
  });
  const seriesIds = programs.flatMap((program) =>
    program.event_series_id ? [program.event_series_id] : [],
  );

  const [seriesRows, editionRows] = await Promise.all([
    fetchByIds<{ id: unknown; name: unknown }>("event_series", "id", seriesIds, "id, name"),
    fetchByIds<{
      id: unknown;
      name: unknown;
      year: unknown;
      slug: unknown;
      series_id: unknown;
    }>("event_editions", "series_id", seriesIds, "id, name, year, slug, series_id"),
  ]);

  return buildPartnerAlumniRows({
    companyId,
    members,
    programs,
    series: seriesRows.flatMap((row) => {
      const id = textId(row.id);
      if (!id) return [];
      return [{ id, name: typeof row.name === "string" ? row.name : "—" }];
    }),
    editions: editionRows.flatMap((row) => {
      const id = textId(row.id);
      if (!id) return [];
      return [
        {
          id,
          name: typeof row.name === "string" ? row.name : "—",
          year: typeof row.year === "number" ? row.year : null,
          slug: typeof row.slug === "string" ? row.slug : null,
          series_id: textId(row.series_id),
        },
      ];
    }),
  });
}
