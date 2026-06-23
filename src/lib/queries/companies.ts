import { createClient } from "@/src/lib/supabase/server";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { CITY_PUBLIC_EMBED } from "@/src/lib/location/cityEmbedSelect";

/** Stable map key for UUID `company_id` / `companies.id` comparisons (Postgres may emit mixed cases). */
function companyIdKey(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  return String(raw).trim().toLowerCase();
}

function isUuidString(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

function normalizeEditionIdForQuery(raw: string): string {
  const trimmed = raw.trim();
  return isUuidString(trimmed) ? trimmed.toLowerCase() : trimmed;
}

/** Explicit public company columns (includes logo metadata for Logo.dev resolver). */
export const COMPANY_PUBLIC_COLUMNS = `
  id,
  name,
  slug,
  domain,
  website,
  logo_url,
  logo_source,
  logo_status,
  logo_fetched_at,
  logo_fetch_error,
  short_description,
  description,
  city_id,
  created_at
`;

/** Public company profile fields + city/country for detail pages. */
export const COMPANY_PUBLIC_SELECT = `
  ${COMPANY_PUBLIC_COLUMNS},
  cities (
    *,
    ${CITY_PUBLIC_EMBED}
  )
`;

export type CompanyPublicRow = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  website: string | null;
  logo_url: string | null;
  logo_source: string | null;
  logo_status: string | null;
  logo_fetched_at: string | null;
  logo_fetch_error: string | null;
  short_description: string | null;
  description: string | null;
  city_id: string | null;
  created_at: string | null;
  cities?: unknown;
  industry?: string | null;
};

async function getCompanyByIdAdmin(id: string) {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("companies")
      .select(COMPANY_PUBLIC_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) return null;
    return data as CompanyPublicRow;
  } catch {
    return null;
  }
}

export async function getCompanyById(id: string): Promise<CompanyPublicRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select(COMPANY_PUBLIC_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (data) {
    return data as CompanyPublicRow;
  }

  return getCompanyByIdAdmin(id);
}

async function getCompanyBySlugAdmin(slug: string): Promise<CompanyPublicRow | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("companies")
      .select(COMPANY_PUBLIC_SELECT)
      .eq("slug", slug)
      .maybeSingle();
    if (error) return null;
    return data as CompanyPublicRow;
  } catch {
    return null;
  }
}

export async function getCompanyBySlug(slug: string): Promise<CompanyPublicRow | null> {
  const key = slug.trim();
  if (!key) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select(COMPANY_PUBLIC_SELECT)
    .eq("slug", key)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (data) {
    return data as CompanyPublicRow;
  }

  return getCompanyBySlugAdmin(key);
}

export async function getCompaniesByIds(ids: readonly string[]) {
  const unique = [...new Set(ids.filter((id) => id.trim() !== ""))];
  if (unique.length === 0) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select(COMPANY_PUBLIC_SELECT)
    .in("id", unique);

  if (error) throw new Error(error.message);
  return (data ?? []) as CompanyPublicRow[];
}

async function getCompaniesByIdsAdmin(ids: readonly string[]) {
  const unique = [...new Set(ids.map((id) => id.trim()).filter((id) => id !== ""))];
  if (unique.length === 0) return [];

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("companies")
      .select(COMPANY_PUBLIC_SELECT)
      .in("id", unique);
    if (error) {
      return [];
    }
    return (data ?? []) as CompanyPublicRow[];
  } catch {
    return [];
  }
}

/**
 * Hydrate `event_sponsors` rows with authoritative `companies` rows keyed by `company_id`.
 */
export async function mergeCompaniesOntoEventSponsorLinks<L extends { company_id?: unknown }>(
  links: readonly L[],
): Promise<Array<L & { companies: CompanyPublicRow | null }>> {
  const ids: string[] = [];
  for (const link of links) {
    if (link.company_id === null || link.company_id === undefined) continue;
    const trimmed = String(link.company_id).trim();
    if (trimmed !== "") ids.push(trimmed);
  }

  const rows = await getCompaniesByIds(ids);
  const byId = new Map<string, CompanyPublicRow>(rows.map((r) => [companyIdKey(r.id), r]));

  const missingCompanyIds = [...new Set(ids.map((id) => companyIdKey(id)))].filter(
    (key) => key !== "" && !byId.has(key),
  );

  if (missingCompanyIds.length > 0) {
    const adminRows = await getCompaniesByIdsAdmin(missingCompanyIds);
    for (const row of adminRows) {
      byId.set(companyIdKey(row.id), row as CompanyPublicRow);
    }
  }

  return links.map((link) => {
    if (link.company_id === null || link.company_id === undefined) {
      return { ...link, companies: null };
    }
    const key = companyIdKey(link.company_id);
    const company = key !== "" ? byId.get(key) ?? null : null;
    return { ...link, companies: company };
  });
}

/**
 * Total count of all sponsor links for an edition across all tiers.
 * Uses the admin client so the result is auth-independent — safe to call from
 * server components only. Returns a number (0 when the edition has no sponsors
 * or does not exist). Never exposes company names, tiers, or any other detail.
 */
export async function getTotalSponsorCount(eventEditionId: string): Promise<number> {
  const editionKey = normalizeEditionIdForQuery(eventEditionId);
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("event_sponsors")
    .select("id", { count: "exact", head: true })
    .eq("event_editions_id", editionKey);

  if (error) return 0;
  return count ?? 0;
}

/**
 * Sponsor links for an edition in canonical order:
 * `tier_rank ASC NULLS LAST, display_order ASC NULLS LAST, id ASC`.
 * Company fields always come from `companies` (batch by `company_id`), not from embeds.
 */
export async function getCompaniesByEventEdition(eventEditionId: string) {
  const supabase = await createClient();
  const editionKey = normalizeEditionIdForQuery(eventEditionId);
  const { data: links, error } = await supabase
    .from("event_sponsors")
    .select("id, company_id, tier_rank, tier_label, display_order, event_editions_id")
    .eq("event_editions_id", editionKey)
    .order("tier_rank", { ascending: true, nullsFirst: false })
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true });

  if (error) throw new Error(error.message);
  const list = links ?? [];

  if (list.length === 0) {
    return [];
  }

  return mergeCompaniesOntoEventSponsorLinks(list);
}
