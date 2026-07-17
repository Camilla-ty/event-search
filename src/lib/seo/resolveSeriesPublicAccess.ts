import { mapPublicEventSeries } from "@/src/features/events/server/mapPublicEditionRow";
import type { PublicEventSeriesSummary } from "@/src/features/events/types/publicEdition";
import {
  getEventSeriesById,
  getEventSeriesBySlug,
} from "@/src/lib/queries/events";
import { buildSeriesHubPath } from "@/src/lib/routes/explorerUrls";
import {
  getSeriesIndexability,
  normalizeSeriesLifecycle,
  type IndexabilityDecision,
} from "@/src/lib/seo/indexability";

export type SeriesPublicAccess =
  | {
      kind: "ok";
      series: PublicEventSeriesSummary;
      indexability: IndexabilityDecision;
    }
  | {
      kind: "redirect";
      /** Final non-merged successor path (single hop; chains collapsed). */
      path: string;
      fromSeries: PublicEventSeriesSummary;
      indexability: IndexabilityDecision;
    }
  | {
      kind: "tombstone";
      series: PublicEventSeriesSummary;
      indexability: IndexabilityDecision;
    };

type SeriesRowWithMerge = {
  id: string;
  slug: string;
  lifecycle_status: string | null;
  merged_into_series_id: string | null;
  merged_into_series?: unknown;
};

/**
 * Resolve public access for a series hub: OK, permanent redirect to final
 * successor, or non-indexable tombstone (no successor / loop).
 */
export async function resolveSeriesPublicAccess(
  identifier: string,
): Promise<SeriesPublicAccess | null> {
  const trimmed = identifier.trim();
  if (trimmed === "") return null;

  const raw =
    (await getEventSeriesBySlug(trimmed)) ?? (await getEventSeriesById(trimmed));
  const series = mapPublicEventSeries(raw);
  if (!series || !raw || typeof raw !== "object") return null;

  const row = raw as Record<string, unknown>;
  const start: SeriesRowWithMerge = {
    id: series.id,
    slug: series.slug,
    lifecycle_status: series.lifecycle_status,
    merged_into_series_id: readUuid(row.merged_into_series_id),
    merged_into_series: row.merged_into_series,
  };

  const lifecycle = normalizeSeriesLifecycle(start.lifecycle_status);
  if (lifecycle !== "merged") {
    return {
      kind: "ok",
      series,
      indexability: getSeriesIndexability({
        lifecycleStatus: start.lifecycle_status,
      }),
    };
  }

  const resolved = await resolveMergedSeriesSuccessor(start);
  if (resolved.kind === "redirect") {
    return {
      kind: "redirect",
      path: resolved.path,
      fromSeries: series,
      indexability: getSeriesIndexability({
        lifecycleStatus: "merged",
        treatAsMergedNonDestination: true,
      }),
    };
  }

  return {
    kind: "tombstone",
    series,
    indexability: getSeriesIndexability({
      lifecycleStatus: "merged",
      treatAsMergedNonDestination: true,
    }),
  };
}

export type MergedSuccessorResolution =
  | { kind: "redirect"; path: string; successorId: string }
  | { kind: "tombstone" };

/**
 * Walk merged_into chain to the first non-merged successor.
 * Detects loops; does not emit multi-hop redirect chains.
 */
export async function resolveMergedSeriesSuccessor(
  start: SeriesRowWithMerge,
): Promise<MergedSuccessorResolution> {
  return resolveMergedSeriesSuccessorWithLoader(start, loadSeriesRowById);
}

/** Testable core: inject loader for loop / chain cases. */
export async function resolveMergedSeriesSuccessorWithLoader(
  start: SeriesRowWithMerge,
  loadById: (id: string) => Promise<SeriesRowWithMerge | null>,
): Promise<MergedSuccessorResolution> {
  if (normalizeSeriesLifecycle(start.lifecycle_status) !== "merged") {
    const path = buildSeriesHubPath({ slug: start.slug, id: start.id });
    if (!path) return { kind: "tombstone" };
    return { kind: "redirect", path, successorId: start.id };
  }

  const visited = new Set<string>();
  let currentId = start.id;
  let nextId = start.merged_into_series_id;

  while (true) {
    if (visited.has(currentId)) return { kind: "tombstone" };
    visited.add(currentId);

    if (nextId === null || nextId === "") return { kind: "tombstone" };
    if (visited.has(nextId)) return { kind: "tombstone" };

    const successor = await loadById(nextId);
    if (!successor) return { kind: "tombstone" };

    const successorLifecycle = normalizeSeriesLifecycle(successor.lifecycle_status);
    if (successorLifecycle !== "merged") {
      const path = buildSeriesHubPath({
        slug: successor.slug,
        id: successor.id,
      });
      if (!path) return { kind: "tombstone" };
      return { kind: "redirect", path, successorId: successor.id };
    }

    currentId = successor.id;
    nextId = successor.merged_into_series_id;
  }
}

async function loadSeriesRowById(id: string): Promise<SeriesRowWithMerge | null> {
  const raw = await getEventSeriesById(id);
  const mapped = mapPublicEventSeries(raw);
  if (!mapped || !raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  return {
    id: mapped.id,
    slug: mapped.slug,
    lifecycle_status: mapped.lifecycle_status,
    merged_into_series_id: readUuid(row.merged_into_series_id),
  };
}

function readUuid(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed !== "" ? trimmed : null;
}
