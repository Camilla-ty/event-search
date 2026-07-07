import {
  adminTierSectionTitle,
  groupSponsorsByTier,
} from "@/src/features/events/lib/groupSponsorsByTier";

import type { LiveSponsorRow, LiveSponsorTierGroup } from "./liveSponsorTypes";

export { groupSponsorsByTier };

export function countDistinctTiers(sponsors: readonly LiveSponsorRow[]): number {
  const tiers = new Set<string>();
  for (const sponsor of sponsors) {
    tiers.add(sponsor.tier_rank === null ? "__null__" : String(sponsor.tier_rank));
  }
  return tiers.size;
}

export function filterSponsorsBySearch(
  sponsors: readonly LiveSponsorRow[],
  query: string,
): LiveSponsorRow[] {
  const normalized = query.trim().toLowerCase();
  if (normalized === "") return [...sponsors];

  return sponsors.filter((sponsor) => {
    const company = sponsor.companies;
    const name = company?.name?.trim().toLowerCase() ?? "";
    const domain = company?.domain?.trim().toLowerCase() ?? "";
    return name.includes(normalized) || domain.includes(normalized);
  });
}

export function tierSectionTitle(group: LiveSponsorTierGroup): string {
  return adminTierSectionTitle(group);
}
