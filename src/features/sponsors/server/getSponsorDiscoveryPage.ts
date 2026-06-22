import { mapSponsorDiscoveryRpcResponse } from "@/src/features/sponsors/server/mapSponsorDiscoveryRpcResponse";
import {
  clampSponsorDiscoveryPage,
  parseSponsorDiscoveryParams,
} from "@/src/features/sponsors/server/sponsorDiscoveryParams";
import type {
  SponsorDiscoveryParams,
  SponsorDiscoveryResult,
  SponsorDiscoverySearchInput,
} from "@/src/features/sponsors/server/sponsorDiscoveryTypes";
import { getCompaniesByIds } from "@/src/lib/queries/companies";
import { formatLocationFromCityEmbed } from "@/src/lib/location/parseLocationEmbed";
import { createClient } from "@/src/lib/supabase/server";

async function fetchSponsorDiscoveryPage(
  params: SponsorDiscoveryParams,
): Promise<SponsorDiscoveryResult> {
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

  const mapped = mapSponsorDiscoveryRpcResponse(data, params);
  if (mapped.rows.length === 0) {
    return mapped;
  }

  const companyIds = mapped.rows.map((row) => row.id);
  const companies = await getCompaniesByIds(companyIds);
  const locationByCompanyId = new Map<string, string | null>(
    companies.map((company) => [
      company.id,
      formatLocationFromCityEmbed(company.cities) || null,
    ]),
  );

  return {
    ...mapped,
    rows: mapped.rows.map((row) => ({
      ...row,
      location_label: locationByCompanyId.get(row.id) ?? null,
    })),
  };
}

export async function getSponsorDiscoveryPage(
  input: SponsorDiscoverySearchInput,
): Promise<SponsorDiscoveryResult> {
  const params = parseSponsorDiscoveryParams(input);
  const result = await fetchSponsorDiscoveryPage(params);

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
  const clampedResult = await fetchSponsorDiscoveryPage(clampedParams);

  return {
    ...clampedResult,
    pageWasClamped: true,
  };
}
