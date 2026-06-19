/**
 * Cleanup unused event logo Storage objects in the company-logos bucket.
 *
 * Deletes only:
 *   - legacy event-series domain-based objects
 *   - orphan event-editions objects
 *
 * Does not update the database.
 *
 * Run (dry-run default):
 *   npm run cleanup:event-logo-storage
 *
 * Live mode:
 *   CLEANUP_LIVE=1 npm run cleanup:event-logo-storage
 *
 * Optional env:
 *   CLEANUP_REPORT_PATH=reports/my-cleanup.jsonl
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import type { SupabaseClient } from "@supabase/supabase-js";

import { COMPANY_LOGO_BUCKET } from "@/src/features/companies/server/companyLogoStorage";

import { createBackfillSupabaseClient } from "./backfill/core/supabase";
import {
  buildEventLogoLiveCleanupObjectRecords,
  buildSeriesByIdMap,
  classifyEventLogoStorageObject,
  EVENT_EDITIONS_PREFIX,
  EVENT_LOGO_CLEANUP_ROLLBACK_NOTE,
  EVENT_SERIES_PREFIX,
  selectEventLogoLiveCleanupDeletePaths,
  summarizeEventLogoLiveCleanup,
  type EventLogoLiveCleanupObjectRecord,
  type EventLogoLiveCleanupSummary,
} from "./audit/eventLogoStorageAudit";
import { listStorageObjectsUnderPrefix } from "./audit/listStoragePrefix";

const DELETE_BATCH_SIZE = 100;

type JsonlRecord =
  | {
      type: "meta";
      dry_run: boolean;
      live: boolean;
      bucket: string;
      generated_at: string;
    }
  | EventLogoLiveCleanupObjectRecord
  | EventLogoLiveCleanupSummary
  | { type: "rollback_note"; message: string };

function isLiveMode(): boolean {
  const value = process.env.CLEANUP_LIVE?.trim().toLowerCase();
  return value === "1" || value === "true";
}

function defaultReportPath(live: boolean): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const mode = live ? "live" : "dry-run";
  return `reports/cleanup-event-logo-storage-${mode}-${timestamp}.jsonl`;
}

function writeJsonl(path: string, records: JsonlRecord[]): void {
  mkdirSync(dirname(path), { recursive: true });
  const body = records.map((record) => JSON.stringify(record)).join("\n") + "\n";
  writeFileSync(path, body, "utf8");
}

async function loadEventSeriesRows(
  supabase: SupabaseClient,
): Promise<Array<{ id: string; logo_url: string | null }>> {
  const { data, error } = await supabase
    .from("event_series")
    .select("id, logo_url");

  if (error) {
    throw new Error(`[cleanup-event-logo-storage] event_series query failed: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: typeof row.id === "string" ? row.id : "",
    logo_url: typeof row.logo_url === "string" ? row.logo_url : null,
  }));
}

async function deleteStoragePaths(params: {
  supabase: SupabaseClient;
  bucket: string;
  paths: readonly string[];
}): Promise<{ deletedPaths: Set<string>; failedPaths: Map<string, string> }> {
  const deletedPaths = new Set<string>();
  const failedPaths = new Map<string, string>();

  for (let index = 0; index < params.paths.length; index += DELETE_BATCH_SIZE) {
    const batch = params.paths.slice(index, index + DELETE_BATCH_SIZE);
    const { error } = await params.supabase.storage.from(params.bucket).remove(batch);

    if (error) {
      for (const path of batch) {
        failedPaths.set(path, error.message);
      }
      continue;
    }

    for (const path of batch) {
      deletedPaths.add(path);
    }
  }

  return { deletedPaths, failedPaths };
}

async function main() {
  const supabase = createBackfillSupabaseClient();
  const bucket = COMPANY_LOGO_BUCKET;
  const live = isLiveMode();
  const dryRun = !live;
  const reportPath =
    process.env.CLEANUP_REPORT_PATH?.trim() || defaultReportPath(live);
  const generatedAt = new Date().toISOString();

  const [seriesRows, eventSeriesObjects, eventEditionObjects] = await Promise.all([
    loadEventSeriesRows(supabase),
    listStorageObjectsUnderPrefix({
      supabase,
      bucket,
      prefix: EVENT_SERIES_PREFIX,
    }),
    listStorageObjectsUnderPrefix({
      supabase,
      bucket,
      prefix: EVENT_EDITIONS_PREFIX,
    }),
  ]);

  const seriesById = buildSeriesByIdMap(seriesRows);
  const listedObjects = [...eventSeriesObjects, ...eventEditionObjects];

  const classifiedObjects = listedObjects.map((object) =>
    classifyEventLogoStorageObject({
      bucket,
      path: object.path,
      seriesById,
    }),
  );

  const deletePaths = selectEventLogoLiveCleanupDeletePaths(classifiedObjects);

  let deletedPaths = new Set<string>();
  let failedPaths = new Map<string, string>();

  if (live && deletePaths.length > 0) {
    const result = await deleteStoragePaths({
      supabase,
      bucket,
      paths: deletePaths,
    });
    deletedPaths = result.deletedPaths;
    failedPaths = result.failedPaths;
  }

  const actionRecords = buildEventLogoLiveCleanupObjectRecords({
    objects: classifiedObjects,
    deletedPaths,
    failedPaths,
    dryRun,
  });
  const summary = summarizeEventLogoLiveCleanup({
    records: actionRecords,
    dryRun,
  });

  const records: JsonlRecord[] = [
    {
      type: "meta",
      dry_run: dryRun,
      live,
      bucket,
      generated_at: generatedAt,
    },
    ...actionRecords,
    summary,
    {
      type: "rollback_note",
      message: EVENT_LOGO_CLEANUP_ROLLBACK_NOTE,
    },
  ];

  writeJsonl(reportPath, records);

  for (const record of records) {
    console.log(JSON.stringify(record));
  }

  console.error("[cleanup-event-logo-storage] complete", {
    report_path: reportPath,
    inspected: summary.inspected,
    deleted: summary.deleted,
    skipped: summary.skipped,
    failed: summary.failed,
    dryRun: summary.dryRun,
    rollback_note: EVENT_LOGO_CLEANUP_ROLLBACK_NOTE,
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error("[cleanup-event-logo-storage] fatal:", message);
  process.exit(1);
});
