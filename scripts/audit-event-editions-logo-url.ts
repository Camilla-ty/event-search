/**
 * Read-only audit: event_editions rows with logo_url set.
 * Does not update the database.
 *
 * Run:
 *   npx tsx --env-file=.env.local scripts/audit-event-editions-logo-url.ts
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { createBackfillSupabaseClient } from "./backfill/core/supabase";

type EditionLogoBackupRow = {
  type: "edition_logo_url";
  id: string;
  name: string | null;
  logo_url: string | null;
};

async function main() {
  const supabase = createBackfillSupabaseClient();
  const generatedAt = new Date().toISOString();
  const reportPath =
    process.env.AUDIT_REPORT_PATH?.trim() ||
    `reports/backup-event-editions-logo-url-${generatedAt.replace(/[:.]/g, "-")}.jsonl`;

  const { data, error, count } = await supabase
    .from("event_editions")
    .select("id, name, logo_url", { count: "exact" })
    .not("logo_url", "is", null);

  if (error) {
    throw new Error(`[audit-event-editions-logo-url] query failed: ${error.message}`);
  }

  const rows: EditionLogoBackupRow[] = (data ?? []).map((row) => ({
    type: "edition_logo_url",
    id: typeof row.id === "string" ? row.id : "",
    name: typeof row.name === "string" ? row.name : null,
    logo_url: typeof row.logo_url === "string" ? row.logo_url : null,
  }));

  const nonNullCount = count ?? rows.length;

  const records = [
    {
      type: "meta" as const,
      generated_at: generatedAt,
      table: "event_editions",
      column: "logo_url",
      non_null_count: nonNullCount,
    },
    ...rows,
  ];

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, records.map((record) => JSON.stringify(record)).join("\n") + "\n", "utf8");

  console.log(
    JSON.stringify(
      {
        non_null_count: nonNullCount,
        report_path: reportPath,
        rows,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error("[audit-event-editions-logo-url] fatal:", message);
  process.exit(1);
});
