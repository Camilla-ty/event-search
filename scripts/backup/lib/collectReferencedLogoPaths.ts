import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchAllPaginatedSupabaseRows } from "@/src/lib/supabase/fetchAllPaginatedRows";

import {
  type LogoSourceTable,
  type LogoUrlRow,
  resolveCatalogLogoStoragePath,
} from "./resolveCatalogLogoStoragePath";

export type CollectReferencedLogoPathsResult = {
  paths: string[];
  referenced_path_count: number;
  skipped_external_url_count: number;
  skipped_invalid_count: number;
};

type LogoUrlDbRow = {
  id: unknown;
  logo_url: unknown;
};

function mapLogoRow(row: LogoUrlDbRow): LogoUrlRow {
  return {
    id: typeof row.id === "string" ? row.id : "",
    logo_url: typeof row.logo_url === "string" ? row.logo_url : null,
  };
}

async function loadLogoUrlRows(
  supabase: SupabaseClient,
  table: LogoSourceTable,
): Promise<LogoUrlRow[]> {
  const rows = await fetchAllPaginatedSupabaseRows<LogoUrlDbRow>(async ({ from, to }) =>
    supabase.from(table).select("id, logo_url").not("logo_url", "is", null).range(from, to),
  );

  return rows.map(mapLogoRow).filter((row) => row.id !== "");
}

/** Aggregate canonical storage paths from catalog logo_url rows (pure). */
export function aggregateReferencedLogoPaths(
  rows: Array<{ table: LogoSourceTable; row: LogoUrlRow }>,
): CollectReferencedLogoPathsResult {
  const paths = new Set<string>();
  let skipped_external_url_count = 0;
  let skipped_invalid_count = 0;

  for (const entry of rows) {
    const resolution = resolveCatalogLogoStoragePath(entry.table, entry.row);
    if (resolution.kind === "include") {
      paths.add(resolution.path);
      continue;
    }

    if (resolution.reason === "external_url") {
      skipped_external_url_count += 1;
    } else if (resolution.reason === "invalid") {
      skipped_invalid_count += 1;
    }
  }

  const sortedPaths = [...paths].sort();
  return {
    paths: sortedPaths,
    referenced_path_count: sortedPaths.length,
    skipped_external_url_count,
    skipped_invalid_count,
  };
}

/** Query companies, event_series, and venues for storage-backed logo paths. */
export async function collectReferencedLogoPaths(
  supabase: SupabaseClient,
): Promise<CollectReferencedLogoPathsResult> {
  const [companies, eventSeries, venues] = await Promise.all([
    loadLogoUrlRows(supabase, "companies"),
    loadLogoUrlRows(supabase, "event_series"),
    loadLogoUrlRows(supabase, "venues"),
  ]);

  return aggregateReferencedLogoPaths([
    ...companies.map((row) => ({ table: "companies" as const, row })),
    ...eventSeries.map((row) => ({ table: "event_series" as const, row })),
    ...venues.map((row) => ({ table: "venues" as const, row })),
  ]);
}
