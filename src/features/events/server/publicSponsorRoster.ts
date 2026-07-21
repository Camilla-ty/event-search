import type { EventSponsorRow } from "@/src/features/events/components/detail/types";
import { filterDisplayableSponsors } from "@/src/features/events/components/detail/eventSponsorUtils";
import {
  mergeCompaniesOntoEventSponsorLinks,
} from "@/src/lib/queries/companies";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { createClient } from "@/src/lib/supabase/server";
import { fetchAllPaginatedSupabaseRows } from "@/src/lib/supabase/fetchAllPaginatedRows";

/** Hard page size for public sponsor tier pages (ADR-003). */
export const PUBLIC_SPONSOR_TIER_PAGE_SIZE = 20 as const;

export type PublicSponsorTierSummaryItem = {
  tierRank: number | null;
  tierLabel: string | null;
  count: number;
  locked: boolean;
};

export type PublicSponsorTierSummary = {
  editionId: string;
  totalSponsorCount: number;
  tiers: PublicSponsorTierSummaryItem[];
};

export type PublicSponsorTierPageResult = {
  editionId: string;
  tierRank: number;
  tierLabel: string | null;
  page: number;
  pageSize: typeof PUBLIC_SPONSOR_TIER_PAGE_SIZE;
  totalInTier: number;
  totalPages: number;
  hasMore: boolean;
  rows: EventSponsorRow[];
};

type SponsorLinkTierFields = {
  id?: string;
  tier_rank?: number | null;
  tier_label?: string | null;
  display_order?: number | null;
};

type SponsorLinkRow = {
  id: string;
  company_id: string | null;
  tier_rank: number | null;
  tier_label: string | null;
  display_order: number | null;
  event_editions_id: string;
};

