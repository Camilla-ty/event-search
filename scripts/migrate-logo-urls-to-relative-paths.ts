/**
 * Convert Storage-backed logo_url values from full Supabase public URLs to
 * bucket-relative paths.
 *
 * Tables:
 *   - companies.logo_url      -> companies/{companyId}/logo.{ext}
 *   - event_series.logo_url   -> event-series/{seriesId}/logo.{ext}
 *
 * Skips external URLs, empty values, and rows already using relative paths.
 * Does not modify event_editions.logo_url.
 *
 * Dry-run (default — no writes):
 *   npm run migrate:logo-urls-to-relative-paths
 *   npm run migrate:logo-urls-to-relative-paths -- --dry-run
 *
 * Live migration:
 *   npm run migrate:logo-urls-to-relative-paths -- --live
 *   MIGRATE_LIVE=1 npm run migrate:logo-urls-to-relative-paths
 *
 * Optional env:
 *   MIGRATE_LIMIT=10
 *   MIGRATE_SAMPLE_SIZE=5
 *   MIGRATE_REPORT_PATH=reports/logo-url-relative-migration.jsonl
 *   MIGRATE_BACKUP_PATH=reports/backup-logo-urls-before-relative.jsonl
 *
 * Rollback:
 *   Restore logo_url from the backup JSONL written before live updates.
 *
 * Do not run live migration until dry-run output has been reviewed.
 */

import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createBackfillSupabaseClient } from "./backfill/core/supabase";
import {
  planCompanyLogoUrlToRelativePath,
  planEventSeriesLogoUrlToRelativePath,
  type LogoUrlRelativePlan,
  type LogoUrlRelativeSkipReason,
} from "./lib/logoUrlRelativeMigration";

type TargetTable = "companies" | "event_series";

type LogoRow = {
  id: string;
  name: string | null;
  logo_url: string | null;
};

type PlannedConversion = {
  table: TargetTable;
  row: LogoRow;
  before: string;
  after: string;
};

type ConvertSample = {
  table: TargetTable;
  id: string;
  name: string | null;
  before: string;
  after: string;
};

type TableSummary = {
  loaded: number;
  convert: number;
  skip: number;
  updated: number;
  failed: number;
  skippedByReason: Record<LogoUrlRelativeSkipReason, number>;
};

type MigrationEnv = {
  dryRun: boolean;
  limit: number | null;
  sampleSize: number;
  reportPath: string;
  backupPath: string;
};

type AuditRecord = {
  table: TargetTable;
  id: string;
  name: string | null;
  before: string | null;
  after: string | null;
  status: "dry_run_planned" | "migrated" | "skipped" | "failed";
  skipReason: LogoUrlRelativeSkipReason | null;
  error: string | null;
  migratedAt: string;
};

function parseBooleanEnv(value: string | undefined): boolean {
  return value === "1" || value === "true";
}

function parseOptionalPositiveInteger(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return fallback;
  return parsed;
}

function hasCliFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function readMigrationEnv(): MigrationEnv {
  const live =
    parseBooleanEnv(process.env.MIGRATE_LIVE) || hasCliFlag("--live");
  const dryRun = hasCliFlag("--dry-run") || !live;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  return {
    dryRun,
    limit: parseOptionalPositiveInteger(process.env.MIGRATE_LIMIT),
    sampleSize: parsePositiveInteger(process.env.MIGRATE_SAMPLE_SIZE, 5),
    reportPath:
      process.env.MIGRATE_REPORT_PATH?.trim() ||
      path.join("reports", `logo-url-relative-migration-${timestamp}.jsonl`),
    backupPath:
      process.env.MIGRATE_BACKUP_PATH?.trim() ||
      path.join("reports", `backup-logo-urls-before-relative-${timestamp}.jsonl`),
  };
}

function emptySkipCounters(): Record<LogoUrlRelativeSkipReason, number> {
  return {
    empty: 0,
    already_relative: 0,
    external_url: 0,
    unparseable_storage_url: 0,
  };
}

function createTableSummary(): TableSummary {
  return {
    loaded: 0,
    convert: 0,
    skip: 0,
    updated: 0,
    failed: 0,
    skippedByReason: emptySkipCounters(),
  };
}

async function ensureReportDirectory(filePath: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
}

async function appendAuditRecord(reportPath: string, record: AuditRecord): Promise<void> {
  await appendFile(reportPath, `${JSON.stringify(record)}\n`, "utf8");
}

