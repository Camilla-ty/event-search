/**
 * Emergency rollback: restore logo_url values to full Supabase public URLs.
 *
 * Use when the bucket-relative migration breaks display and a code-side resolver
 * cannot be deployed quickly enough.
 *
 * Mode A — restore from migration backup (exact pre-migration values):
 *   npm run rollback:logo-urls-to-full-public-urls -- --from-backup
 *   (uses scripts/archives/logo-migrations/backup-logo-urls-before-relative-2026-07-07T09-55-06-042Z.jsonl)
 *   npm run rollback:logo-urls-to-full-public-urls -- --from-backup path/to/backup.jsonl
 *
 * Mode B — derive full URLs from current bucket-relative paths:
 *   npm run rollback:logo-urls-to-full-public-urls
 *   (omit --from-backup to scan live rows and expand relative paths)
 *
 * Dry-run (default):
 *   npm run rollback:logo-urls-to-full-public-urls
 *
 * Live writes (requires explicit approval):
 *   npm run rollback:logo-urls-to-full-public-urls -- --live
 *   ROLLBACK_LIVE=1 npm run rollback:logo-urls-to-full-public-urls -- --live
 *
 * Optional env:
 *   ROLLBACK_LIMIT=10
 *   ROLLBACK_REPORT_PATH=reports/logo-url-rollback.jsonl
 *   (reports/ is local-only / gitignored — fine for fresh run output)
 */

import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { SupabaseClient } from "@supabase/supabase-js";

import { isBucketRelativeStorageLogoPath } from "@/src/lib/storage/resolveStorageLogoDisplayUrl";
import { createBackfillSupabaseClient } from "./backfill/core/supabase";

const COMPANY_LOGO_BUCKET = "company-logos";
type TargetTable = "companies" | "event_series" | "venues";

type BackupEntry = {
  table: TargetTable;
  id: string;
  name?: string | null;
  logo_url: string;
};

type RollbackPlan = {
  table: TargetTable;
  id: string;
  name: string | null;
  before: string;
  after: string;
  source: "backup" | "derived";
};

type TableStats = {
  planned: number;
  updated: number;
  failed: number;
  skipped: number;
};

function readEnvFlag(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function readEnvLimit(): number | null {
  const raw = process.env.ROLLBACK_LIMIT?.trim();
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function readSupabasePublicBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  if (base === "") {
    console.error("[rollback-logo-urls] Missing NEXT_PUBLIC_SUPABASE_URL.");
    process.exit(1);
  }
  return base.replace(/\/+$/, "");
}

function toFullPublicLogoUrl(relativePath: string, supabaseBaseUrl: string): string {
  return `${supabaseBaseUrl}/storage/v1/object/public/${COMPANY_LOGO_BUCKET}/${relativePath}`;
}

function parseArgs(argv: string[]): { fromBackup: string | null; live: boolean } {
  let fromBackup: string | null = null;
  let live = readEnvFlag("ROLLBACK_LIVE");

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--live") {
      live = true;
      continue;
    }
    if (arg === "--from-backup") {
      const next = argv[index + 1];
      if (next && !next.startsWith("-")) {
        fromBackup = next;
        index += 1;
      } else {
        fromBackup = "";
      }
    }
  }

  return { fromBackup, live };
}

async function loadBackupEntries(backupPath: string): Promise<BackupEntry[]> {
  const content = await readFile(backupPath, "utf8");
  const entries: BackupEntry[] = [];

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    const parsed = JSON.parse(trimmed) as BackupEntry;
    if (
      parsed.table !== "companies" &&
      parsed.table !== "event_series" &&
      parsed.table !== "venues"
    ) {
      continue;
    }
    if (typeof parsed.id !== "string" || typeof parsed.logo_url !== "string") {
      continue;
    }
    entries.push(parsed);
  }

  return entries;
}

async function appendAuditRecord(reportPath: string, record: Record<string, unknown>) {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await appendFile(reportPath, `${JSON.stringify(record)}\n`, "utf8");
}

