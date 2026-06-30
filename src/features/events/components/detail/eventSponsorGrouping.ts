import type { EventSponsorRow } from "./types";

export type EventSponsorTierGroup = {
  tierRank: number | null;
  tierLabel: string | null;
  sponsors: EventSponsorRow[];
};

function tierLabelDisplay(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed !== "" ? trimmed : null;
}

function compareTierGroups(a: EventSponsorTierGroup, b: EventSponsorTierGroup): number {
  if (a.tierRank === null && b.tierRank === null) return 0;
  if (a.tierRank === null) return 1;
  if (b.tierRank === null) return -1;
  return a.tierRank - b.tierRank;
}

function compareSponsorsInTier(a: EventSponsorRow, b: EventSponsorRow): number {
  const aOrder = a.display_order ?? Number.POSITIVE_INFINITY;
  const bOrder = b.display_order ?? Number.POSITIVE_INFINITY;
  if (aOrder !== bOrder) return aOrder - bOrder;
  return String(a.id).localeCompare(String(b.id));
}

/**
 * Groups sponsors by tier_rank using the same ordering rules as admin QA:
 * tier_rank ASC NULLS LAST, then display_order ASC NULLS LAST, then id ASC.
 */
export function groupEventSponsorsByTier(
  sponsors: readonly EventSponsorRow[],
): EventSponsorTierGroup[] {
  const groups = new Map<string, EventSponsorTierGroup>();

  for (const sponsor of sponsors) {
    const tierRank = sponsor.tier_rank ?? null;
    const key = tierRank === null ? "__null__" : String(tierRank);
    const existing = groups.get(key);
    if (existing) {
      existing.sponsors.push(sponsor);
      continue;
    }

    groups.set(key, {
      tierRank,
      tierLabel: tierLabelDisplay(sponsor.tier_label),
      sponsors: [sponsor],
    });
  }

  const result = Array.from(groups.values());
  for (const group of result) {
    group.sponsors.sort(compareSponsorsInTier);
  }
  result.sort(compareTierGroups);
  return result;
}

export function publicTierGroupLabel(
  tierRank: number | null,
  tierLabel: string | null,
): string {
  if (tierLabel) return tierLabel;
  if (tierRank !== null) return `Tier ${tierRank}`;
  return "Untitled tier";
}

export function formatSponsorGroupCount(count: number): string {
  const value = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
  return value === 1 ? "1 company" : `${value} companies`;
}
