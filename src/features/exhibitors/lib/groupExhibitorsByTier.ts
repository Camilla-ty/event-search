import type { LiveExhibitorRow } from "@/src/features/exhibitors/server/eventExhibitorAdmin";

export type LiveExhibitorTierGroup = {
  tierRank: number | null;
  tierLabel: string | null;
  exhibitors: LiveExhibitorRow[];
};

/** Groups exhibitors by tier_rank, preserving input order within each group. */
export function groupExhibitorsByTier(
  rows: readonly LiveExhibitorRow[],
): LiveExhibitorTierGroup[] {
  const groups: LiveExhibitorTierGroup[] = [];
  const indexByRank = new Map<string, number>();

  for (const row of rows) {
    const key = row.tier_rank === null ? "null" : String(row.tier_rank);
    const existing = indexByRank.get(key);
    if (existing === undefined) {
      indexByRank.set(key, groups.length);
      groups.push({
        tierRank: row.tier_rank,
        tierLabel: row.tier_label,
        exhibitors: [row],
      });
      continue;
    }
    const group = groups[existing];
    if (group) {
      group.exhibitors.push(row);
      if (!group.tierLabel && row.tier_label) {
        group.tierLabel = row.tier_label;
      }
    }
  }

  return groups;
}

export function formatExhibitorTierHeading(group: LiveExhibitorTierGroup): string {
  const rankText = group.tierRank === null ? "Unranked" : `Tier ${group.tierRank}`;
  if (group.tierLabel && group.tierLabel.trim() !== "") {
    return `${rankText} · ${group.tierLabel.trim()}`;
  }
  return rankText;
}