function isUuidString(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

export function normalizeEditionIdForPublicSponsors(raw: string): string {
  const trimmed = raw.trim();
  return isUuidString(trimmed) ? trimmed.toLowerCase() : trimmed;
}

/** Server always enforces max 20 regardless of client input. */
export function clampPublicSponsorTierPageSize(
  requested?: number | null,
): typeof PUBLIC_SPONSOR_TIER_PAGE_SIZE {
  void requested;
  return PUBLIC_SPONSOR_TIER_PAGE_SIZE;
}

function trimLabel(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed !== "" ? trimmed : null;
}

function compareTierRanks(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

/**
 * Build identity-free tier summaries from link tier fields only (no company columns).
 * Exported for unit tests.
 */
export function buildPublicSponsorTierSummariesFromLinks(
  editionId: string,
  links: readonly SponsorLinkTierFields[],
  options: { isAuthenticated: boolean; totalSponsorCount?: number },
): PublicSponsorTierSummary {
  const byRank = new Map<
    string,
    { tierRank: number | null; tierLabel: string | null; count: number }
  >();

  for (const link of links) {
    const tierRank =
      typeof link.tier_rank === "number" && Number.isFinite(link.tier_rank)
        ? Math.trunc(link.tier_rank)
        : null;
    const key = tierRank === null ? "__null__" : String(tierRank);
    const existing = byRank.get(key);
    if (existing) {
      existing.count += 1;
      if (existing.tierLabel === null) {
        existing.tierLabel = trimLabel(link.tier_label);
      }
      continue;
    }
    byRank.set(key, {
      tierRank,
      tierLabel: trimLabel(link.tier_label),
      count: 1,
    });
  }

  const tiers = Array.from(byRank.values())
    .map((tier) => ({
      tierRank: tier.tierRank,
      tierLabel: tier.tierLabel,
      count: tier.count,
      locked: !options.isAuthenticated && tier.tierRank !== 1,
    }))
    .sort((a, b) => compareTierRanks(a.tierRank, b.tierRank));

  const totalSponsorCount =
    typeof options.totalSponsorCount === "number" && Number.isFinite(options.totalSponsorCount)
      ? Math.max(0, Math.trunc(options.totalSponsorCount))
      : links.length;

  return {
    editionId,
    totalSponsorCount,
    tiers,
  };
}

export function countTiersFromPublicSponsorSummaries(
  summary: PublicSponsorTierSummary,
): number {
  return summary.tiers.filter((tier) => tier.tierRank !== null).length;
}

/**
 * Identity-free tier chrome for SSR. Uses admin client for all-tier counts only
 * (no company_id / company fields selected).
 */
export async function getPublicSponsorTierSummaries(
  editionId: string,
  options: { isAuthenticated: boolean; totalSponsorCount?: number },
): Promise<PublicSponsorTierSummary> {
  const editionKey = normalizeEditionIdForPublicSponsors(editionId);
  if (editionKey === "") {
    return {
      editionId,
      totalSponsorCount: options.totalSponsorCount ?? 0,
      tiers: [],
    };
  }

  try {
    const supabase = createAdminClient();
    const links = await fetchAllPaginatedSupabaseRows<SponsorLinkTierFields>(
      async ({ from, to }) =>
        supabase
          .from("event_sponsors")
          .select("id, tier_rank, tier_label, display_order")
          .eq("event_editions_id", editionKey)
          .order("tier_rank", { ascending: true, nullsFirst: false })
          .order("display_order", { ascending: true, nullsFirst: false })
          .order("id", { ascending: true })
          .range(from, to),
    );

    return buildPublicSponsorTierSummariesFromLinks(editionKey, links, {
      isAuthenticated: options.isAuthenticated,
      totalSponsorCount: options.totalSponsorCount,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[events] public sponsor tier summaries failed:", error);
    }
    return {
      editionId: editionKey,
      totalSponsorCount: options.totalSponsorCount ?? 0,
      tiers: [],
    };
  }
}

/**
 * Initial SSR payload for Tier 1 only. Later tiers/pages remain Phase 3+ work.
 * Uses the session client so existing RLS remains defense in depth.
 */
export async function getInitialPublicSponsorTierOnePage(
  editionId: string,
): Promise<PublicSponsorTierPageResult> {
  const editionKey = normalizeEditionIdForPublicSponsors(editionId);
  const tierRank = 1;
  const page = 1;
  const pageSize = clampPublicSponsorTierPageSize();

  if (editionKey === "") {
    return {
      editionId: editionKey,
      tierRank,
      tierLabel: null,
      page,
      pageSize,
      totalInTier: 0,
      totalPages: 1,
      hasMore: false,
      rows: [],
    };
  }

  const supabase = await createClient();

  const { count, error: countError } = await supabase
    .from("event_sponsors")
    .select("id", { count: "exact", head: true })
    .eq("event_editions_id", editionKey)
    .eq("tier_rank", tierRank);

  if (countError) {
    if (process.env.NODE_ENV === "development") {
      console.error("[events] public sponsor tier count failed:", countError);
    }
    return {
      editionId: editionKey,
      tierRank,
      tierLabel: null,
      page,
      pageSize,
      totalInTier: 0,
      totalPages: 1,
      hasMore: false,
      rows: [],
    };
  }

  const totalInTier = typeof count === "number" && Number.isFinite(count) ? count : 0;
  const totalPages = Math.max(1, Math.ceil(totalInTier / pageSize));
  const from = 0;
  const to = from + pageSize - 1;

  const { data: links, error } = await supabase
    .from("event_sponsors")
    .select("id, company_id, tier_rank, tier_label, display_order, event_editions_id")
    .eq("event_editions_id", editionKey)
    .eq("tier_rank", tierRank)
    .order("tier_rank", { ascending: true, nullsFirst: false })
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true })
    .range(from, to);

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[events] public sponsor tier page failed:", error);
    }
    return {
      editionId: editionKey,
      tierRank,
      tierLabel: null,
      page,
      pageSize,
      totalInTier,
      totalPages,
      hasMore: page < totalPages,
      rows: [],
    };
  }

  const list = (links ?? []) as SponsorLinkRow[];
  const hydrated = await mergeCompaniesOntoEventSponsorLinks(list);
  const rows = filterDisplayableSponsors(hydrated as EventSponsorRow[]);
  const tierLabel =
    rows.length > 0
      ? trimLabel(rows[0]?.tier_label)
      : list.length > 0
        ? trimLabel(list[0]?.tier_label)
        : null;

  return {
    editionId: editionKey,
    tierRank,
    tierLabel,
    page,
    pageSize,
    totalInTier,
    totalPages,
    hasMore: page < totalPages,
    rows,
  };
}
