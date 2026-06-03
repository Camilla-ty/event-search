import { createClient } from "@/src/lib/supabase/server";
import { createAdminClient } from "@/src/lib/supabase/admin";

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

/** Public company profile fields + city/country for detail pages. */
export const COMPANY_PUBLIC_SELECT = `
  *,
  cities (
    *,
    countries (*)
  )
`;

async function getCompanyByIdAdmin(id: string) {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("companies")
      .select(COMPANY_PUBLIC_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

export async function getCompanyById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select(COMPANY_PUBLIC_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (data) {
    return data;
  }

  return getCompanyByIdAdmin(id);
}

async function getCompanyBySlugAdmin(slug: string) {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("companies")
      .select(COMPANY_PUBLIC_SELECT)
      .eq("slug", slug)
      .maybeSingle();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

export async function getCompanyBySlug(slug: string) {
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
    return data;
  }

  return getCompanyBySlugAdmin(key);
}

export type CompanyPublicRow = NonNullable<Awaited<ReturnType<typeof getCompanyById>>>;

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
  return data ?? [];
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
    return data ?? [];
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
 * Sponsor links for an edition, ordered by `event_sponsors.tier_rank`.
 * Company fields always come from `companies` (batch by `company_id`), not from embeds.
 */
export async function getCompaniesByEventEdition(eventEditionId: string) {
  const supabase = await createClient();
  const editionKey = normalizeEditionIdForQuery(eventEditionId);
  const { data: links, error } = await supabase
    .from("event_sponsors")
    .select("id, company_id, tier_rank, event_editions_id")
    .eq("event_editions_id", editionKey)
    .order("tier_rank", { ascending: true });

  if (error) throw new Error(error.message);
  const list = links ?? [];

  if (list.length === 0) {
    return [];
  }

  return mergeCompaniesOntoEventSponsorLinks(list);
}
