/**
 * Dry-run audit for legacy event logo objects in the company-logos bucket.
 *
 * Inspects:
 *   - event-series/*
 *   - event-editions/*
 *
 * Does not delete Storage objects or update the database.
 *
 * Run:
 *   npm run audit:event-logo-storage
 *
 * Optional env:
 *   AUDIT_REPORT_PATH=reports/my-audit.jsonl
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { COMPANY_LOGO_BUCKET } from "@/src/features/companies/server/companyLogoStorage";

import { createBackfillSupabaseClient } from "./backfill/core/supabase";
import {
  buildEventLogoCleanupPlan,
  buildSeriesByIdMap,
  classifyEventLogoStorageObject,
  EVENT_EDITIONS_PREFIX,
  EVENT_SERIES_PREFIX,
  summarizeEventLogoAudit,
  type ClassifiedEventLogoObject,
} from "./audit/eventLogoStorageAudit";
import { listStorageObjectsUnderPrefix } from "./audit/listStoragePrefix";

type JsonlRecord =
  | { type: "meta"; dry_run: true; bucket: string; generated_at: string }
  | ({ type: "object" } & ClassifiedEventLogoObject & {
      updated_at: string | null;
      size: number | null;
    })
  | ReturnType<typeof summarizeEventLogoAudit>
  | ReturnType<typeof buildEventLogoCleanupPlan>;

function defaultReportPath(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `reports/audit-event-logo-storage-${timestamp}.jsonl`;
}

function writeJsonl(path: string, records: JsonlRecord[]): void {
  mkdirSync(dirname(path), { recursive: true });
  const body = records.map((record) => JSON.stringify(record)).join("\n") + "\n";
  writeFileSync(path, body, "utf8");
}

async function loadEventSeriesRows(
  supabase: ReturnType<typeof createBackfillSupabaseClient>,
): Promise<Array<{ id: string; logo_url: string | null }>> {
  const { data, error } = await supabase
    .from("event_series")
    .select("id, logo_url");

  if (error) {
    throw new Error(`[audit-event-logo-storage] event_series query failed: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: typeof row.id === "string" ? row.id : "",
    logo_url: typeof row.logo_url === "string" ? row.logo_url : null,
  }));
}

async function main() {
  const supabase = createBackfillSupabaseClient();
  const bucket = COMPANY_LOGO_BUCKET;
  const reportPath = process.env.AUDIT_REPORT_PATH?.trim() || defaultReportPath();
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

  const classifiedObjects = listedObjects.map((object) => ({
    ...classifyEventLogoStorageObject({
      bucket,
      path: object.path,
      seriesById,
    }),
    updated_at: object.updated_at,
    size: object.size,
  }));

  const summary = summarizeEventLogoAudit({
    bucket,
    objects: classifiedObjects,
  });
  const cleanupPlan = buildEventLogoCleanupPlan(classifiedObjects);

  const records: JsonlRecord[] = [
    { type: "meta", dry_run: true, bucket, generated_at: generatedAt },
    ...classifiedObjects.map((object) => ({
      type: "object" as const,
      ...object,
    })),
    summary,
    cleanupPlan,
  ];

  writeJsonl(reportPath, records);

  for (const record of records) {
    console.log(JSON.stringify(record));
  }

  console.error("[audit-event-logo-storage] dry-run complete", {
    report_path: reportPath,
    total_event_series_objects: summary.total_event_series_objects,
    active_event_series_objects: summary.active_event_series_objects,
    legacy_event_series_objects: summary.legacy_event_series_objects,
    total_event_editions_objects: summary.total_event_editions_objects,
    orphan_event_editions_objects: summary.orphan_event_editions_objects,
    unknown_objects: summary.unknown_objects,
    delete_candidate_count: cleanupPlan.delete_candidate_paths.length,
    review_count: cleanupPlan.review_paths.length,
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error("[audit-event-logo-storage] fatal:", message);
  process.exit(1);
});