async function fetchTableRows(
  supabase: SupabaseClient,
  table: TargetTable,
): Promise<Array<{ id: string; name: string | null; logo_url: string | null }>> {
  const pageSize = 1000;
  let from = 0;
  const rows: Array<{ id: string; name: string | null; logo_url: string | null }> = [];

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("id, name, logo_url")
      .not("logo_url", "is", null)
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`[rollback-logo-urls] ${table} load failed: ${error.message}`);
    }

    const pageRows = (data ?? []) as Array<{
      id: string;
      name: string | null;
      logo_url: string | null;
    }>;
    rows.push(...pageRows);
    if (pageRows.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

function planFromBackup(entries: BackupEntry[]): RollbackPlan[] {
  return entries.map((entry) => ({
    table: entry.table,
    id: entry.id,
    name: entry.name ?? null,
    before: "",
    after: entry.logo_url,
    source: "backup" as const,
  }));
}

async function planFromLiveRows(
  supabase: SupabaseClient,
  supabaseBaseUrl: string,
): Promise<RollbackPlan[]> {
  const tables: TargetTable[] = ["companies", "event_series", "venues"];
  const planned: RollbackPlan[] = [];

  for (const table of tables) {
    const rows = await fetchTableRows(supabase, table);
    for (const row of rows) {
      const before = row.logo_url?.trim() ?? "";
      if (before === "" || !isBucketRelativeStorageLogoPath(before)) {
        continue;
      }

      planned.push({
        table,
        id: row.id,
        name: row.name,
        before,
        after: toFullPublicLogoUrl(before, supabaseBaseUrl),
        source: "derived",
      });
    }
  }

  return planned;
}

async function enrichPlansWithCurrentValues(
  supabase: SupabaseClient,
  plans: RollbackPlan[],
): Promise<RollbackPlan[]> {
  const enriched: RollbackPlan[] = [];

  for (const plan of plans) {
    const { data, error } = await supabase
      .from(plan.table)
      .select("logo_url")
      .eq("id", plan.id)
      .maybeSingle();

    if (error) {
      console.warn(
        `[rollback-logo-urls] skip ${plan.table} ${plan.id}: current value lookup failed`,
      );
      continue;
    }

    const current = typeof data?.logo_url === "string" ? data.logo_url : null;
    if (current === plan.after) {
      continue;
    }

    enriched.push({
      ...plan,
      before: current ?? plan.before,
    });
  }

  return enriched;
}

async function applyPlans(params: {
  supabase: SupabaseClient;
  plans: RollbackPlan[];
  live: boolean;
  reportPath: string;
  migratedAt: string;
}): Promise<Record<TargetTable, TableStats>> {
  const stats: Record<TargetTable, TableStats> = {
    companies: { planned: 0, updated: 0, failed: 0, skipped: 0 },
    event_series: { planned: 0, updated: 0, failed: 0, skipped: 0 },
    venues: { planned: 0, updated: 0, failed: 0, skipped: 0 },
  };

  for (const plan of params.plans) {
    const tableStats = stats[plan.table];
    tableStats.planned += 1;
    const label = plan.name?.trim() || plan.id;

    if (params.live) {
      const { error } = await params.supabase
        .from(plan.table)
        .update({ logo_url: plan.after })
        .eq("id", plan.id);

      if (error) {
        tableStats.failed += 1;
        await appendAuditRecord(params.reportPath, {
          ...plan,
          status: "failed",
          error: error.message,
          migratedAt: params.migratedAt,
        });
        console.error(`[rollback-logo-urls] failed ${plan.table} ${label}: ${error.message}`);
        continue;
      }

      tableStats.updated += 1;
      await appendAuditRecord(params.reportPath, {
        ...plan,
        status: "updated",
        error: null,
        migratedAt: params.migratedAt,
      });
      console.log(`[rollback-logo-urls] updated ${plan.table} ${label}`);
    } else {
      tableStats.updated += 1;
      await appendAuditRecord(params.reportPath, {
        ...plan,
        status: "dry_run_planned",
        error: null,
        migratedAt: params.migratedAt,
      });
      console.log(
        `[dry-run] ${plan.table} ${label} (${plan.source})\n` +
          `          before: ${plan.before || "(from backup)"}\n` +
          `          after:  ${plan.after}`,
      );
    }
  }

  return stats;
}

async function main() {
  const { fromBackup, live } = parseArgs(process.argv.slice(2));
  const limit = readEnvLimit();
  const reportPath =
    process.env.ROLLBACK_REPORT_PATH?.trim() ||
    "reports/logo-url-rollback-to-full-public.jsonl";
  const migratedAt = new Date().toISOString();
  const supabase = createBackfillSupabaseClient();
  const supabaseBaseUrl = readSupabasePublicBaseUrl();

  let plans: RollbackPlan[] = [];

  if (fromBackup !== null) {
    const defaultBackup =
      "scripts/archives/logo-migrations/backup-logo-urls-before-relative-2026-07-07T09-55-06-042Z.jsonl";
    const backupPath =
      fromBackup === ""
        ? defaultBackup
        : path.isAbsolute(fromBackup)
          ? fromBackup
          : path.join(process.cwd(), fromBackup);
    plans = planFromBackup(await loadBackupEntries(backupPath));
    plans = await enrichPlansWithCurrentValues(supabase, plans);
  } else {
    plans = await planFromLiveRows(supabase, supabaseBaseUrl);
  }

  if (limit !== null) {
    plans = plans.slice(0, limit);
  }

  console.log(
    `[rollback-logo-urls] mode=${fromBackup !== null ? "backup" : "derived"} live=${live} planned=${plans.length}`,
  );

  if (plans.length === 0) {
    console.log("[rollback-logo-urls] nothing to do.");
    return;
  }

  const stats = await applyPlans({
    supabase,
    plans,
    live,
    reportPath,
    migratedAt,
  });

  console.log("[rollback-logo-urls] summary:", stats);

  if (!live) {
    console.log("[rollback-logo-urls] dry-run only. Pass --live after approval to write.");
  }
}

main().catch((error) => {
  console.error("[rollback-logo-urls] fatal:", error);
  process.exit(1);
});
