import type { LiveSponsorRow, LiveSponsorTierGroup } from "./liveSponsorTypes";

function tierLabelDisplay(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed !== "" ? trimmed : null;
}

function compareTierGroups(a: LiveSponsorTierGroup, b: LiveSponsorTierGroup): number {
  if (a.tierRank === null && b.tierRank === null) return 0;
  if (a.tierRank === null) return 1;
  if (b.tierRank === null) return -1;
  return a.tierRank - b.tierRank;
}

function compareSponsorsInTier(a: LiveSponsorRow, b: LiveSponsorRow): number {
  const aOrder = a.display_order ?? Number.POSITIVE_INFINITY;
  const bOrder = b.display_order ?? Number.POSITIVE_INFINITY;
  if (aOrder !== bOrder) return aOrder - bOrder;
  return a.id.localeCompare(b.id);
}

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

export function groupSponsorsByTier(sponsors: readonly LiveSponsorRow[]): LiveSponsorTierGroup[] {
  const groups = new Map<string, LiveSponsorTierGroup>();

  for (const sponsor of sponsors) {
    const tierRank = sponsor.tier_rank;
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

export function tierSectionTitle(group: LiveSponsorTierGroup): string {
  const label = group.tierLabel ?? "Untitled tier";
  const rankLabel = group.tierRank === null ? "—" : String(group.tierRank);
  const count = group.sponsors.length;
  const sponsorWord = count === 1 ? "sponsor" : "sponsors";
  return `${label} · rank ${rankLabel} · ${count} ${sponsorWord}`;
}
