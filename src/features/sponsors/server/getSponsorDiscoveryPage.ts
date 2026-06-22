import { mapSponsorDiscoveryRpcResponse } from "@/src/features/sponsors/server/mapSponsorDiscoveryRpcResponse";
import { parseSponsorDiscoveryParams } from "@/src/features/sponsors/server/sponsorDiscoveryParams";
import type {
  SponsorDiscoveryResult,
  SponsorDiscoverySearchInput,
} from "@/src/features/sponsors/server/sponsorDiscoveryTypes";
import { getCompaniesByIds } from "@/src/lib/queries/companies";
import { formatLocationFromCityEmbed } from "@/src/lib/location/parseLocationEmbed";
import { createClient } from "@/src/lib/supabase/server";

export async function getSponsorDiscoveryPage(
  input: SponsorDiscoverySearchInput,
): Promise<SponsorDiscoveryResult> {
  const params = parseSponsorDiscoveryParams(input);
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
