import type {
  SponsorDiscoveryParams,
  SponsorDiscoverySearchInput,
  SponsorDiscoverySort,
} from "@/src/features/sponsors/server/sponsorDiscoveryTypes";

export const SPONSOR_DISCOVERY_DEFAULT_PAGE_SIZE = 20;
export const SPONSOR_DISCOVERY_MIN_PAGE_SIZE = 1;
export const SPONSOR_DISCOVERY_MAX_PAGE_SIZE = 100;
export const SPONSOR_DISCOVERY_MIN_PAGE = 1;
export const SPONSOR_DISCOVERY_MAX_PAGE = 9999;
export const SPONSOR_DISCOVERY_MAX_QUERY_LENGTH = 200;
export const SPONSOR_DISCOVERY_DEFAULT_SORT: SponsorDiscoverySort = "count";

const VALID_SORTS = new Set<SponsorDiscoverySort>(["activity", "name", "count", "tier"]);

function readQueryRaw(input: SponsorDiscoverySearchInput): string {
  if (typeof input.q === "string") return input.q;
  if (typeof input.query === "string") return input.query;
  return "";
}

export function parseSponsorDiscoveryQuery(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim();
  if (trimmed.length <= SPONSOR_DISCOVERY_MAX_QUERY_LENGTH) {
    return trimmed;
  }
  return trimmed.slice(0, SPONSOR_DISCOVERY_MAX_QUERY_LENGTH);
}

export function parseSponsorDiscoveryEventSlug(
  raw: string | null | undefined,
): string | null {
  const trimmed = (raw ?? "").trim();
  return trimmed !== "" ? trimmed : null;
}

export function parseSponsorDiscoverySort(
  raw: string | null | undefined,
  hasEventFilter: boolean,
): SponsorDiscoverySort {
  const normalized = (raw ?? "").trim().toLowerCase();
  if (normalized === "tier") {
    return hasEventFilter ? "tier" : SPONSOR_DISCOVERY_DEFAULT_SORT;
  }
  if (VALID_SORTS.has(normalized as SponsorDiscoverySort)) {
    return normalized as SponsorDiscoverySort;
  }
  return SPONSOR_DISCOVERY_DEFAULT_SORT;
}

export function parseSponsorDiscoveryPage(raw: string | number | null | undefined): number {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const value = Math.floor(raw);
    if (value >= SPONSOR_DISCOVERY_MIN_PAGE && value <= SPONSOR_DISCOVERY_MAX_PAGE) {
      return value;
    }
    return SPONSOR_DISCOVERY_MIN_PAGE;
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "") return SPONSOR_DISCOVERY_MIN_PAGE;
    const parsed = Number.parseInt(trimmed, 10);
    if (
      Number.isFinite(parsed) &&
      parsed >= SPONSOR_DISCOVERY_MIN_PAGE &&
      parsed <= SPONSOR_DISCOVERY_MAX_PAGE
    ) {
      return parsed;
    }
  }

  return SPONSOR_DISCOVERY_MIN_PAGE;
}

export function parseSponsorDiscoveryPageSize(
  raw: string | number | null | undefined,
): number {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const value = Math.floor(raw);
    if (value >= SPONSOR_DISCOVERY_MIN_PAGE_SIZE && value <= SPONSOR_DISCOVERY_MAX_PAGE_SIZE) {
      return value;
    }
    return SPONSOR_DISCOVERY_DEFAULT_PAGE_SIZE;
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "") return SPONSOR_DISCOVERY_DEFAULT_PAGE_SIZE;
    const parsed = Number.parseInt(trimmed, 10);
    if (
      Number.isFinite(parsed) &&
      parsed >= SPONSOR_DISCOVERY_MIN_PAGE_SIZE &&
      parsed <= SPONSOR_DISCOVERY_MAX_PAGE_SIZE
    ) {
      return parsed;
    }
  }

  return SPONSOR_DISCOVERY_DEFAULT_PAGE_SIZE;
}

export function sponsorDiscoveryTotalPages(total: number, pageSize: number): number {
  if (total <= 0) return 1;
  const safePageSize = pageSize > 0 ? pageSize : 1;
  return Math.max(1, Math.ceil(total / safePageSize));
}

export function clampSponsorDiscoveryPage(
  page: number,
  total: number,
  pageSize: number,
): number {
  const totalPages = sponsorDiscoveryTotalPages(total, pageSize);
  const safePage = page >= SPONSOR_DISCOVERY_MIN_PAGE ? page : SPONSOR_DISCOVERY_MIN_PAGE;
  return Math.min(safePage, totalPages);
}

export function buildSponsorDiscoveryPath(params: SponsorDiscoveryParams): string {
  const query = buildSponsorDiscoverySearchParams(params).toString();
  return query !== "" ? `/sponsors?${query}` : "/sponsors";
}

export function buildSponsorDiscoverySearchParams(
  params: SponsorDiscoveryParams,
): URLSearchParams {
  const search = new URLSearchParams();

  if (params.query.trim() !== "") {
    search.set("q", params.query.trim());
  }

  if (params.eventSlug !== null && params.eventSlug.trim() !== "") {
    search.set("event", params.eventSlug.trim());
  }

  if (params.sort !== SPONSOR_DISCOVERY_DEFAULT_SORT) {
    search.set("sort", params.sort);
  }

  if (params.page !== SPONSOR_DISCOVERY_MIN_PAGE) {
    search.set("page", String(params.page));
  }

  return search;
}

/** Stable key for comparing normalized discovery params (order-insensitive where applicable). */
export function buildSponsorDiscoveryParamsKey(params: SponsorDiscoveryParams): string {
  return buildSponsorDiscoverySearchParams(params).toString();
}

export function parseSponsorDiscoveryParamsFromSearchParams(
  searchParams: URLSearchParams,
): SponsorDiscoveryParams {
  return parseSponsorDiscoveryParams({
    q: searchParams.get("q"),
    event: searchParams.get("event"),
    sort: searchParams.get("sort"),
    page: searchParams.get("page"),
    pageSize: searchParams.get("page_size"),
  });
}

export function parseSponsorDiscoveryParams(
  input: SponsorDiscoverySearchInput,
): SponsorDiscoveryParams {
  const eventSlug = parseSponsorDiscoveryEventSlug(
    input.eventSlug ?? input.event ?? null,
  );
  const query = parseSponsorDiscoveryQuery(readQueryRaw(input));

  return {
    query,
    eventSlug,
    sort: parseSponsorDiscoverySort(input.sort, eventSlug !== null),
    page: parseSponsorDiscoveryPage(input.page),
    pageSize: parseSponsorDiscoveryPageSize(input.pageSize),
  };
}
