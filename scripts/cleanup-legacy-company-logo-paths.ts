/**
 * Remove legacy domain-based company logo objects after migration.
 *
 * Active logos should already live at:
 *   company-logos/companies/{companyId}/logo.{ext}
 *
 * Dry-run (default — no deletes):
 *   npm run cleanup:legacy-company-logos
 *
 * Live cleanup:
 *   CLEANUP_LIVE=1 npm run cleanup:legacy-company-logos
 *
 * Optional env:
 *   CLEANUP_LIMIT=10
 *   CLEANUP_DELAY_MS=250
 *   CLEANUP_REPORT_PATH=tmp/company-logo-legacy-cleanup.jsonl
 *   BACKFILL_LOGO_BUCKET=company-logos
 *
 * Rollback (per deleted legacy object, using audit JSONL):
 *   1. Find audit lines with "status":"deleted"
 *   2. companies.logo_url is unchanged and still points at the companyId path
 *   3. Restore the deleted Storage object from backup, or re-copy bytes from
 *      another source into legacyStoragePath if you still need that URL
 *   4. This script does not modify companies rows; rollback is Storage-only
 *   5. If no backup exists, the legacy object cannot be recovered automatically
 *
 * Safety:
 *   - Only inspects the company-logos bucket
 *   - Never deletes companyId folders/objects
 *   - Never touches event-series or event-editions namespaces
 *   - Skips legacy paths still referenced by any company.logo_url
 */

import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  auditRecordForLegacyCleanupDelete,
  auditRecordForLegacyCleanupFailure,
  auditRecordForLegacyCleanupSkip,
  buildLogoUrlReferenceCounts,
  legacyLogoPathsForDomain,
  normalizeLegacyLogoDomain,
  planLegacyCompanyLogoCleanup,
  type LegacyCompanyLogoCleanupAuditRecord,
  type LegacyCompanyLogoCleanupRow,
} from "@/src/features/companies/server/companyLogoLegacyCleanup";
import {
  COMPANY_LOGO_BUCKET,
  parseCompanyLogoStoragePathFromUrl,
} from "@/src/features/companies/server/companyLogoStorage";

import { createBackfillSupabaseClient } from "./backfill/core/supabase";

type CleanupEnv = {
  dryRun: boolean;
  limit: number | null;
  delayMs: number;
  reportPath: string;
};

