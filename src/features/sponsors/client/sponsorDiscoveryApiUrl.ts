import { buildSponsorDiscoverySearchParams } from "@/src/features/sponsors/server/sponsorDiscoveryParams";
import type { SponsorDiscoveryParams } from "@/src/features/sponsors/server/sponsorDiscoveryTypes";

export function buildSponsorDiscoveryApiUrl(params: SponsorDiscoveryParams): string {
  const query = buildSponsorDiscoverySearchParams(params).toString();
  return query !== "" ? `/api/sponsors/discovery?${query}` : "/api/sponsors/discovery";
}
