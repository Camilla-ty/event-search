import type { EventSponsorCompany } from "@/src/features/events/components/detail/types";
import {
  formatExhibitorTierHeading,
  groupExhibitorsByTier,
} from "@/src/features/exhibitors/lib/groupExhibitorsByTier";
import {
  COMPANY_PUBLIC_COLUMNS,
  getCompaniesByIds,
  type CompanyPublicRow,
} from "@/src/lib/queries/companies";
import { mapPublicLogoUrl } from "@/src/lib/storage/mapPublicLogoUrl";
import { createClient } from "@/src/lib/supabase/server";

export type PublicExhibitorCompany = EventSponsorCompany & {
  id: string;
};

export type PublicExhibitorRow = {
  id: string;
  company_id: string;
  tier_rank: number | null;
  tier_label: string | null;
  display_order: number | null;
  company: PublicExhibitorCompany;
};

export type PublicExhibitorTierGroup = {
  tierRank: number | null;
  tierLabel: string | null;
  exhibitors: PublicExhibitorRow[];
};

function companyIdKey(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  return String(raw).trim().toLowerCase();
}

function mapPublicExhibitorCompany(
  raw: CompanyPublicRow | null | undefined,
): PublicExhibitorCompany | null {
  if (!raw || typeof raw.id !== "string" || raw.id.trim() === "") return null;

  return {
    id: raw.id,
    slug: typeof raw.slug === "string" ? raw.slug : null,
    name: typeof raw.name === "string" ? raw.name : null,
    domain: typeof raw.domain === "string" ? raw.domain : null,
    website: typeof raw.website === "string" ? raw.website : null,
    logo_url: mapPublicLogoUrl(typeof raw.logo_url === "string" ? raw.logo_url : null),
    logo_source: typeof raw.logo_source === "string" ? raw.logo_source : null,
    logo_status: typeof raw.logo_status === "string" ? raw.logo_status : null,
    restricted_at: typeof raw.restricted_at === "string" ? raw.restricted_at : null,
  };
}

/** Stable sort: tier_rank ASC (nulls last), display_order ASC, id ASC. */
export function sortPublicExhibitorRows(
  rows: readonly PublicExhibitorRow[],
): PublicExhibitorRow[] {
  return [...rows].sort((a, b) => {
    const ar = a.tier_rank;
    const br = b.tier_rank;
    if (ar === null && br !== null) return 1;
    if (ar !== null && br === null) return -1;
    if (ar !== null && br !== null && ar !== br) return ar - br;

    const ao = a.display_order ?? Number.MAX_SAFE_INTEGER;
    const bo = b.display_order ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;

    return a.id.localeCompare(b.id);
  });
}

export function groupPublicExhibitorsByTier(
  rows: readonly PublicExhibitorRow[],
): PublicExhibitorTierGroup[] {
  const sorted = sortPublicExhibitorRows(rows);
  return groupExhibitorsByTier(sorted).map((group) => ({
    tierRank: group.tierRank,
    tierLabel: group.tierLabel,
    exhibitors: group.exhibitors,
  }));
}

export function formatPublicExhibitorTierHeading(group: {
  tierRank: number | null;
  tierLabel: string | null;
}): string {
  return formatExhibitorTierHeading(group);
}

/** Tab is shown only when there is at least one displayable exhibitor. */
export function shouldShowPublicExhibitorsTab(
  exhibitors: readonly PublicExhibitorRow[] | null | undefined,
): boolean {
  return Array.isArray(exhibitors) && exhibitors.length >= 1;
}

function logPublicExhibitorLoadFailure(context: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[exhibitors] public load failed (${context}):`, message);
}

/**
 * Full public exhibitor roster for an edition (session client + public RLS only).
 * Returns [] when absent or on failure so Event Detail can hide the tab fail-soft.
 */
export async function getPublicExhibitorsForEditionId(
  editionId: string,
): Promise<PublicExhibitorRow[]> {
  const trimmed = editionId.trim();
  if (trimmed === "") return [];

  try {
    const supabase = await createClient();
    const { data: links, error } = await supabase
      .from("event_exhibitors")
      .select("id, company_id, tier_rank, tier_label, display_order")
      .eq("event_editions_id", trimmed)
      .order("tier_rank", { ascending: true, nullsFirst: false })
      .order("display_order", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true });

    if (error) {
      logPublicExhibitorLoadFailure("link select", error.message);
      return [];
    }
    if (!links || links.length === 0) return [];

    const companyIds = [
      ...new Set(
        links
          .map((link) =>
            link.company_id === null || link.company_id === undefined
              ? ""
              : String(link.company_id).trim(),
          )
          .filter((id) => id !== ""),
      ),
    ];

    const companyRows = await getCompaniesByIds(companyIds);
    const companyById = new Map<string, CompanyPublicRow>(
      companyRows.map((row) => [companyIdKey(row.id), row]),
    );

    const rows: PublicExhibitorRow[] = [];

    for (const link of links) {
      const id = typeof link.id === "string" ? link.id : link.id != null ? String(link.id) : "";
      const companyId =
        typeof link.company_id === "string"
          ? link.company_id
          : link.company_id != null
            ? String(link.company_id)
            : "";
      if (id === "" || companyId === "") continue;

      const company = mapPublicExhibitorCompany(companyById.get(companyIdKey(companyId)));
      if (!company) continue;

      rows.push({
        id,
        company_id: companyId,
        tier_rank: typeof link.tier_rank === "number" ? link.tier_rank : null,
        tier_label: typeof link.tier_label === "string" ? link.tier_label : null,
        display_order: typeof link.display_order === "number" ? link.display_order : null,
        company,
      });
    }

    return sortPublicExhibitorRows(rows);
  } catch (error) {
    logPublicExhibitorLoadFailure("unexpected", error);
    return [];
  }
}

/** Exported for tests that assert the public company select shape. */
export const PUBLIC_EXHIBITOR_COMPANY_SELECT = COMPANY_PUBLIC_COLUMNS;
