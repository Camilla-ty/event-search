/**
 * Migrate company logos from legacy domain-based Storage paths to companyId-based paths.
 *
 * Target path: company-logos/companies/{companyId}/logo.{ext}
 *
 * Dry-run (default — no writes):
 *   npm run migrate:company-logos
 *   MIGRATE_DRY_RUN=1 npm run migrate:company-logos
 *
 * Live migration (copies Storage objects + updates companies.logo_url):
 *   MIGRATE_LIVE=1 npm run migrate:company-logos
 *
 * Optional env:
 *   MIGRATE_LIMIT=10
 *   MIGRATE_DELAY_MS=250
 *   MIGRATE_REPORT_PATH=tmp/company-logo-migration.jsonl
 *   BACKFILL_LOGO_BUCKET=company-logos
 *
 * Rollback (per migrated company, using audit JSONL):
 *   1. Find audit lines with "status":"migrated"
 *   2. Restore prior URL:
 *        UPDATE companies
 *        SET logo_url = '<oldLogoUrl from audit>'
 *        WHERE id = '<companyId from audit>';
 *   3. Legacy Storage objects were NOT deleted in this phase, so oldLogoUrl
 *      should still resolve after rollback.
 *   4. Optionally remove orphaned companies/{companyId}/logo.* objects later.
 *
 * Do not run live migration until dry-run output has been reviewed.
 */

import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  auditRecordForFailure,
  auditRecordForPlan,
  auditRecordForSkip,
  contentTypeForLogoExtension,
  planCompanyLogoMigration,
  type CompanyLogoMigrationAuditRecord,
  type CompanyLogoMigrationPlan,
  type CompanyLogoMigrationRow,
} from "@/src/features/companies/server/companyLogoMigration";
import { COMPANY_LOGO_BUCKET } from "@/src/features/companies/server/companyLogoStorage";

import { createBackfillSupabaseClient } from "./backfill/core/supabase";

type MigrationEnv = {
  dryRun: boolean;
  limit: number | null;
  delayMs: number;
  reportPath: string;
};

