export type TierGroupableSponsorLink = {
  id: string | number;
  tier_rank?: number | null;
  tier_label?: string | null;
  display_order?: number | null;
};

export type SponsorTierGroup<T extends TierGroupableSponsorLink> = {
  tierRank: number | null;
  tierLabel: string | null;
  sponsors: T[];
};

function tierLabelDisplay(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed !== "" ? trimmed : null;
}

function compareTierGroups<T extends TierGroupableSponsorLink>(
  a: SponsorTierGroup<T>,
  b: SponsorTierGroup<T>,
): number {
  if (a.tierRank === null && b.tierRank === null) return 0;
  if (a.tierRank === null) return 1;
  if (b.tierRank === null) return -1;
  return a.tierRank - b.tierRank;
}

function compareSponsorsInTier<T extends TierGroupableSponsorLink>(a: T, b: T): number {
  const aOrder = a.display_order ?? Number.POSITIVE_INFINITY;
  const bOrder = b.display_order ?? Number.POSITIVE_INFINITY;
  if (aOrder !== bOrder) return aOrder - bOrder;
  return String(a.id).localeCompare(String(b.id));
}

export function groupSponsorsByTier<T extends TierGroupableSponsorLink>(
  sponsors: readonly T[],
): SponsorTierGroup<T>[] {
  const groups = new Map<string, SponsorTierGroup<T>>();

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

export function publicTierSectionTitle<T extends TierGroupableSponsorLink>(
  group: SponsorTierGroup<T>,
  totalCount = group.sponsors.length,
): string {
  const label = group.tierLabel ?? "Untitled tier";
  const count = Math.max(0, Math.trunc(totalCount));
  const sponsorWord = count === 1 ? "sponsor" : "sponsors";
  return `${label} · ${count} ${sponsorWord}`;
}

export function adminTierSectionTitle<T extends TierGroupableSponsorLink>(
  group: SponsorTierGroup<T>,
): string {
  const label = group.tierLabel ?? "Untitled tier";
  const rankLabel = group.tierRank === null ? "—" : String(group.tierRank);
  const count = group.sponsors.length;
  const sponsorWord = count === 1 ? "sponsor" : "sponsors";
  return `${label} · rank ${rankLabel} · ${count} ${sponsorWord}`;
}
