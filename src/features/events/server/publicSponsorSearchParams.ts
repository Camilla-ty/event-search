/** Shared-style roster search query parsing (Sponsor Search v1). */

export const PUBLIC_SPONSOR_SEARCH_MIN_QUERY_LENGTH = 3 as const;
export const PUBLIC_SPONSOR_SEARCH_MAX_QUERY_LENGTH = 200 as const;
export const PUBLIC_SPONSOR_SEARCH_MAX_RESULTS = 20 as const;

export type PublicSponsorSearchQueryParse =
  | { ok: true; query: string; tooShort: boolean }
  | { ok: false; error: "query_too_long" };

/**
 * Trim and validate `q`. Short queries are ok (empty search; no roster scan).
 * Queries longer than 200 characters are rejected.
 */
export function parsePublicSponsorSearchQuery(
  raw: string | null | undefined,
): PublicSponsorSearchQueryParse {
  const query = typeof raw === "string" ? raw.trim() : "";
  if (query.length > PUBLIC_SPONSOR_SEARCH_MAX_QUERY_LENGTH) {
    return { ok: false, error: "query_too_long" };
  }
  return {
    ok: true,
    query,
    tooShort: query.length < PUBLIC_SPONSOR_SEARCH_MIN_QUERY_LENGTH,
  };
}
