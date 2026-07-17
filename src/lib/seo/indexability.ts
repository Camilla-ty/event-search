import type { Metadata } from "next";

/**
 * Shared IR1 public-value / indexability decisions.
 * Source of truth for generateMetadata, redirects, and sitemap inclusion.
 * @see docs/plans/indexability-policy.md
 */

export type RobotsIndexFollow = {
  index: boolean;
  follow: boolean;
};

export type IndexabilityDecision = {
  /** May appear in organic search results. */
  indexable: boolean;
  /** Must match indexable for catalog entity URLs. */
  includeInSitemap: boolean;
  robots: RobotsIndexFollow;
};

export const INDEXABLE: IndexabilityDecision = {
  indexable: true,
  includeInSitemap: true,
  robots: { index: true, follow: true },
};

export const NOINDEX_FOLLOW: IndexabilityDecision = {
  indexable: false,
  includeInSitemap: false,
  robots: { index: false, follow: true },
};

/** Metadata robots value: omit when indexable (default); emit noindex when not. */
export function robotsForIndexability(
  decision: Pick<IndexabilityDecision, "indexable" | "robots">,
): Metadata["robots"] | undefined {
  if (decision.indexable) return undefined;
  return { index: false, follow: decision.robots.follow };
}

/**
 * Authoritative company gate: restricted never indexable;
 * otherwise require sponsored_edition_count >= 1 (same signal as public total).
 */
export function getCompanyIndexability(input: {
  restricted: boolean;
  sponsoredEditionCount: number;
}): IndexabilityDecision {
  if (input.restricted) return NOINDEX_FOLLOW;
  const count = normalizeNonNegativeInt(input.sponsoredEditionCount);
  if (count < 1) return NOINDEX_FOLLOW;
  return INDEXABLE;
}

/**
 * Authoritative edition gate: require sponsor link count >= 1
 * (same signal as visible total sponsor count).
 */
export function getEventEditionIndexability(input: {
  sponsorCount: number;
}): IndexabilityDecision {
  const count = normalizeNonNegativeInt(input.sponsorCount);
  if (count < 1) return NOINDEX_FOLLOW;
  return INDEXABLE;
}

export type SeriesLifecycleForIndexability =
  | "active"
  | "discontinued"
  | "merged"
  | "unknown";

export function normalizeSeriesLifecycle(
  raw: string | null | undefined,
): SeriesLifecycleForIndexability {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (value === "merged") return "merged";
  if (value === "discontinued") return "discontinued";
  if (value === "active" || value === "") return "active";
  return "unknown";
}

/**
 * Series gate after merge resolution:
 * - active / discontinued / unknown-null → indexable
 * - merged (tombstone or pending redirect handled elsewhere) → not indexable
 */
export function getSeriesIndexability(input: {
  lifecycleStatus: string | null | undefined;
  /** True when this URL should not be indexed (merged tombstone or mid-redirect source). */
  treatAsMergedNonDestination?: boolean;
}): IndexabilityDecision {
  if (input.treatAsMergedNonDestination) return NOINDEX_FOLLOW;
  const lifecycle = normalizeSeriesLifecycle(input.lifecycleStatus);
  if (lifecycle === "merged") return NOINDEX_FOLLOW;
  return INDEXABLE;
}

/** Topic hubs that resolve publicly are indexable (IR1). */
export function getTopicIndexability(): IndexabilityDecision {
  return INDEXABLE;
}

/**
 * Collection/list URLs: any search or filter query param → noindex;
 * clean base path remains indexable. Canonical always the clean base.
 */
export function getCollectionIndexability(input: {
  hasFilterOrSearchParams: boolean;
}): IndexabilityDecision {
  if (input.hasFilterOrSearchParams) return NOINDEX_FOLLOW;
  return INDEXABLE;
}

const EVENT_COLLECTION_FILTER_KEYS = [
  "q",
  "industry",
  "region",
  "type",
  "start",
  "end",
  "topic",
  "sort",
  "page",
] as const;

const SPONSOR_COLLECTION_FILTER_KEYS = ["event", "q", "sort", "page"] as const;

export function eventCollectionHasFilterOrSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): boolean {
  return collectionRecordHasKeys(searchParams, EVENT_COLLECTION_FILTER_KEYS);
}

export function sponsorCollectionHasFilterOrSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): boolean {
  return collectionRecordHasKeys(searchParams, SPONSOR_COLLECTION_FILTER_KEYS);
}

function collectionRecordHasKeys(
  searchParams: Record<string, string | string[] | undefined>,
  keys: readonly string[],
): boolean {
  for (const key of keys) {
    const value = searchParams[key];
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      if (value.some((entry) => String(entry).trim() !== "")) return true;
      continue;
    }
    if (String(value).trim() !== "") return true;
  }
  return false;
}

function normalizeNonNegativeInt(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}
