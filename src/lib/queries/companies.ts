import { createClient } from "@/src/lib/supabase/server";
import { fetchAllByIdInBatches } from "@/src/lib/supabase/fetchInBatches";
import { CITY_PUBLIC_EMBED } from "@/src/lib/location/cityEmbedSelect";
import { mapPublicLogoUrl } from "@/src/lib/storage/mapPublicLogoUrl";
import { isCompanyRestricted } from "@/src/lib/companies/companyPublicRestriction";
import {
  withPublicCompanyRoleHref,
  type EventBrandPublicDestinationIndex,
} from "@/src/lib/companies/eventBrandPublicDestinationIndex";
import { getEventBrandPublicDestinationIndex } from "@/src/lib/companies/eventBrandPublicDestinationIndex.server";

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
  city_id,
  created_at,
  restricted_at,
  event_brand_public_profile_approved_at
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
  city_id: string | null;
  created_at: string | null;
  restricted_at?: string | null;
  event_brand_public_profile_approved_at?: string | null;
  cities?: unknown;
  industry?: string | null;
};

function isPublicCompanyProfileRow(row: CompanyPublicRow | null): row is CompanyPublicRow {
  return row !== null && !isCompanyRestricted(row);
}

/** Map bucket-relative logo_url values to display-ready public URLs for UI surfaces. */
export function mapCompanyPublicRowForDisplay(row: CompanyPublicRow): CompanyPublicRow {
  return {
    ...row,
    logo_url: mapPublicLogoUrl(row.logo_url),
  };
}

function mapCompanyPublicRowsForDisplay(rows: CompanyPublicRow[]): CompanyPublicRow[] {
  return rows.map(mapCompanyPublicRowForDisplay);
}

/**
 * Fail-closed mapping for public company profile queries (ARC-001 Phase 1).
 * Error or empty → null; restricted rows → null; never implies a service-role retry.
 */
export function resolvePublicCompanyProfileQueryResult(
  data: CompanyPublicRow | null | undefined,
  error: { message?: string } | null | undefined,
): CompanyPublicRow | null {
  if (error || !data) {
    return null;
  }
  return isPublicCompanyProfileRow(data) ? mapCompanyPublicRowForDisplay(data) : null;
}

/**
 * Attach batch-loaded companies onto sponsor links. Missing ids stay null (no admin fill).
 */
export function attachCompaniesToEventSponsorLinks<L extends { company_id?: unknown }>(
  links: readonly L[],
  companies: readonly CompanyPublicRow[],
  destinationIndex: EventBrandPublicDestinationIndex,
): Array<L & { companies: CompanyPublicRow | null }> {
  const byId = new Map<string, CompanyPublicRow>(
    companies.map((row) => [companyIdKey(row.id), row]),
  );

  return links.map((link) => {
    if (link.company_id === null || link.company_id === undefined) {
      return { ...link, companies: null };
    }
    const key = companyIdKey(link.company_id);
    const company = key !== "" ? byId.get(key) ?? null : null;
    return {
      ...link,
      companies: company
        ? withPublicCompanyRoleHref(company, destinationIndex)
        : null,
    };
  });
}

/**
 * Public company profile by id (ARC-001 Phase 1).
 * Uses the RLS-bound session client only — fail closed on error/empty (no service-role fallback).
 */
export async function getCompanyById(id: string): Promise<CompanyPublicRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select(COMPANY_PUBLIC_SELECT)
    .eq("id", id)
    .is("restricted_at", null)
    .maybeSingle();

  return resolvePublicCompanyProfileQueryResult(data as CompanyPublicRow | null, error);
}

/**
 * Public company profile by slug (ARC-001 Phase 1).
 * Uses the RLS-bound session client only — fail closed on error/empty (no service-role fallback).
 */
export async function getCompanyBySlug(slug: string): Promise<CompanyPublicRow | null> {
  const key = slug.trim();
  if (!key) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select(COMPANY_PUBLIC_SELECT)
    .eq("slug", key)
    .is("restricted_at", null)
    .maybeSingle();

  return resolvePublicCompanyProfileQueryResult(data as CompanyPublicRow | null, error);
}

