import {
  PUBLIC_SPONSOR_SEARCH_MAX_RESULTS,
  parsePublicSponsorSearchQuery,
} from "@/src/features/events/server/publicSponsorSearchParams";
import { resolvePublicSponsorEditionId } from "@/src/features/events/server/publicSponsorRoster";
import {
  isCompanyRestricted,
  RESTRICTED_COMPANY_ROSTER_LABEL,
} from "@/src/lib/companies/companyPublicRestriction";
import { buildSponsorProfilePath } from "@/src/lib/routes/explorerUrls";
import { createClient } from "@/src/lib/supabase/server";

export type PublicSponsorSearchCompanyPublic = {
  id: string;
  name: string;
  restricted: boolean;
  restricted_label: string | null;
  slug: string | null;
  domain: string | null;
  website: string | null;
  logo_url: string | null;
  logo_source: string | null;
  logo_status: string | null;
  href: string | null;
};

export type PublicSponsorSearchItem = {
  id: string;
  company_id: string;
  tier_rank: number | null;
  tier_label: string | null;
  display_order: number | null;
  company: PublicSponsorSearchCompanyPublic;
};

export type PublicSponsorSearchResult = {
  ok: true;
  query: string;
  items: PublicSponsorSearchItem[];
};

export type PublicSponsorSearchOutcome =
  | PublicSponsorSearchResult
  | { ok: false; status: 400 | 401 | 404 | 500; error: string };

type RpcCompany = {
  id?: unknown;
  name?: unknown;
  slug?: unknown;
  domain?: unknown;
  website?: unknown;
  logo_url?: unknown;
  logo_source?: unknown;
  logo_status?: unknown;
  restricted_at?: unknown;
};

type RpcRow = {
  id?: unknown;
  company_id?: unknown;
  tier_rank?: unknown;
  tier_label?: unknown;
  display_order?: unknown;
  company?: RpcCompany | null;
};

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed !== "" ? trimmed : null;
}

function asNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Map an RPC row to the public search item. Scrubs restricted fields in the
 * API payload (not UI-only). Never includes aliases or match metadata.
 */
export function mapPublicSponsorSearchItem(
  row: RpcRow,
): PublicSponsorSearchItem | null {
  const id = asTrimmedString(row.id);
  const companyId =
    asTrimmedString(row.company_id) ?? asTrimmedString(row.company?.id);
  const companyName = asTrimmedString(row.company?.name);
  if (id === null || companyId === null || companyName === null) {
    return null;
  }

  const restricted = isCompanyRestricted({
    restricted_at:
      typeof row.company?.restricted_at === "string"
        ? row.company.restricted_at
        : row.company?.restricted_at === null
          ? null
          : undefined,
  });

  if (restricted) {
    return {
      id,
      company_id: companyId,
      tier_rank: asNullableNumber(row.tier_rank),
      tier_label: asTrimmedString(row.tier_label),
      display_order: asNullableNumber(row.display_order),
      company: {
        id: companyId,
        name: companyName,
        restricted: true,
        restricted_label: RESTRICTED_COMPANY_ROSTER_LABEL,
        slug: null,
        domain: null,
        website: null,
        logo_url: null,
        logo_source: null,
        logo_status: null,
        href: null,
      },
    };
  }

  const slug = asTrimmedString(row.company?.slug);
  const href = buildSponsorProfilePath({
    id: companyId,
    slug,
    restricted_at: null,
  });

  return {
    id,
    company_id: companyId,
    tier_rank: asNullableNumber(row.tier_rank),
    tier_label: asTrimmedString(row.tier_label),
    display_order: asNullableNumber(row.display_order),
    company: {
      id: companyId,
      name: companyName,
      restricted: false,
      restricted_label: null,
      slug,
      domain: asTrimmedString(row.company?.domain),
      website: asTrimmedString(row.company?.website),
      logo_url: asTrimmedString(row.company?.logo_url),
      logo_source: asTrimmedString(row.company?.logo_source),
      logo_status: asTrimmedString(row.company?.logo_status),
      href,
    },
  };
}

function parseRpcRows(data: unknown): RpcRow[] {
  if (!Array.isArray(data)) return [];
  return data.filter((row): row is RpcRow => row !== null && typeof row === "object");
}

/**
 * Edition-scoped sponsor search. Authenticated session + INVOKER RPC (RLS).
 * Does not use service role or admin search helpers.
 */
export async function searchPublicEditionSponsors(
  editionIdOrSlug: string,
  rawQuery: string | null | undefined,
): Promise<PublicSponsorSearchOutcome> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user === null) {
    return { ok: false, status: 401, error: "Authentication required." };
  }

  const parsed = parsePublicSponsorSearchQuery(rawQuery);
  if (!parsed.ok) {
    return { ok: false, status: 400, error: "Query is too long." };
  }

  if (parsed.tooShort) {
    return { ok: true, query: parsed.query, items: [] };
  }

  const editionId = await resolvePublicSponsorEditionId(editionIdOrSlug);
  if (editionId === null) {
    return { ok: false, status: 404, error: "Event not found." };
  }

  try {
    const { data, error } = await supabase.rpc("event_edition_sponsor_search", {
      p_edition_id: editionId,
      p_query: parsed.query,
    });

    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[events] sponsor search RPC failed:", error);
      }
      return { ok: false, status: 500, error: "Failed to search sponsors." };
    }

    const items: PublicSponsorSearchItem[] = [];
    for (const row of parseRpcRows(data)) {
      const mapped = mapPublicSponsorSearchItem(row);
      if (mapped !== null) items.push(mapped);
      if (items.length >= PUBLIC_SPONSOR_SEARCH_MAX_RESULTS) break;
    }

    return { ok: true, query: parsed.query, items };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[events] sponsor search failed:", error);
    }
    return { ok: false, status: 500, error: "Failed to search sponsors." };
  }
}
