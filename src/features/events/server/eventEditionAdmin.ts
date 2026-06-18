import type { LiveSponsorRow } from "@/src/features/events/components/admin/liveSponsorTypes";
import { parseCompanyAliasesFromRow } from "@/src/lib/companies/companyAliases";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { CITY_ADMIN_SELECT } from "@/src/lib/location/cityEmbedSelect";
import { EVENT_EDITION_LIST_SELECT } from "@/src/lib/queries/events";

export type EventEditionAdminRow = {
  id: string;
  series_id: string | null;
  year: number;
  name: string;
  slug: string;
  start_date: string | null;
  end_date: string | null;
  website_url: string | null;
  city_id: string | null;
  created_at: string | null;
  event_series?: {
    id: string;
    name: string;
    slug: string;
    logo_url?: string | null;
  } | null;
  cities?: { id: string; name: string } | null;
};

export type CreateEventEditionAdminInput = {
  series_id: string;
  year: number;
  name: string;
  slug: string;
  start_date?: string | null;
  end_date?: string | null;
  website_url?: string | null;
  city_id?: string | null;
};

export type UpdateEventEditionAdminInput = {
  name?: string;
  slug?: string;
  start_date?: string | null;
  end_date?: string | null;
  website_url?: string | null;
  city_id?: string | null;
};

export type EventEditionListFilters = {
  seriesId?: string;
  year?: number;
  missingWebsite?: boolean;
  missingDates?: boolean;
  missingCity?: boolean;
  search?: string;
};

export type EventEditionListItem = EventEditionAdminRow & {
  live_sponsor_count: number;
};

export async function listEventEditionsAdmin(
  filters: EventEditionListFilters = {},
): Promise<EventEditionListItem[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("event_editions")
    .select(EVENT_EDITION_LIST_SELECT)
    .order("year", { ascending: false })
    .order("name", { ascending: true });

  if (filters.seriesId) {
    query = query.eq("series_id", filters.seriesId);
  }
  if (filters.year !== undefined) {
    query = query.eq("year", filters.year);
  }
  if (filters.missingWebsite) {
    query = query.is("website_url", null);
  }
  if (filters.missingCity) {
    query = query.is("city_id", null);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let rows = (data ?? []) as EventEditionAdminRow[];

  if (filters.missingDates) {
    rows = rows.filter((row) => row.start_date === null && row.end_date === null);
  }

  const term = filters.search?.trim().toLowerCase() ?? "";
  if (term !== "") {
    rows = rows.filter((row) => {
      const seriesName = row.event_series?.name?.toLowerCase() ?? "";
      return (
        row.name.toLowerCase().includes(term) ||
        row.slug.toLowerCase().includes(term) ||
        seriesName.includes(term) ||
        String(row.year).includes(term)
      );
    });
  }

  if (rows.length === 0) return [];

  const editionIds = rows.map((r) => r.id);
  const { data: sponsorLinks, error: sponsorError } = await supabase
    .from("event_sponsors")
    .select("event_editions_id")
    .in("event_editions_id", editionIds);

  if (sponsorError) throw new Error(sponsorError.message);

  const countByEdition = new Map<string, number>();
  for (const link of sponsorLinks ?? []) {
    const eid = link.event_editions_id;
    if (typeof eid === "string") {
      countByEdition.set(eid, (countByEdition.get(eid) ?? 0) + 1);
    }
  }

  return rows.map((row) => ({
    ...row,
    live_sponsor_count: countByEdition.get(row.id) ?? 0,
  }));
}

export async function getEventEditionAdminById(
  id: string,
): Promise<EventEditionAdminRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("event_editions")
    .select(EVENT_EDITION_LIST_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as EventEditionAdminRow | null;
}

export async function countLiveSponsorsForEdition(editionId: string): Promise<number> {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("event_sponsors")
    .select("id", { count: "exact", head: true })
    .eq("event_editions_id", editionId);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

function companyIdKey(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  return String(raw).trim().toLowerCase();
}

/** Live sponsor roster for admin QA — includes company aliases (not used on public pages). */
export async function getLiveSponsorsForEditionAdmin(
  eventEditionId: string,
): Promise<LiveSponsorRow[]> {
  const supabase = createAdminClient();
  const editionKey = eventEditionId.trim();

  const { data: links, error } = await supabase
    .from("event_sponsors")
    .select("id, company_id, tier_rank, tier_label, display_order")
    .eq("event_editions_id", editionKey)
    .order("tier_rank", { ascending: true, nullsFirst: false })
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true });

  if (error) throw new Error(error.message);
  if (!links || links.length === 0) {
    return [];
  }

  const companyIds = [
    ...new Set(
      links
        .map((link) => companyIdKey(link.company_id))
        .filter((id) => id !== ""),
    ),
  ];

  const companyById = new Map<
    string,
    {
      id: string;
      name: string | null;
      slug: string | null;
      domain: string | null;
      logo_url: string | null;
      logo_source: string | null;
      logo_status: string | null;
      logo_fetched_at: string | null;
      aliases: string[];
    }
  >();

  if (companyIds.length > 0) {
    const { data: companies, error: companyError } = await supabase
      .from("companies")
      .select(
        "id, name, slug, domain, logo_url, logo_source, logo_status, logo_fetched_at, aliases",
      )
      .in("id", companyIds);

    if (companyError) throw new Error(companyError.message);

    for (const row of companies ?? []) {
      companyById.set(companyIdKey(row.id), {
        id: String(row.id),
        name: typeof row.name === "string" ? row.name : null,
        slug: typeof row.slug === "string" ? row.slug : null,
        domain: typeof row.domain === "string" ? row.domain : null,
        logo_url: typeof row.logo_url === "string" ? row.logo_url : null,
        logo_source: typeof row.logo_source === "string" ? row.logo_source : null,
        logo_status: typeof row.logo_status === "string" ? row.logo_status : null,
        logo_fetched_at:
          typeof row.logo_fetched_at === "string" ? row.logo_fetched_at : null,
        aliases: parseCompanyAliasesFromRow(row.aliases),
      });
    }
  }

  return links.map((link) => {
    const company = companyById.get(companyIdKey(link.company_id)) ?? null;
    return {
      id: String(link.id),
      tier_rank: typeof link.tier_rank === "number" ? link.tier_rank : null,
      tier_label: typeof link.tier_label === "string" ? link.tier_label : null,
      display_order: typeof link.display_order === "number" ? link.display_order : null,
      companies: company,
    };
  });
}

export type EditionSiblingSummary = {
  id: string;
  series_id: string | null;
  year: number;
  name: string;
  slug: string;
  city_id: string | null;
  cities?: Record<string, unknown> | null;
};

/** Other editions for the same series and year (multi-city / multi-occurrence allowed). */
export async function findSiblingEditions(params: {
  seriesId: string;
  year: number;
  excludeId?: string;
}): Promise<EditionSiblingSummary[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("event_editions")
    .select(`id, series_id, year, name, slug, city_id, cities ( ${CITY_ADMIN_SELECT} )`)
    .eq("series_id", params.seriesId)
    .eq("year", params.year)
    .order("name", { ascending: true });

  if (params.excludeId) {
    query = query.neq("id", params.excludeId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    series_id: typeof row.series_id === "string" ? row.series_id : null,
    year: typeof row.year === "number" ? row.year : Number(row.year),
    name: typeof row.name === "string" ? row.name : "",
    slug: typeof row.slug === "string" ? row.slug : "",
    city_id: typeof row.city_id === "string" ? row.city_id : null,
    cities:
      row.cities && typeof row.cities === "object"
        ? (row.cities as Record<string, unknown>)
        : null,
  }));
}
