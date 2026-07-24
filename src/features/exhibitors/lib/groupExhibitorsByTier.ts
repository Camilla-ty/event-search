import type { LiveExhibitorRow } from "@/src/features/exhibitors/server/eventExhibitorAdmin";

export type ExhibitorTierGroupable = {
  id: string;
  tier_rank: number | null;
  tier_label: string | null;
};

export type LiveExhibitorTierGroup<T extends ExhibitorTierGroupable = LiveExhibitorRow> = {
  tierRank: number | null;
  tierLabel: string | null;
  exhibitors: T[];
};

/** Groups exhibitors by tier_rank, preserving input order within each group. */
export function groupExhibitorsByTier<T extends ExhibitorTierGroupable>(
  rows: readonly T[],
): LiveExhibitorTierGroup<T>[] {
  const groups: LiveExhibitorTierGroup<T>[] = [];
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

/**
 * Public exhibitor tier copy:
 * - custom label → label only
 * - no label + rank 1 → "Exhibitor"
 * - no label + rank > 1 → "Tier {rank}"
 * - otherwise null (callers may map to "Unranked")
 */
export function formatExhibitorPublicTierDisplay(
  tierRank: number | null,
  tierLabel: string | null,
): string | null {
  const label = tierLabel?.trim() ?? "";
  if (label !== "") return label;
  if (tierRank === 1) return "Exhibitor";
  if (tierRank !== null) return `Tier ${tierRank}`;
  return null;
}

export function formatExhibitorTierHeading(group: {
  tierRank: number | null;
  tierLabel: string | null;
}): string {
  return formatExhibitorPublicTierDisplay(group.tierRank, group.tierLabel) ?? "Unranked";
}
