import { mapPublicEditionRow } from "@/src/features/events/server/mapPublicEditionRow";
import type { SeriesParticipatedEvent } from "@/src/features/events/types/seriesParticipatedEvents";
import { buildEventDetailPath } from "@/src/lib/routes/explorerUrls";
import { normalizeSeriesLifecycle } from "@/src/lib/seo/indexability";

export function formatParticipatedRoleLabel(
  tierRank: number | null,
  tierLabel: string | null,
): string | null {
  if (typeof tierLabel === "string") {
    const trimmed = tierLabel.trim();
    if (trimmed !== "") return trimmed;
  }
  if (typeof tierRank === "number" && Number.isFinite(tierRank)) {
    return `Tier ${Math.trunc(tierRank)}`;
  }
  return null;
}

function readSeriesLifecycleFromEditionEmbed(rawEdition: unknown): string | null {
  if (rawEdition === null || typeof rawEdition !== "object") return null;
  const seriesRaw = (rawEdition as Record<string, unknown>).event_series;
  const series = Array.isArray(seriesRaw) ? seriesRaw[0] : seriesRaw;
  if (series === null || typeof series !== "object") return null;
  const lifecycle = (series as Record<string, unknown>).lifecycle_status;
  return typeof lifecycle === "string" ? lifecycle : null;
}

/**
 * Map a sponsor join row → public participated-event card.
 * Returns null when the edition is missing, unresolvable, or under a merged series.
 */
export function mapSeriesParticipatedSponsorRow(
  raw: unknown,
): SeriesParticipatedEvent | null {
  if (raw === null || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const editionEmbed = row.event_editions;
  const editionRaw = Array.isArray(editionEmbed) ? editionEmbed[0] : editionEmbed;
  const edition = mapPublicEditionRow(editionRaw);
  if (!edition) return null;

  const seriesLifecycle = readSeriesLifecycleFromEditionEmbed(editionRaw);
  if (normalizeSeriesLifecycle(seriesLifecycle) === "merged") return null;
  if (buildEventDetailPath(edition) === null) return null;

  const tierRankRaw = row.tier_rank;
  const tierRank =
    typeof tierRankRaw === "number" && Number.isFinite(tierRankRaw)
      ? Math.trunc(tierRankRaw)
      : null;
  const tierLabel =
    typeof row.tier_label === "string" && row.tier_label.trim() !== ""
      ? row.tier_label.trim()
      : null;

  return {
    edition,
    tierRank,
    tierLabel,
    roleLabel: formatParticipatedRoleLabel(tierRank, tierLabel),
  };
}

export function sortSeriesParticipatedEvents(
  items: readonly SeriesParticipatedEvent[],
): SeriesParticipatedEvent[] {
  return [...items].sort((a, b) => {
    const aStart = a.edition.start_date ?? "";
    const bStart = b.edition.start_date ?? "";
    if (aStart !== bStart) return aStart < bStart ? 1 : -1;
    const aYear = a.edition.year ?? 0;
    const bYear = b.edition.year ?? 0;
    if (aYear !== bYear) return bYear - aYear;
    return a.edition.name.localeCompare(b.edition.name);
  });
}
