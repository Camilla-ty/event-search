import {
  groupExhibitorHistoryBySeries,
  type ExhibitorHistoryEditionEntry,
  type ExhibitorHistoryEvent,
  type ExhibitorHistorySeriesGroup,
} from "@/src/features/exhibitors/server/exhibitorHistoryModel";
import { getExhibitorLinksWithEditionsForCompany } from "@/src/lib/queries/exhibitors";

export type {
  ExhibitorHistoryEditionEntry,
  ExhibitorHistoryEvent,
  ExhibitorHistorySeries,
  ExhibitorHistorySeriesGroup,
} from "@/src/features/exhibitors/server/exhibitorHistoryModel";
export {
  formatExhibitorHistoryTierLabel,
  groupExhibitorHistoryBySeries,
  shouldShowExhibitorHistorySection,
} from "@/src/features/exhibitors/server/exhibitorHistoryModel";

function extractEdition(row: unknown): ExhibitorHistoryEvent | null {
  if (row === null || typeof row !== "object") return null;
  const link = row as {
    event_editions?: ExhibitorHistoryEvent | ExhibitorHistoryEvent[] | null;
  };
  const raw = link.event_editions;
  if (raw === null || raw === undefined) return null;
  if (Array.isArray(raw)) {
    const first = raw[0];
    return first ?? null;
  }
  return raw;
}

function extractEditionEntry(row: unknown): ExhibitorHistoryEditionEntry | null {
  if (row === null || typeof row !== "object") return null;
  const edition = extractEdition(row);
  if (!edition) return null;

  const link = row as { tier_rank?: unknown; tier_label?: unknown };
  const tierRank =
    typeof link.tier_rank === "number" && Number.isFinite(link.tier_rank)
      ? link.tier_rank
      : null;
  const tierLabelRaw = link.tier_label;
  const tierLabel =
    typeof tierLabelRaw === "string" && tierLabelRaw.trim() !== ""
      ? tierLabelRaw.trim()
      : null;

  return { edition, tierRank, tierLabel };
}

function logExhibitorHistoryLoadFailure(context: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[exhibitors] company history load failed (${context}):`, message);
}

/**
 * Public exhibitor history for a company profile (session client + public RLS).
 * Returns [] when absent or on failure so Company Detail can hide the section fail-soft.
 */
export async function getPublicExhibitorHistoryForCompany(
  companyId: string,
): Promise<ExhibitorHistorySeriesGroup[]> {
  const trimmed = companyId.trim();
  if (trimmed === "") return [];

  try {
    const links = await getExhibitorLinksWithEditionsForCompany(trimmed);
    if (!links || links.length === 0) return [];

    const byEditionId = new Map<string, ExhibitorHistoryEditionEntry>();

    for (const row of links) {
      const entry = extractEditionEntry(row);
      if (!entry) continue;
      const id =
        typeof entry.edition.id === "string"
          ? entry.edition.id
          : entry.edition.id != null
            ? String(entry.edition.id)
            : "";
      if (id === "") continue;
      if (!byEditionId.has(id)) {
        byEditionId.set(id, entry);
      }
    }

    return groupExhibitorHistoryBySeries([...byEditionId.values()]);
  } catch (error) {
    logExhibitorHistoryLoadFailure("unexpected", error);
    return [];
  }
}