type CleanupSummary = {
  inspected: number;
  deleted: number;
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

function readCleanupEnv(): CleanupEnv {
  const dryRun = !parseBooleanEnv(process.env.CLEANUP_LIVE);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const defaultReportPath = path.join("tmp", `company-logo-legacy-cleanup-${timestamp}.jsonl`);

  return {
    dryRun,
    limit: parseOptionalPositiveInteger(process.env.CLEANUP_LIMIT),
    delayMs: parsePositiveInteger(process.env.CLEANUP_DELAY_MS, 250),
    reportPath: process.env.CLEANUP_REPORT_PATH?.trim() || defaultReportPath,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function incrementCounter(counters: Record<string, number>, key: string): void {
  counters[key] = (counters[key] ?? 0) + 1;
}

async function ensureReportDirectory(reportPath: string): Promise<void> {
  await mkdir(path.dirname(reportPath), { recursive: true });
}

async function appendAuditRecord(
  reportPath: string,
  record: LegacyCompanyLogoCleanupAuditRecord,
): Promise<void> {
  await appendFile(reportPath, `${JSON.stringify(record)}\n`, "utf8");
}

async function loadCompaniesWithLogos(
  supabase: SupabaseClient,
): Promise<LegacyCompanyLogoCleanupRow[]> {
  const pageSize = 200;
  const rows: LegacyCompanyLogoCleanupRow[] = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("companies")
      .select("id, name, domain, logo_url")
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
          domain: typeof row.domain === "string" ? row.domain : null,
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

async function getStorageObjectByteLength(
  supabase: SupabaseClient,
  storagePath: string,
): Promise<{ exists: boolean; byteLength: number; error: string | null }> {
  const { data, error } = await supabase.storage.from(COMPANY_LOGO_BUCKET).download(storagePath);
  if (error || !data) {
    return { exists: false, byteLength: 0, error: error?.message ?? "download_failed" };
  }
  return { exists: true, byteLength: data.size, error: null };
}

async function listLegacyLogoCandidatePaths(
  supabase: SupabaseClient,
  domain: string,
): Promise<string[]> {
  const normalizedDomain = normalizeLegacyLogoDomain(domain);
  if (!normalizedDomain) return [];

  const prefix = `companies/${normalizedDomain}`;
  const { data, error } = await supabase.storage.from(COMPANY_LOGO_BUCKET).list(prefix);
  if (error || !data) return [];

  const fileNames = data
    .map((item) => (typeof item.name === "string" ? item.name : null))
    .filter((value): value is string => value !== null);

  return legacyLogoPathsForDomain(normalizedDomain, fileNames);
}

async function deleteLegacyObject(
  supabase: SupabaseClient,
  storagePath: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.storage.from(COMPANY_LOGO_BUCKET).remove([storagePath]);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

async function main() {
  const env = readCleanupEnv();
  const supabase = createBackfillSupabaseClient();
  await ensureReportDirectory(env.reportPath);

  console.log("[cleanup-legacy-company-logos] starting");
  console.log("[cleanup-legacy-company-logos] config:", {
    dryRun: env.dryRun,
    live: !env.dryRun,
    limit: env.limit,
    delayMs: env.delayMs,
    reportPath: env.reportPath,
    bucket: COMPANY_LOGO_BUCKET,
  });

  if (env.dryRun) {
    console.log(
      "[cleanup-legacy-company-logos] dry-run mode: no Storage deletes",
    );
  } else {
    console.log(
      "[cleanup-legacy-company-logos] LIVE mode: will delete unreferenced legacy objects",
    );
  }

  const companies = await loadCompaniesWithLogos(supabase);
  const logoUrlReferenceCounts = buildLogoUrlReferenceCounts(companies);
  console.log(`[cleanup-legacy-company-logos] loaded ${companies.length} companies with logo_url`);

  const summary: CleanupSummary = {
    inspected: 0,
    deleted: 0,
    skipped: 0,
    failed: 0,
    dryRun: env.dryRun,
    reportPath: env.reportPath,
    skippedByReason: {},
  };

  let processedDeletes = 0;

  for (const row of companies) {
    if (env.limit !== null && processedDeletes >= env.limit) {
      console.log(`[cleanup-legacy-company-logos] limit ${env.limit} reached, stopping`);
      break;
    }

    summary.inspected += 1;
    const cleanedAt = new Date().toISOString();
    const label = row.name?.trim() || row.id;
    const progress = `${summary.inspected}/${companies.length}`;

    const parsedActive = parseCompanyLogoStoragePathFromUrl(row.logo_url);
    const activeStoragePath = parsedActive?.bucketRelativePath ?? null;
    const activeObject =
      activeStoragePath !== null
        ? await getStorageObjectByteLength(supabase, activeStoragePath)
        : { exists: false, byteLength: 0, error: null };

    const domain = normalizeLegacyLogoDomain(row.domain);
    const legacyCandidatePaths =
      domain !== null ? await listLegacyLogoCandidatePaths(supabase, domain) : [];

    const planItems = planLegacyCompanyLogoCleanup({
      row,
      activeObjectExists: activeObject.exists,
      activeObjectByteLength: activeObject.byteLength,
      legacyCandidatePaths,
      logoUrlReferenceCounts,
    });

    if (planItems.length === 1 && planItems[0]?.kind === "skip") {
      const skip = planItems[0];
      summary.skipped += 1;
      incrementCounter(summary.skippedByReason, skip.reason);
      await appendAuditRecord(
        env.reportPath,
        auditRecordForLegacyCleanupSkip({
          row,
          reason: skip.reason,
          cleanedAt,
          detail: skip.detail,
        }),
      );
      console.log(`[skip] (${progress}) ${label} - ${skip.reason}`);
      continue;
    }

    let companyHadDeletes = false;

    for (const item of planItems) {
      if (item.kind === "skip") {
        summary.skipped += 1;
        incrementCounter(summary.skippedByReason, item.reason);
        await appendAuditRecord(
          env.reportPath,
          auditRecordForLegacyCleanupSkip({
            row,
            reason: item.reason,
            legacyStoragePath: item.legacyStoragePath ?? null,
            cleanedAt,
            detail: item.detail,
          }),
        );
        console.log(
          `[skip] (${progress}) ${label} - ${item.reason}` +
            (item.legacyStoragePath ? ` (${item.legacyStoragePath})` : "") +
            (item.detail ? ` [${item.detail}]` : ""),
        );
        continue;
      }

      processedDeletes += 1;
      companyHadDeletes = true;
      const { plan } = item;

      if (env.dryRun) {
        summary.deleted += 1;
        await appendAuditRecord(
          env.reportPath,
          auditRecordForLegacyCleanupDelete({
            plan,
            status: "dry_run_planned",
            cleanedAt,
          }),
        );
        console.log(
          `[dry-run] (${progress}) ${label}\n` +
            `          active: ${plan.activeStoragePath}\n` +
            `          delete: ${plan.legacyStoragePath}`,
        );
        continue;
      }

      const removeResult = await deleteLegacyObject(supabase, plan.legacyStoragePath);
      if (!removeResult.ok) {
        summary.failed += 1;
        await appendAuditRecord(
          env.reportPath,
          auditRecordForLegacyCleanupFailure({
            row,
            plan,
            error: removeResult.error,
            cleanedAt,
          }),
        );
        console.error(`[fail] (${progress}) ${label} - ${removeResult.error}`);
        continue;
      }

      summary.deleted += 1;
      await appendAuditRecord(
        env.reportPath,
        auditRecordForLegacyCleanupDelete({
          plan,
          status: "deleted",
          cleanedAt,
        }),
      );
      console.log(
        `[ok]   (${progress}) ${label}\n` +
          `          active: ${plan.activeStoragePath}\n` +
          `          deleted: ${plan.legacyStoragePath}`,
      );
    }

    if (companyHadDeletes && env.delayMs > 0) {
      await delay(env.delayMs);
    }
  }

  console.log("[cleanup-legacy-company-logos] summary:", summary);
  console.log("[cleanup-legacy-company-logos] audit report:", env.reportPath);
  console.log(
    "[cleanup-legacy-company-logos] rollback: restore deleted legacyStoragePath objects from backup; companies.logo_url is unchanged",
  );

  if (summary.failed > 0) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error("[cleanup-legacy-company-logos] fatal:", message);
  process.exit(1);
});