async function loadRowsWithLogoUrl(
  supabase: SupabaseClient,
  table: TargetTable,
): Promise<LogoRow[]> {
  const pageSize = 200;
  const rows: LogoRow[] = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from(table)
      .select("id, name, logo_url")
      .not("logo_url", "is", null)
      .order("name", { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`[migrate-logo-urls] failed to load ${table}: ${error.message}`);
    }

    const pageRows = (data ?? []).flatMap((row) => {
      if (typeof row.id !== "string") return [];
      return [
        {
          id: row.id,
          name: typeof row.name === "string" ? row.name : null,
          logo_url: typeof row.logo_url === "string" ? row.logo_url : null,
        },
      ];
    });

    rows.push(...pageRows);
    if (pageRows.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

function planRow(table: TargetTable, row: LogoRow): LogoUrlRelativePlan {
  if (table === "companies") {
    return planCompanyLogoUrlToRelativePath(row);
  }
  return planEventSeriesLogoUrlToRelativePath(row);
}

function applyLimit(
  planned: PlannedConversion[],
  limit: number | null,
): PlannedConversion[] {
  if (limit === null) return planned;
  return planned.slice(0, limit);
}

async function planTableConversions(
  table: TargetTable,
  rows: LogoRow[],
  reportPath: string,
  migratedAt: string,
): Promise<{ planned: PlannedConversion[]; summary: TableSummary }> {
  const summary = createTableSummary();
  summary.loaded = rows.length;
  const planned: PlannedConversion[] = [];

  for (const row of rows) {
    const result = planRow(table, row);
    if (result.kind === "skip") {
      summary.skip += 1;
      summary.skippedByReason[result.reason] += 1;
      await appendAuditRecord(reportPath, {
        table,
        id: row.id,
        name: row.name,
        before: row.logo_url,
        after: null,
        status: "skipped",
        skipReason: result.reason,
        error: null,
        migratedAt,
      });
      continue;
    }

    summary.convert += 1;
    planned.push({
      table,
      row,
      before: result.before,
      after: result.after,
    });
  }

  return { planned, summary };
}

function toSample(conversion: PlannedConversion): ConvertSample {
  return {
    table: conversion.table,
    id: conversion.row.id,
    name: conversion.row.name,
    before: conversion.before,
    after: conversion.after,
  };
}

async function writeLiveBackup(
  backupPath: string,
  planned: PlannedConversion[],
): Promise<void> {
  const lines = planned.map((entry) =>
    JSON.stringify({
      table: entry.table,
      id: entry.row.id,
      name: entry.row.name,
      logo_url: entry.before,
    }),
  );

  await writeFile(backupPath, lines.length > 0 ? `${lines.join("\n")}\n` : "", "utf8");
  console.log(`[migrate-logo-urls] backup written: ${backupPath} (${planned.length} rows)`);
}

function printSamples(samples: ConvertSample[]): void {
  if (samples.length === 0) {
    console.log("[migrate-logo-urls] sample changes: none");
    return;
  }

  console.log("[migrate-logo-urls] sample changes:");
  for (const sample of samples) {
    const label = sample.name?.trim() || sample.id;
    console.log(
      `  - ${sample.table} ${label} (${sample.id})\n` +
        `      before: ${sample.before}\n` +
        `      after:  ${sample.after}`,
    );
  }
}

async function applyPlannedConversions(params: {
  supabase: SupabaseClient;
  planned: PlannedConversion[];
  env: MigrationEnv;
  reportPath: string;
  migratedAt: string;
}): Promise<{
  companies: { updated: number; failed: number };
  event_series: { updated: number; failed: number };
}> {
  const { supabase, planned, env, reportPath, migratedAt } = params;
  const stats = {
    companies: { updated: 0, failed: 0 },
    event_series: { updated: 0, failed: 0 },
  };

  for (const entry of planned) {
    const label = entry.row.name?.trim() || entry.row.id;
    const tableStats = stats[entry.table];

    if (env.dryRun) {
      await appendAuditRecord(reportPath, {
        table: entry.table,
        id: entry.row.id,
        name: entry.row.name,
        before: entry.before,
        after: entry.after,
        status: "dry_run_planned",
        skipReason: null,
        error: null,
        migratedAt,
      });
      console.log(
        `[dry-run] ${entry.table} ${label}\n` +
          `          before: ${entry.before}\n` +
          `          after:  ${entry.after}`,
      );
      continue;
    }

    const { error } = await supabase
      .from(entry.table)
      .update({ logo_url: entry.after })
      .eq("id", entry.row.id);

    if (error) {
      tableStats.failed += 1;
      await appendAuditRecord(reportPath, {
        table: entry.table,
        id: entry.row.id,
        name: entry.row.name,
        before: entry.before,
        after: entry.after,
        status: "failed",
        skipReason: null,
        error: error.message,
        migratedAt,
      });
      console.error(`[fail] ${entry.table} ${label} - ${error.message}`);
      continue;
    }

    tableStats.updated += 1;
    await appendAuditRecord(reportPath, {
      table: entry.table,
      id: entry.row.id,
      name: entry.row.name,
      before: entry.before,
      after: entry.after,
      status: "migrated",
      skipReason: null,
      error: null,
      migratedAt,
    });
    console.log(
      `[ok] ${entry.table} ${label}\n` +
        `     before: ${entry.before}\n` +
        `     after:  ${entry.after}`,
    );
  }

  return stats;
}

async function main() {
  const env = readMigrationEnv();
  const supabase = createBackfillSupabaseClient();
  await ensureReportDirectory(env.reportPath);
  await ensureReportDirectory(env.backupPath);
  const migratedAt = new Date().toISOString();

  console.log("[migrate-logo-urls] starting");
  console.log("[migrate-logo-urls] config:", {
    dryRun: env.dryRun,
    live: !env.dryRun,
    limit: env.limit,
    sampleSize: env.sampleSize,
    reportPath: env.reportPath,
    backupPath: env.backupPath,
  });

  if (env.dryRun) {
    console.log("[migrate-logo-urls] dry-run mode: no DB updates");
  } else {
    console.log("[migrate-logo-urls] LIVE mode: will update companies and event_series logo_url");
  }

  const [companyRows, seriesRows] = await Promise.all([
    loadRowsWithLogoUrl(supabase, "companies"),
    loadRowsWithLogoUrl(supabase, "event_series"),
  ]);

  console.log(`[migrate-logo-urls] companies: loaded ${companyRows.length} rows with logo_url`);
  console.log(`[migrate-logo-urls] event_series: loaded ${seriesRows.length} rows with logo_url`);

  const companiesPlan = await planTableConversions(
    "companies",
    companyRows,
    env.reportPath,
    migratedAt,
  );
  const seriesPlan = await planTableConversions(
    "event_series",
    seriesRows,
    env.reportPath,
    migratedAt,
  );
  const allPlanned = applyLimit(
    [...companiesPlan.planned, ...seriesPlan.planned],
    env.limit,
  );

  const companiesSummary = { ...companiesPlan.summary };
  const seriesSummary = { ...seriesPlan.summary };

  if (env.limit !== null) {
    companiesSummary.convert = allPlanned.filter((entry) => entry.table === "companies").length;
    seriesSummary.convert = allPlanned.filter((entry) => entry.table === "event_series").length;
  }

  if (!env.dryRun && allPlanned.length > 0) {
    await writeLiveBackup(env.backupPath, allPlanned);
  }

  const applyResult = await applyPlannedConversions({
    supabase,
    planned: allPlanned,
    env,
    reportPath: env.reportPath,
    migratedAt,
  });

  companiesSummary.updated = applyResult.companies.updated;
  companiesSummary.failed = applyResult.companies.failed;
  seriesSummary.updated = applyResult.event_series.updated;
  seriesSummary.failed = applyResult.event_series.failed;

  const samples = allPlanned.slice(0, env.sampleSize).map(toSample);
  printSamples(samples);

  const output = {
    dry_run: env.dryRun,
    report_path: env.reportPath,
    backup_path: env.dryRun ? null : env.backupPath,
    companies: companiesSummary,
    event_series: seriesSummary,
    totals: {
      loaded: companiesSummary.loaded + seriesSummary.loaded,
      convert: companiesSummary.convert + seriesSummary.convert,
      skip: companiesSummary.skip + seriesSummary.skip,
      updated: applyResult.companies.updated + applyResult.event_series.updated,
      failed: applyResult.companies.failed + applyResult.event_series.failed,
    },
    sample_changes: samples,
    verification_sql: {
      remaining_full_storage_urls_companies:
        "SELECT count(*) FROM companies WHERE logo_url IS NOT NULL AND logo_url ~ '^https?://.*/storage/v1/object/public/company-logos/'",
      remaining_full_storage_urls_event_series:
        "SELECT count(*) FROM event_series WHERE logo_url IS NOT NULL AND logo_url ~ '^https?://.*/storage/v1/object/public/company-logos/'",
      relative_path_rows_companies:
        "SELECT id, logo_url FROM companies WHERE logo_url ~ '^companies/' ORDER BY name LIMIT 20",
      relative_path_rows_event_series:
        "SELECT id, logo_url FROM event_series WHERE logo_url ~ '^event-series/' ORDER BY name LIMIT 20",
      event_editions_unchanged:
        "SELECT count(*) FROM event_editions WHERE logo_url IS NOT NULL",
    },
    rollback_note:
      "Restore logo_url from backup JSONL (field: logo_url) or audit report before values.",
  };

  console.log("[migrate-logo-urls] summary:");
  console.log(JSON.stringify(output, null, 2));

  if (output.totals.failed > 0) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error("[migrate-logo-urls] fatal:", message);
  process.exit(1);
});
