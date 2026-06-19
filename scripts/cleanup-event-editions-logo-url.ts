/**
 * Clear dead event_editions.logo_url values (set to NULL).
 *
 * Rollback reference:
 *   reports/backup-event-editions-logo-url-2026-06-19T08-41-21-271Z.jsonl
 *
 * Dry-run default:
 *   npm run cleanup:event-editions-logo-url
 *
 * Live mode:
 *   CLEANUP_LIVE=1 npm run cleanup:event-editions-logo-url
 *
 * Optional env:
 *   ROLLBACK_BACKUP_PATH=reports/backup-event-editions-logo-url-....jsonl
 */

import { readFileSync } from "node:fs";

import { createBackfillSupabaseClient } from "./backfill/core/supabase";

const DEFAULT_ROLLBACK_BACKUP_PATH =
  "reports/backup-event-editions-logo-url-2026-06-19T08-41-21-271Z.jsonl";

type BackupEditionRow = {
  type: "edition_logo_url";
  id: string;
  name: string | null;
  logo_url: string | null;
};

function isLiveMode(): boolean {
  const value = process.env.CLEANUP_LIVE?.trim().toLowerCase();
  return value === "1" || value === "true";
}

function loadRollbackBackup(path: string): BackupEditionRow[] {
  const raw = readFileSync(path, "utf8");
  const rows: BackupEditionRow[] = [];

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const record = JSON.parse(trimmed) as { type?: string };
    if (record.type !== "edition_logo_url") continue;
    rows.push(record as BackupEditionRow);
  }

  return rows;
}

async function countNonNullLogoUrls(
  supabase: ReturnType<typeof createBackfillSupabaseClient>,
): Promise<number> {
  const { count, error } = await supabase
    .from("event_editions")
    .select("id", { count: "exact", head: true })
    .not("logo_url", "is", null);

  if (error) {
    throw new Error(`[cleanup-event-editions-logo-url] count failed: ${error.message}`);
  }

  return count ?? 0;
}

async function main() {
  const supabase = createBackfillSupabaseClient();
  const live = isLiveMode();
  const rollbackPath =
    process.env.ROLLBACK_BACKUP_PATH?.trim() || DEFAULT_ROLLBACK_BACKUP_PATH;
  const rollbackRows = loadRollbackBackup(rollbackPath);

  const beforeCount = await countNonNullLogoUrls(supabase);

  let updatedRows: Array<{ id: string; name: string | null }> = [];

  if (live && beforeCount > 0) {
    const { data, error } = await supabase
      .from("event_editions")
      .update({ logo_url: null })
      .not("logo_url", "is", null)
      .select("id, name");

    if (error) {
      throw new Error(`[cleanup-event-editions-logo-url] update failed: ${error.message}`);
    }

    updatedRows = (data ?? []).map((row) => ({
      id: typeof row.id === "string" ? row.id : "",
      name: typeof row.name === "string" ? row.name : null,
    }));
  }

  const afterCount = live ? await countNonNullLogoUrls(supabase) : beforeCount;

  console.log(
    JSON.stringify(
      {
        dry_run: !live,
        rollback_backup_path: rollbackPath,
        rollback_backup_rows: rollbackRows.length,
        rows_before: beforeCount,
        rows_updated: live ? updatedRows.length : 0,
        rows_after: afterCount,
        verification: {
          query:
            "SELECT count(*) FROM event_editions WHERE logo_url IS NOT NULL",
          result: afterCount,
        },
        updated: live ? updatedRows : rollbackRows.map((row) => ({
          id: row.id,
          name: row.name,
          previous_logo_url: row.logo_url,
        })),
        rollback_note:
          "Restore logo_url values from the rollback backup JSONL if needed.",
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error("[cleanup-event-editions-logo-url] fatal:", message);
  process.exit(1);
});
