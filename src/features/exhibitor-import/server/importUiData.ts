import { createAdminClient } from "@/src/lib/supabase/admin";

import { getActiveBatchForEdition, listBatchesAdmin } from "./exhibitorImportAdmin";

const ACTIVE_IMPORT_BATCH_STATUSES = new Set(["uploaded", "review", "draft"]);

function isActiveImportBatch(batch: Record<string, unknown>): boolean {
  return ACTIVE_IMPORT_BATCH_STATUSES.has(String(batch.status));
}

export type EditionImportContext = {
  editionId: string;
  editionName: string;
  seriesName: string;
  liveExhibitorCount: number;
  activeBatch: Record<string, unknown> | null;
  batches: Array<Record<string, unknown> & { edition_name: string; edition_year: number; series_name: string | null }>;
};

async function hydrateBatches(
  batches: Array<Record<string, unknown>>,
): Promise<
  Array<Record<string, unknown> & { edition_name: string; edition_year: number; series_name: string | null }>
> {
  if (batches.length === 0) return [];

  const editionIds = Array.from(
    new Set(
      batches
        .map((b) => b.event_edition_id)
        .filter((id): id is string => typeof id === "string"),
    ),
  );

  const supabase = createAdminClient();
  const { data: editions, error } = await supabase
    .from("event_editions")
    .select("id, name, year, event_series(name)")
    .in("id", editionIds);

  if (error) throw new Error(error.message);

  const byId = new Map<string, { name: string; year: number; series: string | null }>();
  for (const e of editions ?? []) {
    const seriesRaw = e.event_series;
    const seriesName =
      seriesRaw &&
      typeof seriesRaw === "object" &&
      "name" in seriesRaw &&
      typeof seriesRaw.name === "string"
        ? seriesRaw.name
        : null;
    byId.set(String(e.id), {
      name: String(e.name),
      year: Number(e.year),
      series: seriesName,
    });
  }

  return batches.map((b) => {
    const editionId = String(b.event_edition_id);
    const meta = byId.get(editionId);
    return {
      ...b,
      edition_name: meta?.name ?? "—",
      edition_year: meta?.year ?? 0,
      series_name: meta?.series ?? null,
    };
  });
}

export async function getEditionImportsData(
  editionId: string,
  editionName: string,
  seriesName: string,
  liveExhibitorCount: number,
): Promise<EditionImportContext> {
  const [activeBatch, listResult] = await Promise.all([
    getActiveBatchForEdition(editionId),
    listBatchesAdmin({ editionId, limit: 50 }),
  ]);

  const batches = await hydrateBatches(
    ((listResult.batches ?? []) as Array<Record<string, unknown>>).filter(isActiveImportBatch),
  );

  return {
    editionId,
    editionName,
    seriesName,
    liveExhibitorCount,
    activeBatch: activeBatch as Record<string, unknown> | null,
    batches,
  };
}

export async function getImportHistoryData(limit = 100) {
  const { batches } = await listBatchesAdmin({ limit });
  const hydrated = await hydrateBatches(
    (batches as Array<Record<string, unknown>>).filter(isActiveImportBatch),
  );
  return { batches: hydrated, total: hydrated.length };
}

export async function getDashboardImportsInProgress() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("exhibitor_import_batches")
    .select(
      "id, status, source_filename, source_row_count, created_at, event_edition_id",
    )
    .in("status", ["uploaded", "review", "draft"])
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) throw new Error(error.message);

  const batches = await hydrateBatches((data ?? []) as Array<Record<string, unknown>>);
  return batches;
}

export async function getBatchEditionContext(eventEditionId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("event_editions")
    .select("id, name, year, website_url, start_date, end_date, city_id, event_series(name)")
    .eq("id", eventEditionId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const seriesRaw = data.event_series;
  const seriesName =
    seriesRaw &&
    typeof seriesRaw === "object" &&
    "name" in seriesRaw &&
    typeof seriesRaw.name === "string"
      ? seriesRaw.name
      : null;

  const warnings: string[] = [];
  if (!data.website_url) warnings.push("Website not set on event.");
  if (!data.start_date && !data.end_date) warnings.push("Dates not set on event.");
  if (!data.city_id) warnings.push("City not set on event.");

  return {
    id: String(data.id),
    name: String(data.name),
    year: Number(data.year),
    seriesName,
    warnings,
  };
}
