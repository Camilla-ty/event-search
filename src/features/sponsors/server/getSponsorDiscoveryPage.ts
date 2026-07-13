import { mapSponsorDiscoveryPublicResult } from "@/src/features/sponsors/server/mapSponsorDiscoveryPublicRow";
import { mapSponsorDiscoveryRpcResponse } from "@/src/features/sponsors/server/mapSponsorDiscoveryRpcResponse";
import {
  clampSponsorDiscoveryPage,
  parseSponsorDiscoveryParams,
} from "@/src/features/sponsors/server/sponsorDiscoveryParams";
import type {
  SponsorDiscoveryInternalResult,
  SponsorDiscoveryParams,
  SponsorDiscoveryResult,
  SponsorDiscoverySearchInput,
} from "@/src/features/sponsors/server/sponsorDiscoveryTypes";
import { createClient } from "@/src/lib/supabase/server";

async function fetchSponsorDiscoveryPageInternal(
  params: SponsorDiscoveryParams,
): Promise<SponsorDiscoveryInternalResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("sponsor_discovery_page", {
    p_query: params.query !== "" ? params.query : null,
    p_event_slug: params.eventSlug,
    p_sort: params.sort,
    p_page: params.page,
    p_page_size: params.pageSize,
  });

  if (error) {
    throw new Error(error.message);
  }

  return mapSponsorDiscoveryRpcResponse(data, params);
}

export async function getSponsorDiscoveryPage(
  input: SponsorDiscoverySearchInput,
): Promise<SponsorDiscoveryResult> {
  const params = parseSponsorDiscoveryParams(input);
  const result = mapSponsorDiscoveryPublicResult(await fetchSponsorDiscoveryPageInternal(params));

  const shouldClampPage =
    result.total > 0 &&
    result.rows.length === 0 &&
    params.page > 1 &&
    !result.eventUnknown;

  if (!shouldClampPage) {
    return result;
  }

  const clampedPage = clampSponsorDiscoveryPage(
    params.page,
    result.total,
    params.pageSize,
  );

  if (clampedPage === params.page) {
    return result;
  }

  const clampedParams: SponsorDiscoveryParams = {
    ...params,
    page: clampedPage,
  };
  const clampedResult = mapSponsorDiscoveryPublicResult(
    await fetchSponsorDiscoveryPageInternal(clampedParams),
  );

  return {
    ...clampedResult,
    pageWasClamped: true,
  };
}
