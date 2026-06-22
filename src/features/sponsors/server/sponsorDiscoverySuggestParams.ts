import { parseSponsorDiscoveryQuery } from "@/src/features/sponsors/server/sponsorDiscoveryParams";

export const SPONSOR_SUGGEST_MIN_QUERY_LENGTH = 2;
export const SPONSOR_SUGGEST_DEFAULT_LIMIT = 8;
export const SPONSOR_SUGGEST_MAX_LIMIT = 10;
export const SPONSOR_SUGGEST_MIN_LIMIT = 1;

export function parseSponsorDiscoverySuggestQuery(
  raw: string | null | undefined,
): string {
  return parseSponsorDiscoveryQuery(raw);
}

export function isSponsorDiscoverySuggestQueryEligible(query: string): boolean {
  return query.length >= SPONSOR_SUGGEST_MIN_QUERY_LENGTH;
}

export function parseSponsorDiscoverySuggestLimit(
  raw: string | number | null | undefined,
): number {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const value = Math.floor(raw);
    if (value >= SPONSOR_SUGGEST_MIN_LIMIT && value <= SPONSOR_SUGGEST_MAX_LIMIT) {
      return value;
    }
    return SPONSOR_SUGGEST_DEFAULT_LIMIT;
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "") return SPONSOR_SUGGEST_DEFAULT_LIMIT;
    const parsed = Number.parseInt(trimmed, 10);
    if (
      Number.isFinite(parsed) &&
      parsed >= SPONSOR_SUGGEST_MIN_LIMIT &&
      parsed <= SPONSOR_SUGGEST_MAX_LIMIT
    ) {
      return parsed;
    }
  }

  return SPONSOR_SUGGEST_DEFAULT_LIMIT;
}

export function emptySponsorSuggestResult(query: string): {
  query: string;
  items: [];
  total: 0;
} {
  return {
    query,
    items: [],
    total: 0,
  };
}
