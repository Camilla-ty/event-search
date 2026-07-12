import {
  buildSponsorDiscoveryParamsKey,
  parseSponsorDiscoveryParamsFromSearchParams,
  parseSponsorDiscoveryQuery,
  SPONSOR_DISCOVERY_DEFAULT_SORT,
  SPONSOR_DISCOVERY_MIN_PAGE,
} from "@/src/features/sponsors/server/sponsorDiscoveryParams";
import type {
  SponsorDiscoveryParams,
  SponsorDiscoverySort,
} from "@/src/features/sponsors/server/sponsorDiscoveryTypes";

export { buildSponsorDiscoveryParamsKey };

export function parseSponsorDiscoveryParamsFromLocationSearch(
  searchParams: URLSearchParams,
  pageSize: number,
): SponsorDiscoveryParams {
  const parsed = parseSponsorDiscoveryParamsFromSearchParams(searchParams);
  return {
    ...parsed,
    pageSize,
  };
}

export function applySponsorDiscoverySortChange(
  params: SponsorDiscoveryParams,
  sort: SponsorDiscoverySort,
): SponsorDiscoveryParams {
  return {
    ...params,
    sort,
    page: SPONSOR_DISCOVERY_MIN_PAGE,
  };
}

export function applySponsorDiscoveryPageChange(
  params: SponsorDiscoveryParams,
  page: number,
): SponsorDiscoveryParams {
  return {
    ...params,
    page,
  };
}

export function applySponsorDiscoveryClearEventScope(
  params: SponsorDiscoveryParams,
): SponsorDiscoveryParams {
  return {
    ...params,
    eventSlug: null,
    page: SPONSOR_DISCOVERY_MIN_PAGE,
    sort: params.sort === "tier" ? SPONSOR_DISCOVERY_DEFAULT_SORT : params.sort,
  };
}

export function applySponsorDiscoveryQueryChange(
  params: SponsorDiscoveryParams,
  query: string,
): SponsorDiscoveryParams {
  const normalizedQuery = parseSponsorDiscoveryQuery(query);
  const hasEventFilter = params.eventSlug !== null;

  return {
    ...params,
    query: normalizedQuery,
    page: SPONSOR_DISCOVERY_MIN_PAGE,
    sort:
      params.sort === "tier" && !hasEventFilter
        ? SPONSOR_DISCOVERY_DEFAULT_SORT
        : params.sort,
  };
}

export function shouldApplySponsorDiscoveryFetchResult(
  requestId: number,
  latestRequestId: number,
): boolean {
  return requestId === latestRequestId;
}