type MigrationSummary = {
  loaded: number;
  planned: number;
  migrated: number;
  skipped: number;
  failed: number;
  dryRun: boolean;
  reportPath: string;
  skippedByReason: Record<string, number>;
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

function readMigrationEnv(): MigrationEnv {
  const dryRun = !parseBooleanEnv(process.env.MIGRATE_LIVE);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const defaultReportPath = path.join("tmp", `company-logo-migration-${timestamp}.jsonl`);

  return {
    dryRun,
    limit: parseOptionalPositiveInteger(process.env.MIGRATE_LIMIT),
    delayMs: parsePositiveInteger(process.env.MIGRATE_DELAY_MS, 250),
    reportPath: process.env.MIGRATE_REPORT_PATH?.trim() || defaultReportPath,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function incrementCounter(counters: Record<string, number>, key: string): void {
  counters[key] = (counters[key] ?? 0) + 1;
}

function buildPublicUrl(supabase: SupabaseClient, storagePath: string): string {
  const {
    data: { publicUrl },
  } = supabase.storage.from(COMPANY_LOGO_BUCKET).getPublicUrl(storagePath);
  return publicUrl;
}

async function ensureReportDirectory(reportPath: string): Promise<void> {
  await mkdir(path.dirname(reportPath), { recursive: true });
}

async function appendAuditRecord(
  reportPath: string,
  record: CompanyLogoMigrationAuditRecord,
): Promise<void> {
  await appendFile(reportPath, `${JSON.stringify(record)}\n`, "utf8");
}

async function loadCompaniesWithLogos(
  supabase: SupabaseClient,
): Promise<CompanyLogoMigrationRow[]> {
  const pageSize = 200;
  const rows: CompanyLogoMigrationRow[] = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("companies")
      .select("id, name, logo_url")
      .not("logo_url", "is", null)
      .order("name", { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to fetch companies: ${error.message}`);
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

async function verifyStorageObjectExists(
  supabase: SupabaseClient,
  storagePath: string,
): Promise<boolean> {
  const { data, error } = await supabase.storage
    .from(COMPANY_LOGO_BUCKET)
    .download(storagePath);

  if (error || !data) return false;
  return data.size > 0;
}

async function migrateSingleCompanyLogo(params: {
  supabase: SupabaseClient;
  plan: CompanyLogoMigrationPlan;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, plan } = params;

  const { data: oldObject, error: downloadError } = await supabase.storage
    .from(COMPANY_LOGO_BUCKET)
    .download(plan.oldStoragePath);

  if (downloadError || !oldObject) {
    return {
      ok: false,
      error: downloadError?.message ?? "legacy_download_failed",
    };
  }

  const bytes = new Uint8Array(await oldObject.arrayBuffer());
  if (bytes.byteLength === 0) {
    return { ok: false, error: "legacy_object_empty" };
  }

  const contentType = contentTypeForLogoExtension(plan.extension);
  const { error: uploadError } = await supabase.storage
    .from(COMPANY_LOGO_BUCKET)
    .upload(plan.newStoragePath, bytes, {
      upsert: true,
      contentType,
      cacheControl: "3600",
    });

  if (uploadError) {
    return { ok: false, error: uploadError.message };
  }

  const verified = await verifyStorageObjectExists(supabase, plan.newStoragePath);
  if (!verified) {
    return { ok: false, error: "new_object_verification_failed" };
  }

  const { error: updateError } = await supabase
    .from("companies")
    .update({ logo_url: plan.newPublicUrl })
    .eq("id", plan.companyId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  return { ok: true };
}

async function main() {
  const env = readMigrationEnv();
  const supabase = createBackfillSupabaseClient();
  await ensureReportDirectory(env.reportPath);

  console.log("[migrate-company-logos] starting");
  console.log("[migrate-company-logos] config:", {
    dryRun: env.dryRun,
    live: !env.dryRun,
    limit: env.limit,
    delayMs: env.delayMs,
    reportPath: env.reportPath,
    bucket: COMPANY_LOGO_BUCKET,
  });

  if (env.dryRun) {
    console.log(
      "[migrate-company-logos] dry-run mode: no Storage writes, no DB updates, no deletes",
    );
  } else {
    console.log(
      "[migrate-company-logos] LIVE mode: will copy Storage objects and update companies.logo_url",
    );
  }

  const companies = await loadCompaniesWithLogos(supabase);
  console.log(`[migrate-company-logos] loaded ${companies.length} companies with logo_url`);

  const summary: MigrationSummary = {
    loaded: companies.length,
    planned: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
    dryRun: env.dryRun,
    reportPath: env.reportPath,
    skippedByReason: {},
  };

  let processed = 0;

  for (const row of companies) {
    if (env.limit !== null && processed >= env.limit) {
      console.log(`[migrate-company-logos] limit ${env.limit} reached, stopping`);
      break;
    }

    processed += 1;
    const migratedAt = new Date().toISOString();
    const label = row.name?.trim() || row.id;
    const progress = `${processed}/${companies.length}`;

    const result = planCompanyLogoMigration(row, (storagePath) =>
      buildPublicUrl(supabase, storagePath),
    );

    if (result.kind === "skip") {
      summary.skipped += 1;
      incrementCounter(summary.skippedByReason, result.reason);
      await appendAuditRecord(
        env.reportPath,
        auditRecordForSkip({ row, reason: result.reason, migratedAt }),
      );
      console.log(`[skip] (${progress}) ${label} - ${result.reason}`);
      continue;
    }

    summary.planned += 1;
    const { plan } = result;

    if (env.dryRun) {
      await appendAuditRecord(
        env.reportPath,
        auditRecordForPlan({
          plan,
          status: "dry_run_planned",
          migratedAt,
        }),
      );
      console.log(
        `[dry-run] (${progress}) ${label}\n` +
          `          old: ${plan.oldStoragePath}\n` +
          `          new: ${plan.newStoragePath}`,
      );
    } else {
      const liveResult = await migrateSingleCompanyLogo({ supabase, plan });
      if (!liveResult.ok) {
        summary.failed += 1;
        await appendAuditRecord(
          env.reportPath,
          auditRecordForFailure({
            row,
            plan,
            error: liveResult.error,
            migratedAt,
          }),
        );
        console.error(`[fail] (${progress}) ${label} - ${liveResult.error}`);
      } else {
        summary.migrated += 1;
        await appendAuditRecord(
          env.reportPath,
          auditRecordForPlan({
            plan,
            status: "migrated",
            migratedAt,
          }),
        );
        console.log(
          `[ok]   (${progress}) ${label}\n` +
            `          old: ${plan.oldStoragePath}\n` +
            `          new: ${plan.newStoragePath}`,
        );
      }
    }

    if (env.delayMs > 0) {
      await delay(env.delayMs);
    }
  }

  console.log("[migrate-company-logos] summary:", summary);
  console.log("[migrate-company-logos] audit report:", env.reportPath);
  console.log("[migrate-company-logos] rollback: restore companies.logo_url from audit oldLogoUrl");

  if (summary.failed > 0) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error("[migrate-company-logos] fatal:", message);
  process.exit(1);
});
