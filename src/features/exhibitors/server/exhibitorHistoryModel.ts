import type { getEventEditions } from "@/src/lib/queries/events";

export type ExhibitorHistoryEvent = NonNullable<
  Awaited<ReturnType<typeof getEventEditions>>
>[number];

export type ExhibitorHistorySeries = {
  id: string;
  name: string;
};

export type ExhibitorHistoryEditionEntry = {
  edition: ExhibitorHistoryEvent;
  tierRank: number | null;
  tierLabel: string | null;
};

export type ExhibitorHistorySeriesGroup = {
  series: ExhibitorHistorySeries;
  editions: ExhibitorHistoryEditionEntry[];
};

/**
 * Pull `event_series.id` / `event_series.name` off the embedded relation.
 * Editions with no usable series are excluded from grouping by the caller.
 */
function extractSeries(edition: ExhibitorHistoryEvent): ExhibitorHistorySeries | null {
  const ref = edition as {
    event_series?:
      | { id?: unknown; name?: unknown }
      | Array<{ id?: unknown; name?: unknown }>
      | null;
  };
  const raw = ref.event_series;
  if (raw === null || raw === undefined) return null;

  const candidate = Array.isArray(raw) ? raw[0] : raw;
  if (!candidate) return null;

  const { id, name } = candidate;
  if (typeof id !== "string" || id.trim() === "") return null;
  if (typeof name !== "string" || name.trim() === "") return null;

  return { id: id.trim(), name: name.trim() };
}

function editionStartDate(edition: ExhibitorHistoryEvent): string {
  const raw = (edition as { start_date?: unknown }).start_date;
  return typeof raw === "string" ? raw : "";
}

function editionYear(edition: ExhibitorHistoryEvent): number {
  const raw = (edition as { year?: unknown }).year;
  return typeof raw === "number" && Number.isFinite(raw)
    ? raw
    : Number.NEGATIVE_INFINITY;
}

function editionIdKey(edition: ExhibitorHistoryEvent): string {
  if (typeof edition.id === "string") return edition.id;
  if (edition.id != null) return String(edition.id);
  return "";
}

/** Group by Event Brand; sort series by name ASC; editions by start_date DESC, year DESC, id ASC. */
export function groupExhibitorHistoryBySeries(
  entries: readonly ExhibitorHistoryEditionEntry[],
): ExhibitorHistorySeriesGroup[] {
  const groups = new Map<string, ExhibitorHistorySeriesGroup>();

  for (const entry of entries) {
    const series = extractSeries(entry.edition);
    if (!series) continue;

    const existing = groups.get(series.id);
    if (existing) {
      existing.editions.push(entry);
    } else {
      groups.set(series.id, { series, editions: [entry] });
    }
  }

  for (const group of groups.values()) {
    group.editions.sort((a, b) => {
      const da = editionStartDate(a.edition);
      const db = editionStartDate(b.edition);
      if (da !== db) return db.localeCompare(da);
      const ya = editionYear(a.edition);
      const yb = editionYear(b.edition);
      if (ya !== yb) return yb - ya;
      return editionIdKey(a.edition).localeCompare(editionIdKey(b.edition));
    });
  }

  return [...groups.values()].sort((a, b) =>
    a.series.name.localeCompare(b.series.name),
  );
}

export function shouldShowExhibitorHistorySection(
  groups: readonly ExhibitorHistorySeriesGroup[] | null | undefined,
): boolean {
  return (
    Array.isArray(groups) &&
    groups.some((group) => Array.isArray(group.editions) && group.editions.length >= 1)
  );
}

export function formatExhibitorHistoryTierLabel(
  tierRank: number | null,
  tierLabel: string | null,
): string | null {
  if (tierLabel !== null && tierLabel.trim() !== "") return tierLabel.trim();
  if (tierRank !== null) return `Tier ${tierRank}`;
  return null;
}
