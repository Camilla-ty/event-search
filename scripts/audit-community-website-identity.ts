/**
 * Option B audit — community/social website identity (READ-ONLY).
 *
 * Finds data created BEFORE the Option B resolver fix that may still carry an
 * unsafe bare-host identity for multi-tenant community/social URLs.
 *
 * This script NEVER writes. There is no apply path: it only reports.
 *
 * Run:
 *   npm run audit:community-identity
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { scanCommunityIdentity } from "./lib/communityIdentityAudit";
import { createBackfillSupabaseClient } from "./backfill/core/supabase";

const ARTIFACTS_DIR = join(process.cwd(), "scripts", "artifacts", "community-identity");
const RUN_TS = new Date().toISOString().replace(/[:.]/g, "-");

function writeBackup(name: string, rows: unknown[]): string {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const path = join(ARTIFACTS_DIR, `community-identity-${name}-${RUN_TS}.jsonl`);
  const body = rows.map((row) => JSON.stringify(row)).join("\n");
  writeFileSync(path, rows.length > 0 ? `${body}\n` : "", "utf8");
  return path;
}

async function main(): Promise<void> {
  console.log("[community-identity audit] mode: READ-ONLY (no writes, ever)");

  const supabase = createBackfillSupabaseClient();
  const scan = await scanCommunityIdentity(supabase);

  const companyPath = writeBackup("companies-no-identity", scan.companyFindings);
  const unsafeDomainPath = writeBackup("companies-unsafe-domain", scan.unsafeDomainFindings);
  const collisionPath = writeBackup("domain-collisions", scan.collisions);
  const importPath = writeBackup("import-rows", scan.importFindings);

  console.log("\n=== JSONL artifacts ===");
  console.log(`  Report 1 (companies → no_identity): ${companyPath} (${scan.companyFindings.length} rows)`);
  console.log(
    `  Report 2 (unsafe-domain companies): ${unsafeDomainPath} (${scan.unsafeDomainFindings.length} rows)`,
  );
  console.log(`  Report 3 (domain collisions):       ${collisionPath} (${scan.collisions.length} groups)`);
  console.log(`  Report 4 (import rows):             ${importPath} (${scan.importFindings.length} rows)`);

  console.log("\n=== Report 1: companies where website → no_identity but domain != null ===");
  if (scan.companyFindings.length === 0) console.log("  (none)");
  for (const f of scan.companyFindings) {
    console.log(
      `  • ${f.name ?? f.id} (${f.id})\n      website: ${f.website}\n      domain:  "${f.current_domain}" -> null`,
    );
  }

  console.log("\n=== Report 2: companies whose domain is an unsafe bare host ===");
  if (scan.unsafeDomainFindings.length === 0) console.log("  (none)");
  for (const f of scan.unsafeDomainFindings) {
    console.log(`  • ${f.name ?? f.id} (${f.id})  domain="${f.domain}"  website=${f.website ?? "null"}`);
  }

  console.log("\n=== Report 3: shared-domain collision risks (possible wrong merges) ===");
  if (scan.collisions.length === 0) console.log("  (none)");
  for (const c of scan.collisions) {
    console.log(`  ! domain "${c.domain}" used by ${c.company_count} companies:`);
    for (const co of c.companies) {
      console.log(`      - ${co.name ?? co.id} (${co.id})  website=${co.website ?? "null"}`);
    }
  }

  console.log("\n=== Report 4: open import rows whose normalized_domain would become null ===");
  if (scan.importFindings.length === 0) console.log("  (none)");
  const riskyImports = scan.importFindings.filter((f) => f.invalidates_domain_match);
  for (const f of scan.importFindings) {
    const risk = f.invalidates_domain_match ? " [RISK: invalidates existing match]" : "";
    console.log(
      `  • ${f.raw_company_name ?? f.id} [${f.row_status}] (${f.id}) batch=${f.batch_id}${risk}\n      website: ${f.raw_website}\n      normalized_domain: "${f.current_normalized_domain}" -> null` +
        (f.proposed_company_id
          ? `\n      proposed_company_id=${f.proposed_company_id} match_method=${f.match_method ?? "null"}`
          : ""),
    );
  }
  if (riskyImports.length > 0) {
    console.log(`  (rows with an existing match that would be invalidated: ${riskyImports.length})`);
  }

  const collisionCompanies = scan.collisions.reduce((sum, c) => sum + c.company_count, 0);

  console.log("\n=== Summary ===");
  console.log(`  Report 1 — companies (website→no_identity, domain set): ${scan.companyFindings.length}`);
  console.log(`  Report 2 — companies with unsafe bare-host domain:      ${scan.unsafeDomainFindings.length}`);
  console.log(`  Report 3 — collision domain groups:                     ${scan.collisions.length} (${collisionCompanies} companies)`);
  console.log(`  Report 4 — open import rows would become null:          ${scan.importFindings.length}`);
  console.log(`  Report 4 — of which invalidate an existing match:       ${riskyImports.length}`);
  console.log(
    `\n  Cleanup needed: ${
      scan.companyFindings.length + scan.unsafeDomainFindings.length + scan.importFindings.length > 0
        ? "YES — review artifacts; collisions (Report 3) need manual resolution, never auto-split."
        : "NO — no pre-fix data found."
    }`,
  );
  console.log("\n[community-identity audit] complete — no database changes were made.");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error("[community-identity audit] fatal:", message);
  process.exit(1);
});
