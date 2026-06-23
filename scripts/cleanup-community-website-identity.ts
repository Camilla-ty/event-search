/**
 * Option B — guarded community/social website identity cleanup.
 *
 * Fixes ONLY rows found by the community-identity audit scanner:
 *   - companies: website → no_identity but domain still set → domain = null
 *   - open import rows: normalized_domain stale → null + clear invalidated matches
 *
 * Safe by default: DRY_RUN unless COMMUNITY_IDENTITY_APPLY=1.
 * Always writes JSONL backups of BEFORE state before any write.
 * Never deletes rows. Never touches published/discarded batches or event_sponsors.
 *
 * Run (dry-run, default):
 *   npm run cleanup:community-identity
 * Apply (after reviewing dry-run):
 *   COMMUNITY_IDENTITY_APPLY=1 npm run cleanup:community-identity
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  scanCommunityIdentity,
  type CollisionFinding,
  type CompanyPlan,
  type ImportPlan,
} from "./lib/communityIdentityAudit";
import { createBackfillSupabaseClient } from "./backfill/core/supabase";

const APPLY = process.env.COMMUNITY_IDENTITY_APPLY === "1";
const DRY_RUN = !APPLY;

const ARTIFACTS_DIR = join(process.cwd(), "scripts", "artifacts", "community-identity");
const RUN_TS = new Date().toISOString().replace(/[:.]/g, "-");

function writeBackup(name: string, rows: unknown[]): string {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const path = join(ARTIFACTS_DIR, `cleanup-${name}-${RUN_TS}.jsonl`);
  const body = rows.map((row) => JSON.stringify(row)).join("\n");
  writeFileSync(path, rows.length > 0 ? `${body}\n` : "", "utf8");
  return path;
}

function printCompanyReport(plans: CompanyPlan[]): void {
  console.log("\n=== Companies: domain -> null (website unchanged) ===");
  if (plans.length === 0) {
    console.log("  (no company changes)");
    return;
  }
  for (const p of plans) {
    console.log(
      `  • ${p.row.name ?? p.row.id} (${p.row.id})\n      website: ${p.row.website}\n      domain:  "${p.row.domain}" -> null`,
    );
  }
}

function printImportReport(plans: ImportPlan[]): void {
  console.log("\n=== Open import rows: normalized_domain -> null + match unwind ===");
  if (plans.length === 0) {
    console.log("  (no import row changes)");
    return;
  }
  for (const p of plans) {
    const bits = [`normalized_domain "${p.row.normalized_domain}" -> null`];
    if (p.clearProposedMatch) {
      bits.push(`clear proposed_company_id (was ${p.row.proposed_company_id})`);
    }
    if (p.row.match_method === "domain") {
      bits.push("clear match_method/match_confidence");
    }
    if (p.resetResolvedDomainMatch) {
      bits.push(
        `reset status resolved -> needs_review (resolved_company_id was ${p.row.resolved_company_id})`,
      );
    }
    console.log(
      `  • ${p.row.raw_company_name ?? p.row.id} [${p.row.status}] (${p.row.id})\n      ${bits.join("; ")}`,
    );
  }
}

function printCollisionBlock(collisions: CollisionFinding[]): void {
  if (collisions.length === 0) return;
  console.log("\n=== BLOCKED: shared-domain collisions (manual resolution required) ===");
  for (const c of collisions) {
    console.log(`  ! domain "${c.domain}" used by ${c.company_count} companies`);
    for (const co of c.companies) {
      console.log(`      - ${co.name ?? co.id} (${co.id})`);
    }
  }
}

async function main(): Promise<void> {
  console.log(
    `[community-identity cleanup] mode: ${DRY_RUN ? "DRY_RUN (no writes)" : "APPLY (writes enabled)"}`,
  );

  const supabase = createBackfillSupabaseClient();
  const scan = await scanCommunityIdentity(supabase);

  const companyBackupPath = writeBackup(
    "companies-before",
    scan.companyPlans.map((p) => p.row),
  );
  const importBackupPath = writeBackup(
    "import-rows-before",
    scan.importPlans.map((p) => p.row),
  );

  console.log("\n=== Backup files (BEFORE state) ===");
  console.log(`  companies:   ${companyBackupPath} (${scan.companyPlans.length} rows)`);
  console.log(`  import rows: ${importBackupPath} (${scan.importPlans.length} rows)`);

  printCompanyReport(scan.companyPlans);
  printImportReport(scan.importPlans);
  printCollisionBlock(scan.collisions);

  const riskyImports = scan.importFindings.filter((f) => f.invalidates_domain_match).length;

  console.log("\n=== Plan summary ===");
  console.log(`  companies to update:              ${scan.companyPlans.length}`);
  console.log(`  open import rows to update:       ${scan.importPlans.length}`);
  console.log(`  import rows invalidating a match: ${riskyImports}`);
  console.log(`  collision domain groups:          ${scan.collisions.length}`);

  if (scan.collisions.length > 0) {
    console.error(
      "\n[community-identity cleanup] ABORT — collision groups present; resolve manually before apply.",
    );
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log(
      "\n[community-identity cleanup] DRY_RUN complete — no writes performed. Re-run with COMMUNITY_IDENTITY_APPLY=1 to apply.",
    );
    return;
  }

  if (scan.companyPlans.length === 0 && scan.importPlans.length === 0) {
    console.log("\n[community-identity cleanup] APPLY — nothing to update.");
    return;
  }

  console.log("\n[community-identity cleanup] APPLY — performing writes…");
  const now = new Date().toISOString();

  let companyUpdated = 0;
  for (const p of scan.companyPlans) {
    const { error } = await supabase.from("companies").update({ domain: null }).eq("id", p.row.id);
    if (error) {
      console.error(`  [fail] company ${p.row.id}: ${error.message}`);
      continue;
    }
    companyUpdated += 1;
    console.log(`  [ok] company ${p.row.name ?? p.row.id}`);
  }

  let importUpdated = 0;
  for (const p of scan.importPlans) {
    const { error } = await supabase
      .from("sponsor_import_rows")
      .update({ ...p.patch, updated_at: now })
      .eq("id", p.row.id);
    if (error) {
      console.error(`  [fail] import row ${p.row.id}: ${error.message}`);
      continue;
    }
    importUpdated += 1;
    console.log(`  [ok] import row ${p.row.raw_company_name ?? p.row.id}`);
  }

  console.log(
    `\n[community-identity cleanup] APPLY complete — companies updated: ${companyUpdated}/${scan.companyPlans.length}, import rows updated: ${importUpdated}/${scan.importPlans.length}`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error("[community-identity cleanup] fatal:", message);
  process.exit(1);
});
