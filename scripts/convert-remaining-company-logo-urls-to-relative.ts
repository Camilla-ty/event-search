/**
 * Convert remaining company logo_url values from full Supabase public URLs
 * to bucket-relative paths. Targets only companies rows still using full URLs.
 *
 * Dry-run (default):
 *   npx tsx --env-file=.env.local scripts/convert-remaining-company-logo-urls-to-relative.ts
 *
 * Live:
 *   npx tsx --env-file=.env.local scripts/convert-remaining-company-logo-urls-to-relative.ts --live
 */

import { createBackfillSupabaseClient } from "./backfill/core/supabase";
import { planCompanyLogoUrlToRelativePath } from "./lib/logoUrlRelativeMigration";

const BUCKET = "company-logos";

type CompanyRow = {
  id: string;
  name: string | null;
  logo_url: string | null;
};

function parseArgs(argv: string[]): { live: boolean } {
  return { live: argv.includes("--live") };
}

async function loadFullUrlCompanies(
  supabase: ReturnType<typeof createBackfillSupabaseClient>,
): Promise<CompanyRow[]> {
  const pageSize = 1000;
  let from = 0;
  const rows: CompanyRow[] = [];

  while (true) {
    const { data, error } = await supabase
      .from("companies")
      .select("id, name, logo_url")
      .like("logo_url", "%/storage/v1/object/public/company-logos/%")
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`companies query failed: ${error.message}`);
    }

    const page = (data ?? []) as CompanyRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function storageObjectExists(
  supabase: ReturnType<typeof createBackfillSupabaseClient>,
  path: string,
): Promise<boolean> {
  const parts = path.split("/");
  const file = parts.pop();
  const folder = parts.join("/");
  if (!file) return false;

  const { data, error } = await supabase.storage.from(BUCKET).list(folder, {
    search: file,
    limit: 100,
  });
  if (error) return false;
  return data?.some((item) => item.name === file) ?? false;
}

async function main() {
  const { live } = parseArgs(process.argv.slice(2));
  const supabase = createBackfillSupabaseClient();

  const rows = await loadFullUrlCompanies(supabase);

  const planned: Array<{
    id: string;
    name: string | null;
    before: string;
    after: string;
    path: string;
  }> = [];
  const skipped: Array<{ id: string; reason: string }> = [];

  for (const row of rows) {
    const plan = planCompanyLogoUrlToRelativePath(row);
    if (plan.kind === "skip") {
      skipped.push({ id: row.id, reason: plan.reason });
      continue;
    }

    if (!(await storageObjectExists(supabase, plan.after))) {
      skipped.push({ id: row.id, reason: `missing_storage_object:${plan.after}` });
      continue;
    }

    planned.push({
      id: row.id,
      name: row.name,
      before: plan.before,
      after: plan.after,
      path: plan.after,
    });
  }

  console.log(
    `[convert-company-logo-urls] loaded=${rows.length} planned=${planned.length} skipped=${skipped.length} live=${live}`,
  );

  if (skipped.length > 0) {
    console.log("[convert-company-logo-urls] skipped:");
    for (const item of skipped) {
      console.log(`  - ${item.id}: ${item.reason}`);
    }
  }

  for (const item of planned.slice(0, 5)) {
    console.log(
      `[sample] ${item.name ?? item.id}\n` +
        `  before: ${item.before}\n` +
        `  after:  ${item.after}`,
    );
  }

  if (!live) {
    console.log("[convert-company-logo-urls] dry-run only. Pass --live to write.");
    return;
  }

  let updated = 0;
  for (const item of planned) {
    const { error } = await supabase
      .from("companies")
      .update({ logo_url: item.after })
      .eq("id", item.id);

    if (error) {
      throw new Error(`update failed for ${item.id}: ${error.message}`);
    }
    updated += 1;
  }

  console.log(`[convert-company-logo-urls] updated=${updated}`);
}

main().catch((error) => {
  console.error("[convert-company-logo-urls] fatal:", error);
  process.exit(1);
});
