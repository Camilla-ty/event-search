import { mapSponsorDiscoveryRpcResponse } from "@/src/features/sponsors/server/mapSponsorDiscoveryRpcResponse";
import { mapSponsorDiscoverySuggestItems } from "@/src/features/sponsors/server/mapSponsorDiscoverySuggestItems";
import {
  emptySponsorSuggestResult,
  isSponsorDiscoverySuggestQueryEligible,
  parseSponsorDiscoverySuggestLimit,
  parseSponsorDiscoverySuggestQuery,
} from "@/src/features/sponsors/server/sponsorDiscoverySuggestParams";
import type {
  SponsorDiscoveryParams,
} from "@/src/features/sponsors/server/sponsorDiscoveryTypes";
import type {
  SponsorSuggestInput,
  SponsorSuggestResult,
} from "@/src/features/sponsors/server/sponsorDiscoverySuggestTypes";
import { createClient } from "@/src/lib/supabase/server";

export async function getSponsorDiscoverySuggestions(
  input: SponsorSuggestInput,
): Promise<SponsorSuggestResult> {
  const query = parseSponsorDiscoverySuggestQuery(input.q);
  const limit = parseSponsorDiscoverySuggestLimit(input.limit);

  if (!isSponsorDiscoverySuggestQueryEligible(query)) {
    return emptySponsorSuggestResult(query);
  }

  const params: SponsorDiscoveryParams = {
    query,
    eventSlug: null,
    sort: "name",
    page: 1,
    pageSize: limit,
  };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sponsor_discovery_page", {
    p_query: query,
    p_event_slug: null,
    p_sort: "name",
    p_page: 1,
    p_page_size: limit,
  });

  if (error) {
    throw new Error(error.message);
  }

  const mapped = mapSponsorDiscoveryRpcResponse(data, params);

  return {
    query,
    items: mapSponsorDiscoverySuggestItems(mapped.rows),
    total: mapped.total,
  };
}
