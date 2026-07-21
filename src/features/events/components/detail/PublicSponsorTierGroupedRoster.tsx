import { useMemo } from "react";

import { groupSponsorsByTier } from "@/src/features/events/lib/groupSponsorsByTier";
import type { PublicSponsorTierSummaryItem } from "@/src/features/events/server/publicSponsorRoster";

import { PublicSponsorTierSection } from "./PublicSponsorTierSection";
import type { EventSponsorRow } from "./types";

type PublicSponsorTierGroupedRosterProps = {
  sponsors: EventSponsorRow[];
  tierSummaries?: PublicSponsorTierSummaryItem[];
};

function tierSectionKey(tierRank: number | null): string {
  return tierRank === null ? "tier-unranked" : `tier-${tierRank}`;
}

function tierSummaryKey(tierRank: number | null): string {
  return tierRank === null ? "__null__" : String(tierRank);
}

export function PublicSponsorTierGroupedRoster({
  sponsors,
  tierSummaries = [],
}: PublicSponsorTierGroupedRosterProps) {
  const tierGroups = useMemo(() => groupSponsorsByTier(sponsors), [sponsors]);
  const countByTier = useMemo(
    () =>
      new Map(
        tierSummaries.map((summary) => [
          tierSummaryKey(summary.tierRank),
          summary.count,
        ]),
      ),
    [tierSummaries],
  );

  if (tierGroups.length === 0) {
    return (
      <p className="text-sm text-slate-500">No sponsors linked to this event yet.</p>
    );
  }

  return (
    <div className="space-y-4">
      {tierGroups.map((group) => (
        <PublicSponsorTierSection
          key={tierSectionKey(group.tierRank)}
          group={group}
          totalCount={countByTier.get(tierSummaryKey(group.tierRank))}
        />
      ))}
    </div>
  );
}