/** Batch-load companies via the RLS-bound session client. Fail closed to [] on error. */
export async function getCompaniesByIds(ids: readonly string[]) {
  const unique = [...new Set(ids.filter((id) => id.trim() !== ""))];
  if (unique.length === 0) {
    return [];
  }

  try {
    const supabase = await createClient();
    const rows = await fetchAllByIdInBatches(unique, (batchIds) =>
      supabase.from("companies").select(COMPANY_PUBLIC_SELECT).in("id", batchIds),
    );

    return mapCompanyPublicRowsForDisplay(rows as CompanyPublicRow[]);
  } catch {
    return [];
  }
}

/**
 * Hydrate `event_sponsors` rows with authoritative `companies` rows keyed by `company_id`.
 * ARC-001 Phase 1: session/RLS client only — missing companies stay null (no admin fill).
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
  const destinationIndex = await getEventBrandPublicDestinationIndex();
  return attachCompaniesToEventSponsorLinks(links, rows, destinationIndex);
}

/**
 * Total count of all sponsor links for an edition across all tiers.
 * Reads the public aggregate view (all tiers, identity-free) via the session
 * client — auth-independent totals without service_role. Returns 0 when the
 * edition has no sponsors or does not exist.
 */
export async function getTotalSponsorCount(eventEditionId: string): Promise<number> {
  const editionKey = normalizeEditionIdForQuery(eventEditionId);
  const counts = await getSponsorCountsByEditionIds([editionKey]);
  return counts.get(editionKey) ?? 0;
}

/** Aggregate sponsor link rows into per-edition totals (normalized edition id keys). */
export function buildSponsorCountByEditionId(
  links: readonly { event_editions_id?: unknown }[],
): Map<string, number> {
  const countByEdition = new Map<string, number>();

  for (const link of links) {
    const editionId = link.event_editions_id;
    if (typeof editionId !== "string") continue;

    const editionKey = normalizeEditionIdForQuery(editionId);
    if (editionKey === "") continue;

    countByEdition.set(editionKey, (countByEdition.get(editionKey) ?? 0) + 1);
  }

  return countByEdition;
}

/** Map identity-free aggregate view rows into per-edition totals. */
export function buildSponsorCountByEditionIdFromStats(
  rows: readonly {
    event_editions_id?: unknown;
    sponsor_count?: unknown;
  }[],
): Map<string, number> {
  const countByEdition = new Map<string, number>();

  for (const row of rows) {
    if (typeof row.event_editions_id !== "string") continue;
    const editionKey = normalizeEditionIdForQuery(row.event_editions_id);
    if (editionKey === "") continue;

    const raw = row.sponsor_count;
    const count =
      typeof raw === "number" && Number.isFinite(raw)
        ? Math.max(0, Math.trunc(raw))
        : 0;
    countByEdition.set(editionKey, count);
  }

  return countByEdition;
}

/**
 * Total sponsor counts for many editions (all tiers, identity-free).
 * Uses `event_edition_sponsor_counts` via the RLS-bound session client
 * (view is security_invoker=false). Returns 0 for editions with no links.
 */
export async function getSponsorCountsByEditionIds(
  editionIds: readonly string[],
): Promise<Map<string, number>> {
  const uniqueEditionIds = [
    ...new Set(
      editionIds
        .map((editionId) => normalizeEditionIdForQuery(editionId))
        .filter((editionId) => editionId !== ""),
    ),
  ];

  if (uniqueEditionIds.length === 0) {
    return new Map();
  }

  try {
    const supabase = await createClient();
    const rows = await fetchAllByIdInBatches<{
      event_editions_id?: unknown;
      sponsor_count?: unknown;
    }>(uniqueEditionIds, (batchIds) =>
      supabase
        .from("event_edition_sponsor_counts")
        .select("event_editions_id, sponsor_count")
        .in("event_editions_id", batchIds),
    );

    return buildSponsorCountByEditionIdFromStats(rows);
  } catch {
    return new Map();
  }
}

export function readSponsorCountForEdition(
  counts: ReadonlyMap<string, number>,
  editionId: string,
): number {
  return counts.get(normalizeEditionIdForQuery(editionId)) ?? 0;
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

  if (error) {
    return [];
  }
  const list = links ?? [];

  if (list.length === 0) {
    return [];
  }

  return mergeCompaniesOntoEventSponsorLinks(list);
}
