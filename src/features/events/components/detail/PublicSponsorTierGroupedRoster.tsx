import { useMemo } from "react";

import { groupSponsorsByTier } from "@/src/features/events/lib/groupSponsorsByTier";

import { PublicSponsorTierSection } from "./PublicSponsorTierSection";
import type { EventSponsorRow } from "./types";

type PublicSponsorTierGroupedRosterProps = {
  sponsors: EventSponsorRow[];
};

function tierSectionKey(tierRank: number | null): string {
  return tierRank === null ? "tier-unranked" : `tier-${tierRank}`;
}

export function PublicSponsorTierGroupedRoster({ sponsors }: PublicSponsorTierGroupedRosterProps) {
  const tierGroups = useMemo(() => groupSponsorsByTier(sponsors), [sponsors]);

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
        />
      ))}
    </div>
  );
}
